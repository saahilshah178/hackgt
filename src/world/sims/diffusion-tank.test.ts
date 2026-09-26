import { describe, expect, it } from "vitest";
import type { SimCtx } from "../types";
import { diffusionTank, particlesFor, predictedFlux, TANK_H, TANK_W, TRACER_POINTS, type DiffusionTankState } from "./diffusion-tank";
import { ghostTag, REF_SIM_GHOSTS } from "./index";

const ctx = (probe: number | null): SimCtx => ({ draft: null, probe, t: 0, aidTier: 0 });
function run(seed: number, probe: number, seconds: number): DiffusionTankState[] {
  let s = diffusionTank.init(seed, { p: 0.3, sigma: 5 }, null, ctx(probe));
  const out = [s];
  const n = Math.round(seconds / diffusionTank.fixedDt);
  for (let i = 0; i < n; i++) {
    s = diffusionTank.step(s, diffusionTank.fixedDt, ctx(probe));
    out.push(s);
  }
  return out;
}

describe("diffusion_tank sim", () => {
  it("is deterministic per seed (tracer included) and differs across seeds", () => {
    const a = run(42, 5, 3).at(-1)!;
    const b = run(42, 5, 3).at(-1)!;
    const c = run(43, 5, 3).at(-1)!;
    expect(a).toEqual(b);
    expect(a.tracer).not.toEqual(c.tracer);
  });

  it("loads N = round(10a) particles into the left chamber", () => {
    const s0 = diffusionTank.init(1, {}, null, ctx(5));
    expect(s0.cL).toBe(particlesFor(5) / 10);
    expect(s0.cR).toBe(0);
    expect(particlesFor(20)).toBe(100);
  });

  it("cL and cR converge monotonically and J has the sign of cL − cR", () => {
    const states = run(9, 5, 80);
    for (let i = 1; i < states.length; i++) {
      const prev = states[i - 1]!;
      const s = states[i]!;
      expect(Math.abs(s.cL - s.cR)).toBeLessThanOrEqual(Math.abs(prev.cL - prev.cR) + 1e-12);
      if (s.cL - s.cR > 1e-6) expect(s.flux).toBeGreaterThan(0);
      expect(s.cL + s.cR).toBeCloseTo(5, 9); // particles are conserved
    }
    const last = states.at(-1)!;
    expect(Math.abs(last.cL - last.cR)).toBeLessThan(0.1);
    // the measured flux over the 2 s window agrees with J₀ = 0.35·ΔC at the start
    expect(states[60]!.flux).toBeCloseTo(predictedFlux(states[30]!.cL, states[30]!.cR), 0);
  });

  it("the flux reverses sign when the right chamber is the crowded one", () => {
    const s0 = { ...diffusionTank.init(3, {}, null, ctx(4)), cL: 0.5, cR: 3.5 };
    let s = s0;
    for (let i = 0; i < 30; i++) s = diffusionTank.step(s, diffusionTank.fixedDt, ctx(4));
    expect(s.flux).toBeLessThan(0);
  });

  it("a probe change reloads the left chamber", () => {
    const states = run(5, 5, 5);
    const reloaded = diffusionTank.step(states.at(-1)!, diffusionTank.fixedDt, ctx(8));
    expect(reloaded.load).toBe(8);
    expect(reloaded.cL + reloaded.cR).toBeCloseTo(8, 6);
    expect(reloaded.t).toBeLessThan(0.1);
  });

  it("keeps a 60-point tracer inside the tank", () => {
    const last = run(11, 5, 6).at(-1)!;
    expect(last.tracer).toHaveLength(TRACER_POINTS);
    for (const [x, y] of last.tracer) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(TANK_W);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(TANK_H);
    }
  });

  it("registers its three ghosts with honest tags", () => {
    expect(REF_SIM_GHOSTS.diffusion_tank).toEqual({ random_walk: "matches", purposeful_march: "contradicts", net_flux_arrow: "matches" });
    expect(ghostTag("diffusion_tank", "purposeful_march")).toBe("contradicts");
  });

  it("steps within the frame budget", () => {
    let s = diffusionTank.init(1, {}, null, ctx(5));
    const t0 = performance.now();
    for (let i = 0; i < 4000; i++) s = diffusionTank.step(s, diffusionTank.fixedDt, ctx(5));
    expect((performance.now() - t0) / 1000).toBeLessThan(1.5);
  });
});
