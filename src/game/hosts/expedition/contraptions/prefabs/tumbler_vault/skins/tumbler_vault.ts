/**
 * tumbler_vault · skin tumbler_vault (civil e12, the Editor's Vault; §4.3 slots vault_door, tumbler, bolt, handwheel,
 * voice_grille, press_organ, console). KC3.
 *
 * A 1000 px round door in a cream stone socket with radiating navy grooves and a gold ring. One tumbler wheel per
 * hypothesis (view order, clockwise from 12 o'clock) turns a quarter when the player's OWN marks strike it; its lamp dims
 * to salmon; when exactly one is left unstruck its groove glows cyan and it slides toward the hub (from the marks,
 * never the solution). The accused tumbler wears the orange ring (bound to input). The Editor's voice grille glows from
 * aid tier 1. Success: the tumbler locks, the bolts retract in sequence, the rings counter-rotate, the handwheel spins,
 * the door swings open on its hinge and the press organ inside lights. Failure: the accused tumbler grinds (a 4°
 * judder, 3×) and holds bright while the panel slides the eliminating clue beside its row. sensitiveSafe: no shake, no
 * bursts. Code-drawn stand-ins until KC4's hero parts land.
 */
import type Phaser from "phaser";
import type { TumblerVaultConfig } from "@/world/contraptions/tumbler-vault.config";
import type { TumblerPose, TumblerVaultPose } from "@/world/contraptions/tumbler-vault.meta";
import { clamp01, ease } from "@/world/ease";
import type { FailurePlan, SuccessPlan } from "@/world/types";
import type { ContraptionState, PoseView, SkinPrefab, XY } from "../../../types";
import {
  BLEND_ADD,
  beatClock,
  civilColors,
  drawConsoleReader,
  drawRivets,
  fillPoly,
  grindOffset,
  localGround,
  mix,
  pulse,
  rotRect,
  type CivilColors,
} from "../../oracle_ticker/civil-kit";
import { boltSpan, doorSwing, routeVaultFail, routeVaultSuccess, tumblerAngle, tumblerCenter, VAULT } from "../shared";

type G = Phaser.GameObjects.Graphics;
const C = VAULT.center;
const HINGE = { x: C.x - VAULT.doorR, y: C.y };

function drawSocket(g: G, c: CivilColors): void {
  // the stone block the door is set in (cream stone, gold edge, navy inlay band)
  g.fillStyle(c.stoneDeep, 1);
  g.fillRoundedRect(C.x - 600, C.y - 560, 1200, 560 + 540, 18);
  g.fillStyle(c.stone, 1);
  g.fillRoundedRect(C.x - 588, C.y - 548, 1176, 548 + 530, 14);
  g.fillStyle(c.stoneLit, 1);
  g.fillRect(C.x - 588, C.y - 548, 18, 1078);
  g.fillStyle(c.navy, 1);
  g.fillRect(C.x - 588, C.y - 548 + 40, 1176, 22);
  g.fillStyle(c.brass, 1);
  g.fillRect(C.x - 588, C.y - 548 + 36, 1176, 4);
  g.fillRect(C.x - 588, C.y - 548 + 62, 1176, 4);
  // the socket ring and its radiating grooves
  g.fillStyle(c.stoneShade, 1);
  g.fillCircle(C.x, C.y, VAULT.socketR);
  g.lineStyle(6, c.navy, 0.9);
  for (let i = 0; i < 28; i++) {
    const a = (2 * Math.PI * i) / 28;
    g.beginPath();
    g.moveTo(C.x + Math.cos(a) * (VAULT.doorR + 4), C.y + Math.sin(a) * (VAULT.doorR + 4));
    g.lineTo(C.x + Math.cos(a) * (VAULT.socketR - 6), C.y + Math.sin(a) * (VAULT.socketR - 6));
    g.strokePath();
  }
  g.lineStyle(8, c.brass, 1);
  g.strokeCircle(C.x, C.y, VAULT.socketR);
  g.lineStyle(3, c.brassHi, 1);
  g.strokeCircle(C.x, C.y, VAULT.socketR - 4);
}

