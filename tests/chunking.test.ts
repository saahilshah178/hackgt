import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { CurriculumSlice } from "../src/contracts/slices";
import type { PageRecord } from "../src/contracts/storage";
import { CHUNK_DEFAULTS, chunkPages, digestPages, mergeCurriculumSlices } from "../src/pipeline/agents/chunking";
import { checkCurriculum, runCurriculumChunked } from "../src/pipeline/agents/curriculum";
import { curriculumPrompt } from "../src/pipeline/agents/curriculum.prompt";
import { gatekeeperPrompt } from "../src/pipeline/agents/gatekeeper.prompt";

/*
 * There is no page cap on uploads any more (src/app/api/sources/route.ts). A whole textbook reaches
 * the Gatekeeper digested (first pages complete, later pages by their openings) and the Curriculum
 * agent in section-aligned parts that are merged back into one slice. Short material must be
 * untouched by all of this, so the three sample PDFs and their mock fixtures keep working.
 */

const page = (n: number, text: string): PageRecord => ({ sourceId: "s", page: n, text, lowText: text.length < 40 });
const filler = (n: number, chars: number) => `Chapter heading on page ${n}\n${"lorem ipsum dolor sit amet ".repeat(Math.ceil(chars / 27)).slice(0, chars)}`;
const book = (pages: number, charsPerPage: number) => Array.from({ length: pages }, (_, i) => page(i + 1, filler(i + 1, charsPerPage)));

describe("digestPages (what the gatekeeper reads)", () => {
  it("returns short material unchanged", () => {
    const pages = book(4, 2_000);
    const view = digestPages(pages);
    expect(view.digested).toBe(false);
    expect(view.pages.map((p) => p.text)).toEqual(pages.map((p) => p.text));
  });

  it("keeps the first pages complete and cuts later pages to their openings within the budget", () => {
    const pages = book(300, 2_500); // 750k chars, far over the 120k budget
    const view = digestPages(pages);
    expect(view.digested).toBe(true);
    expect(view.pages).toHaveLength(300);
    expect(view.fullPages).toBe(3);
    for (let i = 0; i < 3; i++) expect(view.pages[i].text).toBe(pages[i].text);
    const later = view.pages.slice(3);
    expect(later.every((p) => p.text.length <= view.perPageChars + 4)).toBe(true);
    expect(later.every((p) => p.text.startsWith("Chapter heading on page"))).toBe(true);
    const total = view.pages.reduce((n, p) => n + p.text.length, 0);
    expect(total).toBeLessThanOrEqual(120_000 + 300 * 4);
  });

  it("shrinks the per-page head for very long documents and marks empty pages", () => {
    const pages = [...book(1_000, 1_000), page(1_001, "   ")];
    const view = digestPages(pages);
    expect(view.perPageChars).toBeLessThan(320);
    expect(view.perPageChars).toBeGreaterThanOrEqual(60);
    expect(view.pages[view.pages.length - 1].text).toBe("(no text on this page)");
  });

  it("the gatekeeper prompt explains the digest only when it happened", () => {
    const short = gatekeeperPrompt({ title: "Notes", pages: book(4, 2_000) });
    expect(short).not.toContain("# Note: this document is long");
    const long = gatekeeperPrompt({ title: "Book", pages: book(200, 2_500) });
    expect(long).toContain("# Note: this document is long (200 pages)");
    expect(long).toContain("--- page 200 ---");
  });
});

