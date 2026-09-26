/** emitter_rail config — mapper.number_line (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";
import { Expr, Tier } from "./config-parts";

export const EmitterRailConfig = z.strictObject({
  rail: z.enum(["arc", "straight", "log"]).default("straight"), // arc ⇒ view labels π and max − min = 2π
  radius: z.number().min(120).max(600).default(310),
  gauges: z.array(z.enum(["sin", "cos"])).max(2).default([]),
  hiddenTarget: z.enum(["fog", "dark", "water", "none"]).default("none"),
  detent: Expr.nullable().default(null), // "pi/12": every stud equally sticky
  readout: z.enum(["bracket", "value"]).default("bracket"),
  chevrons: z.boolean().default(true),
  cards: z
    .strictObject({
      unitCircle: z.boolean().default(false),
      cosTier: Tier.default(1),
      sixthsTier: Tier.default(2),
    })
    .prefault({}),
});
export type EmitterRailConfig = z.infer<typeof EmitterRailConfig>;
