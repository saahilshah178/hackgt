import { writeFileSync } from "node:fs";
import { cellSlices } from "../fixtures/cell-transport.slices";
import { historyMysterySlices } from "../fixtures/civil-rights-mystery.slices";
import { historySlices } from "../fixtures/civil-rights.slices";
import { trigPlatformerSlices } from "../fixtures/trig-platformer.slices";
import { trigSlices } from "../fixtures/trig.slices";
import { wave2Slices } from "../fixtures/wave2.slices";
import { BOARD_SHOWCASE } from "../fixtures/board-showcase.slices";
import { assembleGameSpec } from "../src/pipeline/assemble";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";
import { buildWorld3DFixture, WORLD3D_SHOWCASE } from "../fixtures/world3d-showcase";

// Slices -> assemble -> validate -> fixtures/<name>.json. No LLM involved. Never hand-edit the JSON.
// tests/fixtures-drift.test.ts fails if a JSON here no longer matches its slices.
const fixtures = [
  { slices: trigSlices, file: "trig-dungeon.json" },
  { slices: cellSlices, file: "cell-transport-dungeon.json" },
  { slices: historySlices, file: "civil-rights-dungeon.json" },
  { slices: historyMysterySlices, file: "civil-rights-mystery.json" },
  { slices: wave2Slices, file: "wave2-dungeon.json" },
  { slices: trigPlatformerSlices, file: "trig-platformer.json" },
  ...BOARD_SHOWCASE,
];

let failed = false;
for (const f of fixtures) {
  const result = validateGameSpec(assembleGameSpec(f.slices));
  if (!result.ok) {
    console.error(`${f.file}: invalid`, result.issues);
    failed = true;
    continue;
  }
  writeFileSync(new URL(`../fixtures/${f.file}`, import.meta.url), JSON.stringify(result.spec, null, 2) + "\n");
  console.log(`wrote fixtures/${f.file} (${result.spec.encounters.length} encounters, ${result.warnings.length} warnings)`);
}
// 3D open worlds: assembled like the rest, then the world is composed, checked and attached (fixtures/world3d-showcase.ts)
for (const f of WORLD3D_SHOWCASE) {
  try {
    const spec = buildWorld3DFixture(f);
    writeFileSync(new URL(`../fixtures/${f.file}`, import.meta.url), JSON.stringify(spec, null, 2) + "\n");
    console.log(`wrote fixtures/${f.file} (${spec.encounters.length} encounters, world3d with ${spec.world3d?.provenance?.fixes.length ?? 0} composer fixes)`);
  } catch (err) {
    console.error(String(err));
    failed = true;
  }
}
if (failed) process.exit(1);
