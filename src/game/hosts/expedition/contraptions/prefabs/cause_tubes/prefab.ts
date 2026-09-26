/**
 * cause_tubes prefab core (docs/design/20 §2.5.5). Owned by KC (L8). Dispatches to one file per skin through the
 * static skins/index.ts, so a skin can be owned by a different lane than this core. W0: every skin is a labelled box.
 */
import type { CauseTubesConfig } from "@/world/contraptions/cause-tubes.config";
import { causeTubesMeta, type CauseTubesPose } from "@/world/contraptions/cause-tubes.meta";
import { definePrefab } from "../../types";
import { skinPrefabFor } from "./skins";

export const prefab = definePrefab<CauseTubesConfig, CauseTubesPose, null>({
  meta: causeTubesMeta,
  create: (scene, phaser, props) => skinPrefabFor(props.station.skin).create(scene, phaser, props),
});
export default prefab;
