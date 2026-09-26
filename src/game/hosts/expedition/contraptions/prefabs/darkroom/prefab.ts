/**
 * darkroom sandbox prefab core (docs/design/20 §2.4b, §2.5.5). Owned by SB after the P0 freeze. W0: a labelled box.
 */
import type { DarkroomConfig } from "@/world/sandboxes/darkroom.config";
import { darkroomMeta, type DarkroomPose } from "@/world/sandboxes/darkroom.meta";
import { defineSandboxPrefab } from "../../types";
import { skinPrefabFor } from "./skins";

export const prefab = defineSandboxPrefab<DarkroomConfig, DarkroomPose, null>({
  meta: darkroomMeta,
  create: (scene, phaser, props) => skinPrefabFor(props.sandbox.skin).create(scene, phaser, props),
});
export default prefab;
