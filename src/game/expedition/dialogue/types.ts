/**
 * src/game/expedition/dialogue/types.ts (W0, main) — the dialogue engine's public types (docs/design/20 §2.7).
 * S1 implements DialogueEngine in ./engine.ts (pure, node-tested) against DialogueEngineApi; React only renders it.
 * Pure: no React, no Phaser.
 */

export type DialogueKind =
  | "line" | "instruction" | "tutorial" | "insight" | "success" | "payoff" | "near_miss" | "probe"
  | "hint" | "feedback" | "taunt" | "arrival" | "ambient" | "narration" | "document";
export type Channel = "bar" | "toast";
/** Ascending: critical > instruction > story > ambient. */
export type Priority = "ambient" | "story" | "instruction" | "critical";
export const PRIORITY_ORDER: readonly Priority[] = ["ambient", "story", "instruction", "critical"];
export type DialogueMood = "neutral" | "excited" | "worried" | "solemn" | "wry";

export interface DialogueLine {
  id: string; // stable: `${source}:${index}` so replays dedupe
  speakerId: string; // spec character, cast.extras id, "player" or "narrator"
  text: string;
  kind: DialogueKind;
  mood: DialogueMood;
}
export interface SayRequest {
  lines: readonly DialogueLine[];
  channel: Channel;
  priority: Priority;
  /** blocking: host input frozen until the last line is advanced (intro, finale, arena, taunts) */
  blocking: boolean;
  /** "cutscene:intro" | "station:e2_period" | "npc:brasswick" | "trigger:s0_01" ... used by skipAll(source) and dedupe */
  source: string;
}
export interface ActiveLine {
  line: DialogueLine;
  request: SayRequest;
  startedAt: number;
  visibleChars: number;
  typing: boolean;
}
export interface PinnedLines {
  primary: { kind: DialogueKind; text: string; speakerId: string } | null;
  secondary: { kind: DialogueKind; text: string } | null;
}
export interface DialogueSnapshot {
  active: ActiveLine | null;
  /** panel-open pinned lines: line 1 (instruction or success) and line 2 (tutorial/insight/near-miss/probe/feedback) */
  pinned: PinnedLines;
  queued: number;
  blocking: boolean;
  version: number;
}
export interface DialogueEngineOptions {
  cps?: number; // 45
  now: () => number;
  minToastMs?: number; // 2500
}
export const DEFAULT_CPS = 45;
export const DEFAULT_MIN_TOAST_MS = 2500;

/** The class S1 writes (`export class DialogueEngine implements DialogueEngineApi`). */
export interface DialogueEngineApi {
  say(req: SayRequest): Promise<void>; // resolves when its last line is dismissed or skipped
  advance(): void; // typing -> complete the line; complete -> next line
  skipAll(source?: string): void; // cutscene skip, warp, autoSolve, express trim
  pin(p: Partial<PinnedLines>): void;
  clearPins(): void;
  tick(now: number): void; // updates visibleChars; auto-dismisses toasts
  snapshot(): DialogueSnapshot;
  subscribe(fn: () => void): () => void; // for useSyncExternalStore
}
// Pure helpers S1 exports from engine.ts: visibleChars(text, elapsedMs, cps) (grapheme-safe),
// toastDurationMs(text, minMs) = max(min, words / 3.3 s), preempts(incoming, current).
