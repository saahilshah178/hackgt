/**
 * switchboard · skin switchboard — W0 STUB (a labelled box). The owning lane (docs/design/20 §7.2: KC (L8)) draws the skin's
 * parts (§4.3 slots, `<ns>.part.switchboard_<slot>`) and applies the archetype's Pose from `@/world/contraptions/switchboard.meta`.
 */
import type { SwitchboardConfig } from "@/world/contraptions/switchboard.config";
import type { SwitchboardPose } from "@/world/contraptions/switchboard.meta";
import type { SkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SkinPrefab<SwitchboardConfig, SwitchboardPose> = {
  skinId: "switchboard",
  create(scene, _phaser, props) {
    return stubBox<SwitchboardPose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "switchboard\nswitchboard",
      color: STUB_COLOR,
    });
  },
};
export default skin;
