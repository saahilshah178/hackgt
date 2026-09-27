import { trigIntake, trigKnowledgeMap } from "../../../fixtures/trig.knowledge-map";
import { trigAssessment, trigBlueprint, trigChallenges, trigNarrative } from "../../../fixtures/trig.slices";
import type { PreCheckSlice } from "../../contracts/slices";
import { curriculumFromKnowledgeMap, gatekeeperFromKnowledgeMap } from "./from-knowledge-map";
import { mcqToItem } from "./mcq";
import { registerMockSample } from "./registry";

/*
 * Wires the recorded trig fixture (fixtures/trig.knowledge-map.ts, fixtures/trig.slices.ts) into the
 * mock model registry, so `generateGame({ ..., models: getModels() })` in mock mode reproduces
 * fixtures/trig-dungeon.json exactly (see tests/mock-models.test.ts), and `prepareIntake()` in mock
 * mode reproduces trigKnowledgeMap end to end (see tests/pipeline-agents.test.ts).
 *
 * The pre-check targets the same 3 concepts prepareIntake's pickWeakestConceptIds() picks for this
 * fixture (core concepts, hardest first): c_period, c_solve, c_radians. Two of those items are
 * reused from trigIntake's existing pre-check; c_solve gets a fresh item since trigIntake never asks
 * about it.
 */
const precheck: PreCheckSlice = {
  items: [
    mcqToItem(trigIntake.preCheck.items[0]), // c_period
    {
      conceptId: "c_solve",
      prompt: "How many solutions does sin x = 1/2 have on [0, 2π)?",
      correct: "Two, π/6 and 5π/6",
      distractors: ["Only one, π/6", "Four, one in each quadrant", "None, because sine never equals 1/2"],
    },
    mcqToItem(trigIntake.preCheck.items[2]), // c_radians
  ],
};

registerMockSample("trig", {
  km: trigKnowledgeMap,
  gatekeeper: gatekeeperFromKnowledgeMap(trigKnowledgeMap),
  curriculum: curriculumFromKnowledgeMap(trigKnowledgeMap),
  precheck,
  director: trigBlueprint,
  narrative: trigNarrative,
  assessment: trigAssessment,
  challenges: trigChallenges,
});
