/**
 * step_bridge · skin endocytosis_lift (cell e10, the Endocytosis Pit on the pit ledge; cell §5.10; §4.3 slots
 * clathrin_cell, dynamin_collar, halcyon, stage_lamp, vesicle, console; the membrane path is code-drawn). A 560-unit
 * membrane dimple on the ledge, ringed underneath by a clathrin lattice of cream hexagon cells with gold joints; a gold
 * dynamin collar hangs from a cream gantry over the pit's centre; the Halcyon rests in the pit; four stage lamps (round
 * bronze-framed plates) run down the gantry's right post, each showing the icon of the plank in its slot (and, at aid
 * tier ≥ 1, the stage it requires).
 *
 * Live (the playback probe k, `stage_rail` bays): the pose's membrane-fold stage state drives the membrane path (depth,
 * wrap, neck), the lattice curving into a basket, the collar lowering onto the neck, the vesicle closing and riding the
 * microtubule rail down (travel); the stage traps play where the player's own order leads: a slight dimple that relaxes
 * (fold with nothing touched), an EMPTY micro-vesicle pinching off beside the sub (pinch without a wrap), a lit rail with
 * nothing on it (carry without a vesicle), and the sub bouncing off the heads (the decoy).
 * Failure: the playback runs to the failing slot and plays its trap (the lamp of that slot flashes). Success: the
 * automatic playback 0 → n (500 ms per stage) with the correct physics, the gold collar spark, the vesicle launch.
 * Code-drawn stand-ins until C2's heroes (dynamin collar, Halcyon) land.
 */
import type Phaser from "phaser";
import type { StageId, StepBridgeConfig } from "@/world/contraptions/step-bridge.config";
import { stagePoseAt, type StagePose, type StepBridgePose } from "@/world/contraptions/step-bridge.meta";
import { clamp, clamp01, ease, lerp } from "@/world/ease";
import type { FailurePlan, SuccessPlan } from "@/world/types";
import type { ContraptionState, PoseView, PrefabProps, SkinPrefab, XY } from "../../../types";
import {
  cellColors,
  drawAtpSpark,
  drawBubbles,
  drawCellLectern,
  fillPoly,
  mix,
  strokePoly,
  timerBag,
  type CellColors,
} from "../../stage_machine/shared";

// ================================================================ pure geometry (unit-tested in endocytosis_lift.test.ts)

/** The pit, the gantry, the lamps (container-local; the ledge surface is y 0). 1 H = 170. */
export const PIT = {
  cx: 60,
  halfW: 280,
  depthUnits: 221, // 1.3 H at depth 1
  vesicle: { rx: 150, ry: 96 },
  travelUnits: 680, // 4 H down the microtubule rail
  pathX0: -430,
  pathX1: 560,
  gantry: { x0: -250, x1: 370, top: -520 },
  collarRest: -430,
  lampX: 452,
  lampTop: -452,
  lampGap: 88,
} as const;

export interface PitShape {
  surface: XY[]; // the membrane's top surface, left → right (a dimple, or the Ω around the cargo)
  vesicle: { x: number; y: number; closed: boolean } | null; // the vesicle ellipse centre once it wraps
  subY: number; // the Halcyon's centre y
  neckY: number; // where the collar tightens
  neckHalf: number; // half the neck opening (0 = pinched off)
}

/** The stage lamp j (a column down the gantry's right post). */
export function lampAt(j: number): XY {
  return { x: PIT.lampX, y: PIT.lampTop + j * PIT.lampGap };
}
/** A cos² dimple of depth `d` units over the pit. */
function dimpleY(x: number, d: number): number {
  const u = Math.abs(x - PIT.cx) / PIT.halfW;
  return u >= 1 ? 0 : d * Math.cos((Math.PI / 2) * u) ** 2;
}
/**
 * The membrane path for a membrane-fold stage state (cell §5.10): a dimple D = 1.3 H·depth; once it wraps, the
 * membrane runs down around the cargo's ellipse from angle π/2 + wrap·π through the bottom to π/2 − wrap·π and back up,
 * its entry points pinching toward the neck as `neck` → 1; detached, the surface reseals flat and the vesicle closes.
 * `extraDip` adds a transient dimple (the fold trap relaxing, the decoy's press).
 */
