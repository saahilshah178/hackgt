/**
 * cause_tubes · skin big_board (civil e11, the gallery's Big Board; §4.3 slots board_wall, canister, launcher, console;
 * tubes are code-drawn). A 1100 × 520 brass wall (amendment 32) holds pneumatic canisters in a loose ring by DISPLAY
 * order; each draft edge grows an 18 px brass tube with glass windows along a Manhattan route (≤ 2 bends) at 900 px/s;
 * a canister with an outgoing tube opens its glass lid 30° (ready, not correct). Success: a capsule shoots through the
 * tubes in causal order, each canister lamp lights as it passes, the launcher cycles. Failure: a decoy's capsule pops
 * out of its lid; a wrong link jams the capsule at its `from` canister (a puff, the glass fogs). Stand-ins until KC4.
 */
import type Phaser from "phaser";
import type { CauseTubesConfig } from "@/world/contraptions/cause-tubes.config";
import { BOARD_HEIGHT, HOUSING, type CauseTubesPose, type TubeHousing } from "@/world/contraptions/cause-tubes.meta";
import type { SkinPrefab } from "../../../types";
import { createTubesView, drawFocus, drawLamp, type DynamicFx, type HousingFx, type TubesSkin, type TubesSkinCtx } from "../shared";

const CAN = HOUSING.ring;
const CAN_W = 70;
const CAN_H = 120;

const bigBoard: TubesSkin = {
  skinId: "big_board",
  anchorPrefix: "canister",
  arrows: false,
  grows: true,
  capsule: true,
  build(ctx: TubesSkinCtx, g: Phaser.GameObjects.Graphics) {
    const c = ctx.colors;
    const W = ctx.W;
    // the wall: a brass frame around cork frames (canisters hang as isolated pins until tubes connect them)
    g.fillStyle(c.brassDeep, 1);
    g.fillRoundedRect(-W / 2, -BOARD_HEIGHT, W, BOARD_HEIGHT, 16);
    g.fillStyle(c.wall, 1);
    g.fillRect(-W / 2 + 18, -BOARD_HEIGHT + 18, W - 36, BOARD_HEIGHT - 36);
    g.lineStyle(2, c.brassDeep, 0.5);
    for (let x = -W / 2 + 18 + 120; x < W / 2 - 18; x += 120) {
      g.beginPath();
      g.moveTo(x, -BOARD_HEIGHT + 18);
      g.lineTo(x, -18);
      g.strokePath();
    }
    // the capsule launcher at the lower left
    const launcher = { x: -W / 2 + 90, y: -70 };
    g.fillStyle(c.steelShade, 1);
    g.fillRoundedRect(launcher.x - 55, launcher.y - 40, 110, 80, 12);
    g.fillStyle(c.brass, 1);
    g.fillCircle(launcher.x + 30, launcher.y, 18);
    g.fillStyle(c.ink, 1);
    g.fillCircle(launcher.x + 30, launcher.y, 10);
    return { launcher, gauge: launcher, payoff: launcher };
  },
  drawHousing(g: Phaser.GameObjects.Graphics, h: TubeHousing, fx: HousingFx, ctx: TubesSkinCtx) {
    const c = ctx.colors;
    const pop = fx.eject > 0 ? Math.sin((fx.eject / 900) * Math.PI) : 0;
    // mount plate
    g.fillStyle(c.brassDeep, fx.dim);
    g.fillRoundedRect(h.x - CAN.w / 2, h.y - CAN.h / 2, CAN.w, CAN.h, 12);
    // the glass canister with brass caps
    g.fillStyle(c.glass, 0.45 * fx.dim);
    g.fillRoundedRect(h.x - CAN_W / 2, h.y - CAN_H / 2, CAN_W, CAN_H, 18);
    g.fillStyle(c.brass, fx.dim);
    g.fillRect(h.x - CAN_W / 2 - 4, h.y + CAN_H / 2 - 16, CAN_W + 8, 16);
    // the lid: rotates open 30° with an outgoing tube (h.lidDeg eased by the controller)
    const lid = (h.lidDeg * Math.PI) / 180;
    const hinge = { x: h.x - CAN_W / 2 - 4, y: h.y - CAN_H / 2 };
    g.lineStyle(12, c.brass, fx.dim);
    g.beginPath();
    g.moveTo(hinge.x, hinge.y);
    g.lineTo(hinge.x + Math.cos(-lid) * (CAN_W + 8), hinge.y + Math.sin(-lid) * (CAN_W + 8));
    g.strokePath();
    // the capsule inside (pops out of the lid on a decoy)
    g.fillStyle(c.brassHi, fx.dim);
    g.fillRoundedRect(h.x - 14, h.y - 30 - pop * 110, 28, 60, 12);
    // fogged glass (a jam)
    if (fx.fog > 0) {
      g.fillStyle(0xffffff, 0.55 * fx.fog);
      g.fillRoundedRect(h.x - CAN_W / 2, h.y - CAN_H / 2, CAN_W, CAN_H, 18);
    }
    drawLamp(g, { x: h.x + CAN.w / 2 - 4, y: h.y - CAN.h / 2 + 4 }, 9, h.lamp, fx, c, ctx.scene.time.now);
    if (h.focus) drawFocus(g, { x: h.x, y: h.y }, CAN.w, CAN.h, c);
  },
  drawDynamic(g: Phaser.GameObjects.Graphics, pose: CauseTubesPose, dyn: DynamicFx, ctx: TubesSkinCtx, anchors) {
    const c = ctx.colors;
    const launcher = anchors.launcher;
    // completion only: a pressure dial on the launcher (the counter text is a DOM chip at `gauge`)
    if (pose.showGauge) {
      const shiver = dyn.shiver > 0 ? Math.sin(dyn.now / 25) * 0.1 : 0;
      const a = Math.PI * (0.75 + 1.5 * pose.gauge) + shiver;
      const at = { x: launcher.x - 22, y: launcher.y };
      g.fillStyle(c.paper, 1);
      g.fillCircle(at.x, at.y, 24);
      g.lineStyle(4, c.ink, 1);
      g.beginPath();
      g.moveTo(at.x, at.y);
      g.lineTo(at.x + Math.cos(a) * 20, at.y + Math.sin(a) * 20);
      g.strokePath();
    }
    // the launcher cycles on success
    const cyc = Math.max(pose.gate, dyn.payoff ?? 0);
    if (cyc > 0) {
      g.lineStyle(6, c.cyan, 0.8 * cyc);
      g.beginPath();
      g.arc(launcher.x + 30, launcher.y, 26, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * cyc, false);
      g.strokePath();
    }
  },
  wireShape(w) {
    const r = w.route ?? { first: "h" as const, mid: 0.5 };
    return { kind: "manhattan", first: r.first, mid: r.mid, bends: 2, radius: 18 };
  },
  wireStyle(ctx, lit) {
    const c = ctx.colors;
    // an 18 px brass tube; the lighter core reads as its glass windows
    return {
      color: lit ? c.cyanHi : c.glass,
      width: 8,
      alpha: 1,
      outline: { color: c.brass, width: 18, alpha: 1 },
      glow: lit ? { color: c.cyan, width: 26, alpha: 0.3 } : null,
      plug: { radius: 11, color: c.brass, rim: c.brassDeep },
      dash: lit ? null : [18, 42],
    };
  },
};

export const skin: SkinPrefab<CauseTubesConfig, CauseTubesPose> = {
  skinId: "big_board",
  create(scene, _phaser, props) {
    return createTubesView(scene, props, bigBoard);
  },
};
export default skin;
