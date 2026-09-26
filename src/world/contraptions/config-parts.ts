/**
 * src/world/contraptions/config-parts.ts (W0, main) — shared config primitives (docs/design/20 §4.2) plus the small
 * validator helpers every meta's validateConfig needs (§4.4). Pure; no Phaser, no React, no mechanics modes.
 *
 * V1's src/world/{config-validators,date-parse}.ts may re-export and extend the helpers below; they must not fork them.
 */
import { z } from "zod";
import { Id } from "../../contracts/common";
import { DateString, ProbeSpec } from "../../contracts/world";
import { evalExact, evalExactAt } from "../../mechanics/util";
import type { ConfigIssue } from "../types";

// ---------------------------------------------------------------- §4.2 primitives

export const Tier = z.union([z.literal(0), z.literal(1), z.literal(2)]); // the aid tier that unlocks a card or overlay
export type Tier = z.infer<typeof Tier>;
export const Expr = z.string().min(1).max(80); // exact mathjs expression; `x` is the only free symbol
export type Expr = z.infer<typeof Expr>;
export const ItemKey = z.string().regex(/^[a-z]\d{1,2}$/); // i0, s2, d0, l1, r3, x0, n4
export type ItemKey = z.infer<typeof ItemKey>;
export const ClaimTrace = z.strictObject({
  fns: z
    .array(
      z.strictObject({
        expr: Expr,
        style: z.enum(["solid", "dashed", "ghost"]).default("solid"),
        color: z.enum(["f", "g", "h"]).default("g"),
      }),
    )
    .min(1)
    .max(3),
  brackets: z.array(z.strictObject({ x0: Expr, y0: Expr, x1: Expr, y1: Expr, label: z.string().min(1).max(24) })).max(3).default([]),
  markers: z.array(z.strictObject({ x: Expr, y: Expr, kind: z.enum(["period", "peak", "cross"]) })).max(8).default([]),
});
export type ClaimTrace = z.infer<typeof ClaimTrace>;
export const Footprint = z.strictObject({
  // a claim drawn on the FILE card (history)
  kind: z.enum(["pin", "band", "arrow"]),
  from: DateString,
  to: DateString.nullable().default(null),
  label: z.string().min(1).max(32),
});
export type Footprint = z.infer<typeof Footprint>;
export const ItemMeta = z.strictObject({
  printedDate: DateString.nullable().default(null), // must appear in the item's own text
  madeYear: z.number().int().min(1000).max(2100).nullable().default(null), // must appear in the item's own text
  glyph: Id.nullable().default(null), // content glyph (what the step SAYS, never whether it belongs)
  label: z.string().min(1).max(24).nullable().default(null), // short world-chip name
});
export type ItemMeta = z.infer<typeof ItemMeta>;
export const HintPin = z.strictObject({ rung: z.union([z.literal(1), z.literal(2), z.literal(3)]), date: DateString, label: z.string().min(1).max(32) });
export type HintPin = z.infer<typeof HintPin>;
export const FileDate = z.strictObject({ date: DateString, label: z.string().min(1).max(40) });
export type FileDate = z.infer<typeof FileDate>;
export { ProbeSpec };

// ---------------------------------------------------------------- issues

export function err(path: (string | number)[], message: string): ConfigIssue {
  return { path, message, severity: "error" };
}
export function warn(path: (string | number)[], message: string): ConfigIssue {
  return { path, message, severity: "warning" };
}
export function hasErrors(issues: readonly ConfigIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}

/** Every expected key exactly once in `got` (keyed configs, §4.2: "validateConfig requires every key exactly once"). */
export function coverExactlyOnce(
  path: (string | number)[],
  what: string,
  expected: readonly (string | number)[],
  got: readonly (string | number)[],
): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  const want = new Set(expected.map(String));
  const seen = new Map<string, number>();
  for (const g of got.map(String)) seen.set(g, (seen.get(g) ?? 0) + 1);
  for (const k of want) {
    const n = seen.get(k) ?? 0;
    if (n === 0) out.push(err(path, `${what} "${k}" is missing`));
    else if (n > 1) out.push(err(path, `${what} "${k}" appears ${n} times`));
  }
  for (const k of seen.keys()) if (!want.has(k)) out.push(err(path, `${what} "${k}" does not exist in this encounter`));
  return out;
}

