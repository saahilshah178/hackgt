/**
 * music_box skins — the static dispatch table (W0, main-owned).
 */
import type { MusicBoxConfig } from "@/world/sandboxes/music-box.config";
import type { MusicBoxPose } from "@/world/sandboxes/music-box.meta";
import type { SandboxSkinPrefab } from "../../../types";
import { skin as astronomerBox } from "./astronomer_box";

export const SKIN_IDS = ["astronomer_box"] as const;
export const DEFAULT_SKIN = "astronomer_box";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SandboxSkinPrefab<MusicBoxConfig, MusicBoxPose>>> = {
  astronomer_box: astronomerBox,
};

export function skinPrefabFor(skinId: string): SandboxSkinPrefab<MusicBoxConfig, MusicBoxPose> {
  return (SKINS as Readonly<Record<string, SandboxSkinPrefab<MusicBoxConfig, MusicBoxPose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
