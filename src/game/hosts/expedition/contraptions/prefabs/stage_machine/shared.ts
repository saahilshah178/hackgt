/**
 * stage_machine prefab shared helpers (docs/design/20 §2.5.5, §4 row 10; cell §5.8). Owned by KB (L7) with the prefab
 * core. Two halves:
 *   - the PUMP helpers the pump_rewiring skin draws with: world positions of ions through the stage playback (pure,
 *     unit-tested in shared.test.ts), the playback clock of the failure run and the success cycles, and the pose at a
 *     played-back stage (`withStage`, from the meta's pure `pumpPlayback`, so the world never shows what the pose would not);
 *   - a small CELL DRAWING KIT that KB3's three living_gate skins share (pump_rewiring, specimen_pods, endocytosis_lift):
 *     the lectern, ATP sparks, stroked plate letters, polygons, colour mixing and a timer bag. It re-exports KB2's
 *     palette and molecule glyphs from router_lanes/shared.ts (same lane) so the cell skins read as one set.
 * World TEXT is never drawn here (chips and labels are DOM, §5.3); a plate letter is a stroked glyph, like engraving.
 * Everything is code-drawn stand-in art in the biome palette until the hero parts land (KB4 / C2).
 */
import type Phaser from "phaser";
import type { StageMachineConfig } from "@/world/contraptions/stage-machine.config";
import {
  drumSlotAt,
  jawsAt,
  PUMP,
  pumpPlayback,
  sideHome,
  STAGE_ANGLE,
  type PumpLoad,
  type Side,
  type StageMachinePose,
} from "@/world/contraptions/stage-machine.meta";
import { clamp01, ease, lerp } from "@/world/ease";
import type { XY } from "../../types";
import type { CellColors } from "../router_lanes/shared";

export { stubBox, type StubBoxOptions } from "../_stub";
export { cellColors, drawBubbles, drawHydrationShell, drawMolecule, drawSpark, hexOf, moleculeColor, type CellColors } from "../router_lanes/shared";

export const ARCHETYPE_ID = "stage_machine";
/** Placeholder tint for the W0 labelled box (kept for the contract test; the pump skin no longer uses it). */
export const STUB_COLOR = 0x5f6b2e;

// ================================================================ pump: pure playback helpers

export type IonsLoad = Extract<PumpLoad, { kind: "ions" }>;

/** Where ions leave to once released: past the jaw on `side`, further out than where they waited. */
export function releaseHome(side: Side, slot: number, n: number): XY {
  const dx = (slot - (n - 1) / 2) * 52;
  return side === "out" ? { x: dx * 1.4, y: PUMP.housing.top - 90 } : { x: dx * 1.4, y: PUMP.housing.bottom + 90 };
}
/** The mouth of the jaw on `side` (where blocked ions press and stop). */
export function jawMouth(side: Side, slot: number, n: number): XY {
  const dx = (slot - (n - 1) / 2) * 30;
  return side === "out" ? { x: dx, y: PUMP.housing.top + 6 } : { x: dx, y: PUMP.housing.bottom - 6 };
}
const lerpXY = (a: XY, b: XY, u: number): XY => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) });

/**
 * The world position (container-local) of ion `slot` of a loaded group at the pose's stage: waiting beyond the jaw on
 * its `from` side, snapping into its drum socket over the bind stage, riding the drum, leaving toward `to` over the
 * release stage. A blocked group presses on the shut jaw and falls back (it never binds).
 */
export function ionPosition(load: IonsLoad, slot: number, drumAngle: number): XY {
  const n = Math.max(1, load.n);
  const home = sideHome(load.from, slot, n, load.group);
  if (load.blocked) return lerpXY(home, jawMouth(load.from, slot, n), 0.9 * Math.sin(Math.PI * clamp01(load.bind)));
  const drum = drumSlotAt(load.group, slot, n, drumAngle);
  if (load.release > 0) return lerpXY(drum, releaseHome(load.to, slot, n), ease("in_out_cubic", load.release));
  if (load.bind > 0) return lerpXY(home, drum, ease("in_out_cubic", load.bind));
  return home;
}

