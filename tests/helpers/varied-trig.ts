import { trigBlueprint, trigChallenges, trigSlices } from "../../fixtures/trig.slices";
import { trigKnowledgeMap, trigMatches } from "../../fixtures/trig.knowledge-map";
import { assembleGameSpec } from "../../src/pipeline/assemble";
import { buildDirectorMenu } from "../../src/pipeline/generate";
import { constructiveChallenge, diversifyMockBlueprint } from "../../src/pipeline/mock/variety";

const cards = buildDirectorMenu(trigKnowledgeMap, trigMatches, "dungeon").flatMap(f => f.cards);
export const variedBlueprint = diversifyMockBlueprint(trigBlueprint, trigKnowledgeMap, new Set(cards.map(c => c.id)));
export const variedChallenges = Object.fromEntries(variedBlueprint.encounters.map(e => [e.id, constructiveChallenge(trigKnowledgeMap, e) ?? trigChallenges[e.id]]));
export const variedFixture = assembleGameSpec({ ...trigSlices, blueprint: variedBlueprint, challenges: variedChallenges });
