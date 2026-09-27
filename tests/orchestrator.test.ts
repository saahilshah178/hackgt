import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cellIntake, cellMatches } from "../fixtures/cell-transport.knowledge-map";
import type { JobDone } from "../src/contracts/progress";
import { GET as getGame } from "../src/app/api/games/[id]/route";
import { POST as postPostcheck } from "../src/app/api/games/[id]/postcheck/route";
import { POST as postRegenerate } from "../src/app/api/games/[id]/regenerate/route";
import { GET as getJob } from "../src/app/api/jobs/[id]/route";
import { GET as getStream } from "../src/app/api/jobs/[id]/stream/route";
import { POST as postSources } from "../src/app/api/sources/route";
import { EncounterRunner } from "../src/game/runner/encounter-runner";
import { prepareIntake, matcherJob, resetMatcherJobs } from "../src/pipeline/agents/intake";
import { onClose } from "../src/pipeline/events";
import { startGameJob } from "../src/pipeline/orchestrator";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";
import { resetEnvCache } from "../src/server/env";
import { getStorage, resetStorage } from "../src/server/storage";

/*
 * Mock end-to-end test for P6: a real upload becomes a validated, playable GameSpec through the
 * actual HTTP route handlers and the job orchestrator, entirely in mock mode. See instructions.md §9
 * and MEGAPROMPT §3/§9 (phase P6).
 */

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "quest-forge-orchestrator-"));
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

function waitForJob(jobId: string): Promise<JobDone> {
  return new Promise((resolve) => onClose(jobId, resolve));
}

async function readSse(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value);
  }
  return text;
}

describe("the mock golden path: upload -> intake -> job -> game", () => {
  it("produces a validated, playable 11-encounter GameSpec with lessons and streams progress to done", async () => {
    const bytes = await readFile("samples/cell-transport.pdf");
    const form = new FormData();
    form.set("file", new File([bytes], "cell-transport.pdf", { type: "application/pdf" }));
    const uploadRes = await postSources(new Request("http://test/api/sources", { method: "POST", body: form }));
    expect(uploadRes.status).toBe(200);
    const { sourceId } = await uploadRes.json();

    await prepareIntake(sourceId);
    await matcherJob(sourceId);
    // The Director's mock reply (fixtures/cell-transport.slices.ts's cellBlueprint) was authored
    // against the hand-picked cellMatches, not whatever the real (code-only, no LLM) retrieval
    // scorer ranks top for this run: pin matches to the fixture so the Director's dynamic schema
    // (built from the matcher's shortlist) accepts the same card choices cellBlueprint makes.
    await getStorage().putMatch(sourceId, cellMatches);

    // 15 minutes holds all 9 concepts; at 10 the job would focus down to 7 (focusConcepts, tested in personalize.test.ts)
    // cellIntake asks for the withdrawn dungeon: the job plays an offered genre instead
    const { jobId } = await startGameJob({ sourceId, intake: { ...cellIntake, minutes: 15 } });
    const done = await waitForJob(jobId);
    expect(done).toEqual({ done: true, gameId: expect.any(String), error: null });
    const gameId = done.gameId!;

    const jobRes = await getJob(new Request(`http://test/api/jobs/${jobId}`), { params: Promise.resolve({ id: jobId }) });
    expect(jobRes.status).toBe(200);
    expect((await jobRes.json()).status).toBe("done");

    const gameRes = await getGame(new Request(`http://test/api/games/${gameId}`), { params: Promise.resolve({ id: gameId }) });
    expect(gameRes.status).toBe(200);
    const record = await gameRes.json();
    expect(["mystery", "strategy", "explorer", "story"]).toContain(record.spec.genre);
    expect(record.spec.lessons.map((l: { conceptId: string }) => l.conceptId)).toEqual(record.spec.concepts.map((c: { id: string }) => c.id));
    expect(record.spec.encounters).toHaveLength(11);
    const validated = validateGameSpec(record.spec);
    expect(validated.ok).toBe(true);

    // the whole game auto-solves headlessly (EncounterRunner: no Phaser involved)
    const runner = new EncounterRunner(record.spec);
    let guard = 0;
    while (!runner.finished && guard++ < 50) {
      const result = runner.autoSolve();
      expect(result.correct).toBe(true);
    }
    expect(runner.finished).toBe(true);
    expect(runner.telemetry()).toHaveLength(11);

    // the SSE stream replays history and ends with done, for a job that already finished
    const streamRes = await getStream(new Request(`http://test/api/jobs/${jobId}/stream`), { params: Promise.resolve({ id: jobId }) });
    expect(streamRes.headers.get("content-type")).toBe("text/event-stream");
    const text = await readSse(streamRes);
    expect(text).toContain("event: progress");
    expect(text).toMatch(new RegExp(`event: done\\ndata: \\{"done":true,"gameId":"${gameId}","error":null\\}`));

    // regenerate reuses the KnowledgeMap/intake/matches. Explicit "dungeon" rather than "auto": the
    // recorded mock replies (director + challenge writers) are dungeon-shaped, and genre auto-select
    // now also considers "mystery" (engine-dev's build lands independently of this test), which mock
    // mode can't answer for this fixture. "auto" is exercised at the resolveGenre() unit level instead.
    const regenRes = await postRegenerate(
      new Request(`http://test/api/games/${gameId}/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ genre: "dungeon" }),
      }),
      { params: Promise.resolve({ id: gameId }) },
    );
    expect(regenRes.status).toBe(202);
    const { jobId: jobId2 } = await regenRes.json();
    expect(jobId2).not.toBe(jobId);
    const done2 = await waitForJob(jobId2);
    expect(done2.error).toBeNull();
    expect(done2.gameId).toBeTruthy();
    const game2 = await getStorage().getGame(done2.gameId!);
    expect(game2).not.toBeNull();
    expect(validateGameSpec(game2!.spec).ok).toBe(true);

    // postcheck stores the answers and scores pre/post against the spec's assessment
    const answers = record.spec.assessment.post.map((q: { correctIndex: number }) => q.correctIndex);
    const postcheckRes = await postPostcheck(
      new Request(`http://test/api/games/${gameId}/postcheck`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers }),
      }),
      { params: Promise.resolve({ id: gameId }) },
    );
    expect(postcheckRes.status).toBe(200);
    const postcheck = await postcheckRes.json();
    expect(postcheck).toEqual({ ok: true, pre: expect.any(Number), post: 3 });
  });
});
