/**
 * claim_holders prefab core (docs/design/20 §2.5.5). Owned by KA (L6). Dispatches to one file per skin through the
 * static skins/index.ts, so a skin can be owned by a different lane than this core. W0: every skin is a labelled box.
 */
import type { ClaimHoldersConfig } from "@/world/contraptions/claim-holders.config";
import { claimHoldersMeta, type ClaimHoldersPose, type ClaimHoldersSim } from "@/world/contraptions/claim-holders.meta";
import { definePrefab } from "../../types";
import { skinPrefabFor } from "./skins";

export const prefab = definePrefab<ClaimHoldersConfig, ClaimHoldersPose, ClaimHoldersSim | null>({
  meta: claimHoldersMeta,
  create: (scene, phaser, props) => skinPrefabFor(props.station.skin).create(scene, phaser, props),
});
export default prefab;
