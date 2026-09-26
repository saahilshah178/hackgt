/**
 * emitter_rail · skin vesper_dial (trig e1, "The Vesper Dial"; trig §5.1, bible P7/P2; docs/design/20 §4.3 slots disc,
 * rail_ring, carriage, beam cap, plumb_gauge, slide_gauge, fog_band, vesper_lens, spoke_ledge, console). A cream stone
 * sun-disc set in the court wall with a gold rail ring; a brass carriage rides the ring and fires a cyan beam outward;
 * a sine plumb gauge and a cosine slide gauge ride beside it; a lavender fog band hides Vesper's Lens in the sky arc.
 *
 * Live: the carriage (eased by the controller) rides the ARC, the beam sweeps and ends in the same soft bloom at every
 * in-fog angle (below the horizon it ends on the wall), the plumb bob and cosine marker follow with dashed drop lines,
 * the gold sweep arc runs 0 → θ on the disc rim. Success: surge, the fog dissolves, the lens ignites, starlight runs
 * back down the beam, the disc turns by the angle you set, five spoke ledges slide out (the stair). Failure: the beam
 * scatters at its end and gold chevrons on the rail point the way (count = distance band), never the target.
 *
 * Code-drawn stand-ins in the biome palette (kit art, §0.1.6 fallback ladder step 1); world text is DOM (chips).
 */
import type Phaser from "phaser";
import type { EmitterRailConfig } from "@/world/contraptions/emitter-rail.config";
import {
  distinctLandmarks,
  FOG_RADIUS,
  LEDGE_COUNT,
  landmarkAnchor,
  lineOf,
  pinAt,
  PLUMB_DX,
  SLIDE_DY,
  spokeAt,
  type EmitterRailPose,
} from "@/world/contraptions/emitter-rail.meta";
import type { FailBeat, FailurePlan, SuccessBeat, SuccessPlan } from "@/world/types";
import type { BeamHandle, ContraptionState, PoseView, PrefabProps, SkinPrefab, XY } from "../../../types";
import {
  Anims,
  chevron,
  dashedLine,
  drawLectern,
  easeInOutSine,
  easeOutCubic,
  linear,
  mathArc,
  mix,
  orreryColors,
  setAnchor,
  softStroke,
  waitMs,
} from "../shared";

const PI = Math.PI;
const DISC_R = 280;
const ORB_OUT = 30;

/** Transient visual state the plans drive on top of the pose (null = follow the pose). */
interface Overrides {
  fog: number | null;
  lens: number | null;
  disc: number | null; // Phaser rotation
  ledges: (number | null)[];
  surge: number; // 0…1 extra beam core
  starlight: number | null; // 0…1 along lens → carriage → centre
  chevrons: { dir: number; count: number; alpha: number } | null;
  puff: { at: XY; r: number; alpha: number } | null;
}

