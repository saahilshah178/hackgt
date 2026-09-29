import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cellIntake, cellKnowledgeMap, cellMatches } from "../fixtures/cell-transport.knowledge-map";
import { historyIntake, historyKnowledgeMap, historyMatches } from "../fixtures/civil-rights.knowledge-map";
import { trigIntake, trigKnowledgeMap, trigMatches } from "../fixtures/trig.knowledge-map";
import type { GameSpec } from "../src/contracts/gamespec";
import type { Intake, KnowledgeMap } from "../src/contracts/knowledge";
import type { MatchResult } from "../src/contracts/match";
import type { JobDone } from "../src/contracts/progress";
import { World3D } from "../src/contracts/world3d";
import { POST as postSources } from "../src/app/api/sources/route";
import { EncounterRunner } from "../src/game/runner/encounter-runner";
import { prepareIntake, matcherJob, resetMatcherJobs } from "../src/pipeline/agents/intake";
import { blindSolveAndFix } from "../src/pipeline/agents/blind-solver";
import { history, onClose } from "../src/pipeline/events";
import { generateGame } from "../src/pipeline/generate";
import { getModels } from "../src/pipeline/models";
import { startGameJob } from "../src/pipeline/orchestrator";
import { focusConcepts } from "../src/pipeline/personalize";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";
import { buildWorld3D } from "../src/pipeline/world3d";
import { mapSizeFor } from "../src/pipeline/world3d/checks";
import { composeFallbackDetailed, composeFallbackWorld } from "../src/pipeline/world3d/fallback";
import { resetEnvCache } from "../src/server/env";
import { getStorage, resetStorage } from "../src/server/storage";
import { composeWorld } from "../src/world3d/core/compose";
import { spatialChecks } from "../src/world3d/core/spatial-checks";
import { validateWorld3D } from "../src/world3d/core/validate";

/*
 * The world3d generation pipeline in mock mode (docs/design/60 §2.5): the deterministic composer builds a world that
 * passes every referential and spatial check for every sample topic at every game length, and the whole mock pipeline
 * (generate → blind solve → S10 world → validate) produces a playable world3d GameSpec, through the orchestrator too.
 */

interface Sample {
  name: string;
  km: KnowledgeMap;
  intake: Intake;
  matches: readonly MatchResult[];
}

const SAMPLES: Sample[] = [
  { name: "trig", km: trigKnowledgeMap, intake: trigIntake, matches: trigMatches },
  { name: "cell", km: cellKnowledgeMap, intake: cellIntake, matches: cellMatches },
  { name: "civil_rights", km: historyKnowledgeMap, intake: historyIntake, matches: historyMatches },
];

/**
 * The mock Challenge Writer cannot serve the cell sample focused down to a 5-minute game (a pre-existing mock-mode gap,
 * the same in every genre), so that case plays its 10-minute game on a 5-minute clock: more encounters on the smallest
 * map with the tightest walking budget, which is the harder test for the composer.
 */
const RETIMED = new Set(["cell:5"]);

const cache = new Map<string, Promise<{ spec: GameSpec; km: KnowledgeMap; intake: Intake }>>();

