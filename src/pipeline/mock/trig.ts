import { trigAssessment, trigBlueprint, trigChallenges, trigNarrative } from "../../../fixtures/trig.slices";
import { registerMockSample } from "./registry";

/*
 * Wires the recorded trig fixture (fixtures/trig.slices.ts) into the mock model registry, so
 * `generateGame({ ..., models: getModels() })` in mock mode reproduces fixtures/trig-dungeon.json
 * exactly (see tests/mock-models.test.ts). Registering here (imported once by mock/models.ts) keeps
 * the wiring in one place instead of scattering it across every entry point.
 */
registerMockSample("trig", {
  director: trigBlueprint,
  narrative: trigNarrative,
  assessment: trigAssessment,
  challenges: trigChallenges,
});
