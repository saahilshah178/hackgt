/**
 * fx/pooled-strip.ts (H1) — a pooled window of sprites along a dense strip (cell lipid heads, §2.11): `count`
 * sprites are re-bound to the strip slots within ±900 units of the camera centre as it moves; each jitters a little.
 */
import type Phaser from "phaser";
import type { PooledStripHandle } from "../contraptions/types";

export const POOL_HALF_WINDOW = 900;

export function makePooledStrip(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, textureKey: string, spacing: number, y: number, count: number): PooledStripHandle {
  const sprites: Phaser.GameObjects.Image[] = [];
  const n = Math.max(1, Math.min(200, count));
  for (let i = 0; i < n; i++) {
    const img = scene.add.image(0, y, textureKey);
    parent.add(img);
    sprites.push(img);
  }
  let t = 0;
  return {
    update(cameraCenterX: number) {
      t += 16;
      const localCenter = cameraCenterX - parent.x;
      const first = Math.floor((localCenter - POOL_HALF_WINDOW) / spacing);
      sprites.forEach((img, i) => {
        const slot = first + i;
        img.x = slot * spacing;
        img.y = y + Math.sin(t / 300 + slot * 1.7) * 2;
        img.setVisible(Math.abs(img.x - localCenter) <= POOL_HALF_WINDOW);
      });
    },
    destroy() {
      for (const s of sprites) s.destroy();
    },
  };
}
