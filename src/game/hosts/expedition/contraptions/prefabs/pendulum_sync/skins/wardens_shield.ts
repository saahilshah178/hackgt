/**
 * pendulum_sync · skin wardens_shield — W0 STUB (a labelled box). The owning lane (docs/design/20 §7.2: KA (L6)) draws the skin's
 * parts (§4.3 slots, `<ns>.part.wardens_shield_<slot>`) and applies the archetype's Pose from `@/world/contraptions/pendulum-sync.meta`.
 */
import type { PendulumSyncConfig } from "@/world/contraptions/pendulum-sync.config";
import type { PendulumSyncPose } from "@/world/contraptions/pendulum-sync.meta";
import type { SkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SkinPrefab<PendulumSyncConfig, PendulumSyncPose> = {
  skinId: "wardens_shield",
  create(scene, _phaser, props) {
    return stubBox<PendulumSyncPose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "pendulum_sync\nwardens_shield",
      color: STUB_COLOR,
    });
  },
};
export default skin;
