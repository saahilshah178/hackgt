/**
 * src/world/config-validators.ts (V1) — the shared helpers every meta's `validateConfig` uses (docs/design/20 §4.4).
 *
 * Pure. Metas import it at runtime, so it never imports mechanics modes, the registry or src/world/library.ts
 * (src/mechanics/util.ts is allowed). It re-exports the W0 helpers of contraptions/config-parts.ts unchanged (one
 * definition, never a fork) and adds: expression sampling with reasons, whole-token text matching with a stopword
 * list (switchboard's decoy-hint rule), direction words (router_lanes), digit presence (stage_machine), stage-stop
 * coverage, π-labelled views (emitter_rail), date-in-text issues and uniqueness checks.
 */
import { evalExactAt } from "../mechanics/util";
import type { ProbeSpec } from "../contracts/world";
import type { ConfigIssue } from "./types";
import {
  binIdsOf,
  categoryIdsOf,
  clueIndicesOf,
  clueTextOf,
  coverExactlyOnce,
  encounterTexts,
  err,
  exprEvaluatesOver,
  exprSampleRatio,
  exprValue,
  hasErrors,
  hypothesisIdsOf,
  itemKeysOf,
  leftKeysOf,
  nodeKeysOf,
  optionIndicesOf,
  plankKeysOf,
  probeRangeIssues,
  rightKeysOf,
  statementIndicesOf,
  stringsIn,
  subsetOf,
  viewRows,
  viewTextOf,
  warn,
  waveIndicesOf,
  writerItemKeys,
} from "./contraptions/config-parts";
import { dateAppears, dateParts, type DateAppearsOptions } from "./date-parse";

export {
  binIdsOf,
  categoryIdsOf,
  clueIndicesOf,
  clueTextOf,
  coverExactlyOnce,
  encounterTexts,
  err,
  exprEvaluatesOver,
  exprSampleRatio,
  exprValue,
  hasErrors,
  hypothesisIdsOf,
  itemKeysOf,
  leftKeysOf,
  nodeKeysOf,
  optionIndicesOf,
  plankKeysOf,
  probeRangeIssues,
  rightKeysOf,
  statementIndicesOf,
  stringsIn,
  subsetOf,
  viewRows,
  viewTextOf,
  warn,
  waveIndicesOf,
  writerItemKeys,
};

type Path = (string | number)[];

// ---------------------------------------------------------------- expressions

/** `n` evenly spaced samples of `expr` over [x0, x1]: [x, y | null] (null where it does not evaluate to a finite number). */
export function exprSamples(expr: string, x0: number, x1: number, n = 64): [number, number | null][] {
  const out: [number, number | null][] = [];
  if (!(n > 1) || !Number.isFinite(x0) || !Number.isFinite(x1)) return out;
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    out.push([x, evalExactAt(expr, { x })]);
  }
  return out;
}
/** Range [min, max] of the finite samples of `expr` over [x0, x1], or null when none evaluate. */
export function exprRange(expr: string, x0: number, x1: number, n = 64): [number, number] | null {
  const ys = exprSamples(expr, x0, x1, n)
    .map(([, y]) => y)
    .filter((y): y is number => y !== null);
  return ys.length ? [Math.min(...ys), Math.max(...ys)] : null;
}
/** An error when `expr` evaluates at fewer than `minRatio` of 64 samples over [x0, x1] (claim traces: 0.9). */
export function exprIssues(path: Path, expr: string, x0: number, x1: number, minRatio = 0.9, severity: "error" | "warning" = "error"): ConfigIssue[] {
  const r = exprSampleRatio(expr, x0, x1);
  if (r >= minRatio) return [];
  const msg = `"${expr}" evaluates at only ${Math.round(r * 100)} % of samples over [${round3(x0)}, ${round3(x1)}] (needs ${Math.round(minRatio * 100)} %)`;
  return [severity === "error" ? err(path, msg) : warn(path, msg)];
}
/** A constant expression (no free x) that must evaluate: an error otherwise. */
export function constExprIssues(path: Path, expr: string, what = "expression"): ConfigIssue[] {
  return exprValue(expr) === null ? [err(path, `${what} "${expr}" does not evaluate to a number`)] : [];
}
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

