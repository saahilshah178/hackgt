/**
 * step_bridge prefab core (docs/design/20 §2.5.5). Owned by KA (L6). Dispatches to one file per skin through the
 * static skins/index.ts, so a skin can be owned by a different lane than this core. KA3: floating_steps is native (code-drawn
 * stand-ins until KA4's heroes); walking_road / timeline_bridge (KC) and endocytosis_lift (KB) are their lanes' files.
 */
import type { StepBridgeConfig } from "@/world/contraptions/step-bridge.config";
import { stepBridgeMeta, type StepBridgePose } from "@/world/contraptions/step-bridge.meta";
import { definePrefab } from "../../types";
import { skinPrefabFor } from "./skins";

export const prefab = definePrefab<StepBridgeConfig, StepBridgePose, null>({
  meta: stepBridgeMeta,
  create: (scene, phaser, props) => skinPrefabFor(props.station.skin).create(scene, phaser, props),
});
export default prefab;
