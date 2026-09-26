import { describe, expect, it } from "vitest";
import type { SimCtx } from "../types";
import { ghostTag, REF_SIM_GHOSTS } from "./index";
import { osmoticCell, osmoticVolume, V_MAX, V_MIN, waterFluxFor, type OsmoticCellState } from "./osmotic-cell";

const ctx = (probe: number | null): SimCtx => ({ draft: null, probe, t: 0, aidTier: 0 });
function run(probe: number, seconds: number): OsmoticCellState {
  let s = osmoticCell.init(1, { cIn: 2, b: 0.3 }, null, ctx(probe));
  for (let i = 0; i < Math.round(seconds / osmoticCell.fixedDt); i++) s = osmoticCell.step(s, osmoticCell.fixedDt, ctx(probe));
  return s;
}

describe("osmotic_cell sim", () => {
  it("V/V₀ = b + (1 − b)·C_in / max(s, 0.3), clamped to [0.55, 1.6]", () => {
    expect(osmoticVolume(2, 2, 0.3)).toBeCloseTo(1, 12);
    expect(osmoticVolume(4, 2, 0.3)).toBeCloseTo(0.3 + (0.7 * 2) / 4, 12);
    expect(osmoticVolume(6, 2, 0.3)).toBe(V_MIN); // 0.533 clamps to 0.55
    expect(osmoticVolume(10, 2, 0.3)).toBe(V_MIN);
    expect(osmoticVolume(0, 2, 0.3)).toBe(V_MAX);
    expect(osmoticVolume(0.1, 2, 0.3)).toBe(osmoticVolume(0.3, 2, 0.3));
  });

  it("the volume relaxes to V∞(s) within about a second (τ ≤ 0.4 s)", () => {
    const s = run(6, 2);
    expect(s.volume).toBeCloseTo(osmoticVolume(6, 2, 0.3), 2);
    const quick = run(6, 0.4);
    expect(Math.abs(quick.volume - osmoticVolume(6))).toBeLessThan(0.5 * Math.abs(1 - osmoticVolume(6)));
  });

  it("water leaves toward a saltier bath and enters from a fresher one; salt inside never changes", () => {
    const salty = run(6, 1);
    expect(salty.waterFlux).toBeCloseTo(waterFluxFor(6, 2), 12);
    expect(osmoticCell.readout(salty).waterSign).toBe(1);
    expect(salty.volume).toBeLessThan(1);
    const fresh = run(0.5, 1);
    expect(osmoticCell.readout(fresh).waterSign).toBe(-1);
    expect(fresh.volume).toBeGreaterThan(1);
    expect(salty.saltInside).toBe(2);
    expect(fresh.saltInside).toBe(2);
  });

  it("is deterministic", () => {
    expect(run(4.2, 1.3)).toEqual(run(4.2, 1.3));
  });

  it("registers its three ghosts with honest tags", () => {
    expect(REF_SIM_GHOSTS.osmotic_cell).toEqual({ water_out_arrows: "matches", salt_inflow: "contradicts", shrink_outline: "matches" });
    expect(ghostTag("osmotic_cell", "salt_inflow")).toBe("contradicts");
  });
});
