import type { Character, Lesson } from "../contracts/gamespec";
import type { KnowledgeMap } from "../contracts/knowledge";
import type { TutorSlice } from "../contracts/slices";

/*
 * What a game teaches (GameSpec.lessons): one lesson per concept, built by code from the knowledge map so every
 * line is grounded in the upload (the summary, verified facts with their page and quote, the formula, the first
 * misconception with its correction). In live mode the Tutor agent adds a plain-words explanation and a worked
 * example; without it (mock mode, or the tutor failed) the lesson is still complete enough to learn from.
 */

const MAX_KEY_POINTS = 3;

/** Roles that read as the one who helps the player; the lesson's voice. */
const TEACHER_ROLE = /help|guide|mentor|partner|teach|tutor|friend|companion|coach|assist|professor|librarian|keeper/i;

export function pickTeacher(characters: readonly Pick<Character, "id" | "role">[]): string | null {
  return (characters.find((c) => TEACHER_ROLE.test(c.role)) ?? characters[0])?.id ?? null;
}

export function buildLessons(km: KnowledgeMap, characters: readonly Pick<Character, "id" | "role">[], tutor?: TutorSlice | null): Lesson[] {
  const teacherId = pickTeacher(characters);
  const byConcept = new Map((tutor?.lessons ?? []).map((l) => [l.conceptId, l]));
  return km.concepts.map((c) => {
    const t = byConcept.get(c.id);
    const facts = c.facts.slice(0, MAX_KEY_POINTS).map((f) => ({ text: f.statement, page: f.sourceRef?.page ?? null, quote: f.sourceRef?.quote ?? null }));
    const keyPoints = facts.length > 0 ? facts : [{ text: c.learningObjective, page: null, quote: null }];
    const f = c.formulas[0];
    const m = c.misconceptions[0];
    return {
      conceptId: c.id,
      bigIdea: c.summary,
      explanation: t?.explanation.trim() || null,
      keyPoints,
      formula: f ? { label: f.label, expression: f.mathjs } : null,
      example: t?.example.trim() || null,
      watchOut: m ? { mistake: m.belief, fix: m.correction } : null,
      teacherId,
    };
  });
}
