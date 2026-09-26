/** sluice_waves config — sorter.type_match (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";
import { Id } from "../../contracts/common";

export const SluiceCell = z.enum(["rbc", "generic", "plant", "potato"]);
export type SluiceCell = z.infer<typeof SluiceCell>;
export const SluiceFate = z.enum(["swell", "shrink", "steady", "plasmolysis", "strain"]);
export type SluiceFate = z.infer<typeof SluiceFate>;
export const SluiceWavesConfig = z.strictObject({
  waves: z
    .array(
      z.strictObject({
        waveIndex: z.number().int().min(0).max(9),
        cell: SluiceCell,
        inDots: z.number().int().min(0).max(60),
        outDots: z.number().int().min(0).max(80),
        fate: SluiceFate.nullable().default(null), // null when showFate is false
        showFate: z.boolean(), // true only when the wave text states the fate
      }),
    )
    .min(1)
    .max(10),
  valves: z
    .array(
      z.strictObject({
        categoryId: Id,
        densityK: z.number().min(0).max(5).nullable().default(null), // hover claim render: ρ_out = ρ_in · k (e5)
        arrows: z.enum(["in", "out", "both", "none"]).default("none"), // hover claim render: ghost water arrows (e9)
      }),
    )
    .min(2)
    .max(4),
});
export type SluiceWavesConfig = z.infer<typeof SluiceWavesConfig>;