function sampleSpec(sample: Sample, minutes: 5 | 10 | 15): Promise<{ spec: GameSpec; km: KnowledgeMap; intake: Intake }> {
  const key = `${sample.name}:${minutes}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = (async () => {
      if (RETIMED.has(key)) {
        const ten = await sampleSpec(sample, 10);
        return { ...ten, spec: { ...ten.spec, targetMinutes: minutes, intake: { ...ten.spec.intake, minutes } }, intake: { ...ten.intake, minutes } };
      }
      const intake: Intake = { ...sample.intake, genre: "world3d", minutes };
      const { km } = focusConcepts(sample.km, intake);
      const { spec } = await generateGame({
        gameId: `w3d_${sample.name}_${minutes}`,
        km,
        intake,
        matches: sample.matches,
        models: getModels(),
        now: () => new Date("2026-09-29T12:00:00.000Z"),
      });
      return { spec, km, intake };
    })();
    cache.set(key, hit);
  }
  return hit;
}

beforeAll(() => {
  process.env.LLM_MODE = "mock";
  resetEnvCache();
});

describe("the fallback composer (no LLM)", () => {
  for (const sample of SAMPLES) {
    for (const minutes of [5, 10, 15] as const) {
      it(`${sample.name} at ${minutes} min: a valid world that passes every referential and spatial check`, async () => {
        const { spec, km } = await sampleSpec(sample, minutes);
        expect(spec.genre).toBe("world3d");
        const r = composeFallbackDetailed(spec, km);
        expect(r.check.issues.map((i) => i.message)).toEqual([]);
        const world = r.world;
        expect(World3D.safeParse(world).success).toBe(true);
        expect(world.terrain.size).toBe(mapSizeFor(minutes));
        expect(world.seed).toBe(spec.seed);
        expect(world.provenance?.source).toBe("composer");

        // the stored (corrected) world re-composes cleanly: what the client builds is what was checked
        const ref = validateWorld3D(spec, world);
        expect(ref.issues.map((i) => i.message)).toEqual([]);
        const again = composeWorld(world, { skipScatter: true });
        const spatial = spatialChecks(spec, again);
        expect(spatial.issues.map((i) => i.message)).toEqual([]);
        expect(spatial.stats.goalVisibleFromSpawn).toBe(true);
        expect(spatial.stats.tourMinutes).toBeLessThanOrEqual(minutes * 0.4);

        // one moment per encounter, the finale at the goal, every cast member embodied
        expect(world.moments.map((m) => m.encounterId).sort()).toEqual(spec.encounters.map((e) => e.id).sort());
        const boss = spec.encounters.find((e) => e.role === "boss")!;
        expect(world.moments.find((m) => m.encounterId === boss.id)?.anchor.landmarkId).toBe(world.quest.goal.landmarkId);
        expect(world.quest.acts.at(-1)!.encounterIds).toContain(boss.id);
        for (const c of spec.characters) expect(world.npcs.some((n) => n.characterId === c.id)).toBe(true);
        for (const e of spec.encounters.filter((x) => x.socket === "conversation" && x.role !== "boss")) {
          expect(world.moments.find((m) => m.encounterId === e.id)?.anchor.npcId, e.id).not.toBeNull();
        }
        // collectibles are the student's own verified facts
        const facts = new Set(km.concepts.flatMap((c) => c.facts.map((f) => f.statement)));
        expect(world.collectibles.items.length).toBeGreaterThan(0);
        for (const item of world.collectibles.items) expect(facts.has(item.fact), item.fact).toBe(true);
        // no line gives an answer away: approach/success lines come from beats and prompts only
        for (const m of world.moments) for (const l of [...m.approach, ...m.success]) expect(l.text.length).toBeLessThanOrEqual(180);
        for (const m of world.moments) expect(m.objective.length).toBeLessThanOrEqual(70);
      });
    }
  }

  it("is deterministic and picks a look that fits each subject", async () => {
    const trig = await sampleSpec(SAMPLES[0], 10);
    expect(JSON.stringify(composeFallbackWorld(trig.spec, trig.km))).toBe(JSON.stringify(composeFallbackWorld(trig.spec, trig.km)));
    expect(composeFallbackWorld(trig.spec, trig.km).landmarks.find((l) => l.role === "goal")?.kind).toBe("lighthouse");
    const cell = await sampleSpec(SAMPLES[1], 10);
    expect(composeFallbackWorld(cell.spec, cell.km).biome).toBe("wetland");
    const civil = await sampleSpec(SAMPLES[2], 10);
    expect(composeFallbackWorld(civil.spec, civil.km).landmarks.find((l) => l.role === "goal")?.kind).toBe("palace");
  });
});

describe("the whole mock pipeline with genre world3d", () => {
  for (const sample of SAMPLES) {
    it(`${sample.name}: generate → blind solve → world → a valid, playable world3d GameSpec`, async () => {
      const intake: Intake = { ...sample.intake, genre: "world3d" };
      const { km } = focusConcepts(sample.km, intake);
      const models = getModels();
      const jobId = `w3d_e2e_${sample.name}`;
      const { spec: generated } = await generateGame({ gameId: jobId, jobId, km, intake, matches: sample.matches, models });
      const solved = await blindSolveAndFix({ spec: generated, km, intake, models, jobId });
      expect(solved.world3d).toBeUndefined();
      const spec = await buildWorld3D({ spec: solved, km, intake, models, jobId });

      const v = validateGameSpec(spec);
      expect(v.ok, JSON.stringify(v.ok ? [] : v.issues.slice(0, 3))).toBe(true);
      expect(spec.genre).toBe("world3d");
      expect(spec.world3d?.provenance?.source).toBe("composer");
      expect(spec.world3d?.moments).toHaveLength(spec.encounters.length);
      const events = history(jobId).filter((e) => e.agent === "world_architect");
      expect(events.at(-1)?.status).toBe("done");
      expect(events.at(-1)?.note).toMatch(/all checks passed/);

      // the free-order runner can finish it
      const runner = new EncounterRunner(spec, { order: "free" });
      for (let guard = 0; !runner.finished && guard < 40; guard++) {
        runner.focus(runner.available()[0]);
        expect(runner.autoSolve().correct).toBe(true);
      }
      expect(runner.finished).toBe(true);
    });
  }

  it("leaves other genres alone", async () => {
    const { spec } = await sampleSpec(SAMPLES[0], 5);
    const dungeon = { ...spec, genre: "dungeon" as const };
    expect(await buildWorld3D({ spec: dungeon, km: trigKnowledgeMap, intake: trigIntake, models: getModels(), jobId: "w3d_skip" })).toBe(dungeon);
  });
});

describe("the orchestrator runs S10 for a world3d job", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "quest-forge-world3d-"));
    process.env.DATA_DIR = dir;
    resetEnvCache();
    resetStorage();
    resetMatcherJobs();
  });
  afterAll(async () => {
    delete process.env.DATA_DIR;
    resetEnvCache();
    resetStorage();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });

  it("upload → intake → job → a stored world3d game with its world", async () => {
    const bytes = await readFile("samples/cell-transport.pdf");
    const form = new FormData();
    form.set("file", new File([bytes], "cell-transport.pdf", { type: "application/pdf" }));
    const { sourceId } = await (await postSources(new Request("http://test/api/sources", { method: "POST", body: form }))).json();
    await prepareIntake(sourceId);
    await matcherJob(sourceId);
    await getStorage().putMatch(sourceId, cellMatches);

    const { jobId } = await startGameJob({ sourceId, intake: { ...cellIntake, minutes: 15, genre: "world3d" } });
    const done = await new Promise<JobDone>((resolve) => onClose(jobId, resolve));
    expect(done.error).toBeNull();
    const record = await getStorage().getGame(done.gameId!);
    expect(record?.spec.genre).toBe("world3d");
    expect(record?.spec.world3d?.moments).toHaveLength(record!.spec.encounters.length);
    expect(validateGameSpec(record!.spec).ok).toBe(true);
    const agents = history(jobId).map((e) => e.agent);
    expect(agents.indexOf("world_architect")).toBeGreaterThan(agents.lastIndexOf("verifier"));
    expect(agents.indexOf("world_architect")).toBeLessThan(agents.indexOf("audio"));
  }, 60_000);
});
