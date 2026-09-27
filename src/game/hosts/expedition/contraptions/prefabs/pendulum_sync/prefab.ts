/**
 * pendulum_sync prefab core (docs/design/20 §2.5.5). Owned by KA (L6). Dispatches to one file per skin through the
 * static skins/index.ts, so a skin can be owned by a different lane than this core. KA3: the Warden's Shield is native
 * (code-drawn stand-ins in the biome palette until KA4's hero parts land); the meta runs the pendulum-beat sim.
 */
import type { PendulumSyncConfig } from "@/world/contraptions/pendulum-sync.config";
import { pendulumSyncMeta, type PendulumSyncPose } from "@/world/contraptions/pendulum-sync.meta";
import type { PendulumBeatState } from "@/world/sims/pendulum-beat";
import { definePrefab } from "../../types";
import { skinPrefabFor } from "./skins";

export const prefab = definePrefab<PendulumSyncConfig, PendulumSyncPose, PendulumBeatState>({
  meta: pendulumSyncMeta,
  create: (scene, phaser, props) => skinPrefabFor(props.station.skin).create(scene, phaser, props),
});
export default prefab;
