import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { trigIntake, trigKnowledgeMap, trigMatches } from "../fixtures/trig.knowledge-map";
import { POST as postGames } from "../src/app/api/games/route";
import { POST as postSources } from "../src/app/api/sources/route";
import { prepareIntake, matcherJob, resetMatcherJobs } from "../src/pipeline/agents/intake";
import { resetEnvCache } from "../src/server/env";
import { getStorage, resetStorage } from "../src/server/storage";

/*
 * POST /api/games must never trust the client's pre-check `items` (they carry `correctIndex`): a
 * modified item could let a student report a perfect pre-check score regardless of what they actually
 * answered. When a prep record exists (GET /api/sources/:id/intake already ran), only the client's
 * `answers` are kept; the items come from the server's own record. See instructions.md's pipeline-dev
 * brief ("Low" section).
 */

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "quest-forge-games-route-"));
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

describe("POST /api/games: never trusts client-sent pre-check items", () => {
  it("keeps the server's own pre-check items and only accepts the client's answers", async () => {
    const bytes = await readFile("samples/trig-notes.pdf");
    const form = new FormData();
    form.set("file", new File([bytes], "trig-notes.pdf", { type: "application/pdf" }));
    const uploadRes = await postSources(new Request("http://test/api/sources", { method: "POST", body: form }));
    const { sourceId } = await uploadRes.json();

    const prepped = await prepareIntake(sourceId);
    await matcherJob(sourceId);
    expect(prepped.preCheck).toHaveLength(3);

    // A malicious client: same shape, but every item claims a different correct answer and every
    // choice is rewritten, and it "answers" to match its own forged correctIndex (a fake perfect score).
    const forgedItems = prepped.preCheck.map((mcq) => ({ ...mcq, choices: ["forged a", "forged b", "forged c", "forged d"], correctIndex: 0 }));
    const forgedAnswers = forgedItems.map(() => 0);

    const res = await postGames(
      jsonRequest("http://test/api/games", {
        sourceId,
        intake: {
          goal: "review",
          minutes: 5,
          genre: "dungeon",
          confidence: { u_angles: 3, u_graphs: 3, u_equations: 3 },
          preCheck: { items: forgedItems, answers: forgedAnswers },
        },
      }),
    );
    expect(res.status).toBe(202);

    const storedIntake = await getStorage().getIntake(sourceId);
    expect(storedIntake).not.toBeNull();
    // the server's real items, not the forged ones
    expect(storedIntake!.preCheck.items).toEqual(prepped.preCheck);
    expect(storedIntake!.preCheck.items).not.toEqual(forgedItems);
    // the client's answers ARE kept as sent
    expect(storedIntake!.preCheck.answers).toEqual(forgedAnswers);
  });

  it("accepts the client's items as-is when there is no prep record (e.g. a hand-built test intake)", async () => {
    // A knowledge map stored directly (bypassing prepareIntake, as fixtures/tests do) has no
    // prep/<sourceId>.json record, so POST /api/games must fall back to trusting the client's items.
    const sourceId = trigKnowledgeMap.sourceId;
    await getStorage().putSource({
      id: sourceId,
      kind: "text",
      title: trigKnowledgeMap.title,
      filename: null,
      pageCount: 4,
      byteLength: 0,
      createdAt: new Date().toISOString(),
      blobPath: null,
      topic: null,
    });
    await getStorage().putKnowledgeMap(trigKnowledgeMap);
    await getStorage().putMatch(sourceId, [...trigMatches]);

    const res = await postGames(jsonRequest("http://test/api/games", { sourceId, intake: trigIntake }));
    expect(res.status).toBe(202);

    const storedIntake = await getStorage().getIntake(sourceId);
    expect(storedIntake!.preCheck.items).toEqual(trigIntake.preCheck.items);
  });
});
