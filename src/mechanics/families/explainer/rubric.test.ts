import { describe, expect, it } from "vitest";
import {
  MAX_EXPLANATION_CHARS,
  clauses,
  findPhrase,
  matchesAnyKeyword,
  mentionsAnyKeyword,
  normalize,
  phrasesOverlap,
  prepare,
  scoreExplanation,
  stem,
  stemPhrase,
  tokenMatches,
  tokenize,
  type Rubric,
} from "./rubric";

describe("normalize / tokenize / clauses", () => {
  it("lowercases, drops apostrophes, turns punctuation into spaces and collapses whitespace", () => {
    expect(normalize("  The Cell's   MEMBRANE!  ")).toBe("the cells membrane");
    expect(normalize("doesn’t")).toBe("doesnt");
    expect(normalize("semi-permeable")).toBe("semi permeable");
    expect(normalize("2π/b")).toBe("2π b");
  });
  it("is unicode-safe (accents and non-Latin letters survive)", () => {
    expect(normalize("Écoute: ÇA VA?")).toBe("écoute ça va");
    expect(tokenize("Ωmega φ")).toEqual(["ωmega", "φ"]);
    expect(normalize("ﬁne")).toBe("fine"); // NFKC folds the ligature
  });
  it("splits clauses at sentence and clause punctuation", () => {
    expect(clauses("Water moves in. It doesn't shrink, it swells")).toEqual([["water", "moves", "in"], ["it", "doesnt", "shrink"], ["it", "swells"]]);
    expect(clauses("")).toEqual([]);
    expect(tokenize("")).toEqual([]);
  });
});

describe("stem (conservative)", () => {
  const same = (words: string[]) => expect(new Set(words.map(stem)).size, words.join(",")).toBe(1);
  it("maps plurals, -ed, -ing, -es, -ies, -ly onto one stem", () => {
    same(["cell", "cells"]);
    same(["swell", "swells", "swelled", "swelling"]);
    same(["cause", "causes", "caused", "causing"]);
    same(["study", "studies", "studied", "studying"]);
    same(["process", "processes"]);
    same(["virus", "viruses"]);
    same(["stop", "stopped", "stopping"]);
    same(["boycott", "boycotts", "boycotted", "boycotting"]);
    same(["organize", "organized", "organizing", "organizes"]);
    same(["increase", "increases", "increased", "increasing"]);
    same(["make", "makes", "making"]);
    same(["family", "families"]);
    same(["pressure", "pressures"]);
    same(["gas", "gases"]);
    same(["need", "needs", "needed"]);
    expect(stem("quickly")).toBe("quick");
  });
  it("leaves short words, -ss / -us / -is endings and digits alone", () => {
    expect(stem("is")).toBe("is");
    expect(stem("was")).toBe("was");
    expect(stem("less")).toBe("less");
    expect(stem("this")).toBe("this");
    expect(stem("bus")).toBe("bus");
    expect(stem("analysis")).toBe("analysis");
    expect(stem("2pi")).toBe("2pi");
    expect(stem("1955s")).toBe("1955s");
    expect(stem("bring")).toBe("bring"); // -ing needs a 3-letter stem with a vowel
    expect(stem("thing")).toBe("thing");
    expect(stem("fall")).toBe(stem("falling")); // ll is not undoubled
  });
  it("does not conflate different words that merely share letters", () => {
    expect(stem("shorter")).not.toBe(stem("short")); // no -er stripping: list both as keywords
    expect(stem("inside")).not.toBe(stem("outside"));
    expect(stem("hypotonic")).not.toBe(stem("hypertonic"));
  });
});

describe("tokenMatches (one typo in long words)", () => {
  it("allows one edit for 7+ character stems with the same first letter", () => {
    expect(tokenMatches(stem("osmossis"), stem("osmosis"))).toBe(true);
    expect(tokenMatches(stem("semipermeable"), stem("semipermiable"))).toBe(true);
  });
  it("never fuzzes short words or different first letters", () => {
    expect(tokenMatches("affect", "effect")).toBe(false);
    expect(tokenMatches("cat", "cot")).toBe(false);
    expect(tokenMatches(stem("hypotonic"), stem("hypertonic"))).toBe(false);
    expect(tokenMatches(stem("increase"), stem("decrease"))).toBe(false);
  });
});

