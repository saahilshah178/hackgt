/**
 * Easing and interpolation helpers shared by metas (lerp), the ContraptionController (eased poses) and cutscenes.
 * Pure; no Phaser. The controller's visible lag is exponential smoothing with τ = 110 ms: 95 % in about 330 ms
 * (docs/design/20 §2.5.3).
 */

export const CONTROLLER_TAU_MS = 110;

export type EaseName = "linear" | "in_cubic" | "out_cubic" | "in_out_cubic" | "in_out_sine" | "out_back";

export const EASE: Readonly<Record<EaseName, (t: number) => number>> = {
  linear: (t) => t,
  in_cubic: (t) => t * t * t,
  out_cubic: (t) => 1 - Math.pow(1 - t, 3),
  in_out_cubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  in_out_sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  out_back: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

/** Eased progress in [0, 1] (input clamped). */
export function ease(name: EaseName, t: number): number {
  return EASE[name](clamp01(t));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-path angle interpolation (radians). */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

/** Discrete fields snap to `to` once t ≥ threshold (ContraptionMeta.lerp contract). */
export function snap<T>(from: T, to: T, t: number, threshold = 0.5): T {
  return t >= threshold ? to : from;
}

/** Per-frame smoothing factor 1 − e^(−dt/τ); reduced motion passes 1. */
export function smoothingFactor(dtMs: number, tauMs = CONTROLLER_TAU_MS): number {
  if (!(dtMs > 0)) return 0;
  if (!(tauMs > 0)) return 1;
  return 1 - Math.exp(-dtMs / tauMs);
}

/** Moves `from` toward `to` by one smoothing step. */
export function approach(from: number, to: number, dtMs: number, tauMs = CONTROLLER_TAU_MS): number {
  return lerp(from, to, smoothingFactor(dtMs, tauMs));
}

/**
 * Generic pose lerp for flat records: numbers interpolate, every other field (booleans, strings, arrays, objects)
 * snaps at t ≥ 0.5. Metas with nested or angular fields write their own lerp.
 */
export function lerpRecord<P extends object>(from: P, to: P, t: number): P {
  const out: Record<string, unknown> = {};
  const a = from as Record<string, unknown>;
  const b = to as Record<string, unknown>;
  for (const k of Object.keys(b)) {
    const x = a[k];
    const y = b[k];
    out[k] = typeof x === "number" && typeof y === "number" ? lerp(x, y, t) : snap(x, y, t);
  }
  return out as P;
}
