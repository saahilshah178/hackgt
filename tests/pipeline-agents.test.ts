import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getIntake } from "../src/app/api/sources/[id]/intake/route";
import { GET as getMatches } from "../src/app/api/sources/[id]/matches/route";
import { POST as postSources } from "../src/app/api/sources/route";
import { prepareIntake, matcherJob, resetMatcherJobs } from "../src/pipeline/agents/intake";
import { resolveMockSample } from "../src/pipeline/mock/registry";
import { resetEnvCache } from "../src/server/env";
import { getStorage, resetStorage } from "../src/server/storage";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "quest-forge-agents-"));
  process.env.DATA_DIR = dir;
  resetEnvCache();
  resetStorage();
  resetMatcherJobs();
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  resetEnvCache();
  resetStorage();
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

async function uploadPdf(path: string, filename: string): Promise<string> {
  const bytes = await readFile(path);
  const form = new FormData();
  form.set("file", new File([bytes], filename, { type: "application/pdf" }));
  const res = await postSources(new Request("http://test/api/sources", { method: "POST", body: form }));
  expect(res.status).toBe(200);
  const json = await res.json();
  return json.sourceId as string;
}

const SAMPLES = [
  { file: "samples/trig-notes.pdf", name: "trig-notes.pdf", domain: "math" },
  { file: "samples/cell-transport.pdf", name: "cell-transport.pdf", domain: "biology" },
  { file: "samples/civil-rights-history.pdf", name: "civil-rights-history.pdf", domain: "history" },
];

describe("prepareIntake in mock mode", () => {
  for (const sample of SAMPLES) {
    it(`prepares ${sample.name} end to end`, async () => {
      const sourceId = await uploadPdf(sample.file, sample.name);

      const result = await prepareIntake(sourceId);
      expect(result.mock).toBe(true);
      expect(result.gatekeeper.educational).toBe(true);
      expect(result.knowledgeMap.subject.domain).toBe(sample.domain);
      expect(result.dropped).toEqual([]);
      expect(result.preCheck).toHaveLength(3);
      result.preCheck.forEach((mcq) => {
        expect(mcq.choices).toHaveLength(4);
        expect(mcq.correctIndex).toBeGreaterThanOrEqual(0);
        expect(mcq.correctIndex).toBeLessThan(4);
      });

      // stored knowledge map matches what the route would serve
      const stored = await getStorage().getKnowledgeMap(sourceId);
      expect(stored).toEqual(result.knowledgeMap);

      // idempotent: a second call returns the same prep without erroring
      const again = await prepareIntake(sourceId);
      expect(again).toEqual(result);

      // matches eventually land in storage via the background matcher
      await matcherJob(sourceId);
      const matches = await getStorage().getMatch(sourceId);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(result.knowledgeMap.concepts.length);
      for (const m of matches!) {
        expect(m.picks.length).toBeGreaterThan(0);
        expect(m.picks.length).toBeLessThanOrEqual(3);
      }
    });
  }
});

describe("GET /api/sources/[id]/intake", () => {
  it("returns the intake shape instructions.md §9 describes", async () => {
    const sourceId = await uploadPdf("samples/trig-notes.pdf", "trig-notes.pdf");
    const res = await getIntake(new Request(`http://test/api/sources/${sourceId}/intake`), { params: Promise.resolve({ id: sourceId }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      source: { id: sourceId, kind: "pdf", title: "trig-notes", pageCount: 4 },
      mock: true,
    });
    expect(json.gatekeeper).toBeTruthy();
    expect(json.knowledgeMap).toBeTruthy();
    expect(json.preCheck).toHaveLength(3);
    expect(Array.isArray(json.dropped)).toBe(true);
    await matcherJob(sourceId);
  });

  it("404s for an unknown source", async () => {
    const res = await getIntake(new Request("http://test/api/sources/nope/intake"), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });
});

describe("GET /api/sources/[id]/matches", () => {
  it("404s for an unknown source", async () => {
    const res = await getMatches(new Request("http://test/api/sources/nope/matches"), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });

  it("returns 202 pending before intake has been prepared, then the matches after", async () => {
    const sourceId = await uploadPdf("samples/trig-notes.pdf", "trig-notes.pdf");

    const before = await getMatches(new Request(`http://test/api/sources/${sourceId}/matches`), { params: Promise.resolve({ id: sourceId }) });
    expect(before.status).toBe(202);
    expect((await before.json()).pending).toBe(true);

    await getIntake(new Request(`http://test/api/sources/${sourceId}/intake`), { params: Promise.resolve({ id: sourceId }) });
    await matcherJob(sourceId);

    const after = await getMatches(new Request(`http://test/api/sources/${sourceId}/matches`), { params: Promise.resolve({ id: sourceId }) });
    expect(after.status).toBe(200);
    const matches = await after.json();
    expect(Array.isArray(matches)).toBe(true);
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe("resolveMockSample", () => {
  it("maps trig/cell/history keywords to their sample", () => {
    expect(resolveMockSample({ text: "This chapter covers the period of sin(bx) and cosine graphs." })).toBe("trig");
    expect(resolveMockSample({ text: "Osmosis moves water across the selectively permeable membrane." })).toBe("cell");
    expect(resolveMockSample({ text: "The Montgomery bus boycott began after Rosa Parks was arrested." })).toBe("civil_rights");
  });

  it("does not false-positive on a word that merely contains a keyword substring", () => {
    // "business" (as in a Domain enum listing embedded in a system prompt) contains "sine", which
    // must not make cell/history content resolve to "trig" instead.
    const text = "Domains: math, business, biology. Osmosis moves water across the selectively permeable membrane.";
    expect(resolveMockSample({ text })).toBe("cell");
  });

  it("falls back to trig for unrecognized text", () => {
    expect(resolveMockSample({ text: "Some completely unrelated subject matter about gardening." })).toBe("trig");
  });
});

describe("an unknown text upload", () => {
  it("resolves to the trig sample in mock mode", async () => {
    // Long enough (>= 4 pages at the ingest splitter's ~1800-char page size) that it spans the same
    // page range the trig fixture's gatekeeper/curriculum mocks assume.
    const text = "A passage about gardening techniques, composting, and soil pH, with no math content at all. ".repeat(120);
    const res = await postSources(
      new Request("http://test/api/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, title: "Gardening notes" }),
      }),
    );
    const { sourceId } = await res.json();

    const result = await prepareIntake(sourceId);
    expect(result.mock).toBe(true);
    expect(result.knowledgeMap.subject.topic).toBe("Trigonometric functions");
    await matcherJob(sourceId);
  });
});

describe("a bare topic upload", () => {
  it("prepares intake without throwing, even though it falls back to the (page-mismatched) trig mock", async () => {
    // "Limits and continuity" matches none of the registry's keywords, so it falls back to the trig
    // fixture (1 page vs. trig's own 4). checkGatekeeper/checkCurriculum treat that mismatch as
    // advisory in mock mode (src/pipeline/agents/intake.ts), so this must succeed instead of throwing.
    const res = await postSources(
      new Request("http://test/api/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: "Limits and continuity" }),
      }),
    );
    expect(res.status).toBe(200);
    const { sourceId } = await res.json();

    const result = await prepareIntake(sourceId);
    expect(result.mock).toBe(true);
    expect(result.knowledgeMap.unsourced).toBe(true);
    expect(result.knowledgeMap.units.length).toBeGreaterThan(0);
    expect(result.knowledgeMap.concepts.length).toBeGreaterThan(0);
    await matcherJob(sourceId);
  });
});
