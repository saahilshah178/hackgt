import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { trigIntake, trigKnowledgeMap } from "../fixtures/trig.knowledge-map";
import { directorSchema } from "../src/contracts/slices";
import { mechanicsFor } from "../src/mechanics/registry";
import { DIRECTOR_SYSTEM, directorPrompt, sharedContext } from "../src/pipeline/prompts";
import { checkBlueprint } from "../src/validate/checks";

// One real call to confirm the model accepts the strict schema. Run: OPENAI_API_KEY=... npm run smoke:openai
const model = process.env.SMART_MODEL ?? "gpt-6-sol";
const genre = trigIntake.genre;
const conceptIds = trigKnowledgeMap.concepts.map((c) => c.id);
const t0 = Date.now();
const { output } = await generateText({
  model: openai(model),
  system: DIRECTOR_SYSTEM,
  prompt: directorPrompt(sharedContext(trigKnowledgeMap, trigIntake, genre), 5, 9),
  output: Output.object({
    schema: directorSchema({ genre, conceptIds, mechanics: mechanicsFor(genre), minEncounters: 5, maxEncounters: 9 }),
    name: "director",
  }),
});
console.log(JSON.stringify(output, null, 2));
console.log(`\n${model}: ${Date.now() - t0} ms; check problems:`, checkBlueprint(output, { genre, conceptIds }));