export function pitShape(s: Pick<StagePose, "depth" | "wrap" | "neck" | "detached" | "travel">, extraDip = 0): PitShape {
  const D = PIT.depthUnits * clamp01(s.depth) + extraDip;
  const { rx, ry } = PIT.vesicle;
  const restSub = -52;
  const subY = restSub + D * 0.95;
  const step = 22;
  if (s.detached) {
    const surface: XY[] = [];
    for (let x = PIT.pathX0; x <= PIT.pathX1; x += step) surface.push({ x, y: dimpleY(x, extraDip) });
    const vy = subY + PIT.travelUnits * clamp01(s.travel);
    return { surface, vesicle: { x: PIT.cx, y: vy, closed: true }, subY: vy, neckY: subY - ry, neckHalf: 0 };
  }
  const w = clamp01(s.wrap);
  if (w < 0.08) {
    const surface: XY[] = [];
    for (let x = PIT.pathX0; x <= PIT.pathX1; x += step) surface.push({ x, y: dimpleY(x, D) });
    return { surface, vesicle: null, subY, neckY: dimpleY(PIT.cx, D) - 40, neckHalf: PIT.halfW };
  }
  // the Ω: flat → neck entry → around the ellipse → neck exit → flat
  const aSpan = w * Math.PI; // each side of the bottom
  const aL = Math.PI / 2 + aSpan;
  const aR = Math.PI / 2 - aSpan;
  const onE = (a: number): XY => ({ x: PIT.cx + rx * Math.cos(a), y: subY + ry * Math.sin(a) });
  const endL = onE(aL);
  const endR = onE(aR);
  const n = clamp01(s.neck);
  const neckHalf = lerp(rx + 70, Math.abs(endL.x - PIT.cx) * 0.4, n);
  const entryL: XY = { x: PIT.cx - neckHalf, y: 0 };
  const entryR: XY = { x: PIT.cx + neckHalf, y: 0 };
  const surface: XY[] = [];
  for (let x = PIT.pathX0; x < entryL.x; x += step) surface.push({ x, y: 0 });
  surface.push(entryL);
  const segs = 28;
  for (let i = 1; i < 6; i++) {
    const u = i / 6;
    surface.push({ x: lerp(entryL.x, endL.x, u), y: lerp(entryL.y, endL.y, ease("in_out_sine", u)) });
  }
  for (let i = 0; i <= segs; i++) surface.push(onE(lerp(aL, aR, i / segs)));
  for (let i = 1; i < 6; i++) {
    const u = i / 6;
    surface.push({ x: lerp(endR.x, entryR.x, u), y: lerp(endR.y, entryR.y, ease("in_out_sine", u)) });
  }
  surface.push(entryR);
  for (let x = Math.ceil((entryR.x + 1) / step) * step; x <= PIT.pathX1; x += step) surface.push({ x, y: 0 });
  return { surface, vesicle: { x: PIT.cx, y: subY, closed: false }, subY, neckY: (endL.y + endR.y) / 2 - 10, neckHalf };
}
/** Where the empty micro-vesicle is, `u` ∈ [0, 1] through the pinch trap: it pinches off the flat membrane and floats away. */
export function microVesicleAt(u: number): { x: number; y: number; r: number; alpha: number } {
  const k = clamp01(u);
  return { x: PIT.cx + 190 + 80 * k, y: -8 - 150 * ease("out_cubic", k), r: 26 * clamp01(k * 3), alpha: 1 - clamp01((k - 0.7) / 0.3) };
}
/** The playback k at `elapsed` ms of a run 0 → `to` at `msPerStage` (clamped). */
export function playbackAt(elapsedMs: number, to: number, msPerStage: number): number {
  return clamp(elapsedMs / Math.max(1, msPerStage), 0, Math.max(0, to));
}

// ================================================================ drawing helpers

