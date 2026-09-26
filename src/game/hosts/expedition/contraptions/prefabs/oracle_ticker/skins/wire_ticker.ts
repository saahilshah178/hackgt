/**
 * oracle_ticker · skin wire_ticker — W0 STUB (a labelled box). The owning lane (docs/design/20 §7.2: KC (L8)) draws the skin's
 * parts (§4.3 slots, `<ns>.part.wire_ticker_<slot>`) and applies the archetype's Pose from `@/world/contraptions/oracle-ticker.meta`.
 */
import type { OracleTickerConfig } from "@/world/contraptions/oracle-ticker.config";
import type { OracleTickerPose } from "@/world/contraptions/oracle-ticker.meta";
import type { SkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SkinPrefab<OracleTickerConfig, OracleTickerPose> = {
  skinId: "wire_ticker",
  create(scene, _phaser, props) {
    return stubBox<OracleTickerPose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "oracle_ticker\nwire_ticker",
      color: STUB_COLOR,
    });
  },
};
export default skin;
