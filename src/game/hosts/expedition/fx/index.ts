/**
 * fx/index.ts (H1) — the FxKit every prefab receives (contraptions/types.ts): glow(), beam(), burst(), dormancy(),
 * pooledStrip(). `sensitiveSafe` skins get no bursts (R10: no shake, burst or strike fx).
 */
import type Phaser from "phaser";
import type { FxKit } from "../contraptions/types";
import { makeBeam } from "./beam";
import { setDormancy } from "./dormancy";
import { makeGlow } from "./glow";
import { burst } from "./particles";
import { makePooledStrip } from "./pooled-strip";
import { ensureFxTextures } from "./textures";

export function makeFxKit(scene: Phaser.Scene, P: typeof Phaser, opts: { sensitiveSafe: boolean; seed: number; dormancyStrength?: number }): FxKit & { updateBeams(tMs: number): void } {
  ensureFxTextures(scene);
  const beams: { update(tMs: number): void }[] = [];
  return {
    glow: (parent, at, radius, color, alpha) => makeGlow(scene, P, parent, at, radius, color, alpha),
    beam: (parent, from, to, color) => {
      const b = makeBeam(scene, P, parent, from, to, color);
      beams.push(b);
      return b;
    },
    burst: (parent, at, preset) => {
      if (opts.sensitiveSafe) return;
      burst(scene, P, parent, at, preset, opts.seed);
    },
    dormancy: (target, dormant, ms) => setDormancy(scene, target, dormant, ms ?? 600, opts.dormancyStrength ?? 0.4),
    pooledStrip: (parent, key, spacing, y, count) => makePooledStrip(scene, parent, key, spacing, y, count),
    updateBeams(tMs: number) {
      for (const b of beams) b.update(tMs);
    },
  };
}
