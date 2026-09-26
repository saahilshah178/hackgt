/**
 * console_slate prefab shared helpers (docs/design/20 §2.5.5, §7). Owned by H1 (L2) with the prefab core; skin files
 * import it read-only. The lectern-slate drawing: a lectern with a slate that mirrors the widget (brightness, a live
 * glow while a draft is shown, a Verify pulse, an aid lamp) and the gate behind it that lifts on success.
 */
import type Phaser from "phaser";
import type { ConsoleSlatePose } from "@/world/contraptions/console-slate.meta";
import type { FailurePlan, SuccessPlan } from "@/world/types";
import type { ContraptionState, PoseView, PrefabProps, XY } from "../../types";

export { stubBox, type StubBoxOptions } from "../_stub";

export const ARCHETYPE_ID = "console_slate";
/** Placeholder tint kept for the W0 labelled box export (other lanes' stubs still import STUB_COLOR). */
export const STUB_COLOR = 0x1f4b57;

const hex = (c: string | undefined, fb: number) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? parseInt(c.slice(1), 16) : fb);
const wait = (scene: Phaser.Scene, ms: number) => new Promise<void>((r) => scene.time.delayedCall(Math.max(0, ms), () => r()));

export interface SlateGeometry {
  gateW: number;
  gateH: number;
  slateW: number;
  slateH: number;
}
export const SLATE_GEOMETRY: SlateGeometry = { gateW: 260, gateH: 360, slateW: 200, slateH: 130 };

/**
 * Draws the lectern slate at the station anchor. Parts come from the skin's kit textures (`props.tex`) when present,
 * else flat shapes in the biome palette, so the station reads the same with or without art.
 */
export function drawLecternSlate(scene: Phaser.Scene, P: typeof Phaser, props: PrefabProps<unknown>, keys: { lectern: string; slate: string; gate: string }): PoseView<ConsoleSlatePose> {
  const { station, palette, fx, reducedMotion } = props;
  const G = SLATE_GEOMETRY;
  const root = scene.add.container(station.anchor.x, station.anchor.y);
  const consoleLocal: XY = { x: station.consoleX - station.anchor.x, y: props.groundY - station.anchor.y };
  const gold = hex(palette["gold.base"], 0xd9a441);
  const stone = hex(palette["stone.base"], 0xf2e3c6);
  const navy = hex(palette["inlay.navy"], 0x27466a);
  const cyan = hex(palette["glow.cyan"], 0x9fe6f2);

  // the gate behind (its bottom sits on the anchor line; it slides up when solved)
  const gateFrame = scene.add.rectangle(0, -G.gateH / 2, G.gateW + 40, G.gateH + 30, stone, 1).setStrokeStyle(6, gold, 1);
  const gateMask = scene.add.rectangle(0, -G.gateH / 2, G.gateW, G.gateH, 0x1b3150, 1);
  let gate: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  try {
    gate = scene.add.image(0, -G.gateH / 2, props.tex(keys.gate)).setDisplaySize(G.gateW - 12, G.gateH - 12);
  } catch {
    gate = scene.add.rectangle(0, -G.gateH / 2, G.gateW - 12, G.gateH - 12, navy, 1);
  }
  // the lectern and slate at the console
  let lectern: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  try {
    lectern = scene.add.image(consoleLocal.x, consoleLocal.y, props.tex(keys.lectern)).setOrigin(0.5, 1).setDisplaySize(90, 150);
  } catch {
    lectern = scene.add.rectangle(consoleLocal.x, consoleLocal.y - 75, 70, 150, stone, 1);
  }
  const slateAt: XY = { x: consoleLocal.x, y: consoleLocal.y - 150 - G.slateH / 2 };
  const slateBack = scene.add.rectangle(slateAt.x, slateAt.y, G.slateW + 14, G.slateH + 14, gold, 1);
  const slate = scene.add.rectangle(slateAt.x, slateAt.y, G.slateW, G.slateH, 0x0f2a33, 1);
  const glow = fx.glow(root, slateAt, 150, cyan, 0);
  const aidLamp = scene.add.circle(slateAt.x + G.slateW / 2 - 14, slateAt.y - G.slateH / 2 + 14, 8, 0xe2892c, 0);
  root.add([gateFrame, gateMask, gate, lectern, slateBack, slate, aidLamp]);
  root.bringToTop(glow);

  const anchors = { console: consoleLocal, slate: slateAt, gate: { x: 0, y: -G.gateH / 2 }, lectern: { x: consoleLocal.x, y: consoleLocal.y - 75 } };
  let last: ConsoleSlatePose | null = null;
  let state: ContraptionState = "dormant";
  const apply = (p: ConsoleSlatePose) => {
    last = p;
    const lit = Math.max(0, Math.min(1, p.slate));
    slate.setFillStyle(lit > 0.8 ? 0x265c6a : 0x0f2a33, 1).setAlpha(0.55 + 0.45 * lit);
    glow.setAlpha((p.mirrors ? 0.35 : 0) + 0.4 * p.pulse + (p.solved ? 0.5 : 0));
    aidLamp.setAlpha(p.aid);
    gate.y = -G.gateH / 2 - p.gate * (G.gateH + 10);
    gate.setAlpha(1 - 0.6 * p.gate);
  };
  const view: PoseView<ConsoleSlatePose> = {
    root,
    anchors,
    applyPose: apply,
    setState(s) {
      if (s === state) return;
      state = s;
      fx.dormancy(root, s === "dormant", reducedMotion ? 0 : 600);
      slateBack.setFillStyle(s === "solved" ? cyan : gold, 1);
    },
    async playSucceed(plan: SuccessPlan, pose: ConsoleSlatePose) {
      glow.setAlpha(1);
      if (!reducedMotion) fx.burst(root, slateAt, "motes");
      const up = { g: last?.gate ?? 0 };
      await new Promise<void>((resolve) =>
        scene.tweens.add({ targets: up, g: 1, delay: Math.min(600, plan.durationMs / 3), duration: reducedMotion ? 1 : Math.max(400, plan.durationMs - 700), ease: "Cubic.easeInOut", onUpdate: () => apply({ ...(last ?? pose), gate: up.g, slate: 1 }), onComplete: () => resolve() }),
      );
      apply(pose);
    },
    async playFail(plan: FailurePlan, pose: ConsoleSlatePose) {
      slate.setFillStyle(0x8a3b2e, 1);
      if (!reducedMotion) scene.tweens.add({ targets: gate, x: { from: -8, to: 8 }, duration: 70, yoyo: true, repeat: 3, onComplete: () => void (gate.x = 0) });
      await wait(scene, Math.min(1600, Math.max(400, plan.durationMs)));
      gate.x = 0;
      apply(last ?? pose);
    },
    destroy() {
      root.destroy(true);
    },
  };
  void P;
  return view;
}