/** The plank icons (content glyphs: what the step SAYS, never whether it belongs). */
function drawStageIcon(g: Phaser.GameObjects.Graphics, icon: string | null, x: number, y: number, r: number, color: number, alpha = 1): void {
  if (!icon) return;
  g.lineStyle(Math.max(3, r * 0.2), color, alpha);
  g.fillStyle(color, alpha);
  const id = icon.replace(/^plank_/, "");
  switch (id) {
    case "touch": // a sphere meeting a line of heads
      g.fillCircle(x, y - r * 0.25, r * 0.35);
      for (let i = -2; i <= 2; i++) g.fillCircle(x + i * r * 0.3, y + r * 0.45, r * 0.12);
      break;
    case "fold": // a U cupping a dot
      strokePoly(g, [{ x: x - r * 0.6, y: y - r * 0.5 }, { x: x - r * 0.5, y: y + r * 0.3 }, { x: x, y: y + r * 0.55 }, { x: x + r * 0.5, y: y + r * 0.3 }, { x: x + r * 0.6, y: y - r * 0.5 }]);
      g.fillCircle(x, y, r * 0.2);
      break;
    case "pinch": // a pinched neck
      strokePoly(g, [{ x: x - r * 0.6, y: y - r * 0.55 }, { x: x - r * 0.08, y: y - r * 0.1 }, { x: x - r * 0.4, y: y + r * 0.5 }]);
      strokePoly(g, [{ x: x + r * 0.6, y: y - r * 0.55 }, { x: x + r * 0.08, y: y - r * 0.1 }, { x: x + r * 0.4, y: y + r * 0.5 }]);
      break;
    case "carry": // a closed ring riding an arrow down
      g.strokeCircle(x, y - r * 0.2, r * 0.32);
      strokePoly(g, [{ x, y: y + r * 0.15 }, { x, y: y + r * 0.6 }]);
      g.fillTriangle(x - r * 0.2, y + r * 0.4, x + r * 0.2, y + r * 0.4, x, y + r * 0.7);
      break;
    case "dissolve": // a dotted circle
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 2 * Math.PI;
        g.fillCircle(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.09);
      }
      break;
    default:
      g.fillCircle(x, y, r * 0.3);
  }
}
const REQ_ICON: Readonly<Record<StageId, string>> = { touch: "touch", fold: "fold", pinch: "pinch", carry: "carry", dissolve_bounce: "dissolve" };

function drawHeadsAlong(g: Phaser.GameObjects.Graphics, path: readonly XY[], c: CellColors, lit: number, press: number): void {
  // tails first (inward, toward the cytoplasm below the surface normal), then the heads
  const norm = (i: number): XY => {
    const a = path[Math.max(0, i - 1)]!;
    const b = path[Math.min(path.length - 1, i + 1)]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: -dy / l, y: dx / l };
  };
  for (let i = 0; i < path.length; i++) {
    const p = path[i]!;
    const n = norm(i);
    g.lineStyle(5, c.tail, 1);
    strokePoly(g, [{ x: p.x + n.x * 8, y: p.y + n.y * 8 }, { x: p.x + n.x * 46, y: p.y + n.y * 46 }]);
  }
  for (let i = 0; i < path.length; i++) {
    const p = path[i]!;
    const sq = 1 - 0.2 * press;
    g.fillStyle(c.headShade, 1);
    g.fillEllipse(p.x + 2, p.y + 2, 22, 22 * sq);
    g.fillStyle(lit > 0 ? mix(c.head, 0x8fe0ea, lit * 0.6) : c.head, 1);
    g.fillEllipse(p.x, p.y, 20, 20 * sq);
    g.fillStyle(c.headLit, 1);
    g.fillCircle(p.x - 3, p.y - 3, 4);
  }
}

function drawHexCell(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, c: CellColors, lit: number, rot: number): void {
  const pts: XY[] = [];
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 3;
    pts.push({ x: x + r * Math.cos(a), y: y + r * Math.sin(a) });
  }
  g.lineStyle(5, mix(c.stoneShade, c.stoneLit, lit), 1);
  strokePoly(g, pts, true);
  g.fillStyle(mix(c.goldDeep, c.goldHi, lit), 1);
  for (const p of pts) g.fillCircle(p.x, p.y, 3.5);
}

