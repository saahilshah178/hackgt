/**
 * pump-flume — the e7 reference sim (docs/design/20 §4.2 sims table, §7.4 sims row; cell §5.7). KB1.
 *
 * A pump fed r ATP/s (the probe) moves Na⁺ from a Low Tank up to a High Tank; a leak trough returns it down the
 * gradient. Measurable state only (F6):
 *   - the steady-state gap ΔC_ss(r) = 0.96·r mM (clamped to 9.6), C_high,ss = 5 + ΔC/2, C_low,ss = 5 − ΔC/2;
 *     both tanks relax toward it with τ = 1.2 s, so at r = 0 the gap collapses (the Stillness);
 *   - stroke: the piston phase in [0, 1), advancing at 0.4·r Hz (one gold spark per wrap, counted in `strokes`);
 *   - pumpRate = 0.8·r motes/s uphill, leakRate = 0.35·(C_high − C_low) motes/s downhill (the prefab's mote flow).
 *
 * `params`: mean (tank mean mM, default 5), tau (s, default 1.2), r0 (feed when the probe is null, default 0).
 */
import type { SimCtx, SimParams, SimSpec } from "../types";

export interface PumpFlumeState {
  t: number;
  cHigh: number; // mM
  cLow: number; // mM
  stroke: number; // piston phase [0, 1)
  strokes: number; // completed strokes (one ATP spark each)
  feed: number; // r (ATP/s) driving this state
  pumpRate: number; // motes/s uphill
  leakRate: number; // motes/s downhill
  mean: number;
  tau: number;
}

export const GAP_PER_ATP = 0.96;
export const GAP_MAX = 9.6;
export const FLUME_TAU_S = 1.2;

const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Steady-state gap ΔC_ss(r) = 0.96·r, clamped to [0, 9.6] mM. */
export function steadyGap(r: number): number {
  return Math.min(GAP_MAX, Math.max(0, GAP_PER_ATP * r));
}
/** Steady-state tank levels for a feed r around a mean (default 5 mM). */
export function steadyTanks(r: number, mean = 5): { cHigh: number; cLow: number } {
  const g = steadyGap(r);
  return { cHigh: mean + g / 2, cLow: mean - g / 2 };
}
/** Piston stroke frequency (Hz) for a feed r: 0.4·r. */
export function strokeHz(r: number): number {
  return 0.4 * Math.max(0, r);
}

export const pumpFlume: SimSpec<SimParams, PumpFlumeState> = {
  init: (_seed: number, config: SimParams, _view: unknown, ctx: SimCtx): PumpFlumeState => {
    const p = config ?? {};
    const mean = num(p.mean, 5);
    const tau = Math.max(0.05, num(p.tau, FLUME_TAU_S));
    const r = Math.max(0, num(ctx.probe, num(p.r0, 0)));
    // the hall opens in the Stillness: both tanks level, then the feed builds the gap
    return { t: 0, cHigh: mean, cLow: mean, stroke: 0, strokes: 0, feed: r, pumpRate: 0.8 * r, leakRate: 0, mean, tau };
  },
  step: (s: PumpFlumeState, dt: number, ctx: SimCtx): PumpFlumeState => {
    const h = Math.max(0, dt);
    const r = Math.max(0, num(ctx.probe, s.feed));
    const ss = steadyTanks(r, s.mean);
    const k = 1 - Math.exp(-h / s.tau);
    const cHigh = s.cHigh + (ss.cHigh - s.cHigh) * k;
    const cLow = s.cLow + (ss.cLow - s.cLow) * k;
    const phase = s.stroke + strokeHz(r) * h;
    const wraps = Math.floor(phase);
    return {
      ...s,
      t: s.t + h,
      cHigh,
      cLow,
      stroke: phase - wraps,
      strokes: s.strokes + wraps,
      feed: r,
      pumpRate: 0.8 * r,
      leakRate: 0.35 * (cHigh - cLow),
    };
  },
  fixedDt: 1 / 30,
  resetOn: ["open"],
  readout: (s: PumpFlumeState) => ({
    cHigh: s.cHigh,
    cLow: s.cLow,
    stroke: s.stroke,
    strokes: s.strokes,
    gap: s.cHigh - s.cLow,
    pumpRate: s.pumpRate,
    leakRate: s.leakRate,
  }),
};
