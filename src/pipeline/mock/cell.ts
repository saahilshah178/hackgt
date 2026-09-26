import { cellIntake, cellKnowledgeMap } from "../../../fixtures/cell-transport.knowledge-map";
import { cellAssessment, cellBlueprint, cellChallenges, cellNarrative } from "../../../fixtures/cell-transport.slices";
import type { PreCheckSlice } from "../../contracts/slices";
import { curriculumFromKnowledgeMap, gatekeeperFromKnowledgeMap } from "./from-knowledge-map";
import { mcqToItem } from "./mcq";
import { registerMockSample } from "./registry";

/*
 * Wires the recorded cell-transport fixture into the mock model registry (see mock/trig.ts for the
 * pattern). prepareIntake's pickWeakestConceptIds() picks c_active_transport, c_osmosis, and
 * c_selectivity for this fixture (core concepts, hardest first, tied by id) — exactly the 3 concepts
 * cellIntake's existing pre-check already targets, so every item is reused as-is.
 */
const precheck: PreCheckSlice = {
  items: cellIntake.preCheck.items.map(mcqToItem),
};

registerMockSample("cell", {
  gatekeeper: gatekeeperFromKnowledgeMap(cellKnowledgeMap),
  curriculum: curriculumFromKnowledgeMap(cellKnowledgeMap),
  precheck,
  director: cellBlueprint,
  narrative: cellNarrative,
  assessment: cellAssessment,
  challenges: cellChallenges,
});
