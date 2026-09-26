/**
 * router_lanes skins — the static dispatch table (W0, main-owned; docs/design/20 §2.5.5, §7.0). One line per skin; the skin
 * FILES belong to their lanes. Adding a skin to the meta means adding its file and one line here (a main diff).
 */
import type { RouterLanesConfig } from "@/world/contraptions/router-lanes.config";
import type { RouterLanesPose } from "@/world/contraptions/router-lanes.meta";
import type { SkinPrefab } from "../../../types";
import { skin as membraneRouter } from "./membrane_router";
import { skin as carrierLanes } from "./carrier_lanes";
import { skin as gatekeeperMaws } from "./gatekeeper_maws";
import { skin as filingCabinets } from "./filing_cabinets";
import { skin as provenanceDrawers } from "./provenance_drawers";

export const SKIN_IDS = ["membrane_router", "carrier_lanes", "gatekeeper_maws", "filing_cabinets", "provenance_drawers"] as const;
export const DEFAULT_SKIN = "membrane_router";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SkinPrefab<RouterLanesConfig, RouterLanesPose>>> = {
  membrane_router: membraneRouter,
  carrier_lanes: carrierLanes,
  gatekeeper_maws: gatekeeperMaws,
  filing_cabinets: filingCabinets,
  provenance_drawers: provenanceDrawers,
};

export function skinPrefabFor(skinId: string): SkinPrefab<RouterLanesConfig, RouterLanesPose> {
  return (SKINS as Readonly<Record<string, SkinPrefab<RouterLanesConfig, RouterLanesPose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
