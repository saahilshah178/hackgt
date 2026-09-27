import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { GameSpec } from "../src/contracts/gamespec";
import {
  conceptsToTeach,
  fallbackLesson,
  guideEntries,
  lessonFrame,
  lessonMap,
  monogram,
  prettyFormula,
  sentenceCase,
  teacherFor,
  watchOutFor,
} from "../src/game/genre/teach/lessons";

/*
 * The teaching layer of the board genres (src/game/genre/teach): lesson lookup with a fallback for specs made before
 * lessons, which concepts an encounter still has to teach, the teacher, the watch-out after a mistake, the formula
 * prettifier and the per-genre framing.
 */

const load = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8")) as GameSpec;

describe("prettyFormula", () => {
  it("rewrites mathjs text into reader notation", () => {
    expect(prettyFormula("2 * pi / abs(b)")).toBe("2 · π / |b|");
    expect(prettyFormula("d * pi / 180")).toBe("d · π / 180");
    expect(prettyFormula("sqrt(x^2 + y^2)")).toBe("√(x² + y²)");
    expect(prettyFormula("x^(-1)")).toBe("x⁻¹");
    expect(prettyFormula("a*b-c")).toBe("a · b-c");
    expect(prettyFormula("a - b")).toBe("a − b");
    expect(prettyFormula("sin(theta) <= 1")).toBe("sin(θ) ≤ 1");
  });

  it("handles nested calls and leaves unknown syntax alone", () => {
    expect(prettyFormula("abs(sqrt(abs(x)))")).toBe("|√(|x|)|");
    expect(prettyFormula("x^2.5")).toBe("x^2.5");
    expect(prettyFormula("abs(x")).toBe("abs(x");
    expect(prettyFormula("  pipe + pi  ")).toBe("pipe + π");
  });
});

describe("lesson lookup", () => {
  it("uses the spec's lessons and falls back to name + objective for concepts without one", () => {
    const spec = load("trig-puzzle");
    const first = spec.concepts[0];
    const without = { ...spec, lessons: spec.lessons!.filter((l) => l.conceptId !== first.id) };
    const map = lessonMap(without);
    expect(map.size).toBe(spec.concepts.length);
    expect(map.get(first.id)).toEqual(fallbackLesson(first));
    expect(map.get(first.id)!.bigIdea).toBe(first.learningObjective);
    const other = spec.concepts[1];
    expect(map.get(other.id)).toEqual(spec.lessons!.find((l) => l.conceptId === other.id));
  });

  it("works for specs with no lessons at all, in spec order", () => {
    const spec = load("civil-rights-story");
    const bare = { ...spec, lessons: undefined };
    const entries = guideEntries(bare);
    expect(entries.map((e) => e.concept.id)).toEqual(spec.concepts.map((c) => c.id));
    for (const e of entries) {
      expect(e.lesson.keyPoints).toEqual([]);
      expect(e.lesson.formula).toBeNull();
      expect(e.lesson.watchOut).toBeNull();
    }
  });
});

describe("conceptsToTeach", () => {
  const spec = { concepts: [{ id: "a" }, { id: "b" }, { id: "c" }] } as unknown as Pick<GameSpec, "concepts">;
  it("returns the encounter's untaught, known concepts in order, once each", () => {
    expect(conceptsToTeach({ conceptIds: ["b", "a", "b"] }, new Set(), spec)).toEqual(["b", "a"]);
    expect(conceptsToTeach({ conceptIds: ["b", "a"] }, new Set(["a"]), spec)).toEqual(["b"]);
    expect(conceptsToTeach({ conceptIds: ["a", "zz"] }, new Set(["a"]), spec)).toEqual([]);
  });

  it("teaches each concept of a real game exactly once along the spec order", () => {
    const game = load("cell-transport-cozy");
    const taught = new Set<string>();
    const lessons: string[] = [];
    for (const e of game.encounters) {
      const due = conceptsToTeach(e, taught, game);
      for (const c of due) taught.add(c);
      lessons.push(...due);
    }
    expect(new Set(lessons).size).toBe(lessons.length);
    expect(new Set(lessons)).toEqual(new Set(game.encounters.flatMap((e) => e.conceptIds)));
  });
});

describe("teacher and watch-out", () => {
  it("finds the teacher by id and falls back to the first character", () => {
    const spec = load("civil-rights-explorer");
    expect(teacherFor(spec, { teacherId: spec.characters[1].id })?.id).toBe(spec.characters[1].id);
    expect(teacherFor(spec, { teacherId: "nobody" })?.id).toBe(spec.characters[0].id);
    expect(teacherFor(spec, { teacherId: null })?.id).toBe(spec.characters[0].id);
    expect(teacherFor({ characters: [] }, { teacherId: null })).toBeNull();
  });

  it("prefers the watch-out matching the encounter's target misconception", () => {
    const base = fallbackLesson({ id: "a", unitId: "u", name: "A", knowledgeType: "fact", learningObjective: "Know A." } as GameSpec["concepts"][number]);
    const lessons = new Map([
      ["a", { ...base, conceptId: "a", watchOut: { mistake: "Mistake A.", fix: "Fix A." } }],
      ["b", { ...base, conceptId: "b", watchOut: { mistake: "Mistake B", fix: "Fix B." } }],
      ["c", { ...base, conceptId: "c" }],
    ]);
    expect(watchOutFor({ conceptIds: ["a", "b"], targetMisconception: "mistake b." }, lessons)).toEqual({ conceptId: "b", mistake: "Mistake B", fix: "Fix B." });
    expect(watchOutFor({ conceptIds: ["c", "a"], targetMisconception: null }, lessons)?.conceptId).toBe("a");
    expect(watchOutFor({ conceptIds: ["c"], targetMisconception: "x" }, lessons)).toBeNull();
  });

  it("finds the fixture's watch-out for its own target misconception", () => {
    const spec = load("trig-puzzle");
    const e = spec.encounters.find((x) => x.targetMisconception)!;
    const w = watchOutFor(e, lessonMap(spec));
    expect(w).not.toBeNull();
    expect(e.conceptIds).toContain(w!.conceptId);
  });
});

describe("framing", () => {
  it("frames the lesson natively per board genre, deterministically", () => {
    expect(lessonFrame("explorer", "c1").look).toBe("sign");
    expect(lessonFrame("strategy", "c1").look).toBe("note");
    expect(lessonFrame("mystery", "c1").look).toBe("casefile");
    expect(lessonFrame("story", "c1").look).toBe("letter");
    expect(lessonFrame("puzzle", "c1").look).toBe("briefing");
    expect(lessonFrame("story", "c_x").kicker).toBe(lessonFrame("story", "c_x").kicker);
    expect(lessonFrame("mystery", "c1").byline("Ida", null)).toContain("Ida");
    const kickers = new Set(["c_a", "c_b", "c_c", "c_d", "c_e", "c_f"].map((k) => lessonFrame("explorer", k).kicker));
    expect(kickers.size).toBeGreaterThan(1);
  });

  it("builds monograms and sentence case", () => {
    expect(monogram("The Editor")).toBe("E");
    expect(monogram("Mrs. Park")).toBe("P");
    expect(monogram("ida")).toBe("I");
    expect(sentenceCase("degrees to radians")).toBe("Degrees to radians");
  });
});
