import { z } from "zod";
import { Domain, GenreOrAuto, Id, Importance, KnowledgeType, SourceRef } from "./common";

/*
 * STORED knowledge documents (curriculum output, intake). These use string lengths, records and
 * literals freely; the LLM-facing curriculum slice lives in slices.ts and is strict-mode legal.
 */

export const Formula = z.object({
  label: z.string(),
  /** mathjs expression, e.g. "2 * pi / abs(b)" */
  mathjs: z.string(),
  variables: z.array(z.object({ name: z.string(), unit: z.string(), min: z.number(), max: z.number() })),
});
export type Formula = z.infer<typeof Formula>;

export const Fact = z.object({ statement: z.string().min(1), sourceRef: SourceRef.nullable() });
export type Fact = z.infer<typeof Fact>;

export const Misconception = z.object({ belief: z.string().min(1), correction: z.string().min(1) });
export type Misconception = z.infer<typeof Misconception>;

export const Concept = z.object({
  id: Id,
  unitId: Id,
  name: z.string().min(1),
  summary: z.string().min(1),
  knowledgeType: KnowledgeType,
  learningObjective: z.string().min(1),
  importance: Importance,
  difficulty: z.number().int().min(1).max(3),
  prerequisites: z.array(Id),
  keywords: z.array(z.string()),
  facts: z.array(Fact),
  misconceptions: z.array(Misconception),
  formulas: z.array(Formula),
});
export type Concept = z.infer<typeof Concept>;

export const OutlineEntry = z.object({
  title: z.string().min(1),
  pageStart: z.number().int().min(1),
  pageEnd: z.number().int().min(1),
});
export type OutlineEntry = z.infer<typeof OutlineEntry>;

export const Unit = z.object({ id: Id, name: z.string().min(1), conceptIds: z.array(Id) });
export type Unit = z.infer<typeof Unit>;

export const KnowledgeMap = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1),
  subject: z.object({ domain: Domain, topic: z.string().min(1) }),
  level: z.string().min(1),
  /** true for topic-only games built from general knowledge (no PDF); shown as a label in the UI */
  unsourced: z.boolean(),
  outline: z.array(OutlineEntry),
  units: z.array(Unit).min(1),
  concepts: z.array(Concept).min(1),
});
export type KnowledgeMap = z.infer<typeof KnowledgeMap>;

/** A multiple-choice item with choices already shuffled by code. */
export const Mcq = z.object({
  conceptId: Id,
  prompt: z.string().min(1),
  choices: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
});
export type Mcq = z.infer<typeof Mcq>;

export const IntakeGoal = z.enum(["learn", "review", "test"]);
export type IntakeGoal = z.infer<typeof IntakeGoal>;
export const INTAKE_MINUTES = [5, 10, 15] as const;
export const IntakeMinutes = z.union([z.literal(5), z.literal(10), z.literal(15)]);
export type IntakeMinutes = z.infer<typeof IntakeMinutes>;

/** What a game is for; shown on the intake's clarify step and passed to the Director. */
export const LEARNER_PURPOSES = ["exam", "homework", "class", "curiosity"] as const;
export const LearnerPurpose = z.enum(LEARNER_PURPOSES);
export type LearnerPurpose = z.infer<typeof LearnerPurpose>;

/** Interest chips on the clarify step; the student may also type their own (free text, same list). */
export const INTEREST_SUGGESTIONS = ["space", "sports", "music", "cooking", "animals", "mysteries", "fantasy", "ocean", "robots", "history"] as const;

/**
 * What the intake's clarify step learned about the student, beyond confidence and the pre-check.
 * Stored with the intake; code turns it into concept weights, targeted misconceptions and extra
 * library cards (src/pipeline/personalize.ts), and the Director reads it as theme and context.
 */
export const LearnerProfile = z.object({
  /**
   * Per probed concept: the listed misconception beliefs the student ticked as true (copied exactly
   * from the concept), and whether they said they were not sure. A concept appears only when one of
   * the two flags it.
   */
  struggles: z.array(z.object({ conceptId: Id, beliefs: z.array(z.string().min(1)).max(6), unsure: z.boolean() })).max(60),
  /** Themes the student likes, chips or typed; used to theme the game. */
  interests: z.array(z.string().trim().min(1).max(40)).max(6),
  purpose: LearnerPurpose.nullable(),
  /** Free text: "exam on Friday", "I always mix up sine and cosine graphs". */
  note: z.string().max(400),
});
export type LearnerProfile = z.infer<typeof LearnerProfile>;

/** Concept ids the profile flags (a ticked misconception or "not sure"). */
export function struggledConceptIds(profile: LearnerProfile | undefined): Set<string> {
  return new Set((profile?.struggles ?? []).filter((s) => s.unsure || s.beliefs.length > 0).map((s) => s.conceptId));
}

/** What the intake screen collects. Not LLM-authored, so records are fine here. */
export const Intake = z.object({
  goal: IntakeGoal,
  minutes: IntakeMinutes,
  genre: GenreOrAuto,
  /** unitId -> 1 (lost) … 5 (solid) */
  confidence: z.record(z.string(), z.number().int().min(1).max(5)),
  preCheck: z.object({
    items: z.array(Mcq).length(3),
    /** chosen choice index per item; may be shorter than items while the student is still answering */
    /** Index of the chosen option per item; -1 = "not sure" (skipped), which never scores as correct. */
    answers: z.array(z.number().int().min(-1).max(3)).max(3),
  }),
  /**
   * The concepts the student ticked on the intake page. Absent (or empty) = everything in the map.
   * A long upload (a whole textbook) yields far more concepts than one game holds; the job runs on
   * this subset (see selectConcepts) and the pre-check is written for it too.
   */
  conceptIds: z.array(Id).optional(),
  /** The clarify step's answers (what trips the student up, interests, purpose, note). Absent = none given. */
  profile: LearnerProfile.optional(),
});
export type Intake = z.infer<typeof Intake>;

/**
 * The knowledge map restricted to `conceptIds`: units that end up empty are dropped, prerequisites
 * that point outside the selection are dropped, and an empty (or all-unknown) selection means the
 * whole map.
 */
export function selectConcepts(km: KnowledgeMap, conceptIds: readonly string[] | undefined): KnowledgeMap {
  const keep = new Set(conceptIds ?? []);
  if (keep.size === 0) return km;
  const concepts = km.concepts.filter((c) => keep.has(c.id)).map((c) => ({ ...c, prerequisites: c.prerequisites.filter((p) => keep.has(p)) }));
  if (concepts.length === 0) return km;
  const used = new Set(concepts.map((c) => c.unitId));
  const units = km.units.filter((u) => used.has(u.id)).map((u) => ({ ...u, conceptIds: u.conceptIds.filter((id) => keep.has(id)) }));
  return { ...km, units, concepts };
}

/**
 * Director weight for a concept (LIBRARY §8): core concepts count double, low confidence counts more.
 * A concept the clarify step flagged (a misconception ticked as true, or "not sure") counts as one
 * confidence step weaker than its unit (floor 1).
 */
export function conceptWeight(
  concept: Pick<Concept, "importance" | "unitId"> & { id?: string },
  intake: Pick<Intake, "confidence" | "profile">,
): number {
  const unitConfidence = intake.confidence[concept.unitId] ?? 3;
  const flagged = concept.id !== undefined && struggledConceptIds(intake.profile).has(concept.id);
  const confidence = flagged ? Math.max(1, unitConfidence - 1) : unitConfidence;
  return (concept.importance === "core" ? 2 : 1) * (6 - confidence);
}
