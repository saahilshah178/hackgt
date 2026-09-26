import type { LanguageModel } from "ai";
import type { KnowledgeMap } from "../../contracts/knowledge";
import { preCheckSchema, type AssessmentItemSlice, type PreCheckSlice } from "../../contracts/slices";
import { checkPreCheck } from "../validate/checks";
import { runAgent } from "../llm";
import { PRECHECK_SYSTEM, precheckPrompt } from "./precheck.prompt";

/*
 * Intake-time Pre-check Writer (FAST): 3 quick MCQs on the weakest concepts, asked before the game
 * exists. See MEGAPROMPT §3 (S3) and instructions.md §9 (GET /api/sources/:id/intake).
 */

/** 3 distinct prompts, distinct options per item, and every conceptId one of the weakest concepts. */
export function checkPrecheck(slice: PreCheckSlice, weakestConceptIds: readonly string[]): string[] {
  const problems = checkPreCheck(slice);
  const allowed = new Set(weakestConceptIds);
  slice.items.forEach((item: AssessmentItemSlice, i) => {
    if (!allowed.has(item.conceptId)) {
      problems.push(`pre-check item ${i}: conceptId "${item.conceptId}" is not one of the weakest concepts`);
    }
  });
  return problems;
}

export interface RunPrecheckArgs {
  jobId: string;
  km: KnowledgeMap;
  weakestConceptIds: readonly string[];
  /** Overrides the FAST model (tests inject a mock model here). */
  model?: LanguageModel;
}

export function runPrecheck(a: RunPrecheckArgs): Promise<PreCheckSlice> {
  return runAgent({
    jobId: a.jobId,
    agent: "precheck",
    tier: "fast",
    model: a.model,
    schema: preCheckSchema(a.weakestConceptIds),
    system: PRECHECK_SYSTEM,
    prompt: precheckPrompt(a.km, a.weakestConceptIds),
    check: (s) => checkPrecheck(s, a.weakestConceptIds),
    maxRepairs: 1,
  });
}