/** The vault interior behind the door and the press organ (visible as the door swings). */
function drawInterior(g: G, glow: G, c: CivilColors, open: number, tMs: number, reduced: boolean): void {
  g.fillStyle(c.navyDark, 1);
  g.fillCircle(C.x, C.y, VAULT.doorR);
  g.fillStyle(c.ink, 1);
  g.fillCircle(C.x + 30, C.y + 20, VAULT.doorR - 40);
  // press organ: pipes behind, two rollers and a paper feed in front
  const pipes = [220, 300, 360, 400, 360, 300, 220];
  pipes.forEach((h, i) => {
    const x = C.x - 180 + i * 60;
    g.fillStyle(mix(c.brassDeep, c.ink, 0.35), 1);
    g.fillRoundedRect(x - 20, C.y + 150 - h, 40, h, 12);
    g.fillStyle(mix(c.brass, c.ink, 0.25), 1);
    g.fillRoundedRect(x - 20, C.y + 150 - h, 14, h, 8);
  });
  g.fillStyle(mix(c.steelShade, c.ink, 0.2), 1);
  g.fillRoundedRect(C.x - 260, C.y + 140, 520, 120, 18);
  for (const dy of [170, 222]) {
    g.fillStyle(c.steel, 1);
    g.fillRoundedRect(C.x - 230, C.y + dy - 18, 460, 36, 18);
    g.fillStyle(c.stoneLit, 0.5);
    g.fillRect(C.x - 220, C.y + dy - 12, 440, 5);
  }
  if (open > 0.05) {
    const k = clamp01((open - 0.05) / 0.95) * (0.85 + 0.15 * pulse(tMs, 0.6, reduced));
    // the press prints: a sheet feeds out between the rollers
    g.fillStyle(c.paper, k);
    g.fillRect(C.x - 150, C.y + 196 - 150 * k, 300, 150 * k);
    g.fillStyle(c.ink, 0.7 * k);
    for (let i = 0; i < 4; i++) g.fillRect(C.x - 120, C.y + 196 - 140 * k + i * 30 * k, 200 - i * 30, 8 * k);
    glow.fillStyle(c.lamp, 0.25 * k);
    glow.fillCircle(C.x, C.y + 60, 380);
    glow.fillStyle(c.lamp, 0.25 * k);
    glow.fillCircle(C.x, C.y + 180, 180);
  }
}

