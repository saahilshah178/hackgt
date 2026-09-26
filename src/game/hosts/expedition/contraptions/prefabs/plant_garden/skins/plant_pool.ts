/**
 * plant_garden · skin plant_pool — W0 STUB (a labelled box). SB (docs/design/20 §7.2) draws the real sandbox.
 */
import type { PlantGardenConfig } from "@/world/sandboxes/plant-garden.config";
import type { PlantGardenPose } from "@/world/sandboxes/plant-garden.meta";
import type { SandboxSkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SandboxSkinPrefab<PlantGardenConfig, PlantGardenPose> = {
  skinId: "plant_pool",
  create(scene, _phaser, props) {
    return stubBox<PlantGardenPose>(scene, {
      at: { x: props.sandbox.anchor.x, y: props.sandbox.anchor.y },
      console: { x: props.sandbox.consoleX, y: props.groundY },
      label: "plant_garden\nplant_pool",
      color: STUB_COLOR,
    });
  },
};
export default skin;
