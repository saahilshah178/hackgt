/**
 * tumbler_vault prefab core (docs/design/20 §2.5.5). Owned by KC (L8). Dispatches to one file per skin through the
 * static skins/index.ts, so a skin can be owned by a different lane than this core. W0: every skin is a labelled box.
 */
import type { TumblerVaultConfig } from "@/world/contraptions/tumbler-vault.config";
import { tumblerVaultMeta, type TumblerVaultPose } from "@/world/contraptions/tumbler-vault.meta";
import { definePrefab } from "../../types";
import { skinPrefabFor } from "./skins";

export const prefab = definePrefab<TumblerVaultConfig, TumblerVaultPose, null>({
  meta: tumblerVaultMeta,
  create: (scene, phaser, props) => skinPrefabFor(props.station.skin).create(scene, phaser, props),
});
export default prefab;
