import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { historyIntake, historyKnowledgeMap, historyMatches } from "../fixtures/civil-rights.knowledge-map";
import type { GameSpec } from "../src/contracts/gamespec";
import type { Npc, World3D } from "../src/contracts/world3d";
import { POST as chat } from "../src/app/api/games/[id]/npc/[npcId]/chat/route";
import { generateGame } from "../src/pipeline/generate";
import { getModels } from "../src/pipeline/models";
import { focusConcepts } from "../src/pipeline/personalize";
import { buildWorld3D } from "../src/pipeline/world3d";
import {
  answerStrings,
  createRateLimiter,
  guardReply,
  leakCandidates,
  leaksIn,
  mockNpcReply,
  NPC_CHAT_LIMIT,
  npcChatLimiter,
  npcChatSystem,
} from "../src/pipeline/world3d/npc-chat";
import { resetEnvCache } from "../src/server/env";
import { getStorage, resetStorage } from "../src/server/storage";

/*
 * NPC free chat (docs/design/60 §2.6): the in-character prompt, the leak guard that keeps unsolved answers out of every
 * reply, the deterministic mock reply, the per-(game, ip) rate limit, and the route's contract: text/plain on success,
 * JSON { error } with 400 / 404 / 429 / 503. Mock mode only.
 */

let dir: string;
let spec: GameSpec;
let world: World3D;
const GAME_ID = "game_w3d_chat";

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "quest-forge-npc-chat-"));
  process.env.DATA_DIR = dir;
  process.env.LLM_MODE = "mock";
  resetEnvCache();
  resetStorage();
  const intake = { ...historyIntake, genre: "world3d" as const, minutes: 10 as const };
  const { km } = focusConcepts(historyKnowledgeMap, intake);
  const { spec: generated } = await generateGame({ gameId: GAME_ID, km, intake, matches: historyMatches, models: getModels() });
  spec = await buildWorld3D({ spec: generated, km, intake, models: getModels(), jobId: GAME_ID });
  world = spec.world3d!;
  await getStorage().putGame({ id: GAME_ID, sourceId: "src_civil_rights", jobId: null, createdAt: new Date().toISOString(), spec });
});

