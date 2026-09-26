/**
 * membrane-fold — the endocytosis stage physics STUB (W0; KB1 implements, docs/design/20 §4.2, §7.4 step-bridge row).
 * Not time-stepped: each stage transforms the membrane state; the player's own order is played through it. Only the
 * solution order may reach `detached && travel === 1`; a decoy stage (`dissolve_bounce`) bounces.
 */
import type { StageId } from "../contraptions/step-bridge.config";

export interface FoldState {
  depth: number; // pit depth 0..1
  wrap: number; // how far the membrane wraps the cargo 0..1
  neck: number; // neck constriction 0..1
  detached: boolean;
  travel: number; // vesicle travel 0..1
  bounced: boolean;
}

export const FOLD_START: FoldState = { depth: 0, wrap: 0, neck: 0, detached: false, travel: 0, bounced: false };

/** One stage applied to a membrane state. STUB: returns the state unchanged (KB1 writes the stage table). */
export function foldStage(state: FoldState, stage: StageId): FoldState {
  void stage;
  return { ...state };
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