describe("chunkPages (how the curriculum agent reads)", () => {
  it("keeps short material as a single untitled part", () => {
    const chunks = chunkPages(book(4, 2_000), [{ title: "Intro", pageStart: 1, pageEnd: 4 }]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ index: 0, title: null, pageStart: 1, pageEnd: 4 });
  });

  it("cuts at the outline's section starts and splits an oversized section into windows", () => {
    const pages = book(30, 3_000);
    const outline = [
      { title: "Introduction", pageStart: 1, pageEnd: 5 },
      { title: "Chapter 1", pageStart: 6, pageEnd: 15 },
      { title: "Chapter 2", pageStart: 16, pageEnd: 30 }, // 45k chars > maxChars 40k
    ];
    const chunks = chunkPages(pages, outline);
    expect(chunks.map((c) => [c.pageStart, c.pageEnd])).toEqual([
      [1, 5],
      [6, 15],
      [16, 28],
      [29, 30],
    ]);
    expect(chunks.map((c) => c.title)).toEqual(["Introduction", "Chapter 1", "Chapter 2 (part 1)", "Chapter 2 (part 2)"]);
    expect(chunks.map((c) => c.index)).toEqual([0, 1, 2, 3]);
    expect(chunks.flatMap((c) => c.pages.map((p) => p.page))).toEqual(pages.map((p) => p.page));
  });

  it("falls back to fixed windows without an outline and respects the character limit", () => {
    const byPages = chunkPages(book(100, 1_000), []);
    expect(byPages).toHaveLength(3);
    expect(byPages.every((c) => c.pages.length <= CHUNK_DEFAULTS.maxPages && c.chars <= CHUNK_DEFAULTS.maxChars)).toBe(true);
    expect(byPages.reduce((n, c) => n + c.pages.length, 0)).toBe(100);
    const byChars = chunkPages(book(10, 15_000), []); // 2 pages already exceed 40k chars
    expect(byChars.every((c) => c.chars <= CHUNK_DEFAULTS.maxChars)).toBe(true);
    expect(byChars.every((c) => c.pages.length <= 2)).toBe(true);
  });

  it("folds a tiny section into its neighbor and ignores outline entries outside the pages", () => {
    const pages = book(20, 3_000);
    const outline = [
      { title: "Title page", pageStart: 1, pageEnd: 1 },
      { title: "Chapter 1", pageStart: 2, pageEnd: 11 },
      { title: "Chapter 2", pageStart: 12, pageEnd: 20 },
      { title: "Appendix", pageStart: 90, pageEnd: 99 },
    ];
    const chunks = chunkPages(pages, outline);
    expect(chunks.map((c) => [c.pageStart, c.pageEnd, c.title])).toEqual([
      [1, 11, "Title page"],
      [12, 20, "Chapter 2"],
    ]);
  });
});

function slice(over: Partial<CurriculumSlice> & Pick<CurriculumSlice, "units" | "concepts">): CurriculumSlice {
  return { title: "Part", domain: "physics", topic: "Waves", level: "High school", outline: [], ...over };
}

function concept(id: string, unitId: string, name: string, page: number, over: Partial<CurriculumSlice["concepts"][number]> = {}): CurriculumSlice["concepts"][number] {
  return {
    id,
    unitId,
    name,
    summary: `${name} summary`,
    knowledgeType: "fact",
    learningObjective: `The student can explain ${name}`,
    importance: "core",
    difficulty: 1,
    prerequisites: [],
    keywords: [name.toLowerCase()],
    facts: [{ statement: `${name} fact`, sourceRef: { page, quote: `${name} quote` } }],
    misconceptions: [{ belief: `${name} is wrong`, correction: `${name} is right` }],
    formulas: [],
    ...over,
  };
}