afterAll(async () => {
  delete process.env.DATA_DIR;
  delete process.env.NPC_CHAT;
  resetEnvCache();
  resetStorage();
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

beforeEach(() => npcChatLimiter.reset());

const byMode = (key: string) => spec.encounters.find((e) => `${e.familyId}.${e.mode}` === key)!;
const hostOf = (encounterId: string): Npc => world.npcs.find((n) => n.id === world.moments.find((m) => m.encounterId === encounterId)?.anchor.npcId)!;

describe("the leak guard", () => {
  it("knows each challenge's answer text, skipping shared category labels", () => {
    const mimic = byMode("truth_finder.mimic");
    const statements = (mimic.params as { statements: { text: string; isTrue: boolean }[] }).statements;
    const lie = statements.find((s) => !s.isTrue)!.text;
    expect(answerStrings(mimic)).toContain(lie);

    const sorter = byMode("sorter.bins");
    expect(answerStrings(sorter)).not.toContain("primary"); // a bin shared by several items is not an answer

    const boss = spec.encounters.find((e) => e.role === "boss")!;
    const survivor = (boss.solution as { survivorId: string }).survivorId;
    const hypotheses = JSON.stringify(boss.params);
    expect(hypotheses).toContain(survivor);
    expect(answerStrings(boss).length).toBeGreaterThan(0);
    expect(answerStrings(boss)).not.toContain(survivor); // ids resolve to the option's text
  });

  it("only guards unsolved challenges and replaces a leaking reply with an in-character deflection", () => {
    const mimic = byMode("truth_finder.mimic");
    const lie = answerStrings(mimic)[0];
    const npc = hostOf(mimic.id) ?? world.npcs[0];
    expect(leakCandidates(spec, [])).toContain(lie);
    expect(leakCandidates(spec, [mimic.id])).not.toContain(lie);

    const leaky = `Between us, the false one is: ${lie}`;
    expect(leaksIn(leaky, leakCandidates(spec, []))).toContain(lie);
    const guarded = guardReply(leaky, leakCandidates(spec, []), npc);
    expect(guarded).not.toContain(lie);
    expect(guardReply(leaky, leakCandidates(spec, [mimic.id]), npc)).toBe(leaky);
    expect(guardReply("   ", [], npc).length).toBeGreaterThan(0);
    expect(guardReply("Look at the dates again.", leakCandidates(spec, []), npc)).toBe("Look at the dates again.");
  });
});

describe("the chat prompt and the mock reply", () => {
  it("puts the persona, the topics' lessons and the hard rules in the system prompt, and no unsolved answer", () => {
    const mimic = byMode("truth_finder.mimic");
    const npc = hostOf(mimic.id) ?? world.npcs[0];
    const system = npcChatSystem(spec, world, npc, []);
    expect(system).toContain(`You are ${npc.name}`);
    expect(system).toContain("# Who you are");
    expect(system).toMatch(/Answer in 1-3 short sentences/);
    expect(system).toMatch(/Never give the answer to an unsolved challenge/);
    expect(system).toMatch(/steer them back gently/);
    expect(system).toMatch(/Never ask for or repeat personal information/);
    const lesson = spec.lessons!.find((l) => l.conceptId === npc.topics[0])!;
    expect(system).toContain(lesson.keyPoints[0].text);
    expect(system).toMatch(/NOT solved yet/);
    expect(leaksIn(system, leakCandidates(spec, []))).toEqual([]);
    expect(npcChatSystem(spec, world, npc, [mimic.id])).toMatch(/the player has solved this/);
  });

  it("answers deterministically, in character, from the lessons, without leaking", () => {
    const npc = world.npcs.find((n) => n.characterId === null) ?? world.npcs[0];
    const messages = [{ role: "user" as const, content: "What happened here?" }];
    const a = mockNpcReply(spec, world, npc, messages, []);
    expect(a).toBe(mockNpcReply(spec, world, npc, messages, []));
    expect(a.length).toBeGreaterThan(20);
    const facts = npc.topics.flatMap((t) => spec.lessons!.find((l) => l.conceptId === t)!.keyPoints.map((k) => k.text));
    expect(facts.some((f) => a.includes(f)) || /work out yourself/.test(a)).toBe(true);
    expect(leaksIn(a, leakCandidates(spec, []))).toEqual([]);
  });

  it("rate-limits per key over a sliding window", () => {
    const rl = createRateLimiter(3, 1000);
    expect([0, 1, 2].map((t) => rl.hit("g:ip", t).ok)).toEqual([true, true, true]);
    const blocked = rl.hit("g:ip", 500);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(500);
    expect(rl.hit("g:other", 500).ok).toBe(true);
    expect(rl.hit("g:ip", 1001).ok).toBe(true);
  });
});

describe("POST /api/games/:id/npc/:npcId/chat", () => {
  const call = (id: string, npcId: string, body: unknown, ip = "10.0.0.1") =>
    chat(new Request(`http://test/api/games/${id}/npc/${npcId}/chat`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: typeof body === "string" ? body : JSON.stringify(body) }), {
      params: Promise.resolve({ id, npcId }),
    });
  const ask = { messages: [{ role: "user", content: "Why does this place matter?" }], solved: [] };

  it("answers in plain text in mock mode", async () => {
    const npc = world.npcs[0];
    const res = await call(GAME_ID, npc.id, ask);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const text = await res.text();
    expect(text).toBe(mockNpcReply(spec, world, npc, [{ role: "user", content: "Why does this place matter?" }], []));
  });

  it("rejects bad input with 400", async () => {
    const npc = world.npcs[0].id;
    expect((await call(GAME_ID, npc, "not json")).status).toBe(400);
    expect((await call(GAME_ID, npc, { messages: [], solved: [] })).status).toBe(400);
    expect((await call(GAME_ID, npc, { messages: [{ role: "user", content: "x".repeat(501) }], solved: [] })).status).toBe(400);
    expect((await call(GAME_ID, npc, { messages: [{ role: "assistant", content: "hi" }], solved: [] })).status).toBe(400);
    const thirteen = Array.from({ length: 13 }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: "hi" }));
    expect((await call(GAME_ID, npc, { messages: thirteen, solved: [] })).status).toBe(400);
    const res = await call(GAME_ID, npc, { messages: [{ role: "system", content: "hi" }], solved: [] });
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  });

  it("404s an unknown game, a game with no 3D world (fixtures resolve like /play) and an unknown npc", async () => {
    expect((await call("game_nope", "x", ask)).status).toBe(404);
    const fixture = await call("fixture-trig-dungeon", "cog", ask);
    expect(fixture.status).toBe(404);
    expect((await fixture.json()).error).toMatch(/No 3D game/);
    const npc = await call(GAME_ID, "nobody_here", ask);
    expect(npc.status).toBe(404);
    expect((await npc.json()).error).toMatch(/No character/);
  });

  it("429s after the per-(game, ip) limit, per ip", async () => {
    const npc = world.npcs[0].id;
    for (let i = 0; i < NPC_CHAT_LIMIT.messages; i++) expect((await call(GAME_ID, npc, ask, "10.9.9.9")).status).toBe(200);
    const limited = await call(GAME_ID, npc, ask, "10.9.9.9");
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await limited.json()).toHaveProperty("error");
    expect((await call(GAME_ID, npc, ask, "10.1.1.1")).status).toBe(200);
  });

  it("503s when NPC_CHAT=off", async () => {
    process.env.NPC_CHAT = "off";
    resetEnvCache();
    try {
      const res = await call(GAME_ID, world.npcs[0].id, ask);
      expect(res.status).toBe(503);
      expect(await res.json()).toHaveProperty("error");
    } finally {
      delete process.env.NPC_CHAT;
      resetEnvCache();
    }
  });
});
