import { MockLanguageModelV4 } from "ai/test";
import { beforeAll, describe, expect, it } from "vitest";
import { trigIntake, trigKnowledgeMap, trigMatches } from "../fixtures/trig.knowledge-map";
import type { GameSpec } from "../src/contracts/gamespec";
import type { Intake, KnowledgeMap } from "../src/contracts/knowledge";
import type { World3D } from "../src/contracts/world3d";
import { STORY_CRITERIA, WORLD_CRITERIA, type World3DArchitectSlice } from "../src/contracts/world3d-slices";
import { history } from "../src/pipeline/events";
import { generateGame } from "../src/pipeline/generate";
import { getModels } from "../src/pipeline/models";
import { focusConcepts } from "../src/pipeline/personalize";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";
import { buildWorld3D } from "../src/pipeline/world3d";
import { architectPrompt, fromSlice, runArchitect, WORLD_ARCHITECT_SYSTEM, worldToSlice } from "../src/pipeline/world3d/architect";
import { checkWorld } from "../src/pipeline/world3d/checks";
import { CRITIC_MIN_SCORE, CRITIC_PASS_MEAN, criticPasses, STORY_CRITIC_SYSTEM, WORLD_CRITIC_SYSTEM } from "../src/pipeline/world3d/critics";
import { composeFallbackWorld } from "../src/pipeline/world3d/fallback";
import { resetEnvCache } from "../src/server/env";
import { HUD_BUDGET, worldDigest } from "../src/world3d/core/digest";

/*
 * The live path of S10 (docs/design/60 §2.5) driven by scripted mock models: the World Architect's code-check repair
 * loop, the fallback when Astra never gets it right, and the critics' fail → one repair round → pass cycle with the
 * reports stored in world3d.provenance.reviews. No network: every model is a MockLanguageModelV4.
 */

type Gen = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;
type Call = { system: string; user: string };

function reply(value: unknown): Gen {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    finishReason: { unified: "stop", raw: "stop" },
    usage: { inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 50, text: 50, reasoning: 0 } },
    warnings: [],
  } as unknown as Gen;
}

/** A mock model that records every call and answers with `answer(call, n)` (n = 1-based call count for that system prompt). */
function scripted(modelId: string, answer: (call: Call, n: number) => unknown): { model: MockLanguageModelV4; calls: Call[] } {
  const calls: Call[] = [];
  const counts = new Map<string, number>();
  const model = new MockLanguageModelV4({
    modelId,
    doGenerate: async (options) => {
      const system = options.prompt.filter((m) => m.role === "system").map((m) => m.content as string).join("\n");
      const user = options.prompt
        .filter((m) => m.role === "user")
        .flatMap((m) => (m.content as { type: string; text?: string }[]).map((p) => p.text ?? ""))
        .join("\n");
      const call = { system, user };
      calls.push(call);
      const key = system.slice(0, 30);
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return reply(answer(call, n));
    },
  });
  return { model, calls };
}

function critique(criteria: readonly string[], score: (c: string) => number, issues: { target: string; problem: string; fix: string }[] = []) {
  return {
    scores: Object.fromEntries(criteria.map((c) => [c, { score: score(c), note: `${c} looks ${score(c) >= 3 ? "fine" : "weak"}` }])),
    issues,
    pass: issues.length === 0,
  };
}

let spec: GameSpec;
let km: KnowledgeMap;
let intake: Intake;
let good: World3DArchitectSlice;

/** Astra's usual first-draft mistakes: no goal role, and a moment anchored to an npc that does not exist. */
function broken(): World3DArchitectSlice {
  const s = structuredClone(good);
  s.landmarks = s.landmarks.map((l) => (l.role === "goal" ? { ...l, role: "poi" } : l));
  s.moments[0] = { ...s.moments[0], anchor: { npcId: "ghost", landmarkId: null } };
  return s;
}

beforeAll(async () => {
  process.env.LLM_MODE = "mock";
  resetEnvCache();
  intake = { ...trigIntake, genre: "world3d", minutes: 5 };
  km = focusConcepts(trigKnowledgeMap, intake).km;
  spec = (await generateGame({ gameId: "w3d_arch", km, intake, matches: trigMatches, models: getModels() })).spec;
  good = worldToSlice(composeFallbackWorld(spec, km));
});

