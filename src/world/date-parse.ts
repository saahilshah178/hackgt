/**
 * src/world/date-parse.ts (V1) — dates in authored and encounter texts (docs/design/20 §4.4 date rule, §1.5 R13).
 *
 * Pure. Metas' validateConfig/defaultConfig import it, so it never imports mechanics modes, the registry or
 * src/world/library.ts. It re-exports the W0 helpers of contraptions/config-parts.ts unchanged (one definition) and
 * adds `parseDates` (ranges, decades, "late 1955"-style qualifiers, ISO forms) and `dateAppears`.
 */
import {
  MONTH_NAMES,
  dateAppearsIn,
  dateParts,
  datePrecision,
  findDates,
  findYears,
  fracYearOf,
  yearAppearsIn,
  type DateParts,
} from "./contraptions/config-parts";

export { MONTH_NAMES, dateAppearsIn, dateParts, datePrecision, findDates, findYears, fracYearOf, yearAppearsIn };
export type { DateParts };

export type DatePrecision = "day" | "month" | "year";
/** A date a text states. `start`/`end` are fractional years (end exclusive: "1955" spans [1955, 1956)). */
export interface ParsedDate {
  /** "YYYY", "YYYY-MM" or "YYYY-MM-DD" (the start of a range) */
  date: string;
  precision: DatePrecision;
  /** the end of a stated range ("1955–1956", "from May 1961 to 1962"), else null */
  to: string | null;
  /** fuzzy qualifier: "late 1955", "the 1950s", "spring of 1963", "c. 1900" */
  approx: boolean;
  start: number;
  end: number;
  /** character offset and the matched text */
  index: number;
  match: string;
}

const MONTH_ALT = MONTH_NAMES.map((n) => `${n}|${n.slice(0, 3)}\\.?`).join("|");
const YEAR = "(1\\d{3}|20\\d{2})";
const pad = (n: number) => String(n).padStart(2, "0");

export function monthIndexOf(word: string): number {
  const w = word.toLowerCase().replace(".", "");
  if (w.length < 3) return 0;
  return MONTH_NAMES.findIndex((n) => n.startsWith(w)) + 1; // "sep", "sept", "september"
}

function span(date: string): [number, number] {
  const p = dateParts(date);
  if (!p) return [NaN, NaN];
  if (p.day !== null && p.month !== null) {
    const s = p.year + (p.month - 1) / 12 + (p.day - 1) / 365.25;
    return [s, s + 1 / 365.25];
  }
  if (p.month !== null) {
    const s = p.year + (p.month - 1) / 12;
    return [s, s + 1 / 12];
  }
  return [p.year, p.year + 1];
}

function mk(date: string, index: number, match: string, extra: Partial<ParsedDate> = {}): ParsedDate {
  const [start, end] = span(date);
  const to = extra.to ?? null;
  return {
    date,
    precision: (datePrecision(date) ?? "year") as DatePrecision,
    to,
    approx: false,
    start,
    end: to ? span(to)[1] : end,
    index,
    match,
    ...extra,
  };
}

function validDay(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= days[m - 1];
}

/**
 * Every date a text states, in order of appearance, most precise reading per mention:
 * - "December 1, 1955", "Dec. 1st 1955", "1 December 1955", "1955-12-01" → day precision
 * - "March 1965", "March of 1965", "1965-03" → month precision
 * - "1957", "c. 1900" → year precision (c./circa marks it approx)
 * - "1955–1956", "1955-56", "1955 to 1957", "from 1954 until 1957", "between 1954 and 1957" → a range (`to`)
 * - "late 1955", "early 1960", "mid-1963", "spring of 1963" → year precision, approx, narrowed span
 * - "the 1950s", "1950s", "mid-1950s" → the decade, approx
 */
