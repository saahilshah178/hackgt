import { z } from "zod";
import { Id } from "./common";

export const TelemetryEvent = z.object({
  gameId: z.string().min(1),
  encounterId: Id,
  conceptIds: z.array(Id),
  teachingMechanicId: Id,
  attempt: z.number().int().min(1),
  correct: z.boolean(),
  hintsUsed: z.number().int().min(0),
  /** ms since the encounter opened */
  ms: z.number().int().min(0),
  at: z.iso.datetime(),
});
export type TelemetryEvent = z.infer<typeof TelemetryEvent>;

/** Mastery meter rule (LIBRARY §8): first try without hints +0.15, later correct +0.08, each miss −0.05, clamped 0–1. */
export const MasteryConfig = z.object({
  initial: z.number().min(0).max(1),
  firstTryBonus: z.number().min(0).max(1),
  laterBonus: z.number().min(0).max(1),
  missPenalty: z.number().min(0).max(1),
});
export type MasteryConfig = z.infer<typeof MasteryConfig>;
export const DEFAULT_MASTERY: MasteryConfig = { initial: 0.5, firstTryBonus: 0.15, laterBonus: 0.08, missPenalty: 0.05 };

export const ConceptMastery = z.object({
  score: z.number().min(0).max(1),
  attempts: z.number().int().min(0),
  firstTryCorrect: z.number().int().min(0),
});
export type ConceptMastery = z.infer<typeof ConceptMastery>;

export const MasteryState = z.record(z.string(), ConceptMastery);
export type MasteryState = z.infer<typeof MasteryState>;

export function emptyMastery(conceptIds: readonly string[], cfg: MasteryConfig = DEFAULT_MASTERY): MasteryState {
  return Object.fromEntries(conceptIds.map((id) => [id, { score: cfg.initial, attempts: 0, firstTryCorrect: 0 }]));
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, Math.round(x * 1000) / 1000));

/** Pure: returns a new state with the event applied to every concept the encounter covers. */
export function updateMastery(state: MasteryState, event: TelemetryEvent, cfg: MasteryConfig = DEFAULT_MASTERY): MasteryState {
  const next: MasteryState = { ...state };
  for (const id of event.conceptIds) {
    const cur = next[id] ?? { score: cfg.initial, attempts: 0, firstTryCorrect: 0 };
    const firstTryClean = event.correct && event.attempt === 1 && event.hintsUsed === 0;
    const delta = !event.correct ? -cfg.missPenalty : firstTryClean ? cfg.firstTryBonus : cfg.laterBonus;
    next[id] = {
      score: clamp01(cur.score + delta),
      attempts: cur.attempts + 1,
      firstTryCorrect: cur.firstTryCorrect + (firstTryClean ? 1 : 0),
    };
  }
  return next;
}
