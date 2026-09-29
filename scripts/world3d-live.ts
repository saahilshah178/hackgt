import { readFile } from "node:fs/promises";
import path from "node:path";
import { cellIntake, cellKnowledgeMap } from "../fixtures/cell-transport.knowledge-map";
import { historyIntake, historyKnowledgeMap } from "../fixtures/civil-rights.knowledge-map";
import { egyptIntake, egyptKnowledgeMap } from "../fixtures/ancient-egypt.knowledge-map";
import { trigIntake, trigKnowledgeMap } from "../fixtures/trig.knowledge-map";
import type { GameSpec } from "../src/contracts/gamespec";
import type { Intake, KnowledgeMap } from "../src/contracts/knowledge";
import { BOSS_SOCKET } from "../src/library/genres";
import { socketsFor } from "../src/mechanics/registry";
import { subscribe } from "../src/pipeline/events";
import { layoutFromEncounters } from "../src/pipeline/layout";
import { getModels } from "../src/pipeline/models";
import { buildWorld3D } from "../src/pipeline/world3d";
import { getEnv, loadLocalEnvFile } from "../src/server/env";
import { newId } from "../src/server/ids";
import { getStorage } from "../src/server/storage";

/*
 * A live run of S10 alone (docs/design/60 §2.5): take a shipped fixture game, drop its world, and have the real World
 * Architect (CODER_MODEL) design one, reviewed by the real critics (CRITIC_MODEL or SMART_MODEL). The earlier stages are
 * unchanged by the 3D work, so this spends only on what is new. The game is stored (STORAGE_DRIVER) and playable at
 * /play/<id>.
 *
 *   pnpm world3d:live [--base ancient-egypt-world3d | civil-rights-story | cell-transport-cozy | trig-puzzle]
 *
 * Needs LLM_MODE=live and OPENAI_API_KEY (.env.local). Prints every progress note, the critics' scores and the fixes.
 */

const SOURCES: { match: RegExp; km: KnowledgeMap; intake: Intake }[] = [
  { match: /egypt/, km: egyptKnowledgeMap, intake: egyptIntake },
  { match: /civil/, km: historyKnowledgeMap, intake: historyIntake },
  { match: /cell/, km: cellKnowledgeMap, intake: cellIntake },
  { match: /trig/, km: trigKnowledgeMap, intake: trigIntake },
];

async function main() {
  loadLocalEnvFile();
  const args = process.argv.slice(2);
  const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : "ancient-egypt-world3d";
  const env = getEnv();
  if (env.LLM_MODE !== "live") {
    console.error("world3d:live needs LLM_MODE=live (and OPENAI_API_KEY) in .env.local or the environment.");
    process.exit(2);
  }
  const source = SOURCES.find((s) => s.match.test(base));
  if (!source) throw new Error(`no knowledge map for "${base}"`);
  const raw = JSON.parse(await readFile(path.join(process.cwd(), "fixtures", `${base}.json`), "utf8")) as GameSpec;
  // re-socket the encounters for world3d (a no-op for a world3d fixture), and start without a world
  const encounters = raw.encounters.map((e) => ({
    ...e,
    socket: e.role === "boss" ? BOSS_SOCKET.world3d : raw.genre === "world3d" ? e.socket : (socketsFor(e.familyId, "world3d", BOSS_SOCKET.world3d).find((s) => s !== BOSS_SOCKET.world3d) ?? "conversation"),
  }));
  const id = newId("game");
  const spec: GameSpec = { ...raw, id, genre: "world3d", encounters, layout: layoutFromEncounters("world3d", encounters), world3d: undefined };
  const km = { ...source.km, concepts: source.km.concepts.filter((c) => spec.concepts.some((x) => x.id === c.id)) };
  const jobId = `live_${id}`;
  const t0 = Date.now();
  const off = subscribe(jobId, (e) => {
    const s = ((Date.now() - t0) / 1000).toFixed(1).padStart(6);
    console.log(`${s}s  ${String(e.agent).padEnd(16)} ${String(e.status).padEnd(8)} ${e.note ?? ""}`);
  });
  console.log(`designing a world for "${spec.title}" (${spec.encounters.length} encounters) with ${env.CODER_MODEL}; critics: ${process.env.CRITIC_MODEL ?? env.SMART_MODEL}`);
  const out = await buildWorld3D({ spec, km, intake: { ...source.intake, genre: "world3d" }, models: getModels(), jobId, forceArchitect: true });
  off();
  const w = out.world3d!;
  console.log(`\nworld: ${w.provenance?.source} (${w.provenance?.model ?? "-"}) · ${w.biome} · ${w.setting.place} · ${w.landmarks.length} landmarks, ${w.npcs.length} characters, ${w.moments.length} moments`);
  for (const r of w.provenance?.reviews ?? []) {
    console.log(`  ${r.critic} critic: ${r.pass ? "PASS" : "shipped with notes"} after ${r.rounds} revision(s)`);
    for (const s of r.scores) console.log(`    ${s.criterion.padEnd(24)} ${s.score}/5  ${s.note}`);
    for (const i of r.issues.slice(0, 5)) console.log(`    - ${i}`);
  }
  if (w.provenance?.fixes.length) console.log(`  code fixes: ${w.provenance.fixes.join("; ")}`);
  await getStorage().putGame({ id, sourceId: spec.source.sourceId, jobId, createdAt: new Date().toISOString(), spec: out });
  console.log(`\nstored ${id}; play it at /play/${id}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
