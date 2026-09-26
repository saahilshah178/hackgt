import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatekeeperSlice } from "../src/contracts/slices";
import { matcherJob, resetMatcherJobs } from "../src/pipeline/agents/intake";
import { resetEnvCache } from "../src/server/env";
import { getStorage, resetStorage } from "../src/server/storage";

/*
 * M6: when the Gatekeeper (S1) says the material isn't educational or is too small, prepareIntake()
 * must stop right there (never run S2 curriculum) and GET /api/sources/[id]/intake must answer 422
 * { error, step: "gatekeeper" }, which the intake page shows as `error`. tooBig keeps going (the
 * outline checklist handles it), so it must NOT be rejected here.
 */

const baseGatekeeper: GatekeeperSlice = {
  educational: true,
  estimatedConcepts: 10,
  tooBig: false,
  tooSmall: false,
  outline: [],
  followUps: [],
};

let dir: string;
let runGatekeeperMock: ReturnType<typeof vi.fn>;

vi.mock("../src/pipeline/agents/gatekeeper", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/pipeline/agents/gatekeeper")>();
  return { ...actual, runGatekeeper: vi.fn() };
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "quest-forge-gatekeeper-"));
  process.env.DATA_DIR = dir;
  resetEnvCache();
  resetStorage();
  resetMatcherJobs();
});

afterEach(async () => {
  await matcherJob("src_test_gate"); // let the background S4 matcher (started once the gatekeeper passes) finish before cleanup
  delete process.env.DATA_DIR;
  resetEnvCache();
  resetStorage();
  vi.clearAllMocks();
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

async function setupSource(): Promise<string> {
  const storage = getStorage();
  const id = "src_test_gate";
  await storage.putSource({
    id,
    kind: "text",
    title: "Some notes",
    filename: null,
    pageCount: 1,
    byteLength: 10,
    createdAt: new Date().toISOString(),
    blobPath: null,
    topic: null,
  });
  await storage.putPages(id, [{ sourceId: id, page: 1, text: "Some notes about nothing in particular.", lowText: false }]);
  return id;
}

describe("GET /api/sources/[id]/intake: gatekeeper rejection (M6)", () => {
  it("returns 422 { error, step: 'gatekeeper' } when the material isn't educational", async () => {
    const { runGatekeeper } = await import("../src/pipeline/agents/gatekeeper");
    (runGatekeeper as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ...baseGatekeeper, educational: false });

    const id = await setupSource();
    const { GET } = await import("../src/app/api/sources/[id]/intake/route");
    const res = await GET(new Request(`http://test/api/sources/${id}/intake`), { params: Promise.resolve({ id }) });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.step).toBe("gatekeeper");
    expect(typeof json.error).toBe("string");
    // never reached S2 curriculum / stored a knowledge map
    expect(await getStorage().getKnowledgeMap(id)).toBeNull();
  });

  it("returns 422 when the material is too small", async () => {
    const { runGatekeeper } = await import("../src/pipeline/agents/gatekeeper");
    (runGatekeeper as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ...baseGatekeeper, tooSmall: true });

    const id = await setupSource();
    const { GET } = await import("../src/app/api/sources/[id]/intake/route");
    const res = await GET(new Request(`http://test/api/sources/${id}/intake`), { params: Promise.resolve({ id }) });

    expect(res.status).toBe(422);
    expect((await res.json()).step).toBe("gatekeeper");
  });

  it("keeps going (200) when the material is merely too big", async () => {
    const { runGatekeeper } = await import("../src/pipeline/agents/gatekeeper");
    (runGatekeeper as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ...baseGatekeeper, tooBig: true });

    const id = await setupSource();
    const { GET } = await import("../src/app/api/sources/[id]/intake/route");
    const res = await GET(new Request(`http://test/api/sources/${id}/intake`), { params: Promise.resolve({ id }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.gatekeeper.tooBig).toBe(true);
  });
});
