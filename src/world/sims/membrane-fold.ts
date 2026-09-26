/**
 * membrane-fold — the endocytosis stage physics (docs/design/20 §4.2, §7.4; cell §5.10 "Stage physics"). KB1.
 *
 * Not time-stepped: each stage transforms the membrane state, and the player's own order is played through it
 * (cumulatively; empty slots are skipped by the caller). Only the solution order touch → fold → pinch → carry reaches
 * `detached && travel === 1`; a decoy stage (`dissolve_bounce`) presses into the heads and springs back (`bounced`).
 *
 * Units are normalized (the prefab maps them to world units): depth 1 = the full 1.3 H pit, wrap 1 = 360° of
 * membrane around the cargo, neck 0 = open … 1 = fully constricted (pinched off), travel 0 … 1 = the 4 H rail ride.
 *
 * | stage              | requires       | met                                              | not met (the visible trap)                   |
 * |--------------------|----------------|--------------------------------------------------|----------------------------------------------|
 * | touch              | —              | touched (receptors light; the sub settles)       | —                                            |
 * | fold               | touched        | depth 1, wrap 300°/360°, neck 0.4                | a slight dimple that relaxes: nothing changes |
 * | pinch              | wrap ≥ 270°    | neck 1, detached (the vesicle closes on the sub) | an empty micro-vesicle pinches off            |
 * | carry              | detached       | travel 1                                         | the rail lights, nothing rides it             |
 * | dissolve_bounce    | —              | bounced (the sub springs back off the heads)     | —                                            |
 */
import type { StageId } from "../contraptions/step-bridge.config";

export interface FoldState {
  depth: number; // pit depth 0..1 (1 = 1.3 H)
  wrap: number; // how far the membrane wraps the cargo 0..1 (1 = 360°)
  neck: number; // neck constriction 0..1 (1 = pinched off)
  detached: boolean;
  travel: number; // vesicle travel 0..1
  bounced: boolean;
  touched: boolean; // receptors engaged (touch ran)
  microVesicle: boolean; // an EMPTY micro-vesicle pinched off (pinch without a wrap): the trap
}

export const FOLD_START: FoldState = {
  depth: 0,
  wrap: 0,
  neck: 0,
  detached: false,
  travel: 0,
  bounced: false,
  touched: false,
  microVesicle: false,
};

/** The wrap a fold reaches (300° of 360°) and the wrap a pinch needs (270°). */
export const FOLD_WRAP = 300 / 360;
export const PINCH_MIN_WRAP = 270 / 360;
/** The solution order the stage library encodes. */
export const FOLD_ORDER: readonly StageId[] = ["touch", "fold", "pinch", "carry"];

/** One stage applied to a membrane state (pure; never mutates `state`). */
export function foldStage(state: FoldState, stage: StageId): FoldState {
  switch (stage) {
    case "touch":
      return { ...state, touched: true };
    case "fold":
      return state.touched && !state.detached ? { ...state, depth: 1, wrap: FOLD_WRAP, neck: 0.4 } : { ...state };
    case "pinch":
      return state.wrap >= PINCH_MIN_WRAP && !state.detached
        ? { ...state, neck: 1, detached: true }
        : { ...state, microVesicle: true };
    case "carry":
      return state.detached ? { ...state, travel: 1 } : { ...state };
    case "dissolve_bounce":
      return { ...state, bounced: true };
  }
}

/** The cumulative states after each stage of an order: result[i] = after stages[0..i]. */
export function membraneFold(stages: readonly StageId[]): FoldState[] {
  const out: FoldState[] = [];
  let s = FOLD_START;
  for (const st of stages) {
    s = foldStage(s, st);
    out.push(s);
  }
  return out;
}

/** True when an order's final state is the vesicle carried in (`detached && travel === 1`). */
export function foldCarries(stages: readonly StageId[]): boolean {
  const last = membraneFold(stages).at(-1);
  return last !== undefined && last.detached && last.travel === 1;
}

const easeInOut = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

/**
 * The pose at a fractional playback k ∈ [0, states.length]: k = 0 is FOLD_START, k = i is after stage i (states[i − 1]),
 * and a fractional k blends S_⌊k⌋ → S_⌈k⌉ with ease-in-out (numbers interpolate; booleans switch at the halfway point).
 */
export function foldAt(states: readonly FoldState[], k: number): FoldState {
  const at = (i: number): FoldState => (i <= 0 ? FOLD_START : (states[Math.min(i, states.length) - 1] ?? FOLD_START));
  const kk = Math.min(states.length, Math.max(0, Number.isFinite(k) ? k : 0));
  const i0 = Math.floor(kk);
  const a = at(i0);
  const b = at(Math.min(states.length, i0 + 1));
  const u = easeInOut(kk - i0);
  const mix = (x: number, y: number): number => x + (y - x) * u;
  const pick = <T>(x: T, y: T): T => (u >= 0.5 ? y : x);
  return {
    depth: mix(a.depth, b.depth),
    wrap: mix(a.wrap, b.wrap),
    neck: mix(a.neck, b.neck),
    travel: mix(a.travel, b.travel),
    detached: pick(a.detached, b.detached),
    bounced: pick(a.bounced, b.bounced),
    touched: pick(a.touched, b.touched),
    microVesicle: pick(a.microVesicle, b.microVesicle),
  };
}
