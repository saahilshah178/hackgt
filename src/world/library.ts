/**
 * src/world/library.ts — the contraption and sandbox registries (docs/design/20 §4, §6.2 WorldMenuStation, §4.4
 * autoWorld table). Pure: imports metas and the mechanics registry, never Phaser or React (tests/world-contract.test.ts
 * walks the module graph to prove it). Main-owned: one line per meta; K lanes edit their meta files, not this one.
 */
import type { Domain, EncounterRole } from "../contracts/common";
import type { GameSpec } from "../contracts/gamespec";
import { getMode, implementedModes } from "../mechanics/registry";
import { encounterTexts, writerItemKeys } from "./contraptions/config-parts";
import { causeTubesMeta } from "./contraptions/cause-tubes.meta";
import { claimHoldersMeta } from "./contraptions/claim-holders.meta";
import { consoleSlateMeta } from "./contraptions/console-slate.meta";
import { emitterRailMeta } from "./contraptions/emitter-rail.meta";
import { oracleTickerMeta } from "./contraptions/oracle-ticker.meta";
import { pendulumSyncMeta } from "./contraptions/pendulum-sync.meta";
import { ringGateMeta } from "./contraptions/ring-gate.meta";
import { routerLanesMeta } from "./contraptions/router-lanes.meta";
import { sluiceWavesMeta } from "./contraptions/sluice-waves.meta";
import { stageMachineMeta } from "./contraptions/stage-machine.meta";
import { stepBridgeMeta } from "./contraptions/step-bridge.meta";
import { switchboardMeta } from "./contraptions/switchboard.meta";
import { tumblerVaultMeta } from "./contraptions/tumbler-vault.meta";
import { darkroomMeta } from "./sandboxes/darkroom.meta";
import { musicBoxMeta } from "./sandboxes/music-box.meta";
import { plantGardenMeta } from "./sandboxes/plant-garden.meta";
import type { AnyContraptionMeta, AnySandboxMeta, ConfigCtx, ContraptionSkin, ModeKey, WriterCtx } from "./types";

/** The 13 demo archetype ids, in §4 table order. */
export const ARCHETYPE_IDS = [
  "ring_gate",
  "emitter_rail",
  "pendulum_sync",
  "claim_holders",
  "oracle_ticker",
  "step_bridge",
  "router_lanes",
  "sluice_waves",
  "switchboard",
  "stage_machine",
  "cause_tubes",
  "tumbler_vault",
  "console_slate",
] as const;
export type ArchetypeId = (typeof ARCHETYPE_IDS)[number];
/** The 3 sandbox ids (§2.4b). */
export const SANDBOX_IDS = ["music_box", "plant_garden", "darkroom"] as const;
export type SandboxId = (typeof SANDBOX_IDS)[number];
/** §4 rows 14–17: kept on the roadmap, not registered; console_slate covers their modes (amendment 38). */
export const POST_DEMO_ARCHETYPE_IDS = ["counterweight_lift", "beam_table", "glyph_ring", "pillar_staircase"] as const;

/** Every implemented family·mode key, from the mechanics registry. */
export function implementedModeKeys(): ModeKey[] {
  return implementedModes().map((m) => m.key as ModeKey);
}

const consoleSlate: AnyContraptionMeta = { ...consoleSlateMeta, modes: implementedModeKeys() };

export const CONTRAPTION_LIBRARY: Readonly<Record<ArchetypeId, AnyContraptionMeta>> = {
  ring_gate: ringGateMeta,
  emitter_rail: emitterRailMeta,
  pendulum_sync: pendulumSyncMeta,
  claim_holders: claimHoldersMeta,
  oracle_ticker: oracleTickerMeta,
  step_bridge: stepBridgeMeta,
  router_lanes: routerLanesMeta,
  sluice_waves: sluiceWavesMeta,
  switchboard: switchboardMeta,
  stage_machine: stageMachineMeta,
  cause_tubes: causeTubesMeta,
  tumbler_vault: tumblerVaultMeta,
  console_slate: consoleSlate,
};

export const SANDBOX_LIBRARY: Readonly<Record<SandboxId, AnySandboxMeta>> = {
  music_box: musicBoxMeta,
  plant_garden: plantGardenMeta,
  darkroom: darkroomMeta,
};

