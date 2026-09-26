/**
 * emitter_rail prefab core (docs/design/20 §2.5.5). Owned by KA (L6). Dispatches to one file per skin through the
 * static skins/index.ts, so a skin can be owned by a different lane than this core. W0: every skin is a labelled box.
 */
import type { EmitterRailConfig } from "@/world/contraptions/emitter-rail.config";
import { emitterRailMeta, type EmitterRailPose } from "@/world/contraptions/emitter-rail.meta";
import { definePrefab } from "../../types";
import { skinPrefabFor } from "./skins";

export const prefab = definePrefab<EmitterRailConfig, EmitterRailPose, null>({
  meta: emitterRailMeta,
  create: (scene, phaser, props) => skinPrefabFor(props.station.skin).create(scene, phaser, props),
});
export default prefab;
