import type { GameSpec } from "../src/contracts/gamespec";
import type { World3D } from "../src/contracts/world3d";
import { assembleGameSpec, type Slices } from "../src/pipeline/assemble";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";
import { composeWorld } from "../src/world3d/core/compose";
import { spatialChecks } from "../src/world3d/core/spatial-checks";
import { egyptSlices } from "./ancient-egypt.slices";
import { egyptWorld3D } from "./ancient-egypt.world3d";

/*
 * The 3D open-world showcase games: slices (the learning, assembled like every fixture) plus a hand-authored World3D.
 * `buildWorld3DFixture` composes the world the way the pipeline does (snapping, bridges, pads), stores the corrected
 * world with the composer's fixes, and refuses a world that fails the referential or spatial checks, so a shipped
 * showcase is reachable, legible and winnable by construction. scripts/build-fixtures.ts writes the JSON;
 * tests/fixtures-drift.test.ts keeps it honest.
 */

export interface World3DFixture {
  slices: Slices;
  world3d: World3D;
  file: string;
}

export const WORLD3D_SHOWCASE: World3DFixture[] = [{ slices: egyptSlices, world3d: egyptWorld3D, file: "ancient-egypt-world3d.json" }];

export function buildWorld3DFixture(f: Pick<World3DFixture, "slices" | "world3d">): GameSpec {
  const base = assembleGameSpec(f.slices) as GameSpec;
  const composed = composeWorld(f.world3d, { skipScatter: true });
  const world: World3D = { ...composed.world, provenance: { source: "fixture", model: null, reviews: [], fixes: composed.fixes } };
  const result = validateGameSpec({ ...base, world3d: world });
  if (!result.ok) throw new Error(`${f.slices.id}: invalid world3d fixture:\n${result.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  const spatial = spatialChecks(result.spec, composeWorld(world, { skipScatter: true }));
  if (spatial.issues.length > 0) throw new Error(`${f.slices.id}: world fails the spatial checks:\n${spatial.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  return result.spec;
}
