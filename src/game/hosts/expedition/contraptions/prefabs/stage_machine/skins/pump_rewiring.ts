/**
 * stage_machine · skin pump_rewiring (cell e8, the Na⁺/K⁺ pump on the Pump Hall deck; §4.3 slots pump_housing, drum,
 * jaw_upper, jaw_lower, cartridge, socket, beacon_tower, hall_gate, console). A cream-stone pump 3.5 H tall spans the
 * deck floor: an upper jaw that opens to the tide, a lower jaw that opens to the cytoplasm, and an inner bronze drum that
 * turns 60° per stage carrying the coral Na⁺ and violet K⁺ sockets. A control plinth at its left holds the typed cable
 * sockets (each with a white "seated" lamp and its DOM "loaded: …" plate); a rack at its right holds the cartridges in
 * display order (pips + an arrow for a count, gold sparks for ATP, a neuron for the signal: what each IS, never where it
 * belongs). Gold-cored cables hang between them, behind the housing. The ATP port on the right flank is fed by a rail
 * pipe; the crank below is chained to the Hall Gate on the floor; the Nerve Beacon stands behind.
 *
 * Live: the stage scrubber turns the drum, swaps the jaws and plays what you loaded (ions snap in and leave, sparks enter
 * the port or fizzle in the drum, ions press on a shut jaw); the ledger needle on the drum hub leans with q. Failure:
 * the playback runs 170 ms per stage and jams at the named socket's stage (grind, 3 px shake, the socket flashes; an
 * energy socket's spark misfires; a beacon socket completes the cycle and the beacon flickers dark). Success: two
 * automatic cycles, the crank lifts the Hall Gate half-way per cycle, the beacon fires down its axon, lamps turn cyan.
 * Code-drawn stand-ins until KB4's hero parts land.
 */
import type Phaser from "phaser";
import type { StageMachineConfig } from "@/world/contraptions/stage-machine.config";
import { cartridgeAt, drumSlotAt, JAW_OPEN_DEG, PUMP, socketAt, tagAt, type PumpCartridge, type PumpSocket, type StageMachinePose } from "@/world/contraptions/stage-machine.meta";
import { clamp01, lerp, smoothingFactor } from "@/world/ease";
import type { FailurePlan, SuccessPlan } from "@/world/types";
import type { ContraptionState, PoseView, PrefabProps, SkinPrefab, XY } from "../../../types";
import { DEFAULT_CABLE_STYLE, sagPath, strokeCable } from "../../_cables";
import {
  cellColors,
  drawAtpSpark,
  drawCellLectern,
  drawMolecule,
  drawSpark,
  fillPoly,
  ionPosition,
  mix,
  moleculeColor,
  playbackK,
  rotateAbout,
  shakeOffset,
  strokePoly,
  timerBag,
  withStage,
  type CellColors,
} from "../shared";

/** The Pump Hall floor lies 2 H under the deck (cell §2.5.3: deck 873, floor 1213): where the Hall Gate stands. */
const HALL_FLOOR_DY = 340;
const GATE = { w: 132, h: 230, lift: 250 };
const ION_R = 13;
const PIPE_TOP = -640;
const SEATED_WHITE = 0xf5f8f8;
const CYAN = 0x6ed2f2;

interface Play {
  start: number;
  fromK: number;
  toK: number;
  ms: number;
  cycles: number;
}
interface Dyn {
  now: number;
  state: ContraptionState;
  play: Play | null;
  jam: { socket: number; at: number } | null;
  grindAt: number | null;
  misfireAt: number | null;
  beaconFlicker: number | null; // start time: flickers, then stays dark
  beaconPulse: number | null; // start time of the success pulse down the axon
  gate: number;
  gateTarget: number;
  lampsCyan: boolean;
}

function drawSocketIcon(g: Phaser.GameObjects.Graphics, s: PumpSocket, at: XY, c: CellColors, palette: Readonly<Record<string, string>>): void {
  if (s.kind === "ion") drawMolecule(g, s.ion === "K" ? "k" : "na", at.x, at.y, 11, moleculeColor(palette, s.ion === "K" ? "k" : "na"), c, 1);
  else if (s.kind === "energy") drawAtpSpark(g, at.x, at.y, 12, c, 1);
  else drawNeuron(g, at.x, at.y, 9, c.tide, 1);
}
/** A small neuron glyph: a soma with dendrites and an axon tail (the signal). */
function drawNeuron(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, alpha: number): void {
  g.lineStyle(Math.max(2, r * 0.3), color, alpha);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55;
    strokePoly(g, [{ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r }, { x: x + Math.cos(a) * r * 1.9, y: y + Math.sin(a) * r * 1.9 }]);
  }
  strokePoly(g, [{ x, y: y + r }, { x: x + r * 0.6, y: y + r * 2.4 }, { x: x + r * 1.6, y: y + r * 3 }]);
  g.fillStyle(color, alpha);
  g.fillCircle(x, y, r);
}

