/**
 * music_box sandbox prefab core (docs/design/20 §2.4b, §2.5.5). Owned by SB after the P0 freeze. W0: a labelled box.
 */
import type { MusicBoxConfig } from "@/world/sandboxes/music-box.config";
import { musicBoxMeta, type MusicBoxPose } from "@/world/sandboxes/music-box.meta";
import { defineSandboxPrefab } from "../../types";
import { skinPrefabFor } from "./skins";

export const prefab = defineSandboxPrefab<MusicBoxConfig, MusicBoxPose, null>({
  meta: musicBoxMeta,
  create: (scene, phaser, props) => skinPrefabFor(props.sandbox.skin).create(scene, phaser, props),
});
export default prefab;