describe("the World Architect", () => {
  it("writes a prompt with the game, the catalog and the map, but never the answers", () => {
    const p = architectPrompt(spec, km, intake);
    expect(WORLD_ARCHITECT_SYSTEM.startsWith("You are the World Architect")).toBe(true);
    expect(p.startsWith("# Source:")).toBe(true); // the shared context comes first (prompt caching)
    for (const e of spec.encounters) expect(p).toContain(`- ${e.id} [${e.role}, socket ${e.socket}`);
    expect(p).toContain("- pyramid: radius 70 m, height 90 m");
    expect(p).toContain("The map is 420 m square");
    expect(p).toMatch(/The finale is \w+: anchor it to the goal landmark/);
    for (const e of spec.encounters) {
      expect(p).not.toContain(JSON.stringify(e.solution));
      for (const h of e.hints) expect(p).not.toContain(h);
    }
  });

  it("repairs a broken draft from the code checks' notes", async () => {
    const astra = scripted("mock-astra", (_c, n) => (n === 1 ? broken() : good));
    const jobId = "w3d_arch_repair";
    const r = await runArchitect({ spec, km, intake, model: astra.model, modelId: "mock-astra", jobId });
    expect(astra.calls).toHaveLength(2);
    expect(astra.calls[1].user).toContain("# Fix these problems and answer again");
    expect(astra.calls[1].user).toMatch(/unknown npc "ghost"/);
    expect(astra.calls[1].user).toMatch(/exactly one landmark must have role "goal"/);
    expect(r.check.issues).toEqual([]);
    expect(r.world.provenance).toMatchObject({ source: "astra", model: "mock-astra" });
    const statuses = history(jobId).filter((e) => e.agent === "world_architect").map((e) => e.status);
    expect(statuses).toEqual(["start", "repair", "done"]);
  });

  it("falls back to the composer when Astra never passes the checks", async () => {
    const astra = scripted("mock-astra", () => broken());
    const jobId = "w3d_arch_giveup";
    const out = await buildWorld3D({ spec, km, intake, models: { ...getModels(), coder: astra.model }, jobId, forceArchitect: true });
    expect(astra.calls).toHaveLength(3); // the draft + 2 repair rounds
    expect(out.world3d?.provenance?.source).toBe("composer");
    expect(validateGameSpec(out).ok).toBe(true);
    const notes = history(jobId).filter((e) => e.agent === "world_architect" && e.status === "fallback").map((e) => e.note);
    expect(notes.join(" ")).toMatch(/the World Architect failed/);
  });

  it("normalizes ids consistently and fits texts to the stored limits", () => {
    const s = structuredClone(good);
    const goal = s.landmarks.find((l) => l.role === "goal")!;
    const old = goal.id;
    const fancy = "The Great Lighthouse!";
    goal.id = fancy;
    s.quest.goal.landmarkId = fancy;
    s.opening.flyover = s.opening.flyover.map((id) => (id === old ? fancy : id));
    s.paths = s.paths.map((p) => ({ ...p, to: p.to === old ? fancy : p.to, from: p.from === old ? fancy : p.from }));
    s.moments = s.moments.map((m) => (m.anchor.landmarkId === old ? { ...m, anchor: { npcId: null, landmarkId: fancy } } : m));
    s.npcs[0].name = "A".repeat(50);
    s.moments[0].approach[0] = { speaker: "Narrator", text: s.moments[0].approach[0].text };
    const w = fromSlice(s, { seed: spec.seed, size: 420, model: "m" });
    expect(w.quest.goal.landmarkId).toBe("the_great_lighthouse");
    expect(w.landmarks.some((l) => l.id === "the_great_lighthouse")).toBe(true);
    expect(w.npcs[0].name.length).toBeLessThanOrEqual(32);
    expect(w.moments[0].approach[0].speaker).toBe("narrator");
    expect(w.provenance?.fixes.some((f) => f.includes("shortened the name"))).toBe(true);
    expect(checkWorld(spec, w).issues).toEqual([]);
  });
});

