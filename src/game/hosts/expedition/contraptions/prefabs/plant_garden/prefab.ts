/**
 * plant_garden sandbox prefab core (docs/design/20 §2.4b, §2.5.5). Owned by SB after the P0 freeze. W0: a labelled box.
 */
import type { PlantGardenConfig } from "@/world/sandboxes/plant-garden.config";
import { plantGardenMeta, type PlantGardenPose } from "@/world/sandboxes/plant-garden.meta";
import { defineSandboxPrefab } from "../../types";
import { skinPrefabFor } from "./skins";

export const prefab = defineSandboxPrefab<PlantGardenConfig, PlantGardenPose, null>({
  meta: plantGardenMeta,
  create: (scene, phaser, props) => skinPrefabFor(props.sandbox.skin).create(scene, phaser, props),
});
export default prefab;
