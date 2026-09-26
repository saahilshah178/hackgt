/**
 * claim_holders · skin specimen_pods — W0 STUB (a labelled box). The owning lane (docs/design/20 §7.2: KA (L6); skins: KA trig, KB specimen_pods, KC witness_projector) draws the skin's
 * parts (§4.3 slots, `<ns>.part.specimen_pods_<slot>`) and applies the archetype's Pose from `@/world/contraptions/claim-holders.meta`.
 */
import type { ClaimHoldersConfig } from "@/world/contraptions/claim-holders.config";
import type { ClaimHoldersPose } from "@/world/contraptions/claim-holders.meta";
import type { SkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SkinPrefab<ClaimHoldersConfig, ClaimHoldersPose> = {
  skinId: "specimen_pods",
  create(scene, _phaser, props) {
    return stubBox<ClaimHoldersPose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "claim_holders\nspecimen_pods",
      color: STUB_COLOR,
    });
  },
};
export default skin;