describe("the critics", () => {
  it("pass only when every score is at least 3 and the mean at least 3.6", () => {
    expect([CRITIC_MIN_SCORE, CRITIC_PASS_MEAN]).toEqual([3, 3.6]);
    expect(criticPasses([4, 4, 4, 4])).toBe(true);
    expect(criticPasses([3, 4, 4, 4])).toBe(true);
    expect(criticPasses([3, 3, 3, 4])).toBe(false);
    expect(criticPasses([2, 5, 5, 5])).toBe(false);
    expect(criticPasses([])).toBe(false);
  });

  it("a failing critic sends its issues to Astra for one more round; the revision is re-checked and re-reviewed", async () => {
    const revisedTitle = "Relight the Lighthouse";
    const astra = scripted("mock-astra", (_c, n) => (n === 1 ? good : { ...good, quest: { ...good.quest, goal: { ...good.quest.goal, title: revisedTitle } } }));
    const fix = { target: "quest.goal", problem: "The goal title says where, not why.", fix: `Call it "${revisedTitle}".` };
    const critics = scripted("mock-critic", (call, n) => {
      if (call.system.startsWith("You are the Story Critic")) return critique(STORY_CRITERIA, (c) => (n === 1 && c === "goal_clarity" ? 2 : 4), n === 1 ? [fix] : []);
      return critique(WORLD_CRITERIA, () => 4);
    });
    const jobId = "w3d_critics";
    const out = await buildWorld3D({ spec, km, intake, models: { ...getModels(), coder: astra.model, critic: critics.model }, jobId, forceArchitect: true });

    expect(validateGameSpec(out).ok).toBe(true);
    const w = out.world3d as World3D;
    expect(w.quest.goal.title).toBe(revisedTitle);
    expect(w.provenance?.source).toBe("astra");
    expect(w.provenance?.model).toBe("mock-astra");
    const reviews = w.provenance!.reviews;
    expect(reviews.map((r) => [r.critic, r.pass, r.rounds, r.model])).toEqual([
      ["story", true, 1, "mock-critic"],
      ["world", true, 0, "mock-critic"],
    ]);
    expect(reviews[0].scores).toHaveLength(STORY_CRITERIA.length);

    // the repair note carries the critic's fix; the critics saw what they need
    expect(astra.calls).toHaveLength(2);
    expect(astra.calls[1].user).toContain("[story critic] quest.goal: The goal title says where, not why.");
    expect(astra.calls[1].user).toContain("[story critic] goal_clarity scored 2/5");
    const story = critics.calls.filter((c) => c.system === STORY_CRITIC_SYSTEM);
    const world = critics.calls.filter((c) => c.system === WORLD_CRITIC_SYSTEM);
    expect([story.length, world.length]).toEqual([2, 2]);
    expect(story[0].user).toContain("# Challenges and their answers");
    expect(world[0].user).toContain("## Top-down map (north up");
    expect(world[0].user).toContain("## HUD text");

    const notes = history(jobId).filter((e) => e.agent === "story_critic" && e.note).map((e) => e.note);
    expect(notes).toEqual(["story critic: 3.8/5, 1 issue sent to the World Architect", "story critic: 4.0/5, passed"]);
  });

  it("a critic that fails outright is skipped and the world still ships", async () => {
    const astra = scripted("mock-astra", () => good);
    const critics = scripted("mock-critic", (call) => (call.system.startsWith("You are the Story Critic") ? { nonsense: true } : critique(WORLD_CRITERIA, () => 5)));
    const out = await buildWorld3D({ spec, km, intake, models: { ...getModels(), coder: astra.model, critic: critics.model }, jobId: "w3d_critic_down", forceArchitect: true });
    expect(out.world3d?.provenance?.source).toBe("astra");
    expect(out.world3d?.provenance?.reviews.map((r) => r.critic)).toEqual(["world"]);
  });
});

describe("the World Critic's digest", () => {
  it("draws the map, lists landmarks and characters, and flags HUD text over budget", () => {
    const w = composeFallbackWorld(spec, km);
    const long: World3D = { ...w, moments: w.moments.map((m, i) => (i === 0 ? { ...m, objective: "x".repeat(HUD_BUDGET.objective + 5) } : m)) };
    const c = checkWorld(spec, long, { withScatter: true });
    const d = worldDigest(spec, c.composed, c.report);
    const rows = d.split("\n").filter((l) => l.startsWith("|"));
    expect(rows).toHaveLength(60);
    for (const r of rows) expect(r).toHaveLength(62);
    expect(d).toMatch(/^G {2}goal_lighthouse: lighthouse "The Lighthouse", role goal/m);
    expect(d).toMatch(/^S {2}spawn at/m);
    expect(d).toContain("- goal visible from the spawn: yes");
    expect(d).toMatch(/scatter instances: \d+/);
    expect(d).toMatch(/^! objective \w+ \(75\/70\)/m);
    expect(rows.join("")).toContain("S");
    expect(rows.join("")).toContain("G");
  });
});
