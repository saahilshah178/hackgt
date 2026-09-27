import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fixtureSpec from "../fixtures/trig-dungeon.json";
import type { GameRecord } from "../src/contracts/storage";
import { GET as getSource } from "../src/app/api/sources/[id]/route";
import { MAX_FILE_BYTES, MAX_TEXT_CHARS, POST as postSources } from "../src/app/api/sources/route";
import { GET as getBlob } from "../src/app/api/blobs/[...path]/route";
import { POST as postTelemetry } from "../src/app/api/games/[id]/telemetry/route";
import { resetEnvCache } from "../src/server/env";
import { getStorage, resetStorage } from "../src/server/storage";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "quest-forge-api-"));
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

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/sources", () => {
  it("stores a topic source with zero pages", async () => {
    const res = await postSources(jsonRequest("http://test/api/sources", { topic: "Photosynthesis" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ kind: "topic", title: "Photosynthesis", pageCount: 0 });
    const stored = await getStorage().getSource(json.sourceId);
    expect(stored?.topic).toBe("Photosynthesis");
  });

  it("stores a text source, splitting it into pages", async () => {
    const text = "Sentence one. Sentence two. Sentence three. ".repeat(60);
    const res = await postSources(jsonRequest("http://test/api/sources", { text, title: "My notes" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.kind).toBe("text");
    expect(json.title).toBe("My notes");
    expect(json.pageCount).toBeGreaterThan(1);
    const pages = await getStorage().getPages(json.sourceId);
    expect(pages).toHaveLength(json.pageCount);
  });

  it("rejects a malformed JSON body", async () => {
    const res = await postSources(jsonRequest("http://test/api/sources", { nonsense: true }));
    expect(res.status).toBe(400);
  });

  it("stores a PDF upload via multipart/form-data", async () => {
    const bytes = await readFile("samples/trig-notes.pdf");
    const form = new FormData();
    form.set("file", new File([bytes], "trig-notes.pdf", { type: "application/pdf" }));
    const res = await postSources(new Request("http://test/api/sources", { method: "POST", body: form }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ kind: "pdf", title: "trig-notes", pageCount: 4 });

    const pages = await getStorage().getPages(json.sourceId);
    expect(pages).toHaveLength(4);

    const blobRes = await getBlob(new Request("http://test/api/blobs"), {
      params: Promise.resolve({ path: ["sources", `${json.sourceId}.pdf`] }),
    });
    expect(blobRes.status).toBe(200);
    expect(blobRes.headers.get("content-type")).toBe("application/pdf");
  });

  it("accepts a 41-page PDF (there is no page cap; whole books are read in parts)", async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 41; i++) doc.addPage([200, 200]);
    const bytes = await doc.save();
    const form = new FormData();
    form.set("file", new File([new Uint8Array(bytes)], "big.pdf", { type: "application/pdf" }));
    const res = await postSources(new Request("http://test/api/sources", { method: "POST", body: form }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ kind: "pdf", title: "big", pageCount: 41 });
    expect(await getStorage().getPages(json.sourceId)).toHaveLength(41);
  });

  it("rejects bytes that are not a PDF with 400", async () => {
    const form = new FormData();
    form.set("file", new File([new TextEncoder().encode("not a pdf at all")], "notes.pdf", { type: "application/pdf" }));
    const res = await postSources(new Request("http://test/api/sources", { method: "POST", body: form }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Could not read/);
  });

  // M9: reject oversized input with 4xx before the heavier work (PDF decode, page splitting) runs.
  it("rejects a file over the size limit with 413, before decoding it as a PDF", async () => {
    const oversized = new Uint8Array(MAX_FILE_BYTES + 1);
    const form = new FormData();
    form.set("file", new File([oversized], "huge.pdf", { type: "application/pdf" }));
    const res = await postSources(new Request("http://test/api/sources", { method: "POST", body: form }));
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.error).toMatch(/200 MB/);
  });

  it("rejects text over the character limit with 400", async () => {
    const res = await postSources(jsonRequest("http://test/api/sources", { text: "a".repeat(MAX_TEXT_CHARS + 1) }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/2,000,000/);
  });

  it("rejects a topic over 200 characters with 400", async () => {
    const res = await postSources(jsonRequest("http://test/api/sources", { topic: "a".repeat(201) }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/200/);
  });

  it("accepts text right at the character limit", async () => {
    const res = await postSources(jsonRequest("http://test/api/sources", { text: "a".repeat(MAX_TEXT_CHARS) }));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/sources/[id]", () => {
  it("returns 404 for an unknown id", async () => {
    const res = await getSource(new Request("http://test/api/sources/nope"), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });

  it("returns the stored record and page count", async () => {
    const created = await postSources(jsonRequest("http://test/api/sources", { topic: "Osmosis" }));
    const { sourceId } = await created.json();
    const res = await getSource(new Request(`http://test/api/sources/${sourceId}`), { params: Promise.resolve({ id: sourceId }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    // instructions.md §9: SourceRecord & { pageCount }, flat (not nested under `source`).
    expect(json.id).toBe(sourceId);
    expect(json.pageCount).toBe(0);
  });
});

describe("POST /api/games/[id]/telemetry", () => {
  it("returns 404 for a game that was never stored (and isn't a fixture)", async () => {
    const res = await postTelemetry(jsonRequest("http://test/api/games/no_such_game/telemetry", []), {
      params: Promise.resolve({ id: "no_such_game" }),
    });
    expect(res.status).toBe(404);
  });

  it("appends valid telemetry events", async () => {
    // POST /api/games/[id]/telemetry now materializes the game before accepting telemetry for it
    // (src/server/fixtures.ts), so a plain (non-fixture) game id must already be stored.
    const record: GameRecord = { id: "game_1", sourceId: "src_1", jobId: null, createdAt: new Date().toISOString(), spec: fixtureSpec as GameRecord["spec"] };
    await getStorage().putGame(record);

    const events = [
      {
        gameId: "game_1",
        encounterId: "e1",
        conceptIds: ["c1"],
        teachingMechanicId: "phase_gate",
        attempt: 1,
        correct: true,
        hintsUsed: 0,
        ms: 3000,
        at: "2026-09-26T02:00:00.000Z",
      },
    ];
    const res = await postTelemetry(jsonRequest("http://test/api/games/game_1/telemetry", events), {
      params: Promise.resolve({ id: "game_1" }),
    });
    expect(res.status).toBe(200);
    expect(await getStorage().getTelemetry("game_1")).toEqual(events);
  });

  it("rejects an event whose gameId doesn't match the route", async () => {
    const events = [
      { gameId: "other", encounterId: "e1", conceptIds: ["c1"], teachingMechanicId: "phase_gate", attempt: 1, correct: true, hintsUsed: 0, ms: 1, at: "2026-09-26T02:00:00.000Z" },
    ];
    const res = await postTelemetry(jsonRequest("http://test/api/games/game_1/telemetry", events), {
      params: Promise.resolve({ id: "game_1" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid payload", async () => {
    const res = await postTelemetry(jsonRequest("http://test/api/games/game_1/telemetry", { not: "an array" }), {
      params: Promise.resolve({ id: "game_1" }),
    });
    expect(res.status).toBe(400);
  });
});
