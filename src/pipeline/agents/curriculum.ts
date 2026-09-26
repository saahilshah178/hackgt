import type { LanguageModel } from "ai";
import type { Concept, KnowledgeMap, Unit } from "../../contracts/knowledge";
import { curriculumSchema, type CurriculumSlice } from "../../contracts/slices";
import { runAgent } from "../llm";
import { CURRICULUM_SYSTEM, curriculumPrompt, type CurriculumSource } from "./curriculum.prompt";

/*
 * S2 Curriculum (SMART): turns source material into a KnowledgeMap. See MEGAPROMPT §3.
 */

const SNAKE = /^[a-z][a-z0-9_]{0,47}$/;

export interface CurriculumContext {
  /** the source's actual page count (1 for an unpaged topic) */
  pageCount: number;
  unsourced: boolean;
}

/**
 * unit/concept ids snake_case + unique; every unitId refers to a real unit; every unit has >= 1
 * concept; prerequisites refer to real concept ids; page numbers within the source's page count;
 * >= 1 misconception on core concepts; plus a SOFT (prefixed "soft:") 4-8 units / 8-25 concepts rule
 * for sources > 3 pages. Callers that use this to drive a repair loop should filter out "soft:"
 * problems first (see runCurriculum below) so genuinely short material doesn't loop forever.
 */
export function checkCurriculum(c: CurriculumSlice, ctx: CurriculumContext): string[] {
  const problems: string[] = [];

  const unitIds = c.units.map((u) => u.id);
  if (new Set(unitIds).size !== unitIds.length) problems.push("unit ids must be unique");
  unitIds.filter((id) => !SNAKE.test(id)).forEach((id) => problems.push(`unit id "${id}" must be lowercase snake_case`));

  const conceptIds = c.concepts.map((x) => x.id);
  if (new Set(conceptIds).size !== conceptIds.length) problems.push("concept ids must be unique");
  conceptIds.filter((id) => !SNAKE.test(id)).forEach((id) => problems.push(`concept id "${id}" must be lowercase snake_case`));

  const unitSet = new Set(unitIds);
  const conceptSet = new Set(conceptIds);
  const usedUnits = new Set<string>();

  c.concepts.forEach((concept) => {
    if (!unitSet.has(concept.unitId)) {
      problems.push(`concept "${concept.id}" references unknown unit "${concept.unitId}"`);
    } else {
      usedUnits.add(concept.unitId);
    }
    concept.prerequisites.forEach((p) => {
      if (!conceptSet.has(p)) problems.push(`concept "${concept.id}" lists unknown prerequisite "${p}"`);
    });
    if (concept.importance === "core" && concept.misconceptions.length === 0) {
      problems.push(`core concept "${concept.id}" needs at least one misconception`);
    }
    if (!ctx.unsourced) {
      concept.facts.forEach((f, i) => {
        if (f.sourceRef && ctx.pageCount > 0 && f.sourceRef.page > ctx.pageCount) {
          problems.push(`concept "${concept.id}" fact ${i}: page ${f.sourceRef.page} is beyond the source's ${ctx.pageCount} page(s)`);
        }
      });
    }
  });

  unitIds.filter((id) => !usedUnits.has(id)).forEach((id) => problems.push(`unit "${id}" has no concepts`));

  if (ctx.pageCount > 3) {
    if (c.units.length < 4 || c.units.length > 8) {
      problems.push(`soft: aim for 4-8 units for chapter-sized material (got ${c.units.length})`);
    }
    if (c.concepts.length < 8 || c.concepts.length > 25) {
      problems.push(`soft: aim for 8-25 concepts for chapter-sized material (got ${c.concepts.length})`);
    }
  }

  return problems;
}

/** Converts the LLM-facing slice into the stored KnowledgeMap; units gain conceptIds. */
export function curriculumToKnowledgeMap(slice: CurriculumSlice, sourceId: string, unsourced: boolean): KnowledgeMap {
  const units: Unit[] = slice.units.map((u) => ({
    id: u.id,
    name: u.name,
    conceptIds: slice.concepts.filter((c) => c.unitId === u.id).map((c) => c.id),
  }));
  const concepts: Concept[] = slice.concepts.map((c) => ({
    id: c.id,
    unitId: c.unitId,
    name: c.name,
    summary: c.summary,
    knowledgeType: c.knowledgeType,
    learningObjective: c.learningObjective,
    importance: c.importance,
    difficulty: c.difficulty,
    prerequisites: c.prerequisites,
    keywords: c.keywords,
    facts: c.facts.map((f) => ({ statement: f.statement, sourceRef: unsourced ? null : f.sourceRef })),
    misconceptions: c.misconceptions,
    formulas: c.formulas,
  }));
  return {
    sourceId,
    title: slice.title,
    subject: { domain: slice.domain, topic: slice.topic },
    level: slice.level,
    unsourced,
    outline: slice.outline,
    units,
    concepts,
  };
}

export interface RunCurriculumArgs extends CurriculumSource {
  jobId: string;
  pageCount: number;
  /** Overrides the SMART model (tests inject a mock model here). */
  model?: LanguageModel;
}

export function runCurriculum(a: RunCurriculumArgs): Promise<CurriculumSlice> {
  return runAgent({
    jobId: a.jobId,
    agent: "curriculum",
    tier: "smart",
    model: a.model,
    schema: curriculumSchema(),
    system: CURRICULUM_SYSTEM,
    prompt: curriculumPrompt({ title: a.title, pages: a.pages, unsourced: a.unsourced }),
    // the soft size rule is a nudge, not a hard requirement: don't let a short-but-legitimate
    // source loop through repairs forever trying to hit 4-8 units.
    check: (c) => checkCurriculum(c, { pageCount: a.pageCount, unsourced: a.unsourced }).filter((p) => !p.startsWith("soft:")),
    maxRepairs: 2,
  });
}
