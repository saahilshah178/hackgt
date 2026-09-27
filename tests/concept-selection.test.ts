import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { trigKnowledgeMap, trigMatches } from "../fixtures/trig.knowledge-map";
import { selectConcepts, type Intake, type Mcq } from "../src/contracts/knowledge";
import { POST as postGames } from "../src/app/api/games/route";
import { POST as postPrecheck } from "../src/app/api/sources/[id]/precheck/route";
import { POST as postSources } from "../src/app/api/sources/route";
import { loadStoredPreCheck, matcherJob, prepareIntake, resetMatcherJobs, selectionKey } from "../src/pipeline/agents/intake";
import { derivePreCheck } from "../src/pipeline/agents/precheck";
import { resetEnvCache } from "../src/server/env";
import { getStorage, resetStorage } from "../src/server/storage";

/*
 * A whole textbook yields far more concepts than one game holds, so the intake page lets the student
 * tick the ones to play. Intake.conceptIds carries that selection: the job runs on selectConcepts(km,
 * ids), and because the prep pre-check covers the whole map, POST /api/sources/:id/precheck writes
 * three questions for the ticked subset, cached per selection, which POST /api/games looks up again
 * (never trusting the client's items). This exercises all of it in mock mode.
 */

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "quest-forge-selection-"));
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

function jsonRequest(url: string, body: unknown) {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

async function uploadTrig(): Promise<string> {
  const bytes = await readFile("samples/trig-notes.pdf");
  const form = new FormData();
  form.set("file", new File([bytes], "trig-notes.pdf", { type: "application/pdf" }));
  const res = await postSources(new Request("http://test/api/sources", { method: "POST", body: form }));
  expect(res.status).toBe(200);
  return (await res.json()).sourceId as string;
}

function precheckFor(sourceId: string, conceptIds: string[]) {
  return postPrecheck(jsonRequest(`http://test/api/sources/${sourceId}/precheck`, { conceptIds }), { params: Promise.resolve({ id: sourceId }) });
}

function expectWellFormed(items: Mcq[], allowed: readonly string[]) {
  expect(items).toHaveLength(3);
  for (const item of items) {
    expect(allowed).toContain(item.conceptId);
    expect(item.choices).toHaveLength(4);
    expect(new Set(item.choices).size).toBe(4);
    expect(item.correctIndex).toBeGreaterThanOrEqual(0);
    expect(item.correctIndex).toBeLessThan(4);
  }
}

describe("selectConcepts", () => {
  it("keeps only the ticked concepts, drops empty units and outside prerequisites", () => {
    const ids = ["c_period", "c_amplitude"];
    const sub = selectConcepts(trigKnowledgeMap, ids);
    expect(sub.concepts.map((c) => c.id).sort()).toEqual([...ids].sort());
    expect(sub.units.length).toBeGreaterThan(0);
    for (const u of sub.units) {
      expect(u.conceptIds.length).toBeGreaterThan(0);
      expect(u.conceptIds.every((id) => ids.includes(id))).toBe(true);
    }
    expect(sub.concepts.every((c) => c.prerequisites.every((p) => ids.includes(p)))).toBe(true);
    expect(sub.sourceId).toBe(trigKnowledgeMap.sourceId);
  });

  it("means the whole map when nothing (or nothing known) is ticked", () => {
    expect(selectConcepts(trigKnowledgeMap, undefined)).toBe(trigKnowledgeMap);
    expect(selectConcepts(trigKnowledgeMap, [])).toBe(trigKnowledgeMap);
    expect(selectConcepts(trigKnowledgeMap, ["c_not_a_concept"])).toBe(trigKnowledgeMap);
  });
});

describe("derivePreCheck (code fallback for the Pre-check Writer)", () => {
  it("writes three distinct, well-formed items even for a single ticked concept", () => {
    const sub = selectConcepts(trigKnowledgeMap, ["c_period"]);
    const { items } = derivePreCheck(sub, ["c_period"]);
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.conceptId === "c_period")).toBe(true);
    expect(new Set(items.map((i) => i.prompt)).size).toBe(3);
    for (const item of items) {
      expect(item.distractors).toHaveLength(3);
      expect(new Set([item.correct, ...item.distractors]).size).toBe(4);
    }
  });
});

describe("selectionKey", () => {
  it("is order-insensitive and ignores repeats", () => {
    expect(selectionKey(["b", "a", "c"])).toBe(selectionKey(["c", "a", "b", "a"]));
    expect(selectionKey(["a", "b"])).not.toBe(selectionKey(["a", "c"]));
  });
});

