/**
 * The W0 stub drawing shared by every prefab until its K/S lane replaces it: a labelled box (the "slate") with a
 * gate bar behind it, driven by the placeholder SlatePose / SandboxSlatePose. Dev-only placeholder art: the label
 * is Phaser text, which real prefabs must not use (world text goes through WorldLabelLayer, §5.3).
 */
import type Phaser from "phaser";
import type { FailurePlan, SuccessPlan } from "@/world/types";
import type { ContraptionState, PoseView, XY } from "../types";

export interface StubBoxOptions {
  /** container origin in zone units (station.anchor / sandbox.anchor) */
  at: XY;
  /** console position in zone units */
  console: XY;
  label: string;
  color?: number;
  width?: number;
  height?: number;
}

/** Minimal pose the stub reads: SlatePose and SandboxSlatePose both satisfy it. */
export interface StubPose {
  slate?: number;
  lit?: number;
  gate?: number;
}

const STATE_TINT: Readonly<Record<ContraptionState, number>> = {
  dormant: 0x6e7f9a,
  awake: 0x8fe0ea,
  active: 0xf2a65a,
  solved: 0x7fd18b,
};

function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => {
    scene.time.delayedCall(Math.max(0, ms), () => resolve());
  });
}

export function stubBox<Pose extends StubPose>(scene: Phaser.Scene, opts: StubBoxOptions): PoseView<Pose> {
  const w = opts.width ?? 220;
  const h = opts.height ?? 260;
  const color = opts.color ?? 0x265c6a;
  const root = scene.add.container(opts.at.x, opts.at.y);
  const gate = scene.add.rectangle(0, -h / 2, w + 60, 24, 0x2b3a44, 1);
  const box = scene.add.rectangle(0, -h / 2, w, h, color, 0.85);
  box.setStrokeStyle(4, STATE_TINT.dormant, 1);
  const label = scene.add.text(0, -h / 2, opts.label, { fontFamily: "sans-serif", fontSize: "22px", color: "#ffffff", align: "center" });
  label.setOrigin(0.5, 0.5);
  root.add([gate, box, label]);
  const consoleLocal = { x: opts.console.x - opts.at.x, y: opts.console.y - opts.at.y };
  let lastPose: Pose | null = null;

  const view: PoseView<Pose> = {
    root,
    anchors: { console: consoleLocal, slate: { x: 0, y: -h / 2 }, gate: { x: 0, y: -h / 2 } },
    applyPose(pose: Pose) {
      lastPose = pose;
      const lit = pose.slate ?? pose.lit ?? 0.5;
      box.setAlpha(0.45 + 0.55 * Math.min(1, Math.max(0, lit)));
      gate.y = -h / 2 - (pose.gate ?? 0) * (h / 2 + 40);
    },
    setState(state: ContraptionState) {
      box.setStrokeStyle(4, STATE_TINT[state], 1);
    },
    async playSucceed(plan: SuccessPlan, pose: Pose) {
      box.setStrokeStyle(6, STATE_TINT.solved, 1);
      await wait(scene, plan.durationMs);
      view.applyPose(pose);
    },
    async playFail(plan: FailurePlan, pose: Pose) {
      box.setStrokeStyle(6, 0xe07a5f, 1);
      await wait(scene, Math.min(plan.durationMs, 1600));
      box.setStrokeStyle(4, STATE_TINT.active, 1);
      view.applyPose(lastPose ?? pose);
    },
    destroy() {
      root.destroy(true);
    },
  };
  return view;
}
