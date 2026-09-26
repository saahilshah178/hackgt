/**
 * ring_gate · skin ring_gate (trig e2, "The Tidewheel Gate"; trig §5.2, bible P3; docs/design/20 §4.3 slots gate_wall,
 * outer_ring, inner_disc, fin_l, fin_r, tally_wheel, pawl, canal, skiff, console). A cream-and-gold wall with navy
 * grooves and a dark arched doorway recess at the rings' 6 o'clock; the outer ring (engraved wave band, notch at its
 * 6 o'clock) turns clockwise by the wave's phase advance; the inner disc (doorway cutout) rocks by the wave's value;
 * the keystone fin halves sit above; a small escapement tally wheel counts laps; a bronze pawl waits on the right.
 *
 * Live: the rings follow the eased pose (the controller's release replay sweeps 0 → T), the tally ratchets, a thin
 * navy arc on the wall shows the notch misalignment δ as an angle only. Success: the pawl drops into tooth I, both
 * rings lap once more and stop with notch and cutout at 6 o'clock, the fins split, light pours through the doorway and
 * the water surges down the canal; a skiff floats in. Failure: the pawl strikes the rim (spark) or, when the notch is
 * home after two laps, slips on tooth II; the misalignment arc pulses twice.
 *
 * Code-drawn stand-ins in the biome palette (kit art, §0.1.6 fallback ladder step 1); world text is DOM (chips).
 */
import type Phaser from "phaser";
import type { RingGateConfig } from "@/world/contraptions/ring-gate.config";
import {
  CANAL,
  DOOR_H,
  DOOR_W,
  FIN_GAP,
  FIN_SPLIT,
  FIN_Y,
  FLOOR_Y,
  INNER_R,
  NOTCH_W,
  OUTER_R,
  PAWL_PIVOT,
  PAWL_TIP,
  RING_W,
  TALLY_AT,
  TALLY_R,
  WALL,
  WATER_SPEED,
  type RingGatePose,
} from "@/world/contraptions/ring-gate.meta";
import type { FailBeat, FailurePlan, SuccessBeat, SuccessPlan } from "@/world/types";
import type { ContraptionState, PoseView, PrefabProps, SkinPrefab, XY } from "../../../types";
import {
  Anims,
  drawLectern,
  easeInOutSine,
  easeOutCubic,
  fillPoly,
  linear,
  mathArc,
  mix,
  notchScreenAngle,
  orreryColors,
  setAnchor,
  tallyStrokes,
  waitMs,
} from "../shared";

const PI = Math.PI;
const TWO_PI = 2 * PI;
const DOOR_TOP = FLOOR_Y - DOOR_H; // −17: the recess's arch top
const CUT_TOP = INNER_R - DOOR_H; // −51: the inner disc cutout's arch top
const SKIFF_FROM = -1400;
const SKIFF_TO = -760;

interface Overrides {
  /** the success lap: progress, the start phase, the lap boundary it settles on, the inner disc's start rotation */
  spin: { p: number; phase0: number; home: number; innerFrom: number } | null;
  pawl: number | null; // 0 rest … 1 dropped; > 1 slipped past
  fin: number | null;
  light: number | null;
  front: number | null; // canal water front distance from the doorway
  skiff: number | null; // 0 → 1 along the canal
  flash: number; // misalignment arc pulse
  grind: number; // tally jiggle
}

