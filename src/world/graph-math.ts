/**
 * src/world/graph-math.ts — pure maths for the instrument panel (docs/design/20 §3.2, bible §3.3–§3.5). P1 (L3).
 *
 * Ticks, π / year / month-year formatting, readout formatting per ProbeFormat, curve sampling with discontinuity
 * splits, projection into a card's plot box, value-chip placement, and fractional-year dates. No React, no DOM.
 *
 * Display strings use the typographic minus sign (U+2212) and a thin space before units, so they read on a
 * projector; `parseDisplayNumber` is the inverse used by tests.
 */
import type { AxisUnit, ProbeSpec } from "../contracts/world";
import { fracYearOf } from "./contraptions/config-parts";
import type { Tick } from "./types";

export const MINUS = "−";
const PI = Math.PI;
const EPS = 1e-9;
const MONTHS_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

// ---------------------------------------------------------------- number formatting

/** Rounds away float noise (0.30000000000000004 → 0.3) and "-0". */
export function clean(v: number, digits = 6): number {
  const r = Number(v.toFixed(digits));
  return Object.is(r, -0) ? 0 : r;
}

/** `n` decimals, trailing zeros kept when `fixed`, typographic minus. */
export function fmtNumber(v: number, decimals = 1, fixed = true): string {
  if (!Number.isFinite(v)) return v > 0 ? "∞" : v < 0 ? `${MINUS}∞` : "—";
  const r = clean(v, decimals);
  const s = fixed ? Math.abs(r).toFixed(decimals) : String(Math.abs(r));
  return r < 0 ? `${MINUS}${s}` : s;
}

/** Inverse of the display formatting for plain numbers ("−2.4" → −2.4). */
export function parseDisplayNumber(s: string): number {
  return Number(s.replace(MINUS, "-").replace(/[^0-9eE+\-.]/g, ""));
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

/** v as a reduced fraction of π with denominator ≤ maxDen, or null when it is not one (within 1e-6). */
export function piFraction(v: number, maxDen = 12): { num: number; den: number } | null {
  const m = v / PI;
  for (let den = 1; den <= maxDen; den++) {
    const num = Math.round(m * den);
    if (Math.abs(m * den - num) < 1e-6) {
      const g = gcd(num, den) || 1;
      return { num: num / g, den: den / g };
    }
  }
  return null;
}

/** "0", "π", "−π", "2π", "π/2", "−3π/4", "5π/6"; else "0.83π" (two decimals of π). */
export function formatPi(v: number, maxDen = 12): string {
  if (!Number.isFinite(v)) return fmtNumber(v);
  const f = piFraction(v, maxDen);
  if (!f) return `${fmtNumber(v / PI, 2)}π`;
  if (f.num === 0) return "0";
  const sign = f.num < 0 ? MINUS : "";
  const n = Math.abs(f.num);
  const head = n === 1 ? "π" : `${n}π`;
  return f.den === 1 ? `${sign}${head}` : `${sign}${head}/${f.den}`;
}

// ---------------------------------------------------------------- dates (fractional years)

/** "1965-03" → 1965.1667 (the same definition as config-parts' fracYearOf: year + (month−1)/12 + (day−1)/365.25). */
export function fracYear(date: string): number | null {
  return fracYearOf(date);
}

/** Inverse of fracYear at a precision: 1965.1667 → "1965-03"; "day" adds the day of month. */
export function dateOfFracYear(v: number, precision: "year" | "month" | "day" = "month"): string {
  const year = Math.floor(v + EPS);
  const rest = v - year;
  const month = Math.min(11, Math.max(0, Math.floor(rest * 12 + 1e-6)));
  const yyyy = String(year).padStart(4, "0");
  if (precision === "year") return yyyy;
  const mm = String(month + 1).padStart(2, "0");
  if (precision === "month") return `${yyyy}-${mm}`;
  const day = Math.min(31, Math.max(1, Math.round((rest - month / 12) * 365.25) + 1));
  return `${yyyy}-${mm}-${String(day).padStart(2, "0")}`;
}

/** 1965.1667 → "MAR 1965". */
export function formatMonthYear(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const year = Math.floor(v + EPS);
  const month = Math.min(11, Math.max(0, Math.floor((v - year) * 12 + 1e-6)));
  return `${MONTHS_SHORT[month]} ${year}`;
}

// ---------------------------------------------------------------- ticks

/** Tick label for an axis unit: "2π", "π/2", "1957", "MAR 1965", "40 %", "2.4 nm", "−2". */
export function formatTick(v: number, unit: AxisUnit): string {
  switch (unit) {
    case "pi":
      return formatPi(v);
    case "year":
      return String(Math.round(v));
    case "month":
      return Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : formatMonthYear(v);
    case "percent":
      return `${fmtNumber(v, 0, false)} %`;
    case "mM":
      return `${fmtNumber(v, 1, false)} mM`;
    case "nm":
      return `${fmtNumber(v, 1, false)} nm`;
    case "seconds":
      return `${fmtNumber(v, 1, false)} s`;
    case "count":
    case "stage":
      return fmtNumber(Math.round(v), 0, false);
    case "rate":
    case "number":
    default:
      return fmtNumber(clean(v, 4), 4, false);
  }
}

function niceStep(span: number, maxMajors: number): number {
  const raw = span / Math.max(1, maxMajors);
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= raw - EPS) return m * mag;
  return 10 * mag;
}

