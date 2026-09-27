import { readFileSync } from "node:fs";
import path from "node:path";
import { cellSlices } from "../fixtures/cell-transport.slices";
import { historyMysterySlices } from "../fixtures/civil-rights-mystery.slices";
import { historySlices } from "../fixtures/civil-rights.slices";
import { trigPlatformerSlices } from "../fixtures/trig-platformer.slices";
import { trigSlices } from "../fixtures/trig.slices";
import { wave2Slices } from "../fixtures/wave2.slices";
import { GameSpec } from "../src/contracts/gamespec";
import { WorldFile } from "../src/contracts/world";
import { getCard } from "../src/library";
import { getMode } from "../src/mechanics/registry";
import type { Slices } from "../src/pipeline/assemble";
import { checkChallenge, checkNarrative } from "../src/pipeline/validate/checks";
import { validateWorld } from "../src/world/validate-world";

// Checks every hand-written game text against docs/WRITING.md and docs/HINTS.md (the parts a script can see):
// fixture slices through the Challenge/Narrative Writer checks, world side-cars through validateWorld's R8/R9.
// Usage: pnpm text:lint [--all]  (--all also prints non-style world warnings)
const all = process.argv.includes("--all");
const slices: [string, Slices][] = [
  ["trig", trigSlices],
  ["cell-transport", cellSlices],
  ["civil-rights", historySlices],
  ["civil-rights-mystery", historyMysterySlices],
  ["wave2", wave2Slices],
  ["trig-platformer", trigPlatformerSlices],
];

let count = 0;
const report = (where: string, msg: string) => {
  count++;
  console.log(`${where}: ${msg}`);
};

for (const [name, s] of slices) {
  for (const e of s.blueprint.encounters) {
    const slice = s.challenges[e.id];
    const card = getCard(e.teachingMechanicId);
    const mode = card && getMode(card.family, card.mode);
    if (!slice || !mode) continue;
    for (const p of checkChallenge(mode, slice, card.lockedParams)) report(`${name}.slices ${e.id}`, p);
  }
  for (const p of checkNarrative(s.narrative)) report(`${name}.slices narrative`, p);
}

const fixtureOf = new Map<string, string>([
  ["trig_demo_001", "trig-dungeon"],
  ["trig_platformer_001", "trig-platformer"],
  ["cell_demo_001", "cell-transport-dungeon"],
  ["history_mystery_001", "civil-rights-mystery"],
  ["history_demo_001", "civil-rights-dungeon"],
]);
for (const w of ["trig", "cell-transport", "civil-rights"]) {
  const file = WorldFile.parse(JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "worlds", `${w}.world.json`), "utf8")));
  const specId = file.appliesTo.specIds[0];
  const fixture = specId && fixtureOf.get(specId);
  if (!fixture) continue;
  const spec = GameSpec.parse(JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", `${fixture}.json`), "utf8")));
  const r = validateWorld(spec, file.world, { sidecar: true });
  for (const i of [...r.issues, ...r.warnings]) {
    if (!all && !/^R[89]:/.test(i.message)) continue;
    const at = i.path.join(".");
    report(`${w}.world ${at}`, i.message);
  }
}

console.log(count ? `\n${count} problem(s)` : "no problems");
if (count) process.exitCode = 1;