describe("POST /api/sources/[id]/precheck", () => {
  it("returns the prep items for an empty or complete selection, and writes + caches items for a subset", async () => {
    const sourceId = await uploadTrig();
    const prepped = await prepareIntake(sourceId);
    await matcherJob(sourceId);
    const all = prepped.knowledgeMap.concepts.map((c) => c.id);

    const complete = await (await precheckFor(sourceId, all)).json();
    expect(complete.preCheck).toEqual(prepped.preCheck);
    expect(complete.cached).toBe(true);
    const empty = await (await precheckFor(sourceId, [])).json();
    expect(empty.preCheck).toEqual(prepped.preCheck);

    const subset = ["c_period", "c_amplitude"];
    const first = await precheckFor(sourceId, subset);
    expect(first.status).toBe(200);
    const a = await first.json();
    expectWellFormed(a.preCheck, subset);
    expect(a.conceptIds.sort()).toEqual([...subset].sort());
    expect(a.cached).toBe(false);
    expect(typeof a.derived).toBe("boolean");

    const again = await (await precheckFor(sourceId, [...subset].reverse())).json();
    expect(again.cached).toBe(true);
    expect(again.preCheck).toEqual(a.preCheck);

    // what POST /api/games will look up for the same selection, and for none
    expect(await loadStoredPreCheck(sourceId, subset)).toEqual(a.preCheck);
    expect(await loadStoredPreCheck(sourceId)).toEqual(prepped.preCheck);
  });

  it("404s before intake prep exists and 400s on a bad body", async () => {
    const sourceId = await uploadTrig();
    const res = await precheckFor(sourceId, ["c_period"]);
    expect(res.status).toBe(404);
    const bad = await postPrecheck(jsonRequest(`http://test/api/sources/${sourceId}/precheck`, { nope: 1 }), { params: Promise.resolve({ id: sourceId }) });
    expect(bad.status).toBe(400);
  });
});

describe("POST /api/games with intake.conceptIds", () => {
  it("runs the job on the ticked subset, with that subset's pre-check items (never the client's)", async () => {
    const sourceId = await uploadTrig();
    await prepareIntake(sourceId);
    await matcherJob(sourceId);
    // The trig Director fixture was authored against these hand-picked matches (see orchestrator.test.ts).
    await getStorage().putMatch(sourceId, [...trigMatches]);

    const selection = ["c_period", "c_amplitude", "c_radians"];
    const { preCheck } = (await (await precheckFor(sourceId, selection)).json()) as { preCheck: Mcq[] };
    const forged = preCheck.map((m) => ({ ...m, choices: ["x1", "x2", "x3", "x4"], correctIndex: 0 }));
    const intake: Intake = {
      goal: "review",
      minutes: 5,
      genre: "dungeon",
      confidence: { u_angles: 3, u_graphs: 2, u_equations: 3 },
      preCheck: { items: forged, answers: [0, 0, 0] },
      conceptIds: selection,
    };
    const res = await postGames(jsonRequest("http://test/api/games", { sourceId, intake }));
    expect(res.status).toBe(202);
    const { jobId } = await res.json();

    const stored = await getStorage().getIntake(sourceId);
    expect(stored?.conceptIds).toEqual(selection);
    expect(stored?.preCheck.items).toEqual(preCheck);
    expect(stored?.preCheck.items).not.toEqual(forged);

    // Poll the job record rather than racing onClose(); a read that lands mid-write (the local driver
    // rewrites the file on every status change) comes back null and just means "not yet".
    const deadline = Date.now() + 60_000;
    let job = await getStorage().getJob(jobId);
    while (Date.now() < deadline && !(job && (job.status === "done" || job.status === "failed"))) {
      await new Promise((r) => setTimeout(r, 100));
      job = await getStorage().getJob(jobId);
    }
    expect(job?.error).toBeNull();
    expect(job?.status).toBe("done");

    const game = await getStorage().getGame(job!.gameId!);
    expect(game).not.toBeNull();
    const spec = game!.spec;
    expect(spec.concepts.map((c) => c.id).sort()).toEqual([...selection].sort());
    for (const e of spec.encounters) expect(e.conceptIds.every((id) => selection.includes(id))).toBe(true);
    for (const q of [...spec.assessment.pre, ...spec.assessment.post]) expect(selection).toContain(q.conceptId);
  }, 90_000);
});
