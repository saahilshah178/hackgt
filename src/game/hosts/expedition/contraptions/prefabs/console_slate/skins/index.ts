/**
 * console_slate skins — the static dispatch table (W0, main-owned; docs/design/20 §2.5.5, §7.0). One line per skin; the skin
 * FILES belong to their lanes. Adding a skin to the meta means adding its file and one line here (a main diff).
 */
import type { ConsoleSlateConfig } from "@/world/contraptions/console-slate.config";
import type { ConsoleSlatePose } from "@/world/contraptions/console-slate.meta";
import type { SkinPrefab } from "../../../types";
import { skin as lecternSlate } from "./lectern_slate";

export const SKIN_IDS = ["lectern_slate"] as const;
export const DEFAULT_SKIN = "lectern_slate";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SkinPrefab<ConsoleSlateConfig, ConsoleSlatePose>>> = {
  lectern_slate: lecternSlate,
};

export function skinPrefabFor(skinId: string): SkinPrefab<ConsoleSlateConfig, ConsoleSlatePose> {
  return (SKINS as Readonly<Record<string, SkinPrefab<ConsoleSlateConfig, ConsoleSlatePose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
