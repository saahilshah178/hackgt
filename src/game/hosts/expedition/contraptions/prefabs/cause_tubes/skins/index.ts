/**
 * cause_tubes skins — the static dispatch table (W0, main-owned; docs/design/20 §2.5.5, §7.0). One line per skin; the skin
 * FILES belong to their lanes. Adding a skin to the meta means adding its file and one line here (a main diff).
 */
import type { CauseTubesConfig } from "@/world/contraptions/cause-tubes.config";
import type { CauseTubesPose } from "@/world/contraptions/cause-tubes.meta";
import type { SkinPrefab } from "../../../types";
import { skin as relayLine } from "./relay_line";
import { skin as broadcastRelay } from "./broadcast_relay";
import { skin as bigBoard } from "./big_board";

export const SKIN_IDS = ["relay_line", "broadcast_relay", "big_board"] as const;
export const DEFAULT_SKIN = "relay_line";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SkinPrefab<CauseTubesConfig, CauseTubesPose>>> = {
  relay_line: relayLine,
  broadcast_relay: broadcastRelay,
  big_board: bigBoard,
};

export function skinPrefabFor(skinId: string): SkinPrefab<CauseTubesConfig, CauseTubesPose> {
  return (SKINS as Readonly<Record<string, SkinPrefab<CauseTubesConfig, CauseTubesPose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