function drawHalcyon(g: Phaser.GameObjects.Graphics, x: number, y: number, c: CellColors, squash: number, alpha = 1): void {
  const w = 236;
  const h = 96 * (1 - 0.2 * squash);
  g.fillStyle(c.navyDark, 0.25 * alpha);
  g.fillEllipse(x + 8, y + h / 2 + 4, w * 0.8, 16);
  // the teardrop hull (brass and cream), a tail fin, a round porthole
  g.fillStyle(c.goldDeep, alpha);
  fillPoly(g, [{ x: x + w * 0.42, y: y - 6 }, { x: x + w * 0.62, y: y - h * 0.5 }, { x: x + w * 0.6, y: y + h * 0.5 }]);
  g.fillStyle(c.stoneShade, alpha);
  g.fillEllipse(x, y, w, h);
  g.fillStyle(c.stone, alpha);
  g.fillEllipse(x - 6, y - 6, w - 20, h - 22);
  g.fillStyle(c.gold, alpha);
  g.fillRect(x - w * 0.18, y - h / 2 + 4, 10, h - 8);
  g.fillStyle(c.bronze, alpha);
  g.fillCircle(x - w * 0.3, y - 4, 26);
  g.fillStyle(0x8fe0ea, alpha);
  g.fillCircle(x - w * 0.3, y - 4, 19);
  g.fillStyle(0xffffff, 0.6 * alpha);
  g.fillCircle(x - w * 0.3 - 6, y - 10, 6);
}

// ================================================================ the view

interface Dyn {
  now: number;
  state: ContraptionState;
  play: { start: number; to: number; ms: number; trap: "jam" | "bounce" | null; trapAt: number; slot: number | null; success: boolean } | null;
  collarSpark: number | null;
  launched: boolean;
}

