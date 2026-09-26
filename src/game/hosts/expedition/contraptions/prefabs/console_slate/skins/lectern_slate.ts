/**
 * console_slate · skin lectern_slate — W0 STUB (a labelled box). The owning lane (docs/design/20 §7.2: H1 (L2)) draws the skin's
 * parts (§4.3 slots, `<ns>.part.lectern_slate_<slot>`) and applies the archetype's Pose from `@/world/contraptions/console-slate.meta`.
 */
import type { ConsoleSlateConfig } from "@/world/contraptions/console-slate.config";
import type { ConsoleSlatePose } from "@/world/contraptions/console-slate.meta";
import type { SkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SkinPrefab<ConsoleSlateConfig, ConsoleSlatePose> = {
  skinId: "lectern_slate",
  create(scene, _phaser, props) {
    return stubBox<ConsoleSlatePose>(scene, {
      at: { x: props.station.anchor.x, y: props.station.anchor.y },
      console: { x: props.station.consoleX, y: props.groundY },
      label: "console_slate\nlectern_slate",
      color: STUB_COLOR,
    });
  },
};
export default skin;
