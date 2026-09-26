import type { KnowledgeMap } from "../../contracts/knowledge";
import type { CurriculumSlice } from "../../contracts/slices";
import type { GatekeeperSlice } from "../../contracts/slices";

/*
 * Builds the gatekeeper and curriculum mock fixtures FROM a fixture KnowledgeMap, so the mocked
 * agent replies stay in lockstep with the fixture (same ids, names, facts, quotes, pages) instead of
 * being authored twice. See src/pipeline/mock/{trig,cell,history}.ts.
 */

export function gatekeeperFromKnowledgeMap(km: KnowledgeMap): GatekeeperSlice {
  return {
    educational: true,
    estimatedConcepts: km.concepts.length,
    tooBig: false,
    tooSmall: false,
    outline: km.outline,
    followUps: [],
  };
}

export function curriculumFromKnowledgeMap(km: KnowledgeMap): CurriculumSlice {
  return {
    title: km.title,
    domain: km.subject.domain,
    topic: km.subject.topic,
    level: km.level,
    outline: km.outline,
    units: km.units.map((u) => ({ id: u.id, name: u.name })),
    concepts: km.concepts.map((c) => ({
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
      facts: c.facts.map((f) => ({ statement: f.statement, sourceRef: f.sourceRef })),
      misconceptions: c.misconceptions,
      formulas: c.formulas,
    })),
  };
}
