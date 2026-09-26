/**
 * oracle_ticker · skin wire_ticker — still the W0 labelled box (KC3 draws the §4.3 parts,
 * `<ns>.part.wire_ticker_<slot>`). KC1 adapts the real OracleTickerPose onto the stub: the box lights while a forecast
 * is set and the gate bar lifts as the barrier dissolves.
 */
import type { OracleTickerConfig } from "@/world/contraptions/oracle-ticker.config";
import type { OracleTickerPose } from "@/world/contraptions/oracle-ticker.meta";
import type { SkinPrefab } from "../../../types";
import type { StubPose } from "../../_stub";
import { STUB_COLOR, stubBox } from "../shared";

// TODO(w1): KC3 replaces the labelled box with the kiosk, teletype, selector knob, telegraph wire and walk lamps.
function toStub(p: OracleTickerPose): StubPose {
  return { lit: p.solved ? 1 : p.position === null ? 0.45 : 0.9, gate: 1 - p.barrier };
}

export const skin: SkinPrefab<OracleTickerConfig, OracleTickerPose> = {
  skinId: "wire_ticker",
  create(scene, _phaser, props) {
    const box = stubBox<StubPose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "oracle_ticker\nwire_ticker",
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