/** The playback stage at `elapsedMs` of a run from `fromK` to `toK` at `msPerStage` (repeated `cycles` times, wrapping). */
export function playbackK(elapsedMs: number, fromK: number, toK: number, msPerStage: number, cycles = 1): number {
  const span = Math.max(0, toK - fromK);
  const ms = Math.max(1, msPerStage);
  if (cycles <= 1) return fromK + Math.min(span, Math.max(0, elapsedMs) / ms);
  const cycleMs = (span + 1) * ms; // the last stage holds one stage-time before the next cycle starts
  const total = cycleMs * cycles;
  const e = Math.min(Math.max(0, elapsedMs), total - 1);
  const within = e % cycleMs;
  return fromK + Math.min(span, within / ms);
}
/** A decaying horizontal shake: `px` amplitude over `ms` (the grind). */
export function shakeOffset(elapsedMs: number, px: number, ms: number): number {
  if (elapsedMs < 0 || elapsedMs >= ms) return 0;
  const k = 1 - elapsedMs / ms;
  return px * k * Math.sin((elapsedMs / 1000) * 2 * Math.PI * 22);
}

/** The pose with its stage-driven fields replayed at k (links, labels and lamps unchanged): the failure run and the cycles. */
export function withStage(pose: StageMachinePose, config: StageMachineConfig, view: unknown, k: number): StageMachinePose {
  const links = pose.cables.map((c) => ({ leftKey: c.leftKey, rightKey: c.rightKey }));
  const jaws = jawsAt(config.stages, k);
  const play = pumpPlayback(config, view, links, k);
  return {
    ...pose,
    ...play,
    beacon: pose.solved ? Math.max(play.beacon, 0.85) : play.beacon,
    k,
    drumAngle: STAGE_ANGLE * (k - config.stages.min),
    jawUpper: jaws.upper,
    jawLower: jaws.lower,
    side: jaws.side,
  };
}

// ================================================================ the cell drawing kit (KB3 skins)

/** Linear mix of two 0xRRGGBB colours. */
export function mix(a: number, b: number, t: number): number {
  const k = clamp01(t);
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
export function fillPoly(g: Phaser.GameObjects.Graphics, pts: readonly XY[]): void {
  if (pts.length < 3) return;
  g.beginPath();
  g.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]!.x, pts[i]!.y);
  g.closePath();
  g.fillPath();
}
export function strokePoly(g: Phaser.GameObjects.Graphics, pts: readonly XY[], closed = false): void {
  if (pts.length < 2) return;
  g.beginPath();
  g.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]!.x, pts[i]!.y);
  if (closed) g.closePath();
  g.strokePath();
}
/** Rotates p about c by angle a (radians). */
export function rotateAbout(p: XY, c: XY, a: number): XY {
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  return { x: c.x + (p.x - c.x) * cs - (p.y - c.y) * sn, y: c.y + (p.x - c.x) * sn + (p.y - c.y) * cs };
}

/** The station lectern in the living_gate palette (kit `lectern`, 0.7 H): a cream stem, a slanted slate with a gold rim. */
export function drawCellLectern(g: Phaser.GameObjects.Graphics, at: XY, c: CellColors, lit: number): XY {
  const h = 124;
  g.fillStyle(c.navyDark, 0.22);
  g.fillEllipse(at.x + 14, at.y - 2, 112, 16);
  g.fillStyle(c.stoneShade, 1);
  g.fillRect(at.x - 16, at.y - h + 30, 32, h - 30);
  g.fillStyle(c.stone, 1);
  g.fillRect(at.x - 16, at.y - h + 30, 18, h - 30);
  g.fillStyle(c.navy, 1);
  g.fillRect(at.x - 16, at.y - h + 60, 32, 8);
  g.fillStyle(c.stoneDeep, 1);
  g.fillRoundedRect(at.x - 36, at.y - 14, 72, 14, 4);
  const top = at.y - h;
  const slate = [
    { x: at.x - 48, y: top + 22 },
    { x: at.x + 48, y: top + 6 },
    { x: at.x + 50, y: top + 34 },
    { x: at.x - 46, y: top + 46 },
  ];
  g.fillStyle(c.gold, 1);
  fillPoly(g, slate.map((p, i) => ({ x: p.x + (i === 0 || i === 3 ? -5 : 5), y: p.y + (i < 2 ? -5 : 5) })));
  g.fillStyle(mix(0x0f2a33, 0x3b7682, lit), 1);
  fillPoly(g, slate);
  if (lit > 0) {
    g.fillStyle(c.tide, 0.22 * lit);
    g.fillEllipse(at.x, top + 26, 130, 60);
  }
  return { x: at.x, y: top + 26 };
}

