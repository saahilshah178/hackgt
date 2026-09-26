/**
 * cause_tubes · skin relay_line (civil e5, the coach terminal; §4.3 slots junction_box, departures_board, divider_rail,
 * rolling_gate, console). Brass junction boxes hang from the canopy rail in DISPLAY order; each draft edge strings a
 * cream catenary wire (sag = 0.12·|Δx| + 24, overshooting 15 % as it settles) with arrow ticks every 80 px; a box with an
 * outgoing wire shows its output lamp amber-ready (not correctness); the LINE CHARGE gauge needle reads edges / edgeCount.
 * Success: a cyan current runs the chain in causal order, the departures board flips, the divider rail lifts away and
 * the rolling gate rises. Failure: a decoy's fuse pops and its card flutters half out; a wrong link's box sparks, its
 * lamp flickers amber and its outgoing wire goes slack. Code-drawn stand-ins until KC4's hero parts land.
 */
import type Phaser from "phaser";
import type { CauseTubesConfig } from "@/world/contraptions/cause-tubes.config";
import { HOUSING, type CauseTubesPose, type TubeHousing } from "@/world/contraptions/cause-tubes.meta";
import type { SkinPrefab } from "../../../types";
import { createTubesView, drawFocus, drawLamp, type DynamicFx, type HousingFx, type TubesSkin, type TubesSkinCtx } from "../shared";
import { sagSpring } from "../motion";

const BOX = HOUSING.canopy_row;
const BOARD = { w: 560, h: 150, y: -250 };

