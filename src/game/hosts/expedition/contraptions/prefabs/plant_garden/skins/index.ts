/**
 * plant_garden skins — the static dispatch table (W0, main-owned).
 */
import type { PlantGardenConfig } from "@/world/sandboxes/plant-garden.config";
import type { PlantGardenPose } from "@/world/sandboxes/plant-garden.meta";
import type { SandboxSkinPrefab } from "../../../types";
import { skin as plantPool } from "./plant_pool";

export const SKIN_IDS = ["plant_pool"] as const;
export const DEFAULT_SKIN = "plant_pool";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SandboxSkinPrefab<PlantGardenConfig, PlantGardenPose>>> = {
  plant_pool: plantPool,
};

export function skinPrefabFor(skinId: string): SandboxSkinPrefab<PlantGardenConfig, PlantGardenPose> {
  return (SKINS as Readonly<Record<string, SandboxSkinPrefab<PlantGardenConfig, PlantGardenPose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
