import { describe, expect, it } from "vitest";
import type { SimCtx } from "../types";
import { bilayerPolarity, bilayerProbe, ionDeltaG, ION_BOUNDARY_NM, type BilayerProbeState } from "./bilayer-probe";
import { ghostTag, REF_SIM_GHOSTS } from "./index";

const ctx = (probe: number | null): SimCtx => ({ draft: null, probe, t: 0, aidTier: 0 });
function run(probe: number, seconds: number, from?: BilayerProbeState): BilayerProbeState {
  let s = from ?? bilayerProbe.init(7, {}, null, ctx(0));
  const n = Math.round(seconds / bilayerProbe.fixedDt);
  for (let i = 0; i < n; i++) s = bilayerProbe.step(s, bilayerProbe.fixedDt, ctx(probe));
  return s;
}

describe("bilayer_probe sim", () => {
  it("is deterministic for a seed and a probe sequence", () => {
    const a = run(3, 1.5);
    const b = run(3, 1.5);
    expect(a).toEqual(b);
  });

  it("the tip eases to the probe depth and ΔG follows 40·(1 − P(d))", () => {
    const s = run(2.4, 2);
    expect(s.depth).toBeCloseTo(2.4, 3);
    expect(s.dG).toBeCloseTo(ionDeltaG(2.4), 6);
    expect(bilayerProbe.readout(s)).toMatchObject({ depth: s.depth, ionHeld: 1 });
    expect(ionDeltaG(2.5)).toBeGreaterThan(38);
    expect(ionDeltaG(0)).toBeLessThan(1);
    expect(bilayerPolarity(0)).toBeGreaterThan(0.99);
    expect(bilayerPolarity(2.5)).toBeLessThan(0.01);
  });

  it("the ion rides the tip in the heads and is held at the boundary past 0.9 nm", () => {
    const shallow = run(0.5, 2);
    expect(shallow.ionHeld).toBe(0);
    expect(shallow.ionDepth).toBeCloseTo(0.5, 2);
    const deep = run(3, 2, shallow);
    expect(deep.ionHeld).toBe(1);
    expect(deep.ionDepth).toBeLessThanOrEqual(ION_BOUNDARY_NM + 1e-9);
    expect(deep.bounces).toBe(1);
  });

  it("registers its three ghosts with honest tags", () => {
    expect(REF_SIM_GHOSTS.bilayer_probe).toEqual({ bilayer_outline: "matches", rigid_holed_slab: "contradicts", core_blocks_ion: "matches" });
    expect(ghostTag("bilayer_probe", "rigid_holed_slab")).toBe("contradicts");
    expect(ghostTag("bilayer_probe", "random_walk")).toBeNull();
  });

  it("steps within the frame budget (≤ 1.5 ms per 4 steps)", () => {
    let s = bilayerProbe.init(1, {}, null, ctx(0));
    const t0 = performance.now();
    for (let i = 0; i < 4000; i++) s = bilayerProbe.step(s, bilayerProbe.fixedDt, ctx(i % 50 / 10));
    expect((performance.now() - t0) / 1000).toBeLessThan(1.5);
  });
});
