/**
 * src/world/sims/index.ts (W0, main-owned) — the sim registry and the reference-sim ghost registry (docs/design/20
 * §4.2 "Sims and ghost registry", §7.0 seams). Each sim is its own file (owned by its lane: KB for the four
 * reference sims and membrane_fold, KA for pendulum_beat); this index never changes when a stub becomes real.
 * Pure, seeded, fixed-step; MEASURABLE state only (F6).
 */
import type { Domain } from "../../contracts/common";
import type { RefSimId } from "../contraptions/claim-holders.config";
import type { SimParams, SimSpec } from "../types";
import { bilayerProbe } from "./bilayer-probe";
import { diffusionTank } from "./diffusion-tank";
import { osmoticCell } from "./osmotic-cell";
import { pumpFlume } from "./pump-flume";

export { bilayerProbe, type BilayerProbeState } from "./bilayer-probe";
export { diffusionTank, type DiffusionTankState } from "./diffusion-tank";
export { osmoticCell, type OsmoticCellState } from "./osmotic-cell";
export { pumpFlume, type PumpFlumeState } from "./pump-flume";
export { FOLD_START, foldStage, membraneFold, type FoldState } from "./membrane-fold";
export { beatHz, pendulumBeat, syncBrightness, type PendulumBeatState } from "./pendulum-beat";

export const SIM_IDS = ["bilayer_probe", "diffusion_tank", "osmotic_cell", "pump_flume", "membrane_fold", "pendulum_beat"] as const;
export type SimId = (typeof SIM_IDS)[number];

/** The four time-stepped reference sims claim_holders runs behind its ghosts (referenceSim.id). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const REF_SIMS: Readonly<Record<RefSimId, SimSpec<SimParams, any>>> = {
  bilayer_probe: bilayerProbe,
  diffusion_tank: diffusionTank,
  osmotic_cell: osmoticCell,
  pump_flume: pumpFlume,
};

/** ghost id → whether it MATCHES or CONTRADICTS the reference sim's physics (ghost honesty, §4.4). Fixed by §4.2. */
export const REF_SIM_GHOSTS: Readonly<Record<RefSimId, Readonly<Record<string, "matches" | "contradicts">>>> = {
  bilayer_probe: { bilayer_outline: "matches", rigid_holed_slab: "contradicts", core_blocks_ion: "matches" },
  diffusion_tank: { random_walk: "matches", purposeful_march: "contradicts", net_flux_arrow: "matches" },
  osmotic_cell: { water_out_arrows: "matches", salt_inflow: "contradicts", shrink_outline: "matches" },
  pump_flume: { uphill_arrow: "matches", atp_sparks: "matches", downhill_boost: "contradicts" },
};
export const REF_SIM_IDS: readonly RefSimId[] = ["bilayer_probe", "diffusion_tank", "osmotic_cell", "pump_flume"];

const SCIENCE_DOMAINS: ReadonlySet<Domain> = new Set<Domain>(["biology", "chemistry", "health"]);
/** Reference sims a writer may pick for a domain (claim_holders writer schema, §4.4). */
export function simIdsForDomain(domain: Domain): readonly RefSimId[] {
  return SCIENCE_DOMAINS.has(domain) ? REF_SIM_IDS : [];
}
/** Ghost ids a writer may pick for a domain. */
export function ghostIdsForDomain(domain: Domain): readonly string[] {
  return simIdsForDomain(domain).flatMap((s) => Object.keys(REF_SIM_GHOSTS[s]));
}
/** "matches" | "contradicts" for a ghost of a sim, or null when the ghost is not in that sim's registry. */
export function ghostTag(simId: RefSimId, ghostId: string): "matches" | "contradicts" | null {
  return REF_SIM_GHOSTS[simId][ghostId] ?? null;
}