/** An ATP spark (cell §2.2: gold four-point star with a white core); `alpha` fades it. */
export function drawAtpSpark(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, c: CellColors, alpha = 1, rot = 0): void {
  if (alpha <= 0.01) return;
  g.fillStyle(c.atp, 0.35 * alpha);
  g.fillCircle(x, y, r * 1.2);
  g.fillStyle(c.atp, alpha);
  const pts: XY[] = [];
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const rr = i % 2 === 0 ? r : r * 0.34;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  fillPoly(g, pts);
  g.fillStyle(c.atpCore, alpha);
  g.fillCircle(x, y, r * 0.28);
}

/** Stroked plate letters (A–F): an engraved display-order letter, not text (the claims card carries the words). */
const LETTER_STROKES: Readonly<Record<string, readonly (readonly [number, number])[][]>> = {
  A: [[[-0.5, 0.5], [0, -0.5], [0.5, 0.5]], [[-0.26, 0.1], [0.26, 0.1]]],
  B: [[[-0.4, 0.5], [-0.4, -0.5], [0.2, -0.5], [0.38, -0.34], [0.38, -0.14], [0.18, 0], [-0.4, 0]], [[0.18, 0], [0.42, 0.16], [0.42, 0.34], [0.22, 0.5], [-0.4, 0.5]]],
  C: [[[0.42, -0.36], [0.2, -0.5], [-0.18, -0.5], [-0.42, -0.24], [-0.42, 0.24], [-0.18, 0.5], [0.2, 0.5], [0.42, 0.36]]],
  D: [[[-0.4, -0.5], [0.1, -0.5], [0.42, -0.2], [0.42, 0.2], [0.1, 0.5], [-0.4, 0.5], [-0.4, -0.5]]],
  E: [[[0.4, -0.5], [-0.38, -0.5], [-0.38, 0.5], [0.4, 0.5]], [[-0.38, 0], [0.24, 0]]],
  F: [[[0.4, -0.5], [-0.38, -0.5], [-0.38, 0.5]], [[-0.38, 0], [0.24, 0]]],
};
export function drawLetter(g: Phaser.GameObjects.Graphics, letter: string, x: number, y: number, size: number, color: number, alpha = 1): void {
  const strokes = LETTER_STROKES[letter];
  if (!strokes) return;
  g.lineStyle(Math.max(3, size * 0.16), color, alpha);
  for (const s of strokes) strokePoly(g, s.map(([px, py]) => ({ x: x + px * size * 0.7, y: y + py * size })));
}

/** A three-line beam (core 2, inner 6, outer 18) with a ±8 % shimmer, drawn into a Graphics (bible §5.3). */
export function drawBeamLine(g: Phaser.GameObjects.Graphics, from: XY, to: XY, color: number, alpha: number, tMs: number): void {
  if (alpha <= 0.01) return;
  const sh = 1 + 0.08 * Math.sin(tMs / 70);
  const line = (w: number, col: number, a: number) => {
    g.lineStyle(w, col, a);
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(to.x, to.y);
    g.strokePath();
  };
  line(18 * sh, color, 0.14 * alpha);
  line(8 * sh, color, 0.6 * alpha);
  line(3, 0xffffff, 0.95 * alpha);
  g.fillStyle(color, 0.35 * alpha);
  g.fillCircle(to.x, to.y, 16 * sh);
  g.fillStyle(0xffffff, 0.8 * alpha);
  g.fillCircle(to.x, to.y, 5);
}

/** A bag of scene timers that dies with the view (never fires after destroy). */
export interface TimerBag {
  later(ms: number, fn: () => void): void;
  wait(ms: number): Promise<void>;
  clear(): void;
}
export function timerBag(scene: Phaser.Scene, alive: () => boolean): TimerBag {
  const timers: Phaser.Time.TimerEvent[] = [];
  const later = (ms: number, fn: () => void) => {
    if (ms <= 0) {
      if (alive()) fn();
      return;
    }
    timers.push(scene.time.delayedCall(ms, () => alive() && fn()));
  };
  return {
    later,
    wait: (ms: number) => new Promise<void>((resolve) => later(ms, resolve)),
    clear: () => {
      for (const t of timers) t.remove(false);
      timers.length = 0;
    },
  };
}

/** Deterministic cosmetic noise in [0, 1) from integers (seeded particles, jitter phases); each argument is mixed. */
export function hash01(a: number, b = 0, c = 0): number {
  const mix32 = (x: number): number => {
    let h = x >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    return (h ^ (h >>> 16)) >>> 0;
  };
  return mix32(mix32(mix32(a | 0) + Math.imul(b | 0, 0x9e3779b1)) ^ mix32((c | 0) + 0x85ebca6b)) / 4294967296;
}
