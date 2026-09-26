/**
 * sluice_waves skins — the static dispatch table (W0, main-owned; docs/design/20 §2.5.5, §7.0). One line per skin; the skin
 * FILES belong to their lanes. Adding a skin to the meta means adding its file and one line here (a main diff).
 */
import type { SluiceWavesConfig } from "@/world/contraptions/sluice-waves.config";
import type { SluiceWavesPose } from "@/world/contraptions/sluice-waves.meta";
import type { SkinPrefab } from "../../../types";
import { skin as tonicitySluices } from "./tonicity_sluices";

export const SKIN_IDS = ["tonicity_sluices"] as const;
export const DEFAULT_SKIN = "tonicity_sluices";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SkinPrefab<SluiceWavesConfig, SluiceWavesPose>>> = {
  tonicity_sluices: tonicitySluices,
};

export function skinPrefabFor(skinId: string): SkinPrefab<SluiceWavesConfig, SluiceWavesPose> {
  return (SKINS as Readonly<Record<string, SkinPrefab<SluiceWavesConfig, SluiceWavesPose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
