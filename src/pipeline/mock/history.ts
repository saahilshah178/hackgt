import { historyIntake, historyKnowledgeMap } from "../../../fixtures/civil-rights.knowledge-map";
import { historyAssessment, historyBlueprint, historyChallenges, historyNarrative } from "../../../fixtures/civil-rights.slices";
import type { PreCheckSlice } from "../../contracts/slices";
import { curriculumFromKnowledgeMap, gatekeeperFromKnowledgeMap } from "./from-knowledge-map";
import { mcqToItem } from "./mcq";
import { registerMockSample } from "./registry";

/*
 * Wires the recorded civil-rights fixture into the mock model registry as sample "civil_rights"
 * (see src/pipeline/mock/registry.ts's KEYWORDS map; see mock/trig.ts for the general pattern).
 * prepareIntake's pickWeakestConceptIds() picks c_causation, c_birmingham, and c_civil_rights_act
 * for this fixture (core concepts, hardest first). historyIntake's existing pre-check already
 * targets c_civil_rights_act, reused as-is; c_causation and c_birmingham get fresh items.
 */
const precheck: PreCheckSlice = {
  items: [
    {
      conceptId: "c_causation",
      prompt: "What repeatedly turned a local civil rights campaign into national legislation?",
      correct: "Televised violence against nonviolent protesters",
      distractors: ["A single court ruling each time", "Direct orders from the President", "Coincidence; the timing wasn't connected"],
    },
    {
      conceptId: "c_birmingham",
      prompt: "What did the televised images from the Birmingham campaign push President Kennedy to do?",
      correct: "Propose a sweeping civil rights bill",
      distractors: ["Send federal troops to Alabama", "Call for the Voting Rights Act", "Nothing; Congress acted on its own"],
    },
    mcqToItem(historyIntake.preCheck.items[0]), // c_civil_rights_act
  ],
};

registerMockSample("civil_rights", {
  km: historyKnowledgeMap,
  gatekeeper: gatekeeperFromKnowledgeMap(historyKnowledgeMap),
  curriculum: curriculumFromKnowledgeMap(historyKnowledgeMap),
  precheck,
  director: historyBlueprint,
  narrative: historyNarrative,
  assessment: historyAssessment,
  challenges: historyChallenges,
});
