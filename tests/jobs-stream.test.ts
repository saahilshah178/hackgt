import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { JobRecord } from "../src/contracts/storage";
import { GET as getStream } from "../src/app/api/jobs/[id]/stream/route";
import { resetEnvCache } from "../src/server/env";
import { getStorage, resetStorage } from "../src/server/storage";

/*
 * M7: the in-memory event bus (src/pipeline/events.ts) is empty after a process restart or an HMR
 * reload. A late GET /api/jobs/[id]/stream for a job that already finished in a PREVIOUS process must
 * replay from persisted storage and close immediately, instead of subscribing to a bus that will
 * never emit "done" again (which would hang until the client gives up).
 */

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "quest-forge-jobs-stream-"));
  process.env.DATA_DIR = dir;
  resetEnvCache();
  resetStorage();
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  resetEnvCache();
  resetStorage();
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

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

describe("GET /api/jobs/[id]/stream: replay from storage (M7)", () => {
  it("replays persisted events and done for a finished job the in-memory bus never saw", async () => {
    const storage = getStorage();
    const job: JobRecord = {
      id: "job_restarted",
      sourceId: "src_1",
      status: "done",
      gameId: "game_1",
      error: null,
      createdAt: "2026-09-26T00:00:00.000Z",
      updatedAt: "2026-09-26T00:00:01.000Z",
    };
    await storage.putJob(job);
    await storage.appendEvents("job_restarted", [
      { jobId: "job_restarted", agent: "director", status: "start" },
      { jobId: "job_restarted", agent: "director", status: "done", ms: 5 },
    ]);

    const res = await getStream(new Request("http://test/api/jobs/job_restarted/stream"), { params: Promise.resolve({ id: "job_restarted" }) });
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    const text = await readSse(res); // must resolve (the stream closes itself) instead of hanging
    expect(text).toContain('event: progress\ndata: {"jobId":"job_restarted","agent":"director","status":"start"}');
    expect(text).toMatch(/event: done\ndata: \{"done":true,"gameId":"game_1","error":null\}/);
  });

  it("returns done immediately for a failed job with no live bus history", async () => {
    const storage = getStorage();
    const job: JobRecord = {
      id: "job_failed_restarted",
      sourceId: "src_1",
      status: "failed",
      gameId: null,
      error: "boom",
      createdAt: "2026-09-26T00:00:00.000Z",
      updatedAt: "2026-09-26T00:00:01.000Z",
    };
    await storage.putJob(job);

    const res = await getStream(new Request("http://test/api/jobs/job_failed_restarted/stream"), { params: Promise.resolve({ id: "job_failed_restarted" }) });
    const text = await readSse(res);
    expect(text).toMatch(/event: done\ndata: \{"done":true,"gameId":null,"error":"boom"\}/);
  });

  it("returns 404 for an unknown job", async () => {
    const res = await getStream(new Request("http://test/api/jobs/nope/stream"), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });
});
