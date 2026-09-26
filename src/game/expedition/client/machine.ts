/**
 * src/game/expedition/client/machine.ts (H2, pure) — the Expedition phase machine (docs/design/20 §2.9).
 *
 *   loading → intro → explore ⇄ panel | sandbox | cutscene → resolving → payoff → … → finale → finished
 *
 * A pure reducer: every transition is data, so the client never has to reason about "what may happen now" in
 * callbacks. It fixes the legacy runtime's defects (docs/design/00-runtime-map.md):
 *   - D1: VERIFIED captures the encounter id that was graded, so the payoff and its `after` lines belong to the
 *     cleared encounter even though the runner has already advanced.
 *   - D2: when the boss is cleared, PAYOFF_DONE goes to `finale` (the climactic cutscene) instead of straight to
 *     the end screen.
 *   - D3: DEBUG_SYNC (skipTo / autoSolve) jumps any phase to `explore` or `finished`; world state is always derived
 *     from runner progress, never from animations.
 *   - D9: the panel has a real back (BACK) that closes it without grading.
 * Express mode is a client policy on top of this reducer (express.ts), not a phase.
 *
 * Unknown or out-of-phase events return the SAME phase object (reference-equal), so React's useReducer bails out.
 * Relative imports only; no React, no Phaser.
 */

export type CutscenePurpose = "zone" | "exit" | "ride" | "arena" | "trigger";

export type Phase =
  | { kind: "loading" }
  | { kind: "intro"; cutsceneId: string }
  | { kind: "explore" }
  | { kind: "cutscene"; cutsceneId: string; purpose: CutscenePurpose }
  | { kind: "panel"; encounterId: string }
  | { kind: "resolving"; encounterId: string; correct: boolean } // world success/fail animation playing
  | { kind: "payoff"; encounterId: string } // badge + success line, panel slides out, carry cutscene
  | { kind: "sandbox"; sandboxId: string }
  | { kind: "finale"; cutsceneId: string; clearedId: string }
  | { kind: "finished" };

export type PhaseKind = Phase["kind"];

export type MachineEvent =
  | { type: "ASSETS_READY"; introId: string | null }
  | { type: "CUTSCENE_START"; cutsceneId: string; purpose: CutscenePurpose }
  /** `cutsceneId` (optional) guards against a stale completion ending a newer cutscene */
  | { type: "CUTSCENE_DONE"; cutsceneId?: string }
  | { type: "INTERACT_STATION"; encounterId: string; isCurrent: boolean }
  | { type: "INTERACT_SANDBOX"; sandboxId: string }
  /** back tab / Esc: close the panel or sandbox without grading */
  | { type: "BACK" }
  /** after runner.submit (the cleared id is captured here: D1) */
  | { type: "VERIFIED"; encounterId: string; correct: boolean }
  | { type: "RESOLVE_DONE" }
  /** `finaleId` null: the world has no finale cutscene, so a cleared boss goes straight to `finished` */
  | { type: "PAYOFF_DONE"; runnerFinished: boolean; finaleId: string | null }
  /** skipTo / autoSolve */
  | { type: "DEBUG_SYNC"; runnerFinished: boolean };

export const INITIAL_PHASE: Phase = { kind: "loading" };

const EXPLORE: Phase = { kind: "explore" };
const FINISHED: Phase = { kind: "finished" };

/** The phases that run a cutscene the host is playing (intro, zone/exit/ride/arena/trigger, finale). */
export function cutsceneOf(p: Phase): string | null {
  return p.kind === "intro" || p.kind === "cutscene" || p.kind === "finale" ? p.cutsceneId : null;
}

/** The encounter the panel is about (panel, resolving, payoff). */
export function encounterOf(p: Phase): string | null {
  return p.kind === "panel" || p.kind === "resolving" || p.kind === "payoff" ? p.encounterId : null;
}

/** True while the instrument panel is on screen (it stays mounted through resolving and the payoff badge). */
export function panelVisible(p: Phase): boolean {
  return p.kind === "panel" || p.kind === "resolving" || p.kind === "payoff";
}

export function reduce(phase: Phase, e: MachineEvent): Phase {
  // DEBUG_SYNC from any phase (D3): it cancels cutscenes and dialogue in the client; here it only picks the phase.
  if (e.type === "DEBUG_SYNC") {
    const next = e.runnerFinished ? FINISHED : EXPLORE;
    return phase.kind === next.kind ? phase : next;
  }
  switch (phase.kind) {
    case "loading":
      if (e.type === "ASSETS_READY") return e.introId ? { kind: "intro", cutsceneId: e.introId } : EXPLORE;
      return phase;
    case "intro":
      if (e.type === "CUTSCENE_DONE" && sameCutscene(phase.cutsceneId, e.cutsceneId)) return EXPLORE;
      return phase;
    case "explore":
      switch (e.type) {
        case "CUTSCENE_START":
          return { kind: "cutscene", cutsceneId: e.cutsceneId, purpose: e.purpose };
        case "INTERACT_STATION":
          // only the current encounter's console opens the panel; a solved one replays its lines (client), a future
          // one is unreachable behind its blocker
          return e.isCurrent ? { kind: "panel", encounterId: e.encounterId } : phase;
        case "INTERACT_SANDBOX":
          return { kind: "sandbox", sandboxId: e.sandboxId };
        default:
          return phase;
      }
    case "cutscene":
      if (e.type === "CUTSCENE_DONE" && sameCutscene(phase.cutsceneId, e.cutsceneId)) return EXPLORE;
      return phase;
    case "panel":
      if (e.type === "BACK") return EXPLORE;
      if (e.type === "VERIFIED" && e.encounterId === phase.encounterId) return { kind: "resolving", encounterId: e.encounterId, correct: e.correct };
      return phase;
    case "resolving":
      if (e.type === "RESOLVE_DONE") {
        // wrong: back to the SAME panel (the control is not remounted; the draft is kept). right: the payoff.
        return phase.correct ? { kind: "payoff", encounterId: phase.encounterId } : { kind: "panel", encounterId: phase.encounterId };
      }
      return phase;
    case "payoff":
      if (e.type === "PAYOFF_DONE") {
        if (!e.runnerFinished) return EXPLORE;
        // D2: the boss was cleared: the finale plays before the end screen
        return e.finaleId ? { kind: "finale", cutsceneId: e.finaleId, clearedId: phase.encounterId } : FINISHED;
      }
      return phase;
    case "sandbox":
      if (e.type === "BACK") return EXPLORE;
      return phase;
    case "finale":
      if (e.type === "CUTSCENE_DONE" && sameCutscene(phase.cutsceneId, e.cutsceneId)) return FINISHED;
      return phase;
    case "finished":
      return phase;
  }
}

function sameCutscene(running: string, done: string | undefined): boolean {
  return done === undefined || done === running;
}

/** The host freezes movement whenever the player is not free to explore (§2.9). */
export const hostFrozen = (p: Phase, dialogueBlocking: boolean, overlayOpen: boolean): boolean => p.kind !== "explore" || dialogueBlocking || overlayOpen;

/** Reduces a list of events (tests, replays). */
export function reduceAll(phase: Phase, events: readonly MachineEvent[]): Phase {
  return events.reduce(reduce, phase);
}
