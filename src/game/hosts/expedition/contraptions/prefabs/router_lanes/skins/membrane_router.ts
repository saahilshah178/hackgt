/**
 * router_lanes · skin membrane_router — W0 STUB (a labelled box). The owning lane (docs/design/20 §7.2: KB (L7); skins: KB cell three, KC filing_cabinets + provenance_drawers) draws the skin's
 * parts (§4.3 slots, `<ns>.part.membrane_router_<slot>`) and applies the archetype's Pose from `@/world/contraptions/router-lanes.meta`.
 */
import type { RouterLanesConfig } from "@/world/contraptions/router-lanes.config";
import type { RouterLanesPose } from "@/world/contraptions/router-lanes.meta";
import type { SkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SkinPrefab<RouterLanesConfig, RouterLanesPose> = {
  skinId: "membrane_router",
  create(scene, _phaser, props) {
    return stubBox<RouterLanesPose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "router_lanes\nmembrane_router",
      color: STUB_COLOR,
    });
  },
};
export default skin;
