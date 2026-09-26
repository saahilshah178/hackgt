/**
 * router_lanes · skin membrane_router (cell e2, the Crossing Yard; §4.3 slots crossing_gate, gate_fin, gate_ring_outer,
 * gate_ring_inner, oil_road, molecule glyphs, carrier_rocker, lane_mouth, console). Two lanes: the Oil Road (bare
 * lipid heads over a navy inlay plate) and the Crossing Gate (an arch 2.2 H tall whose ring body runs down through the
 * bilayer: an outer ring, an inner selectivity ring with 6 notches that "listens" 10° toward the newest cargo, and gold
 * keystone fins). Success: oil-road cargo sinks through the parting heads, gate cargo spins through the ring, the fins
 * split ±28°, the arch doors part with a light shaft, and the carrier rocker beyond tilts 22° into the ramp. Failure:
 * the named cargo bounces off the heads (they flash) or the ring flashes its notches and refuses it.
 * Code-drawn stand-ins until the hero parts land (C2 owns this skin's hero fragments).
 */
import type Phaser from "phaser";
import type { RouterLanesConfig } from "@/world/contraptions/router-lanes.config";
import { laneX, type RouterLanesPose } from "@/world/contraptions/router-lanes.meta";
import type { SkinPrefab } from "../../../types";
import { createRouterView, type LaneSlot, type RouterBuild, type RouterDyn, type RouterSkin, type RouterSkinCtx } from "../shared";

const OIL_X = -440;
const OIL_W = 240;
const GATE = { x: -60, archH: 374, archW: 250, ringY: -190, outerR: 112, innerR: 72 };
const ROCKER = { x: 150, y: -36, len: 300 };
const QUEUE_Y = -90;

function laneSlotFor(laneId: string, i: number, n: number): LaneSlot {
  if (/oil|road|diffus/.test(laneId)) return { mouth: { x: OIL_X, y: -12 }, queueY: QUEUE_Y };
  if (/gate|protein|channel/.test(laneId)) return { mouth: { x: GATE.x, y: GATE.ringY }, queueY: QUEUE_Y };
  return { mouth: { x: laneX(i, n), y: -12 }, queueY: QUEUE_Y };
}

function drawHeads(g: Phaser.GameObjects.Graphics, x0: number, x1: number, y: number, ctx: RouterSkinCtx, lit: number, part: number, partX: number, t: number): void {
  const c = ctx.colors;
  for (let x = x0; x <= x1; x += 24) {
    const d = x - partX;
    const dip = part * 28 * Math.exp(-(d * d) / (2 * 60 * 60)); // the heads part (the e1 Gaussian)
    const ripple = lit > 0 ? 4 * Math.sin(x / 30 + t / 60) * lit : 0;
    g.fillStyle(c.tail, 0.9);
    g.fillRect(x - 3, y + 10 + dip, 6, 26);
    g.fillStyle(lit > 0 ? c.headLit : c.head, 1);
    g.fillCircle(x, y + dip + ripple, 11);
    g.fillStyle(c.headShade, 0.8);
    g.fillCircle(x + 3, y + dip + ripple + 3, 5);
  }
}

