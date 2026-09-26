/**
 * oracle_ticker skins — the static dispatch table (W0, main-owned; docs/design/20 §2.5.5, §7.0). One line per skin; the skin
 * FILES belong to their lanes. Adding a skin to the meta means adding its file and one line here (a main diff).
 */
import type { OracleTickerConfig } from "@/world/contraptions/oracle-ticker.config";
import type { OracleTickerPose } from "@/world/contraptions/oracle-ticker.meta";
import type { SkinPrefab } from "../../../types";
import { skin as wireTicker } from "./wire_ticker";

export const SKIN_IDS = ["wire_ticker"] as const;
export const DEFAULT_SKIN = "wire_ticker";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SkinPrefab<OracleTickerConfig, OracleTickerPose>>> = {
  wire_ticker: wireTicker,
};

export function skinPrefabFor(skinId: string): SkinPrefab<OracleTickerConfig, OracleTickerPose> {
  return (SKINS as Readonly<Record<string, SkinPrefab<OracleTickerConfig, OracleTickerPose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
