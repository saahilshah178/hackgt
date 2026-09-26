/**
 * sluice_waves · skin tonicity_sluices — W0 STUB (a labelled box). The owning lane (docs/design/20 §7.2: KB (L7)) draws the skin's
 * parts (§4.3 slots, `<ns>.part.tonicity_sluices_<slot>`) and applies the archetype's Pose from `@/world/contraptions/sluice-waves.meta`.
 */
import type { SluiceWavesConfig } from "@/world/contraptions/sluice-waves.config";
import type { SluiceWavesPose } from "@/world/contraptions/sluice-waves.meta";
import type { SkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SkinPrefab<SluiceWavesConfig, SluiceWavesPose> = {
  skinId: "tonicity_sluices",
  create(scene, _phaser, props) {
    return stubBox<SluiceWavesPose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "sluice_waves\ntonicity_sluices",
      color: STUB_COLOR,
    });
  },
};
export default skin;
