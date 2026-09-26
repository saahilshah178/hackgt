import { writeFileSync } from "node:fs";
import { trigSlices } from "../fixtures/trig.slices";
import { assembleGameSpec } from "../src/pipeline/assemble";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";

// Slices -> assemble -> validate -> fixtures/<name>.json. No LLM involved. Never hand-edit the JSON.
const fixtures = [{ slices: trigSlices, file: "trig-dungeon.json" }];

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
if (failed) process.exit(1);