function drawCartridge(g: Phaser.GameObjects.Graphics, cart: PumpCartridge, c: CellColors, seatedAlpha: number): void {
  const { x, y } = cart;
  g.fillStyle(c.navyDark, 0.35);
  g.fillRoundedRect(x - 44, y - 22, 92, 50, 9);
  g.fillStyle(c.stoneShade, 1);
  g.fillRoundedRect(x - 46, y - 25, 92, 50, 9);
  g.fillStyle(c.stoneLit, 1);
  g.fillRoundedRect(x - 43, y - 22, 86, 40, 7);
  g.lineStyle(3, c.goldDeep, 1);
  g.strokeRoundedRect(x - 46, y - 25, 92, 50, 9);
  // what the cartridge IS (never where it belongs)
  if (cart.kind === "count") {
    const n = Math.max(1, cart.n);
    for (let i = 0; i < n; i++) {
      const px = x - 8 - (n - 1) * 8 + i * 16;
      g.fillStyle(c.navy, 1);
      g.fillCircle(px, y - 2, 6);
      g.fillStyle(c.stoneLit, 1);
      g.fillCircle(px - 2, y - 4, 2);
    }
    const ax = x + 30;
    const up = cart.dir === "out";
    g.fillStyle(c.navy, 1);
    g.fillRect(ax - 3, y - 12, 6, 22);
    g.fillTriangle(ax - 9, up ? y - 8 : y + 6, ax + 9, up ? y - 8 : y + 6, ax, up ? y - 20 : y + 18);
  } else if (cart.kind === "atp") {
    const n = Math.max(1, cart.n);
    for (let i = 0; i < n; i++) drawAtpSpark(g, x - (n - 1) * 12 + i * 24, y - 2, 12, c, 1, 0.2);
  } else drawNeuron(g, x - 4, y - 8, 7, c.navy, 1);
  // the plug socket on its left edge: white once a cable is seated
  g.fillStyle(c.bronze, 1);
  g.fillCircle(x - 46, y, 9);
  g.fillStyle(seatedAlpha > 0 ? SEATED_WHITE : c.navyDark, seatedAlpha > 0 ? seatedAlpha : 1);
  g.fillCircle(x - 46, y, 5);
}