function createRingGate(scene: Phaser.Scene, P: typeof Phaser, props: PrefabProps<RingGateConfig>): PoseView<RingGatePose> {
  const { station, fx, reducedMotion } = props;
  const c = orreryColors(props.palette);
  const groundLocal = props.groundY - station.anchor.y;
  const consoleLocal: XY = { x: station.consoleX - station.anchor.x, y: groundLocal };
  const anims = new Anims(reducedMotion);
  const ov: Overrides = { spin: null, pawl: null, fin: null, light: null, front: null, skiff: null, flash: 0, grind: 0 };
  let pose: RingGatePose | null = null;
  let state: ContraptionState = "dormant";
  let dead = false;
  let dirty = true;

  const root = scene.add.container(station.anchor.x, station.anchor.y);
  const wallG = scene.add.graphics();
  const canalG = scene.add.graphics();
  const doorG = scene.add.graphics(); // the recess, its light, the water in the doorway
  const lightGlow = fx.glow(root, { x: 0, y: FLOOR_Y - DOOR_H / 2 }, 260, c.starGlow, 0);
  const arcG = scene.add.graphics(); // misalignment arc + the 6 o'clock mark
  const outerC = scene.add.container(0, 0);
  const outerG = scene.add.graphics();
  outerC.add(outerG);
  const innerC = scene.add.container(0, 0);
  const innerG = scene.add.graphics();
  innerC.add(innerG);
  const finL = scene.add.container(0, 0);
  const finR = scene.add.container(0, 0);
  const finLG = scene.add.graphics();
  const finRG = scene.add.graphics();
  finL.add(finLG);
  finR.add(finRG);
  const tallyC = scene.add.container(TALLY_AT.x, TALLY_AT.y);
  const tallyG = scene.add.graphics();
  tallyC.add(tallyG);
  const pawlC = scene.add.container(PAWL_PIVOT.x, PAWL_PIVOT.y);
  const pawlG = scene.add.graphics();
  pawlC.add(pawlG);
  const frontG = scene.add.graphics(); // water front splash, skiff, counterweight
  const consoleG = scene.add.graphics();
  root.add([consoleG, wallG, canalG, doorG]);
  root.bringToTop(lightGlow);
  root.add([arcG, outerC, innerC, finL, finR, tallyC, pawlC, frontG]);

  // ---------------------------------------------------------------- the wall (900 × 760), grooves, gold cap, recess frame
  wallG.fillStyle(c.shadow, 0.2);
  wallG.fillRect(WALL.x + 30, WALL.y + 24, WALL.w, WALL.h - 24);
  wallG.fillStyle(c.stoneShade, 1);
  wallG.fillRect(WALL.x, WALL.y, WALL.w, WALL.h);
  wallG.fillStyle(c.stoneBase, 1);
  wallG.fillRect(WALL.x, WALL.y, WALL.w - 40, WALL.h);
  wallG.fillStyle(c.stoneLit, 0.7);
  wallG.fillRect(WALL.x, WALL.y, 140, WALL.h);
  for (const gx of [-395, -330, 330, 395]) {
    wallG.fillStyle(c.navy, 1);
    wallG.fillRect(gx - 7, WALL.y + 40, 14, WALL.h - 40);
    wallG.fillStyle(c.navyDark, 1);
    wallG.fillRect(gx + 3, WALL.y + 40, 4, WALL.h - 40);
  }
  wallG.fillStyle(c.navy, 1);
  wallG.fillRect(-7, WALL.y + 40, 14, TALLY_AT.y - TALLY_R - 12 - (WALL.y + 40));
  wallG.fillStyle(c.goldDeep, 1);
  wallG.fillRect(WALL.x - 12, WALL.y - 6, WALL.w + 24, 34);
  wallG.fillStyle(c.gold, 1);
  wallG.fillRect(WALL.x - 12, WALL.y - 6, WALL.w + 24, 22);
  wallG.fillStyle(c.goldHi, 1);
  wallG.fillRect(WALL.x - 12, WALL.y - 6, WALL.w + 24, 6);
  // a bezel ring around the rings' seat
  wallG.fillStyle(c.stoneDeep, 1);
  wallG.fillCircle(0, 0, OUTER_R + 26);
  wallG.fillStyle(c.stoneShade, 1);
  wallG.fillCircle(0, 0, OUTER_R + 16);

  // the dry canal trench running left from the gate
  canalG.fillStyle(c.ink, 0.9);
  canalG.fillRect(CANAL.x0, FLOOR_Y - 4, CANAL.x1 - CANAL.x0 + 40, 26);
  canalG.fillStyle(c.stoneDeep, 1);
  canalG.fillRect(CANAL.x0, FLOOR_Y - 8, CANAL.x1 - CANAL.x0 + 40, 5);

  const recess = (g: Phaser.GameObjects.Graphics) => {
    const pts: XY[] = [];
    const r = DOOR_W / 2;
    const cy = DOOR_TOP + r;
    for (let i = 0; i <= 24; i++) {
      const a = PI + (PI * i) / 24;
      pts.push({ x: r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    pts.push({ x: r, y: FLOOR_Y }, { x: -r, y: FLOOR_Y });
    fillPoly(g, pts);
  };

  // ---------------------------------------------------------------- the outer ring: gold rims, cream band, wave band, notch
  let outerLight = -1;
  const drawOuter = (light: number) => {
    if (Math.abs(light - outerLight) < 0.01) return;
    outerLight = light;
    outerG.clear();
    outerG.lineStyle(RING_W, c.stoneBase, 1);
    outerG.strokeCircle(0, 0, OUTER_R - RING_W / 2);
    outerG.lineStyle(6, c.gold, 1);
    outerG.strokeCircle(0, 0, OUTER_R - 1);
    outerG.lineStyle(4, c.goldDeep, 1);
    outerG.strokeCircle(0, 0, INNER_R + 2);
    // the engraved wave band: a sine wave running round the ring
    outerG.lineStyle(3, c.engrave, 1);
    outerG.beginPath();
    for (let i = 0; i <= 240; i++) {
      const a = (TWO_PI * i) / 240;
      const r = OUTER_R - RING_W / 2 + 8 * Math.sin(8 * a);
      const x = r * Math.cos(a);
      const y = r * Math.sin(a);
      if (i === 0) outerG.moveTo(x, y);
      else outerG.lineTo(x, y);
    }
    outerG.strokePath();
    // 12 hour studs so the turn reads at a glance
    for (let k = 0; k < 12; k++) {
      const a = (k * PI) / 6;
      outerG.fillStyle(c.goldDeep, 1);
      outerG.fillCircle((OUTER_R - 4) * Math.cos(a), (OUTER_R - 4) * Math.sin(a), 4);
    }
    // the notch at the ring's local 6 o'clock (+y): a dark cut with gold cheeks
    outerG.fillStyle(light > 0 ? mix(c.navyDark, c.star, 0.85 * light) : c.navyDark, 1);
    outerG.fillRect(-NOTCH_W / 2, INNER_R - 2, NOTCH_W, RING_W + 6);
    outerG.fillStyle(c.gold, 1);
    outerG.fillRect(-NOTCH_W / 2 - 6, INNER_R - 2, 6, RING_W + 6);
    outerG.fillRect(NOTCH_W / 2, INNER_R - 2, 6, RING_W + 6);
  };
  drawOuter(0);

  // ---------------------------------------------------------------- the inner disc: cream, 3 navy inlays, the doorway cutout
  const cutoutPts = (): XY[] => {
    const r = DOOR_W / 2;
    const cy = CUT_TOP + r;
    const pts: XY[] = [];
    for (let i = 0; i <= 20; i++) {
      const a = PI + (PI * i) / 20;
      pts.push({ x: r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    const edgeY = Math.sqrt(INNER_R * INNER_R - r * r);
    const a0 = Math.atan2(edgeY, r);
    const a1 = Math.atan2(edgeY, -r);
    for (let i = 0; i <= 12; i++) {
      const a = a0 + ((a1 - a0) * i) / 12;
      pts.push({ x: INNER_R * Math.cos(a), y: INNER_R * Math.sin(a) });
    }
    return pts;
  };
  const drawInner = (open: number) => {
    innerG.clear();
    innerG.fillStyle(c.stoneShade, 1);
    innerG.fillCircle(0, 0, INNER_R);
    innerG.fillStyle(c.stoneLit, 1);
    innerG.fillCircle(-4, -4, INNER_R - 8);
    for (const r of [150, 118, 86]) {
      innerG.lineStyle(7, c.navy, 1);
      innerG.strokeCircle(0, 0, r);
    }
    innerG.fillStyle(open > 0 ? mix(c.navyDark, c.star, open) : c.navyDark, 1);
    fillPoly(innerG, cutoutPts());
    innerG.lineStyle(4, c.gold, 1);
    innerG.beginPath();
    cutoutPts().forEach((p, i) => (i === 0 ? innerG.moveTo(p.x, p.y) : innerG.lineTo(p.x, p.y)));
    innerG.strokePath();
    innerG.fillStyle(c.goldDeep, 1);
    innerG.fillCircle(0, -86, 22);
    innerG.fillStyle(c.gold, 1);
    innerG.fillCircle(-2, -88, 16);
  };
  drawInner(0);

  // ---------------------------------------------------------------- keystone fins (the crown), tally wheel, pawl
  const finShape = (g: Phaser.GameObjects.Graphics, side: -1 | 1) => {
    const s = side;
    const pts: XY[] = [
      { x: s * FIN_GAP, y: FIN_Y + 42 },
      { x: s * FIN_GAP, y: FIN_Y - 80 },
      { x: s * (FIN_GAP + 30), y: FIN_Y - 50 },
      { x: s * (FIN_GAP + 66), y: FIN_Y + 22 },
      { x: s * (FIN_GAP + 58), y: FIN_Y + 42 },
    ];
    g.fillStyle(c.goldDeep, 1);
    fillPoly(g, pts.map((p) => ({ x: p.x + s * 3, y: p.y + 4 })));
    g.fillStyle(c.gold, 1);
    fillPoly(g, pts);
    g.fillStyle(c.goldHi, 1);
    fillPoly(g, [pts[0], pts[1], { x: s * (FIN_GAP + 12), y: FIN_Y - 60 }, { x: s * (FIN_GAP + 12), y: FIN_Y + 42 }]);
    g.fillStyle(c.navy, 1);
    g.fillCircle(s * (FIN_GAP + 26), FIN_Y + 10, 10);
    g.lineStyle(3, c.goldHi, 1);
    g.strokeCircle(s * (FIN_GAP + 26), FIN_Y + 10, 13);
  };
  finShape(finLG, -1);
  finShape(finRG, 1);

  const drawTally = (count: number) => {
    tallyG.clear();
    tallyG.fillStyle(c.goldDeep, 1);
    for (let k = 0; k < 6; k++) {
      const a = -PI / 2 + (k * TWO_PI) / 6;
      const tip = { x: (TALLY_R + 12) * Math.cos(a), y: (TALLY_R + 12) * Math.sin(a) };
      const l = { x: (TALLY_R - 2) * Math.cos(a - 0.3), y: (TALLY_R - 2) * Math.sin(a - 0.3) };
      const r = { x: (TALLY_R - 2) * Math.cos(a + 0.18), y: (TALLY_R - 2) * Math.sin(a + 0.18) };
      tallyG.fillTriangle(l.x, l.y, tip.x, tip.y, r.x, r.y);
    }
    tallyG.fillStyle(c.gold, 1);
    tallyG.fillCircle(0, 0, TALLY_R);
    tallyG.fillStyle(c.goldHi, 0.8);
    tallyG.fillCircle(-8, -10, TALLY_R - 18);
    tallyG.fillStyle(c.goldDeep, 1);
    tallyG.fillCircle(0, 0, 8);
    // engraved numerals as strokes on each tooth (0 · I · II · III · IIII · V)
    for (let k = 0; k < 6; k++) {
      const a = -PI / 2 + (k * TWO_PI) / 6;
      const at = { x: (TALLY_R - 16) * Math.cos(a), y: (TALLY_R - 16) * Math.sin(a) };
      const strokes = tallyStrokes(k);
      const lit = k === Math.min(5, count);
      tallyG.lineStyle(3, lit ? c.navyDark : c.goldDeep, 1);
      tallyG.fillStyle(lit ? c.navyDark : c.goldDeep, 1);
      const rot = (x: number, y: number) => ({ x: at.x + x * Math.cos(a + PI / 2) - y * Math.sin(a + PI / 2), y: at.y + x * Math.sin(a + PI / 2) + y * Math.cos(a + PI / 2) });
      if (strokes === "ring") tallyG.strokeCircle(at.x, at.y, 4);
      else if (strokes === "V") {
        const p0 = rot(-5, -6);
        const p1 = rot(0, 6);
        const p2 = rot(5, -6);
        tallyG.lineBetween(p0.x, p0.y, p1.x, p1.y);
        tallyG.lineBetween(p1.x, p1.y, p2.x, p2.y);
      } else {
        for (let i = 0; i < strokes; i++) {
          const x = (i - (strokes - 1) / 2) * 4;
          const p0 = rot(x, -6);
          const p1 = rot(x, 6);
          tallyG.lineBetween(p0.x, p0.y, p1.x, p1.y);
        }
      }
    }
  };
  drawTally(0);

  const tipLocal = { x: PAWL_TIP.x - PAWL_PIVOT.x, y: PAWL_TIP.y - PAWL_PIVOT.y };
  pawlG.fillStyle(c.bronze, 1);
  pawlG.fillCircle(0, 0, 16);
  pawlG.lineStyle(14, c.bronze, 1);
  pawlG.lineBetween(0, 0, tipLocal.x, tipLocal.y);
  pawlG.lineStyle(6, c.brassHi, 1);
  pawlG.lineBetween(-2, -4, tipLocal.x * 0.8, tipLocal.y * 0.8 - 4);
  pawlG.fillStyle(c.brassDeep, 1);
  pawlG.fillTriangle(tipLocal.x - 10, tipLocal.y - 6, tipLocal.x + 10, tipLocal.y - 6, tipLocal.x - 2, tipLocal.y + 10);
  pawlG.fillStyle(c.gold, 1);
  pawlG.fillCircle(0, 0, 7);
  const PAWL_REST = 0.38; // lifted clear of the rim (clockwise lifts the tip)

  // ---------------------------------------------------------------- the console
  const drawConsole = (lit: number) => {
    consoleG.clear();
    drawLectern(consoleG, consoleLocal, c, lit);
  };
  drawConsole(0);

  // ---------------------------------------------------------------- anchors
  const anchors: Record<string, XY> & { console: XY } = {
    console: consoleLocal,
    ring_center: { x: 0, y: 0 },
    inner_hub: { x: 0, y: 0 },
    doorway: { x: 0, y: FLOOR_Y - DOOR_H / 2 },
    tally: { x: TALLY_AT.x, y: TALLY_AT.y },
    pawl_tip: { x: PAWL_TIP.x, y: PAWL_TIP.y },
    fin_split: { x: 0, y: FIN_Y - 40 },
    rim: { x: OUTER_R * 0.72, y: -OUTER_R * 0.72 },
    misalign: { x: 0, y: OUTER_R },
    skiff: { x: SKIFF_TO, y: FLOOR_Y - 10 },
    payoff: { x: 0, y: FLOOR_Y - DOOR_H / 2 },
  };

  // ---------------------------------------------------------------- per-frame drawing
  const render = () => {
    const p = pose;
    if (!p) return;
    const lit = state === "dormant" ? 0 : Math.max(p.lit, 0.35);
    const sp = ov.spin;
    // both rings lap once more together and stop with the notch and the cutout at 6 o'clock
    outerC.setRotation(sp ? sp.phase0 + (sp.home - sp.phase0 + TWO_PI) * sp.p : p.phase);
    innerC.setRotation(sp ? sp.innerFrom * (1 - sp.p) + TWO_PI * sp.p : -p.innerAngle);
    const fin = ov.fin ?? p.fin;
    finL.setX(-FIN_SPLIT * fin);
    finR.setX(FIN_SPLIT * fin);
    tallyC.setRotation(-(Math.min(5, p.tally) * TWO_PI) / 6 + ov.grind);
    drawTally(p.tally);
    const pawl = ov.pawl ?? (p.solved ? 1 : 0);
    pawlC.setRotation(PAWL_REST * (1 - Math.min(1, pawl)) - (pawl > 1 ? 0.2 * (pawl - 1) : 0));
    drawConsole(state === "dormant" ? 0 : state === "solved" ? 0.6 : 1);

    // the doorway recess (behind the rings), lit and flooded on success
    const light = ov.light ?? p.doorOpen;
    doorG.clear();
    doorG.fillStyle(mix(c.navyDark, c.star, 0.85 * light), 1);
    recess(doorG);
    lightGlow.setAlpha(0.9 * light);
    drawInner(light);
    drawOuter(light);

    // the misalignment arc: navy, from the notch to the 6 o'clock mark (angle only, no number)
    arcG.clear();
    const notch = notchScreenAngle(p.phase);
    setAnchor(anchors, "misalign", (OUTER_R + 22) * Math.cos(notch), (OUTER_R + 22) * Math.sin(notch));
    if (lit > 0 && !p.solved && !sp && light === 0 && Math.abs(p.misalign) > 0.01) {
      const w = 4 + 6 * ov.flash;
      arcG.lineStyle(w, mix(c.navy, c.amber, ov.flash), 0.55 + 0.45 * Math.max(ov.flash, 0.5));
      mathArc(arcG, { x: 0, y: 0 }, OUTER_R + 22, -PI / 2, -PI / 2 - p.misalign);
      arcG.fillStyle(c.navy, 0.9);
      arcG.fillCircle((OUTER_R + 22) * Math.cos(notch), (OUTER_R + 22) * Math.sin(notch), 6 + 3 * ov.flash);
    }
    arcG.fillStyle(c.gold, 1);
    arcG.fillTriangle(-9, -OUTER_R - 34, 9, -OUTER_R - 34, 0, -OUTER_R - 20); // the 12 o'clock index above the rings

    // canal water and the skiff
    frontG.clear();
    const water = p.water > 0 || ov.front !== null ? 1 : 0;
    if (water > 0) {
      const reach = ov.front ?? (p.water > 0 ? CANAL.x1 - CANAL.x0 + 400 : 0);
      const x0 = Math.max(CANAL.x0, -DOOR_W / 2 - reach);
      frontG.fillStyle(c.waterDeep, 0.95);
      frontG.fillRect(x0, FLOOR_Y - 2, DOOR_W / 2 - x0, 20);
      frontG.fillStyle(c.waterShallow, 0.9);
      frontG.fillRect(x0, FLOOR_Y - 2, DOOR_W / 2 - x0, 6);
      if (ov.front !== null && x0 > CANAL.x0) {
        frontG.fillStyle(0xffffff, 0.8);
        frontG.fillCircle(x0, FLOOR_Y - 4, 12);
        frontG.fillCircle(x0 + 16, FLOOR_Y - 10, 8);
      }
      const sk = ov.skiff ?? (p.water > 0 ? 1 : null);
      if (sk !== null) {
        const sx = SKIFF_FROM + (SKIFF_TO - SKIFF_FROM) * sk;
        frontG.fillStyle(c.bronze, 1);
        fillPoly(frontG, [
          { x: sx - 70, y: FLOOR_Y - 18 },
          { x: sx + 70, y: FLOOR_Y - 18 },
          { x: sx + 52, y: FLOOR_Y + 4 },
          { x: sx - 52, y: FLOOR_Y + 4 },
        ]);
        frontG.fillStyle(c.goldHi, 1);
        frontG.fillRect(sx - 64, FLOOR_Y - 22, 128, 5);
        setAnchor(anchors, "skiff", sx, FLOOR_Y - 20);
      }
    }
    // the counterweight variant: a weight on a chain beside the rings rises with the value
    if (p.counterweight) {
      const cx = OUTER_R + 90;
      const y = 120 - 380 * p.weight;
      frontG.lineStyle(4, c.brassDeep, 1);
      frontG.lineBetween(cx, WALL.y + 30, cx, y - 40);
      frontG.fillStyle(c.bronze, 1);
      frontG.fillRoundedRect(cx - 34, y - 40, 68, 80, 10);
      frontG.fillStyle(c.gold, 1);
      frontG.fillRect(cx - 34, y - 6, 68, 12);
    }
  };

  const later = (ms: number, fn: () => void) => anims.add(ms, 1, () => undefined, linear, fn);

  const view: PoseView<RingGatePose> = {
    root,
    anchors,
    applyPose(p: RingGatePose) {
      pose = p;
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
    async playSucceed(plan: SuccessPlan, solved: RingGatePose) {
      const start = pose;
      // bring the rings to the lap boundary first (the notch is home within the tolerance): the extra lap ends at 0
      const phase0 = start ? start.phase : TWO_PI;
      const home = Math.round(phase0 / TWO_PI) * TWO_PI;
      for (const b of plan.beats as readonly SuccessBeat[]) {
        const ms = typeof b.params?.ms === "number" ? b.params.ms : 400;
        if (b.action === "lock") anims.add(b.atMs, 150, (t) => (ov.pawl = t), easeOutCubic);
        else if (b.action === "spin") {
          const innerFrom = start ? -start.innerAngle : 0;
          anims.add(b.atMs, ms, (t) => (ov.spin = { p: t, phase0, home, innerFrom }), easeOutCubic);
        } else if (b.action === "open") anims.add(b.atMs, ms, (t) => (ov.fin = t), easeInOutSine);
        else if (b.action === "ignite") anims.add(b.atMs, ms, (t) => (ov.light = t), easeOutCubic);
        else if (b.action === "flood") {
          const speed = typeof b.params?.speed === "number" ? b.params.speed : WATER_SPEED;
          anims.add(b.atMs, ms, (t) => (ov.front = (speed * ms * t) / 1000), linear);
          later(b.atMs, () => {
            if (!reducedMotion) fx.burst(root, { x: -DOOR_W / 2, y: FLOOR_Y - 10 }, "motes");
          });
        } else if (b.action === "ride") anims.add(b.atMs, ms, (t) => (ov.skiff = t), easeOutCubic);
      }
      await waitMs(scene, reducedMotion ? Math.min(400, plan.durationMs) : plan.durationMs, () => dead);
      if (dead) return;
      anims.clear();
      Object.assign(ov, { spin: null, pawl: null, fin: null, light: null, front: null, skiff: null, flash: 0, grind: 0 });
      view.applyPose(solved);
    },
    async playFail(plan: FailurePlan, current: RingGatePose) {
      void current;
      let slipped = false;
      for (const b of plan.beats as readonly FailBeat[]) {
        if (b.action === "snap") anims.add(b.atMs, 140, (t) => (ov.pawl = t), easeOutCubic);
        else if (b.action === "spark")
          later(b.atMs, () => {
            if (!reducedMotion) fx.burst(root, { x: PAWL_TIP.x, y: PAWL_TIP.y }, "sparks");
          });
        else if (b.action === "grind") anims.add(b.atMs, 420, (t) => (ov.grind = 0.14 * Math.sin(t * PI * 6) * (1 - t)), linear);
        else if (b.action === "unseat") {
          slipped = true;
          anims.add(b.atMs, 260, (t) => (ov.pawl = 1 + t), easeOutCubic);
        } else if (b.action === "flash") anims.add(b.atMs, 360, (t) => (ov.flash = Math.sin(t * PI)), linear);
      }
      // the pawl lifts back clear of the rim before the plan ends
      const back = Math.min(1600, plan.durationMs) - 360;
      anims.add(back, 320, (t) => (ov.pawl = (slipped ? 2 : 1) * (1 - t)), easeInOutSine);
      await waitMs(scene, Math.min(1600, plan.durationMs), () => dead);
      if (dead) return;
      ov.pawl = null;
      ov.flash = 0;
      ov.grind = 0;
      dirty = true;
    },
    update(dtMs: number) {
      if (dead) return;
      const busy = anims.busy;
      anims.update(dtMs);
      if (busy || dirty || anims.busy) {
        render();
        dirty = false;
      }
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

export const skin: SkinPrefab<RingGateConfig, RingGatePose> = {
  skinId: "ring_gate",
  create(scene, phaser, props) {
    return createRingGate(scene, phaser, props);
  },
};
export default skin;
