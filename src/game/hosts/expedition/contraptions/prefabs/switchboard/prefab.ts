/**
 * switchboard prefab core (docs/design/20 §2.5.5). Owned by KC (L8). Dispatches to one file per skin through the
 * static skins/index.ts; the skin plugs a SwitchboardSkin into shared.ts `createSwitchboardView` (patch cords from
 * prefabs/_cables, failure and success beat playback).
 */
import type { SwitchboardConfig } from "@/world/contraptions/switchboard.config";
import { switchboardMeta, type SwitchboardPose } from "@/world/contraptions/switchboard.meta";
import { definePrefab } from "../../types";
import { skinPrefabFor } from "./skins";

export const prefab = definePrefab<SwitchboardConfig, SwitchboardPose, null>({
  meta: switchboardMeta,
  create: (scene, phaser, props) => skinPrefabFor(props.station.skin).create(scene, phaser, props),
});
export default prefab;
