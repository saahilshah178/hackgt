import type Phaser from "phaser";
import type { Palette } from "../../engine/palettes";
import type { RoomPlacement } from "../types";

/*
 * Dungeon host scene (Phaser 4, WebGL-only). Rooms are laid out left-to-right in the order the
 * generator's prefab chunks give (start -> connector -> room per socket -> ... -> boss). Movement is
 * manual (no arcade physics) to stay simple and version-proof: the player is a tinted rectangle whose
 * x position is checked against each room's bounds every frame.
 *
 * The scene never touches React or the runner: it only reports "the player is standing in this room"
 * and "the player's room has an unresolved socket" via the callbacks passed in `init(data)`.
 */

export interface DungeonSceneData {
  rooms: RoomPlacement[];
  palette: Palette;
  onReachSocket: (encounterId: string) => void;
  /** Registers the imperative bridge (warpTo/setLiveValue) the moment the scene is ready. */
  onReady: (bridge: { warpTo: (encounterId: string | null) => void; setLiveValue: (value: unknown) => void }) => void;
}

const ROOM_W = 220;
const ROOM_GAP = 40;
const ROOM_H = 160;
const PLAYER_SPEED = 260;

export function createDungeonScene(PhaserLib: typeof Phaser): typeof Phaser.Scene {
  return class DungeonScene extends PhaserLib.Scene {
    private cfg!: DungeonSceneData;
    private player!: Phaser.GameObjects.Rectangle;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
    private frozen = false;
    private currentRoom = -1;
    private liveRing?: Phaser.GameObjects.Arc;
    private liveValue = 0;

    constructor() {
      super("DungeonScene");
    }

    init(data: DungeonSceneData) {
      this.cfg = data;
      this.frozen = false;
      this.currentRoom = -1;
    }

    preload() {
      this.load.spritesheet("tiles", "/assets/1bit/tilesheet.png", { frameWidth: 16, frameHeight: 16 });
    }

    create() {
      const { rooms, palette } = this.cfg;
      this.cameras.main.setBackgroundColor(palette.background);

      rooms.forEach((room, i) => {
        const x = i * (ROOM_W + ROOM_GAP);
        const floor = this.add.rectangle(x, 0, ROOM_W, ROOM_H, palette.floor).setStrokeStyle(4, room.encounter ? palette.accent : palette.wall);
        floor.setName(`room-${i}`);
        const label = room.def.socket ? room.def.socket : room.def.kind === "start" ? "start" : "hall";
        this.add
          .text(x, -ROOM_H / 2 - 18, label, { fontSize: "16px", color: "#f5f3ee", fontFamily: "system-ui, sans-serif" })
          .setOrigin(0.5, 1);
        if (i > 0) {
          const prevX = (i - 1) * (ROOM_W + ROOM_GAP);
          this.add.rectangle((prevX + x) / 2, 0, ROOM_GAP + 20, 24, palette.floor);
        }
      });

      const totalWidth = rooms.length * (ROOM_W + ROOM_GAP);
      this.cameras.main.setBounds(-ROOM_W, -ROOM_H, totalWidth + ROOM_W, ROOM_H * 3);

      this.player = this.add.rectangle(0, 0, 28, 28, palette.player);
      this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

      this.liveRing = this.add.circle(0, 0, 46, 0x000000, 0).setStrokeStyle(3, palette.accent, 0.9);
      this.liveRing.setVisible(false);

      if (this.input.keyboard) {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys("W,A,S,D") as unknown as Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
      }

      this.cfg.onReady({
        warpTo: (encounterId) => this.warpTo(encounterId),
        setLiveValue: (value) => this.setLiveValue(value),
      });

      this.checkRoom();
    }

    private roomIndexAt(x: number): number {
      return Math.max(0, Math.min(this.cfg.rooms.length - 1, Math.round(x / (ROOM_W + ROOM_GAP))));
    }

    private warpTo(encounterId: string | null) {
      const i = encounterId === null ? 0 : this.cfg.rooms.findIndex((r) => r.encounter?.id === encounterId);
      const idx = i === -1 ? 0 : i;
      this.player.x = idx * (ROOM_W + ROOM_GAP);
      this.player.y = 0;
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
      if (!frozen) this.liveRing?.setVisible(false);
    }

    private checkRoom() {
      const idx = this.roomIndexAt(this.player.x);
      if (idx === this.currentRoom) return;
      this.currentRoom = idx;
      const room = this.cfg.rooms[idx];
      if (room?.encounter) this.cfg.onReachSocket(room.encounter.id);
    }

    update(_time: number, delta: number) {
      if (!this.frozen && this.cursors) {
        const dt = delta / 1000;
        let vx = 0;
        if (this.cursors.left?.isDown || this.wasd?.A.isDown) vx = -PLAYER_SPEED;
        else if (this.cursors.right?.isDown || this.wasd?.D.isDown) vx = PLAYER_SPEED;
        this.player.x += vx * dt;
        this.checkRoom();
      }
      if (this.liveRing?.visible) this.liveRing.setPosition(this.player.x, this.player.y);
    }
  };
}
