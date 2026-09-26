import type Phaser from "phaser";
import type { Palette } from "../../engine/palettes";
import type { RoomPlacement } from "../types";
import { GROUND_THICKNESS, GROUND_Y, segmentCenterX, segmentIndexAt, segmentX, totalStripWidth } from "./layout";

/*
 * Platformer host scene (Phaser 4, WebGL, arcade physics). LIBRARY §1 "Platformer": a side-scrolling
 * strip, one prefab chunk per encounter left -> right, run + jump to the exit. Unlike the Dungeon
 * (whose rooms are purely position-checked, no collision), the platformer needs real ground/gravity
 * so a "gap" socket can be an actual pit the player can fall into and be respawned from.
 *
 * Every other socket (gate, moving_platform, switch, pickup, boss) is solid ground with a decorative,
 * interactive-looking obstacle standing on it; walking onto that segment reports the encounter the
 * same way the Dungeon reports a room (`onReachSocket`), and `celebrate(mode)` (called by GameClient
 * right after a correct answer) plays that socket's small "obstacle cleared" consequence.
 */

export interface PlatformerBridge {
  warpTo: (encounterId: string | null) => void;
  setLiveValue: (value: unknown) => void;
  celebrate: (mode: string) => void;
  /** Exposed for e2e (P10.2 acceptance): the player's current world x, for a keyboard-movement check. */
  playerX: () => number;
}

export interface PlatformerSceneData {
  rooms: RoomPlacement[];
  palette: Palette;
  onReachSocket: (encounterId: string) => void;
  onReady: (bridge: PlatformerBridge) => void;
}

const PLAYER_W = 24;
const PLAYER_H = 30;
const PLAYER_SPEED = 220;
const JUMP_VELOCITY = -560;
const GRAVITY_Y = 1500;
/** Falling this far below the ground line means "into an unsolved pit": respawn. */
const RESPAWN_Y = GROUND_Y + 400;

type ObstacleKind = "gap" | "gate" | "moving_platform" | "switch" | "pickup" | "boss" | null;

function obstacleKind(socket: string | null): ObstacleKind {
  switch (socket) {
    case "gap":
    case "gate":
    case "moving_platform":
    case "switch":
    case "pickup":
    case "boss":
      return socket;
    default:
      return null;
  }
}