export function isArchetypeId(id: string): id is ArchetypeId {
  return (ARCHETYPE_IDS as readonly string[]).includes(id);
}
export function isSandboxId(id: string): id is SandboxId {
  return (SANDBOX_IDS as readonly string[]).includes(id);
}
export function getContraption(id: string): AnyContraptionMeta | undefined {
  return isArchetypeId(id) ? CONTRAPTION_LIBRARY[id] : undefined;
}
export function getSandbox(id: string): AnySandboxMeta | undefined {
  return isSandboxId(id) ? SANDBOX_LIBRARY[id] : undefined;
}
export function skinOf(meta: { skins: readonly ContraptionSkin[] }, skinId: string): ContraptionSkin | undefined {
  return meta.skins.find((s) => s.id === skinId);
}
/** Every skin of every contraption and sandbox (art contract listings, asset tests). */
export function allSkins(): { ownerId: string; kind: "contraption" | "sandbox"; skin: ContraptionSkin }[] {
  return [
    ...ARCHETYPE_IDS.flatMap((id) => CONTRAPTION_LIBRARY[id].skins.map((skin) => ({ ownerId: id, kind: "contraption" as const, skin }))),
    ...SANDBOX_IDS.flatMap((id) => SANDBOX_LIBRARY[id].skins.map((skin) => ({ ownerId: id, kind: "sandbox" as const, skin }))),
  ];
}

/** Contraptions whose meta.modes include the mode: native first (library order), console_slate last. */
export function contraptionsForMode(modeKey: string): AnyContraptionMeta[] {
  const natives = ARCHETYPE_IDS.map((id) => CONTRAPTION_LIBRARY[id]).filter(
    (m) => m.tier === "native" && m.status === "demo" && m.modes.includes(modeKey as ModeKey),
  );
  return [...natives, CONTRAPTION_LIBRARY.console_slate];
}

/** autoWorld's archetype per mode (§4.4). stage_machine is never auto-picked (it needs authored semantics). */
export const AUTO_ARCHETYPE_BY_MODE: Readonly<Record<string, ArchetypeId>> = {
  "tuner.oscillator": "ring_gate",
  "mapper.number_line": "emitter_rail",
  "truth_finder.mimic": "claim_holders",
  "truth_finder.predict_reveal": "oracle_ticker",
  "sequencer.linear": "step_bridge",
  "sorter.bins": "router_lanes",
  "sorter.type_match": "sluice_waves",
  "linker.pairs": "switchboard",
  "linker.chain": "cause_tubes",
  "investigator.elimination": "tumbler_vault",
};

/**
 * The contraption autoWorld and the fallback ladder use for a mode: total over every implemented mode (anything
 * without a native archetype gets console_slate). An oscillator boss plays on pendulum_sync (§4.4).
 */
export function contraptionFor(modeKey: string, role?: EncounterRole): AnyContraptionMeta {
  if (modeKey === "tuner.oscillator" && role === "boss") return CONTRAPTION_LIBRARY.pendulum_sync;
  const id = AUTO_ARCHETYPE_BY_MODE[modeKey];
  return id ? CONTRAPTION_LIBRARY[id] : CONTRAPTION_LIBRARY.console_slate;
}

/** ConfigCtx for one encounter of a spec (validators, defaults, fromWriterConfig; server/tests only — reads the solution). */
export function configCtxFor(spec: GameSpec, encounterIndex: number, biome: string): ConfigCtx {
  const encounter = spec.encounters[encounterIndex];
  if (!encounter) throw new Error(`configCtxFor: no encounter at index ${encounterIndex}`);
  const mode = getMode(encounter.familyId, encounter.mode);
  if (!mode) throw new Error(`configCtxFor: unknown mode ${encounter.familyId}.${encounter.mode}`);
  return {
    modeKey: `${encounter.familyId}.${encounter.mode}`,
    encounter,
    params: encounter.params,
    solution: encounter.solution,
    view: mode.present(encounter.params, spec.seed + encounterIndex),
    texts: encounterTexts(encounter),
    biome,
  };
}

/** WriterCtx for one encounter (the World Writer menu, §6.2). */
export function writerCtxFor(spec: GameSpec, encounterIndex: number, domain: Domain): WriterCtx {
  const encounter = spec.encounters[encounterIndex];
  if (!encounter) throw new Error(`writerCtxFor: no encounter at index ${encounterIndex}`);
  const mode = getMode(encounter.familyId, encounter.mode);
  if (!mode) throw new Error(`writerCtxFor: unknown mode ${encounter.familyId}.${encounter.mode}`);
  const view = mode.present(encounter.params, spec.seed + encounterIndex);
  const modeKey: ModeKey = `${encounter.familyId}.${encounter.mode}`;
  return { modeKey, view, itemKeys: writerItemKeys(modeKey, view), domain };
}
