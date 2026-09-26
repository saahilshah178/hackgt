/**
 * router_lanes · skin carrier_lanes (cell e6, the Threshold Yard; §4.3 slots carrier_door, glide_gate, pump_gate,
 * ramp_wedge, cargo glyphs, console). The Pump Hall's Carrier Door (a revolving cream drum 2.4 H tall with one cargo
 * pocket and gold hinge rings, set in the navy-banded façade) stands between the Glide Gate (a channel ring and a small
 * carrier rocker at the foot of a downhill ramp) and the Pump Gate (a compact gold-trimmed pump at the top of an uphill
 * ramp, its ATP port glowing 0.2 + 0.15·n_active). Every cargo floats over its own gradient ramp (the text's stated
 * direction; a flat plinth when the text states none). Success: passive cargo slides down through the Glide Gate with
 * no spark, active cargo is lifted up with a gold ATP spark, then the door revolves 180°. Failure: a passive cargo in
 * the pump fizzles its spark and rolls away; an active cargo at the Glide Gate creeps up, stalls and slides back.
 * Code-drawn stand-ins until KB4's hero parts land.
 */
import type Phaser from "phaser";
import type { RouterLanesConfig } from "@/world/contraptions/router-lanes.config";
import { laneX, type RouterLanesPose } from "@/world/contraptions/router-lanes.meta";
import type { SkinPrefab } from "../../../types";
import { createRouterView, drawSpark, type LaneSlot, type RouterBuild, type RouterDyn, type RouterSkin, type RouterSkinCtx } from "../shared";

const GLIDE = { x: -250, ringY: -70 };
const PUMP = { x: 260, y: -80, port: { x: 260, y: -250 } };
const DOOR_H = 408; // 2.4 H
const QUEUE_Y = -150;

function doorX(ctx: RouterSkinCtx): number {
  return ctx.blockerLocal ?? 0;
}

function laneSlotFor(laneId: string, i: number, n: number): LaneSlot {
  if (/glide|passive/.test(laneId)) return { mouth: { x: GLIDE.x, y: GLIDE.ringY }, queueY: QUEUE_Y };
  if (/pump|active/.test(laneId)) return { mouth: { x: PUMP.x, y: PUMP.y }, queueY: QUEUE_Y - 60 };
  return { mouth: { x: laneX(i, n), y: -60 }, queueY: QUEUE_Y };
}

