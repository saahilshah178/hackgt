import { describe, expect, it } from "vitest";
import { checkGatekeeper } from "../src/pipeline/agents/gatekeeper";
import { checkCurriculum, curriculumToKnowledgeMap } from "../src/pipeline/agents/curriculum";
import { checkMatcher } from "../src/pipeline/agents/matcher";
import { checkPrecheck } from "../src/pipeline/agents/precheck";
import type { CurriculumSlice, GatekeeperSlice, MatcherSlice, PreCheckSlice } from "../src/contracts/slices";

function validGatekeeper(): GatekeeperSlice {
  return {
    educational: true,
    estimatedConcepts: 4,
    tooBig: false,
    tooSmall: false,
    outline: [
      { title: "Intro", pageStart: 1, pageEnd: 1 },
      { title: "Body", pageStart: 2, pageEnd: 3 },
    ],
    followUps: [],
  };
}

describe("checkGatekeeper", () => {
  it("passes a valid outline", () => {
    expect(checkGatekeeper(validGatekeeper(), { pageCount: 3 })).toEqual([]);
  });

  it("flags pageEnd < pageStart", () => {
    const g = validGatekeeper();
    g.outline[0] = { title: "Bad", pageStart: 3, pageEnd: 1 };
    expect(checkGatekeeper(g, { pageCount: 3 }).some((p) => p.includes("pageEnd"))).toBe(true);
  });

  it("flags a page beyond the source's page count", () => {
    const g = validGatekeeper();
    g.outline.push({ title: "Overflow", pageStart: 4, pageEnd: 10 });
    const problems = checkGatekeeper(g, { pageCount: 3 });
    expect(problems.some((p) => p.includes("beyond"))).toBe(true);
  });

  it("flags outline out of ascending page order", () => {
    const g: GatekeeperSlice = {
      ...validGatekeeper(),
      outline: [
        { title: "Second", pageStart: 3, pageEnd: 3 },
        { title: "First", pageStart: 1, pageEnd: 1 },
      ],
    };
    expect(checkGatekeeper(g, { pageCount: 3 }).some((p) => p.includes("ascending"))).toBe(true);
  });
});

function validCurriculum(): CurriculumSlice {
  return {
    title: "Sample chapter",
    domain: "biology",
    topic: "Sample topic",
    level: "High school",
    outline: [{ title: "Intro", pageStart: 1, pageEnd: 4 }],
    units: [
      { id: "u_one", name: "Unit one" },
      { id: "u_two", name: "Unit two" },
    ],
    concepts: [
      {
        id: "c_a",
        unitId: "u_one",
        name: "Concept A",
        summary: "Summary A",
        knowledgeType: "fact",
        learningObjective: "The student can state A.",
        importance: "core",
        difficulty: 1,
        prerequisites: [],
        keywords: ["a"],
        facts: [{ statement: "A is true.", sourceRef: { page: 1, quote: "A is true." } }],
        misconceptions: [{ belief: "A is false.", correction: "A is true." }],
        formulas: [],
      },
      {
        id: "c_b",
        unitId: "u_two",
        name: "Concept B",
        summary: "Summary B",
        knowledgeType: "fact",
        learningObjective: "The student can state B.",
        importance: "supporting",
        difficulty: 2,
        prerequisites: ["c_a"],
        keywords: ["b"],
        facts: [{ statement: "B is true.", sourceRef: { page: 2, quote: "B is true." } }],
        misconceptions: [],
        formulas: [],
      },
    ],
  };
}

