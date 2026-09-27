/**
 * step_bridge · skin floating_steps (trig e4 "The Solving Span"; trig §5.4, docs/design/20 §4.3 slots socket, stone,
 * glyph icons, cradle, pylon, chasm_edge, relief, console). Four glowing elliptical sockets float over the chasm on a
 * gentle arc; five glyph stones wait in a brass cradle beside the console (in view display order); two dark anchor
 * pylons on the far bank carry the x₁ / x₂ pins; the `2 sin x` relief is inlaid in the near cliff face under the walk
 * line, with a turquoise water line at y = 1 and a brass plumb marker on a rail.
 *
 * Live: a placed stone lifts from the cradle and flies on an arc (0.45 s) to its socket and hovers (±4 at 0.5 Hz, a faint
 * cyan underglow); removed stones fly back; every placed stone looks the same, the decoy included. When all four are
 * seated a faint dotted guide runs to the far anchors ("ready", never a verdict). The probe x slides the plumb bob along
 * the rail and drops it to the relief height; where the relief crosses the water line it glints (a property of the
 * equation on the card, independent of the order).
 *
 * Success: each stone drops into its socket in turn (0.5 s apart) with a dust puff and a gold seam, beacon x₁ then x₂
 * ignite, the anchor cables snap taut, the seams fuse into one span. Failure (from Diagnosis): the correct prefix locks
 * gold; x₁ glows faintly while x₂ stays dark with a slack cable; the out-of-place stone tilts 20°, grinds and sinks back
 * to hover, later stones dim; a decoy crumbles into the chasm and re-forms; an empty socket wobbles.
 *
 * Code-drawn stand-ins in the biome palette (kit art, §0.1.6 fallback ladder step 1); world text is DOM (chips, pins).
 */
import type Phaser from "phaser";
import type { StepBridgeConfig } from "@/world/contraptions/step-bridge.config";
import { bayPos, reliefCrossings, type StepBridgePose } from "@/world/contraptions/step-bridge.meta";
import { evalExpr } from "@/world/contraptions/claim-holders.meta";
import { viewRows } from "@/world/contraptions/config-parts";
import type { FailBeat, FailurePlan, SuccessBeat, SuccessPlan } from "@/world/types";
import type { ContraptionState, PoseView, PrefabProps, SkinPrefab, XY } from "../../../types";
import {
  Anims,
  chasmOf,
  dashedLine,
  drawLectern,
  easeInOutSine,
  easeOutCubic,
  fillPoly,
  FlightTracker,
  linear,
  mix,
  orreryColors,
  reliefLocal,
  setAnchor,
  softStroke,
  stoneGlyphOf,
  waitMs,
  type OrreryColors,
  type StoneGlyph,
} from "../shared";

const PI = Math.PI;
const STONE = { w: 220, h: 68 } as const;
const CRADLE_STONE = { w: 170, h: 52 } as const;
const BAY_GAP = 66;
const PYLON_H = 300;
const RELIEF = { w: 480, h: 200 } as const;
const ROCK = { base: 0x5f7b7a, light: 0x8fa6a0, shade: 0x3f5857 } as const; // bible §2.1 rock.*
const CRYSTAL = { hi: 0xc9f3ff, base: 0x6ed2f2, shade: 0x2e8fc0 } as const; // bible §2.1 crystal.*

interface Ov {
  lock: Map<number, number>; // slot → gold seam 0…1 (prefix locks, success locks)
  settle: Map<number, number>; // slot → settle dip 0…1 (success drop)
  tip: { slot: number; deg: number; p: number } | null;
  grind: number;
  sink: number;
  dimFrom: number | null; // slots ≥ this dim to 50 %
  crumble: { slot: number; p: number } | null;
  wobble: { slot: number; p: number } | null;
  beaconA: number;
  beaconB: number;
  slackB: number; // x₂'s cable hangs slack (failure)
  cables: number; // cables taut 0…1 (success)
  fuse: number; // seams fuse into one span 0…1
}

