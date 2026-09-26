/** tumbler_vault config — investigator.elimination (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";
import { DateString } from "../../contracts/world";
import { ProbeSpec } from "./config-parts";

export const TumblerVaultConfig = z.strictObject({
  clues: z.array(z.strictObject({ index: z.number().int().min(0).max(9), date: DateString.nullable().default(null) })).max(10).default([]),
  bolts: z.number().int().min(2).max(8).default(4),
  miniStrip: z.strictObject({ start: z.number(), end: z.number() }).nullable().default(null),
  shadeCountsRung: z.union([z.literal(3), z.null()]).default(3),
  probe: ProbeSpec.nullable().default(null),
});
export type TumblerVaultConfig = z.infer<typeof TumblerVaultConfig>;
