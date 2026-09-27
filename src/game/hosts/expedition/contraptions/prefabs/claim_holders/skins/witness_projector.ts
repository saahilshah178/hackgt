/**
 * claim_holders · skin witness_projector (civil e1 and e4; §4.3 slots arc_lamp, pendant_lamp, witness_lens,
 * projection_panel, retract_stamp, steps, menu_board, console). KC3. Self-contained: it reads only the claim_holders
 * meta (Pose, AIM_RIGS) so it never depends on the core's shared.ts.
 *
 * Two aimers (config.aimer):
 *  - `arc_lamp` (e1, Courthouse Square): the Proof Lamp on a brass swivel stand turns (pose.aimAngle, world angle) and
 *    lights one of three Witness Lenses fanned out on a bracket; the lit lens throws its slide onto its projection panel
 *    between the courthouse columns. The courthouse steps (the payoff terrain) wait as a wireframe.
 *  - `pendant_lamp` (e4, the lunch counter): the counter's swivel pendant lamp swings on its cord (a damped spring over
 *    the eased swing angle: it feels hung) and pools its light on one of the menu board's three panels.
 *
 * Live: aim/hover moves the lamp; the aimed panel brightens (1.0 vs 0.65) and scales 1.06; its slug re-types at
 * 45 chars/s (ink bars; the claim words are DOM). Success (quarantineAnim retract_stamp): the lamp flares, RETRACTED is
 * stamped on the false slide, the slide ejects and flutters down, the true panels merge into one steady projection, a
 * printing sweep runs and the steps turn solid (e1) or the console prints (e4). Failure: the picked (honest) panel
 * holds steady and brighter, its lens gives one calm pulse, the lamp dips once. sensitiveSafe: no shake, no bursts.
 */
import type Phaser from "phaser";
import type { ClaimHoldersConfig } from "@/world/contraptions/claim-holders.config";
import { AIM_RIGS, holderPos, type AimRig, type ClaimHoldersPose } from "@/world/contraptions/claim-holders.meta";
import { clamp01 } from "@/world/ease";
import type { FailBeat, FailurePlan, SuccessBeat, SuccessPlan } from "@/world/types";
import { withRecordLens } from "../../../accessories/record-lens";
import type { ContraptionState, PoseView, PrefabProps, SkinPrefab, XY } from "../../../types";
import {
  anchorIndex,
  BLEND_ADD,
  beatClock,
  civilColors,
  drawBeam,
  drawConsoleReader,
  drawCone,
  drawPaper,
  drawShadow,
  drawStamp,
  fillPoly,
  localGround,
  mix,
  numParam,
  rotRect,
  springStep,
  stairSteps,
  typedCount,
  type CivilColors,
  type Spring,
  type StepRect,
} from "../../oracle_ticker/civil-kit";

type G = Phaser.GameObjects.Graphics;
type Props = PrefabProps<ClaimHoldersConfig>;

const ARC = { panelW: 176, panelH: 236, lensAt: 0.5, headLen: 78 } as const;
const PENDANT = { panelW: 200, panelH: 150, shadeR: 34, k: 40, zeta: 0.45 } as const;
const SLUG_CHARS = 60;

// ---------------------------------------------------------------- pure-ish geometry helpers (local to the skin)

function lensPos(rig: AimRig, n: number, i: number): XY {
  const p = holderPos(rig, n, i);
  return { x: rig.aimer.x + (p.x - rig.aimer.x) * ARC.lensAt, y: rig.aimer.y + (p.y - rig.aimer.y) * ARC.lensAt };
}
function pendantLamp(rig: AimRig, theta: number): XY {
  const cord = rig.cord ?? 300;
  return { x: rig.aimer.x + Math.sin(theta) * cord, y: rig.aimer.y + Math.cos(theta) * cord };
}
/** Where a turning aimer's beam meets the row line y = holderY (for the searching sweep and the aimed panel). */
function beamEnd(rig: AimRig, angle: number): XY {
  const s = Math.sin(angle);
  const t = Math.abs(s) < 1e-3 ? 400 : (rig.holderY - rig.aimer.y) / s;
  const len = Math.max(60, Math.min(900, t));
  return { x: rig.aimer.x + Math.cos(angle) * len, y: rig.aimer.y + Math.sin(angle) * len };
}

