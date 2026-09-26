import { beforeEach, describe, expect, it } from "vitest";
import fixture from "../fixtures/trig-dungeon.json";
import { trigIntake, trigKnowledgeMap, trigMatches } from "../fixtures/trig.knowledge-map";
import { resetEnvCache } from "../src/server/env";
import { encounterRange, generateGame } from "../src/pipeline/generate";
import { getModels } from "../src/pipeline/models";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";

/*
 * Proves the actual mock-mode entry point (getModels() in LLM_MODE=mock, not a hand-built test
 * double) reproduces fixtures/trig-dungeon.json exactly. This is what the app itself does with zero
 * keys (MEGAPROMPT §8).
 */

describe("mock mode via getModels()", () => {
  beforeEach(() => {
    process.env.LLM_MODE = "mock";
    resetEnvCache();
  });

  it("reproduces the trig fixture byte for byte", async () => {
    const { spec, genre, repairs } = await generateGame({
      gameId: "trig_demo_001",
      km: trigKnowledgeMap,
      intake: trigIntake,
      matches: trigMatches,
      models: getModels(),
      now: () => new Date("2026-09-26T02:00:00.000Z"),
    });
    expect(genre).toBe("dungeon");
    expect(repairs).toBe(0);
    expect(spec).toEqual(fixture);
  });

  // M5: mock state used to be keyed by sample id alone, so two concurrent jobs on the same sample
  // could race and read back each other's adapted Director blueprint. Running two jobs on the trig
  // sample concurrently, with different `minutes` (so their encounter counts must differ), exercises
  // that race: each job's challenge/narrative writers must see only ITS OWN adapted blueprint.
  it("keeps two concurrent jobs on the same sample independent", async () => {
    const short = { ...trigIntake, minutes: 5 as const };
    const long = { ...trigIntake, minutes: 15 as const };
    const [a, b] = await Promise.all([
      generateGame({ gameId: "trig_concurrent_a", km: trigKnowledgeMap, intake: short, matches: trigMatches, models: getModels() }),
      generateGame({ gameId: "trig_concurrent_b", km: trigKnowledgeMap, intake: long, matches: trigMatches, models: getModels() }),
    ]);

    const [shortMin, shortMax] = encounterRange(short.minutes);
    const [longMin, longMax] = encounterRange(long.minutes);
    expect(a.spec.encounters.length).toBeGreaterThanOrEqual(shortMin);
    expect(a.spec.encounters.length).toBeLessThanOrEqual(shortMax);
    expect(b.spec.encounters.length).toBeGreaterThanOrEqual(longMin);
    expect(b.spec.encounters.length).toBeLessThanOrEqual(longMax);
    expect(validateGameSpec(a.spec).ok).toBe(true);
    expect(validateGameSpec(b.spec).ok).toBe(true);

    // Every narrative beat and challenge must reference an encounter that actually exists in ITS OWN
    // spec (a leaked cross-job blueprint would produce beats/params for the wrong job's encounters).
    const idsA = new Set(a.spec.encounters.map((e) => e.id));
    const idsB = new Set(b.spec.encounters.map((e) => e.id));
    expect(a.spec.narrative.beats.every((beat) => idsA.has(beat.encounterId))).toBe(true);
    expect(b.spec.narrative.beats.every((beat) => idsB.has(beat.encounterId))).toBe(true);
  });
});
