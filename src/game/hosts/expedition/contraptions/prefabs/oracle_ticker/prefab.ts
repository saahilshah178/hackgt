/**
 * oracle_ticker prefab core (docs/design/20 §2.5.5). Owned by KC (L8). Dispatches to one file per skin through the
 * static skins/index.ts, so a skin can be owned by a different lane than this core, and mounts the station's
 * record_lens accessory (civil §5.0.2) on whichever skin it built.
 */
import type { OracleTickerConfig } from "@/world/contraptions/oracle-ticker.config";
import { oracleTickerMeta, type OracleTickerPose } from "@/world/contraptions/oracle-ticker.meta";
import { withRecordLens } from "../../accessories/record-lens";
import { definePrefab } from "../../types";
import { skinPrefabFor } from "./skins";

export const prefab = definePrefab<OracleTickerConfig, OracleTickerPose, null>({
  meta: oracleTickerMeta,
  create: (scene, phaser, props) => withRecordLens(skinPrefabFor(props.station.skin).create(scene, phaser, props), scene, props, (p) => p.lensU),
});
export default prefab;
