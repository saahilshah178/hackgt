/**
 * switchboard prefab core (docs/design/20 §2.5.5). Owned by KC (L8). Dispatches to one file per skin through the
 * static skins/index.ts and mounts the station's record_lens accessory (civil §5.0.2) on the skin it built; the
 * skin plugs a SwitchboardSkin into shared.ts `createSwitchboardView` (patch cords from
 * prefabs/_cables, failure and success beat playback).
 */
import type { SwitchboardConfig } from "@/world/contraptions/switchboard.config";
import { switchboardMeta, type SwitchboardPose } from "@/world/contraptions/switchboard.meta";
import { withRecordLens } from "../../accessories/record-lens";
import { definePrefab } from "../../types";
import { skinPrefabFor } from "./skins";

export const prefab = definePrefab<SwitchboardConfig, SwitchboardPose, null>({
  meta: switchboardMeta,
  create: (scene, phaser, props) => withRecordLens(skinPrefabFor(props.station.skin).create(scene, phaser, props), scene, props, (p) => p.lensU),
});
export default prefab;
