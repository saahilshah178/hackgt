/** plant_garden config — the Plant Cell Garden sandbox (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";
import { ProbeSpec } from "../../contracts/world";

export const PlantGardenConfig = z.strictObject({ salt: ProbeSpec, cIn: z.number().min(0.5).max(5).default(2), wallRigid: z.boolean().default(true) });
export type PlantGardenConfig = z.infer<typeof PlantGardenConfig>;
