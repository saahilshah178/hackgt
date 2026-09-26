/** pendulum_sync config — tuner.oscillator, ask period/frequency (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";
import { Tier } from "./config-parts";

export const PendulumSyncConfig = z.strictObject({
  spanUnitPx: z.number().min(40).max(200).default(94), // one "span" on the floor tiles
  armPx: z.number().min(150).max(500).default(300),
  shieldArmPx: z.number().min(200).max(700).default(442),
  swingDeg: z.number().min(4).max(30).default(14),
  spanTiles: z.number().int().min(0).max(9).default(7),
  driftCardTier: Tier.default(1),
  peakDotsTier: Tier.default(2),
  slowTimeToggle: z.boolean().default(true),
});
export type PendulumSyncConfig = z.infer<typeof PendulumSyncConfig>;
