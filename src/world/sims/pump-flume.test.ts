import { describe, expect, it } from "vitest";
import type { SimCtx } from "../types";
import { ghostTag, REF_SIM_GHOSTS } from "./index";
import { pumpFlume, steadyGap, steadyTanks, strokeHz, type PumpFlumeState } from "./pump-flume";

const ctx = (probe: number | null): SimCtx => ({ draft: null, probe, t: 0, aidTier: 0 });
function run(probe: number, seconds: number, from?: PumpFlumeState): PumpFlumeState {
  let s = from ?? pumpFlume.init(1, {}, null, ctx(0));
  for (let i = 0; i < Math.round(seconds / pumpFlume.fixedDt); i++) s = pumpFlume.step(s, pumpFlume.fixedDt, ctx(probe));
  return s;
}

describe("pump_flume sim", () => {
  it("steady state ΔC = 0.96·r (clamped to 9.6) around the mean", () => {
    for (const r of [0, 1, 2.5, 5, 7]) {
      const s = run(r, 12);
      expect(s.cHigh - s.cLow).toBeCloseTo(0.96 * r, 3);
      expect((s.cHigh + s.cLow) / 2).toBeCloseTo(5, 6);
    }
    expect(steadyGap(20)).toBe(9.6);
    expect(steadyTanks(5)).toEqual({ cHigh: 5 + 2.4, cLow: 5 - 2.4 });
  });

  it("relaxes with τ = 1.2 s: 63 % of the way after one τ", () => {
    const s = run(5, 1.2);
    expect((s.cHigh - s.cLow) / steadyGap(5)).toBeCloseTo(1 - Math.exp(-1), 2);
  });

  it("at r = 0 the gap collapses (the Stillness)", () => {
    const pumped = run(8, 10);
    const still = run(0, 10, pumped);
    expect(still.cHigh - still.cLow).toBeLessThan(0.02);
  });

  it("the stroke phase advances at 0.4·r Hz and counts sparks", () => {
    const s = run(5, 10);
    expect(strokeHz(5)).toBe(2);
    expect(s.strokes).toBeGreaterThanOrEqual(19);
    expect(s.strokes).toBeLessThanOrEqual(20);
    expect(s.stroke).toBeGreaterThanOrEqual(0);
    expect(s.stroke).toBeLessThan(1);
    expect(run(0, 5).strokes).toBe(0);
  });

  it("is deterministic", () => {
    expect(run(3.5, 2)).toEqual(run(3.5, 2));
  });

  it("registers its three ghosts with honest tags", () => {
    expect(REF_SIM_GHOSTS.pump_flume).toEqual({ uphill_arrow: "matches", atp_sparks: "matches", downhill_boost: "contradicts" });
    expect(ghostTag("pump_flume", "downhill_boost")).toBe("contradicts");
  });
});