/** The major step the ticks use (exported for the Scrubber's PgUp/PgDn). */
export function majorStep(min: number, max: number, unit: AxisUnit, maxMajors = 8): number {
  const span = Math.max(EPS, max - min);
  if (unit === "pi") {
    for (const f of [1 / 12, 1 / 6, 1 / 4, 1 / 2, 1, 2, 4]) if (span / (f * PI) <= maxMajors + EPS) return f * PI;
    return 8 * PI;
  }
  if (unit === "year" || unit === "count" || unit === "stage") return Math.max(1, niceStep(span, maxMajors));
  if (unit === "month") {
    for (const f of [1 / 12, 1 / 4, 1 / 2, 1, 2, 5, 10, 20, 25, 50]) if (span / f <= maxMajors + EPS) return f;
    return 100;
  }
  return niceStep(span, maxMajors);
}

/**
 * Major ticks (labelled with formatTick) and minor ticks (halves; months for month axes; single years for year
 * axes with a 2+ year major step), inside [min, max], ascending. Bible §3.3: label only majors.
 */
export function niceTicks(min: number, max: number, unit: AxisUnit, maxMajors = 8): Tick[] {
  if (!(max > min)) return [{ v: min, label: formatTick(min, unit), major: true }];
  const major = majorStep(min, max, unit, maxMajors);
  let minor = major / 2;
  if (unit === "month") minor = major > 1 / 12 + EPS ? (major <= 1 ? 1 / 12 : major / 2) : major;
  if ((unit === "year" || unit === "count" || unit === "stage") && major < 2) minor = major;
  const out: Tick[] = [];
  const start = Math.ceil((min - EPS) / minor);
  const end = Math.floor((max + EPS) / minor);
  for (let i = start; i <= end && out.length < 400; i++) {
    const v = clean(i * minor, 9);
    const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
    if (!isMajor && minor === major) continue;
    out.push({ v, label: isMajor ? formatTick(v, unit) : null, major: isMajor });
  }
  return out;
}

/** Keeps the labels of the listed values only (a card's x axis labels just its far end, like the reference). */
export function labelOnly(ticks: readonly Tick[], keep: (t: Tick, i: number, all: readonly Tick[]) => boolean): Tick[] {
  return ticks.map((t, i, all) => (t.label !== null && !keep(t, i, all) ? { ...t, label: null } : t));
}

// ---------------------------------------------------------------- readouts

export type ProbeFormatSpec = Pick<ProbeSpec, "format" | "unit" | "stops"> & Partial<Pick<ProbeSpec, "step">>;

/**
 * The dark readout box (bible §3.4): "0.83π", "3.0", "4", "stage 3 · flip out", "40 %", "1957", "MAR 1965",
 * "2.4 nm". `number` shows one decimal (two when the step is finer than 0.1) followed by the unit.
 */
export function formatProbe(v: number, spec: ProbeFormatSpec): string {
  if (!Number.isFinite(v)) return "—";
  const unit = spec.unit ? ` ${spec.unit}` : "";
  switch (spec.format) {
    case "pi":
      return formatPi(v);
    case "integer":
      return `${fmtNumber(Math.round(v), 0)}${unit}`;
    case "stage": {
      const k = Math.round(v);
      const stop = [...spec.stops].sort((a, b) => Math.abs(a.v - v) - Math.abs(b.v - v))[0];
      const name = stop && Math.abs(stop.v - v) < 0.5 ? ` · ${stop.label}` : "";
      return `stage ${k}${name}`;
    }
    case "percent":
      return `${fmtNumber(v, Number.isInteger(clean(v, 6)) ? 0 : 1)} %`;
    case "year":
      return String(Math.floor(v + EPS));
    case "month_year":
      return formatMonthYear(v);
    case "number":
    default: {
      const decimals = spec.step !== undefined && spec.step < 0.1 - EPS ? 2 : 1;
      return `${fmtNumber(v, decimals)}${unit}`;
    }
  }
}

