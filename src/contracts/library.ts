import { z } from "zod";
import { Domain, FamilyId, Genre, Id, KnowledgeType } from "./common";

/**
 * One teaching-mechanic card (LIBRARY §10). Cards are data: a concept-specific configuration of one
 * family mode, plus the misconception it breaks. All cards are visible to the LLM as design knowledge;
 * only cards whose family·mode is implemented are offered to the Director.
 */
export const TeachingMechanic = z.object({
  id: Id,
  name: z.string().min(1),
  domain: Domain,
  topic: z.string().min(1),
  concept: z.string().min(1),
  family: FamilyId,
  mode: z.string().min(1),
  playerAction: z.string().min(1),
  /** the false belief the encounter forces the player to abandon */
  misconception: z.string().min(1),
  /** one-sentence correction, shown in the debrief */
  learningInsight: z.string().min(1),
  knowledgeTypes: z.array(KnowledgeType).min(1),
  /** concept words + common synonyms, lowercase */
  keywords: z.array(z.string()).min(1),
  flagship: z.boolean(),
  /** params the card fixes; merged over the challenge writer's output and enforced by code */
  lockedParams: z.record(z.string(), z.unknown()).optional(),
  authoringNotes: z.string().optional(),
  genreNotes: z.partialRecord(Genre, z.string()).optional(),
});
export type TeachingMechanic = z.infer<typeof TeachingMechanic>;
