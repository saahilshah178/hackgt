/**
 * router_lanes prefab core (docs/design/20 §2.5.5). Owned by KB (L7). Dispatches to one file per skin through the
 * static skins/index.ts, so a skin can be owned by a different lane than this core. The cell skins (membrane_router,
 * carrier_lanes, gatekeeper_maws) plug a RouterSkin into shared.ts `createRouterView` (boss batches, cargo, queues,
 * failure and success playback); the civil skins (filing_cabinets, provenance_drawers) belong to KC.
 */
import type { RouterLanesConfig } from "@/world/contraptions/router-lanes.config";
import { routerLanesMeta, type RouterLanesPose } from "@/world/contraptions/router-lanes.meta";
import { definePrefab } from "../../types";
import { skinPrefabFor } from "./skins";

export const prefab = definePrefab<RouterLanesConfig, RouterLanesPose, null>({
  meta: routerLanesMeta,
  create: (scene, phaser, props) => skinPrefabFor(props.station.skin).create(scene, phaser, props),
});
export default prefab;
