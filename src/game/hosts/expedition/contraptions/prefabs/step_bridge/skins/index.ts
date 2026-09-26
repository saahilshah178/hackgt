/**
 * step_bridge skins — the static dispatch table (W0, main-owned; docs/design/20 §2.5.5, §7.0). One line per skin; the skin
 * FILES belong to their lanes. Adding a skin to the meta means adding its file and one line here (a main diff).
 */
import type { StepBridgeConfig } from "@/world/contraptions/step-bridge.config";
import type { StepBridgePose } from "@/world/contraptions/step-bridge.meta";
import type { SkinPrefab } from "../../../types";
import { skin as floatingSteps } from "./floating_steps";
import { skin as walkingRoad } from "./walking_road";
import { skin as timelineBridge } from "./timeline_bridge";
import { skin as endocytosisLift } from "./endocytosis_lift";

export const SKIN_IDS = ["floating_steps", "walking_road", "timeline_bridge", "endocytosis_lift"] as const;
export const DEFAULT_SKIN = "floating_steps";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SkinPrefab<StepBridgeConfig, StepBridgePose>>> = {
  floating_steps: floatingSteps,
  walking_road: walkingRoad,
  timeline_bridge: timelineBridge,
  endocytosis_lift: endocytosisLift,
};

export function skinPrefabFor(skinId: string): SkinPrefab<StepBridgeConfig, StepBridgePose> {
  return (SKINS as Readonly<Record<string, SkinPrefab<StepBridgeConfig, StepBridgePose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