/** A value chip's text in its card's unit (bible §3.5): "0.83π", "π/2", "−2.4", "1957", "40 %". */
export function formatChip(v: number, unit: AxisUnit): string {
  switch (unit) {
    case "pi":
      return formatPi(v, 6);
    case "year":
    case "month":
      return formatTick(v, unit);
    case "percent":
      return `${fmtNumber(v, 0)} %`;
    case "count":
    case "stage":
      return fmtNumber(Math.round(v), 0);
    default:
      return fmtNumber(v, 1);
  }
}

// ---------------------------------------------------------------- sampling and projection

export type Pt = readonly [number, number];

/**
 * Samples fn on [x0, x1] at n + 1 points and splits the polyline at NaN, ±∞ and jumps larger than `jumpFrac` (25 %)
 * of the finite y-range, so poles and step discontinuities are never bridged. Single points are dropped.
 */
export function sample(fn: (x: number) => number, x0: number, x1: number, n = 200, jumpFrac = 0.25): Pt[][] {
  const count = Math.max(1, Math.floor(n));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= count; i++) {
    const x = x0 + ((x1 - x0) * i) / count;
    let y: number;
    try {
      y = fn(x);
    } catch {
      y = Number.NaN;
    }
    pts.push({ x, y: typeof y === "number" ? y : Number.NaN });
  }
  const finite = pts.filter((p) => Number.isFinite(p.y)).map((p) => p.y);
  const range = finite.length ? Math.max(...finite) - Math.min(...finite) : 0;
  const jump = range > EPS ? range * jumpFrac : Number.POSITIVE_INFINITY;
  const segs: Pt[][] = [];
  let cur: Pt[] = [];
  let prev: { x: number; y: number } | null = null;
  for (const p of pts) {
    if (!Number.isFinite(p.y)) {
      if (cur.length) segs.push(cur);
      cur = [];
      prev = null;
      continue;
    }
    if (prev && Math.abs(p.y - prev.y) > jump) {
      segs.push(cur);
      cur = [];
    }
    cur.push([p.x, p.y]);
    prev = p;
  }
  if (cur.length) segs.push(cur);
  return segs.filter((s) => s.length >= 2);
}

/** A card's plot area in CSS px plus the data window it shows. y is UP in data, DOWN on screen. */
export interface PlotBox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export function projectX(x: number, b: PlotBox): number {
  const span = b.xMax - b.xMin || 1;
  return b.left + ((x - b.xMin) / span) * b.width;
}
export function projectY(y: number, b: PlotBox): number {
  const span = b.yMax - b.yMin || 1;
  return b.top + (1 - (y - b.yMin) / span) * b.height;
}
export function project(x: number, y: number, b: PlotBox): { px: number; py: number } {
  return { px: projectX(x, b), py: projectY(y, b) };
}
/** Pointer px → data x, clamped to the box's x window. */
export function unprojectX(px: number, b: PlotBox): number {
  const u = b.width > 0 ? (px - b.left) / b.width : 0;
  return b.xMin + Math.min(1, Math.max(0, u)) * (b.xMax - b.xMin);
}

/** SVG path data for sampled segments ("M x y L x y …" per segment). */
export function pathOf(segments: readonly (readonly Pt[])[], b: PlotBox): string {
  return segments
    .map((seg) => seg.map(([x, y], i) => `${i === 0 ? "M" : "L"}${projectX(x, b).toFixed(1)} ${projectY(y, b).toFixed(1)}`).join(" "))
    .join(" ");
}

/**
 * Where a value chip sits on its card's left edge (bible §3.5): the chip's CENTRE y in card px at y(value),
 * clamped so the whole chip stays on the card. Non-finite values park the chip at the card's middle.
 */
export function chipY(value: number, y: { min: number; max: number }, cardHeight: number, chipHeight: number, pad = 0): number {
  const half = chipHeight / 2;
  const lo = half + pad;
  const hi = Math.max(lo, cardHeight - half - pad);
  if (!Number.isFinite(value)) return (lo + hi) / 2;
  const span = y.max - y.min || 1;
  const py = (1 - (value - y.min) / span) * cardHeight;
  return Math.min(hi, Math.max(lo, py));
}

/** Nearest tick value (majors only when `majorOnly`), for detents and PgUp/PgDn. */
export function nearestTick(v: number, ticks: readonly Tick[], majorOnly = false): number | null {
  let best: number | null = null;
  for (const t of ticks) {
    if (majorOnly && !t.major) continue;
    if (best === null || Math.abs(t.v - v) < Math.abs(best - v)) best = t.v;
  }
  return best;
}

/** Snaps v to min + k·step and clamps to [min, max] (float noise removed). */
export function snapToStep(v: number, min: number, max: number, step: number): number {
  if (!(step > 0)) return Math.min(max, Math.max(min, v));
  const k = Math.round((v - min) / step);
  return clean(Math.min(max, Math.max(min, min + k * step)), 9);
}
