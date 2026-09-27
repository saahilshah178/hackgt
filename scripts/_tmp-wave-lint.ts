import { WAVE1A } from "../fixtures/wave1a.encounters";
import { WAVE1B } from "../fixtures/wave1b.encounters";
import { WAVE2A } from "../fixtures/wave2a.encounters";
import { WAVE2B } from "../fixtures/wave2b.encounters";
import { WAVE2C } from "../fixtures/wave2c.encounters";
import { WAVE2D } from "../fixtures/wave2d.encounters";
import { getCard } from "../src/library";
import { getMode } from "../src/mechanics/registry";
import { checkChallenge, mergeLockedParams } from "../src/pipeline/validate/checks";
import { answerVarsFor, type AnyFamilyMode } from "../src/mechanics/types";

const sets = { WAVE1A, WAVE1B, WAVE2A, WAVE2B, WAVE2C, WAVE2D };
let n = 0;
for (const [name, list] of Object.entries(sets)) {
  for (const { cardId, slice } of list) {
    const card = getCard(cardId)!;
    const mode = getMode(card.family, card.mode)! as AnyFamilyMode;
    for (const p of checkChallenge(mode, slice, card.lockedParams)) {
      n++;
      console.log(`${name} ${cardId}: ${p}`);
    }
    if (process.argv.includes("--vars")) {
      const params = mode.paramsSchema.parse(mergeLockedParams(slice.params, card.lockedParams));
      const sol = mode.resolve(params);
      console.log(`${name} ${cardId} vars:`, JSON.stringify(mode.templateVars(params, sol)), "answer:", answerVarsFor(mode, params).join(","));
    }
  }
}
console.log(n ? `${n} problems` : "clean");
