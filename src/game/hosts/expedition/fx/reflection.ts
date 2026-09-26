/**
 * fx/reflection.ts (H1) — puddle reflections. P0 (docs/design/20 §0.1.2) ships the STATIC SHEEN: a translucent
 * gradient strip on the ground with a slow shimmer. The half-resolution RenderTexture reflection of L3/L4 at 15 Hz is
 * P1 (§0.1.3, §2.11): TODO(p1) swap `staticSheen` for it in S4 and S7 only.
 */
import type Phaser from "phaser";
import { FX_WHITE } from "./textures";

export function staticSheen(scene: Phaser.Scene, P: typeof Phaser, x: number, y: number, w: number, color = 0xc9f3ff): { update(tMs: number): void; destroy(): void } {
  const img = scene.add.image(x, y, FX_WHITE).setOrigin(0, 0).setDisplaySize(w, 18).setTint(color).setAlpha(0.22).setDepth(51).setBlendMode(P.BlendModes.SCREEN);
  return {
    update(tMs) {
      img.setAlpha(0.18 + 0.06 * Math.sin(tMs / 600));
    },
    destroy() {
      img.destroy();
    },
  };
}
