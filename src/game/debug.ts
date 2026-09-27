import type { MasteryState, TelemetryEvent } from "../contracts/telemetry";
import type { PhaseKind } from "./expedition/client/machine";
import type { ExpeditionHostDebug } from "./hosts/types";

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
  /** Present only while an Expedition world plays (docs/design/20 §2.10); legacy specs never see it. */
  expedition?: ExpeditionDebugApi;
  /** Present only on the board genres (GenreClient, free-order runner). */
  board?: BoardDebugApi;
}

/** `__GAME_DEBUG__.board`: the free-order runner behind the board hosts (src/game/genre). */
export interface BoardDebugApi {
  /** unlocked, unsolved encounter ids */
  available(): string[];
  solved(): string[];
  /** the encounter whose challenge is open, or null */
  active(): string | null;
  /** open an available encounter's challenge, as the host would */
  open(encounterId: string): void;
}

/**
 * `__GAME_DEBUG__.expedition` (docs/design/20 §2.10). The client (ExpeditionClient) installs every field; the host
 * (hosts/expedition/debug-api.ts) merges its own `host`/`walkTo`/`useLink`/`interact`/`freeze`/`skipCutscene` and a
 * few host-only probes over them once Phaser (or the DOM host) is ready.
 */
export interface ExpeditionDebugApi {
  host(): ExpeditionHostDebug | null;
  phase(): PhaseKind;
  dialogue(): { speakerId: string; text: string; typing: boolean } | null;
  worldState(): { flags: string[]; collected: string[]; touched: string[] };
  /** same as pressing E */
  interact(): void;
  /** drives the controller (not a teleport) until x or a blocker */
  walkTo(x: number, surface?: string): Promise<void>;
  /** runs a traversal link as a key press would */
  useLink(id: string): Promise<void>;
  /** warp to the current station and open its panel */
  openPanel(): void;
  /** sets the open control to mode.solutionInput(...) THROUGH the control API */
  applySolutionDraft(): void;
  /** moves the probe scrubber (or a scalar station's input) through its control API */
  setProbe(value: number): void;
  /** same as pressing (i) */
  hint(): void;
  openSandbox(id: string): void;
  express(on: boolean): void;
  skipCutscene(): void;
  /** pause tweens/typewriter/particles/clocks for deterministic screenshots */
  freeze(on: boolean): void;
  /** the client's half of freeze (the typewriter); the host's installer chains it into `freeze` */
  freezeClient?(on: boolean): void;
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