const carrierLanes: RouterSkin = {
  skinId: "carrier_lanes",
  itemR: 28,
  ramps: true,
  build(ctx: RouterSkinCtx, g: Phaser.GameObjects.Graphics): RouterBuild {
    const c = ctx.colors;
    const n = ctx.config.lanes.length;
    const lanes = ctx.config.lanes.map((l, i) => laneSlotFor(l.laneId, i, n));
    const dx = doorX(ctx);
    // the hall façade behind the door: navy bands and three ring windows
    g.fillStyle(c.stoneShade, 1);
    g.fillRect(dx - 200, -DOOR_H - 90, 400, DOOR_H + 90);
    g.fillStyle(c.navy, 1);
    for (const y of [-DOOR_H - 70, -DOOR_H - 30]) g.fillRect(dx - 200, y, 400, 14);
    for (const wx of [-130, 0, 130]) {
      g.lineStyle(6, c.goldDeep, 1);
      g.strokeCircle(dx + wx, -DOOR_H - 45, 14);
    }
    // the Glide Gate's downhill ramp (high on the left, the gate at its foot)
    g.fillStyle(c.stoneDeep, 1);
    g.fillTriangle(GLIDE.x - 170, 0, GLIDE.x - 40, 0, GLIDE.x - 170, -70);
    g.fillStyle(c.stone, 1);
    g.fillTriangle(GLIDE.x - 164, -4, GLIDE.x - 50, -4, GLIDE.x - 164, -62);
    // the Pump Gate's uphill ramp (the pump at its top)
    g.fillStyle(c.stoneDeep, 1);
    g.fillTriangle(PUMP.x - 170, 0, PUMP.x - 20, 0, PUMP.x - 20, -40);
    g.fillRect(PUMP.x - 20, -40, 90, 40);
    // the Glide Gate: a channel ring on a stone plinth
    g.fillStyle(c.stoneShade, 1);
    g.fillRect(GLIDE.x - 50, -20, 100, 20);
    // the Pump Gate: a compact gold-trimmed pump body
    g.fillStyle(c.stone, 1);
    g.fillRoundedRect(PUMP.x - 60, PUMP.y - 110, 120, 110, 16);
    g.lineStyle(6, c.gold, 1);
    g.strokeRoundedRect(PUMP.x - 60, PUMP.y - 110, 120, 110, 16);
    g.fillStyle(c.navy, 1);
    g.fillRect(PUMP.x - 8, PUMP.port.y, 16, PUMP.y - 110 - PUMP.port.y);
    return {
      anchors: {
        lane_passive: { x: GLIDE.x, y: GLIDE.ringY },
        lane_active: { x: PUMP.x, y: PUMP.y },
        door_pocket: { x: dx, y: -DOOR_H / 2 },
        atp_port: { ...PUMP.port },
      },
      lanes,
      energy: { ...PUMP.port },
      payoff: { x: dx, y: -DOOR_H / 2 },
      driftOffset: { x: 0, y: -120 },
      eye: null,
    };
  },
  drawDynamic(g: Phaser.GameObjects.Graphics, pose: RouterLanesPose, dyn: RouterDyn, ctx: RouterSkinCtx, layout: RouterBuild) {
    const c = ctx.colors;
    const glideLane = layout.lanes.findIndex((l) => l.mouth.x === GLIDE.x);
    const pumpLane = layout.lanes.findIndex((l) => l.mouth.x === PUMP.x);
    // lane focus glow (a bin card focused in the panel)
    pose.lanes.forEach((l, i) => {
      const slot = layout.lanes[i];
      if (!slot || l.open < 0.02) return;
      g.fillStyle(c.tide, 0.28 * l.open);
      g.fillCircle(slot.mouth.x, slot.mouth.y, 96);
    });
    // the Glide Gate's channel ring + its small carrier rocker
    const gflash = glideLane >= 0 ? dyn.laneFlash[glideLane]! : 0;
    g.lineStyle(16, gflash > 0 && Math.floor(gflash / 110) % 2 === 0 ? c.salmon : c.bronze, 1);
    g.strokeCircle(GLIDE.x, GLIDE.ringY, 52);
    const rock = (dyn.payoff !== null && dyn.payoff < 1 ? Math.sin(Math.PI * dyn.payoff) : 0) * Math.PI;
    g.lineStyle(10, c.stoneLit, 1);
    g.beginPath();
    g.moveTo(GLIDE.x - 40 * Math.cos(rock), GLIDE.ringY + 40 * Math.sin(rock));
    g.lineTo(GLIDE.x + 40 * Math.cos(rock), GLIDE.ringY - 40 * Math.sin(rock));
    g.strokePath();
    // the Pump Gate's intake glow: 0.2 + 0.15·n_active (a claim render, never a verdict)
    g.fillStyle(c.atp, 0.9 * pose.intakeGlow);
    g.fillCircle(PUMP.port.x, PUMP.port.y, 22);
    g.fillStyle(c.atpCore, 0.9 * pose.intakeGlow);
    g.fillCircle(PUMP.port.x, PUMP.port.y, 10);
    g.fillStyle(c.atp, 0.35 * pose.intakeGlow);
    g.fillRoundedRect(PUMP.x - 44, PUMP.y - 94, 88, 78, 12);
    if (pumpLane >= 0 && dyn.laneSpark[pumpLane]! > 0) drawSpark(g, { x: PUMP.x, y: PUMP.y - 120 }, dyn.laneSpark[pumpLane]! / 500, c.atp, true);
    if (pumpLane >= 0 && dyn.laneFlash[pumpLane]! > 0) {
      g.lineStyle(5, c.salmon, Math.min(1, dyn.laneFlash[pumpLane]! / 300));
      g.strokeRoundedRect(PUMP.x - 66, PUMP.y - 116, 132, 122, 18);
    }
    // the Carrier Door: a revolving drum; its pocket swings round 180° on success
    const dx = doorX(ctx);
    const turn = Math.max(pose.gate, dyn.payoff ?? 0) * Math.PI;
    const w = 150;
    g.fillStyle(c.stoneShade, 1);
    g.fillRoundedRect(dx - w / 2 - 8, -DOOR_H, w + 16, DOOR_H, 30);
    g.fillStyle(c.stoneLit, 1);
    g.fillRoundedRect(dx - w / 2, -DOOR_H + 8, w, DOOR_H - 8, 26);
    const pocketX = dx + (w / 2 - 34) * Math.sin(turn - Math.PI / 2) * -1;
    const pocketW = 64 * Math.max(0.15, Math.abs(Math.cos(turn / 2)));
    g.fillStyle(c.navyDark, 0.9);
    g.fillRoundedRect(pocketX - pocketW / 2, -DOOR_H * 0.72, pocketW, DOOR_H * 0.6, 18);
    g.lineStyle(6, c.gold, 1);
    for (const y of [-DOOR_H + 40, -40]) {
      g.beginPath();
      g.moveTo(dx - w / 2, y);
      g.lineTo(dx + w / 2, y);
      g.strokePath();
    }
  },
};

export const skin: SkinPrefab<RouterLanesConfig, RouterLanesPose> = {
  skinId: "carrier_lanes",
  create(scene, _phaser, props) {
    return createRouterView(scene, props, carrierLanes);
  },
};
export default skin;
