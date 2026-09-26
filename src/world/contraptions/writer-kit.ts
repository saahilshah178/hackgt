/**
 * src/world/contraptions/writer-kit.ts (W0, main) — helpers for each meta's writerConfigSchema (docs/design/20 §4.4).
 * Writer schemas are LLM-facing and strict-mode legal (instructions.md §4): root object, every field required
 * (.nullable(), never .optional()), no z.record, z.union not discriminatedUnion, single-value enums, no string
 * length/regex rules, bounded integers. tests/strict-schemas.test.ts audits every meta's writer schema.
 */
import { z } from "zod";
import { asTuple } from "../../contracts/slices";
import { ProbeSpec } from "../../contracts/world";

export const wExpr = () => z.string().describe("An exact mathjs expression in x, e.g. 3*sin(x). Never a decimal approximation");
export const wDate = () => z.string().describe("YYYY, YYYY-MM or YYYY-MM-DD, copied from the item's own text");
export const W_PROBE_FORMATS = ["number", "pi", "integer", "percent", "year", "month_year"] as const;
export const wProbe = () =>
  z
    .object({
      symbol: z.string().describe("1-4 characters shown on the orange tab"),
      label: z.string().describe("2-3 words naming what the probe measures"),
      min: z.number(),
      max: z.number(),
      step: z.number(),
      unit: z.string().describe("unit label or empty string"),
      format: z.enum(W_PROBE_FORMATS),
    })
    .nullable()
    .describe("An UNGRADED orange scrubber that moves something in the world; null for none");
export const wEnumOrNull = (values: readonly string[], name: string) => (values.length ? z.enum(asTuple(values, name)).nullable() : z.null());

/** Writer output of wProbe(). */
export interface WriterProbe {
  symbol: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  format: (typeof W_PROBE_FORMATS)[number];
}
/** Stored ProbeSpec from a writer probe (clipped to the stored limits; year formats get a window = [min, max]). */
export function probeFromWriter(w: WriterProbe | null | undefined): ProbeSpec | null {
  if (!w) return null;
  const yearish = w.format === "year" || w.format === "month_year";
  const parsed = ProbeSpec.safeParse({
    symbol: w.symbol.slice(0, 8) || "x",
    label: w.label.slice(0, 24) || "probe",
    min: w.min,
    max: w.max,
    step: w.step > 0 ? w.step : 1,
    unit: w.unit.slice(0, 12),
    format: w.format,
    window: yearish ? { start: w.min, end: w.max } : null,
  });
  return parsed.success ? parsed.data : null;
}

/**
 * Content glyphs a writer may put on a plank, item or node: what the step SAYS, never whether it belongs.
 * Prefabs map each id to an icon (a `<ns>.part.<skin>_glyph.<id>` variant key, or a shared icon).
 */
export const GLYPH_LIBRARY = [
  "equation", "scale", "angle", "quadrant", "circle", "wave", "arrow_up", "arrow_down", "clock", "check", "cross",
  "cell", "ion", "water", "salt", "protein", "lipid", "atp", "vesicle", "pump", "channel", "carrier",
  "bus", "school", "court", "march", "law", "vote", "newspaper", "telegram", "microphone", "document", "photo", "gavel",
  "key", "door", "star", "flame", "book", "flag",
] as const;
export type GlyphId = (typeof GLYPH_LIBRARY)[number];

/** Probe-key slots the World Writer fills (their lines live in dialogue.fail.byKey). */
export const PROBE_KEY_SLOTS = ["probe_a", "probe_b", "probe_c"] as const;
