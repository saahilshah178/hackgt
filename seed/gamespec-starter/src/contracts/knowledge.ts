import { z } from "zod";
import { Genre, Id, KnowledgeType, SourceRef } from "./common";

/** Output of the curriculum agent (upstream of game generation). Stored, then summarized into prompts. */
export const Concept = z.object({
  id: Id,
  name: z.string().min(1),
  summary: z.string().min(1),
  knowledgeType: KnowledgeType,
  difficulty: z.number().int().min(1).max(3),
  prerequisites: z.array(Id),
  facts: z.array(z.object({ statement: z.string().min(1), sourceRef: SourceRef.nullable() })),
  misconceptions: z.array(z.object({ belief: z.string().min(1), correction: z.string().min(1) })),
  formulas: z.array(
    z.object({
      label: z.string(),
      mathjs: z.string(),
      variables: z.array(z.object({ name: z.string(), unit: z.string(), min: z.number(), max: z.number() })),
    }),
  ),
});
export type Concept = z.infer<typeof Concept>;

export const KnowledgeMap = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1),
  subject: z.string().min(1),
  level: z.string().min(1),
  unsourced: z.boolean(),
  concepts: z.array(Concept).min(1),
});
export type KnowledgeMap = z.infer<typeof KnowledgeMap>;

/** What the intake screen collects. Not LLM-authored, so records are fine here. */
export const Intake = z.object({
  goal: z.enum(["exam", "understand", "curious"]),
  minutes: z.number().int().min(3).max(30),
  genre: Genre,
  confidence: z.record(z.string(), z.number().int().min(1).max(5)),
});
export type Intake = z.infer<typeof Intake>;
