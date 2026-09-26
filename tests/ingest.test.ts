import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { trigKnowledgeMap } from "../fixtures/trig.knowledge-map";
import type { PageRecord } from "../src/contracts/storage";
import { extractPages } from "../src/server/ingest/pdf";
import { findQuote, normalizeForMatch, verifyKnowledgeMapQuotes } from "../src/server/ingest/quotes";
import { splitTextIntoPages } from "../src/server/ingest/text";

describe("normalizeForMatch", () => {
  it("lowercases, collapses whitespace, and unifies quotes/dashes", () => {
    expect(normalizeForMatch("  Hello   World  ")).toBe("hello world");
    expect(normalizeForMatch("It’s a “wave” — really")).toBe(`it's a "wave" - really`);
  });

  it("de-hyphenates a word split across a line break and drops soft hyphens", () => {
    expect(normalizeForMatch("com-\npound")).toBe("compound");
    expect(normalizeForMatch("soft­hyphen")).toBe("softhyphen");
  });

  it("normalizes with NFKC (e.g. full-width forms)", () => {
    expect(normalizeForMatch("ａｂｃ")).toBe("abc"); // full-width a b c
  });
});

describe("findQuote", () => {
  it("finds a quote regardless of surrounding whitespace and line breaks", () => {
    const pageText = "Some intro.\nOne complete\nrevolution corresponds to 2π radians. More text.";
    expect(findQuote(pageText, "One complete revolution corresponds to 2π radians.")).toBe(true);
  });

  it("returns false for a quote that isn't on the page", () => {
    expect(findQuote("Nothing relevant here.", "A quote that is not present.")).toBe(false);
  });

  it("returns false for an empty quote", () => {
    expect(findQuote("Some text.", "")).toBe(false);
  });
});

describe("verifyKnowledgeMapQuotes with synthetic pages", () => {
  const pages: PageRecord[] = [
    { sourceId: "s", page: 1, text: "The sky is blue on a clear day.", lowText: false },
    { sourceId: "s", page: 2, text: "Water boils at 100 degrees Celsius at sea level.", lowText: false },
  ];

  it("keeps facts whose quote is found on the cited page", () => {
    const km = {
      sourceId: "s",
      title: "t",
      subject: { domain: "general" as const, topic: "t" },
      level: "intro",
      unsourced: false,
      outline: [],
      units: [{ id: "u1", name: "Unit", conceptIds: ["c1"] }],
      concepts: [
        {
          id: "c1",
          unitId: "u1",
          name: "Sky",
          summary: "s",
          knowledgeType: "fact" as const,
          learningObjective: "o",
          importance: "core" as const,
          difficulty: 1,
          prerequisites: [],
          keywords: [],
          facts: [
            { statement: "The sky is blue.", sourceRef: { page: 1, quote: "The sky is blue on a clear day." } },
            { statement: "Water boils at 100C.", sourceRef: { page: 2, quote: "This sentence is not on the page." } },
          ],
          misconceptions: [],
          formulas: [],
        },
      ],
    };
    const { km: cleaned, verified, dropped } = verifyKnowledgeMapQuotes(km, pages);
    expect(verified).toBe(1);
    expect(dropped).toEqual([{ conceptId: "c1", page: 2, quote: "This sentence is not on the page." }]);
    expect(cleaned.concepts[0].facts).toHaveLength(1);
    expect(cleaned.concepts[0].facts[0].statement).toBe("The sky is blue.");
  });

  it("never drops a concept, even when every fact fails verification", () => {
    const km = {
      sourceId: "s",
      title: "t",
      subject: { domain: "general" as const, topic: "t" },
      level: "intro",
      unsourced: false,
      outline: [],
      units: [{ id: "u1", name: "Unit", conceptIds: ["c1"] }],
      concepts: [
        {
          id: "c1",
          unitId: "u1",
          name: "Sky",
          summary: "s",
          knowledgeType: "fact" as const,
          learningObjective: "o",
          importance: "core" as const,
          difficulty: 1,
          prerequisites: [],
          keywords: [],
          facts: [{ statement: "Fabricated.", sourceRef: { page: 1, quote: "Not on the page at all." } }],
          misconceptions: [],
          formulas: [],
        },
      ],
    };
    const { km: cleaned, dropped } = verifyKnowledgeMapQuotes(km, pages);
    expect(dropped).toHaveLength(1);
    expect(cleaned.concepts).toHaveLength(1);
    expect(cleaned.concepts[0].facts).toEqual([]);
  });

  it("keeps unsourced facts (sourceRef: null) without checking anything", () => {
    const km = {
      sourceId: "s",
      title: "t",
      subject: { domain: "general" as const, topic: "t" },
      level: "intro",
      unsourced: true,
      outline: [],
      units: [{ id: "u1", name: "Unit", conceptIds: ["c1"] }],
      concepts: [
        {
          id: "c1",
          unitId: "u1",
          name: "Sky",
          summary: "s",
          knowledgeType: "fact" as const,
          learningObjective: "o",
          importance: "core" as const,
          difficulty: 1,
          prerequisites: [],
          keywords: [],
          facts: [{ statement: "General knowledge.", sourceRef: null }],
          misconceptions: [],
          formulas: [],
        },
      ],
    };
    const { verified, dropped, km: cleaned } = verifyKnowledgeMapQuotes(km, []);
    expect(verified).toBe(0);
    expect(dropped).toEqual([]);
    expect(cleaned.concepts[0].facts).toHaveLength(1);
  });
});

describe("splitTextIntoPages", () => {
  it("returns no pages for empty text", () => {
    expect(splitTextIntoPages("s", "   ")).toEqual([]);
  });

  it("splits long text into multiple ~1800-char pages, preferring paragraph/sentence breaks", () => {
    const paragraph = "Sentence one. Sentence two. Sentence three. ".repeat(60); // > 1800 chars
    const pages = splitTextIntoPages("s", paragraph);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every((p) => p.sourceId === "s")).toBe(true);
    expect(pages.map((p) => p.page)).toEqual(pages.map((_, i) => i + 1));
    expect(pages.map((p) => p.text).join(" ").replace(/\s+/g, " ")).toContain("Sentence one.");
  });

  it("returns a single page for short text", () => {
    const pages = splitTextIntoPages("s", "Just a short note.");
    expect(pages).toEqual([{ sourceId: "s", page: 1, text: "Just a short note.", lowText: true }]);
  });
});

describe("extractPages on the generated trig-notes.pdf", () => {
  it("extracts 4 pages and verifies all 8 fixture quotes with 0 dropped", async () => {
    const data = new Uint8Array(await readFile("samples/trig-notes.pdf"));
    const pages = await extractPages(data, trigKnowledgeMap.sourceId);
    expect(pages).toHaveLength(4);
    expect(pages.every((p) => !p.lowText)).toBe(true);

    const { verified, dropped } = verifyKnowledgeMapQuotes(trigKnowledgeMap, pages);
    expect(dropped).toEqual([]);
    expect(verified).toBe(8);
  });
});
