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

const PROMPT_VARIANTS = [
  (name: string) => `Which statement about ${name} is correct?`,
  (name: string) => `Which of these is true of ${name}?`,
  (name: string) => `Pick the accurate statement about ${name}.`,
];

/**
 * Code-only fallback for the Pre-check Writer: three items on the weakest concepts, built from their
 * misconceptions and facts, never calling a model. Used when the agent fails its checks; in mock
 * mode the canned reply is about the sample's own concepts, so any other selection lands here.
 * Mirrors deriveAssessmentFromPreCheck (generate.ts) for the post-check.
 */
export function derivePreCheck(km: KnowledgeMap, weakestConceptIds: readonly string[]): PreCheckSlice {
  const pool = weakestConceptIds.length > 0 ? [...weakestConceptIds] : km.concepts.slice(0, 3).map((c) => c.id);
  const byId = new Map(km.concepts.map((c) => [c.id, c]));
  const items: AssessmentItemSlice[] = [];
  for (let i = 0; i < 3; i++) {
    const conceptId = pool[i % pool.length];
    const concept = byId.get(conceptId);
    const variant = Math.floor(i / pool.length);
    const name = concept?.name ?? conceptId;
    const candidates = [
      concept?.misconceptions[variant]?.correction,
      concept?.facts[variant]?.statement,
      concept?.misconceptions[0]?.correction,
      concept?.facts[0]?.statement,
      concept?.summary,
      concept?.learningObjective,
      `${name} is part of ${km.subject.topic}.`,
    ].filter((s): s is string => typeof s === "string" && s.trim().length > 0);
    const usedCorrect = new Set(items.filter((it) => it.conceptId === conceptId).map((it) => it.correct));
    const correct = candidates.find((s) => !usedCorrect.has(s)) ?? candidates[0];

    const others = km.concepts.filter((c) => c.id !== conceptId);
    const pool2 = [
      ...(concept?.misconceptions ?? []).map((m) => m.belief),
      ...others.flatMap((c) => c.misconceptions.map((m) => m.belief)),
      ...others.flatMap((c) => c.facts.map((f) => f.statement)),
      ...others.map((c) => c.summary),
      `${name} is not covered in these notes.`,
      `${name} has no effect on anything else in ${km.subject.topic}.`,
      `There is no way to check a claim about ${name}.`,
    ];
    const seen = new Set<string>([correct]);
    const distractors: string[] = [];
    for (const s of pool2) {
      if (distractors.length === 3) break;
      if (!s || seen.has(s)) continue;
      seen.add(s);
      distractors.push(s);
    }
    while (distractors.length < 3) distractors.push(`Option ${distractors.length + 1} does not apply to ${name}.`);
    items.push({ conceptId, prompt: PROMPT_VARIANTS[variant % PROMPT_VARIANTS.length](name), correct, distractors });
  }
  return { items };
}
