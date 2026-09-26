/** darkroom config — the Editor's Darkroom sandbox (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";
import { Id } from "../../contracts/common";

export const DarkroomConfig = z.strictObject({ negatives: z.array(Id).min(1).max(8), trays: z.number().int().min(1).max(5).default(3) });
export type DarkroomConfig = z.infer<typeof DarkroomConfig>;
