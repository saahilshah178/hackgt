/**
 * tumbler_vault skins — the static dispatch table (W0, main-owned; docs/design/20 §2.5.5, §7.0). One line per skin; the skin
 * FILES belong to their lanes. Adding a skin to the meta means adding its file and one line here (a main diff).
 */
import type { TumblerVaultConfig } from "@/world/contraptions/tumbler-vault.config";
import type { TumblerVaultPose } from "@/world/contraptions/tumbler-vault.meta";
import type { SkinPrefab } from "../../../types";
import { skin as tumblerVault } from "./tumbler_vault";

export const SKIN_IDS = ["tumbler_vault"] as const;
export const DEFAULT_SKIN = "tumbler_vault";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SkinPrefab<TumblerVaultConfig, TumblerVaultPose>>> = {
  tumbler_vault: tumblerVault,
};

export function skinPrefabFor(skinId: string): SkinPrefab<TumblerVaultConfig, TumblerVaultPose> {
  return (SKINS as Readonly<Record<string, SkinPrefab<TumblerVaultConfig, TumblerVaultPose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
