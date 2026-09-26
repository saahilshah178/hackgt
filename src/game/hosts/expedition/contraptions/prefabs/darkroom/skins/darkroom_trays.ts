/**
 * darkroom · skin darkroom_trays — W0 STUB (a labelled box). SB (docs/design/20 §7.2) draws the real sandbox.
 */
import type { DarkroomConfig } from "@/world/sandboxes/darkroom.config";
import type { DarkroomPose } from "@/world/sandboxes/darkroom.meta";
import type { SandboxSkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SandboxSkinPrefab<DarkroomConfig, DarkroomPose> = {
  skinId: "darkroom_trays",
  create(scene, _phaser, props) {
    return stubBox<DarkroomPose>(scene, {
      at: { x: props.sandbox.anchor.x, y: props.sandbox.anchor.y },
      console: { x: props.sandbox.consoleX, y: props.groundY },
      label: "darkroom\ndarkroom_trays",
      color: STUB_COLOR,
    });
  },
};
export default skin;