/** A glyph icon on a stone (what the step SAYS), centred on `at`, `s` ≈ 40. */
function drawGlyph(g: Phaser.GameObjects.Graphics, glyph: StoneGlyph, at: XY, s: number, col: number, c: OrreryColors, alpha: number): void {
  g.lineStyle(3, col, alpha);
  g.fillStyle(col, alpha);
  const { x, y } = at;
  switch (glyph) {
    case "balance_div2": {
      // a balance beam over a ÷ sign
      g.lineBetween(x - s * 0.5, y - s * 0.25, x + s * 0.5, y - s * 0.25);
      g.lineBetween(x, y - s * 0.25, x, y + s * 0.35);
      g.fillTriangle(x - s * 0.15, y + s * 0.4, x + s * 0.15, y + s * 0.4, x, y + s * 0.25);
      g.fillCircle(x - s * 0.5, y - s * 0.1, s * 0.08);
      g.fillCircle(x + s * 0.5, y - s * 0.1, s * 0.08);
      g.lineBetween(x + s * 0.18, y + s * 0.02, x + s * 0.42, y + s * 0.02);
      g.fillCircle(x + s * 0.3, y - s * 0.08, s * 0.04);
      g.fillCircle(x + s * 0.3, y + s * 0.12, s * 0.04);
      break;
    }
    case "angle_wedge": {
      // a 30° wedge with its arc
      g.lineBetween(x - s * 0.45, y + s * 0.3, x + s * 0.5, y + s * 0.3);
      g.lineBetween(x - s * 0.45, y + s * 0.3, x - s * 0.45 + s * 0.95 * Math.cos(PI / 6), y + s * 0.3 - s * 0.95 * Math.sin(PI / 6));
      g.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * (PI / 6);
        const px = x - s * 0.45 + s * 0.45 * Math.cos(a);
        const py = y + s * 0.3 - s * 0.45 * Math.sin(a);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
      break;
    }
    case "upper_half_circle": {
      // a circle with its upper half shaded (quadrants I and II)
      g.fillStyle(c.fnH, 0.55 * alpha);
      const pts: XY[] = [];
      for (let i = 0; i <= 16; i++) pts.push({ x: x + s * 0.42 * Math.cos(PI + (PI * i) / 16), y: y + s * 0.42 * Math.sin(PI + (PI * i) / 16) });
      fillPoly(g, pts);
      g.strokeCircle(x, y, s * 0.42);
      g.lineBetween(x - s * 0.5, y, x + s * 0.5, y);
      break;
    }
    case "twin_beacons": {
      for (const dx of [-0.25, 0.25]) {
        g.fillTriangle(x + dx * s - s * 0.1, y + s * 0.35, x + dx * s + s * 0.1, y + s * 0.35, x + dx * s, y - s * 0.15);
        g.fillCircle(x + dx * s, y - s * 0.25, s * 0.1);
      }
      break;
    }
    case "arcsin_arrow": {
      // an arrow aimed into a circle
      g.strokeCircle(x + s * 0.2, y, s * 0.3);
      g.lineBetween(x - s * 0.55, y + s * 0.3, x + s * 0.05, y - s * 0.05);
      g.fillTriangle(x + s * 0.12, y - s * 0.1, x - s * 0.04, y - s * 0.12, x + s * 0.04, y + s * 0.04);
      break;
    }
    default:
      g.strokeCircle(x, y, s * 0.3);
      g.fillCircle(x, y, s * 0.08);
  }
}