// ---------------------------------------------------------------- drawing

function drawPanel(g: G, glow: G, at: XY, w: number, h: number, bright: number, scale: number, slug: number, c: CivilColors, dark: number, menu: boolean): void {
  const W = w * scale;
  const H = h * scale;
  g.fillStyle(menu ? mix(c.bronze, c.ink, 0.3) : c.brassDeep, 1);
  g.fillRect(at.x - W / 2 - 8, at.y - H / 2 - 8, W + 16, H + 16);
  if (!menu) {
    g.fillStyle(c.brass, 1);
    g.fillRect(at.x - W / 2 - 4, at.y - H / 2 - 4, W + 8, 4);
  }
  const screen = mix(mix(c.paperAged, c.ink, 0.35), c.paper, clamp01(bright) * (1 - dark));
  g.fillStyle(screen, 1);
  g.fillRect(at.x - W / 2, at.y - H / 2, W, H);
  if (bright > 0.01 && dark < 0.99) {
    glow.fillStyle(c.lamp, 0.16 * bright * (1 - dark));
    glow.fillRect(at.x - W / 2 - 10, at.y - H / 2 - 10, W + 20, H + 20);
  }
  // the newspaper slug: a heavy headline bar and body lines, typed in (the words are DOM)
  if (slug > 0 && dark < 0.99) {
    const a = 0.85 * (1 - dark);
    const lines = menu ? 3 : 5;
    g.fillStyle(c.ink, a);
    const head = Math.min(1, slug * lines);
    g.fillRect(at.x - W * 0.38, at.y - H * 0.34, W * 0.76 * head, H * (menu ? 0.12 : 0.08));
    for (let i = 1; i < lines; i++) {
      const k = clamp01(slug * lines - i);
      if (k <= 0) continue;
      g.fillRect(at.x - W * 0.38, at.y - H * 0.16 + (i - 1) * H * (menu ? 0.2 : 0.13), W * (i === lines - 1 ? 0.45 : 0.72) * k, Math.max(4, H * 0.035));
    }
  }
}

function drawLens(g: G, glow: G, at: XY, angle: number, lit: number, pulseK: number, c: CivilColors): void {
  const box = rotRect(at.x, at.y, 64, 42, angle);
  g.fillStyle(c.ink, 0.35);
  fillPoly(g, rotRect(at.x + 4, at.y + 5, 64, 42, angle));
  g.fillStyle(mix(c.bronze, c.ink, 0.25), 1);
  fillPoly(g, box);
  g.fillStyle(c.brass, 1);
  fillPoly(g, rotRect(at.x, at.y, 52, 30, angle));
  const tip = { x: at.x + Math.cos(angle) * 40, y: at.y + Math.sin(angle) * 40 };
  g.fillStyle(c.brassDeep, 1);
  fillPoly(g, rotRect(at.x + Math.cos(angle) * 30, at.y + Math.sin(angle) * 30, 22, 28, angle));
  g.fillStyle(mix(c.lensDormant, c.lamp, lit), 1);
  g.fillCircle(tip.x, tip.y, 11);
  if (lit > 0.01) {
    glow.fillStyle(c.lamp, 0.35 * lit);
    glow.fillCircle(tip.x, tip.y, 26);
  }
  if (pulseK > 0.01) {
    g.lineStyle(4, 0xffffff, 0.8 * pulseK);
    g.strokeCircle(at.x, at.y, 36 + 40 * (1 - pulseK));
  }
}

