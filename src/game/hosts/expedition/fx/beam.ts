/**
 * fx/beam.ts (H1) — a beam = three stacked lines (core 2, inner 6, outer 18) plus an end-cap glow and ±8 % shimmer
 * (docs/design/20 §2.2).
 */
import type Phaser from "phaser";
import type { BeamHandle, XY } from "../contraptions/types";
import { makeGlow } from "./glow";

export function makeBeam(scene: Phaser.Scene, P: typeof Phaser, parent: Phaser.GameObjects.Container | null, from: XY, to: XY, color: number): BeamHandle & { update(tMs: number): void } {
  const g = scene.add.graphics();
  g.setBlendMode(P.BlendModes.ADD);
  parent?.add(g);
  const cap = makeGlow(scene, P, parent, to, 28, color, 0.9);
  let a = from;
  let b = to;
  let col = color;
  let alpha = 1;
  let dead = false;
  const draw = (shimmer: number) => {
    if (dead) return;
    g.clear();
    const k = alpha * shimmer;
    g.lineStyle(18, col, 0.18 * k).lineBetween(a.x, a.y, b.x, b.y);
    g.lineStyle(6, col, 0.45 * k).lineBetween(a.x, a.y, b.x, b.y);
    g.lineStyle(2, 0xffffff, 0.95 * k).lineBetween(a.x, a.y, b.x, b.y);
    cap.setPosition(b.x, b.y).setAlpha(0.9 * k).setTint(col);
  };
  draw(1);
  return {
    set(f, t) {
      a = f;
      b = t;
      draw(1);
    },
    setAlpha(v) {
      alpha = v;
      draw(1);
    },
    setColor(c) {
      col = c;
      draw(1);
    },
    update(tMs) {
      draw(1 + 0.08 * Math.sin(tMs / 90));
    },
    destroy() {
      dead = true;
      g.destroy();
      cap.destroy();
    },
  };
}
