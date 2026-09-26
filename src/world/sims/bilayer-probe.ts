/**
 * bilayer-probe — the e1 reference sim (docs/design/20 §4.2 sims table, §7.4 sims row; cell §5.1). KB1.
 *
 * A probe needle is pushed d nm into a 5 nm bilayer (heads 0–1 and 4–5, oily core 1–4). An Na⁺ ion rides the tip
 * while d ≤ 0.9 nm; past the head/tail boundary it is HELD there (it cannot enter the core) and springs back toward
 * the surface. Measurable state only (F6): tip depth, ion depth, ion held (0/1), ΔG of an ion at the tip depth, and a
 * bounce counter. Heads, tails and the hydration shell are drawn by the prefab from this readout.
 *
 * Pure, deterministic (no randomness is needed), fixed-step. `params` (SimParams) may override `boundary` (nm),
 * `gMax` (kJ/mol) and `tau` (s, the tip's easing constant).
 */
import type { SimCtx, SimParams, SimSpec } from "../types";

export interface BilayerProbeState {
  t: number;
  depth: number; // tip depth (nm), eased toward the probe
  ionHeld: number; // 1 while the tip is past the boundary and the ion is held at the head/tail boundary
  dG: number; // ΔG (kJ/mol, illustrative) of an ion at the tip depth: 40·(1 − P(d))
  ionDepth: number; // where the ion actually is (nm): never deeper than the boundary
  bounces: number; // times the tip crossed the boundary going down (each one ripples the heads)
  target: number; // the probe value the tip is easing toward (nm)
}

/** Bilayer thickness (nm): heads 0–1 and 4–5, the core 1–4. */
export const BILAYER_NM = 5;
/** The head/tail boundary where the ion is held (nm; cell §5.1: "past 0.9 nm"). */
export const ION_BOUNDARY_NM = 0.9;
/** Illustrative barrier height (kJ/mol) in the core (cell §5.1 slot 1). */
export const DG_MAX = 40;
const TIP_TAU_S = 0.11; // the controller's visible lag (§2.5.3), so the chip and the needle agree
const ION_SPRING = 0.2; // per-step spring factor back toward the target depth (cell §5.1, k = 0.2)

const logistic = (x: number): number => 1 / (1 + Math.exp(-x));
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const clampNm = (d: number): number => Math.min(BILAYER_NM, Math.max(0, d));

/** Polarity of the bilayer at depth d (nm): P(d) = σ(8·(1 − d)) + σ(8·(d − 4)); high at the heads, ~0 in the core. */
export function bilayerPolarity(d: number): number {
  return logistic(8 * (1 - d)) + logistic(8 * (d - 4));
}
/** ΔG (kJ/mol, illustrative) of moving an ion to depth d: gMax·(1 − P(d)). */
export function ionDeltaG(d: number, gMax = DG_MAX): number {
  return gMax * Math.max(0, 1 - bilayerPolarity(d));
}

function probeOf(ctx: SimCtx, fallback: number): number {
  return clampNm(num(ctx.probe, fallback));
}

export const bilayerProbe: SimSpec<SimParams, BilayerProbeState> = {
  init: (_seed: number, config: SimParams, _view: unknown, ctx: SimCtx): BilayerProbeState => {
    const p = config ?? {};
    const boundary = num(p.boundary, ION_BOUNDARY_NM);
    const d = probeOf(ctx, 0);
    const held = d > boundary;
    return {
      t: 0,
      depth: d,
      target: d,
      ionHeld: held ? 1 : 0,
      ionDepth: held ? boundary : d,
      dG: ionDeltaG(d, num(p.gMax, DG_MAX)),
      bounces: 0,
    };
  },
  step: (s: BilayerProbeState, dt: number, ctx: SimCtx): BilayerProbeState => {
    const boundary = ION_BOUNDARY_NM;
    const target = probeOf(ctx, s.target);
    const k = 1 - Math.exp(-Math.max(0, dt) / TIP_TAU_S);
    const depth = s.depth + (target - s.depth) * k;
    const held = depth > boundary;
    const crossedDown = s.depth <= boundary && held;
    // the ion follows the tip in the heads; past the boundary it is held there, springing back toward it
    const ionTarget = held ? boundary : depth;
    const ionDepth = Math.min(boundary, s.ionDepth + (ionTarget - s.ionDepth) * ION_SPRING);
    return {
      t: s.t + dt,
      depth,
      target,
      ionHeld: held ? 1 : 0,
      ionDepth,
      dG: ionDeltaG(depth),
      bounces: s.bounces + (crossedDown ? 1 : 0),
    };
  },
  fixedDt: 1 / 30,
  resetOn: ["open"],
  readout: (s: BilayerProbeState) => ({ depth: s.depth, ionHeld: s.ionHeld, dG: s.dG, ionDepth: s.ionDepth, bounces: s.bounces }),
};
