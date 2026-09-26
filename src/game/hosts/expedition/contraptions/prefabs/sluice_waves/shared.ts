/**
 * sluice_waves prefab shared machinery (docs/design/20 §2.5.5, §4 row 8; cell §5.5 e5, §5.9 e9). Owned by KB (L7) with
 * the prefab core; the tonicity_sluices skin plugs its drawing options into `createSluiceView`, which does the rest:
 * the canal and trench water, the Label Lock (its bath dots render the CLAIM: ρ_out = ρ_in·k on hover, never water
 * arrows on e5), the valve wheel that turns to the claimed plaque, the basins and the Eddy, the cells (wall, protoplast,
 * crenation, strain ring, inside solute dots, the committed tag), the failure playback (only `wrongKeys[0]`'s cell
 * floats back into the lock and blinks its tag, then the disclosed bath or fate shows) and the success playback (every
 * cell drifts to its basin and plays its true fate, then the trench drains or the Barge Lock fills).
 * World TEXT is never drawn here: valve plaques, basin labels and the V chip are DOM chips from `meta.describe()`.
 * The pure helpers at the top are unit-tested in shared.test.ts (node).
 */
import type Phaser from "phaser";
import type { PayoffAnim } from "@/contracts/world";
import type { SluiceWavesConfig } from "@/world/contraptions/sluice-waves.config";
import {
  basinAnchor,
  basinXY,
  cellAnchor,
  eddyXY,
  fateShape,
  valveAnchor,
  valvePlaqueXY,
  SLUICE_LAYOUT,
  type CellShape,
  type SluiceCellPose,
  type SluiceFate,
  type SluiceWavesPose,
} from "@/world/contraptions/sluice-waves.meta";
import { approach, clamp01, lerpAngle, smoothingFactor } from "@/world/ease";
import type { FailBeat, FailurePlan, SuccessBeat, SuccessPlan } from "@/world/types";
import type { ContraptionState, PoseView, PrefabProps, XY } from "../../types";
import { cellColors, type CellColors } from "../router_lanes/shared";

export const ARCHETYPE_ID = "sluice_waves";
/** W0 seam (tests/world-contract.test.ts checks every prefab shared.ts keeps it); the skin no longer uses it. */
export { stubBox, type StubBoxOptions } from "../_stub";
export { partTexture } from "../router_lanes/shared";

// ---------------------------------------------------------------- pure helpers

const FATES: readonly SluiceFate[] = ["swell", "shrink", "steady", "plasmolysis", "strain"];
const asFate = (v: unknown): SluiceFate | null => (typeof v === "string" && (FATES as readonly string[]).includes(v) ? (v as SluiceFate) : null);
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const waveOfAnchor = (anchor: string): number | null => {
  const m = /^cell_w(\d+)$/.exec(anchor);
  return m ? Number(m[1]) : null;
};

export interface SluiceFailRoute {
  /** the ONE wave the plan names (null when it names none: the lock just flashes) */
  wave: number | null;
  backAtMs: number | null;
  blinkAtMs: number | null;
  hold: { atMs: number; valve: number | null; dots: number | null; fate: SluiceFate | null } | null;
  lockFlashAtMs: number | null;
}
/** Routes a failure plan: only the cell its beats name moves (docs/design/20 §7.4 "the failure plan returns only the wave in wrongKeys"). */
export function routeSluiceFail(plan: FailurePlan): SluiceFailRoute {
  const out: SluiceFailRoute = { wave: null, backAtMs: null, blinkAtMs: null, hold: null, lockFlashAtMs: null };
  for (const b of plan.beats as readonly FailBeat[]) {
    const w = waveOfAnchor(b.anchor);
    if (w === null) {
      if (b.anchor === "lock") out.lockFlashAtMs = b.atMs;
      continue;
    }
    if (out.wave !== null && out.wave !== w) continue; // never more than one cell
    out.wave = w;
    if (b.action === "spit_back" || b.action === "bounce" || b.action === "sink") out.backAtMs = b.atMs;
    else if (b.action === "flash") out.blinkAtMs = b.atMs;
    else if (b.action === "hold_bright") {
      out.hold = {
        atMs: b.atMs,
        valve: typeof b.params?.valve === "number" ? b.params.valve : null,
        dots: typeof b.params?.dots === "number" ? b.params.dots : null,
        fate: asFate(b.params?.fate),
      };
    }
  }
  return out;
}

