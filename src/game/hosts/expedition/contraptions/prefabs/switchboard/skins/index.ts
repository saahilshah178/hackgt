/**
 * switchboard skins — the static dispatch table (W0, main-owned; docs/design/20 §2.5.5, §7.0). One line per skin; the skin
 * FILES belong to their lanes. Adding a skin to the meta means adding its file and one line here (a main diff).
 */
import type { SwitchboardConfig } from "@/world/contraptions/switchboard.config";
import type { SwitchboardPose } from "@/world/contraptions/switchboard.meta";
import type { SkinPrefab } from "../../../types";
import { skin as switchboard } from "./switchboard";

export const SKIN_IDS = ["switchboard"] as const;
export const DEFAULT_SKIN = "switchboard";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SkinPrefab<SwitchboardConfig, SwitchboardPose>>> = {
  switchboard: switchboard,
};

export function skinPrefabFor(skinId: string): SkinPrefab<SwitchboardConfig, SwitchboardPose> {
  return (SKINS as Readonly<Record<string, SkinPrefab<SwitchboardConfig, SwitchboardPose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