/** Every key in `got` exists in `allowed` (subsets are fine). */
export function subsetOf(path: (string | number)[], what: string, allowed: readonly (string | number)[], got: readonly (string | number)[]): ConfigIssue[] {
  const ok = new Set(allowed.map(String));
  return got.map(String).filter((k) => !ok.has(k)).map((k) => err(path, `${what} "${k}" does not exist in this encounter`));
}

export function probeRangeIssues(path: (string | number)[], probe: ProbeSpec | null): ConfigIssue[] {
  if (!probe) return [];
  const out: ConfigIssue[] = [];
  if (!(probe.min < probe.max)) out.push(err([...path, "min"], `probe min (${probe.min}) must be below max (${probe.max})`));
  if (probe.initial !== null && (probe.initial < probe.min || probe.initial > probe.max)) out.push(err([...path, "initial"], "probe initial value is outside [min, max]"));
  if (probe.window && !(probe.window.start < probe.window.end)) out.push(err([...path, "window"], "probe window start must be before its end"));
  return out;
}

// ---------------------------------------------------------------- expressions (evalExactAt, §4.4)

export function exprValue(expr: string): number | null {
  return evalExact(expr);
}
/** Fraction of n evenly spaced samples over [x0, x1] where `expr` (free symbol x) is a finite number. */
export function exprSampleRatio(expr: string, x0: number, x1: number, n = 64): number {
  if (!(n > 1) || !Number.isFinite(x0) || !Number.isFinite(x1)) return 0;
  let ok = 0;
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    if (evalExactAt(expr, { x }) !== null) ok++;
  }
  return ok / n;
}
/** True when `expr` evaluates at ≥ `minRatio` of 64 samples over [x0, x1] (claim traces: 90 %). */
export function exprEvaluatesOver(expr: string, x0: number, x1: number, minRatio = 0.9): boolean {
  return exprSampleRatio(expr, x0, x1) >= minRatio;
}

// ---------------------------------------------------------------- dates in texts (§4.4 date rule)

export const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
] as const;

export interface DateParts {
  year: number;
  month: number | null; // 1-12
  day: number | null;
}
export function dateParts(date: string): DateParts | null {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(date);
  if (!m) return null;
  return { year: Number(m[1]), month: m[2] ? Number(m[2]) : null, day: m[3] ? Number(m[3]) : null };
}
export function datePrecision(date: string): "year" | "month" | "day" | null {
  const p = dateParts(date);
  if (!p) return null;
  return p.day !== null ? "day" : p.month !== null ? "month" : "year";
}
/** Fractional year: "1965-03" → 1965.167, "1955-12-01" → 1955.917 (day-of-month ignored below month precision). */
export function fracYearOf(date: string): number | null {
  const p = dateParts(date);
  if (!p) return null;
  return p.year + (p.month ? (p.month - 1) / 12 : 0) + (p.day ? (p.day - 1) / 365.25 : 0);
}

function monthMentioned(text: string, month: number): boolean {
  const name = MONTH_NAMES[month - 1];
  const lower = text.toLowerCase();
  return new RegExp(`\\b(${name}|${name.slice(0, 3)}\\.?)\\b`).test(lower);
}
function yearMentioned(text: string, year: number): boolean {
  return new RegExp(`(^|[^0-9])${year}([^0-9]|$)`).test(text);
}
function dayMentioned(text: string, day: number): boolean {
  return new RegExp(`(^|[^0-9])0?${day}(st|nd|rd|th)?([^0-9]|$)`).test(text);
}

