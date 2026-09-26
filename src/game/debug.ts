import type { MasteryState, TelemetryEvent } from "../contracts/telemetry";

export interface GameDebugState {
  finished: boolean;
  index: number;
  encounterId: string | null;
  mastery: MasteryState;
}

/** The shape GameClient wires up; see MEGAPROMPT P3.5. */
export interface GameDebugHandle {
  state(): GameDebugState;
  skipTo(encounterId: string): void;
  autoSolve(): void;
  events(): readonly TelemetryEvent[];
  mastery(): MasteryState;
}

/*
 * Deliberately not a `declare global` augmentation of `Window`: other e2e specs (owned by other
 * subagents) declare their own narrower shape for `window.__GAME_DEBUG__`, and TS global interface
 * merging requires every declaration to match exactly. Callers that need the type can import
 * `GameDebugHandle` and cast, as the play-smoke spec does.
 */
type DebugWindow = Window & { __GAME_DEBUG__?: GameDebugHandle };

function debugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "production") return true;
  try {
    return new URLSearchParams(window.location.search).get("debug") === "1";
  } catch {
    return false;
  }
}

/**
 * Installs window.__GAME_DEBUG__ when enabled (dev, or `?debug=1`). Works whether or not Phaser
 * booted: GameClient calls this from its own state, independent of which host is mounted.
 */
export function installGameDebug(handle: GameDebugHandle): (() => void) | void {
  if (!debugEnabled()) return;
  const w = window as DebugWindow;
  w.__GAME_DEBUG__ = handle;
  return () => {
    if (w.__GAME_DEBUG__ === handle) delete w.__GAME_DEBUG__;
  };
}
