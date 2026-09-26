import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fixture from "../fixtures/trig-dungeon.json";
import { trigIntake, trigKnowledgeMap, trigMatches } from "../fixtures/trig.knowledge-map";
import type { GameSpec } from "../src/contracts/gamespec";
import type { JobRecord, PageRecord, SourceRecord } from "../src/contracts/storage";
import type { TelemetryEvent } from "../src/contracts/telemetry";
import { resetEnvCache } from "../src/server/env";
import { LocalDriver } from "../src/server/storage/local";

/*
 * Round-trips every StorageDriver method against a temp DATA_DIR. Each test gets its own driver
 * instance pointed at a fresh directory so tests never interfere with each other or with .data/.
 */

let dir: string;
let storage: LocalDriver;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "quest-forge-storage-"));
  process.env.DATA_DIR = dir;
  resetEnvCache();
  storage = new LocalDriver(dir);
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  resetEnvCache();
  await rm(dir, { recursive: true, force: true });
});

describe("LocalDriver", () => {
  it("round-trips a source record", async () => {
    const source: SourceRecord = {
      id: "src_1",
      kind: "pdf",
      title: "Trig notes",
      filename: "trig-notes.pdf",
      pageCount: 4,
      byteLength: 12345,
      createdAt: "2026-09-26T00:00:00.000Z",
      blobPath: "sources/src_1.pdf",
      topic: null,
    };
    expect(await storage.getSource("src_1")).toBeNull();
    await storage.putSource(source);
    expect(await storage.getSource("src_1")).toEqual(source);
  });

  it("round-trips pages for a source", async () => {
    const pages: PageRecord[] = [
      { sourceId: "src_1", page: 1, text: "Page one.", lowText: false },
      { sourceId: "src_1", page: 2, text: "", lowText: true },
    ];
    expect(await storage.getPages("src_1")).toEqual([]);
    await storage.putPages("src_1", pages);
    expect(await storage.getPages("src_1")).toEqual(pages);
  });

  it("round-trips a knowledge map", async () => {
    expect(await storage.getKnowledgeMap(trigKnowledgeMap.sourceId)).toBeNull();
    await storage.putKnowledgeMap(trigKnowledgeMap);
    expect(await storage.getKnowledgeMap(trigKnowledgeMap.sourceId)).toEqual(trigKnowledgeMap);
  });

  it("round-trips an intake", async () => {
    expect(await storage.getIntake("src_1")).toBeNull();
    await storage.putIntake("src_1", trigIntake);
    expect(await storage.getIntake("src_1")).toEqual(trigIntake);
  });

  it("round-trips matches", async () => {
    expect(await storage.getMatch("src_1")).toBeNull();
    await storage.putMatch("src_1", trigMatches);
    expect(await storage.getMatch("src_1")).toEqual(trigMatches);
  });

  it("round-trips a game and lists it in listGames", async () => {
    const spec = fixture as unknown as GameSpec;
    expect(await storage.getGame(spec.id)).toBeNull();
    await storage.putGame({ id: spec.id, sourceId: trigKnowledgeMap.sourceId, jobId: "job_1", createdAt: "2026-09-26T02:00:00.000Z", spec });
    const got = await storage.getGame(spec.id);
    expect(got?.spec).toEqual(spec);
    const list = await storage.listGames();
    expect(list).toEqual([
      { id: spec.id, sourceId: trigKnowledgeMap.sourceId, title: spec.title, genre: spec.genre, createdAt: "2026-09-26T02:00:00.000Z", encounterCount: spec.encounters.length },
    ]);
  });

  it("round-trips a job", async () => {
    const job: JobRecord = {
      id: "job_1",
      sourceId: "src_1",
      status: "running",
      gameId: null,
      error: null,
      createdAt: "2026-09-26T00:00:00.000Z",
      updatedAt: "2026-09-26T00:00:00.000Z",
    };
    expect(await storage.getJob("job_1")).toBeNull();
    await storage.putJob(job);
    expect(await storage.getJob("job_1")).toEqual(job);
  });

  it("appends and returns progress events in order", async () => {
    expect(await storage.getEvents("job_1")).toEqual([]);
    await storage.appendEvents("job_1", [{ jobId: "job_1", agent: "director", status: "start" }]);
    await storage.appendEvents("job_1", [{ jobId: "job_1", agent: "director", status: "done", ms: 5 }]);
    expect(await storage.getEvents("job_1")).toEqual([
      { jobId: "job_1", agent: "director", status: "start" },
      { jobId: "job_1", agent: "director", status: "done", ms: 5 },
    ]);
  });

  it("appends and returns telemetry in order", async () => {
    const e1: TelemetryEvent = {
      gameId: "game_1",
      encounterId: "e1",
      conceptIds: ["c1"],
      teachingMechanicId: "phase_gate",
      attempt: 1,
      correct: true,
      hintsUsed: 0,
      ms: 4200,
      at: "2026-09-26T02:05:00.000Z",
    };
    expect(await storage.getTelemetry("game_1")).toEqual([]);
    await storage.appendTelemetry("game_1", [e1]);
    expect(await storage.getTelemetry("game_1")).toEqual([e1]);
  });

  it("round-trips a blob and reports its URL", async () => {
    const bytes = new TextEncoder().encode("hello pdf");
    const path = await storage.putBlob("sources/src_1.pdf", bytes, "application/pdf");
    expect(path).toBe("sources/src_1.pdf");
    expect(Uint8Array.from((await storage.getBlob("sources/src_1.pdf"))!)).toEqual(bytes);
    expect(storage.blobUrl("sources/src_1.pdf")).toBe("/api/blobs/sources/src_1.pdf");
  });

  it("rejects blob paths that escape the blobs directory", async () => {
    await expect(storage.putBlob("../evil.txt", new Uint8Array(), "text/plain")).rejects.toThrow();
    expect(await storage.getBlob("../evil.txt")).toBeNull();
  });
});
