import { writeFileSync } from "node:fs";
import { trigSlices } from "../fixtures/trig.slices";
import { assembleGameSpec } from "../src/pipeline/assemble";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";

// Slices -> assemble -> validate -> fixtures/trig-dungeon.json. No LLM involved.
const result = validateGameSpec(assembleGameSpec(trigSlices));
if (!result.ok) {
  console.error(result.issues);
  process.exit(1);
}
writeFileSync(new URL("../fixtures/trig-dungeon.json", import.meta.url), JSON.stringify(result.spec, null, 2) + "\n");
console.log(`wrote fixtures/trig-dungeon.json (${result.spec.encounters.length} encounters, ${result.warnings.length} warnings)`);
