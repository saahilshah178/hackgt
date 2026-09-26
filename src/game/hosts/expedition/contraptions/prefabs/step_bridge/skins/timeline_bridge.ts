/**
 * step_bridge · skin timeline_bridge — W0 STUB (a labelled box). The owning lane (docs/design/20 §7.2: KA (L6); skins: KA floating_steps, KB endocytosis_lift, KC walking_road + timeline_bridge) draws the skin's
 * parts (§4.3 slots, `<ns>.part.timeline_bridge_<slot>`) and applies the archetype's Pose from `@/world/contraptions/step-bridge.meta`.
 */
import type { StepBridgeConfig } from "@/world/contraptions/step-bridge.config";
import type { StepBridgePose } from "@/world/contraptions/step-bridge.meta";
import type { SkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SkinPrefab<StepBridgeConfig, StepBridgePose> = {
  skinId: "timeline_bridge",
  create(scene, _phaser, props) {
    return stubBox<StepBridgePose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "step_bridge\ntimeline_bridge",
      color: STUB_COLOR,
    });
  },
};
export default skin;