export function createPlatformerScene(PhaserLib: typeof Phaser): typeof Phaser.Scene {
  return class PlatformerScene extends PhaserLib.Scene {
    private cfg!: PlatformerSceneData;
    private player!: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private frozen = false;
    private currentRoom = -1;
    private lastSafeX = PLAYER_W;
    private groundGroup!: Phaser.Physics.Arcade.StaticGroup;
    private wallGroup!: Phaser.Physics.Arcade.StaticGroup;
    private bridgeBySegment = new Map<number, Phaser.GameObjects.Rectangle>();
    private wallBySegment = new Map<number, Phaser.GameObjects.Rectangle>();
    private platformBySegment = new Map<number, Phaser.GameObjects.Rectangle>();
    private switchBySegment = new Map<number, Phaser.GameObjects.Rectangle>();
    private pickupBySegment = new Map<number, Phaser.GameObjects.Arc>();
    private solvedSegments = new Set<number>();
    private liveRing?: Phaser.GameObjects.Arc;
    private liveValue = 0;

    constructor() {
      super("PlatformerScene");
    }

    init(data: PlatformerSceneData) {
      this.cfg = data;
      this.frozen = false;
      this.currentRoom = -1;
      this.solvedSegments = new Set();
    }

    create() {
      const { rooms, palette } = this.cfg;
      this.cameras.main.setBackgroundColor(palette.background);

      this.groundGroup = this.physics.add.staticGroup();
      this.wallGroup = this.physics.add.staticGroup();

      rooms.forEach((room, i) => {
        const cx = segmentCenterX(i);
        const kind = obstacleKind(room.encounter ? room.def.socket : null);

        if (kind === "gap") {
          // A pit: no ground body yet. The bridge is drawn but not solid until solved.
          const bridge = this.add.rectangle(cx, GROUND_Y + GROUND_THICKNESS / 2, 300, GROUND_THICKNESS, palette.accent);
          bridge.setVisible(false);
          this.bridgeBySegment.set(i, bridge);
        } else {
          const ground = this.add.rectangle(cx, GROUND_Y + GROUND_THICKNESS / 2, 300, GROUND_THICKNESS, palette.wall);
          this.physics.add.existing(ground, true);
          this.groundGroup.add(ground);
        }

        const label = room.def.socket ?? (room.def.kind === "start" ? "start" : "run");
        this.add
          .text(cx, GROUND_Y - 210, label, { fontSize: "16px", color: "#f5f3ee", fontFamily: "system-ui, sans-serif" })
          .setOrigin(0.5, 1);

        if (kind) this.drawObstacle(i, cx, kind, palette);
      });

      const totalWidth = totalStripWidth(rooms.length);
      this.physics.world.setBounds(-200, -400, totalWidth + 400, 1400);
      this.cameras.main.setBounds(-100, -300, totalWidth + 200, 900);

      const startX = segmentX(0) + PLAYER_W * 2;
      this.player = this.add.rectangle(startX, GROUND_Y - PLAYER_H, PLAYER_W, PLAYER_H, palette.player) as typeof this.player;
      this.physics.add.existing(this.player);
      this.player.body.setSize(PLAYER_W, PLAYER_H);
      this.player.body.setCollideWorldBounds(false);
      this.lastSafeX = startX;

      this.physics.add.collider(this.player, this.groundGroup);
      this.physics.add.collider(this.player, this.wallGroup);

      this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

      this.liveRing = this.add.circle(0, 0, 40, 0x000000, 0).setStrokeStyle(3, palette.accent, 0.9);
      this.liveRing.setVisible(false);

      if (this.input.keyboard) {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys("W,A,S,D") as unknown as Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
        this.spaceKey = this.input.keyboard.addKey(PhaserLib.Input.Keyboard.KeyCodes.SPACE);
      }

      this.physics.world.gravity.y = GRAVITY_Y;

      this.cfg.onReady({
        warpTo: (encounterId) => this.warpTo(encounterId),
        setLiveValue: (value) => this.setLiveValue(value),
        celebrate: (mode) => this.celebrate(mode),
        playerX: () => this.player.x,
      });

      this.checkRoom();
    }

    /** Draws the socket-specific obstacle prop standing on segment `i` (LIBRARY §5-style skin per socket). */
    private drawObstacle(i: number, cx: number, kind: Exclude<ObstacleKind, null>, palette: Palette) {
      switch (kind) {
        case "gate": {
          const wall = this.add.rectangle(cx, GROUND_Y - 60, 24, 120, palette.wall).setStrokeStyle(3, palette.accent);
          this.physics.add.existing(wall, true);
          this.wallGroup.add(wall);
          this.wallBySegment.set(i, wall);
          break;
        }
        case "boss": {
          const wall = this.add.rectangle(cx, GROUND_Y - 90, 60, 180, palette.wall).setStrokeStyle(4, palette.accent);
          this.physics.add.existing(wall, true);
          this.wallGroup.add(wall);
          this.wallBySegment.set(i, wall);
          break;
        }
        case "moving_platform": {
          const platform = this.add.rectangle(cx, GROUND_Y - 70, 90, 16, palette.accent);
          this.platformBySegment.set(i, platform);
          break;
        }
        case "switch": {
          const lever = this.add.rectangle(cx, GROUND_Y - 30, 8, 40, palette.accent);
          this.switchBySegment.set(i, lever);
          break;
        }
        case "pickup": {
          const item = this.add.circle(cx, GROUND_Y - 60, 10, palette.accent);
          this.tweens.add({ targets: item, y: GROUND_Y - 76, duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
          this.pickupBySegment.set(i, item);
          break;
        }
        case "gap":
          break;
      }
    }

    private warpTo(encounterId: string | null) {
      const i = encounterId === null ? 0 : this.cfg.rooms.findIndex((r) => r.encounter?.id === encounterId);
      const idx = i === -1 ? 0 : i;
      const x = segmentCenterX(idx);
      this.player.x = x;
      this.player.y = GROUND_Y - PLAYER_H;
      this.player.body.setVelocity(0, 0);
      this.lastSafeX = x;
      this.currentRoom = -1;
      this.checkRoom();
    }

    private setLiveValue(value: unknown) {
      this.liveValue = typeof value === "number" ? value : 0;
      if (this.liveRing) {
        this.liveRing.setVisible(true);
        this.liveRing.rotation = this.liveValue * 0.6;
        this.liveRing.setPosition(this.player.x, this.player.y);
      }
    }

    setFrozen(frozen: boolean) {
      this.frozen = frozen;
      if (frozen) this.player.body.setVelocityX(0);
      else this.liveRing?.setVisible(false);
    }

    private checkRoom() {
      const idx = segmentIndexAt(this.player.x, this.cfg.rooms.length);
      if (idx === this.currentRoom) return;
      this.currentRoom = idx;
      const room = this.cfg.rooms[idx];
      if (room?.encounter && !this.solvedSegments.has(idx)) this.cfg.onReachSocket(room.encounter.id);
    }

    /** Plays the small "obstacle cleared" consequence for the socket at the room just solved. */
    private celebrate(_mode: string) {
      const idx = this.currentRoom;
      const room = this.cfg.rooms[idx];
      const kind = obstacleKind(room?.encounter ? room?.def.socket ?? null : null);
      if (!kind) return;
      this.solvedSegments.add(idx);

      switch (kind) {
        case "gap": {
          const bridge = this.bridgeBySegment.get(idx);
          if (!bridge) break;
          bridge.setVisible(true);
          bridge.setAlpha(0);
          this.tweens.add({ targets: bridge, alpha: 1, duration: 300 });
          this.physics.add.existing(bridge, true);
          this.groundGroup.add(bridge);
          break;
        }
        case "gate":
        case "boss": {
          const wall = this.wallBySegment.get(idx);
          if (!wall) break;
          this.wallGroup.remove(wall, false, false);
          this.tweens.add({
            targets: wall,
            y: wall.y - 160,
            alpha: 0,
            duration: 350,
            ease: "Quad.easeIn",
            onComplete: () => wall.destroy(),
          });
          break;
        }
        case "moving_platform": {
          const platform = this.platformBySegment.get(idx);
          if (!platform) break;
          const baseX = platform.x;
          this.tweens.add({ targets: platform, x: baseX + 70, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
          break;
        }
        case "switch": {
          const lever = this.switchBySegment.get(idx);
          if (!lever) break;
          this.tweens.add({ targets: lever, rotation: Math.PI / 2, duration: 250, ease: "Back.easeOut" });
          break;
        }
        case "pickup": {
          const item = this.pickupBySegment.get(idx);
          if (!item) break;
          this.tweens.add({
            targets: item,
            scale: 1.8,
            alpha: 0,
            duration: 300,
            onComplete: () => item.destroy(),
          });
          this.pickupBySegment.delete(idx);
          break;
        }
      }
    }

    update(_time: number, delta: number) {
      if (!this.frozen && this.cursors) {
        const dt = delta / 1000;
        void dt;
        let vx = 0;
        if (this.cursors.left?.isDown || this.wasd?.A.isDown) vx = -PLAYER_SPEED;
        else if (this.cursors.right?.isDown || this.wasd?.D.isDown) vx = PLAYER_SPEED;
        this.player.body.setVelocityX(vx);

        const onGround = this.player.body.blocked.down || this.player.body.touching.down;
        if (onGround) this.lastSafeX = this.player.x;
        const wantsJump = this.cursors.up?.isDown || this.wasd?.W.isDown || this.spaceKey?.isDown;
        if (wantsJump && onGround) this.player.body.setVelocityY(JUMP_VELOCITY);
      }

      if (this.player.y > RESPAWN_Y) {
        // Fell into an unsolved gap: respawn on the last ground the player stood on (no death spiral).
        this.player.x = this.lastSafeX;
        this.player.y = GROUND_Y - PLAYER_H;
        this.player.body.setVelocity(0, 0);
        this.currentRoom = -1;
      }

      this.checkRoom();
      if (this.liveRing?.visible) this.liveRing.setPosition(this.player.x, this.player.y);
    }
  };
}
