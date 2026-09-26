/** music_box config — the Astronomer's Music Box sandbox (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";
import { ProbeSpec } from "../../contracts/world";
import { Expr } from "../contraptions/config-parts";

export const MusicBoxConfig = z.strictObject({ amplitude: ProbeSpec, rate: ProbeSpec, baseHz: z.number().min(110).max(880).default(220), xMax: Expr.default("4*pi") });
export type MusicBoxConfig = z.infer<typeof MusicBoxConfig>;
