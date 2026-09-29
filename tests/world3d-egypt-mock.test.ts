import { beforeAll, describe, expect, it } from "vitest";
import { egyptIntake, egyptKnowledgeMap } from "../fixtures/ancient-egypt.knowledge-map";
import { egyptBlueprint } from "../fixtures/ancient-egypt.slices";
import type { Intake } from "../src/contracts/knowledge";
import { runMatcher } from "../src/pipeline/agents/matcher";
import { generateGame } from "../src/pipeline/generate";
import { getModels } from "../src/pipeline/models";
import { resolveMockSample } from "../src/pipeline/mock/registry";
import { focusConcepts } from "../src/pipeline/personalize";
import { buildWorld3D } from "../src/pipeline/world3d";
import { resetEnvCache } from "../src/server/env";

/*
 * Uploading the Ancient Egypt chapter in mock mode reproduces the 3D demo (docs/design/60 §3): the source routes to the
 * "egypt" sample, the recorded matcher shortlist keeps the demo's cards, and S10 uses the hand-authored Giza world when
 * it anchors every encounter; a different game (5 minutes) gets a composed world instead.
 */

beforeAll(() => {
  process.env.LLM_MODE = "mock";
  resetEnvCache();
});

async function run(minutes: 5 | 10) {
  const intake: Intake = { ...egyptIntake, genre: "world3d", minutes };
  const matches = await runMatcher(egyptKnowledgeMap, { jobId: `egypt_${minutes}` } as Parameters<typeof runMatcher>[1]);
  // as the orchestrator does: a short game plays the concepts the learner needs most
  const { km } = focusConcepts(egyptKnowledgeMap, intake);
  const { spec } = await generateGame({ gameId: `egypt_${minutes}`, km, intake, matches, models: getModels(), now: () => new Date("2026-09-29T12:00:00.000Z") });
  return buildWorld3D({ spec, km, intake, models: getModels(), jobId: `egypt_${minutes}` });
}

describe("Ancient Egypt in mock mode", () => {
  it("routes the chapter to the egypt sample", () => {
    expect(resolveMockSample({ title: egyptKnowledgeMap.title, text: egyptKnowledgeMap.subject.topic })).toBe("egypt");
  });

  it("a 10-minute 3D game is the demo, in the hand-authored world", async () => {
    const spec = await run(10);
    expect(spec.genre).toBe("world3d");
    expect(spec.encounters.map((e) => e.id)).toEqual(egyptBlueprint.encounters.map((e) => e.id));
    expect(spec.world3d?.provenance?.source).toBe("fixture");
    expect(spec.world3d?.landmarks.some((l) => l.id === "great_pyramid" && l.role === "goal")).toBe(true);
  });

  it("a different game gets a composed world that still passes every check", async () => {
    const spec = await run(5);
    expect(spec.world3d).toBeDefined();
    expect(["fixture", "composer"]).toContain(spec.world3d?.provenance?.source);
  });
});