describe("mergeCurriculumSlices", () => {
  it("returns a lone part as-is", () => {
    const only = slice({ units: [{ id: "u_a", name: "A" }], concepts: [concept("c_a", "u_a", "A", 1)] });
    expect(mergeCurriculumSlices([{ chunk: { index: 0, title: null, pageStart: 1, pageEnd: 4 }, slice: only }], "Book")).toBe(only);
  });

  it("keeps ids unique across parts, reuses same-named units, drops duplicate concepts and remaps references", () => {
    const part1 = slice({
      domain: "physics",
      outline: [{ title: "Ch 1", pageStart: 1, pageEnd: 10 }],
      units: [
        { id: "u_intro", name: "Introduction" },
        { id: "u_waves", name: "Waves" },
      ],
      concepts: [concept("c_intro", "u_intro", "What physics is", 1), concept("c_period", "u_waves", "Period", 5), concept("c_freq", "u_waves", "Frequency", 6, { prerequisites: ["c_period"] })],
    });
    const part2 = slice({
      domain: "chemistry",
      outline: [{ title: "Ch 2", pageStart: 11, pageEnd: 20 }],
      units: [
        { id: "u_intro", name: "Introduction" }, // same id + name: the same unit
        { id: "u_waves", name: "Sound waves" }, // same id, different name: renamed
      ],
      concepts: [
        concept("c_intro", "u_intro", "What physics is", 11), // duplicate concept: dropped
        concept("c_period", "u_waves", "Pitch", 12), // id collides with a different concept: renamed
        concept("c_loud", "u_waves", "Loudness", 13, { prerequisites: ["c_period", "c_missing"] }),
      ],
    });
    const parts = [
      { chunk: { index: 0, title: "Ch 1", pageStart: 1, pageEnd: 10 }, slice: part1 },
      { chunk: { index: 1, title: "Ch 2", pageStart: 11, pageEnd: 20 }, slice: part2 },
    ];
    const merged = mergeCurriculumSlices([parts[1], parts[0]], "The whole book"); // order-insensitive

    expect(merged.title).toBe("The whole book");
    expect(merged.units.map((u) => u.id)).toEqual(["u_intro", "u_waves", "u_waves_2"]);
    expect(merged.units.find((u) => u.id === "u_waves_2")?.name).toBe("Sound waves");
    expect(merged.concepts.map((c) => c.id)).toEqual(["c_intro", "c_period", "c_freq", "c_period_2", "c_loud"]);
    const pitch = merged.concepts.find((c) => c.id === "c_period_2");
    expect(pitch).toMatchObject({ name: "Pitch", unitId: "u_waves_2" });
    // the part-2 prerequisite "c_period" meant part 2's own (renamed) concept; the unknown one is dropped
    expect(merged.concepts.find((c) => c.id === "c_loud")?.prerequisites).toEqual(["c_period_2"]);
    expect(merged.concepts.find((c) => c.id === "c_freq")?.prerequisites).toEqual(["c_period"]);
    expect(merged.outline.map((o) => o.title)).toEqual(["Ch 1", "Ch 2"]);
    expect(checkCurriculum(merged, { pageCount: 20, unsourced: false }).filter((p) => !p.startsWith("soft:"))).toEqual([]);
  });
});

describe("checkCurriculum with a part's page range", () => {
  it("flags a fact that cites a page outside the part", () => {
    const s = slice({ units: [{ id: "u_a", name: "A" }], concepts: [concept("c_a", "u_a", "A", 3)] });
    const problems = checkCurriculum(s, { pageCount: 30, unsourced: false, pageRange: [6, 15] });
    expect(problems.some((p) => p.includes("outside this part's pages 6-15"))).toBe(true);
    expect(checkCurriculum(s, { pageCount: 30, unsourced: false, pageRange: [1, 5] }).filter((p) => !p.startsWith("soft:"))).toEqual([]);
  });

  it("the prompt tells the agent which part it is reading", () => {
    const p = curriculumPrompt({ title: "Book", pages: [{ page: 6, text: "x" }], unsourced: false, chunk: { index: 2, total: 5, title: "Chapter 1", pageStart: 6, pageEnd: 15 } });
    expect(p).toContain('# Part 2 of 5: pages 6-15 ("Chapter 1")');
    expect(p).toContain("cite only pages 6-15");
    expect(curriculumPrompt({ title: "Notes", pages: [{ page: 1, text: "x" }], unsourced: false })).not.toContain("# Part");
  });
});

