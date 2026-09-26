/** oracle_ticker config — truth_finder.predict_reveal (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";
import { FileDate, Footprint, ProbeSpec } from "./config-parts";

export const OracleTickerConfig = z.strictObject({
  options: z
    .array(z.strictObject({ optionIndex: z.number().int().min(0).max(5), footprint: Footprint.nullable().default(null) }))
    .max(6)
    .default([]),
  probe: ProbeSpec.nullable().default(null),
  probeWorld: z.enum(["none", "record_lens"]).default("none"),
  fileDates: z.array(FileDate).max(4).default([]),
  conduit: z.enum(["telegraph_wire", "pipe", "beam"]).default("telegraph_wire"),
  payoffLamps: z.number().int().min(0).max(12).default(0), // success-only (the nine walk lamps)
});
export type OracleTickerConfig = z.infer<typeof OracleTickerConfig>;
export const ORACLE_TICKER_SUCCESS_ONLY = ["payoffLamps"] as const;
