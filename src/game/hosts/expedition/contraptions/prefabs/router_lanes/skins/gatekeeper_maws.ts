/**
 * router_lanes · skin gatekeeper_maws (cell e11, the boss; §4.3 slots gatekeeper_body, maw_oil, maw_channel, maw_pump,
 * eye_ring, eye_pupil, atp_pipe, cargo glyphs, console). The Gatekeeper and his three maws: the Oil Maw (lined with
 * lipid heads that ripple as cargo queues), the Channel Maw (a bronze selectivity ring that turns 30° per queued cargo)
 * and the Pump Maw (gold teeth, an ATP pipe up his back that surges 0.2 + 0.1·n_active with a packet per new active
 * cargo). A maw whose bin is focused opens 12° and glows; the eye-ring's pupil tracks the focused cargo. Boss batches
 * come from the core (`withBossPhases`). Success: each maw swallows in turn, the eye-ring turns gold, and he rotates
 * aside 90° on his base (a gentle 3 px rumble) to open the road. Failure: the first mis-sorted cargo is spat back with
 * a puff of bubbles and a 4 px, 200 ms rumble. Code-drawn stand-ins until KB4's hero parts land.
 */
import type Phaser from "phaser";
import type { RouterLanesConfig } from "@/world/contraptions/router-lanes.config";
import { laneX, ROUTER_LAYOUT, type RouterLanesPose } from "@/world/contraptions/router-lanes.meta";
import type { SkinPrefab } from "../../../types";
import { createRouterView, type LaneSlot, type RouterBuild, type RouterDyn, type RouterSkin, type RouterSkinCtx } from "../shared";

const BODY = { x: 50, w: 980, top: -800 };
const MAW_Y = -200;
const QUEUE_Y = -330; // cell §5.11: y = y_s − 1.8 H, in front of his chest
const MAW_X: Readonly<Record<"oil" | "channel" | "pump", number>> = { oil: -260, channel: 50, pump: 360 };
const EYE = { x: 50, y: -630, r: 72 };
const PIPE_TOP = { x: 480, y: -790 };

type MawKind = "oil" | "channel" | "pump" | "other";
function mawKindOf(laneId: string): MawKind {
  if (/oil|simple/.test(laneId)) return "oil";
  if (/channel|facilitated/.test(laneId)) return "channel";
  if (/pump|active/.test(laneId)) return "pump";
  return "other";
}
function laneSlotFor(laneId: string, i: number, n: number): LaneSlot {
  const k = mawKindOf(laneId);
  const x = k === "other" ? laneX(i, n) : MAW_X[k];
  return { mouth: { x, y: MAW_Y }, queueY: QUEUE_Y };
}
function pipePoints(pumpX: number): { x: number; y: number }[] {
  return [
    { x: PIPE_TOP.x, y: PIPE_TOP.y },
    { x: PIPE_TOP.x, y: -420 },
    { x: pumpX + 60, y: MAW_Y - 70 },
  ];
}
function strokePolyline(g: Phaser.GameObjects.Graphics, pts: readonly { x: number; y: number }[]): void {
  g.beginPath();
  pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
  g.strokePath();
}
function pointOnPolyline(pts: readonly { x: number; y: number }[], u: number): { x: number; y: number } {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
    seg.push(d);
    total += d;
  }
  let s = Math.max(0, Math.min(1, u)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (s <= seg[i]! || i === seg.length - 1) {
      const f = seg[i]! > 0 ? Math.min(1, s / seg[i]!) : 0;
      return { x: pts[i]!.x + (pts[i + 1]!.x - pts[i]!.x) * f, y: pts[i]!.y + (pts[i + 1]!.y - pts[i]!.y) * f };
    }
    s -= seg[i]!;
  }
  return pts[pts.length - 1]!;
}

