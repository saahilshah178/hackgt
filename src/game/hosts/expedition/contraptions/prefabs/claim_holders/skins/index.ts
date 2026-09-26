/**
 * claim_holders skins — the static dispatch table (W0, main-owned; docs/design/20 §2.5.5, §7.0). One line per skin; the skin
 * FILES belong to their lanes. Adding a skin to the meta means adding its file and one line here (a main diff).
 */
import type { ClaimHoldersConfig } from "@/world/contraptions/claim-holders.config";
import type { ClaimHoldersPose } from "@/world/contraptions/claim-holders.meta";
import type { SkinPrefab } from "../../../types";
import { skin as resonancePillars } from "./resonance_pillars";
import { skin as treasuryPillars } from "./treasury_pillars";
import { skin as specimenPods } from "./specimen_pods";
import { skin as witnessProjector } from "./witness_projector";

export const SKIN_IDS = ["resonance_pillars", "treasury_pillars", "specimen_pods", "witness_projector"] as const;
export const DEFAULT_SKIN = "resonance_pillars";
export const SKINS: Readonly<Record<(typeof SKIN_IDS)[number], SkinPrefab<ClaimHoldersConfig, ClaimHoldersPose>>> = {
  resonance_pillars: resonancePillars,
  treasury_pillars: treasuryPillars,
  specimen_pods: specimenPods,
  witness_projector: witnessProjector,
};

export function skinPrefabFor(skinId: string): SkinPrefab<ClaimHoldersConfig, ClaimHoldersPose> {
  return (SKINS as Readonly<Record<string, SkinPrefab<ClaimHoldersConfig, ClaimHoldersPose>>>)[skinId] ?? SKINS[DEFAULT_SKIN];
}