// ---------------------------------------------------------------- text tokens

/** Common English function words ignored by `sharedContentTokens` (switchboard's decoy-hint rule, civil O8). */
export const STOPWORDS: ReadonlySet<string> = new Set(
  (
    "a an the and or but nor so yet of to in on at by for from with into onto upon as is are was were be been being it its " +
    "this that these those he she they them his her their we our you your i me my not no do does did done has have had " +
    "which who whom whose what when where why how than then there here also only just very more most such can could " +
    "would should will shall may might must one two over under after before about"
  ).split(" "),
);
/** Lower-case word tokens (letters and digits; apostrophes dropped). */
export function wordTokens(text: string): string[] {
  return (text.normalize("NFKC").toLowerCase().replace(/['’]/g, "").match(/[a-z0-9]+/g) ?? []) as string[];
}
/** Word tokens minus stopwords and 1-letter words. */
export function contentTokens(text: string): string[] {
  return wordTokens(text).filter((t) => t.length > 1 && !STOPWORDS.has(t));
}
/** Distinct content tokens of `needle` that also occur in `hay` (whole tokens). */
export function sharedContentTokens(hay: string, needle: string): string[] {
  const h = new Set(wordTokens(hay));
  return [...new Set(contentTokens(needle))].filter((t) => h.has(t));
}
/** True when `phrase` occurs in `text` as a whole-token sequence (case-insensitive). */
export function containsPhrase(text: string, phrase: string): boolean {
  const t = wordTokens(text);
  const p = wordTokens(phrase);
  if (p.length === 0) return false;
  outer: for (let i = 0; i + p.length <= t.length; i++) {
    for (let j = 0; j < p.length; j++) if (t[i + j] !== p[j]) continue outer;
    return true;
  }
  return false;
}
/**
 * `text` names `target`: its full text as a token sequence, or at least `minShared` of its non-stopword tokens
 * (civil O8: e7's "signed the act" shares `signed`, `act` with "Signed the Civil Rights Act into law").
 */
export function mentions(text: string, target: string, minShared = 2): boolean {
  if (containsPhrase(text, target)) return true;
  const need = Math.min(minShared, new Set(contentTokens(target)).size);
  return need > 0 && sharedContentTokens(text, target).length >= need;
}
/** True when any of `words` appears in `text` as a whole token sequence. */
export function anyWordIn(text: string, words: readonly string[]): boolean {
  return words.some((w) => containsPhrase(text, w));
}
/** True when the integer `n` appears as its own digit run in `text` ("3 ions" has 3; "30" does not). */
export function digitAppears(text: string, n: number): boolean {
  return new RegExp(`(^|[^0-9.])${Math.abs(n)}(?![0-9]|\\.[0-9])`).test(text);
}

// ---------------------------------------------------------------- direction words (router_lanes, §4.4 warnings)

export type Direction = "down" | "up";
const DOWN_WORDS = ["high to low", "high → low", "down its gradient", "down the gradient", "down a gradient", "downhill", "diffuses", "passive", "passively", "without energy", "no energy"];
const UP_WORDS = ["against", "pumped", "pump", "pumps", "uphill", "low to high", "low → high", "active transport", "uses atp", "spends atp"];
/** "down" (with the gradient: from > to), "up" (against it: from < to) or null when the text says neither or both. */
export function directionOf(text: string): Direction | null {
  const lower = text.toLowerCase();
  const has = (w: string) => (/[→]/.test(w) ? lower.includes(w) : containsPhrase(lower, w));
  const down = DOWN_WORDS.some(has);
  const up = UP_WORDS.some(has);
  return down === up ? null : down ? "down" : "up";
}
/** A warning when numeric `from`/`to` levels disagree with the text's direction words. */
export function directionIssues(path: Path, text: string, from: number | null, to: number | null): ConfigIssue[] {
  if (from === null || to === null || from === to) return [];
  const dir = directionOf(text);
  if (dir === "down" && !(from > to)) return [warn(path, `the text says the cargo moves down its gradient, but from (${from}) ≤ to (${to})`)];
  if (dir === "up" && !(from < to)) return [warn(path, `the text says the cargo moves against its gradient, but from (${from}) ≥ to (${to})`)];
  return [];
}

// ---------------------------------------------------------------- probes, stages, views

/** stage_machine: a `stage`-format probe whose integer stops cover min…max. */
export function stageStopsIssues(path: Path, probe: ProbeSpec | null): ConfigIssue[] {
  if (!probe) return [err(path, "a stage probe is required")];
  const out: ConfigIssue[] = [];
  if (probe.format !== "stage") out.push(err([...path, "format"], `stage probes use format "stage", not "${probe.format}"`));
  if (!Number.isInteger(probe.min) || !Number.isInteger(probe.max)) out.push(err(path, "stage probe min and max must be integers"));
  const have = new Set(probe.stops.map((s) => s.v));
  for (let v = Math.ceil(probe.min); v <= Math.floor(probe.max); v++) if (!have.has(v)) out.push(err([...path, "stops"], `stage ${v} has no stop`));
  for (const s of probe.stops) if (!Number.isInteger(s.v)) out.push(err([...path, "stops"], `stop ${s.v} is not an integer stage`));
  return out;
}
/** Year-format probes (history) with a window. */
export function isYearProbe(probe: ProbeSpec | null): probe is ProbeSpec {
  return !!probe && (probe.format === "year" || probe.format === "month_year");
}
export function yearProbeIssues(path: Path, probe: ProbeSpec | null, what: string): ConfigIssue[] {
  if (!isYearProbe(probe)) return [err(path, `${what} requires a year probe (format year or month_year)`)];
  if (!probe.window) return [err([...path, "window"], `${what} requires a probe window`)];
  return [];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
/** emitter_rail: a number-line view labelled in π whose span is 2π (arc rails). */
export function isPiLabelled2Pi(view: unknown): boolean {
  if (!isObj(view)) return false;
  const min = Number(view.min);
  const max = Number(view.max);
  const marks = Array.isArray(view.landmarks) ? view.landmarks.filter(isObj) : [];
  const piLabels = marks.some((m) => typeof m.label === "string" && /π/.test(m.label));
  return piLabels && Math.abs(max - min - 2 * Math.PI) < 1e-6;
}

// ---------------------------------------------------------------- dates and uniqueness

/** An error unless `date` appears in `texts` by the §4.4 rule (year; month name for month precision; day for day). */
export function dateInTextsIssues(path: Path, date: string | null, texts: readonly string[], what: string, opts: DateAppearsOptions = {}): ConfigIssue[] {
  if (date === null) return [];
  if (!dateParts(date)) return [err(path, `${what} "${date}" is not YYYY, YYYY-MM or YYYY-MM-DD`)];
  return dateAppears(texts, date, opts) ? [] : [err(path, `${what} ${date} does not appear in its text`)];
}
/** Errors for repeated keys. */
export function uniqueIssues(path: Path, what: string, keys: readonly (string | number)[]): ConfigIssue[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const k of keys.map(String)) (seen.has(k) ? dup : seen).add(k);
  return [...dup].map((k) => err(path, `${what} "${k}" appears more than once`));
}
/** Every value in `got` lies within [lo, hi] (brackets inside the card range). */
export function inRangeIssues(path: Path, what: string, got: readonly (number | null)[], lo: number, hi: number): ConfigIssue[] {
  return got
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v === null || v < lo - 1e-9 || v > hi + 1e-9)
    .map(({ v, i }) => err([...path, i], `${what} ${v === null ? "does not evaluate" : `${round3(v)} lies outside [${round3(lo)}, ${round3(hi)}]`}`));
}
/** All-or-none: either every entry is set or none is (claim_holders footprints). */
export function allOrNoneIssues(path: Path, what: string, set: readonly boolean[]): ConfigIssue[] {
  const n = set.filter(Boolean).length;
  return n === 0 || n === set.length ? [] : [err(path, `${what}: give every entry one, or none (${n} of ${set.length} set)`)];
}
