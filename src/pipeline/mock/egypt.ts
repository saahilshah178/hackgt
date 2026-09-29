import { egyptIntake, egyptKnowledgeMap, egyptMatches } from "../../../fixtures/ancient-egypt.knowledge-map";
import { egyptAssessment, egyptBlueprint, egyptChallenges, egyptNarrative } from "../../../fixtures/ancient-egypt.slices";
import { egyptWorld3D } from "../../../fixtures/ancient-egypt.world3d";
import { curriculumFromKnowledgeMap, gatekeeperFromKnowledgeMap } from "./from-knowledge-map";
import { mcqToItem } from "./mcq";
import { registerMockSample } from "./registry";

/*
 * Wires the Ancient Egypt demo (docs/design/60 §3) into the mock model registry as sample "egypt" (keywords in
 * registry.ts), so uploading samples/ancient-egypt.pdf in mock mode walks the real flow. Its recorded world is the
 * hand-authored Giza: buildWorld3D uses it in mock mode whenever it covers every encounter of the generated game
 * (the 10-minute 3D run), and composes a world from the spec otherwise. The pre-check reuses the intake's three items
 * (c_builders, c_flood, c_hieroglyphs), which are the weakest core concepts prepareIntake picks.
 */
registerMockSample("egypt", {
  km: egyptKnowledgeMap,
  gatekeeper: gatekeeperFromKnowledgeMap(egyptKnowledgeMap),
  curriculum: curriculumFromKnowledgeMap(egyptKnowledgeMap),
  precheck: { items: egyptIntake.preCheck.items.map(mcqToItem) },
  matches: egyptMatches,
  director: egyptBlueprint,
  narrative: egyptNarrative,
  assessment: egyptAssessment,
  challenges: egyptChallenges,
  world3d: egyptWorld3D,
});