function createFloatingSteps(scene: Phaser.Scene, P: typeof Phaser, props: PrefabProps<StepBridgeConfig>): PoseView<StepBridgePose> {
  const { station, fx, reducedMotion, config } = props;
  const c = orreryColors(props.palette);
  const groundLocal = props.groundY - station.anchor.y;
  const floor = Math.max(-40, Math.min(300, groundLocal));
  const consoleLocal: XY = { x: station.consoleX - station.anchor.x, y: groundLocal };
  const chasm = chasmOf(station);
  const planks = viewRows(props.view, "planks").map((r) => r.key);
  const n = Math.max(1, Number((props.view as { slots?: unknown } | null)?.slots) || Math.max(1, planks.length - 1));
  const bays = Array.from({ length: n }, (_, j) => bayPos("floating", n, j));
  const rackX = Math.min(consoleLocal.x + 170, chasm.left - 110);
  const cradleAt = (i: number): XY => ({ x: rackX, y: floor - 40 - BAY_GAP * i });
  const lip: XY = { x: chasm.left - 248, y: floor + 100 };
  // the anchor pylons stand on the far lip (the doc's +150 / +318 falls outside a board-layout frame at minZoom)
  const pylonA: XY = { x: chasm.right + 60, y: floor - PYLON_H };
  const pylonB: XY = { x: chasm.right + 200, y: floor - PYLON_H };
  const crossings = config.relief ? reliefCrossings(config.relief.expr, config.relief.line) : [];
  const anims = new Anims(reducedMotion);
  const flights = new FlightTracker(450, 120, reducedMotion);
  const ov: Ov = { lock: new Map(), settle: new Map(), tip: null, grind: 0, sink: 0, dimFrom: null, crumble: null, wobble: null, beaconA: 0, beaconB: 0, slackB: 0, cables: 0, fuse: 0 };
  let pose: StepBridgePose | null = null;
  let state: ContraptionState = "dormant";
  let dead = false;
  let clock = 0;

  const root = scene.add.container(station.anchor.x, station.anchor.y);
  const staticG = scene.add.graphics(); // chasm lips, mist, relief band, rack, pylons
  const socketG = scene.add.graphics();
  const guideG = scene.add.graphics();
  const cableG = scene.add.graphics();
  const stoneG = scene.add.graphics();
  const markerG = scene.add.graphics();
  const beaconG = scene.add.graphics();
  const consoleG = scene.add.graphics();
  root.add([staticG, guideG, socketG, cableG, consoleG, stoneG, markerG, beaconG]);
  const beaconGlowA = fx.glow(root, pylonA, 110, CRYSTAL.base, 0);
  const beaconGlowB = fx.glow(root, pylonB, 110, CRYSTAL.base, 0);
  const underglow = bays.map((b) => fx.glow(root, { x: b.x, y: b.y + 46 }, 90, c.beam, 0));

  // ---------------------------------------------------------------- static: chasm lips, mist, relief band, rack, pylons
  const drawStatic = () => {
    const g = staticG;
    g.clear();
    // mist rising from the chasm (soft stacked strokes, bible §5.2 L6 treatment)
    softStroke(g, () => g.lineBetween(chasm.left + 30, floor + 420, chasm.right - 30, floor + 420), 0xffffff, 120, 0.28, 5);
    softStroke(g, () => g.lineBetween(chasm.left + 60, floor + 260, chasm.right - 60, floor + 260), 0xffffff, 60, 0.14, 4);
    // the two chasm lips: grey-teal rock faces (the bank is on the far side of `x` from the chasm) with blue crystal
    // roots poking out into the chasm
    for (const side of [-1, 1] as const) {
      const x = side < 0 ? chasm.left : chasm.right;
      const bank = side; // −1: the near bank is to the left of its lip; +1: the far bank to the right
      const face: XY[] = [
        { x, y: floor },
        { x: x - bank * 6, y: floor + 120 },
        { x: x + bank * 14, y: floor + 260 },
        { x: x - bank * 4, y: floor + 520 },
        { x: x + bank * 90, y: floor + 520 },
        { x: x + bank * 90, y: floor },
      ];
      g.fillStyle(ROCK.shade, 1);
      fillPoly(g, face);
      g.fillStyle(ROCK.base, 1);
      fillPoly(g, face.map((q) => ({ x: q.x + bank * 18, y: q.y })));
      g.fillStyle(ROCK.light, 1);
      g.fillRect(side < 0 ? x - 90 : x + 16, floor, 74, 10);
      for (let k = 0; k < 4; k++) {
        const cy = floor + 140 + k * 90;
        const cx = x - bank * (4 + (k % 2) * 8);
        g.fillStyle(CRYSTAL.shade, 1);
        g.fillTriangle(cx, cy, cx - bank * 30, cy + 10, cx - bank * 6, cy + 34);
        g.fillStyle(CRYSTAL.base, 1);
        g.fillTriangle(cx, cy, cx - bank * 26, cy + 8, cx - bank * 10, cy + 22);
      }
    }
    // the lip relief: a stone band set into the near cliff face under the walk line
    const bx = lip.x - RELIEF.w / 2;
    const by = lip.y - RELIEF.h / 2;
    g.fillStyle(c.stoneDeep, 1);
    g.fillRoundedRect(bx - 12, by - 8, RELIEF.w + 24, RELIEF.h + 16, 10);
    g.fillStyle(c.stoneShade, 1);
    g.fillRoundedRect(bx, by, RELIEF.w, RELIEF.h, 8);
    g.fillStyle(c.goldDeep, 1);
    g.fillRect(bx - 12, by - 8, RELIEF.w + 24, 8);
    if (config.relief) {
      // the water line y = line (turquoise inlay) and the relief curve (bronze inlay)
      const lineY = Number(config.relief.line);
      const wl = reliefLocal(0, Number.isFinite(lineY) ? lineY : 1);
      g.lineStyle(5, c.waterShallow, 1);
      g.lineBetween(bx + 6, lip.y + wl.y, bx + RELIEF.w - 6, lip.y + wl.y);
      g.lineStyle(2, c.waterDeep, 1);
      g.lineBetween(bx + 6, lip.y + wl.y + 3, bx + RELIEF.w - 6, lip.y + wl.y + 3);
      g.lineStyle(6, c.bronze, 1);
      g.beginPath();
      for (let i = 0; i <= 120; i++) {
        const x = (i / 120) * 2 * PI;
        const v = evalRelief(x);
        const p = reliefLocal(x, v ?? 0);
        if (i === 0) g.moveTo(lip.x + p.x, lip.y + p.y);
        else g.lineTo(lip.x + p.x, lip.y + p.y);
      }
      g.strokePath();
      g.lineStyle(2, c.brassHi, 1);
      g.beginPath();
      for (let i = 0; i <= 120; i++) {
        const x = (i / 120) * 2 * PI;
        const p = reliefLocal(x, evalRelief(x) ?? 0);
        if (i === 0) g.moveTo(lip.x + p.x, lip.y + p.y - 2);
        else g.lineTo(lip.x + p.x, lip.y + p.y - 2);
      }
      g.strokePath();
      // the brass rail the plumb marker rides
      g.fillStyle(c.brassDeep, 1);
      g.fillRect(bx, by + 4, RELIEF.w, 7);
      g.fillStyle(c.brassHi, 1);
      g.fillRect(bx, by + 4, RELIEF.w, 3);
    }
    // the brass cradle rack beside the console (5 bays)
    const rackW = CRADLE_STONE.w + 30;
    const rackTop = cradleAt(Math.max(4, planks.length - 1)).y - CRADLE_STONE.h / 2 - 22;
    g.fillStyle(c.shadow, 0.25);
    g.fillEllipse(rackX + 20, floor - 2, rackW + 70, 16);
    g.fillStyle(c.brassDeep, 1);
    g.fillRect(rackX - rackW / 2, rackTop, 12, floor - rackTop);
    g.fillRect(rackX + rackW / 2 - 12, rackTop, 12, floor - rackTop);
    g.fillStyle(c.brass, 1);
    g.fillRect(rackX - rackW / 2, rackTop, 7, floor - rackTop);
    g.fillRect(rackX + rackW / 2 - 12, rackTop, 7, floor - rackTop);
    g.fillStyle(c.goldDeep, 1);
    g.fillRect(rackX - rackW / 2 - 8, rackTop - 10, rackW + 16, 12);
    for (let i = 0; i < Math.max(5, planks.length); i++) {
      const at = cradleAt(i);
      g.fillStyle(c.brassDeep, 1);
      g.fillRect(rackX - rackW / 2 + 6, at.y + CRADLE_STONE.h / 2 + 2, rackW - 12, 6);
    }
    // the anchor pylons on the far bank (column + dark beacon crystal cluster)
    for (const at of [pylonA, pylonB]) {
      g.fillStyle(c.shadow, 0.25);
      g.fillEllipse(at.x + 16, floor - 2, 110, 14);
      g.fillStyle(c.stoneShade, 1);
      g.fillRect(at.x - 22, at.y + 40, 44, floor - at.y - 40);
      g.fillStyle(c.stoneBase, 1);
      g.fillRect(at.x - 22, at.y + 40, 24, floor - at.y - 40);
      g.fillStyle(c.gold, 1);
      g.fillRect(at.x - 30, at.y + 34, 60, 12);
      g.fillRect(at.x - 30, floor - 20, 60, 20);
      g.fillStyle(c.navy, 1);
      g.fillRect(at.x - 22, floor - 60, 44, 8);
    }
  };
  /** The card's relief expression (mathjs through the meta's evaluator), drawn once into the static band. */
  function evalRelief(x: number): number | null {
    return config.relief ? evalExpr(config.relief.expr, x) : null;
  }
  drawStatic();

  const drawConsole = (lit: number) => {
    consoleG.clear();
    drawLectern(consoleG, consoleLocal, c, lit);
  };
  drawConsole(0);

  // ---------------------------------------------------------------- anchors
  const anchors: Record<string, XY> & { console: XY } = {
    console: consoleLocal,
    lip_relief: { ...lip },
    pylon_a: { x: pylonA.x, y: pylonA.y + 10 },
    pylon_b: { x: pylonB.x, y: pylonB.y + 10 },
    marker: { x: lip.x, y: lip.y },
    payoff: { x: (chasm.left + chasm.right) / 2, y: 0 },
  };
  bays.forEach((b, j) => (anchors[`socket_${j}`] = { x: b.x, y: b.y - 8 }));
  for (let i = 0; i < Math.max(5, planks.length); i++) anchors[`cradle_${i}`] = { x: cradleAt(i).x, y: cradleAt(i).y - CRADLE_STONE.h / 2 };

  // ---------------------------------------------------------------- per-frame drawing
  const socketCentre = (j: number): XY => ({ x: bays[j].x, y: bays[j].y + 46 });
  const stoneRest = (j: number, bob: number): XY => ({ x: bays[j].x, y: bays[j].y + STONE.h / 2 + bob });

  const render = () => {
    const p = pose;
    if (!p) return;
    const lit = state === "dormant" ? 0 : 1;
    const solved = p.solved;
    // --- sockets: dormant grey rings, occupied ones glow cyan
    socketG.clear();
    bays.forEach((_, j) => {
      const at = socketCentre(j);
      const fill = p.bayFill[j] ?? 0;
      const wob = ov.wobble && ov.wobble.slot === j ? 6 * Math.sin(ov.wobble.p * PI * 6) * (1 - ov.wobble.p) : 0;
      const col = mix(0x8a97a0, c.beam, lit * (0.35 + 0.65 * fill));
      socketG.lineStyle(10, mix(c.navyDark, col, 0.5), 0.9);
      socketG.strokeEllipse(at.x + wob, at.y, 150, 62);
      socketG.lineStyle(5, col, 0.95);
      socketG.strokeEllipse(at.x + wob, at.y, 140, 56);
      underglow[j].setAlpha(lit * fill * (solved ? 0.25 : 0.45));
    });
    // --- guide: faint dotted "ready" line to the far anchors (never a verdict)
    guideG.clear();
    if (p.guide > 0.01 && !solved && lit) {
      guideG.lineStyle(3, c.beam, 0.45 * p.guide);
      const pts: XY[] = [...bays.map((b) => ({ x: b.x, y: b.y + 20 })), { x: pylonA.x, y: floor - 40 }, { x: pylonB.x, y: floor - 40 }];
      for (let k = 0; k + 1 < pts.length; k++) dashedLine(guideG, pts[k], pts[k + 1], 8, 12);
    }
    // --- cables: taut to both pylons on success; on a partial failure x₂'s hangs slack
    cableG.clear();
    const spanEnd: XY = { x: bays[n - 1].x + STONE.w / 2, y: bays[n - 1].y + 20 };
    const taut = solved ? 1 : ov.cables;
    const drawCable = (to: XY, sag: number, alpha: number) => {
      cableG.lineStyle(5, c.brassDeep, alpha);
      cableG.beginPath();
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        const x = spanEnd.x + (to.x - spanEnd.x) * u;
        const y = spanEnd.y + (to.y - spanEnd.y) * u + sag * Math.sin(PI * u);
        if (i === 0) cableG.moveTo(x, y);
        else cableG.lineTo(x, y);
      }
      cableG.strokePath();
    };
    if (taut > 0) {
      drawCable({ x: pylonA.x, y: pylonA.y + 60 }, 70 * (1 - taut), taut);
      drawCable({ x: pylonB.x, y: pylonB.y + 60 }, 70 * (1 - taut), taut);
    } else if (ov.slackB > 0) drawCable({ x: pylonB.x, y: pylonB.y + 60 }, 150, 0.8 * ov.slackB);
    // --- beacons (dark crystals; faint on a partial solve; lit on success)
    beaconG.clear();
    const bA = solved ? 1 : ov.beaconA;
    const bB = solved ? 1 : ov.beaconB;
    [[pylonA, bA], [pylonB, bB]].forEach(([at, b]) => {
      const q = at as XY;
      const k = b as number;
      const col = mix(0x31495a, CRYSTAL.base, k);
      beaconG.fillStyle(mix(0x223440, CRYSTAL.shade, k), 1);
      beaconG.fillTriangle(q.x - 34, q.y + 40, q.x - 8, q.y - 36, q.x + 4, q.y + 40);
      beaconG.fillStyle(col, 1);
      beaconG.fillTriangle(q.x - 12, q.y + 40, q.x + 6, q.y - 58, q.x + 26, q.y + 40);
      beaconG.fillStyle(mix(0x42606f, CRYSTAL.hi, k), 1);
      beaconG.fillTriangle(q.x + 8, q.y + 40, q.x + 28, q.y - 18, q.x + 38, q.y + 40);
    });
    beaconGlowA.setAlpha(0.85 * bA * lit);
    beaconGlowB.setAlpha(0.85 * bB * lit);
    // --- stones: fly between cradle bays and sockets; hover; the plan's locks, tips, sinks and crumbles
    const targets = new Map<string, { id: string; pos: XY }>();
    planks.forEach((key, i) => {
      const j = p.plankBay[i] ?? null;
      const bob = j !== null && !solved && !ov.lock.has(j) && !reducedMotion ? 4 * Math.sin((clock / 1000) * PI + j) : 0;
      targets.set(key, j === null ? { id: `cradle:${i}`, pos: cradleAt(i) } : { id: `bay:${j}`, pos: stoneRest(j, bob) });
    });
    flights.aim(targets);
    stoneG.clear();
    planks.forEach((key, i) => {
      const j = p.plankBay[i] ?? null;
      const at = flights.pos(key) ?? cradleAt(i);
      const inAir = flights.flying(key);
      const seated = j !== null && !inAir;
      const w = seated || inAir ? STONE.w : CRADLE_STONE.w;
      const h = seated || inAir ? STONE.h : CRADLE_STONE.h;
      let rot = 0;
      let dy = 0;
      let alpha = 1;
      let scale = 1;
      if (seated && j !== null) {
        if (ov.tip && ov.tip.slot === j) {
          rot = (ov.tip.deg * PI * ov.tip.p) / 180 + ov.grind;
          dy = 40 * ov.sink;
        }
        if (ov.dimFrom !== null && j > ov.dimFrom) alpha = 0.5;
        if (ov.crumble && ov.crumble.slot === j) {
          const q = ov.crumble.p;
          scale = q < 0.5 ? 1 - q * 1.6 : 0.2 + (q - 0.5) * 1.6;
          dy += q < 0.5 ? 260 * q * q * 4 : 0;
          alpha = q < 0.5 ? 1 - q * 2 : (q - 0.5) * 2;
        }
        dy += 6 * Math.sin(PI * (ov.settle.get(j) ?? 0));
      }
      const focus = p.focus === key && lit > 0 && !solved;
      const seam = seated && j !== null ? Math.max(ov.lock.get(j) ?? 0, solved ? 1 : 0, ov.fuse) : 0;
      drawStone(stoneG, { x: at.x, y: at.y + dy }, w * scale, h * scale, rot, stoneGlyphOf(config, key), alpha, focus, seam, lit);
      if (j === null && !inAir) setAnchor(anchors, `cradle_${i}`, at.x, at.y - h / 2);
    });
    // --- the plumb marker on the relief (probe x) and the crossing glints
    markerG.clear();
    if (p.marker && config.relief) {
      const tip: XY = { x: lip.x + p.marker.x, y: lip.y + p.marker.y };
      const railY = lip.y - RELIEF.h / 2 + 8;
      markerG.lineStyle(2, c.brassDeep, 1);
      markerG.lineBetween(tip.x, railY, tip.x, tip.y - 14);
      markerG.fillStyle(c.brass, 1);
      markerG.fillRoundedRect(tip.x - 12, railY - 8, 24, 14, 4);
      markerG.fillStyle(c.bronze, 1);
      markerG.fillTriangle(tip.x - 10, tip.y - 20, tip.x + 10, tip.y - 20, tip.x, tip.y);
      markerG.fillStyle(c.beam, 0.9 * lit);
      markerG.fillCircle(tip.x, tip.y - 14, 4);
      setAnchor(anchors, "marker", tip.x, tip.y - 20);
      if (p.glint !== null && crossings[p.glint] !== undefined) {
        const lineY = Number(config.relief.line);
        const g0 = reliefLocal(crossings[p.glint], Number.isFinite(lineY) ? lineY : 1);
        const gx = lip.x + g0.x;
        const gy = lip.y + g0.y;
        const s = 16 + 4 * Math.sin(clock / 60);
        markerG.fillStyle(0xffffff, 0.95);
        fillPoly(markerG, [
          { x: gx, y: gy - s },
          { x: gx + s * 0.22, y: gy - s * 0.22 },
          { x: gx + s, y: gy },
          { x: gx + s * 0.22, y: gy + s * 0.22 },
          { x: gx, y: gy + s },
          { x: gx - s * 0.22, y: gy + s * 0.22 },
          { x: gx - s, y: gy },
          { x: gx - s * 0.22, y: gy - s * 0.22 },
        ]);
      }
    }
    drawConsole(state === "dormant" ? 0 : state === "solved" ? 0.6 : 1);
  };

  function drawStone(g: Phaser.GameObjects.Graphics, at: XY, w: number, h: number, rot: number, glyph: StoneGlyph, alpha: number, focus: boolean, seam: number, lit: number): void {
    if (w < 2 || alpha <= 0.01) return;
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    const pt = (dx: number, dy: number): XY => ({ x: at.x + dx * cs - dy * sn, y: at.y + dx * sn + dy * cs });
    const rect = (x0: number, y0: number, x1: number, y1: number) => [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)];
    g.fillStyle(c.stoneDeep, alpha);
    fillPoly(g, rect(-w / 2, -h / 2 + 4, w / 2, h / 2 + 4));
    g.fillStyle(c.stoneShade, alpha);
    fillPoly(g, rect(-w / 2, -h / 2, w / 2, h / 2));
    g.fillStyle(c.stoneLit, alpha);
    fillPoly(g, rect(-w / 2, -h / 2, w / 2, -h / 2 + 12));
    g.fillStyle(c.stoneBase, alpha);
    fillPoly(g, rect(-w / 2 + 6, -h / 2 + 12, -w / 2 + w * 0.55, h / 2 - 6));
    // the glyph plate
    const plate = rect(-h * 0.45, -h * 0.34, h * 0.45, h * 0.4);
    g.fillStyle(c.navy, alpha);
    fillPoly(g, plate);
    drawGlyph(g, glyph, pt(0, h * 0.03), h * 0.62, mix(c.goldHi, 0xffffff, 0.2), c, alpha);
    // gold seams (locked / fused)
    if (seam > 0) {
      g.fillStyle(c.goldHi, alpha * seam);
      fillPoly(g, rect(-w / 2, h / 2 - 7, w / 2, h / 2));
      fillPoly(g, rect(-w / 2, -h / 2, -w / 2 + 6, h / 2));
      fillPoly(g, rect(w / 2 - 6, -h / 2, w / 2, h / 2));
    }
    if (focus) {
      g.lineStyle(4, c.beam, 0.9 * lit);
      g.beginPath();
      const r = rect(-w / 2 - 6, -h / 2 - 6, w / 2 + 6, h / 2 + 6);
      r.forEach((q, i) => (i === 0 ? g.moveTo(q.x, q.y) : g.lineTo(q.x, q.y)));
      g.closePath();
      g.strokePath();
    }
  }

  const later = (ms: number, fn: () => void) => anims.add(ms, 1, () => undefined, linear, fn);
  const slotOf = (anchor: string): number | null => {
    const m = /_(\d+)$/.exec(anchor);
    return m ? Number(m[1]) : null;
  };
  const resetOv = () => {
    ov.lock.clear();
    ov.settle.clear();
    Object.assign(ov, { tip: null, grind: 0, sink: 0, dimFrom: null, crumble: null, wobble: null, beaconA: 0, beaconB: 0, slackB: 0, cables: 0, fuse: 0 });
  };

  const view: PoseView<StepBridgePose> = {
    root,
    anchors,
    applyPose(p: StepBridgePose) {
      pose = p;
      render();
    },
    setState(s: ContraptionState) {
      if (s === state) return;
      state = s;
      try {
        fx.dormancy(root, s === "dormant", reducedMotion ? 0 : 600);
      } catch {
        root.setAlpha(s === "dormant" ? 0.8 : 1);
      }
      render();
    },
    async playSucceed(plan: SuccessPlan, solved: StepBridgePose) {
      resetOv();
      for (const b of plan.beats as readonly SuccessBeat[]) {
        const j = slotOf(b.anchor);
        if (b.action === "lock" && j !== null && b.anchor.startsWith("socket_")) {
          anims.add(b.atMs, 260, (t) => ov.settle.set(j, t), linear, () => ov.settle.delete(j));
          anims.add(b.atMs + 120, 220, (t) => ov.lock.set(j, t), easeOutCubic);
          later(b.atMs + 140, () => {
            if (!reducedMotion && bays[j]) fx.burst(root, { x: bays[j].x, y: bays[j].y + STONE.h }, "dust");
          });
        } else if (b.action === "ignite" && b.anchor === "pylon_a") {
          anims.add(b.atMs, 300, (t) => (ov.beaconA = t), easeOutCubic);
          anims.add(b.atMs, 380, (t) => (ov.cables = Math.max(ov.cables, t * 0.6)), easeOutCubic);
        } else if (b.action === "ignite" && b.anchor === "pylon_b") {
          anims.add(b.atMs, 300, (t) => (ov.beaconB = t), easeOutCubic);
          anims.add(b.atMs, 240, (t) => (ov.cables = 0.6 + 0.4 * t), easeOutCubic);
          later(b.atMs, () => {
            if (!reducedMotion) fx.burst(root, pylonB, "motes");
          });
        } else if (typeof b.params?.anim === "string") anims.add(b.atMs, 300, (t) => (ov.fuse = t), easeInOutSine);
      }
      await waitMs(scene, reducedMotion ? Math.min(400, plan.durationMs) : plan.durationMs, () => dead);
      if (dead) return;
      anims.clear();
      resetOv();
      view.applyPose(solved);
    },
    async playFail(plan: FailurePlan, current: StepBridgePose) {
      void current;
      resetOv();
      for (const b of plan.beats as readonly FailBeat[]) {
        const j = slotOf(b.anchor);
        const slot = typeof b.params?.slot === "number" ? b.params.slot : j;
        if (b.action === "hold_bright" && j !== null) anims.add(b.atMs, 200, (t) => ov.lock.set(j, t), easeOutCubic);
        else if (b.action === "flash" && b.anchor === "pylon_a") {
          const glow = typeof b.params?.glow === "number" ? b.params.glow : 0.4;
          anims.add(b.atMs, 300, (t) => (ov.beaconA = glow * t), easeOutCubic);
        } else if (b.action === "dim" && b.anchor === "pylon_b") anims.add(b.atMs, 300, (t) => (ov.slackB = t), easeOutCubic);
        else if (b.action === "tip" && slot !== null) {
          const deg = typeof b.params?.deg === "number" ? b.params.deg : 20;
          anims.add(b.atMs, 180, (t) => (ov.tip = { slot, deg, p: t }), easeOutCubic);
        } else if (b.action === "grind") anims.add(b.atMs, 300, (t) => (ov.grind = 0.05 * Math.sin(t * PI * 8) * (1 - t)), linear);
        else if (b.action === "sink") anims.add(b.atMs, 360, (t) => (ov.sink = Math.sin(t * PI)), easeInOutSine);
        else if (b.action === "dim" && j !== null) ov.dimFrom = ov.dimFrom === null ? j - 1 : Math.min(ov.dimFrom, j - 1);
        else if (b.action === "scatter" && slot !== null) {
          anims.add(b.atMs, 1100, (t) => (ov.crumble = { slot, p: t }), linear, () => (ov.crumble = null));
          later(b.atMs + 60, () => {
            if (!reducedMotion && bays[slot]) fx.burst(root, { x: bays[slot].x, y: bays[slot].y + STONE.h / 2 }, "dust");
          });
        } else if (b.action === "wobble" && j !== null) anims.add(b.atMs, 600, (t) => (ov.wobble = { slot: j, p: t }), linear, () => (ov.wobble = null));
      }
      // the tipped stone slides back to hover before the plan ends
      const end = Math.min(1600, plan.durationMs);
      anims.add(end - 380, 320, (t) => {
        if (ov.tip) ov.tip = { ...ov.tip, p: 1 - t };
      }, easeInOutSine);
      await waitMs(scene, end, () => dead);
      if (dead) return;
      anims.clear();
      resetOv();
      render();
    },
    update(dtMs: number) {
      if (dead) return;
      clock += dtMs;
      anims.update(dtMs);
      flights.step(dtMs);
      render();
    },
    destroy() {
      dead = true;
      anims.clear();
      root.destroy(true);
    },
  };
  void P;
  return view;
}

export const skin: SkinPrefab<StepBridgeConfig, StepBridgePose> = {
  skinId: "floating_steps",
  create(scene, phaser, props) {
    return createFloatingSteps(scene, phaser, props);
  },
};
export default skin;
