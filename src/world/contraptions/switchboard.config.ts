/** switchboard config — linker.pairs (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";
import { ProbeSpec } from "./config-parts";

export const SwitchboardConfig = z.strictObject({
  document: z.strictObject({ title: z.string().min(1).max(80) }).nullable().default(null),
  stepLamps: z.boolean().default(true),
  cord: z.enum(["verlet", "catenary"]).default("verlet"),
  decoyDimRung: z.union([z.literal(3), z.null()]).default(null), // only when the fixture's hints[2] names the decoy
  probe: ProbeSpec.nullable().default(null),
  probeWorld: z.enum(["none", "record_lens"]).default("none"),
});
export type SwitchboardConfig = z.infer<typeof SwitchboardConfig>;
