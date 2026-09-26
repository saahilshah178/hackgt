/**
 * osmotic-cell — reference sim STUB (W0). KB1 implements the physics (docs/design/20 §4.2 sims table, §7.4 sims row):
 * measurable state = V/V0 and the water flux sign. Seeded, fixed-step, pure. Keep the exported names and the SimSpec shape.
 */
import type { SimCtx, SimParams, SimSpec } from "../types";

export interface OsmoticCellState {
  t: number;
  volume: number; waterFlux: number;
}

export const osmoticCell: SimSpec<SimParams, OsmoticCellState> = {
  init: (): OsmoticCellState => ({ t: 0, volume: 1, waterFlux: 0 }),
  step: (s: OsmoticCellState, dt: number, ctx: SimCtx): OsmoticCellState => {
    void ctx;
    return { ...s, t: s.t + dt, volume: s.volume };
  },
  fixedDt: 1 / 30,
  resetOn: ["open", "probe_change"],
  readout: (s: OsmoticCellState) => ({ volume: s.volume, waterFlux: s.waterFlux }),
};
