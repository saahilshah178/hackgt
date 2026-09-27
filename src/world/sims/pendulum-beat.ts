/**
 * pendulum-beat — the Warden's sync sim (docs/design/20 §4 row 3, §4.2 "Sims and ghost registry", §7.4 pendulum row;
 * trig §5.6 "Live binding"). KA3.
 *
 * The guardian's shield swings at its own period T₀ = 2π/|b| (from the view); the player's counter-pendulum swings at
 * the dialled period T (ask "period": T = value; ask "frequency": T = 1/value). The pendulum phase is INTEGRATED,
 * φp += 2π·dt / max(T, 0.25), so dragging the scrubber never makes the pendulum jump; the shield phase is φs = |b|·t.
 * The sync thread's brightness is B = ½(1 + cos Δ) with Δ = φs − φp, and it beats at |1/T₀ − 1/T| Hz.
 *
 * Common-start reset (trig §5.6): on panel open and on each settle the controller re-initialises the sim (resetOn), so
 * t, φs and φp restart at 0 together and drift is always measured from a shared start; a new value that arrives already
 * settled restarts them inside `step`. `t0` records the station clock at the common start so a pose can extrapolate
 * both phases while the sim is idle (panel closed). Measurable state only (F6); the sim is deterministic (the seed is
 * kept for the registry's signature and for replay parity).
 */
import type { PendulumSyncConfig } from "../contraptions/pendulum-sync.config";
import type { Draft, SimCtx, SimSpec } from "../types";

const TWO_PI = 2 * Math.PI;
/** Below this period the pendulum only shivers in place (trig §5.6). */
export const MIN_PENDULUM_PERIOD = 0.25;

export interface PendulumBeatState {
  seed: number;
  t: number; // seconds since the common start
  t0: number; // the station clock (SimCtx.t) at the common start: poses extrapolate from it while the sim is idle
  phiP: number; // the player's pendulum phase (radians, integrated)
  phiS: number; // the shield (guardian) phase |b|·t (radians)
  omegaS: number; // the shield's angular rate |b| (rad/s), read from the view at init
  ask: "period" | "frequency";
  T: number | null; // the dialled pendulum period (s) at the last step; null before a draft
  B: number; // sync brightness 0..1
  beatHz: number;
}

/** Sync-thread brightness for a phase difference Δφ: ½(1 + cos Δφ). */
export function syncBrightness(deltaPhase: number): number {
  return 0.5 * (1 + Math.cos(deltaPhase));
}
/** Beat frequency between the guardian period t0 and the dialled period t (seconds): |1/t0 − 1/t|. */
export function beatHz(t0: number, t: number): number {
  if (!(t0 > 0) || !(t > 0)) return 0;
  return Math.abs(1 / t0 - 1 / t);
}
/** Wraps an angle into (−π, π]. */
export function wrapPhase(a: number): number {
  let r = (((a + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI - Math.PI;
  if (r <= -Math.PI) r += TWO_PI;
  return Object.is(r, -0) ? 0 : r;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The shield's angular rate |b| from an oscillator view (b = 1 when the view is missing or malformed). */
export function shieldOmegaOf(view: unknown): number {
  const b = isObj(view) && typeof view.b === "number" && Number.isFinite(view.b) && view.b !== 0 ? view.b : 1;
  return Math.abs(b);
}
/** The dialled value of a draft ({ value }), or null. */
export function draftValueOf(draft: Draft | null | undefined): number | null {
  const v = (draft?.input as { value?: unknown } | null | undefined)?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
/** The pendulum period implied by a dialled value: ask period → value; ask frequency → 1/value (null when ≤ 0). */
export function pendulumPeriodOf(value: number | null, ask: "period" | "frequency"): number | null {
  if (value === null) return null;
  if (ask === "frequency") return value > 0 ? 1 / value : null;
  return value;
}

function askOf(view: unknown): "period" | "frequency" {
  return isObj(view) && view.ask === "frequency" ? "frequency" : "period";
}

export const pendulumBeat: SimSpec<PendulumSyncConfig, PendulumBeatState> = {
  init(seed: number, _config: PendulumSyncConfig, view: unknown, ctx: SimCtx): PendulumBeatState {
    const ask = askOf(view);
    const omegaS = shieldOmegaOf(view);
    const T = pendulumPeriodOf(draftValueOf(ctx.draft), ask);
    return { seed, t: 0, t0: ctx.t, phiP: 0, phiS: 0, omegaS, ask, T, B: 1, beatHz: T === null ? 0 : beatHz(TWO_PI / omegaS, Math.max(T, MIN_PENDULUM_PERIOD)) };
  },
  step(prev: PendulumBeatState, dt: number, ctx: SimCtx): PendulumBeatState {
    const T = pendulumPeriodOf(draftValueOf(ctx.draft), prev.ask);
    // a NEW value arriving already settled (a click on the ruler, a typed value) is a common start too; the controller
    // re-inits on the settle edge after a drag or a key run, which keeps the value it was dragged to
    const restart = !!ctx.draft?.settled && T !== null && prev.T !== null && T !== prev.T;
    const s: PendulumBeatState = restart ? { ...prev, t: 0, t0: ctx.t - dt, phiP: 0, phiS: 0 } : prev;
    const t = s.t + dt;
    const phiP = T === null ? s.phiP : s.phiP + (TWO_PI * dt) / Math.max(T, MIN_PENDULUM_PERIOD);
    const phiS = s.omegaS * t;
    return {
      ...s,
      t,
      phiP,
      phiS,
      T,
      B: syncBrightness(phiS - phiP),
      beatHz: T === null ? 0 : beatHz(TWO_PI / s.omegaS, Math.max(T, MIN_PENDULUM_PERIOD)),
    };
  },
  fixedDt: 1 / 30,
  resetOn: ["open", "settle"],
  readout: (s: PendulumBeatState) => ({ t: s.t, phiP: s.phiP, phiS: s.phiS, B: s.B, beatHz: s.beatHz, T0: TWO_PI / s.omegaS }),
};
