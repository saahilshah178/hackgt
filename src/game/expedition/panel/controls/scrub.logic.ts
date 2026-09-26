/**
 * controls/scrub.logic.ts — ScrubControl + Scrubber state (docs/design/20 §3.3, §3.2 Scrubber; bible §3.4). Pure.
 *
 * The scalar input (tuner.oscillator, tuner.formula, mapper.number_line) is the orange scrubber itself. The meta's
 * PanelStatic.input describes it; before a meta is native (W0 stubs) `scalarInputOf` derives it from the view.
 */
import type { AxisUnit, ProbeFormat, ProbeSpec } from "../../../../contracts/world";
import { majorStep, niceTicks, snapToStep } from "../../../../world/graph-math";
import type { ModeKey, PanelStatic, Tick } from "../../../../world/types";

export type ScalarInput = NonNullable<PanelStatic["input"]>;
export interface ScrubState {
  value: number;
}

const PI = Math.PI;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

function hasPiLabels(labels: readonly unknown[]): boolean {
  return labels.some((l) => typeof l === "string" && l.includes("π"));
}

/** The dial's own ticks as majors (labels kept), plus unlabelled half-way minors. */
function ticksFromDial(rows: readonly { value: number; label: string }[], unit: AxisUnit, min: number, max: number): Tick[] {
  if (rows.length < 2) return niceTicks(min, max, unit);
  const majors = [...rows].sort((a, b) => a.value - b.value);
  const out: Tick[] = [];
  majors.forEach((r, i) => {
    out.push({ v: r.value, label: r.label.replace(/-/g, "−"), major: true });
    const next = majors[i + 1];
    if (next) out.push({ v: (r.value + next.value) / 2, label: null, major: false });
  });
  return out;
}

const OSC_SYMBOL: Record<string, string> = { period: "T", frequency: "f", amplitude: "A", phase: "φ", midline: "d" };

/**
 * The scalar input spec from a mode's view (fallback while a meta returns `input: null`). Returns null for
 * non-scalar modes. π-labelled dials get π units and a π readout.
 */
export function scalarInputOf(modeKey: ModeKey, view: unknown): ScalarInput | null {
  if (!isObj(view)) return null;
  if (modeKey === "tuner.oscillator" || modeKey === "tuner.formula") {
    const dial = isObj(view.dial) ? view.dial : null;
    if (!dial) return null;
    const min = num(dial.min, 0);
    const max = num(dial.max, 1);
    const rows = Array.isArray(dial.ticks)
      ? (dial.ticks as unknown[]).filter(isObj).map((t) => ({ value: num(t.value, 0), label: String(t.label ?? "") }))
      : [];
    const pi = hasPiLabels(rows.map((r) => r.label));
    const unit: AxisUnit = pi ? "pi" : "number";
    const symbol =
      modeKey === "tuner.formula" ? String(dial.name ?? "x").slice(0, 8) : (OSC_SYMBOL[String(view.ask ?? "")] ?? "x");
    return {
      symbol,
      min,
      max,
      step: num(dial.step, (max - min) / 100) || (max - min) / 100,
      unit,
      format: pi ? "pi" : "number",
      ticks: ticksFromDial(rows, unit, min, max),
    };
  }
  if (modeKey === "mapper.number_line") {
    if (typeof view.min !== "number" || typeof view.max !== "number" || !(view.max > view.min)) return null;
    const min = num(view.min, 0);
    const max = num(view.max, 1);
    const marks = Array.isArray(view.landmarks) ? (view.landmarks as unknown[]).filter(isObj) : [];
    const pi = hasPiLabels(marks.map((l) => l.label));
    const unit: AxisUnit = pi ? "pi" : "number";
    const step = pi ? PI / 48 : snapStepFor(max - min);
    return {
      symbol: pi ? "θ" : "x",
      min,
      max,
      step,
      unit,
      format: pi ? "pi" : "number",
      ticks: pi ? niceTicks(min, max, "pi", 8) : niceTicks(min, max, unit, 10),
    };
  }
  return null;
}

/** A readable step: 1/100 of the span rounded down to 1, 2 or 5 × 10^k. */
function snapStepFor(span: number): number {
  const raw = Math.abs(span) / 100 || 0.01;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [5, 2, 1]) if (m * mag <= raw + 1e-12) return m * mag;
  return mag;
}

