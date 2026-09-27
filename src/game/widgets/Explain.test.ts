import { describe, expect, it } from "vitest";
import { getMode } from "../../mechanics/registry";
import { COVERAGE_PARAMS } from "./coverage-params";
import { Explain, explainToInput, explanationStats, insertAtCursor, isSubmitShortcut, meterChecks, structureLevel, supports } from "./Explain";
import { Fallback } from "./Fallback";
import { widgetFor } from "./registry";

const view = { listener: "an apprentice", question: "Why?", ideaCount: 3, required: 2, wordBank: ["osmosis"], maxChars: 1200 };

describe("Explain.supports", () => {
  it("accepts the teach_back view and rejects other shapes", () => {
    expect(supports(view)).toBe(true);
    expect(supports({ ...view, maxChars: undefined })).toBe(true);
    expect(supports({ before: "a", after: "b", bank: [] })).toBe(false);
    expect(supports({ ...view, wordBank: "osmosis" })).toBe(false);
    expect(supports(null)).toBe(false);
    expect(supports("x")).toBe(false);
  });

  it("widgetFor mounts Explain for the mode's real view, Fallback otherwise", () => {
    const mode = getMode("explainer", "teach_back")!;
    const v = mode.present(mode.paramsSchema.parse(COVERAGE_PARAMS["explainer.teach_back"]), 1);
    expect(widgetFor("explain", v)).toBe(Explain);
    expect(widgetFor("explain", { nope: true })).toBe(Fallback);
  });
});

describe("Explain.explainToInput", () => {
  it("wraps the text as { text } and caps it at the grader's limit", () => {
    expect(explainToInput("hello")).toEqual({ text: "hello" });
    expect(explainToInput("x".repeat(1300)).text).toHaveLength(1200);
    expect(explainToInput("abcdef", 3)).toEqual({ text: "abc" });
  });

  it("the converted input grades through the mode (solution passes, empty is a gentle miss)", () => {
    const mode = getMode("explainer", "teach_back")!;
    const p = mode.paramsSchema.parse(COVERAGE_PARAMS["explainer.teach_back"]);
    const solution = mode.solutionInput(p, mode.resolve(p)) as { text: string };
    expect(mode.grade(p, explainToInput(solution.text)).correct).toBe(true);
    expect(mode.grade(p, explainToInput("")).feedback).toMatch(/Say something first/);
  });
});

describe("Explain structure meter (effort only)", () => {
  it("counts words, sentences and distinct connectors", () => {
    expect(explanationStats("")).toEqual({ words: 0, sentences: 0, connectors: [] });
    const s = explanationStats("Water moves in because the inside is saltier. So the cell swells! Therefore it bursts");
    expect(s.words).toBe(15);
    expect(s.sentences).toBe(3);
    expect(s.connectors).toEqual(["because", "so", "therefore"]);
  });

  it("matches connectors as whole words only", () => {
    expect(explanationStats("Also some solutes, sometimes.").connectors).toEqual([]);
    expect(explanationStats("That's why it swells, which means pressure builds").connectors).toEqual(["which means", "that's why"]);
    expect(explanationStats("That’s why").connectors).toEqual(["that's why"]); // curly apostrophe
  });

  it("ignores stray punctuation when counting", () => {
    expect(explanationStats(" -- ... !!").words).toBe(0);
    expect(explanationStats(" -- ... !!").sentences).toBe(0);
  });

  it("meterChecks and structureLevel reflect the three targets", () => {
    const empty = explanationStats("");
    expect(meterChecks(empty).map((c) => c.done)).toEqual([false, false, false]);
    expect(meterChecks(empty)[2].detail).toBe("none yet");
    expect(structureLevel(empty)).toBe(0);
    const full = explanationStats("The pond water has fewer solutes than the cell does. So water moves in, because of osmosis, and it swells.");
    expect(structureLevel(full)).toBe(3);
    expect(meterChecks(explanationStats("one")).map((c) => c.detail)).toEqual(["1 word", "1 sentence", "none yet"]);
  });
});

describe("Explain.insertAtCursor", () => {
  it("inserts at the cursor with sensible spacing and returns the new cursor", () => {
    expect(insertAtCursor("", "osmosis", 0, 0)).toEqual({ text: "osmosis ", cursor: 8 });
    expect(insertAtCursor("It is", "osmosis", 5, 5)).toEqual({ text: "It is osmosis ", cursor: 14 });
    expect(insertAtCursor("It is .", "osmosis", 6, 6)).toEqual({ text: "It is osmosis.", cursor: 13 });
    expect(insertAtCursor("Water moves", "in", 5, 5)).toEqual({ text: "Water in moves", cursor: 8 });
  });
  it("replaces a selection and clamps out-of-range positions", () => {
    expect(insertAtCursor("It is salt.", "osmosis", 6, 10)).toEqual({ text: "It is osmosis.", cursor: 13 });
    expect(insertAtCursor("abc", "x", 99, 99).text).toBe("abc x ");
    expect(insertAtCursor("abc", "x", -5, -5).text).toBe("x abc");
  });
});

describe("Explain.isSubmitShortcut", () => {
  it("Ctrl/Cmd+Enter submits; plain Enter and other keys do not", () => {
    expect(isSubmitShortcut({ key: "Enter", ctrlKey: true, metaKey: false })).toBe(true);
    expect(isSubmitShortcut({ key: "Enter", ctrlKey: false, metaKey: true })).toBe(true);
    expect(isSubmitShortcut({ key: "Enter", ctrlKey: false, metaKey: false })).toBe(false);
    expect(isSubmitShortcut({ key: "a", ctrlKey: true, metaKey: false })).toBe(false);
  });
});