export function parseDates(text: string): ParsedDate[] {
  const out: ParsedDate[] = [];
  const covered: [number, number][] = [];
  const free = (a: number, b: number) => !covered.some(([x, y]) => a < y && b > x);
  const take = (a: number, b: number) => covered.push([a, b]);
  const run = (re: RegExp, fn: (m: RegExpMatchArray, at: number) => ParsedDate | null) => {
    for (const m of text.matchAll(re)) {
      const at = m.index ?? 0;
      const lead = m[0].length - m[0].trimStart().length;
      const a = at + lead;
      const b = at + m[0].length;
      if (!free(a, b)) continue;
      const d = fn(m, a);
      if (d) {
        out.push({ ...d, index: a, match: m[0].trim() });
        take(a, b);
      }
    }
  };
  // ISO forms first (unambiguous)
  run(new RegExp(`(?<![0-9-])${YEAR}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\\d|3[01]))?(?![0-9])`, "g"), (m, at) => {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (m[3]) return validDay(y, mo, Number(m[3])) ? mk(`${m[1]}-${m[2]}-${m[3]}`, at, m[0]) : null;
    return mk(`${m[1]}-${m[2]}`, at, m[0]);
  });
  // Month D, YYYY
  run(new RegExp(`\\b(${MONTH_ALT})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+${YEAR}\\b`, "gi"), (m, at) => {
    const mo = monthIndexOf(m[1]);
    const d = Number(m[2]);
    const y = Number(m[3]);
    return mo > 0 && validDay(y, mo, d) ? mk(`${m[3]}-${pad(mo)}-${pad(d)}`, at, m[0]) : null;
  });
  // D Month YYYY
  run(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_ALT})\\s*,?\\s+${YEAR}\\b`, "gi"), (m, at) => {
    const mo = monthIndexOf(m[2]);
    const d = Number(m[1]);
    const y = Number(m[3]);
    return mo > 0 && validDay(y, mo, d) ? mk(`${m[3]}-${pad(mo)}-${pad(d)}`, at, m[0]) : null;
  });
  // Month (of) YYYY
  run(new RegExp(`\\b(${MONTH_ALT})\\s+(?:of\\s+)?${YEAR}\\b`, "gi"), (m, at) => {
    const mo = monthIndexOf(m[1]);
    return mo > 0 ? mk(`${m[2]}-${pad(mo)}`, at, m[0]) : null;
  });
  // decades: "the 1950s", "mid-1950s", "early 1960s"
  run(new RegExp(`\\b(?:(early|mid|late)[-\\s]+)?(1\\d{2}0|20\\d0)'?s\\b`, "gi"), (m, at) => {
    const y = Number(m[2]);
    const q = (m[1] ?? "").toLowerCase();
    const [s, e] = q === "early" ? [y, y + 4] : q === "mid" ? [y + 3, y + 7] : q === "late" ? [y + 6, y + 10] : [y, y + 10];
    return mk(String(y), at, m[0], { approx: true, start: s, end: e });
  });
  // qualified years: "late 1955", "mid-1963", "spring of 1963", "c. 1900", "circa 1900"
  const SEASONS: Record<string, [number, number]> = {
    early: [0, 1 / 3], mid: [1 / 3, 2 / 3], middle: [1 / 3, 2 / 3], late: [2 / 3, 1],
    spring: [2 / 12, 5 / 12], summer: [5 / 12, 8 / 12], fall: [8 / 12, 11 / 12], autumn: [8 / 12, 11 / 12], winter: [11 / 12, 14 / 12],
    "c.": [0, 1], circa: [0, 1], around: [0, 1], about: [0, 1],
  };
  run(new RegExp(`\\b(early|mid|middle|late|spring|summer|fall|autumn|winter|circa|around|about|c\\.)(?:[-\\s]+(?:of\\s+)?)${YEAR}(?![0-9])`, "gi"), (m, at) => {
    const q = SEASONS[m[1].toLowerCase()] ?? [0, 1];
    const y = Number(m[2]);
    return mk(m[2], at, m[0], { approx: true, start: y + q[0], end: y + q[1] });
  });
  // "c.1900" without a space
  run(new RegExp(`\\bc\\.${YEAR}(?![0-9])`, "gi"), (m, at) => mk(m[1], at, m[0], { approx: true }));
  // ranges: "1955–1956", "1955-56", "1955 to 1957", "from 1954 until 1957", "between 1954 and 1957"
  run(new RegExp(`(?<![0-9])(?:between\\s+)?${YEAR}\\s*(?:[–—-]|to|until|through|(?<=between\\s+\\d{4}\\s*)and)\\s*(\\d{2}|1\\d{3}|20\\d{2})(?![0-9])`, "gi"), (m, at) => {
    const y0 = Number(m[1]);
    let y1 = Number(m[2]);
    if (m[2].length === 2) y1 = Math.floor(y0 / 100) * 100 + y1;
    if (!(y1 > y0) || y1 - y0 > 200) return null;
    return mk(m[1], at, m[0], { to: String(y1) });
  });
  // bare years
  run(new RegExp(`(?<![0-9])${YEAR}(?![0-9])`, "g"), (m, at) => mk(m[1], at, m[0]));

  // a range whose ends were parsed separately: "from May 1961 to August 1961"
  out.sort((a, b) => a.index - b.index);
  const merged: ParsedDate[] = [];
  for (const d of out) {
    const prev = merged[merged.length - 1];
    if (prev && prev.to === null && !prev.approx && !d.approx && d.to === null) {
      const gap = text.slice(prev.index + prev.match.length, d.index);
      if (/^\s*(?:[–—-]|to|until|through)\s*$/i.test(gap) && d.start > prev.start) {
        merged[merged.length - 1] = { ...prev, to: d.date, end: d.end, match: text.slice(prev.index, d.index + d.match.length) };
        continue;
      }
    }
    merged.push(d);
  }
  return merged;
}

