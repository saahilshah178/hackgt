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
  /** Registers the imperative bridge (warpTo/setLiveValue/celebrate) the moment the scene is ready. */
  onReady: (bridge: { warpTo: (encounterId: string | null) => void; setLiveValue: (value: unknown) => void; celebrate: (mode: string) => void }) => void;
}

const ROOM_W = 220;
const ROOM_GAP = 40;
const ROOM_H = 160;
const PLAYER_SPEED = 260;

/**
 * Per-family dungeon skins (LIBRARY §5): a small tinted shape drawn in the room so each family reads
 * differently at a glance, even with placeholder art. Keyed by the encounter's mechanic `mode`.
 */
type RoomIcon =
  | "swatches"
  | "chain"
  | "door_glyph"
  | "rune_grid"
  | "ring"
  | "dial"
  | "gem"
  | "wave"
  | "scale"
  | "gear"
  | "flashcard"
  | "reservoir"
  | "reactor"
  | "none";

function iconForMode(mode: string | undefined): RoomIcon {
  switch (mode) {
    case "bins":
    case "type_match":
      return "swatches"; // sorter: category-keyed weapons/doors
    case "pairs":
    case "chain":
      return "chain"; // linker: chain lightning between pairs
    case "elimination":
      return "door_glyph"; // investigator: rooms are hypotheses
    case "plane":
      return "rune_grid"; // mapper: altar rune grid
    case "cycle":
      return "ring"; // sequencer.cycle: rotating glyph ring
    case "formula":
      return "dial"; // tuner: catapult / alchemy dials
    case "predict_reveal":
      return "gem"; // truth_finder: the reveal plays after the pick
    case "limit":
    case "slope":
      return "wave"; // function_world: rune track shaped by f(x)
    case "equation":
    case "chem_equation":
    case "ledger":
      return "scale"; // balance: altar alchemy scale
    case "encode":
    case "function_machine":
    case "trace":
      return "gear"; // transformer: forge crafting bench
    case "rapid":
    case "cloze":
      return "flashcard"; // recall: enemy spell-flashcards
    case "riemann":
    case "area":
    case "signed":
    case "rate_total":
    case "average_value":
      return "reservoir"; // accumulator: forge reservoir
    case "intervene":
    case "reach_state":
    case "predict":
    case "sample":
      return "reactor"; // simulator: enemy reactor
    default:
      return "none";
  }
}

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
    private roomIconsByIndex = new Map<number, Phaser.GameObjects.Container>();

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
        if (room.encounter) this.drawRoomIcon(i, x, iconForMode(room.encounter.mode), palette);
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
        celebrate: (mode) => this.celebrate(mode),
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

    /** Draws a small tinted shape reading each family's dungeon skin (LIBRARY §5); simple shapes, no sprite art needed. */
    private drawRoomIcon(index: number, x: number, icon: RoomIcon, palette: Palette) {
      if (icon === "none") return;
      const parts: Phaser.GameObjects.GameObject[] = [];
      switch (icon) {
        case "swatches": {
          // sorter: category-keyed doors/weapons as a row of tinted squares
          const colors = [palette.accent, palette.player, palette.wall];
          colors.forEach((c, i) => parts.push(this.add.rectangle(x - 20 + i * 20, 40, 14, 14, c)));
          break;
        }
        case "chain": {
          // linker: chain lightning between two anchors
          const zig = this.add.line(x, 40, -30, 0, 30, 0, palette.accent, 1).setLineWidth(3);
          parts.push(zig, this.add.circle(x - 30, 40, 6, palette.accent), this.add.circle(x + 30, 40, 6, palette.accent));
          break;
        }
        case "door_glyph":
          parts.push(this.add.text(x, 40, "?", { fontSize: "28px", color: "#f5f3ee" }).setOrigin(0.5));
          break;
        case "rune_grid": {
          // mapper.plane: a small rune grid on the altar
          for (let gx = -20; gx <= 20; gx += 20)
            for (let gy = 25; gy <= 55; gy += 15) parts.push(this.add.circle(x + gx, gy, 3, palette.accent));
          break;
        }
        case "ring":
          parts.push(this.add.circle(x, 40, 22, 0x000000, 0).setStrokeStyle(3, palette.accent));
          break;
        case "dial": {
          // tuner.formula: a small gauge with a needle
          const arc = this.add.circle(x, 40, 20, 0x000000, 0).setStrokeStyle(3, palette.accent);
          const needle = this.add.line(x, 40, 0, 0, 14, -14, palette.player, 1).setLineWidth(2);
          parts.push(arc, needle);
          break;
        }
        case "gem":
          parts.push(this.add.rectangle(x, 40, 18, 18, palette.accent).setRotation(Math.PI / 4));
          break;
        case "wave": {
          // function_world: a rune track shaped like a wave
          for (let dx = -30; dx <= 30; dx += 12) parts.push(this.add.circle(x + dx, 40 + Math.sin(dx * 0.3) * 10, 3, palette.accent));
          break;
        }
        case "scale": {
          // balance: an alchemy scale, two pans on a beam
          const beam = this.add.line(x, 32, -22, 0, 22, 0, palette.accent, 1).setLineWidth(3);
          parts.push(beam, this.add.rectangle(x - 22, 44, 14, 10, palette.player), this.add.rectangle(x + 22, 44, 14, 10, palette.player));
          break;
        }
        case "gear": {
          // transformer: a crafting-bench gear
          parts.push(this.add.circle(x, 40, 16, 0x000000, 0).setStrokeStyle(4, palette.accent));
          for (let a = 0; a < 6; a++) {
            const angle = (a / 6) * Math.PI * 2;
            parts.push(this.add.circle(x + Math.cos(angle) * 16, 40 + Math.sin(angle) * 16, 3, palette.accent));
          }
          break;
        }
        case "flashcard":
          // recall: a spell-flashcard
          parts.push(this.add.rectangle(x, 40, 26, 18, 0x000000, 0).setStrokeStyle(3, palette.accent), this.add.text(x, 40, "?", { fontSize: "14px", color: "#f5f3ee" }).setOrigin(0.5));
          break;
        case "reservoir": {
          // accumulator: a forge reservoir filling up
          parts.push(this.add.rectangle(x, 44, 24, 20, 0x000000, 0).setStrokeStyle(3, palette.accent), this.add.rectangle(x, 48, 20, 10, palette.player));
          break;
        }
        case "reactor":
          // simulator: an enemy reactor pulse
          parts.push(this.add.circle(x, 40, 18, 0x000000, 0).setStrokeStyle(3, palette.accent), this.add.circle(x, 40, 8, palette.player));
          break;
      }
      if (parts.length === 0) return;
      const container = this.add.container(0, 0, parts);
      this.roomIconsByIndex.set(index, container);
    }

    /** Plays the in-world success animation for the mode just cleared, at the player's current room (LIBRARY §5). */
    private celebrate(mode: string) {
      const icon = iconForMode(mode);
      const container = this.roomIconsByIndex.get(this.currentRoom);
      const targets: Phaser.GameObjects.GameObject[] = container ? [container] : [];
      if (targets.length > 0) {
        this.tweens.add({ targets, scale: { from: 1, to: 1.6 }, alpha: { from: 1, to: 0.4 }, duration: 220, yoyo: true, ease: "Quad.easeOut" });
      }
      // A small burst of particles at the player's position reads as "success" regardless of family.
      const burstColor = icon === "none" ? this.cfg.palette.accent : this.cfg.palette.player;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const dot = this.add.circle(this.player.x, this.player.y, 4, burstColor);
        this.tweens.add({
          targets: dot,
          x: this.player.x + Math.cos(angle) * 40,
          y: this.player.y + Math.sin(angle) * 40,
          alpha: 0,
          duration: 380,
          ease: "Quad.easeOut",
          onComplete: () => dot.destroy(),
        });
      }
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
