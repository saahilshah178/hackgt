/**
 * emitter_rail skins — the static dispatch table (W0, main-owned; docs/design/20 §2.5.5, §7.0). One line per skin; the skin
 * FILES belong to their lanes. Adding a skin to the meta means adding its file and one line here (a main diff).
 */
import type { EmitterRailConfig } from "@/world/contraptions/emitter-rail.config";
import type { EmitterRailPose } from "@/world/contraptions/emitter-rail.meta";
import type { SkinPrefab } from "../../../types";
import { skin as vesperDial } from "./vesper_dial";

export const SKIN_IDS = ["vesper_dial"] as const;
export const DEFAULT_SKIN = "vesper_dial";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SkinPrefab<EmitterRailConfig, EmitterRailPose>>> = {
  vesper_dial: vesperDial,
};

export function skinPrefabFor(skinId: string): SkinPrefab<EmitterRailConfig, EmitterRailPose> {
  return (SKINS as Readonly<Record<string, SkinPrefab<EmitterRailConfig, EmitterRailPose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