function drawTumbler(g: G, glow: G, t: TumblerPose, at: XY, rot: number, c: CivilColors, hold: number, outward: number, tMs: number, reduced: boolean): void {
  const R = VAULT.tumblerR;
  // lamp (outward from the hub): white while unstruck, dim salmon when struck
  const la = { x: at.x + Math.cos(outward) * (R + 34), y: at.y + Math.sin(outward) * (R + 34) };
  const lampCol = mix(mix(c.dormant, c.salmon, 0.6), 0xffffff, t.lamp);
  if (t.lamp > 0.5) {
    glow.fillStyle(0xffffff, 0.22 * t.lamp);
    glow.fillCircle(la.x, la.y, 28);
  }
  g.fillStyle(c.brassDeep, 1);
  g.fillCircle(la.x, la.y, 14);
  g.fillStyle(lampCol, 0.6 + 0.4 * t.lamp);
  g.fillCircle(la.x, la.y, 10);
  // the wheel
  g.fillStyle(c.ink, 0.35);
  g.fillCircle(at.x + 5, at.y + 7, R + 2);
  g.fillStyle(c.brassDeep, 1);
  g.fillCircle(at.x, at.y, R);
  g.fillStyle(c.brass, 1);
  g.fillCircle(at.x, at.y, R - 6);
  g.fillStyle(c.stone, 1);
  g.fillCircle(at.x, at.y, R - 12);
  g.fillStyle(c.stoneShade, 1);
  g.fillCircle(at.x, at.y, R - 36);
  g.fillStyle(c.navy, 1);
  g.fillCircle(at.x, at.y, R - 42);
  // engraved band marks (the hypothesis text is DOM; these show the wheel turning)
  g.lineStyle(4, c.ink, 0.6);
  for (let i = 0; i < 3; i++) {
    const a = rot + Math.PI / 2 + (i - 1) * 0.42;
    g.beginPath();
    g.arc(at.x, at.y, R - 24, a - 0.14, a + 0.14);
    g.strokePath();
  }
  // the groove (the notch that must meet the bolt channel): a slot from the hub to the rim at the wheel's "up"
  const up = rot - Math.PI / 2;
  const slot = rotRect(at.x + Math.cos(up) * (R - 24), at.y + Math.sin(up) * (R - 24), 48, 18, up);
  g.fillStyle(c.ink, 1);
  fillPoly(g, slot);
  if (t.glow > 0.01) {
    glow.fillStyle(c.cyan, 0.8 * t.glow);
    fillPoly(glow, slot);
    glow.fillStyle(c.cyan, 0.25 * t.glow * (0.75 + 0.25 * pulse(tMs, 1, reduced)));
    glow.fillCircle(at.x + Math.cos(up) * (R - 24), at.y + Math.sin(up) * (R - 24), 40);
  }
  // hub cap
  g.fillStyle(c.brassDeep, 1);
  g.fillCircle(at.x, at.y, 16);
  g.fillStyle(c.brassHi, 1);
  g.fillCircle(at.x - 4, at.y - 4, 5);
  if (t.accused) {
    g.lineStyle(7, c.accent, 1);
    g.strokeCircle(at.x, at.y, R + 12);
  }
  if (hold > 0.01) {
    g.lineStyle(6, 0xffffff, 0.9 * hold);
    g.strokeCircle(at.x, at.y, R + 22);
    glow.fillStyle(0xffffff, 0.18 * hold);
    glow.fillCircle(at.x, at.y, R + 30);
  }
}

function drawRing(g: G, r: number, w: number, deg: number, notches: number, color: number, notchColor: number): void {
  g.lineStyle(w, color, 1);
  g.strokeCircle(C.x, C.y, r);
  const base = (deg * Math.PI) / 180;
  g.fillStyle(notchColor, 1);
  for (let i = 0; i < notches; i++) {
    const a = base + (2 * Math.PI * i) / notches;
    fillPoly(g, rotRect(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r, w + 4, w * 0.7, a));
  }
}

function drawHandwheel(g: G, deg: number, c: CivilColors): void {
  const R = VAULT.handwheelR;
  const a0 = (deg * Math.PI) / 180;
  g.lineStyle(10, c.brassDeep, 1);
  for (let i = 0; i < 6; i++) {
    const a = a0 + (i * Math.PI) / 3;
    g.beginPath();
    g.moveTo(C.x, C.y);
    g.lineTo(C.x + Math.cos(a) * R, C.y + Math.sin(a) * R);
    g.strokePath();
  }
  g.lineStyle(14, c.brassDeep, 1);
  g.strokeCircle(C.x, C.y, R);
  g.lineStyle(6, c.brass, 1);
  g.strokeCircle(C.x, C.y, R);
  for (let i = 0; i < 6; i++) {
    const a = a0 + (i * Math.PI) / 3;
    g.fillStyle(c.brassHi, 1);
    g.fillCircle(C.x + Math.cos(a) * R, C.y + Math.sin(a) * R, 9);
  }
  g.fillStyle(c.brassDeep, 1);
  g.fillCircle(C.x, C.y, 30);
  g.fillStyle(c.brass, 1);
  g.fillCircle(C.x, C.y, 22);
  g.fillStyle(c.brassHi, 1);
  g.fillCircle(C.x - 6, C.y - 6, 7);
}

