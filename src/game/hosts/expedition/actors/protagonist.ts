/**
 * actors/protagonist.ts (H1) — the player on the character atlas (docs/design/20 §2.2, §5.5): pose-swap animation over
 * the packed poses, costume overlays on the per-frame rig anchors (rigid or spring-follow, layer swapped on back-facing
 * frames, hidden on `hideOn` poses), a soft contact shadow, landing squash, and the biome's SUCCESS POSE on every solve
 * (cheer0/1, or `show` in archive_of_voices; A11).
 */
import type Phaser from "phaser";
import type { CharacterLook, RigAnchor } from "../../../../contracts/world";
import type { ZoneArtLoader, RigInfo } from "../art/zone-loader";
import type { CharState } from "../scene/character";
import { FX_SHADOW } from "../fx/textures";
import { placeCostume, springStep, RIG_DISPLAY_H, RIG_DISPLAY_W } from "./costume";
import { frameFor, type Motion } from "./pose-animator";

export const PLAYER_DEPTH = 75;

interface CostumeSprite {
  item: CharacterLook["costume"][number];
  img: Phaser.GameObjects.Image;
  spring: { pos: { x: number; y: number }; vel: { x: number; y: number } } | null;
}

export class Protagonist {
  readonly body: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly costumes: CostumeSprite[] = [];
  private readonly rig: RigInfo | null;
  private readonly scale: number;
  private override: { motion: Motion; untilMs: number } | null = null;
  private clockMs = 0;
  frame = "idle";
  facing: 1 | -1 = 1;
  x = 0;
  y = 0;

  constructor(private readonly scene: Phaser.Scene, P: typeof Phaser, look: CharacterLook, loader: ZoneArtLoader & { ensure?: (s: Phaser.Scene, k: string) => string }) {
    this.rig = loader.rig(look.atlas);
    this.scale = look.scale * (this.rig?.scale ?? 1);
    const texKey = this.rig?.texture ?? loader.texture(look.atlas) ?? look.atlas;
    this.shadow = scene.add.image(0, 0, FX_SHADOW).setTint(0x6e7f9a).setAlpha(0.5).setDepth(PLAYER_DEPTH - 2).setBlendMode(P.BlendModes.MULTIPLY);
    this.body = scene.add.sprite(0, 0, texKey, this.rig?.poses.has("idle") ? "idle" : undefined).setOrigin(0.5, 1).setDepth(PLAYER_DEPTH).setScale(this.scale);
    if (!this.rig) this.body.setDisplaySize(RIG_DISPLAY_W * this.scale * 0.6, RIG_DISPLAY_H * this.scale);
    for (const item of look.costume) {
      const key = loader.texture(item.asset) ?? loader.ensure?.(scene, item.asset) ?? item.asset;
      const img = scene.add.image(0, 0, key).setDepth(PLAYER_DEPTH + 1).setScale(this.scale * 0.8);
      this.costumes.push({ item, img, spring: item.follow === "spring" ? { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } } : null });
    }
  }

  /** Plays a motion for `ms` regardless of locomotion (success pose, interact, emotes). */
  play(motion: Motion, ms: number): void {
    this.override = { motion, untilMs: this.clockMs + ms };
  }
  successPose(kind: "cheer" | "show", ms = 1400): void {
    this.play(kind === "show" ? "show" : "cheer", ms);
  }

  sync(s: CharState, dtMs: number): void {
    this.clockMs += dtMs;
    const tSec = this.clockMs / 1000;
    const motion = this.override && this.override.untilMs > this.clockMs && !s.path ? this.override.motion : s.motion;
    if (this.override && this.override.untilMs <= this.clockMs) this.override = null;
    this.x = s.x;
    this.y = s.y;
    this.facing = s.facing;
    const poses = this.rig?.poses ?? new Set(["idle"]);
    this.frame = frameFor(motion, tSec, poses);
    if (this.rig && this.body.frame.name !== this.frame) this.body.setFrame(this.frame);
    const flip = s.facing < 0;
    this.body.setFlipX(flip);
    const sq = s.squash > 0 ? 1 : 0;
    this.body.setScale(this.scale * (1 + 0.06 * sq), this.scale * (1 - 0.06 * sq));
    this.body.setPosition(s.x, s.y);
    const air = s.path ? Math.max(0, s.path.at(1).y - s.y) : 0;
    this.shadow.setPosition(s.x, s.path ? s.path.at(1).y : s.y).setScale(Math.max(0.35, 0.9 - air / 600), 0.9).setAlpha(Math.max(0.15, 0.5 - air / 900));
    const anchors = this.rig?.anchors(this.frame) ?? null;
    for (const c of this.costumes) {
      const p = placeCostume(c.item, anchors, flip);
      c.img.setVisible(p.visible);
      if (!p.visible) continue;
      let px = s.x + p.x * this.scale;
      let py = s.y + p.y * this.scale;
      if (c.spring) {
        const lagged = springStep(c.spring.pos, c.spring.vel, { x: px, y: py }, dtMs / 1000, 90, 14);
        c.spring = lagged;
        // tails lag behind the anchor by at most 24 units
        const dx = Math.max(-24, Math.min(24, lagged.pos.x - px));
        const dy = Math.max(-24, Math.min(24, lagged.pos.y - py));
        px += dx;
        py += dy;
      }
      c.img.setPosition(px, py).setAngle(p.angle).setFlipX(flip).setDepth(PLAYER_DEPTH + (p.front ? 1 : -1));
    }
  }

  /** World position of a rig anchor in the current frame (feet when unknown). */
  anchorWorld(name: RigAnchor): { x: number; y: number } {
    const a = this.rig?.anchors(this.frame)?.points.find((p) => p.name === name);
    if (!a) return { x: this.x, y: name === "feet" ? this.y : this.y - RIG_DISPLAY_H * this.scale * 0.8 };
    const fx = this.facing < 0 ? RIG_DISPLAY_W - a.x : a.x;
    return { x: this.x + (fx - RIG_DISPLAY_W / 2) * this.scale, y: this.y + (a.y - RIG_DISPLAY_H) * this.scale };
  }
  headTop(): { x: number; y: number } {
    return { x: this.x, y: this.y - RIG_DISPLAY_H * this.scale };
  }
  setVisible(on: boolean): void {
    this.body.setVisible(on);
    this.shadow.setVisible(on);
    for (const c of this.costumes) c.img.setVisible(on && c.img.visible);
  }
  destroy(): void {
    this.body.destroy();
    this.shadow.destroy();
    for (const c of this.costumes) c.img.destroy();
  }
}
