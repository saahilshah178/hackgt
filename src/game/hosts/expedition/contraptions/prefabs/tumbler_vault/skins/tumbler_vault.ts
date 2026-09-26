/**
 * tumbler_vault · skin tumbler_vault — W0 STUB (a labelled box). The owning lane (docs/design/20 §7.2: KC (L8)) draws the skin's
 * parts (§4.3 slots, `<ns>.part.tumbler_vault_<slot>`) and applies the archetype's Pose from `@/world/contraptions/tumbler-vault.meta`.
 */
import type { TumblerVaultConfig } from "@/world/contraptions/tumbler-vault.config";
import type { TumblerVaultPose } from "@/world/contraptions/tumbler-vault.meta";
import type { SkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SkinPrefab<TumblerVaultConfig, TumblerVaultPose> = {
  skinId: "tumbler_vault",
  create(scene, _phaser, props) {
    return stubBox<TumblerVaultPose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "tumbler_vault\ntumbler_vault",
      color: STUB_COLOR,
    });
  },
};
export default skin;
