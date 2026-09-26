/**
 * ring_gate skins — the static dispatch table (W0, main-owned; docs/design/20 §2.5.5, §7.0). One line per skin; the skin
 * FILES belong to their lanes. Adding a skin to the meta means adding its file and one line here (a main diff).
 */
import type { RingGateConfig } from "@/world/contraptions/ring-gate.config";
import type { RingGatePose } from "@/world/contraptions/ring-gate.meta";
import type { SkinPrefab } from "../../../types";
import { skin as ringGate } from "./ring_gate";

export const SKIN_IDS = ["ring_gate"] as const;
export const DEFAULT_SKIN = "ring_gate";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SkinPrefab<RingGateConfig, RingGatePose>>> = {
  ring_gate: ringGate,
};

export function skinPrefabFor(skinId: string): SkinPrefab<RingGateConfig, RingGatePose> {
  return (SKINS as Readonly<Record<string, SkinPrefab<RingGateConfig, RingGatePose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