const membraneRouter: RouterSkin = {
  skinId: "membrane_router",
  itemR: 30,
  ramps: false,
  build(ctx: RouterSkinCtx, g: Phaser.GameObjects.Graphics): RouterBuild {
    const c = ctx.colors;
    const n = ctx.config.lanes.length;
    const lanes = ctx.config.lanes.map((l, i) => laneSlotFor(l.laneId, i, n));
    // the yard's bilayer band (tails + navy seam) the lanes sit in
    g.fillStyle(c.tail, 0.55);
    g.fillRect(-720, 12, 1440, 44);
    g.fillStyle(c.navyDark, 0.7);
    g.fillRect(-720, 32, 1440, 5);
    // the Oil Road: a navy inlay circle plate under a 300-unit stretch of bare heads
    g.fillStyle(c.navy, 1);
    g.fillEllipse(OIL_X, 8, OIL_W + 40, 44);
    g.lineStyle(4, c.goldDeep, 1);
    g.strokeEllipse(OIL_X, 8, OIL_W + 40, 44);
    // the Crossing Gate: pillars + the round arch head (the ring body is dynamic)
    const { x, archH, archW } = GATE;
    g.fillStyle(c.stoneShade, 1);
    g.fillRect(x - archW / 2 - 34, -archH + archW / 2, 44, archH - archW / 2 + 40);
    g.fillRect(x + archW / 2 - 10, -archH + archW / 2, 44, archH - archW / 2 + 40);
    g.fillStyle(c.stone, 1);
    g.fillRect(x - archW / 2 - 28, -archH + archW / 2, 32, archH - archW / 2 + 40);
    g.fillRect(x + archW / 2 - 4, -archH + archW / 2, 32, archH - archW / 2 + 40);
    g.lineStyle(40, c.stone, 1);
    g.beginPath();
    g.arc(x, -archH + archW / 2, archW / 2 + 12, Math.PI, 2 * Math.PI, false);
    g.strokePath();
    g.lineStyle(6, c.stoneDeep, 1);
    g.beginPath();
    g.arc(x, -archH + archW / 2, archW / 2 - 8, Math.PI, 2 * Math.PI, false);
    g.strokePath();
    // the ring body continues down through the bilayer band
    g.fillStyle(c.bronze, 0.9);
    g.fillRect(x - 40, 0, 80, 60);
    // the rocker's pivot (the plank is dynamic)
    g.fillStyle(c.stoneDeep, 1);
    g.fillTriangle(ROCKER.x - 30, 0, ROCKER.x + 30, 0, ROCKER.x, ROCKER.y);
    return {
      anchors: {
        lane_diffuses: { x: OIL_X, y: -12 },
        lane_protein: { x: GATE.x, y: GATE.ringY },
        gate_ring: { x: GATE.x, y: GATE.ringY },
        rocker_pivot: { x: ROCKER.x, y: ROCKER.y },
      },
      lanes,
      energy: null,
      payoff: { x: GATE.x, y: -archH },
      driftOffset: { x: 0, y: -120 },
      eye: null,
    };
  },
  drawDynamic(g: Phaser.GameObjects.Graphics, pose: RouterLanesPose, dyn: RouterDyn, ctx: RouterSkinCtx, layout: RouterBuild) {
    const c = ctx.colors;
    const open = Math.max(pose.gate, dyn.payoff ?? 0);
    const oilLane = layout.lanes.findIndex((l) => l.mouth.x === OIL_X);
    const gateLane = layout.lanes.findIndex((l) => l.mouth.x === GATE.x);
    const oilLit = oilLane >= 0 ? Math.min(1, dyn.laneFlash[oilLane]! / 300) : 0;
    const oilFocus = oilLane >= 0 ? pose.lanes[oilLane]?.open ?? 0 : 0;
    const part = oilLane >= 0 && dyn.payoff !== null && dyn.payoff < 1 ? Math.sin(Math.PI * Math.min(1, dyn.payoff * 1.4)) : 0;
    if (oilFocus > 0.02) {
      g.fillStyle(c.tide, 0.25 * oilFocus);
      g.fillEllipse(OIL_X, -6, OIL_W + 90, 90);
    }
    drawHeads(g, OIL_X - OIL_W / 2, OIL_X + OIL_W / 2, -6, ctx, oilLit, part, OIL_X, dyn.now);

    // the ring body: outer ring, inner selectivity ring (listens 10° toward the newest cargo; rotates on success)
    const { x, ringY, outerR, innerR, archH, archW } = GATE;
    const gateFocus = gateLane >= 0 ? pose.lanes[gateLane]?.open ?? 0 : 0;
    const flash = gateLane >= 0 ? dyn.laneFlash[gateLane]! : 0;
    const notchCol = flash > 0 && Math.floor(flash / 110) % 2 === 0 ? c.salmon : c.goldHi;
    // the arch doors part on success; a light shaft spills out
    const doors = Math.min(1, open * 1.2);
    g.fillStyle(c.cyto, 0.35 * doors);
    g.fillRect(x - archW / 2 + 10, -archH + archW / 2, archW - 20, archH - archW / 2);
    const leafW = (archW / 2 - 10) * (1 - doors);
    g.fillStyle(c.stoneShade, 1);
    g.fillRect(x - archW / 2 + 10, -archH + archW / 2 + 10, leafW, archH - archW / 2 - 10);
    g.fillRect(x + archW / 2 - 10 - leafW, -archH + archW / 2 + 10, leafW, archH - archW / 2 - 10);
    if (gateFocus > 0.02) {
      g.fillStyle(c.tide, 0.3 * gateFocus);
      g.fillCircle(x, ringY, outerR + 26);
    }
    g.lineStyle(22, c.bronze, 1);
    g.strokeCircle(x, ringY, outerR);
    g.lineStyle(4, c.goldDeep, 1);
    g.strokeCircle(x, ringY, outerR + 11);
    const spin = pose.listenTurn + (dyn.payoff ?? 0) * (Math.PI / 3) * Math.max(1, pose.lanes[gateLane]?.count ?? 1);
    g.lineStyle(14, c.stoneShade, 1);
    g.strokeCircle(x, ringY, innerR);
    for (let i = 0; i < 6; i++) {
      const a = spin + (i * Math.PI) / 3;
      g.fillStyle(notchCol, 1);
      g.fillCircle(x + Math.cos(a) * innerR, ringY + Math.sin(a) * innerR, 7);
    }
    // gold keystone fins at the arch crown: split ±28° on success
    const split = (open * 28 * Math.PI) / 180;
    for (const side of [-1, 1]) {
      const a = side * split;
      const px = x;
      const py = -archH - 6;
      const tip = { x: px + Math.sin(a) * 70 + side * 6, y: py - Math.cos(a) * 70 };
      g.fillStyle(c.gold, 1);
      g.fillTriangle(px + side * 4, py, px + side * 34, py + 6, tip.x, tip.y);
      g.fillStyle(c.goldHi, 1);
      g.fillTriangle(px + side * 6, py - 4, px + side * 18, py, tip.x, tip.y + 8);
    }
    // the carrier rocker: a cream see-saw that tilts 22° into the ramp to the terrace
    const tilt = (-22 * Math.PI * open) / 180;
    const hx = (Math.cos(tilt) * ROCKER.len) / 2;
    const hy = (Math.sin(tilt) * ROCKER.len) / 2;
    g.lineStyle(26, c.stoneShade, 1);
    g.beginPath();
    g.moveTo(ROCKER.x - hx, ROCKER.y - hy);
    g.lineTo(ROCKER.x + hx, ROCKER.y + hy);
    g.strokePath();
    g.lineStyle(16, c.stoneLit, 1);
    g.beginPath();
    g.moveTo(ROCKER.x - hx, ROCKER.y - hy - 3);
    g.lineTo(ROCKER.x + hx, ROCKER.y + hy - 3);
    g.strokePath();
    g.fillStyle(c.gold, 1);
    g.fillCircle(ROCKER.x, ROCKER.y, 10);
  },
};

export const skin: SkinPrefab<RouterLanesConfig, RouterLanesPose> = {
  skinId: "membrane_router",
  create(scene, _phaser, props) {
    return createRouterView(scene, props, membraneRouter);
  },
};
export default skin;
