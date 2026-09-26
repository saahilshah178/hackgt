import { beforeEach, describe, expect, it } from "vitest";
import fixture from "../fixtures/trig-dungeon.json";
import { trigIntake, trigKnowledgeMap, trigMatches } from "../fixtures/trig.knowledge-map";
import { resetEnvCache } from "../src/server/env";
import { generateGame } from "../src/pipeline/generate";
import { getModels } from "../src/pipeline/models";

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
});
