/**
 * ring_gate · skin ring_gate — W0 STUB (a labelled box). The owning lane (docs/design/20 §7.2: KA (L6)) draws the skin's
 * parts (§4.3 slots, `<ns>.part.ring_gate_<slot>`) and applies the archetype's Pose from `@/world/contraptions/ring-gate.meta`.
 */
import type { RingGateConfig } from "@/world/contraptions/ring-gate.config";
import type { RingGatePose } from "@/world/contraptions/ring-gate.meta";
import type { SkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SkinPrefab<RingGateConfig, RingGatePose> = {
  skinId: "ring_gate",
  create(scene, _phaser, props) {
    return stubBox<RingGatePose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "ring_gate\nring_gate",
      color: STUB_COLOR,
    });
  },
};
export default skin;