function drawArcLamp(g: G, glow: G, pivot: XY, groundY: number, angle: number, flare: number, dip: number, c: CivilColors): XY {
  drawShadow(g, pivot.x, groundY, 90, c);
  g.fillStyle(c.brassDeep, 1);
  g.fillRoundedRect(pivot.x - 40, groundY - 14, 80, 14, 5);
  g.fillStyle(mix(c.bronze, c.ink, 0.2), 1);
  g.fillRect(pivot.x - 8, pivot.y, 16, groundY - 14 - pivot.y);
  g.fillStyle(c.brass, 1);
  g.fillRect(pivot.x - 8, pivot.y, 6, groundY - 14 - pivot.y);
  // the yoke and the lamp housing along the aim angle
  g.fillStyle(c.brassDeep, 1);
  g.fillCircle(pivot.x, pivot.y, 14);
  const head = rotRect(pivot.x + Math.cos(angle) * 22, pivot.y + Math.sin(angle) * 22, ARC.headLen, 46, angle);
  g.fillStyle(mix(c.navy, c.ink, 0.3), 1);
  fillPoly(g, head);
  g.fillStyle(c.brass, 1);
  fillPoly(g, rotRect(pivot.x + Math.cos(angle) * 22, pivot.y + Math.sin(angle) * 22, ARC.headLen - 12, 8, angle));
  const tip = { x: pivot.x + Math.cos(angle) * (22 + ARC.headLen / 2), y: pivot.y + Math.sin(angle) * (22 + ARC.headLen / 2) };
  const lit = clamp01(1 - 0.5 * dip);
  g.fillStyle(mix(c.lamp, 0xffffff, flare), lit);
  fillPoly(g, rotRect(tip.x, tip.y, 8, 40, angle));
  glow.fillStyle(c.lamp, (0.3 + 0.5 * flare) * lit);
  glow.fillCircle(tip.x, tip.y, 26 + 24 * flare);
  return tip;
}

function drawPendant(g: G, glow: G, mount: XY, lamp: XY, aim: number, flare: number, dip: number, c: CivilColors): XY {
  g.fillStyle(c.brassDeep, 1);
  g.fillEllipse(mount.x, mount.y, 70, 18);
  g.lineStyle(3, c.ink, 0.9);
  g.beginPath();
  g.moveTo(mount.x, mount.y);
  g.lineTo(lamp.x, lamp.y);
  g.strokePath();
  // the enamel shade, swivelled toward its target
  const shade = [
    { x: -14, y: -10 },
    { x: 14, y: -10 },
    { x: PENDANT.shadeR, y: 26 },
    { x: -PENDANT.shadeR, y: 26 },
  ];
  const rot = aim - Math.PI / 2;
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const tf = (p: XY) => ({ x: lamp.x + p.x * cs - p.y * sn, y: lamp.y + p.x * sn + p.y * cs });
  g.fillStyle(c.navy, 1);
  fillPoly(g, shade.map(tf));
  g.fillStyle(c.brass, 1);
  fillPoly(g, [shade[2]!, shade[3]!, { x: -PENDANT.shadeR, y: 22 }, { x: PENDANT.shadeR, y: 22 }].map(tf));
  const bulb = tf({ x: 0, y: 24 });
  const lit = clamp01(1 - 0.5 * dip);
  g.fillStyle(mix(c.lamp, 0xffffff, flare), lit);
  g.fillCircle(bulb.x, bulb.y, 10);
  glow.fillStyle(c.lamp, (0.3 + 0.5 * flare) * lit);
  glow.fillCircle(bulb.x, bulb.y, 30 + 20 * flare);
  return bulb;
}

function drawStepsWire(g: G, steps: readonly StepRect[], solid: number, sweep: number | null, c: CivilColors): void {
  if (steps.length === 0) return;
  const k = clamp01(solid);
  const x0 = steps[0]!.x;
  const x1 = steps[steps.length - 1]!.x + steps[steps.length - 1]!.w;
  for (const r of steps) {
    const f = clamp01(k * (steps.length + 1) - steps.indexOf(r) * ((steps.length + 1) / steps.length));
    if (f > 0.01) {
      g.fillStyle(c.stone, f);
      g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle(c.stoneLit, f);
      g.fillRect(r.x, r.y, r.w, 6);
      g.fillStyle(c.stoneShade, f);
      g.fillRect(r.x, r.y + r.h - 8, r.w, 8);
    }
    if (f < 0.99) {
      g.lineStyle(2, c.cyanHi, 0.45 * (1 - f));
      g.strokeRect(r.x, r.y, r.w, r.h);
    }
  }
  if (sweep !== null && sweep > 0 && sweep < 1) {
    const x = x0 + (x1 - x0) * sweep;
    g.fillStyle(c.cyan, 0.5);
    g.fillRect(x - 6, Math.min(...steps.map((s) => s.y)) - 30, 12, 60 + Math.max(...steps.map((s) => s.y + s.h)) - Math.min(...steps.map((s) => s.y)));
  }
}

