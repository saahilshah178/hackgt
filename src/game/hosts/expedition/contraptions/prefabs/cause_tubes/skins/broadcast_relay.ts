/**
 * cause_tubes · skin broadcast_relay (civil e6, the broadcast mast; §4.3 slots mast, relay_dish, lift_cage, console).
 * Relay stations climb a lattice mast by DISPLAY index (height reveals nothing), a stray station stands on its own
 * pole; each draft edge strings a vertical wire whose sag is lateral (sag_x = 0.08·|Δy| + 16) and turns the receiving
 * dish to face its source (eased). Success: the current climbs station by station, each dish flashes, the top station
 * fires a record-light beam and the lift cage powers. Failure: the `from` station sparks, its dish droops 20° and its
 * wire goes slack; a decoy's fuse pops. Code-drawn stand-ins until KC4's hero `relay_dish` lands.
 */
import type Phaser from "phaser";
import type { CauseTubesConfig } from "@/world/contraptions/cause-tubes.config";
import { HOUSING, STRAY_POLE, type CauseTubesPose, type TubeHousing } from "@/world/contraptions/cause-tubes.meta";
import type { SkinPrefab } from "../../../types";
import { createTubesView, drawFocus, drawLamp, type DynamicFx, type HousingFx, type TubesSkin, type TubesSkinCtx } from "../shared";
import { sagSpring } from "../motion";

const ST = HOUSING.mast;
const MAST_TOP = -900;
const LIFT = { x: -230, w: 150, h: 180 };

