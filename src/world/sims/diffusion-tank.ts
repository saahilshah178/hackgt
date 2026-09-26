/**
 * diffusion-tank — reference sim STUB (W0). KB1 implements the physics (docs/design/20 §4.2 sims table, §7.4 sims row):
 * measurable state = cL, cR, flux J (2 s window), tracer path (60 points). Seeded, fixed-step, pure. Keep the exported names and the SimSpec shape.
 */
import type { SimCtx, SimParams, SimSpec } from "../types";

export interface DiffusionTankState {
  t: number;
  cL: number; cR: number; flux: number; tracer: readonly (readonly [number, number])[];
}

export const diffusionTank: SimSpec<SimParams, DiffusionTankState> = {
  init: (): DiffusionTankState => ({ t: 0, cL: 0, cR: 0, flux: 0, tracer: [] }),
  step: (s: DiffusionTankState, dt: number, ctx: SimCtx): DiffusionTankState => {
    void ctx;
    return { ...s, t: s.t + dt, cL: ctx.probe ?? s.cL };
  },
  fixedDt: 1 / 30,
  resetOn: ["open", "probe_change"],
  readout: (s: DiffusionTankState) => ({ cL: s.cL, cR: s.cR, flux: s.flux }),
};