describe("checkCurriculum", () => {
  it("passes valid units/concepts", () => {
    expect(checkCurriculum(validCurriculum(), { pageCount: 2, unsourced: false })).toEqual([]);
  });

  it("flags a concept referencing an unknown unit", () => {
    const c = validCurriculum();
    c.concepts[0].unitId = "u_missing";
    const problems = checkCurriculum(c, { pageCount: 2, unsourced: false });
    expect(problems.some((p) => p.includes("unknown unit"))).toBe(true);
  });

  it("flags a unit with no concepts", () => {
    const c = validCurriculum();
    c.units.push({ id: "u_empty", name: "Empty unit" });
    const problems = checkCurriculum(c, { pageCount: 2, unsourced: false });
    expect(problems.some((p) => p.includes('"u_empty" has no concepts'))).toBe(true);
  });

  it("flags an unknown prerequisite", () => {
    const c = validCurriculum();
    c.concepts[1].prerequisites = ["c_nope"];
    const problems = checkCurriculum(c, { pageCount: 2, unsourced: false });
    expect(problems.some((p) => p.includes("unknown prerequisite"))).toBe(true);
  });

  it("flags a core concept with no misconceptions", () => {
    const c = validCurriculum();
    c.concepts[0].misconceptions = [];
    const problems = checkCurriculum(c, { pageCount: 2, unsourced: false });
    expect(problems.some((p) => p.includes("needs at least one misconception"))).toBe(true);
  });

  it("flags a duplicate concept id", () => {
    const c = validCurriculum();
    c.concepts[1].id = "c_a";
    const problems = checkCurriculum(c, { pageCount: 2, unsourced: false });
    expect(problems.some((p) => p.includes("concept ids must be unique"))).toBe(true);
  });

  it("flags a fact page beyond the source's page count (sourced only)", () => {
    const c = validCurriculum();
    c.concepts[0].facts[0] = { statement: "A is true.", sourceRef: { page: 99, quote: "A is true." } };
    const problems = checkCurriculum(c, { pageCount: 2, unsourced: false });
    expect(problems.some((p) => p.includes("beyond the source's"))).toBe(true);
  });

  it("skips page-count checks for unsourced topics", () => {
    const c = validCurriculum();
    c.concepts[0].facts[0] = { statement: "A is true.", sourceRef: { page: 99, quote: "A is true." } };
    expect(checkCurriculum(c, { pageCount: 2, unsourced: true })).toEqual([]);
  });

  it("emits a soft (prefixed) warning for too few units/concepts on chapter-sized material", () => {
    const c = validCurriculum();
    const problems = checkCurriculum(c, { pageCount: 10, unsourced: false });
    expect(problems.some((p) => p.startsWith("soft:") && p.includes("4-8 units"))).toBe(true);
    expect(problems.some((p) => p.startsWith("soft:") && p.includes("8-25 concepts"))).toBe(true);
  });

  it("does not emit the soft warning for short (<= 3 page) material", () => {
    const c = validCurriculum();
    const problems = checkCurriculum(c, { pageCount: 3, unsourced: false });
    expect(problems.some((p) => p.startsWith("soft:"))).toBe(false);
  });
});

describe("curriculumToKnowledgeMap", () => {
  it("gives every unit its concepts and forces sourceRef null when unsourced", () => {
    const km = curriculumToKnowledgeMap(validCurriculum(), "src_x", false);
    expect(km.units.find((u) => u.id === "u_one")?.conceptIds).toEqual(["c_a"]);
    expect(km.concepts[0].facts[0].sourceRef).toEqual({ page: 1, quote: "A is true." });

    const unsourcedKm = curriculumToKnowledgeMap(validCurriculum(), "src_y", true);
    expect(unsourcedKm.unsourced).toBe(true);
    expect(unsourcedKm.concepts[0].facts[0].sourceRef).toBeNull();
  });
});

describe("checkMatcher", () => {
  const ids = ["card_a", "card_b", "card_c"];

  it("passes distinct picks from the shortlist", () => {
    const slice: MatcherSlice = {
      picks: [
        { teachingMechanicId: "card_a", reason: "r1", targetsMisconception: null },
        { teachingMechanicId: "card_b", reason: "r2", targetsMisconception: null },
      ],
    };
    expect(checkMatcher(slice, ids)).toEqual([]);
  });

  it("flags a repeated card", () => {
    const slice: MatcherSlice = {
      picks: [
        { teachingMechanicId: "card_a", reason: "r1", targetsMisconception: null },
        { teachingMechanicId: "card_a", reason: "r2", targetsMisconception: null },
      ],
    };
    expect(checkMatcher(slice, ids).some((p) => p.includes("repeat"))).toBe(true);
  });

  it("flags a pick not in the shortlist", () => {
    const slice: MatcherSlice = { picks: [{ teachingMechanicId: "card_z", reason: "r1", targetsMisconception: null }] };
    expect(checkMatcher(slice, ids).some((p) => p.includes("not in the shortlist"))).toBe(true);
  });
});

describe("checkPrecheck", () => {
  const weakest = ["c_a", "c_b", "c_c"];

  function validSlice(): PreCheckSlice {
    return {
      items: [
        { conceptId: "c_a", prompt: "Question A?", correct: "Right A", distractors: ["Wrong A1", "Wrong A2", "Wrong A3"] },
        { conceptId: "c_b", prompt: "Question B?", correct: "Right B", distractors: ["Wrong B1", "Wrong B2", "Wrong B3"] },
        { conceptId: "c_c", prompt: "Question C?", correct: "Right C", distractors: ["Wrong C1", "Wrong C2", "Wrong C3"] },
      ],
    };
  }

  it("passes 3 distinct items on the weakest concepts", () => {
    expect(checkPrecheck(validSlice(), weakest)).toEqual([]);
  });

  it("flags a conceptId outside the weakest list", () => {
    const slice = validSlice();
    slice.items[0].conceptId = "c_other";
    expect(checkPrecheck(slice, weakest).some((p) => p.includes("not one of the weakest"))).toBe(true);
  });

  it("flags duplicate options within an item", () => {
    const slice = validSlice();
    slice.items[0].distractors[0] = slice.items[0].correct;
    expect(checkPrecheck(slice, weakest).length).toBeGreaterThan(0);
  });

  it("flags duplicate prompts across items", () => {
    const slice = validSlice();
    slice.items[1].prompt = slice.items[0].prompt;
    expect(checkPrecheck(slice, weakest).some((p) => p.includes("distinct"))).toBe(true);
  });
});