/**
 * The §4.4 date rule: the year's digits appear in one text; month precision also needs that month's name (or its
 * 3-letter abbreviation) in the SAME text; day precision also needs the day number there.
 */
export function dateAppearsIn(texts: readonly string[], date: string): boolean {
  const p = dateParts(date);
  if (!p) return false;
  return texts.some(
    (t) => yearMentioned(t, p.year) && (p.month === null || monthMentioned(t, p.month)) && (p.day === null || dayMentioned(t, p.day)),
  );
}
/** The year (±slack, for "within the year" footprints) appears in some text. */
export function yearAppearsIn(texts: readonly string[], year: number, slack = 0): boolean {
  for (let y = year - slack; y <= year + slack; y++) if (texts.some((t) => yearMentioned(t, y))) return true;
  return false;
}
/** Four-digit years 1000–2099 mentioned in a text, in order of appearance, de-duplicated. */
export function findYears(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(?<![0-9])(1\d{3}|20\d{2})(?![0-9])/g)) {
    const y = Number(m[1]);
    if (!out.includes(y)) out.push(y);
  }
  return out;
}
/**
 * Dates a text states, most precise form first per mention: "December 1, 1955" → "1955-12-01", "March 1965" →
 * "1965-03", a bare "1957" → "1957". Used by defaultConfig (autoWorld); V1's date-parse.ts supersedes it with
 * ranges and "late 1955"-style phrases.
 */
export function findDates(text: string): string[] {
  const out: string[] = [];
  const covered: [number, number][] = [];
  const monthAlt = MONTH_NAMES.map((n) => `${n}|${n.slice(0, 3)}\\.?`).join("|");
  const full = new RegExp(`\\b(${monthAlt})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(1\\d{3}|20\\d{2})\\b`, "gi");
  const monthYear = new RegExp(`\\b(${monthAlt})\\s+(1\\d{3}|20\\d{2})\\b`, "gi");
  const monthIndex = (s: string) => MONTH_NAMES.findIndex((n) => n.startsWith(s.toLowerCase().replace(".", "").slice(0, 3))) + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  for (const m of text.matchAll(full)) {
    const mo = monthIndex(m[1]);
    const d = Number(m[2]);
    if (mo > 0 && d >= 1 && d <= 31) {
      out.push(`${m[3]}-${pad(mo)}-${pad(d)}`);
      covered.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
    }
  }
  for (const m of text.matchAll(monthYear)) {
    const at = m.index ?? 0;
    if (covered.some(([a, b]) => at >= a && at < b)) continue;
    const mo = monthIndex(m[1]);
    if (mo > 0) {
      out.push(`${m[2]}-${pad(mo)}`);
      covered.push([at, at + m[0].length]);
    }
  }
  for (const m of text.matchAll(/(?<![0-9])(1\d{3}|20\d{2})(?![0-9])/g)) {
    const at = m.index ?? 0;
    if (covered.some(([a, b]) => at >= a && at < b)) continue;
    out.push(m[1]);
  }
  return [...new Set(out)];
}

/** A year probe (history stations) whose window spans the given years ± 1. */
export function yearProbeFor(years: readonly number[], symbol = "YEAR"): ProbeSpec | null {
  if (years.length === 0) return null;
  const lo = Math.min(...years) - 1;
  const hi = Math.max(...years) + 1;
  return ProbeSpec.parse({ symbol, label: "record year", min: lo, max: hi, step: 1 / 12, format: "month_year", window: { start: lo, end: hi } });
}