export interface SluiceSuccessRoute {
  basinsAtMs: number | null;
  cells: { wave: number; atMs: number; valve: number | null; fate: SluiceFate | null }[];
  water: { atMs: number; ms: number } | null;
}
export function routeSluiceSuccess(plan: SuccessPlan): SluiceSuccessRoute {
  const out: SluiceSuccessRoute = { basinsAtMs: null, cells: [], water: null };
  for (const b of plan.beats as readonly SuccessBeat[]) {
    const w = waveOfAnchor(b.anchor);
    if (w !== null) out.cells.push({ wave: w, atMs: b.atMs, valve: typeof b.params?.valve === "number" ? b.params.valve : null, fate: asFate(b.params?.fate) });
    else if (b.anchor.startsWith("basin_") && b.action === "open") out.basinsAtMs = out.basinsAtMs === null ? b.atMs : Math.min(out.basinsAtMs, b.atMs);
    else if (b.action === "drain" || b.action === "rise" || (b.anchor === "lock" && b.action === "open")) out.water = { atMs: b.atMs, ms: num(b.params?.ms, 1400) };
  }
  return out;
}

/** The water offset (y down) for payoff progress `water` ∈ [0, 1]: e5 drains 1.5 H, e9's Barge Lock fills 2 H. */
export function waterOffset(anim: PayoffAnim, water: number): { trench: number; barge: number } {
  const w = clamp01(water);
  if (anim === "steps_emerge") return { trench: SLUICE_LAYOUT.drainDepth * w, barge: 0 };
  if (anim === "water_rises") return { trench: 0, barge: -SLUICE_LAYOUT.fillRise * w };
  return { trench: 0, barge: 0 };
}

/** mulberry32: cosmetic, seeded (the same station always scatters its dots the same way). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** `n` stable dot positions inside a rect (the lock bath); extra dots keep earlier positions when n grows. */
export function dotLayout(seed: number, n: number, rect: { x: number; y: number; w: number; h: number }): XY[] {
  const rnd = seeded(seed);
  const out: XY[] = [];
  for (let i = 0; i < n; i++) out.push({ x: rect.x + 8 + rnd() * (rect.w - 16), y: rect.y + 8 + rnd() * (rect.h - 16) });
  return out;
}
/** The number of solute dots drawn for a count (the lock holds at most 60; cells at most 16). */
export const MAX_BATH_DOTS = 60;
export const MAX_CELL_DOTS = 16;

// ---------------------------------------------------------------- drawing helpers

export interface SluiceSkinOptions {
  skinId: string;
  /** valve colours by index (tags and basin stripes) */
  valveColors(c: CellColors, n: number): number[];
}

