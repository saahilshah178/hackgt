/**
 * tumbler_vault · skin tumbler_vault — still the W0 labelled box (KC3 draws the §4.3 parts,
 * `<ns>.part.tumbler_vault_<slot>`). KC1 adapts the real TumblerVaultPose onto the stub: the box brightens with the
 * player's strikes and the gate bar lifts as the door swings open.
 */
import type { TumblerVaultConfig } from "@/world/contraptions/tumbler-vault.config";
import type { TumblerVaultPose } from "@/world/contraptions/tumbler-vault.meta";
import type { SkinPrefab } from "../../../types";
import type { StubPose } from "../../_stub";
import { STUB_COLOR, stubBox } from "../shared";

// TODO(w1): KC3 replaces the labelled box with the vault door, tumblers, bolts, handwheel, grille and press organ.
function toStub(p: TumblerVaultPose): StubPose {
  const n = Math.max(1, p.tumblers.length);
  return { lit: p.solved ? 1 : 0.45 + 0.45 * (p.struckCount / n), gate: p.door };
}

export const skin: SkinPrefab<TumblerVaultConfig, TumblerVaultPose> = {
  skinId: "tumbler_vault",
  create(scene, _phaser, props) {
    const box = stubBox<StubPose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "tumbler_vault\ntumbler_vault",
      color: STUB_COLOR,
    });
    return {
      ...box,
      applyPose: (p) => box.applyPose(toStub(p)),
      playSucceed: (plan, p) => box.playSucceed(plan, toStub(p)),
      playFail: (plan, p) => box.playFail(plan, toStub(p)),
    };
  },
};
export default skin;