/** The first stated date's string ("1955-12-01"), or null (defaultConfig: printedDate from an item's text). */
export function firstDate(text: string): string | null {
  const d = parseDates(text).find((x) => !x.approx);
  return d ? d.date : null;
}
/** Fractional-year span [start, end) of every date stated across texts. */
export function dateSpanOf(texts: readonly string[]): { start: number; end: number } | null {
  const all = texts.flatMap(parseDates);
  if (all.length === 0) return null;
  return { start: Math.min(...all.map((d) => d.start)), end: Math.max(...all.map((d) => d.end)) };
}

export interface DateAppearsOptions {
  /** accept the year ± slack (claim_holders footprints: "within the year" ⇒ 1) */
  slackYears?: number;
  /** also accept a stated range or qualified year that contains the date */
  ranges?: boolean;
}
/**
 * The §4.4 date rule on a set of texts: the year's digits appear in one text; month precision also needs that month
 * (name, abbreviation or ISO) in the SAME text; day precision also needs the day there. `slackYears` relaxes a
 * year-precision date to year ± slack; `ranges` also accepts a date inside a range the text states.
 */
export function dateAppears(texts: readonly string[], date: string, opts: DateAppearsOptions = {}): boolean {
  const p = dateParts(date);
  if (!p) return false;
  if (dateAppearsIn(texts, date)) return true;
  // ISO forms in the text ("1955-12-01")
  const parsed = texts.map(parseDates);
  if (parsed.some((ds) => ds.some((d) => d.date === date || (d.date.startsWith(`${date}-`) && d.precision !== "year")))) return true;
  const slack = opts.slackYears ?? 0;
  if (slack > 0 && p.month === null && yearAppearsIn(texts, p.year, slack)) return true;
  if (opts.ranges) {
    const [s] = span(date);
    if (parsed.some((ds) => ds.some((d) => (d.to !== null || d.approx) && s >= d.start - 1e-9 && s < d.end))) return true;
  }
  return false;
}

/** −1 / 0 / 1 by start (fractional years); invalid dates sort last. */
export function compareDates(a: string, b: string): number {
  const fa = fracYearOf(a);
  const fb = fracYearOf(b);
  if (fa === null) return fb === null ? 0 : 1;
  if (fb === null) return -1;
  return fa < fb ? -1 : fa > fb ? 1 : 0;
}
