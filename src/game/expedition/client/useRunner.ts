"use client";
/**
 * src/game/expedition/client/useRunner.ts (H2) — the EncounterRunner in React (docs/design/20 §2.1, §3.4).
 *
 * The runner is a plain, non-reactive class: it lives in state (stable identity, created once) and every mutation is
 * followed by `sync()`, which takes an immutable snapshot React renders from (runner-snapshot.ts). The view is
 * memoized per encounter index (D5).
 */
import { useCallback, useState } from "react";
import type { GameSpec } from "../../../contracts/gamespec";
import { EncounterRunner } from "../../runner/encounter-runner";
import { takeSnapshot, type RunnerSnapshot } from "./runner-snapshot";

export type { RunnerSnapshot } from "./runner-snapshot";

export interface UseRunner {
  runner: EncounterRunner;
  snap: RunnerSnapshot;
  /** re-read the runner after a mutation (submit, hint, skipTo, autoSolve); returns the new snapshot */
  sync(): RunnerSnapshot;
}

export function useRunner(spec: GameSpec): UseRunner {
  const [runner] = useState(() => new EncounterRunner(spec));
  const [views] = useState(() => new Map<number, unknown>());
  const [snap, setSnap] = useState<RunnerSnapshot>(() => takeSnapshot(runner, views));
  const sync = useCallback(() => {
    const next = takeSnapshot(runner, views);
    setSnap(next);
    return next;
  }, [runner, views]);
  return { runner, snap, sync };
}