const relayLine: TubesSkin = {
  skinId: "relay_line",
  anchorPrefix: "box",
  arrows: true,
  grows: false,
  capsule: false,
  build(ctx: TubesSkinCtx, g: Phaser.GameObjects.Graphics) {
    const c = ctx.colors;
    const half = ctx.W / 2 + 60;
    // the canopy rail the boxes hang from (riveted brass)
    g.fillStyle(c.brassDeep, 1);
    g.fillRect(-half, -10, 2 * half, 20);
    g.fillStyle(c.brass, 1);
    g.fillRect(-half, -10, 2 * half, 12);
    g.fillStyle(c.brassHi, 1);
    for (let x = -half + 20; x < half; x += 60) g.fillCircle(x, -4, 3);
    // the split-flap departures board (characters are DOM)
    g.fillStyle(c.brassDeep, 1);
    g.fillRoundedRect(-BOARD.w / 2 - 12, BOARD.y - BOARD.h / 2 - 12, BOARD.w + 24, BOARD.h + 24, 10);
    g.fillStyle(c.ink, 1);
    g.fillRect(-BOARD.w / 2, BOARD.y - BOARD.h / 2, BOARD.w, BOARD.h);
    // the LINE CHARGE gauge housing (right of the board)
    const gauge = { x: ctx.W / 2 + 110, y: -150 };
    g.fillStyle(c.brassDeep, 1);
    g.fillCircle(gauge.x, gauge.y, 70);
    g.fillStyle(c.paper, 1);
    g.fillCircle(gauge.x, gauge.y, 60);
    g.lineStyle(3, c.ink, 0.6);
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (0.75 + (1.5 * i) / 8);
      g.beginPath();
      g.moveTo(gauge.x + Math.cos(a) * 46, gauge.y + Math.sin(a) * 46);
      g.lineTo(gauge.x + Math.cos(a) * 56, gauge.y + Math.sin(a) * 56);
      g.strokePath();
    }
    const gateX = ctx.blockerLocal ?? ctx.W / 2 + 280;
    const railY = ctx.groundLocal - 90;
    return {
      board: { x: 0, y: BOARD.y },
      gauge,
      gate: { x: gateX, y: ctx.groundLocal - 140 },
      payoff: { x: gateX, y: ctx.groundLocal - 140 },
      rail: { x: 0, y: railY },
    };
  },
  drawHousing(g: Phaser.GameObjects.Graphics, h: TubeHousing, fx: HousingFx, ctx: TubesSkinCtx) {
    const c = ctx.colors;
    const now = ctx.scene.time.now;
    const top = h.y - BOX.h / 2;
    g.fillStyle(c.brassDeep, fx.dim);
    g.fillRect(h.x - 4, 0, 8, top); // the hanger
    g.fillStyle(c.brassDeep, fx.dim);
    g.fillRoundedRect(h.x - BOX.w / 2, top, BOX.w, BOX.h, 12);
    g.fillStyle(c.brass, fx.dim);
    g.fillRoundedRect(h.x - BOX.w / 2 + 6, top + 6, BOX.w - 12, BOX.h - 12, 9);
    // the typed card behind glass (the caption itself is a DOM chip at node_<key>)
    const flutter = fx.eject > 0 ? Math.sin((fx.eject / 900) * Math.PI) : 0;
    g.fillStyle(c.paper, fx.dim);
    g.fillRect(h.x - BOX.w / 2 + 18 + flutter * 40, top + 42 - flutter * 30, BOX.w - 36, 96);
    g.fillStyle(c.glass, 0.25 * fx.dim);
    g.fillRect(h.x - BOX.w / 2 + 14, top + 38, BOX.w - 28, 104);
    // the output lamp on top
    drawLamp(g, { x: h.x + BOX.w / 2 - 26, y: top + 20 }, 10, h.lamp, fx, c, now);
    // the port the wires leave from
    g.fillStyle(c.ink, fx.dim);
    g.fillCircle(h.port.x, h.port.y, 7);
    if (h.focus) drawFocus(g, { x: h.x, y: h.y }, BOX.w, BOX.h, c);
  },
  drawDynamic(g: Phaser.GameObjects.Graphics, pose: CauseTubesPose, dyn: DynamicFx, ctx: TubesSkinCtx, anchors) {
    const c = ctx.colors;
    // departures board: flip cells (a cascade on success)
    const flip = dyn.board ?? (pose.solved ? 1 : 0);
    const cols = 14;
    const rows = 3;
    const cw = (BOARD.w - 20) / cols;
    const ch = (BOARD.h - 20) / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const lit = flip >= (col + r * cols) / (cols * rows);
        g.fillStyle(lit ? c.cyan : c.steelShade, lit ? 0.85 : 0.6);
        g.fillRect(-BOARD.w / 2 + 10 + col * cw + 2, BOARD.y - BOARD.h / 2 + 10 + r * ch + 2, cw - 4, ch - 4);
      }
    }
    // the LINE CHARGE needle: edges / edgeCount (completion only), with a shiver on a stall
    if (pose.showGauge) {
      const gauge = anchors.gauge;
      const shiver = dyn.shiver > 0 ? Math.sin(dyn.now / 25) * 0.08 : 0;
      const a = Math.PI * (0.75 + 1.5 * pose.gauge) + shiver;
      g.lineStyle(5, c.ink, 1);
      g.beginPath();
      g.moveTo(gauge.x, gauge.y);
      g.lineTo(gauge.x + Math.cos(a) * 50, gauge.y + Math.sin(a) * 50);
      g.strokePath();
      g.fillStyle(c.brassDeep, 1);
      g.fillCircle(gauge.x, gauge.y, 8);
    }
    // the brass divider rail between the waiting rooms: lifts into the ceiling on success
    const rail = anchors.rail;
    const lift = (dyn.rail ?? (pose.solved ? 1 : 0)) * 420;
    g.fillStyle(c.brass, 1 - (dyn.rail ?? (pose.solved ? 1 : 0)) * 0.6);
    g.fillRect(rail.x - 300, rail.y - lift, 600, 12);
    for (let x = -280; x <= 280; x += 80) g.fillRect(rail.x + x - 3, rail.y - lift, 6, 90);
    // the rolling gate: slats rise with pose.gate / the payoff animation
    const gate = anchors.gate;
    const open = Math.max(pose.gate, dyn.payoff ?? 0);
    const gh = 280;
    const visible = gh * (1 - open);
    g.fillStyle(c.steelShade, 1);
    g.fillRect(gate.x - 90, gate.y - gh / 2 - 16, 180, 16); // the housing drum
    g.fillStyle(c.steel, 0.95);
    for (let y = 0; y < visible; y += 22) g.fillRect(gate.x - 80, gate.y - gh / 2 + y, 160, Math.min(18, visible - y));
  },
  wireShape(w, ageMs, reducedMotion) {
    return { kind: "sag", sag: w.sag * sagSpring(ageMs, reducedMotion), segments: 20 };
  },
  wireStyle(ctx, lit) {
    const c = ctx.colors;
    return lit
      ? { color: c.cyanHi, width: 5, glow: { color: c.cyan, width: 14, alpha: 0.35 }, outline: { color: c.ink, width: 8, alpha: 0.5 }, plug: { radius: 6, color: c.brass, rim: c.brassDeep } }
      : { color: c.paper, width: 4, glow: null, outline: { color: c.ink, width: 7, alpha: 0.5 }, plug: { radius: 6, color: c.brass, rim: c.brassDeep } };
  },
};

export const skin: SkinPrefab<CauseTubesConfig, CauseTubesPose> = {
  skinId: "relay_line",
  create(scene, _phaser, props) {
    return createTubesView(scene, props, relayLine);
  },
};
export default skin;
