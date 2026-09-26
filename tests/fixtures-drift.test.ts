import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cellSlices } from "../fixtures/cell-transport.slices";
import { historyMysterySlices } from "../fixtures/civil-rights-mystery.slices";
import { historySlices } from "../fixtures/civil-rights.slices";
import { trigPlatformerSlices } from "../fixtures/trig-platformer.slices";
import { wave2Slices } from "../fixtures/wave2.slices";
import { assembleGameSpec } from "../src/pipeline/assemble";

/*
 * Fixture drift guard (reviewer item "Fixture drift"): the hand-authored *.slices.ts files are the source
 * of truth, and their *.json siblings are a pre-assembled snapshot other tests/consumers read directly.
 * If a slice changes without rebuilding its JSON, this test catches it rather than letting the two
 * silently disagree. `scripts/build-fixtures.ts` (pipeline-dev's) only rebuilds three of these four pairs;
 * extending its table is out of scope here, so this test covers all four directly against assembleGameSpec.
 */

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${path}`, import.meta.url), "utf8"));
}

describe("fixture JSON matches its slices (no silent drift)", () => {
  it("cell-transport.slices.ts ↔ cell-transport-dungeon.json", () => {
    expect(assembleGameSpec(cellSlices)).toEqual(loadJson("cell-transport-dungeon.json"));
  });

  it("civil-rights.slices.ts ↔ civil-rights-dungeon.json", () => {
    expect(assembleGameSpec(historySlices)).toEqual(loadJson("civil-rights-dungeon.json"));
  });

  it("trig-platformer.slices.ts ↔ trig-platformer.json", () => {
    expect(assembleGameSpec(trigPlatformerSlices)).toEqual(loadJson("trig-platformer.json"));
  });

  it("civil-rights-mystery.slices.ts ↔ civil-rights-mystery.json", () => {
    expect(assembleGameSpec(historyMysterySlices)).toEqual(loadJson("civil-rights-mystery.json"));
  });

  it("wave2.slices.ts ↔ wave2-dungeon.json", () => {
    expect(assembleGameSpec(wave2Slices)).toEqual(loadJson("wave2-dungeon.json"));
  });
});
