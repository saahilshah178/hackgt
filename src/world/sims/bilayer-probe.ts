/**
 * bilayer-probe — reference sim STUB (W0). KB1 implements the physics (docs/design/20 §4.2 sims table, §7.4 sims row):
 * measurable state = tip depth, ion held (0/1), ΔG. Seeded, fixed-step, pure. Keep the exported names and the SimSpec shape.
 */
import type { SimCtx, SimParams, SimSpec } from "../types";

export interface BilayerProbeState {
  t: number;
  depth: number; ionHeld: number; dG: number;
}

export const bilayerProbe: SimSpec<SimParams, BilayerProbeState> = {
  init: (): BilayerProbeState => ({ t: 0, depth: 0, ionHeld: 0, dG: 0 }),
  step: (s: BilayerProbeState, dt: number, ctx: SimCtx): BilayerProbeState => {
    void ctx;
    return { ...s, t: s.t + dt, depth: ctx.probe ?? s.depth };
  },
  fixedDt: 1 / 30,
  resetOn: ["open", "probe_change"],
  readout: (s: BilayerProbeState) => ({ depth: s.depth, ionHeld: s.ionHeld, dG: s.dG }),
};
