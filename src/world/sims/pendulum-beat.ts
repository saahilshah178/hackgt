/**
 * pendulum-beat — the Warden's sync sim STUB (W0; KA3 implements, docs/design/20 §4 row 3, §7.4 pendulum row).
 * The guardian swings at its own period T0 (from the view); the player's counter-pendulum at the dialled T; the sync
 * thread's brightness is ½(1 + cos Δφ) and it beats at |1/T0 − 1/T|. Common-start reset on open and settle.
 */
import type { PendulumSyncConfig } from "../contraptions/pendulum-sync.config";
import type { SimCtx, SimSpec } from "../types";

export interface PendulumBeatState {
  t: number;
  phiP: number; // the player's pendulum phase (radians)
  phiS: number; // the shield (guardian) phase (radians)
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

/** STUB: phases stay at the common start; KA3 advances them with the view's period and the draft's T. */
export const pendulumBeat: SimSpec<PendulumSyncConfig, PendulumBeatState> = {
  init: (): PendulumBeatState => ({ t: 0, phiP: 0, phiS: 0, B: 1, beatHz: 0 }),
  step: (s: PendulumBeatState, dt: number, ctx: SimCtx): PendulumBeatState => {
    void ctx;
    return { ...s, t: s.t + dt, B: syncBrightness(s.phiP - s.phiS) };
  },
  fixedDt: 1 / 30,
  resetOn: ["open", "settle"],
  readout: (s: PendulumBeatState) => ({ phiP: s.phiP, phiS: s.phiS, B: s.B, beatHz: s.beatHz }),
};
