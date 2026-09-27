import type { ReactNode } from "react";
import type { GameSpec } from "../../contracts/gamespec";
import type { MasteryState } from "../../contracts/telemetry";
import type { Palette } from "../engine/palettes";
import type { Current } from "../runner/encounter-runner";
import type { Progression } from "../runner/progression";

/**
 * The contract between GenreClient (src/game/genre/GenreClient.tsx) and a board host: the genres whose progression is
 * NOT a left-to-right strip of rooms (mystery, puzzle, strategy, explorer, story; BOARD_GENRES in
 * src/library/genres.ts). GenreClient owns the free-order EncounterRunner, grading, hints, telemetry and the end
 * screen; a host owns the perspective, the progression verb (routing power, walking a maze, combining clues, running
 * days, choosing story branches) and where the challenge panel sits.
 *
 * Hosts are pure React/DOM/SVG (no Phaser): 2D, keyboard-usable, projector-legible, and identical in headless e2e.
 */

export interface LastResult {
  encounterId: string;
  correct: boolean;
  /** increments on every graded submit, so hosts can key one-shot animations on it */
  seq: number;
}

export interface BoardHostProps {
  spec: GameSpec;
  palette: Palette;
  /** the braided unlock graph (tracks, tiers, requires) derived from the spec */
  progression: Progression;
  /** encounter ids solved so far */
  solved: ReadonlySet<string>;
  /** unsolved encounters whose requirements are met, in spec order: what the player may open now */
  available: readonly string[];
  /** the encounter whose challenge panel is open, or null */
  activeId: string | null;
  lastResult: LastResult | null;
  /** every encounter solved; the host shows its finale and calls complete() */
  finished: boolean;
  mastery: MasteryState;
  /** open an available encounter's challenge (ignored for locked or solved ids) */
  open(encounterId: string): void;
  /** close the open challenge without answering */
  close(): void;
  /**
   * The challenge UI for `activeId` (prompt, speaker lines, widget, hints, inline result), or null. The host decides
   * where it sits: a side panel next to the board, a desk in the scene, a card in the story text.
   */
  challenge: ReactNode;
  /** the host's finale is done: show the end screen */
  complete(): void;
  /** prompt, beats, card and view of any encounter (for tooltips, labels, clue text); null for unknown ids */
  peek(encounterId: string): Current | null;
  /** attempts so far on an encounter (0 = untouched); hosts use it for "first try" flourishes */
  attemptsOn(encounterId: string): number;
}

/** Imperative hooks GenreClient calls on the host (all optional). */
export interface BoardHostHandle {
  /** debug skipTo / autoSolve moved the game to this encounter: jump the camera or avatar there */
  warpTo?(encounterId: string | null): void;
}

/** A character's display name, falling back to the id. */
export function speakerName(spec: GameSpec, speakerId: string): string {
  return spec.characters.find((c) => c.id === speakerId)?.name ?? speakerId;
}

/** Deterministic PRNG for host layouts (mulberry32). Hosts never use Math.random, so a spec always looks the same. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
