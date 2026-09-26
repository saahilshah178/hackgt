/**
 * emitter_rail · skin vesper_dial — W0 STUB (a labelled box). The owning lane (docs/design/20 §7.2: KA (L6)) draws the skin's
 * parts (§4.3 slots, `<ns>.part.vesper_dial_<slot>`) and applies the archetype's Pose from `@/world/contraptions/emitter-rail.meta`.
 */
import type { EmitterRailConfig } from "@/world/contraptions/emitter-rail.config";
import type { EmitterRailPose } from "@/world/contraptions/emitter-rail.meta";
import type { SkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SkinPrefab<EmitterRailConfig, EmitterRailPose> = {
  skinId: "vesper_dial",
  create(scene, _phaser, props) {
    return stubBox<EmitterRailPose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "emitter_rail\nvesper_dial",
      color: STUB_COLOR,
    });
  },
};
export default skin;