function drawDoorFace(g: G, c: CivilColors): void {
  g.fillStyle(c.steelShade, 1);
  g.fillCircle(C.x, C.y, VAULT.doorR);
  g.fillStyle(c.steel, 1);
  g.fillCircle(C.x, C.y, VAULT.doorR - 14);
  g.fillStyle(c.stoneLit, 0.18); // key light from upper left
  g.fillCircle(C.x - 60, C.y - 70, VAULT.doorR - 90);
  g.fillStyle(c.steelShade, 0.5);
  g.fillCircle(C.x, C.y, VAULT.tumblerRingR - VAULT.tumblerR - 30);
  for (let i = 0; i < 36; i++) {
    const a = (2 * Math.PI * i) / 36;
    g.fillStyle(c.steelShade, 1);
    g.fillCircle(C.x + Math.cos(a) * (VAULT.doorR - 8), C.y + Math.sin(a) * (VAULT.doorR - 8), 4);
  }
}

function drawBolt(g: G, glow: G, j: number, nb: number, retract: number, c: CivilColors): void {
  const s = boltSpan(j, nb, retract);
  const mid = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
  g.fillStyle(c.ink, 0.4);
  fillPoly(g, rotRect(mid.x + 4, mid.y + 5, VAULT.boltLen, VAULT.boltW, s.angle));
  g.fillStyle(c.brassDeep, 1);
  fillPoly(g, rotRect(mid.x, mid.y, VAULT.boltLen, VAULT.boltW, s.angle));
  g.fillStyle(c.brass, 1);
  fillPoly(g, rotRect(mid.x, mid.y - 3, VAULT.boltLen - 10, VAULT.boltW - 16, s.angle));
  if (retract > 0.02 && retract < 0.98) {
    glow.fillStyle(c.lamp, 0.3);
    glow.fillCircle(s.b.x, s.b.y, 22);
  }
}

function drawGrille(g: G, glow: G, grille: number, c: CivilColors): void {
  const { x, y, r } = VAULT.grille;
  const k = clamp01((grille - 0.35) / 0.65);
  if (k > 0.01) {
    glow.fillStyle(c.lamp, 0.3 * k);
    glow.fillCircle(x, y, r * 2.4);
  }
  g.fillStyle(c.brassDeep, 1);
  g.fillCircle(x, y, r + 8);
  g.fillStyle(mix(c.brass, c.lamp, k * 0.4), 1);
  g.fillCircle(x, y, r);
  g.fillStyle(mix(c.ink, c.lamp, 0.25 + 0.6 * k * grille), 1);
  for (let i = -2; i <= 2; i++) {
    const w = Math.sqrt(Math.max(0, r * r - (i * 16) ** 2)) * 1.5;
    g.fillRoundedRect(x - w / 2, y + i * 16 - 4, w, 8, 4);
  }
  drawRivets(g, { x: x - r - 4, y: y - r - 14 }, { x: x + r + 4, y: y - r - 14 }, 26, 3, c.brassDeep, 1);
}

