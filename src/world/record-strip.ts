/**
 * src/world/record-strip.ts — the history timeline cards (docs/design/20 §2.5.2 A6; civil §5.0.2). Pure; KC1.
 *
 *   recordCard()      the panel-owned RECORD card: earned pins of solved encounters (spanTo → a band) + the meta's
 *                     recordPins; from/to = the open station's probe window, else the pins' span ± 1 year.
 *   recordChip()      the RECORD value chip: the nearest earned pin within ±2 months of the cursor, else "—".
 *   withEarnedPins()  adds the earned pins to a meta-owned timeline (the tumbler vault's mini strip, vault layout).
 *   FILE helpers      what a history meta draws on its own FILE card: claim footprints (pin / band / arrow, with an
 *                     axis break for dates outside the window), fileDates, and hint pins → PanelStatic.recordPins.
 *   lensU/lensTarget  the record_lens carriage: u = clamp((probe − start)/(end − start)), then the point at that
 *                     arc-length fraction along a (possibly bent) rail.
 *
 * Fractional years follow the §1.3 convention: month m of year Y = Y + (m − 1)/12 (1965.1667 = March 1965).
 * Nothing here reads params or solutions; the RECORD pins come from the world file, which R13 checks.
 */
import type { Point } from "../contracts/world";
import { datePrecision, fracYearOf, MONTH_NAMES, type FileDate, type Footprint, type HintPin } from "./contraptions/config-parts";
import { pointAlong, type Vec2 } from "./geom";
import type { AidTier, CardModel, FnColor, HintsUsed, PanelContext, PanelStatic } from "./types";

export type TimelineCard = Extract<CardModel, { kind: "timeline" }>;
export type TimelinePin = TimelineCard["pins"][number];
export type TimelineBand = TimelineCard["bands"][number];
export type TimelineArrow = TimelineCard["arrows"][number];
export type RecordPin = PanelStatic["recordPins"][number];
export interface YearWindow {
  start: number;
  end: number;
}

/** ±2 months: the RECORD / FILE chip radius (civil §5.0.2). */
export const CHIP_RADIUS_YEARS = 2 / 12;
/** Default RECORD span when there is neither a probe window nor a pin. */
export const DEFAULT_RECORD_WINDOW: YearWindow = { start: 1950, end: 1970 };
const EPS = 1e-6;

// ---------------------------------------------------------------- formatting

const MON = MONTH_NAMES.map((m) => m.slice(0, 3).toUpperCase());

/** A fractional year → "MAR 1965" (the month the value falls in; 1965.1667 → MAR 1965). */
export function formatMonthYear(frac: number): string {
  const m = Math.floor(frac * 12 + EPS);
  const year = Math.floor(m / 12);
  return `${MON[m - year * 12]} ${year}`;
}
/** A fractional year → "March 1965" (aria-valuetext, SR text). */
export function formatMonthYearLong(frac: number): string {
  const m = Math.floor(frac * 12 + EPS);
  const year = Math.floor(m / 12);
  const name = MONTH_NAMES[m - year * 12];
  return `${name[0].toUpperCase()}${name.slice(1)} ${year}`;
}
/** A DateString at its own precision: "1954" → "1954", "1955-12" → "DEC 1955", "1957-09-25" → "SEP 25 1957". */
export function formatDateSlug(date: string): string {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(date);
  if (!m) return date;
  if (!m[2]) return m[1];
  const mon = MON[Number(m[2]) - 1];
  return m[3] ? `${mon} ${Number(m[3])} ${m[1]}` : `${mon} ${m[1]}`;
}
/** The chip text for a pin: "SEP 1957 · LITTLE ROCK NINE ESCORTED" (year-only dates print the year). */
export function chipText(date: string, label: string): string {
  const p = datePrecision(date);
  const at = fracYearOf(date);
  const when = p === "year" || at === null ? date.slice(0, 4) : formatMonthYear(at);
  return `${when} · ${label.toUpperCase()}`;
}

// ---------------------------------------------------------------- RECORD (panel-owned, display slot 0)

interface EarnedEntry {
  encounterId: string;
  date: string;
  pin: TimelinePin;
}