/** A ProbeSpec as the Scrubber's range (the probe mode of the Scrubber). */
export function rangeOfProbe(p: ProbeSpec): ScalarInput {
  const unit: AxisUnit =
    p.format === "pi" ? "pi" : p.format === "year" ? "year" : p.format === "month_year" ? "month" : p.format === "percent" ? "percent" : p.format === "stage" ? "stage" : "number";
  const ticks: Tick[] = p.stops.length
    ? [...p.stops].sort((a, b) => a.v - b.v).map((s) => ({ v: s.v, label: String(Math.round(s.v)), major: true }))
    : niceTicks(p.min, p.max, unit, 10);
  return { symbol: p.symbol, min: p.min, max: p.max, step: p.step, unit, format: p.format as ProbeFormat, ticks };
}

// ---------------------------------------------------------------- the control logic (§3.3 contract)

export function initialScrub(input: ScalarInput, draftInput: unknown): ScrubState {
  return fromDraftInput(draftInput, input);
}
export function toDraftInput(s: ScrubState): { value: number } {
  return { value: s.value };
}
export function complete(s: ScrubState): boolean {
  return Number.isFinite(s.value);
}
export function fromDraftInput(d: unknown, input: Pick<ScalarInput, "min" | "max">): ScrubState {
  const v = isObj(d) && typeof d.value === "number" && Number.isFinite(d.value) ? d.value : input.min;
  return { value: Math.min(input.max, Math.max(input.min, v)) };
}

// ---------------------------------------------------------------- keyboard and pointer math (the Scrubber)

export type ScrubKey = "dec" | "inc" | "pageDec" | "pageInc" | "home" | "end";

/** Maps a KeyboardEvent key to a scrub action (←/→ and A/D step, ↑/↓ step as ARIA sliders do, PgUp/PgDn, Home/End). */
export function scrubKeyOf(key: string): ScrubKey | null {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
    case "a":
    case "A":
      return "dec";
    case "ArrowRight":
    case "ArrowUp":
    case "d":
    case "D":
      return "inc";
    case "PageDown":
      return "pageDec";
    case "PageUp":
      return "pageInc";
    case "Home":
      return "home";
    case "End":
      return "end";
    default:
      return null;
  }
}

/**
 * The next value for a scrub action: one step (Shift × 10), one MAJOR tick for PgUp/PgDn (to the next major tick
 * in that direction, else one major step), min/max for Home/End. Always snapped to the step grid and clamped.
 */
export function stepValue(value: number, action: ScrubKey, shift: boolean, r: Pick<ScalarInput, "min" | "max" | "step" | "ticks" | "unit">): number {
  const step = r.step > 0 ? r.step : (r.max - r.min) / 100;
  switch (action) {
    case "home":
      return r.min;
    case "end":
      return r.max;
    case "dec":
    case "inc": {
      const dir = action === "inc" ? 1 : -1;
      return snapToStep(value + dir * step * (shift ? 10 : 1), r.min, r.max, step);
    }
    case "pageDec":
    case "pageInc": {
      const dir = action === "pageInc" ? 1 : -1;
      const majors = r.ticks.filter((t) => t.major).map((t) => t.v).sort((a, b) => a - b);
      const target =
        dir > 0 ? majors.find((v) => v > value + 1e-9) : [...majors].reverse().find((v) => v < value - 1e-9);
      const fallback = value + dir * majorStep(r.min, r.max, r.unit);
      return Math.min(r.max, Math.max(r.min, target ?? fallback));
    }
  }
}

/** Pointer fraction (0…1 across the ruler's plot x-range) → value on the step grid. */
export function valueAtFraction(u: number, r: Pick<ScalarInput, "min" | "max" | "step">): number {
  const v = r.min + Math.min(1, Math.max(0, u)) * (r.max - r.min);
  return snapToStep(v, r.min, r.max, r.step);
}

/** Stage probes rest on their stops: on settle, snap to the nearest stop. */
export function settleValue(value: number, probe: Pick<ProbeSpec, "format" | "stops"> | null): number {
  if (!probe || probe.format !== "stage" || probe.stops.length === 0) return value;
  let best = probe.stops[0].v;
  for (const s of probe.stops) if (Math.abs(s.v - value) < Math.abs(best - value)) best = s.v;
  return best;
}

/** Milliseconds after the last key before a keyboard scrub counts as settled (§3.2). */
export const SETTLE_MS = 300;