export function createTumblerVaultView(scene: Phaser.Scene, props: Parameters<SkinPrefab<TumblerVaultConfig, TumblerVaultPose>["create"]>[2]): PoseView<TumblerVaultPose> {
  const c = civilColors(props.palette);
  const anchor = props.station.anchor;
  const ground = localGround(scene, props);
  const reduced = props.reducedMotion;
  const consoleLocal = { x: props.station.consoleX - anchor.x, y: ground(props.station.consoleX - anchor.x, props.station.consoleSurface) };

  const root = scene.add.container(anchor.x, anchor.y);
  const back = scene.add.graphics();
  const interior = scene.add.graphics();
  const doorC = scene.add.container(HINGE.x, HINGE.y);
  const doorG = scene.add.graphics();
  const doorGlow = scene.add.graphics();
  doorGlow.setBlendMode(BLEND_ADD);
  doorC.add([doorG, doorGlow]);
  // the door is drawn in vault coordinates shifted onto the hinge, so it swings with the container
  doorG.setPosition(-HINGE.x, -HINGE.y);
  doorGlow.setPosition(-HINGE.x, -HINGE.y);
  const front = scene.add.graphics();
  const glow = scene.add.graphics();
  glow.setBlendMode(BLEND_ADD);
  root.add([back, interior, doorC, front, glow]);
  drawSocket(back, c);

  const nb = Math.max(2, props.config.bolts);
  const anchors: Record<string, XY> & { console: XY } = {
    console: consoleLocal,
    hub: { x: C.x, y: C.y },
    grille: { x: VAULT.grille.x, y: VAULT.grille.y },
    payoff: { x: C.x, y: C.y },
  };
  for (let j = 0; j < nb; j++) {
    const s = boltSpan(j, nb, 0);
    anchors[`bolt_${j}`] = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
  }
  const hyps = (props.view as { hypotheses?: unknown } | null)?.hypotheses;
  const nh = Array.isArray(hyps) ? hyps.length : 4;
  for (let i = 0; i < Math.max(4, nh); i++) anchors[`tumbler_${i}`] = tumblerCenter(i, Math.max(1, nh));

  let pose: TumblerVaultPose | null = null;
  let state: ContraptionState = "dormant";
  let destroyed = false;
  let now = 0;
  const fx = {
    grind: null as { index: number; start: number; dur: number; deg: number; times: number } | null,
    hold: new Map<number, number>(), // tumbler → ms left
    lock: null as number | null,
    bolts: new Map<number, number>(), // bolt → 0…1
    ringSpin: null as number | null,
    wheelSpin: null as number | null,
    spinTurns: { ring: 1.5, wheel: 2 },
    door: null as number | null,
    swingMs: 1200,
  };
  const clock = beatClock(scene, reduced, () => !destroyed);

  const redraw = () => {
    if (!pose) return;
    doorG.clear();
    doorGlow.clear();
    interior.clear();
    front.clear();
    glow.clear();
    const door = Math.max(pose.door, fx.door === null ? 0 : ease("in_out_cubic", fx.door));
    drawInterior(interior, glow, c, door, now, reduced);
    const sw = doorSwing(door);
    doorC.setScale(sw.scaleX, 1);
    drawDoorFace(doorG, c);
    const ringExtra = fx.ringSpin === null ? 0 : ease("out_cubic", fx.ringSpin) * fx.spinTurns.ring * 360;
    const wheelExtra = fx.wheelSpin === null ? 0 : ease("out_cubic", fx.wheelSpin) * fx.spinTurns.wheel * 360;
    drawRing(doorG, VAULT.goldRingR, 18, pose.ringsDeg + ringExtra, 12, c.brass, c.navy);
    drawRing(doorG, VAULT.innerRingR, 12, -0.66 * (pose.ringsDeg + ringExtra), 8, c.brassDeep, c.navyDark);
    for (let j = 0; j < nb; j++) drawBolt(doorG, doorGlow, j, nb, Math.max(pose.bolts[j] ?? 0, fx.bolts.get(j) ?? 0), c);
    const n = pose.tumblers.length;
    pose.tumblers.forEach((t, i) => {
      const at = tumblerCenter(i, n, t.slide);
      let rot = (t.rotDeg * Math.PI) / 180;
      if (fx.grind && fx.grind.index === i) {
        const u = (now - fx.grind.start) / fx.grind.dur;
        if (u >= 0 && u <= 1) rot += grindOffset(u, fx.grind.deg, fx.grind.times);
      }
      const locked = fx.lock === i ? { ...t, glow: 1, rotDeg: 0 } : t;
      if (fx.lock === i) rot = 0;
      const hold = Math.min(1, (fx.hold.get(i) ?? 0) / 300);
      drawTumbler(doorG, doorGlow, locked, at, rot, c, hold, tumblerAngle(i, n), now, reduced);
      // anchors follow the swing (the door face is squashed toward the hinge)
      anchors[`tumbler_${i}`] = { x: HINGE.x + (at.x - HINGE.x) * sw.scaleX, y: at.y };
    });
    drawHandwheel(doorG, pose.handwheelDeg + wheelExtra, c);
    if (sw.shade > 0.01) {
      doorG.fillStyle(c.ink, sw.shade);
      doorG.fillCircle(C.x, C.y, VAULT.doorR);
    }
    drawGrille(front, glow, pose.grille, c);
    drawConsoleReader(front, consoleLocal, c, state === "active" ? 1 : state === "awake" ? 0.4 : 0);
  };

  const view: PoseView<TumblerVaultPose> = {
    root,
    anchors,
    applyPose(p: TumblerVaultPose) {
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
    async playSucceed(plan: SuccessPlan, p: TumblerVaultPose) {
      const r = routeVaultSuccess(plan);
      if (r.lock) {
        const idx = r.lock.index ?? (pose ? pose.tumblers.findIndex((t) => t.accused) : -1);
        clock.later(r.lock.atMs, () => (fx.lock = idx >= 0 ? idx : null));
      }
      for (const b of r.bolts) clock.later(b.atMs, () => fx.bolts.set(b.index, 0.0001));
      if (r.spin) {
        const s = r.spin;
        clock.later(s.atMs, () => {
          fx.spinTurns = { ring: s.ringTurns, wheel: s.wheelTurns };
          fx.ringSpin = 0;
          fx.wheelSpin = 0;
        });
      }
      if (r.open) {
        const o = r.open;
        clock.later(o.atMs, () => {
          fx.swingMs = o.swingMs;
          fx.door = 0;
        });
      }
      await clock.wait(plan.durationMs);
      if (destroyed) return;
      fx.lock = null;
      fx.bolts.clear();
      fx.ringSpin = null;
      fx.wheelSpin = null;
      fx.door = null;
      view.applyPose(p); // the solved pose carries the open door, drawn bolts and the turned rings
    },
    async playFail(plan: FailurePlan, p: TumblerVaultPose) {
      const r = routeVaultFail(plan);
      if (r.grind) {
        const gr = r.grind;
        clock.later(gr.atMs, () => (fx.grind = { index: gr.index, start: now, dur: 650, deg: gr.deg, times: gr.times }));
      }
      if (r.hold) {
        const h = r.hold;
        clock.later(h.atMs, () => fx.hold.set(h.index, 1100));
      }
      await clock.wait(Math.min(1600, plan.durationMs));
      if (destroyed) return;
      fx.grind = null;
      view.applyPose(pose ?? p); // the accusation clears in the panel; the player's marks stay
    },
    update(dtMs: number) {
      if (destroyed) return;
      const dt = Math.max(0, dtMs);
      now += dt;
      const k = reduced ? 1e9 : dt;
      for (const [i, ms] of fx.hold) {
        if (ms - dt <= 0) fx.hold.delete(i);
        else fx.hold.set(i, ms - dt);
      }
      for (const [j, v] of fx.bolts) fx.bolts.set(j, Math.min(1, v + k / 180));
      if (fx.ringSpin !== null) fx.ringSpin = Math.min(1, fx.ringSpin + k / 900);
      if (fx.wheelSpin !== null) fx.wheelSpin = Math.min(1, fx.wheelSpin + k / 900);
      if (fx.door !== null) fx.door = Math.min(1, fx.door + k / fx.swingMs);
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

export const skin: SkinPrefab<TumblerVaultConfig, TumblerVaultPose> = {
  skinId: "tumbler_vault",
  create(scene, _phaser, props) {
    return createTumblerVaultView(scene, props);
  },
};
export default skin;
