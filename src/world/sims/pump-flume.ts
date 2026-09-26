/**
 * pump-flume — reference sim STUB (W0). KB1 implements the physics (docs/design/20 §4.2 sims table, §7.4 sims row):
 * measurable state = cHigh, cLow, stroke phase. Seeded, fixed-step, pure. Keep the exported names and the SimSpec shape.
 */
import type { SimCtx, SimParams, SimSpec } from "../types";

export interface PumpFlumeState {
  t: number;
  cHigh: number; cLow: number; stroke: number;
}

export const pumpFlume: SimSpec<SimParams, PumpFlumeState> = {
  init: (): PumpFlumeState => ({ t: 0, cHigh: 0, cLow: 0, stroke: 0 }),
  step: (s: PumpFlumeState, dt: number, ctx: SimCtx): PumpFlumeState => {
    void ctx;
    return { ...s, t: s.t + dt, stroke: (s.stroke + dt) % 1 };
  },
  fixedDt: 1 / 30,
  resetOn: ["open", "probe_change"],
  readout: (s: PumpFlumeState) => ({ cHigh: s.cHigh, cLow: s.cLow, stroke: s.stroke }),
};