const gatekeeperMaws: RouterSkin = {
  skinId: "gatekeeper_maws",
  itemR: 28,
  ramps: true,
  payoffShake: { px: 3, ms: 600 },
  build(ctx: RouterSkinCtx): RouterBuild {
    const n = ctx.config.lanes.length;
    const lanes = ctx.config.lanes.map((l, i) => laneSlotFor(l.laneId, i, n));
    const anchors: Record<string, { x: number; y: number }> = {
      maw_simple: { x: MAW_X.oil, y: MAW_Y },
      maw_facilitated: { x: MAW_X.channel, y: MAW_Y },
      maw_active: { x: MAW_X.pump, y: MAW_Y },
      eye: { x: EYE.x, y: EYE.y },
      pipe_top: { ...PIPE_TOP },
    };
    // the anchors follow the configured lanes when their ids name the maws
    ctx.config.lanes.forEach((l, i) => {
      const k = mawKindOf(l.laneId);
      if (k === "oil") anchors.maw_simple = { ...lanes[i]!.mouth };
      if (k === "channel") anchors.maw_facilitated = { ...lanes[i]!.mouth };
      if (k === "pump") anchors.maw_active = { ...lanes[i]!.mouth };
    });
    return {
      anchors,
      lanes,
      energy: ctx.config.energy ? { ...PIPE_TOP } : null,
      payoff: { x: BODY.x, y: -400 },
      driftOffset: { x: BODY.x, y: -190 },
      eye: { x: EYE.x, y: EYE.y },
    };
  },
  drawDynamic(g: Phaser.GameObjects.Graphics, pose: RouterLanesPose, dyn: RouterDyn, ctx: RouterSkinCtx, layout: RouterBuild) {
    const c = ctx.colors;
    const turned = Math.max(pose.gate, dyn.payoff ?? 0);
    // he rotates aside 90° on his base: the front squashes to his profile and slides off the road
    const sx = 1 - 0.7 * turned;
    const cx = BODY.x + 260 * turned;
    const X = (x: number) => cx + (x - BODY.x) * sx;
    const bw = BODY.w * sx;
    // body: a great cream dome with navy bands
    g.fillStyle(c.stoneDeep, 1);
    g.fillRoundedRect(cx - bw / 2 - 10, BODY.top - 10, bw + 20, -BODY.top + 20, { tl: 260 * sx, tr: 260 * sx, bl: 20, br: 20 });
    g.fillStyle(c.stone, 1);
    g.fillRoundedRect(cx - bw / 2, BODY.top, bw, -BODY.top, { tl: 250 * sx, tr: 250 * sx, bl: 16, br: 16 });
    g.fillStyle(c.navy, 1);
    g.fillRect(cx - bw / 2 + 20 * sx, -420, bw - 40 * sx, 16);
    g.fillRect(cx - bw / 2 + 20 * sx, -60, bw - 40 * sx, 16);
    // the ATP pipe up his back, surging with the projected spend; packets run down to the pump maw
    const pumpLane = ctx.config.lanes.findIndex((l) => mawKindOf(l.laneId) === "pump");
    if (ctx.config.energy && pumpLane >= 0 && turned < 0.95) {
      const pts = pipePoints(layout.lanes[pumpLane]!.mouth.x).map((p) => ({ x: X(p.x), y: p.y }));
      const glow = pose.pipeGlow;
      g.lineStyle(34, c.atp, 0.35 * glow);
      strokePolyline(g, pts);
      g.lineStyle(20, c.navyDark, 1);
      strokePolyline(g, pts);
      g.lineStyle(8, c.atp, 0.3 + 0.7 * glow);
      strokePolyline(g, pts);
      for (const u of dyn.packets) {
        if (u < 0) continue;
        const p = pointOnPolyline(pts, u);
        g.fillStyle(c.atpCore, 1);
        g.fillCircle(p.x, p.y, 11);
        g.fillStyle(c.atp, 0.5);
        g.fillCircle(p.x, p.y, 18);
      }
    }
    // the eye-ring and its pupil (tracks the focused cargo; looks down at the console otherwise)
    const eyeX = X(EYE.x);
    const gold = turned > 0.1;
    g.fillStyle(c.navyDark, 1);
    g.fillEllipse(eyeX, EYE.y, 2 * EYE.r * sx + 8, 2 * EYE.r + 8);
    g.lineStyle(14, gold ? c.goldHi : c.bronze, 1);
    g.strokeEllipse(eyeX, EYE.y, 2 * EYE.r * sx, 2 * EYE.r);
    g.fillStyle(gold ? c.gold : c.tide, pose.eyeTracking || gold ? 1 : 0.75);
    g.fillCircle(eyeX + Math.cos(dyn.eye) * 30 * sx, EYE.y + Math.sin(dyn.eye) * 30, 24);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(eyeX + Math.cos(dyn.eye) * 30 * sx - 7, EYE.y + Math.sin(dyn.eye) * 30 - 7, 6);
    // the maws
    pose.lanes.forEach((lane, i) => {
      const slot = layout.lanes[i];
      if (!slot) return;
      const kind = mawKindOf(lane.laneId);
      const mx = X(slot.mouth.x);
      const my = slot.mouth.y;
      const chomp = dyn.laneSwallow[i]! > 0 ? Math.sin((Math.PI * dyn.laneSwallow[i]!) / 450) : 0;
      const openDeg = ROUTER_LAYOUT.mawOpenDeg * lane.open + 18 * chomp;
      const gap = 26 + 4.5 * openDeg; // the jaw plates part 12° on focus (cell §5.11)
      const w = 190 * sx;
      if (lane.open > 0.02) {
        g.fillStyle(c.tide, 0.3 * lane.open);
        g.fillEllipse(mx, my, w + 60, 170);
      }
      // mouth
      g.fillStyle(c.navyDark, 1);
      g.fillEllipse(mx, my, w, gap + 20);
      // jaw plates
      const flash = dyn.laneFlash[i]! > 0 && Math.floor(dyn.laneFlash[i]! / 110) % 2 === 0;
      g.fillStyle(flash ? c.salmon : c.stoneShade, 1);
      g.fillRoundedRect(mx - w / 2 - 8, my - gap / 2 - 38, w + 16, 34, 14);
      g.fillRoundedRect(mx - w / 2 - 8, my + gap / 2 + 4, w + 16, 34, 14);
      if (kind === "oil") {
        const ripple = lane.count > 0 && !ctx.reducedMotion ? 5 : 0;
        for (let k = 0; k < 7; k++) {
          const hx = mx - w / 2 + 14 + (k * (w - 28)) / 6;
          const wob = ripple * Math.sin(dyn.now / 140 + k);
          g.fillStyle(c.head, 1);
          g.fillCircle(hx, my - gap / 2 - 4 + wob, 9);
          g.fillCircle(hx, my + gap / 2 + 4 - wob, 9);
        }
      } else if (kind === "channel") {
        g.lineStyle(10, c.bronze, 1);
        g.strokeEllipse(mx, my, 110 * sx, 110);
        for (let k = 0; k < 6; k++) {
          const a = lane.turn + (k * Math.PI) / 3;
          g.fillStyle(c.goldHi, 1);
          g.fillCircle(mx + Math.cos(a) * 55 * sx, my + Math.sin(a) * 55, 6);
        }
      } else if (kind === "pump") {
        g.fillStyle(c.gold, 1);
        for (let k = 0; k < 5; k++) {
          const tx = mx - w / 2 + 24 + (k * (w - 48)) / 4;
          g.fillTriangle(tx - 11, my - gap / 2 - 4, tx + 11, my - gap / 2 - 4, tx, my - gap / 2 + 16);
          g.fillTriangle(tx - 11, my + gap / 2 + 4, tx + 11, my + gap / 2 + 4, tx, my + gap / 2 - 16);
        }
        g.fillStyle(c.atp, 0.5 * pose.pipeGlow);
        g.fillEllipse(mx, my, w * 0.6, gap * 0.6 + 10);
      }
    });
  },
};

export const skin: SkinPrefab<RouterLanesConfig, RouterLanesPose> = {
  skinId: "gatekeeper_maws",
  create(scene, _phaser, props) {
    return createRouterView(scene, props, gatekeeperMaws);
  },
};
export default skin;