function earnedEntries(ctx: PanelContext): EarnedEntry[] {
  const strip = ctx.recordStrip;
  if (!strip) return [];
  const solved = new Set(ctx.solvedIds);
  const out: EarnedEntry[] = [];
  const used = new Set<string>();
  for (const { encounterId, pin } of strip.pins) {
    if (!solved.has(encounterId)) continue;
    const at = fracYearOf(pin.date);
    if (at === null) continue;
    const spanTo = pin.spanTo ? fracYearOf(pin.spanTo) : null;
    let key = `rec:${encounterId}:${pin.date}`;
    for (let n = 2; used.has(key); n++) key = `rec:${encounterId}:${pin.date}:${n}`;
    used.add(key);
    out.push({ encounterId, date: pin.date, pin: { key, at, label: pin.label, lane: pin.lane, style: "earned", spanTo } });
  }
  return out;
}

/** Earned pins (style "earned") of every solved encounter, in record order. */
export function earnedPins(ctx: PanelContext): TimelinePin[] {
  return earnedEntries(ctx).map((e) => e.pin);
}
/** One band per earned pin with a spanTo (the 381-day boycott). */
export function bandsFor(pins: readonly TimelinePin[], color: FnColor = "f"): TimelineBand[] {
  return pins.filter((p) => p.spanTo !== null).map((p) => ({ from: Math.min(p.at, p.spanTo!), to: Math.max(p.at, p.spanTo!), label: p.label, color }));
}

/**
 * The RECORD card. `cursor` is the live probe (the panel draws the orange line; here it only feeds the SR text).
 * Meta slots stay meta-relative: RECORD is display slot 0 and carries slot 0 by convention.
 */
export function recordCard(ctx: PanelContext, recordPins: PanelStatic["recordPins"], cursor: number | null): TimelineCard {
  const earned = earnedPins(ctx);
  const extra: TimelinePin[] = recordPins.map((p) => ({ key: p.key, at: p.at, label: p.label, lane: null, style: p.style, spanTo: null }));
  const pins = [...earned, ...extra];
  const { start: from, end: to } = ctx.probeWindow ?? spanWindow(pins);
  const n = earned.length;
  const chip = recordChip(ctx, cursor);
  const hints = extra.filter((p) => p.style === "hint").length;
  const sr =
    `The record, ${fmtBound(from)} to ${fmtBound(to)}: ${n === 0 ? "no" : n} restored ${n === 1 ? "entry" : "entries"}` +
    (hints ? `, ${hints} hint ${hints === 1 ? "pin" : "pins"}` : "") +
    (cursor === null ? "" : `; cursor at ${formatMonthYearLong(cursor)}${chip.key ? `, near ${chip.text}` : ""}`) +
    ".";
  return {
    kind: "timeline",
    slot: 0,
    title: "RECORD",
    tab: "RECORD",
    from,
    to,
    unit: "year",
    lanes: ctx.recordStrip?.lanes ?? [],
    pins,
    bands: bandsFor(earned),
    arrows: [],
    axisBreak: null,
    sr,
  };
}

