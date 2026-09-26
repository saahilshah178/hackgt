/** ring_gate config — tuner.oscillator (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";
import { Tier } from "./config-parts";

export const RingGateConfig = z.strictObject({
  flow: z.enum(["water", "light", "air", "none"]).default("water"),
  tally: z.boolean().default(true),
  replayOnSettle: z.boolean().default(true),
  ghostCard: z.boolean().default(true), // g card = f(t + T) over a faint f
  lapsCardTier: Tier.default(2),
  startMarkerTier: Tier.default(1),
  variant: z.enum(["notch", "counterweight"]).default("notch"), // counterweight ⇔ ask ∈ {amplitude, midline}
});
export type RingGateConfig = z.infer<typeof RingGateConfig>;
