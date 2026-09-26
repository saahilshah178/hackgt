import { describe, expect, it } from "vitest";
import { cardPlaysIn, isCardImplemented } from "../src/library/index";
import { jaccard, retrieveCards, tokens, type RetrievalQuery } from "../src/library/retrieval";

function top3(q: RetrievalQuery) {
  return retrieveCards({ ...q, includeUnimplemented: true }).candidates.slice(0, 3).map((c) => c.card.id);
}

describe("tokens()", () => {
  it("lowercases and strips punctuation", () => {
    expect(tokens("Hello, World!")).toEqual(["hello", "world"]);
  });

  it("strips stopwords", () => {
    expect(tokens("the limit of a function")).toEqual(["limit", "function"]);
  });

  it("strips plurals", () => {
    expect(tokens("fractions and equations")).toEqual(["fraction", "equation"]);
  });

  it("applies the synonym map", () => {
    expect(tokens("sin and cos")).toEqual(["sine", "cosine"]);
    expect(tokens("causes of WWI")).toEqual(["cause", "world", "war", "i"]);
  });
});

describe("jaccard()", () => {
  it("is 1 for identical sets, 0 for disjoint sets", () => {
    expect(jaccard(["a", "b"], ["a", "b"])).toBe(1);
    expect(jaccard(["a", "b"], ["c", "d"])).toBe(0);
  });

  it("handles partial overlap", () => {
    expect(jaccard(["a", "b", "c"], ["b", "c", "d"])).toBeCloseTo(2 / 4);
  });

  it("is 0 for two empty sets (no division by zero)", () => {
    expect(jaccard([], [])).toBe(0);
  });
});

describe("retrieveCards() golden cases (MEGAPROMPT §4 Matcher)", () => {
  it("limits with 'the limit always equals f(a)' surfaces decoy_destination in the top 3", () => {
    const ids = top3({
      concept: {
        name: "Limits and continuity",
        summary: "the value a function approaches as x nears a point, which may differ from the function's value there",
        keywords: ["limit", "approach", "continuity", "x approaches a"],
        knowledgeType: "quantitative",
        misconceptions: [{ belief: "the limit always equals f(a)", correction: "a limit describes the approach, not the value at the point" }],
      },
      domain: "math",
      topic: "Calculus: limits & continuity",
    });
    expect(ids).toContain("decoy_destination");
  });

  it("photosynthesis inputs/outputs surfaces photosynthesis_recipe in the top 3", () => {
    const ids = top3({
      concept: {
        name: "Photosynthesis",
        summary: "plants use light, water, and carbon dioxide to produce glucose and oxygen",
        keywords: ["photosynthesis", "glucose", "chlorophyll", "carbon dioxide", "oxygen"],
        knowledgeType: "procedure",
        misconceptions: [{ belief: "plants get their mass from the soil", correction: "most plant mass comes from carbon dioxide" }],
      },
      domain: "biology",
      topic: "Biology",
    });
    expect(ids).toContain("photosynthesis_recipe");
  });

  it("causes of WWI surfaces domino_engine or causal_weighting in the top 3", () => {
    const ids = top3({
      concept: {
        name: "Causes of World War I",
        summary: "the tangled causes of world war one: alliances, militarism, nationalism, and a triggering assassination",
        keywords: ["wwi", "causes", "alliances", "militarism", "nationalism"],
        knowledgeType: "causal",
        misconceptions: [{ belief: "history is a list of unrelated events", correction: "one cause set up the conditions for the next" }],
      },
      domain: "history",
      topic: "History",
    });
    expect(ids.some((id) => id === "domino_engine" || id === "causal_weighting")).toBe(true);
  });

  it("supply and demand surfaces living_marketplace in the top 3", () => {
    const ids = top3({
      concept: {
        name: "Supply and demand",
        summary: "how supply and demand curves set the market's equilibrium price and quantity",
        keywords: ["supply", "demand", "market", "equilibrium", "price"],
        knowledgeType: "system",
        misconceptions: [{ belief: "higher prices increase demand", correction: "higher prices reduce quantity demanded" }],
      },
      domain: "economics",
      topic: "Economics",
    });
    expect(ids).toContain("living_marketplace");
  });

  it("primary vs secondary sources surfaces evidence_lab in the top 3", () => {
    const ids = top3({
      concept: {
        name: "Primary vs secondary sources",
        summary: "classifying historical documents as primary or secondary sources",
        keywords: ["primary source", "secondary source", "document", "evidence"],
        knowledgeType: "category",
        misconceptions: [{ belief: "old means primary", correction: "a primary source comes from the time or people studied" }],
      },
      domain: "history",
      topic: "History",
    });
    expect(ids).toContain("evidence_lab");
  });

  it("period of sine functions ranks phase_gate #1", () => {
    const ids = top3({
      concept: {
        name: "Period of a sine function",
        summary: "how the coefficient b sets the period of a sine wave",
        keywords: ["period", "sine", "wave", "cycle", "frequency"],
        knowledgeType: "quantitative",
        misconceptions: [{ belief: "a bigger b makes the period longer", correction: "the period is 2 pi over b" }],
      },
      domain: "math",
      topic: "Trigonometry",
    });
    expect(ids[0]).toBe("phase_gate");
  });
});

describe("retrieveCards() implemented filtering", () => {
  const q: RetrievalQuery = {
    concept: {
      name: "Any concept",
      summary: "a generic concept about categories",
      keywords: ["category", "classify"],
      knowledgeType: "category",
      misconceptions: [],
    },
    domain: "general",
    topic: "General",
    genre: "dungeon",
  };

  it("without includeUnimplemented, every candidate is implemented and plays in the requested genre", () => {
    const { candidates } = retrieveCards(q);
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(isCardImplemented(c.card), c.card.id).toBe(true);
      expect(cardPlaysIn(c.card, "dungeon"), c.card.id).toBe(true);
    }
  });

  it("the wishlist contains only unimplemented cards", () => {
    const { wishlist } = retrieveCards(q);
    for (const c of wishlist) expect(isCardImplemented(c.card), c.card.id).toBe(false);
  });
});
