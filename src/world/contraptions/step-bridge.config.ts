/** step_bridge config — sequencer.linear (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";
import { Id } from "../../contracts/common";
import { DateString } from "../../contracts/world";
import { Expr, ItemKey, ItemMeta, ProbeSpec, Tier } from "./config-parts";

export const StageId = z.enum(["touch", "fold", "pinch", "carry", "dissolve_bounce"]); // membrane-fold stage library
export type StageId = z.infer<typeof StageId>;
export const StepEffect = z.enum(["scaleEquation", "markAngle", "shadeQuadrants", "markSolutions", "missCircle"]);
export type StepEffect = z.infer<typeof StepEffect>;
export const StepBridgeConfig = z.strictObject({
  bays: z.enum(["floating", "flat_road", "arch", "stage_rail"]),
  items: z.array(z.strictObject({ key: ItemKey, meta: ItemMeta.prefault({}) })).max(12).default([]),
  stepEffects: z.array(z.strictObject({ key: ItemKey, effect: StepEffect })).max(12).default([]), // success-only card replay (trig e4)
  stages: z.array(z.strictObject({ key: ItemKey, stageId: StageId, icon: Id })).max(12).default([]), // bays = stage_rail
  anchors: z.number().int().min(0).max(4).default(0), // far-bank pylons (trig e4: 2, "two solutions")
  relief: z.strictObject({ expr: Expr, line: Expr }).nullable().default(null), // chasm-lip relief (trig e4)
  probe: ProbeSpec.nullable().default(null),
  probeWorld: z.enum(["none", "relief_marker", "day_counter", "playback", "bay_lamps", "record_lens"]).default("none"),
  dayCounter: z.strictObject({ epoch: DateString, max: z.number().int().min(1).max(9999) }).nullable().default(null),
  bayLampsTier: Tier.default(1), // amendment 26: world sweep only at this tier
  pageOrderHeading: z.string().min(1).max(32).nullable().default(null),
});
export type StepBridgeConfig = z.infer<typeof StepBridgeConfig>;
export const STEP_BRIDGE_SUCCESS_ONLY = ["stepEffects"] as const;
