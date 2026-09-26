/**
 * diffusion-tank — the e3 reference sim (docs/design/20 §4.2 sims table, §7.4 sims row; cell §5.3). KB1.
 *
 * Two chambers split by a membrane window. A dye load a (mM, the probe) fills the left chamber with N = round(10a)
 * particles (max 100); the right starts empty. Measurable state only (F6):
 *   - cL, cR (mM, = N/10) relax toward each other: the net crossing rate is J = kJ·(cL − cR) particles/s, with
 *     kJ = 0.35·(p / 0.3) (cell §5.3: J₀ = 0.35·(C_L − C_R) at p = 0.3), so the measured J always has the sign of
 *     cL − cR and the two concentrations converge monotonically to their mean;
 *   - flux: the MEASURED net flux over a sliding 2 s window (cumulative crossings, differenced);
 *   - tracer: particle #0's seeded random walk (Gaussian step σ, reflecting walls, passes the window with
 *     probability p per contact), its last 60 points, in tank units (x 0–780, y 0–310; the window at x = 390).
 * The dye dots themselves are cosmetic and live in the prefab, seeded from the same seed.
 *
 * `params`: p (window pass probability, default 0.3), sigma (tracer step, default 5), a0 (dye load when the probe is
 * null, default 5).
 */
import type { SimCtx, SimParams, SimSpec } from "../types";

export type TracerPoint = readonly [number, number];

export interface DiffusionTankState {
  t: number;
  cL: number; // mM
  cR: number; // mM
  flux: number; // measured net L→R crossings per second over the last 2 s window
  tracer: readonly TracerPoint[]; // particle #0, the last 60 points (oldest first)
  load: number; // the dye load a (mM) this run started from
  crossed: number; // cumulative net L→R crossings (particles, fractional)
  history: readonly number[]; // `crossed` at each of the last WINDOW_STEPS steps (oldest first)
  rng: number; // mulberry32 state (uint32)
  p: number;
  sigma: number;
}

export const TANK_W = 780;
export const TANK_H = 310;
export const WINDOW_X = TANK_W / 2;
export const TRACER_POINTS = 60;
export const FLUX_WINDOW_S = 2;
const FIXED_DT = 1 / 30;
const WINDOW_STEPS = Math.round(FLUX_WINDOW_S / FIXED_DT);
const MAX_PARTICLES = 100;

const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Particles loaded for a dye load a (mM): round(10a), capped at 100. */
export function particlesFor(load: number): number {
  return Math.min(MAX_PARTICLES, Math.max(0, Math.round(10 * load)));
}
/** The flux coefficient kJ for a window pass probability p (0.35 at p = 0.3). */
export function fluxCoefficient(p: number): number {
  return 0.35 * (Math.min(1, Math.max(0, p)) / 0.3);
}
/** Predicted instantaneous net flux J₀ = kJ·(cL − cR) (what the s2 ghost arrow draws). */
export function predictedFlux(cL: number, cR: number, p = 0.3): number {
  return fluxCoefficient(p) * (cL - cR);
}

// ---------------------------------------------------------------- pure seeded PRNG (state in the sim state)

function rngNext(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}
/** Box–Muller from two uniforms. */
function gaussian(state: number): [number, number] {
  const [u1, s1] = rngNext(state);
  const [u2, s2] = rngNext(s1);
  return [Math.sqrt(-2 * Math.log(Math.max(1e-12, u1))) * Math.cos(2 * Math.PI * u2), s2];
}

function reflect(v: number, lo: number, hi: number): number {
  let x = v;
  if (x < lo) x = lo + (lo - x);
  if (x > hi) x = hi - (x - hi);
  return Math.min(hi, Math.max(lo, x));
}

function start(seed: number, params: SimParams, load: number): DiffusionTankState {
  const n = particlesFor(load);
  const p = Math.min(1, Math.max(0, num(params.p, 0.3)));
  const sigma = Math.max(0.1, num(params.sigma, 5));
  let rng = seed >>> 0;
  const [ux, r1] = rngNext(rng);
  const [uy, r2] = rngNext(r1);
  rng = r2;
  // particle #0 starts in the left chamber
  const first: TracerPoint = [20 + ux * (WINDOW_X - 40), 20 + uy * (TANK_H - 40)];
  return {
    t: 0,
    cL: n / 10,
    cR: 0,
    flux: 0,
    tracer: [first],
    load,
    crossed: 0,
    history: [0],
    rng,
    p,
    sigma,
  };
}

function loadOf(ctx: SimCtx, params: SimParams): number {
  return Math.max(0, num(ctx.probe, num(params.a0, 5)));
}

function stepTracer(s: DiffusionTankState): { tracer: readonly TracerPoint[]; rng: number } {
  const last = s.tracer[s.tracer.length - 1] ?? [WINDOW_X / 2, TANK_H / 2];
  const [gx, r1] = gaussian(s.rng);
  const [gy, r2] = gaussian(r1);
  const [u, r3] = rngNext(r2);
  let x = last[0] + gx * s.sigma;
  const y = reflect(last[1] + gy * s.sigma, 0, TANK_H);
  const wasLeft = last[0] < WINDOW_X;
  const nowLeft = x < WINDOW_X;
  if (wasLeft !== nowLeft && u >= s.p) {
    // hit the membrane window without passing: reflect back into its own chamber
    x = wasLeft ? WINDOW_X - (x - WINDOW_X) - 0.001 : WINDOW_X + (WINDOW_X - x) + 0.001;
  }
  x = reflect(x, 0, TANK_W);
  const tracer = [...s.tracer, [x, y] as TracerPoint].slice(-TRACER_POINTS);
  return { tracer, rng: r3 };
}

export const diffusionTank: SimSpec<SimParams, DiffusionTankState> = {
  init: (seed: number, config: SimParams, _view: unknown, ctx: SimCtx): DiffusionTankState => {
    const params = config ?? {};
    return start(seed, params, loadOf(ctx, params));
  },
  step: (s: DiffusionTankState, dt: number, ctx: SimCtx): DiffusionTankState => {
    // a probe change reloads the left chamber (resetOn probe_change does the same through init)
    const load = typeof ctx.probe === "number" && Number.isFinite(ctx.probe) ? Math.max(0, ctx.probe) : s.load;
    const base = Math.abs(load - s.load) > 1e-9 ? start(s.rng, { p: s.p, sigma: s.sigma }, load) : s;
    const h = Math.max(0, dt);
    const k = fluxCoefficient(base.p);
    // exact solution of dΔC/dt = −(2k/10)·ΔC over h (particles leave one chamber and enter the other; C = N/10)
    const mean = (base.cL + base.cR) / 2;
    const d0 = base.cL - base.cR;
    const d1 = d0 * Math.exp((-2 * k * h) / 10);
    const cL = mean + d1 / 2;
    const cR = mean - d1 / 2;
    const crossed = base.crossed + (base.cL - cL) * 10; // particles moved L→R during this step
    const history = [...base.history, crossed].slice(-(WINDOW_STEPS + 1));
    const span = (history.length - 1) * FIXED_DT;
    const flux = span > 0 ? (crossed - (history[0] ?? crossed)) / Math.max(span, FIXED_DT) : 0;
    const { tracer, rng } = stepTracer(base);
    return { ...base, t: base.t + h, cL, cR, crossed, history, flux, tracer, rng };
  },
  fixedDt: FIXED_DT,
  resetOn: ["open", "probe_change"],
  readout: (s: DiffusionTankState) => ({ cL: s.cL, cR: s.cR, flux: s.flux, load: s.load }),
};