function drawRope(g: G, at: XY, lowered: number, c: CivilColors): void {
  const drop = 90 * clamp01(lowered);
  for (const dx of [-60, 60]) {
    g.fillStyle(c.brassDeep, 1);
    g.fillRect(at.x + dx - 5, at.y - 96 + drop, 10, 96 - drop);
    g.fillStyle(c.brass, 1);
    g.fillCircle(at.x + dx, at.y - 100 + drop, 9);
    g.fillRoundedRect(at.x + dx - 18, at.y - 8, 36, 8, 3);
  }
  if (lowered < 0.98) {
    g.lineStyle(7, c.brick, 1 - lowered);
    g.beginPath();
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const x = at.x - 60 + 120 * t;
      const y = at.y - 92 + drop + 26 * 4 * t * (1 - t);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
  }
}

// ---------------------------------------------------------------- the view

interface Fx {
  flare: number; // lamp flare 0…1 (success)
  dip: number; // lamp dip 0…1 (failure)
  hold: Map<number, number>; // slot → ms of "holds steady and brighter"
  pulse: Map<number, number>; // slot → 0…1 calm pulse
  stamp: Map<number, number>; // slot → stamp alpha
  eject: Map<number, number>; // slot → 0…1 slide fluttering down
  merge: number; // 0…1 the true panels merge
  sweep: number | null; // printing sweep 0…1
  rise: number | null; // steps turning solid 0…1
}

