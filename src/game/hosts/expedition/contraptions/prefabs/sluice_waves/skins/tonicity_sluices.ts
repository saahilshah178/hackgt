/**
 * sluice_waves · skin tonicity_sluices (cell e5 Tonicity Sluices, e9 Return Sluice / Barge Lock; §4.3 slots label_lock,
 * lock_leaf, valve_wheel, basin, eddy, cell_rbc, cell_plant, cell_potato, cell_generic, cell_protoplast, barge, console).
 * The Label Lock in the flooded trench, the bronze valve wheel with one plaque per valve (HYPO / ISO / HYPER or
 * IN / OUT / NONE as DOM chips), the holding basins and the Eddy; e9 adds the barge in the low Barge Lock. Drawing and
 * playback live in shared.ts `createSluiceView`; this file picks the valve colours. Code-drawn stand-ins until KB4's
 * hero parts land.
 */
import type { SluiceWavesConfig } from "@/world/contraptions/sluice-waves.config";
import type { SluiceWavesPose } from "@/world/contraptions/sluice-waves.meta";
import type { SkinPrefab } from "../../../types";
import { createSluiceView, type SluiceSkinOptions } from "../shared";

const tonicitySluices: SluiceSkinOptions = {
  skinId: "tonicity_sluices",
  // valve tags / basin stripes: water blue, cream, salmon (then glycan blue for a fourth valve)
  valveColors: (c, n) => [c.water, c.stoneLit, c.salmon, c.glycan].slice(0, Math.max(2, n)),
};

export const skin: SkinPrefab<SluiceWavesConfig, SluiceWavesPose> = {
  skinId: "tonicity_sluices",
  create(scene, _phaser, props) {
    return createSluiceView(scene, props, tonicitySluices);
  },
};
export default skin;
