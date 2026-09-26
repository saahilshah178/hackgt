/**
 * cause_tubes · skin broadcast_relay — W0 STUB (a labelled box). The owning lane (docs/design/20 §7.2: KC (L8)) draws the skin's
 * parts (§4.3 slots, `<ns>.part.broadcast_relay_<slot>`) and applies the archetype's Pose from `@/world/contraptions/cause-tubes.meta`.
 */
import type { CauseTubesConfig } from "@/world/contraptions/cause-tubes.config";
import type { CauseTubesPose } from "@/world/contraptions/cause-tubes.meta";
import type { SkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SkinPrefab<CauseTubesConfig, CauseTubesPose> = {
  skinId: "broadcast_relay",
  create(scene, _phaser, props) {
    return stubBox<CauseTubesPose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "cause_tubes\nbroadcast_relay",
      color: STUB_COLOR,
    });
  },
};
export default skin;
