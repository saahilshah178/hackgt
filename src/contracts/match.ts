import { z } from "zod";
import { Id } from "./common";

export const MatchPick = z.object({
  teachingMechanicId: Id,
  score: z.number(),
  reason: z.string(),
  /** the concept's misconception belief this card targets, or null */
  targetsMisconception: z.string().nullable(),
});
export type MatchPick = z.infer<typeof MatchPick>;

/** Matcher output per concept: up to 3 implemented picks plus a wishlist of good cards whose family isn't built. */
export const MatchResult = z.object({
  conceptId: Id,
  picks: z.array(MatchPick).min(1).max(3),
  wishlist: z.array(z.object({ teachingMechanicId: Id, score: z.number() })),
});
export type MatchResult = z.infer<typeof MatchResult>;
