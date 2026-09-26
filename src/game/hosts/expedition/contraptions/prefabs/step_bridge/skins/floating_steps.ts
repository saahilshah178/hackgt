/**
 * step_bridge · skin floating_steps — W0 STUB (a labelled box). The owning lane (docs/design/20 §7.2: KA (L6); skins: KA floating_steps, KB endocytosis_lift, KC walking_road + timeline_bridge) draws the skin's
 * parts (§4.3 slots, `<ns>.part.floating_steps_<slot>`) and applies the archetype's Pose from `@/world/contraptions/step-bridge.meta`.
 */
import type { StepBridgeConfig } from "@/world/contraptions/step-bridge.config";
import type { StepBridgePose } from "@/world/contraptions/step-bridge.meta";
import type { SkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SkinPrefab<StepBridgeConfig, StepBridgePose> = {
  skinId: "floating_steps",
  create(scene, _phaser, props) {
    return stubBox<StepBridgePose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "step_bridge\nfloating_steps",
      color: STUB_COLOR,
    });
  },
};
export default skin;