/** A fake SMART model that answers each part with concepts about its own pages (and reads "Part i of n" from the prompt). */
function partAwareModel(calls: string[]): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    modelId: "mock-smart",
    doGenerate: async (options) => {
      const user = options.prompt
        .filter((m) => m.role === "user")
        .flatMap((m) => (m.content as { type: string; text?: string }[]).map((p) => p.text ?? ""))
        .join("\n");
      const m = /# Part (\d+) of (\d+): pages (\d+)-(\d+)/.exec(user);
      if (!m) throw new Error("expected a chunked prompt");
      const [, i, , start] = m;
      calls.push(`${i}:${start}`);
      const reply = slice({
        title: `Part ${i}`,
        domain: Number(i) === 1 ? "physics" : "physics",
        units: [{ id: `u_part${i}`, name: `Unit ${i}` }],
        concepts: [concept(`c_part${i}_a`, `u_part${i}`, `Concept ${i}a`, Number(start)), concept(`c_shared`, `u_part${i}`, `Shared concept`, Number(start))],
      });
      return {
        content: [{ type: "text", text: JSON.stringify(reply) }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
        warnings: [],
      } as unknown as Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;
    },
  });
}

describe("runCurriculumChunked", () => {
  it("reads a long document in parts and merges them into one valid slice", async () => {
    const pages = book(30, 3_000);
    const outline = [
      { title: "Ch 1", pageStart: 1, pageEnd: 10 },
      { title: "Ch 2", pageStart: 11, pageEnd: 20 },
      { title: "Ch 3", pageStart: 21, pageEnd: 30 },
    ];
    const calls: string[] = [];
    const { slice: merged, parts } = await runCurriculumChunked({
      jobId: "job_chunk_test",
      title: "A whole book",
      pages,
      pageCount: 30,
      unsourced: false,
      outline,
      model: partAwareModel(calls),
    });
    expect(parts).toBe(3);
    expect([...calls].sort()).toEqual(["1:1", "2:11", "3:21"]);
    expect(merged.title).toBe("A whole book");
    expect(merged.units.map((u) => u.id)).toEqual(["u_part1", "u_part2", "u_part3"]);
    // "c_shared" appears in every part with the same name: kept once, in the first part's unit
    expect(merged.concepts.map((c) => c.id)).toEqual(["c_part1_a", "c_shared", "c_part2_a", "c_part3_a"]);
    expect(merged.concepts.find((c) => c.id === "c_shared")?.unitId).toBe("u_part1");
    expect(checkCurriculum(merged, { pageCount: 30, unsourced: false }).filter((p) => !p.startsWith("soft:"))).toEqual([]);
  });

  it("uses a single unchunked call for short material and when chunking is off", async () => {
    let chunked = 0;
    const model = new MockLanguageModelV4({
      modelId: "mock-smart",
      doGenerate: async (options) => {
        const user = options.prompt
          .filter((m) => m.role === "user")
          .flatMap((m) => (m.content as { type: string; text?: string }[]).map((p) => p.text ?? ""))
          .join("\n");
        if (user.includes("# Part ")) chunked++;
        const reply = slice({ units: [{ id: "u_a", name: "A" }], concepts: [concept("c_a", "u_a", "A", 1)] });
        return {
          content: [{ type: "text", text: JSON.stringify(reply) }],
          finishReason: { unified: "stop", raw: "stop" },
          usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
          warnings: [],
        } as unknown as Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;
      },
    });
    const short = await runCurriculumChunked({ jobId: "job_short", title: "Notes", pages: book(4, 2_000), pageCount: 4, unsourced: false, model });
    expect(short.parts).toBe(1);
    const off = await runCurriculumChunked({ jobId: "job_off", title: "Book", pages: book(30, 3_000), pageCount: 30, unsourced: false, model, chunking: false });
    expect(off.parts).toBe(1);
    expect(chunked).toBe(0);
  });
});
