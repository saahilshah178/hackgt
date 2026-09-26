/**
 * darkroom skins — the static dispatch table (W0, main-owned).
 */
import type { DarkroomConfig } from "@/world/sandboxes/darkroom.config";
import type { DarkroomPose } from "@/world/sandboxes/darkroom.meta";
import type { SandboxSkinPrefab } from "../../../types";
import { skin as darkroomTrays } from "./darkroom_trays";

export const SKIN_IDS = ["darkroom_trays"] as const;
export const DEFAULT_SKIN = "darkroom_trays";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SandboxSkinPrefab<DarkroomConfig, DarkroomPose>>> = {
  darkroom_trays: darkroomTrays,
};

export function skinPrefabFor(skinId: string): SandboxSkinPrefab<DarkroomConfig, DarkroomPose> {
  return (SKINS as Readonly<Record<string, SandboxSkinPrefab<DarkroomConfig, DarkroomPose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