const broadcastRelay: TubesSkin = {
  skinId: "broadcast_relay",
  anchorPrefix: "station",
  arrows: false,
  grows: false,
  capsule: false,
  build(ctx: TubesSkinCtx, g: Phaser.GameObjects.Graphics) {
    const c = ctx.colors;
    const base = ctx.groundLocal;
    // the lattice mast: two rails and cross braces from the ground to the antenna ring
    g.lineStyle(8, c.steelShade, 1);
    for (const x of [-28, 28]) {
      g.beginPath();
      g.moveTo(x, base);
      g.lineTo(x * 0.5, MAST_TOP);
      g.strokePath();
    }
    g.lineStyle(4, c.steel, 1);
    for (let y = base; y > MAST_TOP + 40; y -= 80) {
      const k0 = (base - y) / (base - MAST_TOP);
      const k1 = (base - (y - 80)) / (base - MAST_TOP);
      const w0 = 28 * (1 - 0.5 * k0);
      const w1 = 28 * (1 - 0.5 * k1);
      g.beginPath();
      g.moveTo(-w0, y);
      g.lineTo(w1, y - 80);
      g.moveTo(w0, y);
      g.lineTo(-w1, y - 80);
      g.strokePath();
    }
    // the antenna ring at the top
    g.lineStyle(6, c.brass, 1);
    g.strokeCircle(0, MAST_TOP - 30, 34);
    // the stray station's own pole
    const stray = { x: Math.min(STRAY_POLE.x, ctx.W / 2 - ST.w / 2), y: STRAY_POLE.y };
    g.fillStyle(c.steelShade, 1);
    g.fillRect(stray.x - 6, stray.y, 12, base - stray.y);
    // the service lift cage at the mast foot (dark until the success powers it)
    g.lineStyle(5, c.steelShade, 1);
    g.strokeRect(LIFT.x - LIFT.w / 2, base - LIFT.h, LIFT.w, LIFT.h);
    for (let x = -LIFT.w / 2 + 25; x < LIFT.w / 2; x += 25) {
      g.beginPath();
      g.moveTo(LIFT.x + x, base - LIFT.h);
      g.lineTo(LIFT.x + x, base);
      g.strokePath();
    }
    const lift = { x: LIFT.x, y: base - LIFT.h / 2 };
    return { lift, gauge: lift, payoff: lift, top: { x: 0, y: MAST_TOP - 30 } };
  },
  drawHousing(g: Phaser.GameObjects.Graphics, h: TubeHousing, fx: HousingFx, ctx: TubesSkinCtx) {
    const c = ctx.colors;
    // the arm from the mast (or the stray pole's cap)
    g.lineStyle(6, c.steelShade, fx.dim);
    g.beginPath();
    g.moveTo(h.x < 0 ? -20 : 20, h.y);
    g.lineTo(h.x, h.y);
    g.strokePath();
    // insulator bank + typed-card window (the caption is a DOM chip at node_<key>)
    g.fillStyle(c.brassDeep, fx.dim);
    g.fillRoundedRect(h.x - ST.w / 2, h.y - ST.h / 2, ST.w, ST.h, 10);
    g.fillStyle(c.paper, 0.9 * fx.dim);
    g.fillRect(h.x - ST.w / 2 + 12, h.y - 10, ST.w - 24, 34);
    for (let i = 0; i < 3; i++) {
      g.fillStyle(c.glass, fx.dim);
      g.fillCircle(h.x - 30 + i * 30, h.y - 30, 8);
    }
    // the dish: faces its source (h.dishRad, eased by the controller), droops on a failed link
    const a = h.dishRad + fx.droop * (Math.cos(h.dishRad) >= 0 ? 1 : -1);
    const dc = { x: h.x + Math.cos(a) * 58, y: h.y + Math.sin(a) * 58 };
    const lit = fx.lit || h.lamp === "lit";
    g.lineStyle(9, lit ? c.cyan : c.steel, fx.dim);
    g.beginPath();
    g.arc(dc.x - Math.cos(a) * 30, dc.y - Math.sin(a) * 30, 42, a - 0.85, a + 0.85, false);
    g.strokePath();
    g.lineStyle(3, c.steelShade, fx.dim);
    g.beginPath();
    g.moveTo(h.x, h.y);
    g.lineTo(dc.x + Math.cos(a) * 14, dc.y + Math.sin(a) * 14);
    g.strokePath();
    drawLamp(g, { x: h.x + ST.w / 2 - 16, y: h.y - ST.h / 2 + 16 }, 9, h.lamp, fx, c, ctx.scene.time.now);
    if (h.focus) drawFocus(g, { x: h.x, y: h.y }, ST.w, ST.h, c);
  },
  drawDynamic(g: Phaser.GameObjects.Graphics, pose: CauseTubesPose, dyn: DynamicFx, ctx: TubesSkinCtx, anchors) {
    const c = ctx.colors;
    // the lift cage powers when the circuit closes
    const power = Math.max(pose.gate, dyn.payoff ?? 0);
    if (power > 0) {
      const lift = anchors.lift;
      g.fillStyle(c.cyan, 0.25 * power);
      g.fillRect(lift.x - LIFT.w / 2 + 6, lift.y - LIFT.h / 2 + 6, LIFT.w - 12, LIFT.h - 12);
      g.fillStyle(c.cyanHi, power);
      g.fillCircle(lift.x, lift.y - LIFT.h / 2 - 12, 8);
    }
    // the top station's record-light beam to the antenna ring
    const beam = dyn.beam ?? (pose.solved ? 1 : 0);
    if (beam > 0) {
      const top = anchors.top;
      g.lineStyle(14, c.cyan, 0.3 * beam);
      g.beginPath();
      g.moveTo(top.x, top.y);
      g.lineTo(top.x, top.y - 600 * beam);
      g.strokePath();
      g.lineStyle(4, c.cyanHi, 0.9 * beam);
      g.beginPath();
      g.moveTo(top.x, top.y);
      g.lineTo(top.x, top.y - 600 * beam);
      g.strokePath();
    }
    // completion only: a row of pips on the lift cage's lintel (the counter text is a DOM chip at `gauge`)
    if (pose.showGauge && pose.edgeCount > 0) {
      const lift = anchors.lift;
      const shiver = dyn.shiver > 0 ? Math.sin(dyn.now / 25) * 3 : 0;
      for (let i = 0; i < pose.edgeCount; i++) {
        const on = i < Math.round(pose.gauge * pose.edgeCount);
        g.fillStyle(on ? c.amber : c.dormant, on ? 1 : 0.6);
        g.fillCircle(lift.x - ((pose.edgeCount - 1) * 18) / 2 + i * 18 + shiver, lift.y - LIFT.h / 2 - 34, 6);
      }
    }
  },
  wireShape(w, ageMs, reducedMotion) {
    return { kind: "vertical", bow: w.bowDir * w.sag * sagSpring(ageMs, reducedMotion), segments: 20 };
  },
  wireStyle(ctx, lit) {
    const c = ctx.colors;
    return lit
      ? { color: c.cyanHi, width: 5, glow: { color: c.cyan, width: 14, alpha: 0.35 }, outline: { color: c.ink, width: 8, alpha: 0.5 }, plug: null }
      : { color: c.paper, width: 4, glow: null, outline: { color: c.ink, width: 7, alpha: 0.5 }, plug: null };
  },
};

export const skin: SkinPrefab<CauseTubesConfig, CauseTubesPose> = {
  skinId: "broadcast_relay",
  create(scene, _phaser, props) {
    return createTubesView(scene, props, broadcastRelay);
  },
};
export default skin;
