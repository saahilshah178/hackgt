/**
 * osmotic-cell — the e4 reference sim (docs/design/20 §4.2 sims table, §7.4 sims row; cell §5.4). KB1. Also reused by
 * the plant_garden sandbox (§2.4b).
 *
 * A test cell with fixed inside salt C_in (%) and an osmotically inactive fraction b sits in a bath of salt s (%, the
 * probe). Water, never salt, crosses the membrane. Measurable state only (F6):
 *   - volume V/V₀ relaxes toward V∞(s) = b + (1 − b)·C_in / max(s, 0.3), clamped to [0.55, 1.6], with the sim's own
 *     time constant (osmosis looks deliberate, τ = 0.35 s ≤ 0.4 s);
 *   - waterFlux = 6·(s − C_in) droplets/s: positive = water leaves the cell (toward the saltier bath), negative = in;
 *   - saltInside stays at C_in (the cubes bounce off; the s1 ghost's "salt inflow" contradicts this).
 *
 * `params`: cIn (default 2), b (default 0.3), s0 (bath salt when the probe is null; default cIn = isotonic).
 */
import type { SimCtx, SimParams, SimSpec } from "../types";

export interface OsmoticCellState {
  t: number;
  volume: number; // V/V₀
  waterFlux: number; // droplets/s, + = out of the cell
  salt: number; // the bath salt s (%) driving this state
  saltInside: number; // C_in (%), constant
  target: number; // V∞(s)
  cIn: number;
  b: number;
}

export const V_MIN = 0.55;
export const V_MAX = 1.6;
export const OSMOSIS_TAU_S = 0.35;
const S_FLOOR = 0.3;

const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Equilibrium volume V/V₀ = b + (1 − b)·C_in / max(s, 0.3), clamped to [0.55, 1.6] (cell §5.4). */
export function osmoticVolume(s: number, cIn = 2, b = 0.3): number {
  const v = b + ((1 - b) * cIn) / Math.max(s, S_FLOOR);
  return Math.min(V_MAX, Math.max(V_MIN, v));
}
/** Water droplet rate across the membrane: 6·(s − C_in) per second; positive = outward (toward the saltier bath). */
export function waterFluxFor(s: number, cIn = 2): number {
  return 6 * (s - cIn);
}

function paramsOf(config: SimParams | undefined): { cIn: number; b: number; s0: number } {
  const p = config ?? {};
  const cIn = Math.max(0.1, num(p.cIn, 2));
  const b = Math.min(0.95, Math.max(0, num(p.b, 0.3)));
  return { cIn, b, s0: Math.max(0, num(p.s0, cIn)) };
}

export const osmoticCell: SimSpec<SimParams, OsmoticCellState> = {
  init: (_seed: number, config: SimParams, _view: unknown, ctx: SimCtx): OsmoticCellState => {
    const { cIn, b, s0 } = paramsOf(config);
    const s = Math.max(0, num(ctx.probe, s0));
    // a fresh cell starts at its own isotonic volume and then responds to the bath
    return { t: 0, volume: 1, waterFlux: waterFluxFor(s, cIn), salt: s, saltInside: cIn, target: osmoticVolume(s, cIn, b), cIn, b };
  },
  step: (st: OsmoticCellState, dt: number, ctx: SimCtx): OsmoticCellState => {
    const s = Math.max(0, num(ctx.probe, st.salt));
    const target = osmoticVolume(s, st.cIn, st.b);
    const k = 1 - Math.exp(-Math.max(0, dt) / OSMOSIS_TAU_S);
    const volume = st.volume + (target - st.volume) * k;
    return { ...st, t: st.t + dt, salt: s, target, volume, waterFlux: waterFluxFor(s, st.cIn) };
  },
  fixedDt: 1 / 30,
  resetOn: ["open"],
  readout: (st: OsmoticCellState) => ({
    volume: st.volume,
    waterFlux: st.waterFlux,
    waterSign: Math.sign(st.waterFlux),
    salt: st.salt,
    saltInside: st.saltInside,
  }),
};