describe("findPhrase / negation", () => {
  it("matches consecutive stemmed tokens inside a clause", () => {
    const t = prepare("Water moved into the cell, so water was entering fast.");
    expect(findPhrase(t, "water moves into").length).toBe(1);
    expect(findPhrase(t, "water enters").length).toBe(0); // "was" sits between
    expect(findPhrase(t, "entering fast").length).toBe(1);
    expect(findPhrase(t, "")).toEqual([]);
  });
  it("never matches across a clause break", () => {
    expect(findPhrase(prepare("It filled with water. Moves in"), "water moves in")).toEqual([]);
  });
  it("marks a phrase negated when a negator sits within 3 tokens before it", () => {
    const hit = (s: string, k: string) => findPhrase(prepare(s), k)[0];
    expect(hit("salt does not move in", "move in").negated).toBe(true);
    expect(hit("it doesn't really swell", "swell").negated).toBe(true);
    expect(hit("It isn’t osmosis", "osmosis").negated).toBe(true);
    expect(hit("without osmosis", "osmosis").negated).toBe(true);
    expect(hit("it can't be osmosis", "osmosis").negated).toBe(true);
    expect(hit("no, it is osmosis", "osmosis").negated).toBe(false); // the comma ends the negation's clause
    expect(hit("not the salt but the water that crosses by osmosis", "osmosis").negated).toBe(false); // too far back
    expect(hit("water moves in by osmosis", "osmosis").negated).toBe(false);
  });
  it("matchesAnyKeyword ignores negated hits; mentionsAnyKeyword does not", () => {
    const t = prepare("It is not osmosis.");
    expect(matchesAnyKeyword(t, ["osmosis"])).toBe(false);
    expect(mentionsAnyKeyword("It is not osmosis.", ["diffusion", "osmosis"])).toBe("osmosis");
    expect(mentionsAnyKeyword("Water moves", ["osmosis"])).toBeNull();
  });
});

describe("phrasesOverlap", () => {
  it("detects one phrase contained in another (after stemming)", () => {
    expect(phrasesOverlap("acted alone", "alone")).toBe(true);
    expect(phrasesOverlap("salt moves in", "salts move in quickly")).toBe(true);
    expect(phrasesOverlap("water moves in", "water moves out")).toBe(false);
    expect(phrasesOverlap("", "x")).toBe(false);
    expect(stemPhrase("Browder v. Gayle")).toEqual(["browder", "v", "gayl"]);
  });
});

describe("scoreExplanation", () => {
  const rubric: Rubric = {
    required: 2,
    ideas: [
      { label: "which side has more dissolved stuff", keywords: ["hypotonic", "more solute inside"], followUp: "Is the inside different?" },
      { label: "what crosses", keywords: ["osmosis", "water moves in"], followUp: "What crosses, which way?" },
      { label: "why it can't even out", keywords: ["semipermeable"], followUp: "Why no leak?" },
    ],
    misconceptions: [{ keywords: ["salt moves in"], correction: "Can salt get through?" }],
  };

  it("passes when enough ideas land and lists matched/missing ideas", () => {
    const r = scoreExplanation(rubric, "Fresh water is hypotonic, so water moves in by osmosis.");
    expect(r).toMatchObject({ status: "pass", correct: true, matched: [0, 1], missing: [2], misconception: null });
  });
  it("reports the missing ideas when too few land", () => {
    const r = scoreExplanation(rubric, "Water moves in by osmosis and the cell gets bigger.");
    expect(r).toMatchObject({ status: "missing", correct: false, matched: [1], missing: [0, 2] });
  });
  it("a negated keyword does not land the idea", () => {
    const r = scoreExplanation(rubric, "It is not hypotonic, but water moves in anyway.");
    expect(r.matched).toEqual([1]);
    expect(r.correct).toBe(false);
  });
  it("a stated misconception fails even with every idea present; a negated one does not", () => {
    const bad = scoreExplanation(rubric, "It is hypotonic and semipermeable, water moves in, and salt moves in too.");
    expect(bad).toMatchObject({ status: "misconception", correct: false, misconception: 0 });
    const fine = scoreExplanation(rubric, "It is hypotonic and water moves in; salt never moves in.");
    expect(fine).toMatchObject({ status: "pass", correct: true, misconception: null });
  });
  it("empty and too-short input are effort failures, and non-strings are empty", () => {
    expect(scoreExplanation(rubric, "   ").status).toBe("empty");
    expect(scoreExplanation(rubric, "?!").status).toBe("empty");
    expect(scoreExplanation(rubric, undefined).status).toBe("empty");
    expect(scoreExplanation(rubric, "osmosis hypotonic").status).toBe("too_short");
  });
  it(`ignores everything after ${MAX_EXPLANATION_CHARS} characters`, () => {
    const filler = "The cell is interesting. ".repeat(60);
    expect(filler.length).toBeGreaterThan(MAX_EXPLANATION_CHARS);
    expect(scoreExplanation(rubric, `${filler} It is hypotonic and water moves in.`).correct).toBe(false);
    expect(scoreExplanation(rubric, `It is hypotonic and water moves in. ${filler}`).correct).toBe(true);
  });
  it("tolerates a typo in a long technical word", () => {
    expect(scoreExplanation(rubric, "The water is hypotonnic so osmossis pulls water in.").correct).toBe(true);
  });
});
