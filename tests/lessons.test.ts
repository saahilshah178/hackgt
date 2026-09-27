import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cellKnowledgeMap } from "../fixtures/cell-transport.knowledge-map";
import { trigKnowledgeMap } from "../fixtures/trig.knowledge-map";
import { GameSpec } from "../src/contracts/gamespec";
import { tutorSchema } from "../src/contracts/slices";
import { buildLessons, pickTeacher } from "../src/pipeline/lessons";
import { checkTutor } from "../src/pipeline/validate/checks";

/*
 * Every game teaches: one lesson per concept, grounded in the upload (facts with page and quote, formula, the
 * classic mistake and its fix), voiced by the helper character, with the Tutor agent's explanation and worked
 * example layered on in live mode.
 */

const cast = [
  { id: "villain", role: "the rival who hoards the keys" },
  { id: "sage", role: "a patient mentor who explains things" },
];

describe("buildLessons", () => {
  it("builds one grounded lesson per concept, in map order, voiced by the helper", () => {
    const lessons = buildLessons(trigKnowledgeMap, cast);
    expect(lessons.map((l) => l.conceptId)).toEqual(trigKnowledgeMap.concepts.map((c) => c.id));
    for (const l of lessons) {
      const c = trigKnowledgeMap.concepts.find((x) => x.id === l.conceptId)!;
      expect(l.bigIdea).toBe(c.summary);
      expect(l.teacherId).toBe("sage");
      expect(l.keyPoints.length).toBeGreaterThan(0);
      expect(l.keyPoints.length).toBeLessThanOrEqual(3);
      if (c.facts.length > 0) expect(l.keyPoints[0]).toEqual({ text: c.facts[0].statement, page: c.facts[0].sourceRef?.page ?? null, quote: c.facts[0].sourceRef?.quote ?? null });
      expect(l.watchOut).toEqual(c.misconceptions[0] ? { mistake: c.misconceptions[0].belief, fix: c.misconceptions[0].correction } : null);
      expect(l.formula).toEqual(c.formulas[0] ? { label: c.formulas[0].label, expression: c.formulas[0].mathjs } : null);
      expect(l.explanation).toBeNull();
      expect(l.example).toBeNull();
    }
  });

  it("layers the Tutor's explanation and example on top", () => {
    const [first] = trigKnowledgeMap.concepts;
    const lessons = buildLessons(trigKnowledgeMap, cast, {
      lessons: [{ conceptId: first.id, explanation: "  A radian measures an angle by arc length.  ", example: "Half a turn is π radians." }],
    });
    expect(lessons[0].explanation).toBe("A radian measures an angle by arc length.");
    expect(lessons[0].example).toBe("Half a turn is π radians.");
    expect(lessons[1].explanation).toBeNull();
  });

  it("falls back to the first character, and to the objective when a concept has no facts", () => {
    expect(pickTeacher([{ id: "a", role: "a grumpy troll" }])).toBe("a");
    expect(pickTeacher([])).toBeNull();
    const km = { ...cellKnowledgeMap, concepts: cellKnowledgeMap.concepts.map((c, i) => (i === 0 ? { ...c, facts: [] } : c)) };
    const [l] = buildLessons(km, []);
    expect(l.keyPoints).toEqual([{ text: km.concepts[0].learningObjective, page: null, quote: null }]);
    expect(l.teacherId).toBeNull();
  });
});

describe("the Tutor agent's slice", () => {
  const ids = trigKnowledgeMap.concepts.map((c) => c.id);
  const good = { lessons: ids.map((conceptId) => ({ conceptId, explanation: "A clear explanation of the idea in plain words.", example: "A short worked case." })) };

  it("accepts one good lesson per concept and names every problem otherwise", () => {
    expect(tutorSchema(ids).safeParse(good).success).toBe(true);
    expect(checkTutor(good, ids)).toEqual([]);
    const bad = { lessons: [{ ...good.lessons[0], explanation: "short" }, good.lessons[0]] };
    const problems = checkTutor(bad, ids);
    expect(problems.some((p) => p.includes("too short"))).toBe(true);
    expect(problems.some((p) => p.includes("no repeats"))).toBe(true);
    expect(problems.some((p) => p.includes(ids[1]))).toBe(true);
  });
});

describe("shipped fixtures", () => {
  it("every fixture game teaches every one of its concepts", () => {
    for (const f of readdirSync("fixtures").filter((x) => x.endsWith(".json"))) {
      const spec = GameSpec.parse(JSON.parse(readFileSync(`fixtures/${f}`, "utf8")));
      expect(spec.lessons?.map((l) => l.conceptId), f).toEqual(spec.concepts.map((c) => c.id));
      for (const l of spec.lessons ?? []) if (l.teacherId) expect(spec.characters.map((c) => c.id), f).toContain(l.teacherId);
    }
  });
});
