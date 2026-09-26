/**
 * console_slate · skin lectern_slate (H1): the lectern slate that mirrors the widget, and the gate that lifts
 * (docs/design/20 §4 row 13). Parts are the shared kit keys `shared.part.lectern_slate_<slot>`.
 */
import type { ConsoleSlateConfig } from "@/world/contraptions/console-slate.config";
import type { ConsoleSlatePose } from "@/world/contraptions/console-slate.meta";
import type { SkinPrefab } from "../../../types";
import { drawLecternSlate } from "../shared";

export const skin: SkinPrefab<ConsoleSlateConfig, ConsoleSlatePose> = {
  skinId: "lectern_slate",
  create(scene, phaser, props) {
    return drawLecternSlate(scene, phaser, props, {
      lectern: "shared.part.lectern_slate_lectern",
      slate: "shared.part.lectern_slate_slate",
      gate: "shared.part.lectern_slate_gate",
    });
  },
};
export default skin;
