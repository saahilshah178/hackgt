/**
 * music_box · skin astronomer_box — W0 STUB (a labelled box). SB (docs/design/20 §7.2) draws the real sandbox.
 */
import type { MusicBoxConfig } from "@/world/sandboxes/music-box.config";
import type { MusicBoxPose } from "@/world/sandboxes/music-box.meta";
import type { SandboxSkinPrefab } from "../../../types";
import { STUB_COLOR, stubBox } from "../shared";

export const skin: SandboxSkinPrefab<MusicBoxConfig, MusicBoxPose> = {
  skinId: "astronomer_box",
  create(scene, _phaser, props) {
    return stubBox<MusicBoxPose>(scene, {
      at: { x: props.sandbox.anchor.x, y: props.sandbox.anchor.y },
      console: { x: props.sandbox.consoleX, y: props.groundY },
      label: "music_box\nastronomer_box",
      color: STUB_COLOR,
    });
  },
};
export default skin;
