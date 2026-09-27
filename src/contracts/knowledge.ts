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

/** Director weight for a concept (LIBRARY §8): core concepts count double, low confidence counts more. */
export function conceptWeight(concept: Pick<Concept, "importance" | "unitId">, intake: Pick<Intake, "confidence">): number {
  const confidence = intake.confidence[concept.unitId] ?? 3;
  return (concept.importance === "core" ? 2 : 1) * (6 - confidence);
}