/** The RECORD chip: the nearest earned pin within ±2 months of the cursor (a band counts from anywhere inside it). */
export function recordChip(ctx: PanelContext, cursor: number | null): { key: string | null; text: string } {
  if (cursor === null || !Number.isFinite(cursor)) return { key: null, text: "—" };
  let best: EarnedEntry | null = null;
  let bestD = Infinity;
  for (const e of earnedEntries(ctx)) {
    const d = distanceToPin(e.pin, cursor);
    if (d <= CHIP_RADIUS_YEARS + EPS && d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best ? { key: best.pin.key, text: chipText(best.date, best.pin.label) } : { key: null, text: "—" };
}

/** Adds the earned pins (and their bands) to a meta-owned timeline card without changing its window or slot. */
export function withEarnedPins(card: TimelineCard, ctx: PanelContext): TimelineCard {
  const earned = earnedPins(ctx);
  if (earned.length === 0) return card;
  return { ...card, lanes: card.lanes.length ? card.lanes : (ctx.recordStrip?.lanes ?? []), pins: [...earned, ...card.pins], bands: [...bandsFor(earned), ...card.bands] };
}

function distanceToPin(p: TimelinePin, x: number): number {
  if (p.spanTo === null) return Math.abs(p.at - x);
  const lo = Math.min(p.at, p.spanTo);
  const hi = Math.max(p.at, p.spanTo);
  return x < lo ? lo - x : x > hi ? x - hi : 0;
}
function spanWindow(pins: readonly TimelinePin[]): YearWindow {
  const xs = pins.flatMap((p) => (p.spanTo === null ? [p.at] : [p.at, p.spanTo]));
  if (xs.length === 0) return { ...DEFAULT_RECORD_WINDOW };
  return { start: Math.floor(Math.min(...xs)) - 1, end: Math.ceil(Math.max(...xs)) + 1 };
}
function fmtBound(x: number): string {
  return Number.isInteger(x) ? String(x) : formatMonthYear(x);
}

// ---------------------------------------------------------------- FILE-card helpers (history metas)

/** How a footprint is drawn: the aimed claim green ("draft"), a hovered one "focus", the others at 40 % ("dim"). */
export type MarkStyle = "draft" | "focus" | "dim";
export interface FileMarks {
  pins: TimelinePin[];
  bands: TimelineBand[];
  arrows: TimelineArrow[];
}

/**
 * A claim footprint → marks keyed by the claim key (`fp:<key>`): pin → one pin; band → one pin with spanTo + a band;
 * arrow → two pins (`fp:<key>:from`, `fp:<key>:to`) joined by an arrow.
 */
export function footprintMarks(key: string, fp: Footprint, style: MarkStyle = "dim"): FileMarks {
  const from = fracYearOf(fp.from);
  const to = fp.to ? fracYearOf(fp.to) : null;
  const color: FnColor = style === "dim" ? "h" : "g";
  if (from === null) return { pins: [], bands: [], arrows: [] };
  if (fp.kind === "band" && to !== null) {
    return {
      pins: [{ key: `fp:${key}`, at: from, label: fp.label, lane: null, style, spanTo: to }],
      bands: [{ from: Math.min(from, to), to: Math.max(from, to), label: fp.label, color }],
      arrows: [],
    };
  }
  if (fp.kind === "arrow" && to !== null) {
    const a = `fp:${key}:from`;
    const b = `fp:${key}:to`;
    return {
      pins: [
        { key: a, at: from, label: formatDateSlug(fp.from), lane: null, style, spanTo: null },
        { key: b, at: to, label: fp.label, lane: null, style, spanTo: null },
      ],
      bands: [],
      arrows: [{ fromKey: a, toKey: b }],
    };
  }
  return { pins: [{ key: `fp:${key}`, at: from, label: fp.label, lane: null, style, spanTo: null }], bands: [], arrows: [] };
}

/** fileDates → FILE pins (`file:<i>`), labelled "SEP 1957 · Guard posted"-style by the panel from `at`. */
export function fileDatePins(fileDates: readonly FileDate[]): TimelinePin[] {
  const out: TimelinePin[] = [];
  fileDates.forEach((f, i) => {
    const at = fracYearOf(f.date);
    if (at !== null) out.push({ key: `file:${i}`, at, label: f.label, lane: null, style: "focus", spanTo: null });
  });
  return out;
}

/**
 * Hint pins → PanelStatic.recordPins. A rung-r pin shows once the player's aid reaches rung r:
 * r ≤ max(aidTier, hintsUsed) (rung 2 at aid tier 2; a rung-3 pin only after the third hint). Dashed ("hint").
 */
export function hintRecordPins(hintPins: readonly HintPin[], aidTier: AidTier, hintsUsed: HintsUsed): RecordPin[] {
  const reach = Math.max(aidTier, hintsUsed);
  const out: RecordPin[] = [];
  hintPins.forEach((h, i) => {
    const at = fracYearOf(h.date);
    if (at !== null && h.rung <= reach) out.push({ key: `hint:${i}`, at, label: h.label, style: "hint" });
  });
  return out;
}

/**
 * The FILE card (the meta's first card when StaticInput.record). `window` is the probe window; marks outside it
 * widen the axis and add ONE axis break (the elided interval, civil e1's `1896 ≈`): the axis then spans
 * [outsideMin − ½, window.end] and `axisBreak = {from: outsideMax + ½, to: window.start}` (mirrored for dates after
 * the window when nothing lies before it). Without a window the card spans its marks ± 1 year.
 */
export function fileCard(args: {
  slot: number;
  window: YearWindow | null;
  marks: readonly FileMarks[];
  pins?: readonly TimelinePin[];
  title?: string;
  sr?: string;
}): TimelineCard {
  const pins = [...args.marks.flatMap((m) => m.pins), ...(args.pins ?? [])];
  const bands = args.marks.flatMap((m) => m.bands);
  const arrows = args.marks.flatMap((m) => m.arrows);
  const w = args.window ?? spanWindow(pins);
  let from = w.start;
  let to = w.end;
  let axisBreak: TimelineCard["axisBreak"] = null;
  const xs = pins.flatMap((p) => (p.spanTo === null ? [p.at] : [p.at, p.spanTo]));
  const before = xs.filter((x) => x < w.start - EPS);
  const after = xs.filter((x) => x > w.end + EPS);
  if (args.window && before.length) {
    from = Math.min(...before) - 0.5;
    axisBreak = { from: Math.max(...before) + 0.5, to: w.start };
  } else if (args.window && after.length) {
    to = Math.max(...after) + 0.5;
    axisBreak = { from: w.end, to: Math.min(...after) - 0.5 };
  }
  if (axisBreak && !(axisBreak.from < axisBreak.to)) axisBreak = null;
  const title = args.title ?? "FILE";
  const sr =
    args.sr ??
    `${title}, ${fmtBound(w.start)} to ${fmtBound(w.end)}: ${pins.length === 0 ? "no dated entries" : pins.map((p) => `${formatMonthYear(p.at)} ${p.label}`).join("; ")}.`;
  return { kind: "timeline", slot: args.slot, title, tab: title, from, to, unit: "year", lanes: [], pins, bands, arrows, axisBreak, sr };
}

/** The FILE chip: the FILE pin within ±2 months of the cursor, else "—" (bands count from anywhere inside). */
export function fileChip(card: TimelineCard, cursor: number | null): { key: string | null; text: string } {
  if (cursor === null || !Number.isFinite(cursor)) return { key: null, text: "—" };
  let best: TimelinePin | null = null;
  let bestD = Infinity;
  for (const p of card.pins) {
    const d = distanceToPin(p, cursor);
    if (d <= CHIP_RADIUS_YEARS + EPS && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best ? { key: best.key, text: `${formatMonthYear(best.at)} · ${best.label.toUpperCase()}` } : { key: null, text: "—" };
}

// ---------------------------------------------------------------- record lens (accessory maths)

/** u ∈ [0, 1]: where the probe sits in the window (clamped; a degenerate window gives 0). */
export function lensU(window: YearWindow, probe: number): number {
  const span = window.end - window.start;
  if (!(span > 0) || !Number.isFinite(probe)) return 0;
  return Math.min(1, Math.max(0, (probe - window.start) / span));
}

/** Where the record_lens carriage sits on its rail for a probe value (arc length along a possibly bent rail). */
export function lensTarget(rail: readonly Point[], window: YearWindow, probe: number): Vec2 {
  return pointAlong(rail, lensU(window, probe)) ?? { x: 0, y: 0 };
}

/** The Scrubber readout for a history probe: month_year → "MAR 1965", year → "1965"; null for other formats. */
export function yearReadout(format: string, value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (format === "month_year") return formatMonthYear(value);
  if (format === "year") return String(Math.floor(value + EPS));
  return null;
}
/** The window a history probe spans: its declared window, else [min, max]. */
export function probeWindowOf(probe: { min: number; max: number; window: YearWindow | null } | null): YearWindow | null {
  if (!probe) return null;
  return probe.window ?? { start: probe.min, end: probe.max };
}
