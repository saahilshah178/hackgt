/**
 * stage_machine · skin pump_rewiring — W0 STUB (a labelled box). The owning lane (docs/design/20 §7.2: KB (L7)) draws the skin's
 * parts (§4.3 slots, `<ns>.part.pump_rewiring_<slot>`) and applies the archetype's Pose from `@/world/contraptions/stage-machine.meta`.
 */
import type { StageMachineConfig } from "@/world/contraptions/stage-machine.config";
import type { StageMachinePose } from "@/world/contraptions/stage-machine.meta";
import type { SkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SkinPrefab<StageMachineConfig, StageMachinePose> = {
  skinId: "pump_rewiring",
  create(scene, _phaser, props) {
    return stubBox<StageMachinePose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "stage_machine\npump_rewiring",
      color: STUB_COLOR,
    });
  },
};
export default skin;
