/**
 * src/game/hosts/expedition/contraptions/registry.ts (W0, main) — one line per prefab (docs/design/20 §2.2).
 * Lanes replace the prefab FILES; this registry never changes when a stub becomes native.
 * The ContraptionController takes the meta from `station.meta` (src/world/library.ts); prefab.meta is the same object.
 */
import { ARCHETYPE_IDS, SANDBOX_IDS, type ArchetypeId, type SandboxId } from "@/world/library";
import { prefab as causeTubes } from "./prefabs/cause_tubes/prefab";
import { prefab as claimHolders } from "./prefabs/claim_holders/prefab";
import { prefab as consoleSlate } from "./prefabs/console_slate/prefab";
import { prefab as darkroom } from "./prefabs/darkroom/prefab";
import { prefab as emitterRail } from "./prefabs/emitter_rail/prefab";
import { prefab as musicBox } from "./prefabs/music_box/prefab";
import { prefab as oracleTicker } from "./prefabs/oracle_ticker/prefab";
import { prefab as pendulumSync } from "./prefabs/pendulum_sync/prefab";
import { prefab as plantGarden } from "./prefabs/plant_garden/prefab";
import { prefab as ringGate } from "./prefabs/ring_gate/prefab";
import { prefab as routerLanes } from "./prefabs/router_lanes/prefab";
import { prefab as sluiceWaves } from "./prefabs/sluice_waves/prefab";
import { prefab as stageMachine } from "./prefabs/stage_machine/prefab";
import { prefab as stepBridge } from "./prefabs/step_bridge/prefab";
import { prefab as switchboard } from "./prefabs/switchboard/prefab";
import { prefab as tumblerVault } from "./prefabs/tumbler_vault/prefab";
import type { AnyContraptionPrefab, AnySandboxPrefab } from "./types";

export const PREFABS: Readonly<Record<ArchetypeId, AnyContraptionPrefab>> = {
  ring_gate: ringGate,
  emitter_rail: emitterRail,
  pendulum_sync: pendulumSync,
  claim_holders: claimHolders,
  oracle_ticker: oracleTicker,
  step_bridge: stepBridge,
  router_lanes: routerLanes,
  sluice_waves: sluiceWaves,
  switchboard: switchboard,
  stage_machine: stageMachine,
  cause_tubes: causeTubes,
  tumbler_vault: tumblerVault,
  console_slate: consoleSlate,
};

export const SANDBOX_PREFABS: Readonly<Record<SandboxId, AnySandboxPrefab>> = {
  music_box: musicBox,
  plant_garden: plantGarden,
  darkroom: darkroom,
};

/** The prefab for a contraption id; unknown ids fall back to console_slate. */
export function prefabFor(id: string): AnyContraptionPrefab {
  return (ARCHETYPE_IDS as readonly string[]).includes(id) ? PREFABS[id as ArchetypeId] : PREFABS.console_slate;
}
/** The prefab for a sandbox id, or null when unknown (the sandbox is then not built). */
export function sandboxPrefabFor(id: string): AnySandboxPrefab | null {
  return (SANDBOX_IDS as readonly string[]).includes(id) ? SANDBOX_PREFABS[id as SandboxId] : null;
}
