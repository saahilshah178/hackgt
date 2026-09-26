/**
 * stage_machine skins — the static dispatch table (W0, main-owned; docs/design/20 §2.5.5, §7.0). One line per skin; the skin
 * FILES belong to their lanes. Adding a skin to the meta means adding its file and one line here (a main diff).
 */
import type { StageMachineConfig } from "@/world/contraptions/stage-machine.config";
import type { StageMachinePose } from "@/world/contraptions/stage-machine.meta";
import type { SkinPrefab } from "../../../types";
import { skin as pumpRewiring } from "./pump_rewiring";

export const SKIN_IDS = ["pump_rewiring"] as const;
export const DEFAULT_SKIN = "pump_rewiring";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SkinPrefab<StageMachineConfig, StageMachinePose>>> = {
  pump_rewiring: pumpRewiring,
};

export function skinPrefabFor(skinId: string): SkinPrefab<StageMachineConfig, StageMachinePose> {
  return (SKINS as Readonly<Record<string, SkinPrefab<StageMachineConfig, StageMachinePose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
