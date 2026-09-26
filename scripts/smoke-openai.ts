import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { trigIntake, trigKnowledgeMap, trigMatches } from "../fixtures/trig.knowledge-map";
import { directorSchema } from "../src/contracts/slices";
import { getCard } from "../src/library";
import { BOSS_SOCKET } from "../src/library/genres";
import { buildDirectorMenu, encounterRange } from "../src/pipeline/generate";
import { DIRECTOR_SYSTEM, directorMenu, directorPrompt, sharedContext } from "../src/pipeline/prompts";
import { checkBlueprint } from "../src/pipeline/validate/checks";
import { getEnv, loadLocalEnvFile } from "../src/server/env";

/*
 * One real Director call to confirm the key, the model id, and that the model accepts the strict schema.
 * Run: pnpm smoke:openai   (needs LLM_MODE=live and OPENAI_API_KEY in .env.local; FIRST_RUN.md step 3)
 */
loadLocalEnvFile();
process.env.LLM_MODE = "live";
let env;
try {
  env = getEnv();
} catch (err) {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
}
const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
const genre = "dungeon" as const;
const conceptIds = trigKnowledgeMap.concepts.map((c) => c.id);
const beliefs = trigKnowledgeMap.concepts.flatMap((c) => c.misconceptions.map((m) => m.belief));
const menu = buildDirectorMenu(trigKnowledgeMap, trigMatches, genre);
const [minE, maxE] = encounterRange(trigIntake.minutes);
const t0 = Date.now();
try {
  const { output } = await generateText({
    model: openai(env.SMART_MODEL),
    system: DIRECTOR_SYSTEM,
    prompt: directorPrompt(sharedContext(trigKnowledgeMap, trigIntake, genre), directorMenu(menu, genre), minE, maxE),
    output: Output.object({
      schema: directorSchema({ genre, conceptIds, families: menu, beliefs, bossSocket: BOSS_SOCKET[genre], minEncounters: minE, maxEncounters: maxE }),
      name: "director",
    }),
  });
  console.log(JSON.stringify(output, null, 2));
  const problems = checkBlueprint(output, { genre, conceptIds, bossSocket: BOSS_SOCKET[genre], getCard, concepts: trigKnowledgeMap.concepts });
  console.log(`\n${env.SMART_MODEL}: ${Date.now() - t0} ms; check problems:`, problems);
} catch (err) {
  const e = err as { statusCode?: number; message?: string };
  console.error(`FAILED after ${Date.now() - t0} ms${e.statusCode ? ` (HTTP ${e.statusCode})` : ""}: ${e.message ?? String(err)}`);
  if (e.statusCode === 401) console.error("→ 401: the API key is wrong or from another org. FIRST_RUN.md step 3.3.");
  if (e.statusCode === 404) console.error(`→ 404: model "${env.SMART_MODEL}" isn't available to this account. Set SMART_MODEL/FAST_MODEL (FIRST_RUN.md step 3.4).`);
  if (e.statusCode === 429) console.error("→ 429: no credits/billing, or rate limited. FIRST_RUN.md step 3.2.");
  if (e.statusCode === 400) console.error("→ 400: the schema was rejected; run `pnpm test` (tests/strict-schemas.test.ts).");
  process.exit(1);
}