function createLiftView(scene: Phaser.Scene, props: PrefabProps<StepBridgeConfig>): PoseView<StepBridgePose> {
  const config = props.config;
  const anchor = props.station.anchor;
  const c = cellColors(props.palette);
  const reduced = props.reducedMotion;
  const g0 = props.groundY - anchor.y;
  const consoleLocal: XY = { x: props.station.consoleX - anchor.x, y: g0 };

  const root = scene.add.container(anchor.x, anchor.y);
  const back = scene.add.graphics(); // gantry, rail, lectern
  const pitG = scene.add.graphics(); // membrane, lattice, vesicle, sub
  const frontG = scene.add.graphics(); // collar, lamps, fx
  root.add([back, pitG, frontG]);

  let alive = true;
  const timers = timerBag(scene, () => alive);
  const dyn: Dyn = { now: 0, state: "dormant", play: null, collarSpark: null, launched: false };
  let pose: StepBridgePose | null = null;

  // ---------------------------------------------------------------- static
  const G = PIT.gantry;
  back.fillStyle(c.stoneShade, 1);
  back.fillRect(G.x0 - 14, G.top, 28, -G.top);
  back.fillRect(G.x1 - 14, G.top, 28, -G.top);
  back.fillStyle(c.stone, 1);
  back.fillRect(G.x0 - 14, G.top, 14, -G.top);
  back.fillRect(G.x1 - 14, G.top, 14, -G.top);
  back.fillStyle(c.stone, 1);
  back.fillRoundedRect(G.x0 - 30, G.top - 26, G.x1 - G.x0 + 60, 30, 8);
  back.fillStyle(c.navy, 1);
  back.fillRect(G.x0 - 30, G.top - 12, G.x1 - G.x0 + 60, 6);
  back.fillStyle(c.gold, 1);
  back.fillRect(G.x0 - 34, G.top - 30, G.x1 - G.x0 + 68, 6);
  // the lamp post (the Lift frame beside the Ferryman's post)
  back.fillStyle(c.stoneShade, 1);
  back.fillRoundedRect(PIT.lampX - 34, PIT.lampTop - 50, 68, -PIT.lampTop + 50, 10);
  back.fillStyle(c.stone, 1);
  back.fillRoundedRect(PIT.lampX - 34, PIT.lampTop - 50, 36, -PIT.lampTop + 50, 10);
  // the microtubule rail down through the ledge into the cytoplasm
  back.lineStyle(10, c.stoneDeep, 0.8);
  strokePoly(back, [{ x: PIT.cx + 14, y: 160 }, { x: PIT.cx + 14, y: 900 }]);
  back.lineStyle(10, c.stoneDeep, 0.8);
  strokePoly(back, [{ x: PIT.cx - 14, y: 160 }, { x: PIT.cx - 14, y: 900 }]);
  drawCellLectern(back, consoleLocal, c, 0.7);
  const railG = scene.add.graphics();
  root.addAt(railG, 1);

  // ---------------------------------------------------------------- per frame
  const stageNow = (p: StepBridgePose): { st: StagePose | null; placed: readonly (string | null)[] } => {
    if (dyn.play) {
      const k = playbackAt(dyn.now - dyn.play.start, dyn.play.to, dyn.play.ms);
      return { st: stagePoseAt(config, p.placed, k), placed: p.placed };
    }
    return { st: p.stage, placed: p.placed };
  };

  const redraw = () => {
    if (!pose) return;
    const p = pose;
    const { st } = stageNow(p);
    const s = st ?? { k: 0, depth: 0, wrap: 0, neck: 0, detached: false, travel: 0, bounced: false, slot: null, outcome: null, atpSpent: 0 };
    const within = s.slot === null ? 0 : clamp01(s.k - s.slot);
    const trap = s.outcome;
    const dip = trap === "dimple" ? 34 * Math.sin(Math.PI * within) : trap === "bounce" ? 36 * Math.sin(Math.PI * Math.min(1, within * 1.6)) : 0;
    const detached = s.detached || (p.solved && !dyn.play);
    const shape = pitShape({ ...s, detached, travel: p.solved && !dyn.play ? 1 : s.travel }, dip);
    // ---- the rail lights while a carry plays (with or without a vesicle on it)
    railG.clear();
    const carrying = trap === "empty_rail" || (trap === "ok" && s.slot !== null && p.stageLamps[s.slot] === "plank_carry") || s.travel > 0.02;
    if (carrying) {
      railG.lineStyle(6, c.atp, 0.8 * (trap === "empty_rail" ? Math.sin(Math.PI * within) : 1));
      strokePoly(railG, [{ x: PIT.cx, y: 150 }, { x: PIT.cx, y: 900 }]);
    }
    pitG.clear();
    // ---- the clathrin lattice under the pit (flat and dormant; it curves into a basket as the membrane wraps)
    const lit = clamp01((s.wrap - 0.3) / 0.5);
    const inPit = shape.surface.filter((q) => Math.abs(q.x - PIT.cx) < PIT.halfW + 20);
    for (let i = 1; i < inPit.length - 1; i += 2) {
      const a = inPit[i - 1]!;
      const b = inPit[i + 1]!;
      const q = inPit[i]!;
      const nx = -(b.y - a.y);
      const ny = b.x - a.x;
      const l = Math.hypot(nx, ny) || 1;
      if (shape.vesicle?.closed) continue;
      drawHexCell(pitG, q.x + (nx / l) * 64, q.y + (ny / l) * 64, 17, c, lit, Math.atan2(ny, nx));
    }
    // ---- the vesicle (closed, carried) and the Halcyon inside it
    const press = trap === "bounce" ? Math.sin(Math.PI * Math.min(1, within * 1.6)) : 0;
    const subY = shape.subY - (trap === "bounce" ? 34 * Math.max(0, Math.sin(Math.PI * Math.min(1, within * 1.6 - 0.6))) : 0);
    if (shape.vesicle?.closed) {
      const v = shape.vesicle;
      pitG.fillStyle(c.tide, 0.25);
      pitG.fillEllipse(v.x, v.y, PIT.vesicle.rx * 2 + 30, PIT.vesicle.ry * 2 + 30);
      const ring: XY[] = [];
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * 2 * Math.PI;
        ring.push({ x: v.x + (PIT.vesicle.rx + 14) * Math.cos(a), y: v.y + (PIT.vesicle.ry + 14) * Math.sin(a) });
      }
      drawHeadsAlong(pitG, ring, c, 0, 0);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * 2 * Math.PI;
        drawHexCell(pitG, v.x + (PIT.vesicle.rx + 58) * Math.cos(a), v.y + (PIT.vesicle.ry + 58) * Math.sin(a), 16, c, 1, a);
      }
    }
    drawHalcyon(pitG, PIT.cx, subY, c, press, shape.vesicle?.closed && s.travel > 0.95 ? 0.85 : 1);
    // ---- the membrane surface (the heads light cyan where the sub touches: receptors)
    const touched = p.stageLamps.some((l) => l === "plank_touch") && s.k > 0.5;
    drawHeadsAlong(pitG, shape.surface, c, touched ? 1 : 0, press);
    // ---- the trap: an EMPTY micro-vesicle pinches off beside the sub and floats away
    if (trap === "empty_vesicle") {
      const m = microVesicleAt(within);
      if (m.r > 1) {
        pitG.fillStyle(c.tide, 0.3 * m.alpha);
        pitG.fillCircle(m.x, m.y, m.r);
        pitG.lineStyle(5, c.head, m.alpha);
        pitG.strokeCircle(m.x, m.y, m.r);
        drawBubbles(pitG, { x: m.x, y: m.y - m.r }, m.alpha * 0.5, c);
      }
    }
    // ---- the dynamin collar: rests high, lowers onto the neck and tightens as the pinch plays; a gold spark
    frontG.clear();
    const pinch = clamp01(s.neck);
    const collarY = lerp(PIT.collarRest, shape.neckY, clamp01(Math.max(s.wrap > 0.5 ? (s.wrap - 0.5) * 2 : 0, pinch)));
    const collarR = lerp(62, 26, pinch);
    frontG.lineStyle(3, c.stoneDeep, 1);
    strokePoly(frontG, [{ x: PIT.cx, y: G.top }, { x: PIT.cx, y: collarY - collarR * 0.5 }]);
    for (let i = 0; i < 3; i++) {
      frontG.lineStyle(9, i === 1 ? c.goldHi : c.gold, 1);
      frontG.strokeEllipse(PIT.cx, collarY + (i - 1) * 9, collarR * 2, collarR * 0.7);
    }
    const sparkAt = dyn.collarSpark ?? (trap === "ok" && s.slot !== null && p.stageLamps[s.slot] === "plank_pinch" ? dyn.now - within * 500 : null);
    if (sparkAt !== null) {
      const e = dyn.now - sparkAt;
      if (e >= 0 && e < 700) drawAtpSpark(frontG, PIT.cx + collarR, collarY, 22, c, 1 - e / 700, e / 200);
    }
    // ---- the stage lamps: filled slots light with their plank's icon; the playing slot glows; at tier ≥ 1 the requirement
    for (let j = 0; j < p.n; j++) {
      const at = lampAt(j);
      const on = clamp01(p.bayFill[j] ?? 0);
      const playing = s.slot === j && s.k > 0;
      const jam = dyn.play?.trap && dyn.play.slot === j && dyn.now - dyn.play.start > dyn.play.trapAt ? Math.floor((dyn.now - dyn.play.start) / 110) % 2 === 0 : false;
      frontG.fillStyle(c.bronze, 1);
      frontG.fillCircle(at.x, at.y, 31);
      frontG.fillStyle(mix(c.navyDark, playing ? c.goldHi : c.stoneLit, on * (playing ? 1 : 0.85)), 1);
      frontG.fillCircle(at.x, at.y, 24);
      if (playing || (dyn.play?.success && on > 0.5 && s.k > j)) {
        frontG.fillStyle(c.atp, 0.3);
        frontG.fillCircle(at.x, at.y, 42);
      }
      if (jam) {
        frontG.lineStyle(6, c.salmon, 1);
        frontG.strokeCircle(at.x, at.y, 36);
      }
      drawStageIcon(frontG, on > 0.5 ? (p.stageLamps[j] ?? null) : null, at.x, at.y, 22, c.navy);
      const req = p.stageReqs[j];
      if (req) drawStageIcon(frontG, REQ_ICON[req], at.x - 52, at.y + 10, 16, c.stoneLit, 0.9);
      if (j < p.n - 1) {
        frontG.lineStyle(3, c.goldDeep, 1);
        strokePoly(frontG, [{ x: at.x, y: at.y + 31 }, { x: at.x, y: at.y + PIT.lampGap - 31 }]);
      }
    }
  };

  const anchors: Record<string, XY> & { console: XY } = {
    console: consoleLocal,
    pit_center: { x: PIT.cx, y: 80 },
    collar: { x: PIT.cx, y: PIT.collarRest - 40 },
    sub: { x: PIT.cx, y: -60 },
  };
  for (let j = 0; j < 4; j++) {
    const at = lampAt(j);
    anchors[`lamp_${j}`] = { x: at.x - 116, y: at.y + 18 };
  }

  const pv: PoseView<StepBridgePose> = {
    root,
    anchors,
    applyPose(p: StepBridgePose) {
      pose = p;
      const shape = pitShape(p.stage ?? { depth: 0, wrap: 0, neck: 0, detached: false, travel: 0 });
      anchors.sub = { x: PIT.cx, y: shape.subY };
    },
    setState(state: ContraptionState) {
      dyn.state = state;
      try {
        props.fx.dormancy(root, state === "dormant");
      } catch {
        root.setAlpha(state === "dormant" ? 0.75 : 1);
      }
    },
    async playSucceed(plan: SuccessPlan, solved: StepBridgePose) {
      const cycle = plan.beats.find((b) => b.anchor === "pit_center" && b.action === "cycle");
      const n = pose?.n ?? solved.n;
      const ms = typeof cycle?.params?.msPerStage === "number" ? cycle.params.msPerStage : 500;
      if (!reduced) dyn.play = { start: dyn.now, to: n, ms, trap: null, trapAt: Infinity, slot: null, success: true };
      for (const b of plan.beats) if (b.anchor === "collar" && b.action === "lock") timers.later(reduced ? 0 : b.atMs, () => (dyn.collarSpark = dyn.now));
      await timers.wait(reduced ? 0 : Math.min(2500, plan.durationMs));
      if (!alive) return;
      dyn.play = null;
      dyn.launched = true;
      pv.applyPose(solved);
    },
    async playFail(plan: FailurePlan) {
      const stall = plan.beats.find((b) => b.anchor === "pit_center" && b.action === "stall");
      const to = typeof stall?.params?.playTo === "number" ? stall.params.playTo : 0;
      const trapBeat = plan.beats.find((b) => b.action === "jam" || (b.anchor === "sub" && b.action === "bounce"));
      const slot = typeof trapBeat?.params?.slot === "number" ? trapBeat.params.slot : Math.max(0, to - 1);
      const ms = Math.min(420, 1100 / Math.max(1, to));
      if (!reduced) dyn.play = { start: dyn.now, to, ms, trap: trapBeat ? (trapBeat.action === "bounce" ? "bounce" : "jam") : null, trapAt: Math.max(0, (to - 1) * ms), slot, success: false };
      await timers.wait(reduced ? 300 : Math.min(1600, plan.durationMs));
      if (!alive) return;
      dyn.play = null;
    },
    update(dtMs: number) {
      if (!alive) return;
      dyn.now += Math.max(0, dtMs);
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

export const skin: SkinPrefab<StepBridgeConfig, StepBridgePose> = {
  skinId: "endocytosis_lift",
  create(scene, _phaser, props) {
    return createLiftView(scene, props);
  },
};
export default skin;
