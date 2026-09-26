import { describe, expect, it } from "vitest";
import { cloze } from "../src/mechanics/families/recall/cloze";
import { levenshtein, matchesAny, normalizeAnswer } from "../src/mechanics/families/recall/fuzzy";
import { rapid } from "../src/mechanics/families/recall/rapid";

describe("fuzzy matching", () => {
  it("normalizes case, spacing and punctuation and allows small typos on longer answers", () => {
    expect(normalizeAnswer("  Mitochondria! ")).toBe("mitochondria");
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(matchesAny("mitocondria", ["mitochondria"])).toBe(true); // 1 edit, long word
    expect(matchesAny("cat", ["cot"])).toBe(false); // short words must be exact
    expect(matchesAny("the cell membrane", ["cell membrane"])).toBe(false);
    expect(matchesAny("", ["x"])).toBe(false);
  });
});

describe("recall.rapid (rune_recall)", () => {
  const p = {
    items: [
      { prompt: "el perro", answers: ["dog", "the dog"], hint: "an animal that barks" },
      { prompt: "la casa", answers: ["house", "the house", "home"], hint: "where you live" },
      { prompt: "el libro", answers: ["book", "the book"], hint: "you read it" },
    ],
    secondsPerItem: 8,
    direction: "Spanish → English",
  };
  it("accepts any accepted spelling and reports the first missed item's hint", () => {
    expect(rapid.check(p)).toEqual([]);
    const s = rapid.resolve(p);
    expect(rapid.grade(p, rapid.solutionInput(p, s)).correct).toBe(true);
    expect(rapid.grade(p, { answers: [{ itemIndex: 0, text: "the DOG" }, { itemIndex: 1, text: "home" }, { itemIndex: 2, text: "bok" }] }).feedback).toMatch(/1 of 3 still missing.*you read it/);
    expect(rapid.grade(p, { answers: [] }).correct).toBe(false);
  });
  it("shuffles the first pass and rejects hints that leak", () => {
    const v = rapid.present(p, 4);
    expect([...v.order].sort()).toEqual([0, 1, 2]);
    expect(rapid.check({ ...p, items: [{ ...p.items[0], hint: "a dog" }, p.items[1], p.items[2]] }).join(" ")).toMatch(/contains the answer/);
    expect(rapid.check({ ...p, items: [p.items[0], p.items[0], p.items[2]] }).join(" ")).toMatch(/distinct/);
  });
  it("blind solver answers in prompt order", () => {
    const v = rapid.present(p, 1);
    const input = rapid.blind!.toInput(p, v, { answers: ["dog", "house", "book"] });
    expect(rapid.grade(p, input).correct).toBe(true);
  });
});

describe("recall.cloze", () => {
  const p = {
    sentence: "Water moves toward the side with the higher ___ concentration.",
    answers: ["solute", "salt"],
    wordBank: ["water", "protein"],
    hint: "The dissolved stuff, not the liquid.",
  };
  it("fills the blank with fuzzy matching and shuffles the word bank", () => {
    expect(cloze.check(p)).toEqual([]);
    expect(cloze.grade(p, { text: "Solute" }).correct).toBe(true);
    expect(cloze.grade(p, { text: "solutes" }).correct).toBe(true);
    expect(cloze.grade(p, { text: "water" }).feedback).toMatch(/dissolved stuff/);
    const v = cloze.present(p, 2);
    expect(v.before).toBe("Water moves toward the side with the higher");
    expect(v.after).toBe("concentration.");
    expect([...v.bank].sort()).toEqual(["protein", "solute", "water"]);
    expect(cloze.present({ ...p, wordBank: [] }, 2).bank).toEqual([]);
  });
  it("rejects a missing blank, a leaking hint, or an answer in the word bank", () => {
    expect(cloze.check({ ...p, sentence: "no blank here" }).join(" ")).toMatch(/exactly one/);
    expect(cloze.check({ ...p, hint: "it is the solute" }).join(" ")).toMatch(/contains the answer/);
    expect(cloze.check({ ...p, wordBank: ["salt"] }).join(" ")).toMatch(/accepted answer/);
  });

  it("resolve returns the canonical (first-listed) answer", () => {
    expect(cloze.resolve(p)).toEqual({ answer: "solute" });
    expect(cloze.grade(p, cloze.solutionInput(p, cloze.resolve(p))).correct).toBe(true);
  });
});