/** One cell: rbc (a red disc), plant / potato (a rigid wall + a protoplast), generic (a round cell with a nucleus). */
export function drawCell(
  g: Phaser.GameObjects.Graphics,
  cell: SluiceCellPose["cell"],
  x: number,
  y: number,
  shape: CellShape,
  spin: number,
  inDots: number,
  c: CellColors,
  alpha = 1,
  outline = false,
): void {
  const R = SLUICE_LAYOUT.cellR;
  const r = R * shape.volume;
  const walled = cell === "plant" || cell === "potato";
  const bumps = (rad: number, col: number) => {
    if (shape.crenate <= 0.02) return;
    for (let i = 0; i < 12; i++) {
      const a = spin + (i * Math.PI) / 6;
      g.fillStyle(col, alpha);
      g.fillCircle(x + Math.cos(a) * rad, y + Math.sin(a) * rad, 5 * shape.crenate + 1);
    }
  };
  if (walled) {
    const wall = cell === "plant" ? 0x4f8f85 : 0xd9c3a0;
    const body = cell === "plant" ? 0x9ed6c4 : 0xf6e3b4;
    g.fillStyle(0x27405f, 0.85 * alpha);
    g.fillRoundedRect(x - R - 4, y - R - 4, 2 * R + 8, 2 * R + 8, 10);
    g.fillStyle(wall, alpha);
    g.fillRoundedRect(x - R, y - R, 2 * R, 2 * R, 8);
    g.fillStyle(0x8fe0ea, 0.6 * alpha);
    g.fillRoundedRect(x - R + 5, y - R + 5, 2 * R - 10, 2 * R - 10, 6);
    const p = (R - 6) * shape.protoplast;
    g.fillStyle(body, alpha);
    g.fillRoundedRect(x - p, y - p, 2 * p, 2 * p, Math.max(4, p * 0.4));
    if (cell === "potato") {
      g.fillStyle(0xfbf1de, alpha);
      for (let i = 0; i < 4; i++) g.fillEllipse(x + Math.cos(spin + i * 1.6) * p * 0.45, y + Math.sin(spin + i * 1.6) * p * 0.45, 10, 6);
    } else {
      g.fillStyle(0x4f8f85, alpha);
      g.fillCircle(x + Math.cos(spin) * p * 0.35, y + Math.sin(spin) * p * 0.35, Math.max(4, p * 0.28));
    }
  } else {
    const fill = cell === "rbc" ? 0xe7836f : 0x9ed6c4;
    bumps(r, fill);
    g.fillStyle(0x27405f, 0.85 * alpha);
    g.fillCircle(x, y, r + 4);
    g.fillStyle(fill, alpha);
    g.fillCircle(x, y, r);
    if (cell === "rbc") {
      g.fillStyle(0xf4ae80, alpha);
      g.fillCircle(x, y, r * 0.45);
    } else {
      g.fillStyle(0x4f8f85, alpha);
      g.fillCircle(x + Math.cos(spin) * r * 0.3, y + Math.sin(spin) * r * 0.3, r * 0.3);
    }
  }
  // the cell's own solute (drawn from the config: the text states it; salt never moves)
  const n = Math.min(MAX_CELL_DOTS, Math.round(inDots));
  for (let i = 0; i < n; i++) {
    const a = spin + i * 2.399;
    const d = (0.25 + 0.5 * ((i * 37) % 11) / 11) * (walled ? (R - 6) * shape.protoplast : r) * 0.8;
    const dx = x + Math.cos(a) * d;
    const dy = y + Math.sin(a) * d;
    if (outline) {
      g.lineStyle(2, 0xffffff, alpha);
      g.strokeRect(dx - 3.5, dy - 3.5, 7, 7);
    }
    g.fillStyle(0xfbf1de, alpha);
    g.fillRect(dx - 2.5, dy - 2.5, 5, 5);
  }
  if (shape.strain > 0.02) {
    g.lineStyle(4, 0xee8a9a, alpha * shape.strain);
    g.strokeCircle(x, y, r + 10);
  }
}

// ---------------------------------------------------------------- the view

interface CellFx {
  from: XY | null;
  back: number | null; // ms timestamp the float-back started
  blink: number | null;
  hold: { start: number; fate: SluiceFate | null } | null;
  pass: { start: number; to: XY; fate: SluiceFate | null } | null;
}

