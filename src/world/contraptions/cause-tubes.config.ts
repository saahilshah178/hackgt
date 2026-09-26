/** cause_tubes config — linker.chain (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";
import { ItemKey, ItemMeta, ProbeSpec } from "./config-parts";

export const CauseTubesConfig = z.strictObject({
  nodes: z.array(z.strictObject({ key: ItemKey, meta: ItemMeta.prefault({}) })).max(10).default([]),
  connector: z.enum(["catenary", "vertical_wire", "tube"]),
  layout: z.enum(["canopy_row", "mast", "ring"]), // placement by DISPLAY index, never causal order
  carrier: z.enum(["current", "capsule"]),
  gauge: z.boolean().default(true), // completion only
  boardWidth: z.number().min(600).max(1100).default(1100), // amendment 32
  probe: ProbeSpec.nullable().default(null),
  probeWorld: z.enum(["none", "record_lens"]).default("none"),
});
export type CauseTubesConfig = z.infer<typeof CauseTubesConfig>;
