/** fx/glow.ts (H1) — baked radial glows, ADD blend (glow = information, bible §5.3). */
import type Phaser from "phaser";
import { FX_GLOW } from "./textures";

export function makeGlow(scene: Phaser.Scene, P: typeof Phaser, parent: Phaser.GameObjects.Container | null, at: { x: number; y: number }, radius: number, color: number, alpha = 0.8): Phaser.GameObjects.Image {
  const img = scene.add.image(at.x, at.y, FX_GLOW);
  img.setScale((radius * 2) / 128);
  img.setTint(color);
  img.setAlpha(alpha);
  img.setBlendMode(P.BlendModes.ADD);
  parent?.add(img);
  return img;
}
