/**
 * pendulum_sync prefab shared helpers (docs/design/20 §2.5.5, §7). Owned by KA (L6) with the prefab core; skin files
 * import it read-only.
 *
 * PURE helpers (node-testable):
 *  - `freeRun`: the shield and the pendulum keep swinging while the controller plays a plan (it stops feeding poses
 *    while busy), from the last pose's clock and phases, with the success decay, kneel, lower and door progress;
 *  - `threadPoints`: the sync thread as a sagging quadratic (sag (1 − B)·60 when B < 0.3), and the snap's two recoiling
 *    halves;
 *  - `spanTileXs`: the span tiles under the door.
 * Drawing primitives are the lane's common kit (emitter_rail/shared.ts).
 */
import type { PendulumSyncConfig } from "@/world/contraptions/pendulum-sync.config";
import { pendAngleFor, shieldAngleFor, type PendulumSyncPose } from "@/world/contraptions/pendulum-sync.meta";
import { waveOf, waveValue } from "@/world/contraptions/ring-gate.meta";
import { MIN_PENDULUM_PERIOD } from "@/world/sims/pendulum-beat";
import type { XY } from "../../types";

/** W0 seam (tests/world-contract.test.ts checks every prefab shared.ts keeps it). */
export { stubBox, type StubBoxOptions } from "../_stub";
export {
  Anims,
  drawLectern,
  easeInOutSine,
  easeOutCubic,
  fillPoly,
  linear,
  mix,
  orreryColors,
  setAnchor,
  softStroke,
  waitMs,
  type OrreryColors,
} from "../emitter_rail/shared";

export const ARCHETYPE_ID = "pendulum_sync";
/** Kept for the W0 seam's callers. */
export const STUB_COLOR = 0x3e3f74;

const TWO_PI = 2 * Math.PI;

// ================================================================ free run (the world keeps its own time during plans)

export interface FreeRunStart {
  /** the last pose the controller applied */
  pose: Pick<PendulumSyncPose, "tau" | "phiP" | "T" | "touched" | "B" | "kneel" | "lower" | "door">;
}
export interface FreeRunProgress {
  /** ms since the plan began */
  ms: number;
  /** swing amplitude multiplier 1 → 0 (success decay) */
  decay: number;
  kneel: number;
  lower: number;
  door: number;
  /** thread brightness override (success: 1), else null to keep the phase-derived value */
  B: number | null;
}
/**
 * The pose fields that move while a plan plays: the shield follows the view's wave from the last pose's clock τ, the
 * pendulum its own phase at the dialled period, both scaled by the decay (success swings down in lockstep).
 */
export function freeRun(view: unknown, config: PendulumSyncConfig, start: FreeRunStart, p: FreeRunProgress): Pick<PendulumSyncPose, "shieldSpan" | "shieldAngle" | "pendAngle" | "B" | "kneel" | "lower" | "door"> {
  const w = waveOf(view);
  const dt = Math.max(0, p.ms) / 1000;
  const tau = start.pose.tau + dt;
  const span = waveValue(w, tau) * p.decay;
  const T = start.pose.T;
  const phiP = T === null || !start.pose.touched ? start.pose.phiP : start.pose.phiP + (TWO_PI * dt) / Math.max(T, MIN_PENDULUM_PERIOD);
  const phiS = Math.abs(w.b) * tau;
  const B = p.B ?? (start.pose.touched ? 0.5 * (1 + Math.cos(phiS - phiP)) : 0);
  return {
    shieldSpan: span,
    shieldAngle: shieldAngleFor(span, config),
    pendAngle: start.pose.touched ? pendAngleFor(phiP, config) * p.decay : 0,
    B,
    kneel: p.kneel,
    lower: p.lower,
    door: p.door,
  };
}

// ================================================================ the sync thread

/** Points of the thread from `a` to `b` sagging by `sag` at its middle (a quadratic, `n` segments). */
export function threadPoints(a: XY, b: XY, sag: number, n = 24): XY[] {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 2 * sag }; // the control point: the curve's midpoint dips by sag
  const out: XY[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const m = 1 - u;
    out.push({ x: m * m * a.x + 2 * m * u * mid.x + u * u * b.x, y: m * m * a.y + 2 * m * u * mid.y + u * u * b.y });
  }
  return out;
}
/** The snapped thread's two halves: each recoils from the break point toward its own end (`recoil` 0 → 1). */
export function snappedHalves(points: readonly XY[], recoil: number): [XY[], XY[]] {
  const k = Math.max(0, Math.min(1, recoil));
  const half = Math.floor(points.length / 2);
  const keep = Math.max(1, Math.round(half * (1 - 0.8 * k)));
  const left = points.slice(0, keep + 1);
  const right = points.slice(points.length - 1 - keep);
  // the loose ends droop as they recoil (the left half's loose end is its last point, the right half's its first)
  const droop = (pts: XY[], looseAtEnd: boolean) =>
    pts.map((p, i) => {
      const u = i / Math.max(1, pts.length - 1);
      const d = looseAtEnd ? u : 1 - u;
      return { x: p.x, y: p.y + 60 * k * d * d };
    });
  return [droop(left, true), droop(right, false)];
}
/** Width and alpha of the live thread for a brightness B (trig §5.6: width 2 + 4B, alpha 0.25 + 0.75B). */
export function threadStyle(B: number, gold: number): { width: number; alpha: number } {
  const b = Math.max(0, Math.min(1, B));
  return { width: 2 + 4 * b + (8 - (2 + 4 * b)) * gold, alpha: 0.25 + 0.75 * b + (1 - (0.25 + 0.75 * b)) * gold };
}

// ================================================================ span tiles

/** The span tiles' x centres under the door (k·U for k = −half … half). */
export function spanTileXs(config: Pick<PendulumSyncConfig, "spanTiles" | "spanUnitPx">): { k: number; x: number }[] {
  const half = Math.floor(config.spanTiles / 2);
  const out: { k: number; x: number }[] = [];
  for (let k = -half; k <= half && config.spanTiles > 0; k++) out.push({ k, x: k * config.spanUnitPx });
  return out;
}