function createVesperDial(scene: Phaser.Scene, P: typeof Phaser, props: PrefabProps<EmitterRailConfig>): PoseView<EmitterRailPose> {
  const { station, config, fx, reducedMotion } = props;
  const R = config.radius;
  const c = orreryColors(props.palette);
  const line = lineOf(props.view);
  const arc = config.rail === "arc";
  const railKind = arc ? "arc" : line.scale === "log" ? "log" : "straight";
  const groundLocal = props.groundY - station.anchor.y;
  const consoleLocal: XY = { x: station.consoleX - station.anchor.x, y: groundLocal };
  const hasFog = config.hiddenTarget !== "none";
  const targetAngle = arc && line.target !== null ? line.target : PI / 2;
  const straightFogY = -560;
  const lensAt: XY = arc
    ? { x: FOG_RADIUS * Math.cos(targetAngle), y: -FOG_RADIUS * Math.sin(targetAngle) }
    : { x: -R + 2 * R * (line.target !== null ? Math.min(1, Math.max(0, (line.target - line.min) / (line.max - line.min))) : 0.5), y: straightFogY };
  const marks = distinctLandmarks(railKind, line);
  const anims = new Anims(reducedMotion);
  const ov: Overrides = { fog: null, lens: null, disc: null, ledges: Array.from({ length: LEDGE_COUNT }, () => null), surge: 0, starlight: null, chevrons: null, puff: null };
  let pose: EmitterRailPose | null = null;
  let state: ContraptionState = "dormant";
  let dead = false;
  let dirty = true;
  let chevronHoldMs = 0;

  const root = scene.add.container(station.anchor.x, station.anchor.y);

  // ---------------------------------------------------------------- static layers
  const fogG = scene.add.graphics();
  const lensC = scene.add.container(lensAt.x, lensAt.y);
  const lensG = scene.add.graphics();
  lensC.add(lensG);
  const backG = scene.add.graphics(); // disc shadow, gauges' rulers, console
  const discC = scene.add.container(0, 0);
  const discG = scene.add.graphics();
  discC.add(discG);
  const railG = scene.add.graphics();
  const dynG = scene.add.graphics(); // sweep arc, drop lines, bob, marker, ledges
  root.add([fogG, lensC, backG, discC, railG, dynG]);
  const bloom = fx.glow(root, { x: 0, y: -FOG_RADIUS }, 90, c.beam, 0);
  const beam: BeamHandle = fx.beam(root, { x: R, y: 0 }, { x: R + 1, y: 0 }, c.beam);
  beam.setAlpha(0);
  const carriageC = scene.add.container(R, 0);
  const carriageG = scene.add.graphics();
  carriageC.add(carriageG);
  const fxG = scene.add.graphics(); // chevrons, surge, starlight, puffs
  root.add([carriageC, fxG]);
  const lensHalo = fx.glow(root, lensAt, 150, c.starGlow, 0);
  const star = fx.glow(root, { x: 0, y: 0 }, 46, c.star, 0);

  // the fog band: a soft lavender arc over the sky from 10° to 170° (straight rails: a flat band above)
  const drawFog = () => {
    fogG.clear();
    if (!hasFog) return;
    if (arc) {
      softStroke(fogG, () => mathArc(fogG, { x: 0, y: 0 }, FOG_RADIUS, (10 * PI) / 180, (170 * PI) / 180), c.fog, 190, 1, 5);
      for (let i = 0; i <= 16; i++) {
        const a = ((10 + (160 * i) / 16) * PI) / 180;
        const rr = FOG_RADIUS + ((i * 37) % 90) - 45;
        fogG.fillStyle(mix(c.fog, 0xffffff, 0.4), 0.35);
        fogG.fillCircle(rr * Math.cos(a), -rr * Math.sin(a), 70 + ((i * 53) % 40));
      }
    } else {
      fogG.fillStyle(c.fog, 0.85);
      fogG.fillRoundedRect(-R - 160, straightFogY - 90, 2 * R + 320, 180, 80);
    }
  };
  drawFog();

  // Vesper's Lens: a bronze ring with a glass core (hidden in the fog until it ignites)
  lensG.fillStyle(c.bronze, 1);
  lensG.fillCircle(0, 0, 46);
  lensG.fillStyle(c.goldHi, 1);
  lensG.fillCircle(0, 0, 38);
  lensG.fillStyle(mix(c.beam, 0xffffff, 0.5), 1);
  lensG.fillCircle(0, 0, 28);
  lensG.fillStyle(0xffffff, 0.9);
  lensG.fillCircle(-8, -8, 9);
  lensC.setAlpha(0);

  // the disc: cream stone sun face (8 gold rays, navy inlay at r 200), five dark spoke slots on its right rim
  const slotY = (i: number) => Math.max(-DISC_R + 24, Math.min(DISC_R - 24, spokeAt(i, R, groundLocal).y));
  const slotX = (i: number) => Math.sqrt(Math.max(0, DISC_R * DISC_R - slotY(i) * slotY(i)));
  backG.fillStyle(c.shadow, 0.22);
  backG.fillCircle(38, 26, DISC_R + 8);
  if (arc) {
    discG.fillStyle(c.stoneShade, 1);
    discG.fillCircle(0, 0, DISC_R);
    discG.fillStyle(c.stoneBase, 1);
    discG.fillCircle(-6, -6, DISC_R - 10);
    discG.fillStyle(c.stoneLit, 0.8);
    discG.fillCircle(-40, -46, DISC_R - 70);
    discG.fillStyle(c.stoneBase, 1);
    discG.fillCircle(0, 0, 214);
    discG.lineStyle(10, c.navy, 1);
    discG.strokeCircle(0, 0, 200);
    discG.lineStyle(2, c.stoneDeep, 0.8);
    discG.strokeCircle(0, 0, DISC_R - 14);
    discG.strokeCircle(0, 0, 150);
    for (let i = 0; i < 8; i++) {
      const a = (i * PI) / 4 + PI / 8;
      const tip = { x: 182 * Math.cos(a), y: -182 * Math.sin(a) };
      const l = { x: 62 * Math.cos(a + 0.2), y: -62 * Math.sin(a + 0.2) };
      const r2 = { x: 62 * Math.cos(a - 0.2), y: -62 * Math.sin(a - 0.2) };
      discG.fillStyle(c.gold, 1);
      discG.fillTriangle(l.x, l.y, tip.x, tip.y, r2.x, r2.y);
      discG.lineStyle(2, c.goldDeep, 1);
      discG.strokeTriangle(l.x, l.y, tip.x, tip.y, r2.x, r2.y);
    }
    discG.fillStyle(c.goldDeep, 1);
    discG.fillCircle(0, 0, 50);
    discG.fillStyle(c.gold, 1);
    discG.fillCircle(-3, -3, 42);
    discG.fillStyle(c.goldHi, 1);
    discG.fillCircle(-10, -12, 14);
    // the sun's gaze: a small navy ring in the boss
    discG.lineStyle(4, c.navy, 1);
    discG.strokeCircle(0, 0, 24);
  } else {
    // straight/log: a stone lintel plate behind the rail
    discG.fillStyle(c.stoneBase, 1);
    discG.fillRoundedRect(-R - 60, -110, 2 * R + 120, 220, 24);
    discG.lineStyle(8, c.navy, 1);
    discG.strokeRoundedRect(-R - 40, -90, 2 * R + 80, 180, 18);
  }
  // spoke slots (fixed in the wall: they do not turn with the disc)
  for (let i = 0; i < LEDGE_COUNT; i++) {
    backG.fillStyle(c.navyDark, 0.9);
    backG.fillRoundedRect(slotX(i) - 26, slotY(i) - 4, 32, 18, 5);
  }

  // the rail ring with 24 studs every π/12 and gold landmark bosses; the sunrise mark at 0
  if (arc) {
    railG.lineStyle(18, c.goldDeep, 1);
    railG.strokeCircle(0, 0, R);
    railG.lineStyle(12, c.gold, 1);
    railG.strokeCircle(0, 0, R);
    railG.lineStyle(3, c.goldHi, 1);
    railG.strokeCircle(0, 0, R - 3);
    for (let k = 0; k < 24; k++) {
      const a = (k * PI) / 12;
      railG.fillStyle(c.navy, 1);
      railG.fillCircle(R * Math.cos(a), -R * Math.sin(a), 4);
    }
    for (const m of marks) {
      const at = { x: R * Math.cos(m.value), y: -R * Math.sin(m.value) };
      railG.fillStyle(c.goldDeep, 1);
      railG.fillCircle(at.x, at.y, 14);
      railG.fillStyle(c.goldHi, 1);
      railG.fillCircle(at.x - 2, at.y - 2, 10);
    }
    const sun = { x: R + 30, y: 0 };
    railG.lineStyle(2, c.goldDeep, 1);
    railG.strokeCircle(sun.x, sun.y, 7);
    for (let k = 0; k < 8; k++) {
      const a = (k * PI) / 4;
      railG.lineBetween(sun.x + 10 * Math.cos(a), sun.y + 10 * Math.sin(a), sun.x + 15 * Math.cos(a), sun.y + 15 * Math.sin(a));
    }
  } else {
    railG.fillStyle(c.goldDeep, 1);
    railG.fillRoundedRect(-R - 12, -9, 2 * R + 24, 18, 9);
    railG.fillStyle(c.gold, 1);
    railG.fillRoundedRect(-R - 10, -7, 2 * R + 20, 12, 6);
    for (const m of marks) {
      const x = landmarkAnchor(railKind, R, line, m.value).x;
      railG.fillStyle(c.goldHi, 1);
      railG.fillCircle(x, 0, 10);
    }
  }

  // the gauges' rulers (arc rails with gauges)
  const plumbX = R + PLUMB_DX;
  const slideY = R + SLIDE_DY;
  const hasSin = arc && config.gauges.includes("sin");
  const hasCos = arc && config.gauges.includes("cos");
  if (hasSin) {
    backG.fillStyle(c.brassDeep, 1);
    backG.fillRoundedRect(plumbX - 9, -R - 16, 18, 2 * R + 32, 8);
    backG.fillStyle(c.brass, 1);
    backG.fillRoundedRect(plumbX - 6, -R - 12, 10, 2 * R + 24, 5);
    for (const f of [-1, -0.5, 0, 0.5, 1]) {
      backG.lineStyle(f === 0 ? 4 : 3, c.navy, 1);
      backG.lineBetween(plumbX - (f === 0 ? 22 : 16), -R * f, plumbX - 7, -R * f);
    }
  }
  if (hasCos) {
    backG.fillStyle(c.brassDeep, 1);
    backG.fillRoundedRect(-R - 16, slideY - 9, 2 * R + 32, 18, 8);
    backG.fillStyle(c.brass, 1);
    backG.fillRoundedRect(-R - 12, slideY - 6, 2 * R + 24, 10, 5);
    for (const f of [-1, -0.5, 0, 0.5, 1]) {
      backG.lineStyle(f === 0 ? 4 : 3, c.navy, 1);
      backG.lineBetween(R * f, slideY - (f === 0 ? 22 : 16), R * f, slideY - 7);
    }
  }

  // the carriage: a brass shoe straddling the rail with a cyan orb emitter facing outward (local −y)
  carriageG.fillStyle(c.shadow, 0.3);
  carriageG.fillRoundedRect(-42, -12, 90, 40, 12);
  carriageG.fillStyle(c.brassDeep, 1);
  carriageG.fillRoundedRect(-45, -16, 90, 36, 12);
  carriageG.fillStyle(c.brass, 1);
  carriageG.fillRoundedRect(-41, -14, 82, 26, 10);
  carriageG.fillStyle(c.brassHi, 1);
  carriageG.fillRoundedRect(-36, -12, 50, 8, 4);
  carriageG.fillStyle(c.navy, 1);
  carriageG.fillRect(-45, 2, 90, 5);
  carriageG.fillStyle(c.brassDeep, 1);
  carriageG.fillTriangle(-14, -14, 14, -14, 0, -ORB_OUT + 6);
  carriageG.fillStyle(c.goldDeep, 1);
  carriageG.fillCircle(0, -ORB_OUT, 15);
  const orbGlow = fx.glow(root, { x: R, y: -ORB_OUT }, 40, c.beam, 0);
  const orbG = scene.add.graphics();
  carriageC.add(orbG);
  const drawOrb = (lit: number) => {
    orbG.clear();
    orbG.fillStyle(mix(0x4a6b78, c.beam, lit), 1);
    orbG.fillCircle(0, -ORB_OUT, 11);
    orbG.fillStyle(0xffffff, 0.35 + 0.6 * lit);
    orbG.fillCircle(-3, -ORB_OUT - 3, 4);
  };
  drawOrb(0);

  // the console lectern
  const consoleG = scene.add.graphics();
  root.addAt(consoleG, 0);
  const drawConsole = (lit: number) => {
    consoleG.clear();
    drawLectern(consoleG, consoleLocal, c, lit);
  };
  drawConsole(0);

  // ---------------------------------------------------------------- anchors (moving ones are updated in place)
  const anchors: Record<string, XY> & { console: XY } = {
    console: consoleLocal,
    center: { x: 0, y: 0 },
    beam_origin: { x: R, y: 0 },
    carriage: { x: R, y: 0 },
    beam_end: { x: R, y: 0 },
    bob: { x: plumbX, y: 0 },
    marker: { x: R, y: slideY },
    pin: pinAt(R),
    lens: { ...lensAt },
    fog: arc ? { x: 0, y: -FOG_RADIUS } : { x: 0, y: straightFogY },
    payoff: spokeAt(2, R, groundLocal),
  };
  for (let i = 0; i < LEDGE_COUNT; i++) anchors[`spoke_${i}`] = spokeAt(i, R, groundLocal);
  marks.forEach((m, i) => (anchors[`lm_${i}`] = landmarkAnchor(railKind, R, line, m.value)));

  // ---------------------------------------------------------------- per-frame drawing
  const render = () => {
    const p = pose;
    if (!p) return;
    const u = { x: p.beamDirX, y: p.beamDirY };
    const cx = p.carriageX;
    const cy = p.carriageY;
    const lit = state === "dormant" ? 0 : p.lit;
    // carriage, beam, bloom
    carriageC.setPosition(cx, cy).setRotation(p.carriageRot);
    const orb = { x: cx + u.x * ORB_OUT, y: cy + u.y * ORB_OUT };
    const end = { x: cx + u.x * p.beamLen, y: cy + u.y * p.beamLen };
    beam.set(orb, end);
    beam.setAlpha(lit * (0.9 + 0.35 * ov.surge));
    bloom.setPosition(end.x, end.y).setAlpha(lit * (p.beamToFog ? 0.55 : 0.25)).setScale(p.beamToFog ? 1 : 0.45);
    orbGlow.setPosition(orb.x, orb.y).setAlpha(0.7 * lit);
    drawOrb(lit);
    setAnchor(anchors, "beam_origin", cx, cy);
    setAnchor(anchors, "carriage", cx, cy);
    setAnchor(anchors, "beam_end", end.x, end.y);
    setAnchor(anchors, "bob", plumbX, p.bobY);
    setAnchor(anchors, "marker", p.markerX, slideY);
    // fog, lens, disc
    fogG.setAlpha(ov.fog ?? p.fog);
    const lens = ov.lens ?? p.lens;
    lensC.setAlpha(lens);
    lensHalo.setAlpha(0.8 * lens);
    discC.setRotation(ov.disc ?? -p.discTurn);
    drawConsole(state === "dormant" ? 0 : state === "solved" ? 0.6 : 1);

    dynG.clear();
    if (arc && p.sweep > 0.001 && lit > 0) {
      dynG.lineStyle(6, c.goldHi, 0.7);
      mathArc(dynG, { x: 0, y: 0 }, R - 22, 0, p.sweep);
    }
    if (hasSin && lit > 0) {
      dynG.lineStyle(3, c.fnG, 0.9);
      dashedLine(dynG, { x: cx, y: cy }, { x: plumbX, y: p.bobY }, 12, 8);
    }
    if (hasCos && lit > 0) {
      dynG.lineStyle(3, c.fnH, 0.9);
      dashedLine(dynG, { x: cx, y: cy }, { x: p.markerX, y: slideY }, 12, 8);
    }
    if (hasSin) {
      dynG.fillStyle(c.brassDeep, 1);
      dynG.fillCircle(plumbX, p.bobY, 17);
      dynG.fillStyle(c.brass, 1);
      dynG.fillCircle(plumbX, p.bobY, 12);
      dynG.lineStyle(4, c.fnG, 0.4 + 0.6 * lit);
      dynG.strokeCircle(plumbX, p.bobY, 17);
    }
    if (hasCos) {
      dynG.fillStyle(c.brass, 1);
      dynG.fillTriangle(p.markerX - 12, slideY + 16, p.markerX + 12, slideY + 16, p.markerX, slideY);
      dynG.lineStyle(4, c.fnH, 0.4 + 0.6 * lit);
      dynG.strokeCircle(p.markerX, slideY, 14);
    }
    // spoke ledges: stone slabs sliding out of the slots to the stair treads
    for (let i = 0; i < LEDGE_COUNT; i++) {
      const e = ov.ledges[i] ?? p.ledges;
      if (e <= 0.001) continue;
      const tread = spokeAt(i, R, groundLocal);
      const x0 = slotX(i) - 20;
      const x1 = tread.x + 30;
      const right = x0 + (x1 - x0) * Math.min(1, e);
      const y = slotY(i) + (tread.y - slotY(i)) * Math.min(1, e);
      dynG.fillStyle(c.stoneShade, 1);
      dynG.fillRect(x0, y, right - x0, 22);
      dynG.fillStyle(c.stoneLit, 1);
      dynG.fillRect(x0, y, right - x0, 7);
      dynG.fillStyle(c.gold, 1);
      dynG.fillRect(right - 6, y, 6, 22);
    }

    fxG.clear();
    if (ov.surge > 0) {
      fxG.lineStyle(12 * ov.surge, 0xffffff, 0.5 * ov.surge);
      fxG.lineBetween(orb.x, orb.y, end.x, end.y);
    }
    if (ov.starlight !== null) {
      const s = ov.starlight;
      const path = [lensAt, end, orb, { x: 0, y: 0 }];
      const seg = Math.min(2.999, s * 3);
      const i = Math.floor(seg);
      const f = seg - i;
      const a = path[i];
      const b = path[i + 1];
      star.setPosition(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f).setAlpha(1 - 0.3 * s);
    } else star.setAlpha(0);
    if (ov.chevrons) {
      const { dir, count, alpha } = ov.chevrons;
      // gold chevrons with a navy under-shadow (legible on cream stone and on a projector)
      for (const [dx, dy, col, a] of [[3, 4, c.navyDark, 0.55 * alpha], [0, 0, c.goldHi, alpha]] as const) {
        fxG.fillStyle(col, a);
        for (let k = 0; k < count; k++) {
          if (arc) {
            const ang = p.theta + dir * (0.24 + 0.17 * k);
            const at = { x: (R + 46) * Math.cos(ang) + dx, y: -(R + 46) * Math.sin(ang) + dy };
            const tan = { x: -Math.sin(ang) * dir, y: -Math.cos(ang) * dir };
            chevron(fxG, at, tan, 44);
          } else chevron(fxG, { x: cx + dir * (70 + 50 * k) + dx, y: -48 + dy }, { x: dir, y: 0 }, 44);
        }
      }
    }
    if (ov.puff) {
      fxG.fillStyle(c.fog, ov.puff.alpha);
      fxG.fillCircle(ov.puff.at.x, ov.puff.at.y, ov.puff.r);
    }
  };

  const later = (ms: number, fn: () => void) => anims.add(ms, 1, () => undefined, linear, fn);

  const view: PoseView<EmitterRailPose> = {
    root,
    anchors,
    applyPose(p: EmitterRailPose) {
      pose = p;
      dirty = true;
      render();
      dirty = false;
    },
    setState(s: ContraptionState) {
      if (s === state) return;
      const was = state;
      state = s;
      try {
        fx.dormancy(root, s === "dormant", reducedMotion ? 0 : 600);
      } catch {
        root.setAlpha(s === "dormant" ? 0.75 : 1);
      }
      if (was === "dormant" || s === "dormant") dirty = true;
    },
    async playSucceed(plan: SuccessPlan, solved: EmitterRailPose) {
      const fog0 = pose?.fog ?? (hasFog ? 0.85 : 0);
      for (const b of plan.beats as readonly SuccessBeat[]) {
        const ms = typeof b.params?.ms === "number" ? b.params.ms : 400;
        if (b.action === "ignite" && b.anchor === "beam_origin") {
          anims.add(b.atMs, 900, (t) => (ov.surge = 1 - t), easeInOutSine);
        } else if (b.action === "dissolve") {
          anims.add(b.atMs, ms, (t) => (ov.fog = fog0 * (1 - t)), easeOutCubic);
        } else if (b.action === "ignite" && b.anchor === "lens") {
          anims.add(b.atMs, 400, (t) => (ov.lens = t), easeOutCubic);
          later(b.atMs, () => {
            if (!reducedMotion) fx.burst(root, lensAt, "sparks");
          });
        } else if (b.action === "light_sequence") {
          anims.add(b.atMs, ms, (t) => (ov.starlight = t), linear, () => (ov.starlight = null));
        } else if (b.action === "spin") {
          const angle = typeof b.params?.angle === "number" ? b.params.angle : 0;
          anims.add(b.atMs, ms, (t) => (ov.disc = -angle * t), easeOutCubic);
        } else if (b.action === "rise") {
          const i = Number(b.anchor.replace("spoke_", ""));
          if (Number.isInteger(i) && i >= 0 && i < LEDGE_COUNT) anims.add(b.atMs, ms, (t) => (ov.ledges[i] = t), easeOutCubic);
        }
      }
      await waitMs(scene, reducedMotion ? Math.min(400, plan.durationMs) : plan.durationMs, () => dead);
      if (dead) return;
      anims.clear();
      ov.fog = null;
      ov.lens = null;
      ov.disc = null;
      ov.ledges = ov.ledges.map(() => null);
      ov.surge = 0;
      ov.starlight = null;
      view.applyPose(solved);
    },
    async playFail(plan: FailurePlan, current: EmitterRailPose) {
      const p = pose ?? current;
      for (const b of plan.beats as readonly FailBeat[]) {
        if (b.action === "scatter") {
          later(b.atMs, () => {
            const end = { x: p.carriageX + p.beamDirX * p.beamLen, y: p.carriageY + p.beamDirY * p.beamLen };
            if (!reducedMotion) fx.burst(root, end, "sparks");
            anims.add(0, 700, (t) => (ov.puff = { at: end, r: 30 + 60 * t, alpha: 0.6 * (1 - t) }), easeOutCubic, () => (ov.puff = null));
          });
        } else if (b.action === "chevrons") {
          const dir = Number(b.params?.dir ?? 1) >= 0 ? 1 : -1;
          const count = Math.max(1, Math.min(3, Number(b.params?.count ?? 1)));
          const hold = Number(b.params?.holdMs ?? 2000);
          later(b.atMs, () => {
            ov.chevrons = { dir, count, alpha: 0 };
            chevronHoldMs = hold;
            anims.add(0, 220, (t) => ov.chevrons && (ov.chevrons.alpha = t), easeOutCubic);
          });
        }
      }
      await waitMs(scene, Math.min(1600, plan.durationMs), () => dead);
    },
    update(dtMs: number) {
      if (dead) return;
      const busy = anims.busy;
      anims.update(dtMs);
      if (chevronHoldMs > 0) {
        chevronHoldMs -= dtMs;
        if (chevronHoldMs <= 0 && ov.chevrons) anims.add(0, 400, (t) => ov.chevrons && (ov.chevrons.alpha = 1 - t), linear, () => (ov.chevrons = null));
      }
      if (busy || dirty || anims.busy || ov.chevrons) {
        render();
        dirty = false;
      }
    },
    destroy() {
      dead = true;
      anims.clear();
      beam.destroy();
      root.destroy(true);
    },
  };
  void P;
  return view;
}

export const skin: SkinPrefab<EmitterRailConfig, EmitterRailPose> = {
  skinId: "vesper_dial",
  create(scene, phaser, props) {
    return createVesperDial(scene, phaser, props);
  },
};
export default skin;
