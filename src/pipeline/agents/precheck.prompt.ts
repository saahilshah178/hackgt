import type { KnowledgeMap } from "../../contracts/knowledge";
import { withStyleGuides } from "../style-guides";

/*
 * System prompt + user prompt builder for the intake-time Pre-check Writer (FAST). Unlike the
 * post-check writer in src/pipeline/prompts.ts (which runs during generation and knows the
 * student's chosen genre/minutes), this one runs at intake time, before any of that is known: it
 * only has the KnowledgeMap and the weakest concepts. The mock dispatcher (src/pipeline/mock/models.ts)
 * recognizes this agent by the exact opening words below.
 */

export const PRECHECK_SYSTEM = withStyleGuides(`You are the Pre-check Writer. Write 3 quick multiple-choice items that measure the learner's weakest concepts before they play.

Rules:
- One item per listed concept, in the order given.
- One unambiguous correct answer; three distractors drawn from that concept's listed misconceptions where possible.
- Short prompts a student can answer in about 20 seconds each, in plain, everyday words.
- The 3 prompts must be distinct from each other, and every item's 4 options (the correct answer plus its 3 distractors) must all differ.`);

export function precheckPrompt(km: KnowledgeMap, weakestConceptIds: readonly string[]): string {
  const concepts = km.concepts
    .filter((c) => weakestConceptIds.includes(c.id))
    .map((c) => ({ id: c.id, name: c.name, summary: c.summary, misconceptions: c.misconceptions.map((m) => m.belief) }));
  return [
    `# Source: ${km.title} (${km.subject.domain} / ${km.subject.topic}, ${km.level})`,
    "# Weakest concepts",
    JSON.stringify(concepts, null, 1),
    "# Task",
    `Write 3 pre-check items, one for each concept id in order: ${weakestConceptIds.join(", ")}.`,
  ].join("\n\n");
}