function createPumpView(scene: Phaser.Scene, props: PrefabProps<StageMachineConfig>): PoseView<StageMachinePose> {
  const config = props.config;
  const view = props.view;
  const anchor = props.station.anchor;
  const c = cellColors(props.palette);
  const reduced = props.reducedMotion;
  const consoleLocal: XY = { x: props.station.consoleX - anchor.x, y: props.groundY - anchor.y };
  const blocker = props.station.payoff.blocker;
  const gateAt: XY | null = blocker
    ? { x: blocker.x - anchor.x, y: blocker.surface === props.station.consoleSurface ? consoleLocal.y : HALL_FLOOR_DY }
    : null;
  const H = PUMP.housing;
  const drumC: XY = { x: PUMP.drum.x, y: PUMP.drum.y };

  const root = scene.add.container(anchor.x, anchor.y);
  const back = scene.add.graphics(); // static: beacon column, plinth, rack, pipe, console
  const beaconG = scene.add.graphics();
  const cablesG = scene.add.graphics();
  const bodyG = scene.add.graphics(); // housing, jaws, drum (redrawn: the drum turns, the jaws swing)
  const frontG = scene.add.graphics(); // ions, sparks, cartridges, lamps, needle, fx
  root.add([back, beaconG, cablesG, bodyG, frontG]);

  let alive = true;
  const timers = timerBag(scene, () => alive);
  const dyn: Dyn = { now: 0, state: "dormant", play: null, jam: null, grindAt: null, misfireAt: null, beaconFlicker: null, beaconPulse: null, gate: 0, gateTarget: 0, lampsCyan: false };
  let pose: StageMachinePose | null = null;
  let playBase: StageMachinePose | null = null;

  // ---------------------------------------------------------------- static parts
  const drawStatic = () => {
    // the Nerve Beacon's column (the lit soma and the axon are dynamic)
    const B = PUMP.beacon;
    back.fillStyle(c.stoneShade, 0.8);
    back.fillRect(B.x - 18, B.y + 30, 36, -B.y - 30);
    back.fillStyle(c.stone, 0.8);
    back.fillRect(B.x - 18, B.y + 30, 18, -B.y - 30);
    back.fillStyle(c.navy, 0.8);
    back.fillRect(B.x - 22, B.y + 30, 44, 12);
    // the rail pipe feeding the ATP port
    back.lineStyle(16, c.goldDeep, 1);
    strokePoly(back, [{ x: PUMP.atpPort.x + 34, y: PIPE_TOP }, { x: PUMP.atpPort.x + 34, y: PUMP.atpPort.y - 46 }, { x: PUMP.atpPort.x + 10, y: PUMP.atpPort.y - 20 }]);
    back.lineStyle(8, c.gold, 1);
    strokePoly(back, [{ x: PUMP.atpPort.x + 34, y: PIPE_TOP }, { x: PUMP.atpPort.x + 34, y: PUMP.atpPort.y - 46 }, { x: PUMP.atpPort.x + 10, y: PUMP.atpPort.y - 20 }]);
    // the control plinth
    const px = PUMP.plinthX;
    const top = PUMP.socketTop - 70;
    back.fillStyle(c.navyDark, 0.25);
    back.fillEllipse(px + 10, 2, 150, 18);
    back.fillStyle(c.stoneShade, 1);
    back.fillRoundedRect(px - 50, top, 100, -top, 10);
    back.fillStyle(c.stone, 1);
    back.fillRoundedRect(px - 50, top, 62, -top, 10);
    back.fillStyle(c.navy, 1);
    back.fillRect(px - 50, top + 16, 100, 10);
    back.fillRect(px - 50, -34, 100, 10);
    back.fillStyle(c.gold, 1);
    back.fillRect(px - 54, top, 108, 8);
    // the cartridge rack: a cream frame with five bays and gold rails
    const rx = PUMP.rackX;
    const rtop = PUMP.cartridgeTop - 58;
    back.fillStyle(c.navyDark, 0.25);
    back.fillEllipse(rx + 10, 2, 150, 18);
    back.fillStyle(c.stoneDeep, 1);
    back.fillRect(rx - 60, rtop, 12, -rtop);
    back.fillRect(rx + 48, rtop, 12, -rtop);
    back.fillStyle(c.stoneShade, 1);
    back.fillRoundedRect(rx - 62, rtop, 124, 18, 6);
    back.lineStyle(4, c.gold, 1);
    for (let j = 0; j < 5; j++) {
      const y = PUMP.cartridgeTop + j * PUMP.cartridgeGap + 30;
      strokePoly(back, [{ x: rx - 54, y }, { x: rx + 54, y }]);
    }
    // the console lectern
    drawCellLectern(back, consoleLocal, c, 0.6);
  };
  drawStatic();

  // ---------------------------------------------------------------- per-frame drawing
  const leaf = (hinge: XY, pts: readonly XY[], a: number) => pts.map((p) => rotateAbout(p, hinge, a));
  const drawBody = (p: StageMachinePose, shakeX: number) => {
    const g = bodyG;
    g.clear();
    const ox = shakeX;
    const up = (JAW_OPEN_DEG * Math.PI) / 180;
    // the upper jaw (extracellular): two leaves hinged at the waist's outer top corners, splaying outward
    const hingeTopL = { x: ox - 118, y: -300 };
    const hingeTopR = { x: ox + 118, y: -300 };
    const upperL = leaf(hingeTopL, [{ x: ox - 118, y: -300 }, { x: ox - 4, y: -300 }, { x: ox - 4, y: H.top }, { x: ox - 92, y: H.top + 18 }], -up * p.jawUpper);
    const upperR = leaf(hingeTopR, [{ x: ox + 118, y: -300 }, { x: ox + 4, y: -300 }, { x: ox + 4, y: H.top }, { x: ox + 92, y: H.top + 18 }], up * p.jawUpper);
    const hingeBotL = { x: ox - 118, y: -40 };
    const hingeBotR = { x: ox + 118, y: -40 };
    const lowerL = leaf(hingeBotL, [{ x: ox - 118, y: -40 }, { x: ox - 4, y: -40 }, { x: ox - 4, y: H.bottom }, { x: ox - 92, y: H.bottom - 18 }], up * p.jawLower);
    const lowerR = leaf(hingeBotR, [{ x: ox + 118, y: -40 }, { x: ox + 4, y: -40 }, { x: ox + 4, y: H.bottom }, { x: ox + 92, y: H.bottom - 18 }], -up * p.jawLower);
    // channel glow on the open side (tide above, cytoplasm below)
    if (p.jawUpper > 0.05) {
      g.fillStyle(c.tide, 0.28 * p.jawUpper);
      fillPoly(g, [{ x: ox - 60, y: -300 }, { x: ox + 60, y: -300 }, { x: ox + 120 * p.jawUpper, y: H.top - 20 }, { x: ox - 120 * p.jawUpper, y: H.top - 20 }]);
    }
    if (p.jawLower > 0.05) {
      g.fillStyle(c.cyto, 0.3 * p.jawLower);
      fillPoly(g, [{ x: ox - 60, y: -40 }, { x: ox + 60, y: -40 }, { x: ox + 120 * p.jawLower, y: H.bottom + 20 }, { x: ox - 120 * p.jawLower, y: H.bottom + 20 }]);
    }
    for (const [pts, lit] of [[upperL, true], [upperR, false], [lowerL, true], [lowerR, false]] as const) {
      g.fillStyle(lit ? c.stone : c.stoneShade, 1);
      fillPoly(g, pts);
      g.lineStyle(4, c.goldDeep, 1);
      strokePoly(g, pts, true);
    }
    // navy inlay bands on the jaws
    g.lineStyle(8, c.navy, 1);
    strokePoly(g, [lerpXY(upperL[0]!, upperL[3]!, 0.55), lerpXY(upperL[1]!, upperL[2]!, 0.55)]);
    strokePoly(g, [lerpXY(upperR[0]!, upperR[3]!, 0.55), lerpXY(upperR[1]!, upperR[2]!, 0.55)]);
    strokePoly(g, [lerpXY(lowerL[0]!, lowerL[3]!, 0.55), lerpXY(lowerL[1]!, lowerL[2]!, 0.55)]);
    strokePoly(g, [lerpXY(lowerR[0]!, lowerR[3]!, 0.55), lerpXY(lowerR[1]!, lowerR[2]!, 0.55)]);
    // the waist: the housing ring around the drum
    g.fillStyle(c.stoneShade, 1);
    g.fillRoundedRect(ox - H.halfW, -312, 2 * H.halfW, 284, 26);
    g.fillStyle(c.stone, 1);
    g.fillRoundedRect(ox - H.halfW, -312, H.halfW + 30, 284, 26);
    g.fillStyle(c.navy, 1);
    g.fillRect(ox - H.halfW, -300, 2 * H.halfW, 12);
    g.fillRect(ox - H.halfW, -52, 2 * H.halfW, 12);
    g.lineStyle(4, c.gold, 1);
    g.strokeRoundedRect(ox - H.halfW, -312, 2 * H.halfW, 284, 26);
    // the drum: bronze ring, dark core, six detents that turn 60° per stage
    const d = { x: drumC.x + ox, y: drumC.y };
    g.fillStyle(c.navyDark, 1);
    g.fillCircle(d.x, d.y, PUMP.drum.r + 8);
    g.lineStyle(16, c.bronze, 1);
    g.strokeCircle(d.x, d.y, PUMP.drum.r);
    g.lineStyle(3, c.goldHi, 0.9);
    g.strokeCircle(d.x, d.y, PUMP.drum.r + 9);
    for (let i = 0; i < 6; i++) {
      const a = p.drumAngle + (i * Math.PI) / 3 - Math.PI / 2;
      g.fillStyle(c.goldHi, 1);
      g.fillCircle(d.x + Math.cos(a) * PUMP.drum.r, d.y + Math.sin(a) * PUMP.drum.r, 6);
    }
    // the drum's ion sockets: one arc per loaded ion group (lit rings show "loaded")
    for (const l of p.loads) {
      if (l.kind !== "ions") continue;
      const col = moleculeColor(props.palette, l.ion === "K" ? "k" : "na");
      for (let s = 0; s < l.n; s++) {
        const slotAt = drumSlotAt(l.group, s, l.n, p.drumAngle);
        const at = { x: slotAt.x + ox, y: slotAt.y };
        g.fillStyle(c.navy, 1);
        g.fillCircle(at.x, at.y, ION_R + 3);
        g.lineStyle(3, col, 0.95);
        g.strokeCircle(at.x, at.y, ION_R + 3);
      }
    }
    // the ATP port on the flank and the crank below
    const port = { x: PUMP.atpPort.x + ox, y: PUMP.atpPort.y };
    g.fillStyle(c.goldDeep, 1);
    g.fillCircle(port.x, port.y, 24);
    g.fillStyle(mix(c.navyDark, c.atp, p.port), 1);
    g.fillCircle(port.x, port.y, 15);
    if (p.port > 0.02) {
      g.fillStyle(c.atp, 0.3 * p.port);
      g.fillCircle(port.x, port.y, 40);
    }
    const crank = { x: PUMP.crank.x + ox, y: PUMP.crank.y };
    g.fillStyle(c.stoneDeep, 1);
    g.fillCircle(crank.x, crank.y, 28);
    g.lineStyle(5, c.gold, 1);
    g.strokeCircle(crank.x, crank.y, 28);
    for (let i = 0; i < 4; i++) {
      const a = p.drumAngle * 0.5 + (i * Math.PI) / 2;
      strokePoly(g, [crank, { x: crank.x + Math.cos(a) * 26, y: crank.y + Math.sin(a) * 26 }]);
    }
  };
  const lerpXY = (a: XY, b: XY, u: number): XY => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) });

  const drawCables = (p: StageMachinePose) => {
    cablesG.clear();
    for (const cab of p.cables) {
      const a = { x: cab.a.x + 12, y: cab.a.y };
      const b = { x: cab.b.x - 52, y: cab.b.y };
      const focus = p.focusKey !== null && (p.focusKey === cab.leftKey || p.focusKey === cab.rightKey);
      strokeCable(cablesG, sagPath(a, b, cab.sag, 18), {
        ...DEFAULT_CABLE_STYLE,
        color: c.gold,
        width: 6,
        outline: { color: c.navyDark, width: 11, alpha: 0.7 },
        glow: focus ? { color: 0xffffff, width: 16, alpha: 0.25 } : null,
        plug: null,
      });
    }
  };

  const drawBeacon = (p: StageMachinePose) => {
    const g = beaconG;
    g.clear();
    const B = PUMP.beacon;
    let bright = p.beacon;
    if (dyn.beaconFlicker !== null) {
      const e = dyn.now - dyn.beaconFlicker;
      bright = e < 450 ? (Math.floor(e / 75) % 2 === 0 ? 0.5 : 0.05) : 0.03;
    }
    const soma = mix(c.stoneDeep, c.atp, bright);
    // axon: a cable curving away down the hall; a light pulse races along it when the beacon fires
    const axon: XY[] = [{ x: B.x + 20, y: B.y + 10 }, { x: B.x + 90, y: B.y + 60 }, { x: B.x + 140, y: B.y + 150 }, { x: B.x + 240, y: B.y + 190 }];
    g.lineStyle(8, mix(c.stoneDeep, c.goldHi, bright * 0.7), 1);
    strokePoly(g, axon);
    if (dyn.beaconPulse !== null) {
      const u = clamp01((dyn.now - dyn.beaconPulse) / 700);
      if (u < 1) {
        const i = Math.min(axon.length - 2, Math.floor(u * (axon.length - 1)));
        const f = u * (axon.length - 1) - i;
        const at = lerpXY(axon[i]!, axon[i + 1]!, f);
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(at.x, at.y, 10);
        g.fillStyle(c.atp, 0.4);
        g.fillCircle(at.x, at.y, 22);
      }
    }
    if (bright > 0.05) {
      g.fillStyle(c.atp, 0.22 * bright);
      g.fillCircle(B.x, B.y, 72);
    }
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.5;
      g.lineStyle(7, soma, 1);
      strokePoly(g, [{ x: B.x + Math.cos(a) * 30, y: B.y + Math.sin(a) * 30 }, { x: B.x + Math.cos(a) * 62, y: B.y + Math.sin(a) * 62 }]);
    }
    g.fillStyle(soma, 1);
    g.fillCircle(B.x, B.y, 34);
    g.fillStyle(0xffffff, 0.35 + 0.5 * bright);
    g.fillCircle(B.x - 8, B.y - 8, 9);
  };

  const drawFront = (p: StageMachinePose, shakeX: number) => {
    const g = frontG;
    g.clear();
    // sockets on the plinth: bronze rings, their kind icon, a seated plug, the white (or cyan) seated lamp
    for (const s of p.sockets) {
      const at = socketAt(s.index);
      const jam = dyn.jam && dyn.jam.socket === s.index ? dyn.now - dyn.jam.at : null;
      const jamFlash = jam !== null && jam < 700 && Math.floor(jam / 110) % 2 === 0;
      g.fillStyle(c.bronze, 1);
      g.fillCircle(at.x, at.y, 24);
      g.fillStyle(c.navyDark, 1);
      g.fillCircle(at.x, at.y, 15);
      drawSocketIcon(g, s, { x: at.x - 36, y: at.y + 2 }, c, props.palette);
      if (s.linked) {
        g.fillStyle(c.gold, 1);
        g.fillCircle(at.x + 6, at.y, 11);
        g.fillStyle(c.goldHi, 1);
        g.fillCircle(at.x + 4, at.y - 2, 5);
      }
      const lamp = dyn.lampsCyan || s.lamp === "cyan" ? CYAN : s.lamp === "white" ? SEATED_WHITE : c.navyDark;
      g.fillStyle(lamp, 1);
      g.fillCircle(at.x + 34, at.y - 18, 7);
      if (s.lamp !== "off" || dyn.lampsCyan) {
        g.fillStyle(lamp, 0.3);
        g.fillCircle(at.x + 34, at.y - 18, 14);
      }
      if (s.focus) {
        g.lineStyle(5, 0xffffff, 0.95);
        g.strokeCircle(at.x, at.y, 32);
      }
      if (jamFlash) {
        g.lineStyle(7, c.salmon, 1);
        g.strokeCircle(at.x, at.y, 34);
      }
      // the tag plate the "loaded: …" chip rides on
      const tag = tagAt(s.index);
      g.fillStyle(c.stoneLit, 1);
      g.fillRoundedRect(tag.x - 30, tag.y - 4, 60, 8, 3);
    }
    // cartridges in the rack
    for (const cart of p.cartridges) {
      drawCartridge(g, { ...cart, ...cartridgeAt(cart.index) }, c, cart.seatedIn ? 1 : 0);
      if (cart.focus) {
        g.lineStyle(5, 0xffffff, 0.95);
        g.strokeRoundedRect(cart.x - 54, cart.y - 32, 108, 64, 12);
      }
    }
    // the ledger needle on the drum hub (leans −30°·q; the "charge q" chip names it)
    const hub = { x: drumC.x + shakeX, y: drumC.y };
    g.fillStyle(c.stoneLit, 1);
    g.fillCircle(hub.x, hub.y, 30);
    g.lineStyle(3, c.navy, 1);
    g.beginPath();
    g.arc(hub.x, hub.y, 24, -Math.PI / 2 - Math.PI / 6, -Math.PI / 2 + Math.PI / 6, false);
    g.strokePath();
    const tip = { x: hub.x + Math.sin(p.needle) * 26, y: hub.y - Math.cos(p.needle) * 26 };
    g.lineStyle(5, c.navyDark, 1);
    strokePoly(g, [hub, tip]);
    g.fillStyle(c.salmon, 1);
    g.fillCircle(tip.x, tip.y, 5);
    g.fillStyle(c.gold, 1);
    g.fillCircle(hub.x, hub.y, 6);
    // what the loads do at this stage
    for (const l of p.loads) {
      if (l.kind === "ions") {
        const glyph = l.ion === "K" ? "k" : "na";
        const col = moleculeColor(props.palette, glyph);
        for (let s = 0; s < l.n; s++) {
          const at = ionPosition(l, s, p.drumAngle);
          const bump = l.blocked && l.bind > 0.35 && l.bind < 0.65;
          drawMolecule(g, glyph, at.x + shakeX, at.y, ION_R, col, c, 1);
          if (bump) drawSpark(g, { x: at.x + shakeX, y: at.y + (l.from === "out" ? 18 : -18) }, 0.6, 0xffffff, true);
        }
      } else if (l.kind === "sparks" && l.u > 0) {
        const from = { x: PUMP.atpPort.x + 34, y: PIPE_TOP + 120 };
        const to = l.into === "port" ? { x: PUMP.atpPort.x, y: PUMP.atpPort.y } : { x: drumC.x + 40, y: drumC.y + 20 };
        for (let s = 0; s < Math.max(1, l.n); s++) {
          const u = clamp01(l.u * 1.1 - s * 0.1);
          if (u <= 0) continue;
          const at = u < 0.55 ? lerpXY(from, { x: PUMP.atpPort.x + 34, y: PUMP.atpPort.y - 46 }, u / 0.55) : lerpXY({ x: PUMP.atpPort.x + 34, y: PUMP.atpPort.y - 46 }, to, (u - 0.55) / 0.45);
          if (l.into === "drum" && u >= 1) drawSpark(g, { x: to.x + shakeX, y: to.y }, 0.7, 0xb9c2c6, true);
          else drawAtpSpark(g, at.x + shakeX, at.y, 14, c, u >= 1 && l.into === "port" ? 0.6 : 1, dyn.now / 300);
        }
      } else if (l.kind === "stray" && l.u > 0) {
        for (let s = 0; s < Math.max(1, l.n); s++) {
          const home = { x: 170, y: -210 + s * 34 };
          const at = lerpXY(home, { x: drumC.x + 70, y: drumC.y + (s - (l.n - 1) / 2) * 30 }, 0.85 * Math.sin(Math.PI * l.u));
          drawMolecule(g, null, at.x + shakeX, at.y, 12, c.headLit, c, 0.9);
        }
      } else if (l.kind === "signal" && l.u > 0 && l.u < 1) {
        const at = socketAt(l.socketIndex);
        g.lineStyle(3, c.tide, 0.6 * Math.sin(Math.PI * l.u));
        g.strokeCircle(at.x, at.y, 30 + 10 * l.u);
      }
    }
    // the energy misfire: a grey fizzle at the port
    if (dyn.misfireAt !== null) {
      const e = dyn.now - dyn.misfireAt;
      if (e < 600) drawSpark(g, { x: PUMP.atpPort.x + shakeX, y: PUMP.atpPort.y }, 1 - e / 600, 0xb9c2c6, true);
    }
    // the Hall Gate on the floor and the chain from the crank
    if (gateAt) {
      const lift = dyn.gate * GATE.lift;
      const gx = gateAt.x;
      const gy = gateAt.y - lift;
      g.lineStyle(4, c.stoneDeep, 0.9);
      const crank = { x: PUMP.crank.x + shakeX, y: PUMP.crank.y };
      const hook = { x: gx - GATE.w / 2 + 10, y: gy - GATE.h };
      const n = 14;
      for (let i = 0; i < n; i += 2) strokePoly(g, [lerpXY(crank, hook, i / n), lerpXY(crank, hook, (i + 1) / n)]);
      g.fillStyle(c.stoneShade, 1);
      g.fillRect(gx - GATE.w / 2 - 14, gateAt.y - GATE.h - 30, 14, GATE.h + 30);
      g.fillRect(gx + GATE.w / 2, gateAt.y - GATE.h - 30, 14, GATE.h + 30);
      g.fillStyle(c.stone, 1);
      g.fillRect(gx - GATE.w / 2, gy - GATE.h, GATE.w, 16);
      g.fillRect(gx - GATE.w / 2, gy - 18, GATE.w, 16);
      for (let i = 0; i < 5; i++) {
        const bx = gx - GATE.w / 2 + 12 + i * ((GATE.w - 24) / 4);
        g.fillStyle(i % 2 === 0 ? c.stoneLit : c.stoneShade, 1);
        g.fillRect(bx - 6, gy - GATE.h + 10, 12, GATE.h - 20);
      }
      g.fillStyle(c.navy, 1);
      g.fillRect(gx - GATE.w / 2, gy - GATE.h / 2 - 6, GATE.w, 10);
    }
  };

  const displayPose = (): StageMachinePose | null => {
    if (!pose) return null;
    if (!dyn.play) return pose;
    const k = playbackK(dyn.now - dyn.play.start, dyn.play.fromK, dyn.play.toK, dyn.play.ms, dyn.play.cycles);
    return withStage(playBase ?? pose, config, view, k);
  };
  const redraw = () => {
    const p = displayPose();
    if (!p) return;
    const shakeX = dyn.grindAt !== null && !reduced ? shakeOffset(dyn.now - dyn.grindAt, 3, 300) : 0;
    drawBeacon(p);
    drawCables(p);
    drawBody(p, shakeX);
    drawFront(p, shakeX);
  };

  const anchors: Record<string, XY> & { console: XY } = {
    console: consoleLocal,
    drum: { ...drumC },
    atp_port: { x: PUMP.atpPort.x, y: PUMP.atpPort.y },
    beacon: { x: PUMP.beacon.x, y: PUMP.beacon.y - 70 },
    crank: { x: PUMP.crank.x, y: PUMP.crank.y },
    gate: gateAt ? { x: gateAt.x, y: gateAt.y - GATE.h } : { x: PUMP.crank.x, y: PUMP.crank.y },
  };
  for (let i = 0; i < 4; i++) {
    anchors[`socket_${i}`] = socketAt(i);
    anchors[`tag_${i}`] = tagAt(i);
  }
  for (let j = 0; j < 5; j++) anchors[`cartridge_${j}`] = cartridgeAt(j);

  const pv: PoseView<StageMachinePose> = {
    root,
    anchors,
    applyPose(p: StageMachinePose) {
      pose = p;
      dyn.gateTarget = Math.max(dyn.gateTarget, p.gate);
      if (p.solved) dyn.lampsCyan = true;
      if (dyn.play === null) redraw();
    },
    setState(state: ContraptionState) {
      dyn.state = state;
      try {
        props.fx.dormancy(root, state === "dormant");
      } catch {
        root.setAlpha(state === "dormant" ? 0.75 : 1);
      }
    },
    async playFail(plan: FailurePlan, p: StageMachinePose) {
      pose = pose ?? p;
      playBase = pose;
      const run = plan.beats.find((b) => b.anchor === "drum" && b.action === "stall");
      const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
      if (run) {
        const fromK = num(run.params?.fromK, config.stages.min);
        const toK = num(run.params?.toK, config.stages.min);
        dyn.play = { start: dyn.now, fromK, toK, ms: reduced ? 1 : num(run.params?.msPerStage, 170), cycles: 1 };
      }
      for (const b of plan.beats) {
        timers.later(reduced ? 0 : b.atMs, () => {
          if (b.action === "grind") dyn.grindAt = dyn.now;
          else if (b.action === "jam") {
            const m = /^socket_(\d+)$/.exec(b.anchor);
            if (m) dyn.jam = { socket: Number(m[1]), at: dyn.now };
          } else if (b.action === "spark" && b.anchor === "atp_port") dyn.misfireAt = dyn.now;
          else if (b.action === "flash" && b.anchor === "beacon") dyn.beaconFlicker = dyn.now;
          else if (b.action === "flash" && b.anchor.startsWith("socket_")) dyn.jam = { socket: Number(b.anchor.slice(7)), at: dyn.now };
        });
      }
      await timers.wait(reduced ? 300 : Math.min(1600, plan.durationMs));
      if (!alive) return;
      dyn.play = null;
      playBase = null;
      dyn.jam = null;
      dyn.grindAt = null;
      dyn.misfireAt = null;
      dyn.beaconFlicker = null;
      redraw();
    },
    async playSucceed(plan: SuccessPlan, solved: StageMachinePose) {
      playBase = pose ?? solved;
      const cycle = plan.beats.find((b) => b.anchor === "drum" && b.action === "cycle");
      const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
      if (cycle && !reduced) {
        dyn.play = {
          start: dyn.now,
          fromK: num(cycle.params?.fromK, config.stages.min),
          toK: num(cycle.params?.toK, config.stages.max),
          ms: num(cycle.params?.msPerStage, 170),
          cycles: num(cycle.params?.cycles, 2),
        };
      }
      for (const b of plan.beats) {
        timers.later(reduced ? 0 : b.atMs, () => {
          if (b.anchor === "crank" && b.action === "rise") dyn.gateTarget = Math.max(dyn.gateTarget, num(b.params?.gate, 1));
          else if (b.anchor === "beacon" && b.action === "ignite") {
            dyn.beaconPulse = dyn.now;
            dyn.lampsCyan = true;
          } else if (b.anchor === "gate") dyn.gateTarget = 1;
        });
      }
      await timers.wait(reduced ? 0 : plan.durationMs);
      if (!alive) return;
      dyn.play = null;
      playBase = null;
      dyn.gateTarget = 1;
      dyn.lampsCyan = true;
      pv.applyPose(solved);
    },
    update(dtMs: number) {
      if (!alive) return;
      const dt = Math.max(0, dtMs);
      dyn.now += dt;
      dyn.gate = reduced ? dyn.gateTarget : lerp(dyn.gate, dyn.gateTarget, smoothingFactor(dt, 260));
      if (dyn.beaconPulse !== null && dyn.now - dyn.beaconPulse > 900) dyn.beaconPulse = null;
      redraw();
    },
    destroy() {
      alive = false;
      timers.clear();
      root.destroy(true);
    },
  };
  return pv;
}

export const skin: SkinPrefab<StageMachineConfig, StageMachinePose> = {
  skinId: "pump_rewiring",
  create(scene, _phaser, props) {
    return createPumpView(scene, props);
  },
};
export default skin;