export function createSluiceView(scene: Phaser.Scene, props: PrefabProps<SluiceWavesConfig>, skin: SluiceSkinOptions): PoseView<SluiceWavesPose> {
  const config = props.config;
  const anchor = props.station.anchor;
  const anim = props.station.payoff.anim;
  const barge = anim === "water_rises" || props.station.payoff.kind === "ride";
  const c = cellColors(props.palette);
  const L = SLUICE_LAYOUT;
  const n = config.valves.length;
  const vColors = skin.valveColors(c, n);
  const reducedMotion = props.reducedMotion;
  const consoleLocal = { x: props.station.consoleX - anchor.x, y: props.groundY - anchor.y };

  const root = scene.add.container(anchor.x, anchor.y);
  const back = scene.add.graphics();
  const water = scene.add.graphics();
  const cells = scene.add.graphics();
  const front = scene.add.graphics();
  root.add([back, water, cells, front]);

  const lockRect = { x: L.lock.x - L.lockW / 2, y: L.lock.y - L.lockH / 2, w: L.lockW, h: L.lockH };
  const trench = { x0: L.canalIn.x - 40, x1: eddyXY(n).x + 90, floor: L.drainDepth };
  const dots = dotLayout(props.seed ^ 0x51c3, MAX_BATH_DOTS, lockRect);
  const sugar = config.waves.some((w) => w.cell === "potato");

  // ---- static parts
  const b = back;
  b.fillStyle(c.stoneDeep, 1);
  b.fillRect(trench.x0 - 30, 0, 30, trench.floor + 30);
  b.fillRect(trench.x1, 0, 30, trench.floor + 30);
  b.fillRect(trench.x0 - 30, trench.floor, trench.x1 - trench.x0 + 60, 30);
  // the lock chamber's back wall
  b.fillStyle(c.stoneShade, 1);
  b.fillRect(lockRect.x - 18, lockRect.y - 18, lockRect.w + 36, lockRect.h + 36);
  b.fillStyle(c.stone, 1);
  b.fillRect(lockRect.x - 10, lockRect.y - 10, lockRect.w + 20, lockRect.h + 20);
  // the valve column and the three spoke plaques (text is DOM)
  b.fillStyle(c.stoneDeep, 1);
  b.fillRect(L.valve.x - 14, L.valve.y, 28, lockRect.y - 18 - L.valve.y);
  for (let j = 0; j < n; j++) {
    const p = valvePlaqueXY(j, n);
    b.lineStyle(8, c.bronze, 1);
    b.beginPath();
    b.moveTo(L.valve.x, L.valve.y);
    b.lineTo(p.x, p.y);
    b.strokePath();
    b.fillStyle(c.bronze, 1);
    b.fillRoundedRect(p.x - 42, p.y - 20, 84, 40, 8);
    b.fillStyle(vColors[j] ?? c.stone, 1);
    b.fillRect(p.x - 36, p.y + 12, 72, 5);
  }
  // basins (stone tubs with a stripe in their valve's colour) and the Eddy's rim
  for (let j = 0; j < n; j++) {
    const p = basinXY(j);
    b.fillStyle(c.stoneShade, 1);
    b.fillRoundedRect(p.x - 58, p.y + 30, 116, 26, 8);
    b.fillStyle(vColors[j] ?? c.stone, 1);
    b.fillRect(p.x - 50, p.y + 34, 100, 6);
  }
  const eddy = eddyXY(n);
  b.lineStyle(6, c.stoneShade, 1);
  b.strokeCircle(eddy.x, eddy.y + 10, 62);

  // ---- anchors
  const anchors: Record<string, XY> & { console: XY } = {
    console: consoleLocal,
    lock: { x: L.lock.x, y: L.lock.y },
    valve: { x: L.valve.x, y: L.valve.y },
    eddy: { ...eddy },
    barge_deck: { ...L.bargeDeck },
  };
  for (let j = 0; j < n; j++) {
    anchors[valveAnchor(j)] = valvePlaqueXY(j, n);
    anchors[basinAnchor(j)] = basinXY(j);
  }
  for (let j = n; j < 3; j++) anchors[basinAnchor(j)] = basinXY(j); // the §4.3 range basin_0…2 always exists
  for (const w of config.waves) anchors[cellAnchor(w.waveIndex)] = { x: L.canalIn.x, y: L.canalIn.y };

  // ---- state
  const timers: Phaser.Time.TimerEvent[] = [];
  const fx = new Map<number, CellFx>();
  let pose: SluiceWavesPose | null = null;
  let now = 0;
  let shownDots = 0;
  let wheel = 0;
  let lockFlash = 0;
  let basinsOpen = 0;
  let basinsStart: number | null = null;
  let waterRun: { start: number; ms: number } | null = null;
  let holdDots: number | null = null;
  let destroyed = false;

  const later = (ms: number, fn: () => void) => {
    if (ms <= 0) {
      fn();
      return;
    }
    timers.push(scene.time.delayedCall(ms, () => !destroyed && fn()));
  };
  const wait = (ms: number) => new Promise<void>((resolve) => later(ms, resolve));
  const fxOf = (w: number): CellFx => {
    let f = fx.get(w);
    if (!f) {
      f = { from: null, back: null, blink: null, hold: null, pass: null };
      fx.set(w, f);
    }
    return f;
  };

  const redraw = () => {
    if (!pose) return;
    water.clear();
    cells.clear();
    front.clear();
    const payoff = Math.max(pose.water, waterRun ? clamp01((now - waterRun.start) / waterRun.ms) : 0);
    const off = waterOffset(anim, payoff);
    // the trench water (drains on e5) and the canal
    const top = off.trench;
    water.fillStyle(c.tideDeep, 0.85);
    water.fillRect(trench.x0, top, trench.x1 - trench.x0, Math.max(0, trench.floor - top));
    water.fillStyle(c.tide, 0.9);
    water.fillRect(trench.x0, top, trench.x1 - trench.x0, 10);
    water.fillStyle(c.tide, 0.8);
    water.fillRect(L.canalIn.x - 520, 0, 520 + (trench.x0 - L.canalIn.x) + 10, 60);
    if (anim === "steps_emerge" && payoff > 0 && payoff < 1 && !reducedMotion) {
      // the whirlpool at the drain grate
      water.lineStyle(4, c.white, 0.6 * (1 - payoff));
      for (let k = 0; k < 3; k++) water.strokeCircle(L.lock.x + 120, trench.floor - 30, 16 + 14 * k + 6 * Math.sin(now / 120 + k));
    }
    // the Eddy's swirl
    const eddy = eddyXY(n);
    water.lineStyle(4, c.white, 0.55);
    for (let k = 0; k < 3; k++) {
      const a0 = (reducedMotion ? 0 : now / 900) + (k * 2 * Math.PI) / 3;
      water.beginPath();
      water.arc(eddy.x, eddy.y + 10, 22 + 12 * k, a0, a0 + 2.2, false);
      water.strokePath();
    }
    // the lock bath: the claimed solute density (dots fade in and out over 200 ms)
    water.fillStyle(c.tide, 0.55);
    water.fillRect(lockRect.x, lockRect.y + off.trench * 0.2, lockRect.w, lockRect.h);
    const whole = Math.floor(shownDots);
    for (let i = 0; i < Math.min(MAX_BATH_DOTS, Math.ceil(shownDots)); i++) {
      const d = dots[i]!;
      const a = i < whole ? 1 : shownDots - whole;
      if (pose.saltOutline) {
        water.lineStyle(2, c.white, a);
        water.strokeRect(d.x - 5, d.y - 5, 10, 10);
      }
      water.fillStyle(sugar && pose.current !== null && pose.cells[pose.current]?.cell === "potato" ? c.goldHi : c.stoneLit, a);
      water.fillRect(d.x - 3.5, d.y - 3.5, 7, 7);
    }
    // ghost water arrows (claimed flow, arrows valves only; never on e5)
    if (pose.arrows !== "none" && pose.current !== null) {
      const cur = pose.cells[pose.current];
      if (cur) {
        const dirs = pose.arrows === "both" ? [1, -1] : pose.arrows === "in" ? [1] : [-1];
        water.lineStyle(5, c.water, 0.8);
        for (const dir of dirs) {
          for (let k = 0; k < 3; k++) {
            const a = -Math.PI / 2 + (k - 1) * 0.9 + (dir < 0 ? 0.35 : 0);
            const r0 = dir > 0 ? 90 : 48;
            const r1 = dir > 0 ? 54 : 86;
            const x0 = cur.x + Math.cos(a) * r0;
            const y0 = cur.y + Math.sin(a) * r0;
            const x1 = cur.x + Math.cos(a) * r1;
            const y1 = cur.y + Math.sin(a) * r1;
            water.beginPath();
            water.moveTo(x0, y0);
            water.lineTo(x1, y1);
            water.strokePath();
            water.fillStyle(c.water, 0.8);
            water.fillCircle(x1, y1, 6);
          }
        }
      }
    }
    // cells
    for (const cell of pose.cells) {
      if (!cell.visible) continue;
      const f = fx.get(cell.waveIndex);
      let x = cell.x;
      let y = cell.y;
      let shape: CellShape = cell;
      if (f?.back !== null && f?.back !== undefined) {
        const u = clamp01((now - f.back) / 500);
        const from = f.from ?? { x, y };
        x = from.x + (L.lock.x - from.x) * u;
        y = from.y + (L.lock.y - from.y) * u - 30 * Math.sin(Math.PI * u);
      }
      if (f?.hold) shape = fateShape(f.hold.fate, clamp01((now - f.hold.start) / 600));
      if (f?.pass) {
        const u = clamp01((now - f.pass.start) / 700);
        const from = f.from ?? { x, y };
        x = from.x + (f.pass.to.x - from.x) * u;
        y = from.y + (f.pass.to.y - from.y) * u;
        shape = fateShape(f.pass.fate, u);
      }
      if (cell.place === "basin" || cell.place === "eddy" || f?.pass) y += off.trench * 0.5;
      drawCell(cells, cell.cell, x, y, shape, cell.spin, cell.inDots, c, 1, pose.saltOutline);
      // the tag: the committed valve's colour (blinks on a miss)
      const blinking = f?.blink !== null && f?.blink !== undefined && now >= f.blink && Math.floor((now - f.blink) / 140) % 2 === 0;
      if ((cell.valve !== null || blinking) && !(f?.pass)) {
        const col = blinking ? c.salmon : (vColors[cell.valve ?? 0] ?? c.stone);
        cells.fillStyle(c.ink, 1);
        cells.fillRect(x - 20, y - SLUICE_LAYOUT.cellR - 24, 40, 16);
        cells.fillStyle(col, 1);
        cells.fillRect(x - 17, y - SLUICE_LAYOUT.cellR - 21, 34, 10);
      }
      if (cell.current && !pose.solved) {
        cells.lineStyle(4, c.white, 0.8);
        cells.strokeCircle(x, y, SLUICE_LAYOUT.cellR * cell.volume + 16);
      }
      anchors[cellAnchor(cell.waveIndex)] = { x, y };
    }
    // the lock's leaves: upstream (left) stays shut, downstream (right) opens on each commit
    const leafLift = 120 * pose.leaf;
    const flash = lockFlash > 0 && Math.floor(lockFlash / 110) % 2 === 0;
    front.fillStyle(flash ? c.salmon : c.stoneDeep, 1);
    front.fillRect(lockRect.x - 16, lockRect.y, 14, lockRect.h);
    front.fillRect(lockRect.x + lockRect.w + 2, lockRect.y - leafLift, 14, lockRect.h);
    front.fillStyle(c.gold, 1);
    front.fillRect(lockRect.x + lockRect.w + 2, lockRect.y - leafLift, 14, 8);
    // the basin gates (open on success)
    const bo = clamp01(Math.max(basinsOpen, pose.solved ? 1 : 0));
    for (let j = 0; j < n; j++) {
      const p = basinXY(j);
      front.fillStyle(c.stoneDeep, 1);
      front.fillRect(p.x + 52, p.y - 40 - 80 * bo, 10, 70);
    }
    // the valve wheel: a handwheel whose pointer turns to the claimed plaque (−60°, 0°, +60°)
    front.lineStyle(10, c.bronze, 1);
    front.strokeCircle(L.valve.x, L.valve.y, 46);
    front.lineStyle(6, c.goldHi, 1);
    for (let k = 0; k < 4; k++) {
      const a = wheel + (k * Math.PI) / 2;
      front.beginPath();
      front.moveTo(L.valve.x, L.valve.y);
      front.lineTo(L.valve.x + Math.sin(a) * 42, L.valve.y - Math.cos(a) * 42);
      front.strokePath();
    }
    front.fillStyle(pose.claim !== null ? c.goldHi : c.stoneShade, 1);
    front.fillTriangle(
      L.valve.x + Math.sin(wheel) * 78, L.valve.y - Math.cos(wheel) * 78,
      L.valve.x + Math.sin(wheel - 0.22) * 50, L.valve.y - Math.cos(wheel - 0.22) * 50,
      L.valve.x + Math.sin(wheel + 0.22) * 50, L.valve.y - Math.cos(wheel + 0.22) * 50,
    );
    front.fillStyle(c.gold, 1);
    front.fillCircle(L.valve.x, L.valve.y, 12);
    if (pose.claim !== null) {
      const p = valvePlaqueXY(pose.claim, n);
      front.lineStyle(5, c.goldHi, 0.9);
      front.strokeRoundedRect(p.x - 48, p.y - 26, 96, 52, 10);
    }
    // e9: the barge in the low Barge Lock (rises with the fill)
    if (barge) {
      const by = L.bargeDeck.y + off.barge;
      front.fillStyle(c.stoneShade, 1);
      front.fillRoundedRect(L.bargeDeck.x - 120, by, 240, 34, 10);
      front.fillStyle(c.stoneLit, 1);
      front.fillRect(L.bargeDeck.x - 110, by + 4, 220, 8);
      anchors.barge_deck = { x: L.bargeDeck.x, y: by };
    }
  };

  const view: PoseView<SluiceWavesPose> = {
    root,
    anchors,
    applyPose(p: SluiceWavesPose) {
      pose = p;
    },
    setState(s: ContraptionState) {
      try {
        props.fx.dormancy(root, s === "dormant");
      } catch {
        root.setAlpha(s === "dormant" ? 0.7 : 1);
      }
    },
    async playSucceed(plan: SuccessPlan, p: SluiceWavesPose) {
      const r = routeSluiceSuccess(plan);
      if (r.basinsAtMs !== null) later(r.basinsAtMs, () => (basinsStart = now));
      for (const cell of r.cells) {
        later(cell.atMs, () => {
          const f = fxOf(cell.wave);
          f.from = anchors[cellAnchor(cell.wave)] ?? null;
          const to = cell.valve !== null ? basinXY(cell.valve) : eddyXY(n);
          f.pass = { start: now, to, fate: cell.fate };
        });
      }
      if (r.water) {
        const w = r.water;
        later(w.atMs, () => (waterRun = { start: now, ms: reducedMotion ? 1 : w.ms }));
      }
      await wait(reducedMotion ? 0 : plan.durationMs);
      if (destroyed) return;
      fx.clear();
      waterRun = null;
      basinsOpen = 1;
      view.applyPose(p);
    },
    async playFail(plan: FailurePlan, p: SluiceWavesPose) {
      const r = routeSluiceFail(plan);
      if (r.lockFlashAtMs !== null) later(r.lockFlashAtMs, () => (lockFlash = 700));
      if (r.wave !== null) {
        const w = r.wave;
        if (r.backAtMs !== null) {
          later(r.backAtMs, () => {
            const f = fxOf(w);
            f.from = anchors[cellAnchor(w)] ?? null;
            f.back = now;
          });
        }
        if (r.blinkAtMs !== null) later(r.blinkAtMs, () => (fxOf(w).blink = now));
        if (r.hold) {
          const h = r.hold;
          later(h.atMs, () => {
            fxOf(w).hold = { start: now, fate: h.fate };
            if (h.dots !== null) holdDots = h.dots;
          });
        }
      }
      await wait(Math.min(1600, plan.durationMs));
      if (destroyed) return;
      fx.clear();
      holdDots = null;
      view.applyPose(pose ?? p); // back to the draft pose (the WaveControl then replays with answers preselected)
    },
    update(dtMs: number) {
      if (destroyed) return;
      const dt = Math.max(0, dtMs);
      now += dt;
      lockFlash = Math.max(0, lockFlash - dt);
      if (basinsStart !== null) basinsOpen = clamp01((now - basinsStart) / 500);
      if (pose) {
        const want = Math.min(MAX_BATH_DOTS, holdDots ?? pose.bathDots);
        shownDots = reducedMotion ? want : approach(shownDots, want, dt, 70); // ≈ 200 ms to settle
        wheel = reducedMotion ? pose.wheelAngle : lerpAngle(wheel, pose.wheelAngle, smoothingFactor(dt));
      }
      redraw();
    },
    destroy() {
      destroyed = true;
      for (const t of timers) t.remove(false);
      root.destroy(true);
    },
  };
  return view;
}
