/**
 * src/game/expedition/client/runner-snapshot.ts (H2, pure) — an immutable snapshot of the EncounterRunner for React.
 * The view is memoized PER ENCOUNTER INDEX in the cache the caller owns (fixes D5: `runner.current()` calls
 * `present()` on every call, so its view had a new identity each render and effects keyed on it re-fired per tick).
 */
import type { Encounter } from "../../../contracts/gamespec";
import type { AnyFamilyMode } from "../../../mechanics/types";
import { modeKeyOf } from "../../../world/draft-inputs";
import type { ModeKey } from "../../../world/types";
import type { EncounterRunner } from "../../runner/encounter-runner";

export interface RunnerSnapshot {
  /** the current encounter index, or null once the runner is finished */
  index: number | null;
  finished: boolean;
  encounter: Encounter | null;
  mode: AnyFamilyMode | null;
  modeKey: ModeKey | null;
  /** memoized per index: the same object for the same encounter */
  view: unknown;
  hintsUsed: number;
  /** telemetry events so far (bumps on every submit, even a wrong one) */
  submits: number;
}

export function takeSnapshot(runner: EncounterRunner, views: Map<number, unknown>): RunnerSnapshot {
  const cur = runner.finished ? null : runner.current();
  if (!cur) return { index: null, finished: true, encounter: null, mode: null, modeKey: null, view: null, hintsUsed: 0, submits: runner.telemetry().length };
  let view = views.get(cur.index);
  if (view === undefined) {
    view = cur.view;
    views.set(cur.index, view);
  }
  return {
    index: cur.index,
    finished: false,
    encounter: cur.encounter,
    mode: cur.mode,
    modeKey: modeKeyOf(cur.encounter),
    view,
    hintsUsed: runner.hintsUsedOnCurrent,
    submits: runner.telemetry().length,
  };
}
