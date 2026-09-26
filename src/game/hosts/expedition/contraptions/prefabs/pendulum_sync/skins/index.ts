/**
 * pendulum_sync skins — the static dispatch table (W0, main-owned; docs/design/20 §2.5.5, §7.0). One line per skin; the skin
 * FILES belong to their lanes. Adding a skin to the meta means adding its file and one line here (a main diff).
 */
import type { PendulumSyncConfig } from "@/world/contraptions/pendulum-sync.config";
import type { PendulumSyncPose } from "@/world/contraptions/pendulum-sync.meta";
import type { SkinPrefab } from "../../../types";
import { skin as wardensShield } from "./wardens_shield";

export const SKIN_IDS = ["wardens_shield"] as const;
export const DEFAULT_SKIN = "wardens_shield";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SkinPrefab<PendulumSyncConfig, PendulumSyncPose>>> = {
  wardens_shield: wardensShield,
};

export function skinPrefabFor(skinId: string): SkinPrefab<PendulumSyncConfig, PendulumSyncPose> {
  return (SKINS as Readonly<Record<string, SkinPrefab<PendulumSyncConfig, PendulumSyncPose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