export function createWitnessProjectorView(scene: Phaser.Scene, props: Props): PoseView<ClaimHoldersPose> {
  const c = civilColors(props.palette);
  const config = props.config;
  const pendant = config.aimer === "pendant_lamp";
  const rig = AIM_RIGS[pendant ? "pendant_lamp" : "arc_lamp"];
  const anchor = props.station.anchor;
  const ground = localGround(scene, props);
  const reduced = props.reducedMotion;
  const chests = (props.view as { chests?: unknown } | null)?.chests;
  const n0 = Array.isArray(chests) && chests.length > 0 ? chests.length : config.holders.length;
  const consoleLocal = { x: props.station.consoleX - anchor.x, y: ground(props.station.consoleX - anchor.x, props.station.consoleSurface) };

  const root = scene.add.container(anchor.x, anchor.y);
  const back = scene.add.graphics();
  const stepsG = scene.add.graphics();
  const dyn = scene.add.graphics();
  const glow = scene.add.graphics();
  glow.setBlendMode(BLEND_ADD);
  root.add([back, stepsG, dyn, glow]);

  // payoff steps (e1): the first payoff terrain polyline, container-local, drawn UNDER the walking line
  const terrain = props.station.payoff.terrain[0]?.points ?? [];
  const steps = props.station.payoff.anim === "stairs_rise" ? stairSteps(terrain.map(([x, y]) => [x - anchor.x, y - anchor.y] as const)) : [];
  const blocker = props.station.payoff.blocker;
  const ropeAt = blocker && blocker.asset === null ? { x: blocker.x - anchor.x, y: ground(blocker.x - anchor.x) } : null;

  // static parts
  if (pendant) {
    // the menu board: an oak board with a brass cornice holding the panels
    const half = (rig.spacing * (n0 - 1)) / 2 + PENDANT.panelW / 2 + 40;
    back.fillStyle(mix(c.bronze, c.ink, 0.45), 1);
    back.fillRoundedRect(-half, rig.holderY - PENDANT.panelH / 2 - 44, 2 * half, PENDANT.panelH + 88, 10);
    back.fillStyle(c.bronze, 1);
    back.fillRoundedRect(-half + 8, rig.holderY - PENDANT.panelH / 2 - 36, 2 * half - 16, PENDANT.panelH + 72, 8);
    back.fillStyle(c.brass, 1);
    back.fillRect(-half - 10, rig.holderY - PENDANT.panelH / 2 - 52, 2 * half + 20, 12);
    // the hidden projector booth grille above
    back.fillStyle(c.navyDark, 1);
    back.fillRoundedRect(-80, rig.holderY - PENDANT.panelH / 2 - 100, 160, 34, 6);
    back.fillStyle(c.brassDeep, 1);
    for (let i = 0; i < 6; i++) back.fillRect(-70 + i * 26, rig.holderY - PENDANT.panelH / 2 - 94, 14, 22);
  } else {
    // the projector bracket: an arc of brass from the stand to the three lenses
    const ls = Array.from({ length: n0 }, (_, i) => lensPos(rig, n0, i));
    back.lineStyle(10, c.brassDeep, 1);
    back.beginPath();
    back.moveTo(ls[0]!.x - 30, ls[0]!.y + 26);
    back.lineTo(ls[ls.length - 1]!.x + 30, ls[ls.length - 1]!.y + 26);
    back.strokePath();
    for (const dx of [ls[0]!.x - 30, ls[ls.length - 1]!.x + 30]) {
      back.fillStyle(c.brassDeep, 1);
      back.fillRect(dx - 5, ls[0]!.y + 26, 10, ground(dx) - (ls[0]!.y + 26));
      back.fillRoundedRect(dx - 22, ground(dx) - 10, 44, 10, 4);
    }
  }
  const slots = Array.from({ length: Math.max(n0, 3) }, (_, i) => i);
  const anchors: Record<string, XY> & { console: XY } = {
    console: consoleLocal,
    lamp_pivot: { ...rig.aimer },
    steps: steps.length ? { x: (steps[0]!.x + steps[steps.length - 1]!.x) / 2, y: steps[Math.floor(steps.length / 2)]!.y } : { ...consoleLocal },
    payoff: steps.length ? { x: steps[0]!.x + 120, y: steps[0]!.y } : { ...consoleLocal },
  };
  for (const i of slots) {
    const p = holderPos(rig, n0, i);
    anchors[`panel_${i}`] = p;
    anchors[`lens_${i}`] = pendant ? p : lensPos(rig, n0, i);
  }

  let pose: ClaimHoldersPose | null = null;
  let state: ContraptionState = "dormant";
  let destroyed = false;
  let now = 0;
  let aimedSince = 0;
  let lastAimed: number | null = null;
  let swing: Spring = { x: 0, v: 0 };
  const fx: Fx = { flare: 0, dip: 0, hold: new Map(), pulse: new Map(), stamp: new Map(), eject: new Map(), merge: 0, sweep: null, rise: null };
  const clock = beatClock(scene, reduced, () => !destroyed);

  const redraw = () => {
    if (!pose) return;
    dyn.clear();
    glow.clear();
    stepsG.clear();
    const n = Math.max(1, pose.n || n0);
    const aimed = pose.aimed;
    const typed = aimed === null ? 0 : typedCount(SLUG_CHARS, now - aimedSince, 45, reduced) / SLUG_CHARS;
    // steps and the rope (e1)
    drawStepsWire(stepsG, steps, Math.max(pose.gate, fx.rise ?? 0), fx.sweep, c);
    if (ropeAt) drawRope(dyn, ropeAt, Math.max(pose.gate, fx.rise ?? 0), c);
    // panels
    for (let i = 0; i < n; i++) {
      const p = holderPos(rig, n, i);
      const holding = (fx.hold.get(i) ?? 0) > 0;
      const glowK = pose.holderGlow[i] ?? 0.8;
      const bright = holding ? 1.25 : glowK * (1 + 0.4 * fx.merge * (i === pose.committed ? 0 : 1));
      const scale = aimed === i && !pose.solved ? 1.06 : 1;
      // the false slide has ejected: its panel goes blank (dim) under the RETRACTED stamp
      const dark = fx.eject.has(i) ? 0.55 * clamp01(fx.eject.get(i) ?? 0) : pose.quarantined === i ? 0.55 : 0;
      const slug = aimed === i ? typed : pose.solved ? 1 : 0.35;
      drawPanel(dyn, glow, p, pendant ? PENDANT.panelW : ARC.panelW, pendant ? PENDANT.panelH : ARC.panelH, bright, scale, slug, c, dark, pendant);
      const st = fx.stamp.get(i) ?? (pose.quarantined === i ? 1 : 0);
      if (st > 0) drawStamp(dyn, p.x, p.y, (pendant ? PENDANT.panelW : ARC.panelW) * 0.78, 46, -8, c.salmon, st);
    }
    // the merged projection of the true panels (success)
    if (fx.merge > 0.01 || pose.solved) {
      const k = pose.solved ? 1 : fx.merge;
      const xs = Array.from({ length: n }, (_, i) => i).filter((i) => i !== pose!.committed && i !== pose!.quarantined).map((i) => holderPos(rig, n, i).x);
      if (xs.length > 0) {
        const w = (pendant ? PENDANT.panelW : ARC.panelW) + 20;
        glow.fillStyle(c.lamp, 0.12 * k);
        glow.fillRect(Math.min(...xs) - w / 2, rig.holderY - (pendant ? PENDANT.panelH : ARC.panelH) / 2 - 12, Math.max(...xs) - Math.min(...xs) + w, (pendant ? PENDANT.panelH : ARC.panelH) + 24);
      }
    }
    if (pendant) {
      const mount = rig.aimer;
      const lamp = pendantLamp(rig, swing.x);
      const target = aimed !== null ? holderPos(rig, n, aimed) : { x: lamp.x, y: lamp.y + 200 };
      const aim = Math.atan2(target.y - lamp.y, target.x - lamp.x);
      const bulb = drawPendant(dyn, glow, mount, lamp, aim, fx.flare, fx.dip, c);
      if (pose.beam > 0.01 && aimed !== null) drawCone(glow, bulb, target, 14, (PENDANT.panelW / 2) * 0.9, c.lamp, 0.6 * pose.beam * (1 - 0.5 * fx.dip));
      // lamp_pivot stays on the ceiling mount: the aim chip hangs there instead of covering the swinging lamp
    } else {
      // lenses and the projector light they throw
      for (let i = 0; i < n; i++) {
        const lp = lensPos(rig, n, i);
        const p = holderPos(rig, n, i);
        const ang = Math.atan2(p.y - lp.y, p.x - lp.x);
        const lit = pose.solved ? (i === pose.quarantined ? 0 : 0.8) : aimed === i ? pose.beam : 0.15;
        const ejecting = fx.eject.get(i);
        if (lit > 0.02) drawCone(glow, { x: lp.x + Math.cos(ang) * 40, y: lp.y + Math.sin(ang) * 40 }, p, 10, ARC.panelW * 0.46, c.lamp, 0.45 * lit);
        drawLens(dyn, glow, lp, ang, lit, fx.pulse.get(i) ?? 0, c);
        if (ejecting !== undefined && ejecting < 1) {
          // the false slide ejects from its lens and flutters down
          const fall = ejecting;
          const sx = lp.x + 26 * Math.sin(fall * 9) * (1 - fall * 0.3);
          const sy = lp.y + (ground(lp.x) - 16 - lp.y) * fall * fall;
          drawPaper(dyn, sx, sy, 40, 30, c, { rot: 0.6 * Math.sin(fall * 11), lines: 2, alpha: 1 });
        }
      }
      const tip = drawArcLamp(dyn, glow, rig.aimer, ground(rig.aimer.x), pose.aimAngle, fx.flare, fx.dip, c);
      if (pose.beam > 0.01) {
        const end = aimed !== null ? lensPos(rig, n, aimed) : beamEnd(rig, pose.aimAngle);
        drawBeam(glow, tip, end, c.lamp, pose.beam * (1 - 0.5 * fx.dip), 0.8);
      }
    }
    drawConsoleReader(dyn, consoleLocal, c, state === "active" ? 1 : state === "awake" ? 0.4 : pose.solved ? 0.6 : 0);
  };

  const holderSlot = (b: { anchor: string; params?: Readonly<Record<string, number | string>> }): number | null =>
    anchorIndex(b.anchor, rig.surfaceAnchor) ?? anchorIndex(b.anchor, rig.holderAnchor) ?? (typeof b.params?.slot === "number" ? b.params.slot : null);

  const view: PoseView<ClaimHoldersPose> = {
    root,
    anchors,
    applyPose(p: ClaimHoldersPose) {
      if (p.aimed !== lastAimed) {
        lastAimed = p.aimed;
        aimedSince = now;
      }
      pose = p;
    },
    setState(s: ContraptionState) {
      state = s;
      try {
        props.fx.dormancy(root, s === "dormant");
      } catch {
        root.setAlpha(s === "dormant" ? 0.7 : 1);
      }
    },
    async playSucceed(plan: SuccessPlan, p: ClaimHoldersPose) {
      for (const b of plan.beats as readonly SuccessBeat[]) {
        const slot = holderSlot(b);
        clock.later(b.atMs, () => {
          if (b.action === "ignite" && b.anchor === rig.aimAnchor) fx.flare = 1;
          else if (b.action === "stamp" && slot !== null) fx.stamp.set(slot, 0.01);
          else if (b.action === "lower" && slot !== null) fx.eject.set(slot, 0);
          else if (b.action === "light_sequence") fx.merge = Math.max(fx.merge, 0.01);
          else if (b.action === "print") fx.sweep = 0;
          else if (b.action === "rise" || b.action === "open") fx.rise = 0;
        });
      }
      await clock.wait(plan.durationMs);
      if (destroyed) return;
      fx.sweep = null;
      fx.rise = null;
      fx.merge = 0;
      fx.stamp.clear();
      fx.eject.clear();
      view.applyPose(p);
    },
    async playFail(plan: FailurePlan, p: ClaimHoldersPose) {
      for (const b of plan.beats as readonly FailBeat[]) {
        const slot = holderSlot(b);
        clock.later(b.atMs, () => {
          if (b.action === "hold_bright" && slot !== null) fx.hold.set(slot, numParam(b, "holdMs", 2000));
          else if (b.action === "flash" && slot !== null) fx.pulse.set(slot, 1);
          else if (b.action === "dim") fx.dip = 1;
        });
      }
      await clock.wait(Math.min(1600, plan.durationMs));
      if (destroyed) return;
      view.applyPose(pose ?? p); // the lamp stays aimed so the player can re-aim
    },
    update(dtMs: number) {
      if (destroyed) return;
      const dt = Math.max(0, dtMs);
      now += dt;
      const k = reduced ? 1e9 : dt;
      if (pose && pendant) swing = reduced ? { x: pose.aimAngle, v: 0 } : springStep(swing, pose.aimAngle, dt, PENDANT.k, PENDANT.zeta);
      fx.flare = Math.max(0, fx.flare - k / 900);
      fx.dip = Math.max(0, fx.dip - k / 350);
      for (const [i, ms] of fx.hold) {
        if (ms - dt <= 0) fx.hold.delete(i);
        else fx.hold.set(i, ms - dt);
      }
      for (const [i, v] of fx.pulse) {
        if (v - k / 700 <= 0) fx.pulse.delete(i);
        else fx.pulse.set(i, v - k / 700);
      }
      for (const [i, v] of fx.stamp) fx.stamp.set(i, Math.min(1, v + k / 160));
      for (const [i, v] of fx.eject) fx.eject.set(i, Math.min(1, v + k / 900));
      if (fx.merge > 0) fx.merge = Math.min(1, fx.merge + k / 600);
      if (fx.sweep !== null) fx.sweep = Math.min(1, fx.sweep + k / 800);
      if (fx.rise !== null) fx.rise = Math.min(1, fx.rise + k / 900);
      redraw();
    },
    destroy() {
      destroyed = true;
      clock.clear();
      root.destroy(true);
    },
  };
  return view;
}

export const skin: SkinPrefab<ClaimHoldersConfig, ClaimHoldersPose> = {
  skinId: "witness_projector",
  create(scene, _phaser, props) {
    const view = createWitnessProjectorView(scene, props);
    // the record_lens rides the cornice rail (e1) or the counter rail (e4): civil §5.0.2
    return withRecordLens(view, scene, props, (p) => p.apparatus.lensU ?? p.probeU);
  },
};
export default skin;