// ---------------------------------------------------------------- view readers (never params or solutions)

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function rows(v: unknown, field: string): Record<string, unknown>[] {
  if (!isObj(v)) return [];
  const a = v[field];
  return Array.isArray(a) ? a.filter(isObj) : [];
}
/** Keyed rows of a view list: `{key, text}` by default, or any other key/text field names. */
export function viewRows(view: unknown, field: string, keyField = "key", textField = "text"): { key: string; text: string }[] {
  return rows(view, field).map((r) => ({ key: String(r[keyField]), text: typeof r[textField] === "string" ? (r[textField] as string) : "" }));
}
export const statementIndicesOf = (view: unknown) => rows(view, "chests").map((r) => Number(r.statementIndex));
export const optionIndicesOf = (view: unknown) => rows(view, "options").map((r) => Number(r.optionIndex));
export const plankKeysOf = (view: unknown) => rows(view, "planks").map((r) => String(r.key));
export const itemKeysOf = (view: unknown) => rows(view, "items").map((r) => String(r.key));
export const binIdsOf = (view: unknown) => rows(view, "bins").map((r) => String(r.id));
export const waveIndicesOf = (view: unknown) => rows(view, "waves").map((r) => Number(r.waveIndex));
export const categoryIdsOf = (view: unknown) => rows(view, "categories").map((r) => String(r.id));
export const leftKeysOf = (view: unknown) => rows(view, "lefts").map((r) => String(r.key));
export const rightKeysOf = (view: unknown) => rows(view, "rights").map((r) => String(r.key));
export const nodeKeysOf = (view: unknown) => rows(view, "nodes").map((r) => String(r.key));
export const hypothesisIdsOf = (view: unknown) => rows(view, "hypotheses").map((r) => String(r.id));
export const clueIndicesOf = (view: unknown) => rows(view, "clues").map((r) => Number(r.index));
/** The display text for a keyed row in any of the showcase views ("" when absent). */
export function viewTextOf(view: unknown, key: string): string {
  for (const f of ["planks", "items", "lefts", "rights", "nodes"]) {
    const hit = rows(view, f).find((r) => String(r.key) === key);
    if (hit && typeof hit.text === "string") return hit.text;
  }
  const w = /^w(\d+)$/.exec(key);
  if (w) {
    const hit = rows(view, "waves").find((r) => Number(r.waveIndex) === Number(w[1]));
    if (hit && typeof hit.text === "string") return hit.text;
  }
  const h = rows(view, "hypotheses").find((r) => String(r.id) === key);
  if (h && typeof h.text === "string") return h.text;
  return "";
}
export function clueTextOf(view: unknown, index: number): string {
  const hit = rows(view, "clues").find((r) => Number(r.index) === index);
  return hit && typeof hit.text === "string" ? hit.text : "";
}

/**
 * The item keys a writer schema enumerates and probes reference, per mode (WriterCtx.itemKeys): mimic → statement
 * indices, predict_reveal → option indices, linear → plank keys, bins → item keys, type_match → "w<i>",
 * pairs → left then right keys, chain → node keys, elimination → hypothesis ids. Scalar modes → [].
 */
export function writerItemKeys(modeKey: string, view: unknown): string[] {
  switch (modeKey) {
    case "truth_finder.mimic":
      return statementIndicesOf(view).map(String);
    case "truth_finder.predict_reveal":
      return optionIndicesOf(view).map(String);
    case "sequencer.linear":
      return plankKeysOf(view);
    case "sorter.bins":
      return itemKeysOf(view);
    case "sorter.type_match":
      return waveIndicesOf(view).map((i) => `w${i}`);
    case "linker.pairs":
      return [...leftKeysOf(view), ...rightKeysOf(view)];
    case "linker.chain":
      return nodeKeysOf(view);
    case "investigator.elimination":
      return hypothesisIdsOf(view);
    default:
      return [];
  }
}

/** Every string inside a value (params walk for ConfigCtx.texts). */
export function stringsIn(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) stringsIn(x, out);
  else if (isObj(v)) for (const x of Object.values(v)) stringsIn(x, out);
  return out;
}
/** ConfigCtx.texts for an encounter: every string in params + prompt + hints + sourceRef.quote. */
export function encounterTexts(e: { params: unknown; prompt: string; hints: readonly string[]; sourceRef: { quote: string } | null }): string[] {
  return [...stringsIn(e.params), e.prompt, ...e.hints, ...(e.sourceRef ? [e.sourceRef.quote] : [])];
}
