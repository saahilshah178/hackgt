/**
 * router_lanes prefab shared machinery (docs/design/20 §2.5.5, §4 row 7; cell §5.2, §5.6, §5.11). Owned by KB (L7) with
 * the prefab core; the cell skins (membrane_router, carrier_lanes, gatekeeper_maws) plug a `RouterSkin` into
 * `createRouterView`, which does everything the skins share:
 *   - boss batches: the eased pose goes through `withBossPhases(pose, station.boss.phases)` (amendment 18: later
 *     batches stay hidden until the previous batch is placed; revealed cargo fades in);
 *   - cargo: molecule glyphs (what the item IS, never where it belongs), the focus ring, the hydration shell (Pip's
 *     lens), the gradient ramp under each cargo (+ slope arrow at the ramp tier), queues at the skin's lane mouths;
 *   - the failure playback (only the beats' anchors move: `wrongKeys[0]`'s item and its lane) and the success
 *     playback (each cargo passes by its lane's physics, then the payoff).
 * World TEXT is never drawn here: lane counts and the focused cargo's name are DOM chips from `meta.describe()` (§5.3).
 * Everything is code-drawn stand-in art in the biome palette until KB4's hero parts land (`partTexture`).
 *
 * The pure helpers at the top (placement, beat routing, fx offsets) are unit-tested in shared.test.ts (node).
 */
import type Phaser from "phaser";
import type { RouterLanesConfig } from "@/world/contraptions/router-lanes.config";
import {
  eyeAngleFor,
  itemAnchor,
  laneAnchor,
  queueX,
  withBossPhases,
  ENERGY_ANCHOR,
  PAYOFF_ANCHOR,
  type BossPhaseLike,
  type RouterItemPose,
  type RouterLanesPose,
} from "@/world/contraptions/router-lanes.meta";
import { approach, clamp01, lerpAngle, smoothingFactor } from "@/world/ease";
import type { FailBeat, FailurePlan, SuccessBeat, SuccessPlan } from "@/world/types";
import type { BiomePalette, ContraptionState, PoseView, PrefabProps, XY } from "../../types";

export const ARCHETYPE_ID = "router_lanes";
/** W0 seam (tests/world-contract.test.ts checks every prefab shared.ts keeps it); the cell skins no longer use it. */
export { stubBox, type StubBoxOptions } from "../_stub";
/** Placeholder tint for the W0 labelled box (the civil skins still use it until KC draws them). */
export const STUB_COLOR = 0x2e6b6b;

// ---------------------------------------------------------------- palette

export interface CellColors {
  stoneLit: number;
  stone: number;
  stoneShade: number;
  stoneDeep: number;
  goldHi: number;
  gold: number;
  goldDeep: number;
  navy: number;
  navyDark: number;
  bronze: number;
  headLit: number;
  head: number;
  headShade: number;
  tail: number;
  tide: number;
  tideDeep: number;
  water: number;
  atp: number;
  atpCore: number;
  ink: number;
  white: number;
  salmon: number;
  glycan: number;
  cyto: number;
}
/** "#rrggbb" palette token → 0xrrggbb, or the fallback when the token is missing or malformed. */
export function hexOf(palette: BiomePalette, token: string, fallback: number): number {
  const v = palette[token];
  if (typeof v !== "string") return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(v.trim());
  return m ? parseInt(m[1]!, 16) : fallback;
}
export function cellColors(palette: BiomePalette): CellColors {
  return {
    stoneLit: hexOf(palette, "stone.lit", 0xfbf1de),
    stone: hexOf(palette, "stone.base", 0xf2e3c6),
    stoneShade: hexOf(palette, "stone.shade", 0xd9c3a0),
    stoneDeep: hexOf(palette, "stone.deep", 0xb89c78),
    goldHi: hexOf(palette, "gold.hi", 0xf6d27a),
    gold: hexOf(palette, "gold.base", 0xd9a441),
    goldDeep: hexOf(palette, "gold.deep", 0xa8782e),
    navy: hexOf(palette, "inlay.navy", 0x27466a),
    navyDark: hexOf(palette, "oil.seam.dark", 0x27405f),
    bronze: hexOf(palette, "protein.ring", 0x6e4a2e),
    headLit: hexOf(palette, "lipid.head.lit", 0xfbf1de),
    head: hexOf(palette, "lipid.head", 0xf2e3c6),
    headShade: hexOf(palette, "lipid.head.shade", 0xd9c3a0),
    tail: hexOf(palette, "lipid.tail", 0xd9a441),
    tide: hexOf(palette, "tide.shallow", 0x8fe0ea),
    tideDeep: hexOf(palette, "tide.deep", 0x4cb6d0),
    water: hexOf(palette, "mol.water", 0x4f92e6),
    atp: hexOf(palette, "atp.gold", 0xf6d27a),
    atpCore: hexOf(palette, "atp.gold.core", 0xfff6d8),
    ink: hexOf(palette, "oil.seam.dark", 0x27405f),
    white: 0xffffff,
    salmon: hexOf(palette, "glycan.salmon", 0xe48c5e),
    glycan: hexOf(palette, "glycan.blue", 0x5a95d6),
    cyto: hexOf(palette, "cyto.glow", 0xf6c48e),
  };
}
/** The molecule colour (cell §2.2: fixed across world and panel). */
export function moleculeColor(palette: BiomePalette, glyph: string | null): number {
  const fallback: Readonly<Record<string, number>> = {
    o2: 0x8cc0ee, co2: 0xa9c3bf, na: 0xee8a9a, k: 0x9c82e0, cl: 0x7fd6b0, h: 0xf7f0a0, glucose: 0xf6e3b4, steroid: 0xe6b85c, water: 0x4f92e6,
  };
  if (!glyph) return 0xdce8ea;
  return hexOf(palette, `mol.${glyph}`, fallback[glyph] ?? 0xdce8ea);
}
/** Charge sign drawn on an ion glyph (not text): +1, −1 or 0. */
export function chargeOf(glyph: string | null): -1 | 0 | 1 {
  if (glyph === "na" || glyph === "k" || glyph === "h" || glyph === "ca" || glyph === "mg") return 1;
  if (glyph === "cl") return -1;
  return 0;
}

// ---------------------------------------------------------------- pure placement

/** Where a skin puts lane i: its mouth (the chip anchor) and the y its queue floats at. */
export interface LaneSlot {
  mouth: XY;
  queueY: number;
}
/**
 * The target position of an item in the skin's layout: queued items line up above their lane's mouth by the queue
 * formula x = X_lane + 56·(q − (n − 1)/2); drifting items keep the meta's tide position plus the skin's drift offset.
 */
export function itemTarget(item: Pick<RouterItemPose, "lane" | "q" | "n" | "x" | "y">, lanes: readonly LaneSlot[], driftOffset: XY): XY {
  if (item.lane !== null) {
    const slot = lanes[item.lane];
    if (slot) return { x: queueX(slot.mouth.x, item.q, item.n), y: slot.queueY };
  }
  return { x: item.x + driftOffset.x, y: item.y + driftOffset.y };
}
/** The boss phases of a station (none for ordinary stations). */
export function phasesOf(station: { boss: { phases: readonly BossPhaseLike[] } | null }): readonly BossPhaseLike[] {
  return station.boss?.phases ?? [];
}
/** The pose the view draws: the eased meta pose with the station's boss batches applied. */
export function phasedPose(pose: RouterLanesPose, phases: readonly BossPhaseLike[]): RouterLanesPose {
  return withBossPhases(pose, phases);
}

// ---------------------------------------------------------------- pure beat routing and fx curves

export type ItemFxKind = "bounce" | "spit_back" | "eject" | "stall" | "sink" | "flash";
export type LaneFxKind = "flash" | "spark" | "swallow" | "lock";
export type PassKind = "dissolve" | "spin" | "rise" | "ride" | "swallow";
export interface RoutedFail {
  items: { key: string; kind: ItemFxKind; atMs: number; params: Readonly<Record<string, number | string>> }[];
  lanes: { index: number; kind: LaneFxKind; atMs: number }[];
  /** the console flashes (a failure that names no item) */
  console: number | null;
  shake: { px: number; ms: number; atMs: number } | null;
}
const laneIndexOf = (anchor: string): number | null => {
  const m = /^lane_(\d+)$/.exec(anchor);
  return m ? Number(m[1]) : null;
};
const itemKeyOf = (anchor: string): string | null => (anchor.startsWith("item_") ? anchor.slice(5) : null);
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Which items and lanes a failure plan moves (only what its beats name: `wrongKeys[0]`'s item and its lane). */
export function routeFail(plan: FailurePlan): RoutedFail {
  const out: RoutedFail = { items: [], lanes: [], console: null, shake: null };
  for (const b of plan.beats as readonly FailBeat[]) {
    const key = itemKeyOf(b.anchor);
    const lane = laneIndexOf(b.anchor);
    if (key !== null) {
      const kind: ItemFxKind =
        b.action === "bounce" || b.action === "spit_back" || b.action === "eject" || b.action === "stall" || b.action === "sink" ? b.action : "flash";
      out.items.push({ key, kind, atMs: b.atMs, params: b.params ?? {} });
      if (b.action === "spit_back" && b.params?.shakePx !== undefined) {
        out.shake = { px: num(b.params.shakePx, 4), ms: num(b.params.shakeMs, 200), atMs: b.atMs };
      }
    } else if (lane !== null) {
      out.lanes.push({ index: lane, kind: b.action === "spark" ? "spark" : "flash", atMs: b.atMs });
    } else if (b.anchor === "console") out.console = b.atMs;
  }
  return out;
}
export interface RoutedSuccess {
  passes: { key: string; kind: PassKind; atMs: number; spark: boolean }[];
  lanes: { index: number; kind: LaneFxKind; atMs: number }[];
  payoffAtMs: number | null;
}
/** The success playback: every cargo passes by its lane's physics, maws swallow, then the payoff. */
export function routeSuccess(plan: SuccessPlan): RoutedSuccess {
  const out: RoutedSuccess = { passes: [], lanes: [], payoffAtMs: null };
  for (const b of plan.beats as readonly SuccessBeat[]) {
    const key = itemKeyOf(b.anchor);
    const lane = laneIndexOf(b.anchor);
    if (key !== null) {
      const kind: PassKind = b.action === "spin" || b.action === "rise" || b.action === "ride" || b.action === "swallow" ? b.action : "dissolve";
      out.passes.push({ key, kind, atMs: b.atMs, spark: num(b.params?.spark, 0) > 0 });
    } else if (lane !== null) out.lanes.push({ index: lane, kind: b.action === "lock" ? "lock" : "swallow", atMs: b.atMs });
    else if (b.anchor === PAYOFF_ANCHOR) out.payoffAtMs = b.atMs;
  }
  return out;
}

/** Durations (ms) of the per-item failure motions. */
export const ITEM_FX_MS: Readonly<Record<ItemFxKind, number>> = { bounce: 900, spit_back: 900, eject: 800, stall: 500, sink: 600, flash: 600 };
/**
 * The offset (and extra rotation) of a failing item u ∈ [0, 1] through its motion. Every curve but `stall` returns to 0
 * at u = 1, so the item ends back in its queue slot (the draft pose; the panel keeps every placement); `stall` holds at
 * the stall point and the plan's following `sink` beat starts there and brings it back.
 */
export function itemFxOffset(kind: ItemFxKind, u: number, dir = 1): { dx: number; dy: number; rot: number } {
  const k = clamp01(u);
  const fade = 1 - k;
  switch (kind) {
    case "bounce": // drops onto the heads and bounces back up
      return { dx: 0, dy: 80 * Math.abs(Math.sin(2.5 * Math.PI * k)) * fade, rot: 0 };
    case "spit_back": // shot back out of the maw, arcing up and settling
      return { dx: dir * 40 * Math.sin(Math.PI * k), dy: -170 * Math.sin(Math.PI * k), rot: dir * 0.8 * Math.sin(Math.PI * k) };
    case "eject": // refused by the ring: slides away sideways and drifts back
      return { dx: dir * 110 * Math.sin(Math.PI * k), dy: -20 * Math.sin(Math.PI * k), rot: -dir * 0.4 * Math.sin(Math.PI * k) };
    case "stall": // creeps up its ramp and shivers (the sink beat brings it back)
      return { dx: 18 * k, dy: -36 * k + 3 * Math.sin(12 * Math.PI * k), rot: 0 };
    case "sink": // slides back down from the stall point
      return { dx: 18 * fade, dy: -36 * fade, rot: 0 };
    case "flash":
      return { dx: 0, dy: 0, rot: 0 };
  }
}
/** A passing item's progress curve: moves into the lane mouth by 0.6, fades out by 1. */
export function passProgress(u: number): { travel: number; alpha: number } {
  const k = clamp01(u);
  return { travel: clamp01(k / 0.6), alpha: k < 0.6 ? 1 : clamp01(1 - (k - 0.6) / 0.4) };
}
export const PASS_MS = 650;

// ---------------------------------------------------------------- drawing helpers (skins use them)

/** A loaded texture key for a hero/kit part, or null when the art build has not produced it (stand-in art then). */
export function partTexture(scene: Phaser.Scene, props: PrefabProps<unknown>, assetKey: string): string | null {
  try {
    const key = props.tex(assetKey);
    return scene.textures.exists(key) ? key : null;
  } catch {
    return null;
  }
}

function hexPath(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, rot = 0): void {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 3;
    const px = x + r * Math.cos(a);
    const py = y + r * Math.sin(a);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

/** A molecule glyph (what the cargo IS): O₂ pairs, CO₂ triples, water Vs, ions with their charge, glucose rings. */
export function drawMolecule(g: Phaser.GameObjects.Graphics, glyph: string | null, x: number, y: number, r: number, color: number, c: CellColors, alpha = 1, rot = 0): void {
  const ink = c.ink;
  const ball = (bx: number, by: number, br: number, col: number) => {
    g.fillStyle(ink, 0.85 * alpha);
    g.fillCircle(bx, by, br + 3);
    g.fillStyle(col, alpha);
    g.fillCircle(bx, by, br);
    g.fillStyle(0xffffff, 0.45 * alpha);
    g.fillCircle(bx - br * 0.32, by - br * 0.32, br * 0.3);
  };
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const at = (dx: number, dy: number) => ({ x: x + dx * cs - dy * sn, y: y + dx * sn + dy * cs });
  switch (glyph) {
    case "o2": {
      const a = at(-r * 0.38, 0);
      const b = at(r * 0.38, 0);
      ball(a.x, a.y, r * 0.62, color);
      ball(b.x, b.y, r * 0.62, color);
      break;
    }
    case "co2": {
      const a = at(-r * 0.62, 0);
      const b = at(r * 0.62, 0);
      ball(a.x, a.y, r * 0.45, color);
      ball(b.x, b.y, r * 0.45, color);
      ball(x, y, r * 0.5, 0x6f7f7c);
      break;
    }
    case "water": {
      const h1 = at(-r * 0.62, r * 0.42);
      const h2 = at(r * 0.62, r * 0.42);
      ball(h1.x, h1.y, r * 0.34, 0xf2f6f8);
      ball(h2.x, h2.y, r * 0.34, 0xf2f6f8);
      ball(x, y - r * 0.1, r * 0.62, color);
      break;
    }
    case "glucose": {
      g.fillStyle(ink, 0.85 * alpha);
      hexPath(g, x, y, r + 3, rot);
      g.fillPath();
      g.fillStyle(color, alpha);
      hexPath(g, x, y, r, rot);
      g.fillPath();
      g.lineStyle(3, c.gold, alpha);
      hexPath(g, x, y, r * 0.55, rot);
      g.strokePath();
      break;
    }
    case "steroid": {
      for (const dx of [-0.9, 0, 0.9]) {
        const p = at(dx * r * 0.8, dx === 0 ? -r * 0.2 : 0);
        g.fillStyle(ink, 0.85 * alpha);
        hexPath(g, p.x, p.y, r * 0.5 + 3, rot + Math.PI / 6);
        g.fillPath();
        g.fillStyle(color, alpha);
        hexPath(g, p.x, p.y, r * 0.5, rot + Math.PI / 6);
        g.fillPath();
      }
      break;
    }
    default: {
      const ion = chargeOf(glyph) !== 0;
      ball(x, y, ion ? r * 0.72 : r * 0.85, color);
    }
  }
  const q = chargeOf(glyph);
  if (q !== 0) {
    const s = r * 0.32;
    g.fillStyle(0xffffff, alpha);
    g.fillRect(x - s, y - 2.5, 2 * s, 5);
    if (q > 0) g.fillRect(x - 2.5, y - s, 5, 2 * s);
  }
}

/** Pip's lens: 7 blue droplets orbiting at 1.4× the radius, 0.3 rev/s (cell §5.2); `alpha` = the shell strength. */
export function drawHydrationShell(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, tSec: number, alpha: number, c: CellColors, reducedMotion: boolean): void {
  if (alpha <= 0.01) return;
  const turn = reducedMotion ? 0 : 2 * Math.PI * 0.3 * tSec;
  for (let i = 0; i < 7; i++) {
    const a = turn + (i * 2 * Math.PI) / 7;
    const dx = Math.cos(a) * r * 1.4;
    const dy = Math.sin(a) * r * 1.4;
    g.fillStyle(c.water, 0.9 * alpha);
    g.fillCircle(x + dx, y + dy, 6);
    g.fillStyle(0xffffff, 0.6 * alpha);
    g.fillCircle(x + dx - 2, y + dy - 2, 2);
  }
}

/** The white focus ring (r = 1.3× the molecule, cell §5.2). */
export function drawFocusRing(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, alpha = 1): void {
  g.lineStyle(5, 0xffffff, 0.95 * alpha);
  g.strokeCircle(x, y, r * 1.3);
}

/**
 * A gradient ramp under a cargo (cell §5.6): 120 wide, rising toward the more crowded side by m = (to − from)/10;
 * dense dots at the crowded end. `arrow` draws the white slope arrow (the ramp tier). Direction is the text's own.
 */
export function drawRamp(g: Phaser.GameObjects.Graphics, x: number, y: number, slope: number | null, arrow: boolean, c: CellColors, alpha = 1): void {
  const w = 120;
  const base = y + 56;
  if (slope === null) {
    g.fillStyle(c.stoneShade, 0.95 * alpha);
    g.fillRoundedRect(x - w / 2, base, w, 14, 5);
    g.fillStyle(c.stoneLit, alpha);
    g.fillRect(x - w / 2 + 6, base + 2, w - 12, 3);
    return;
  }
  const rise = 46 * slope; // + rises to the right
  const hl = 20 + Math.max(0, -rise);
  const hr = 20 + Math.max(0, rise);
  g.fillStyle(c.goldDeep, 0.9 * alpha);
  g.fillTriangle(x - w / 2, base + 22, x + w / 2, base + 22, x - w / 2, base + 22 - hl);
  g.fillTriangle(x + w / 2, base + 22, x + w / 2, base + 22 - hr, x - w / 2, base + 22 - hl);
  g.fillStyle(c.stone, alpha);
  g.fillTriangle(x - w / 2 + 4, base + 18, x + w / 2 - 4, base + 18, x - w / 2 + 4, base + 22 - hl + 4);
  g.fillTriangle(x + w / 2 - 4, base + 18, x + w / 2 - 4, base + 22 - hr + 4, x - w / 2 + 4, base + 22 - hl + 4);
  // crowding dots: dense at the high end
  const crowdedRight = rise > 0;
  for (let i = 0; i < 9; i++) {
    const f = i / 8;
    const density = crowdedRight ? f : 1 - f;
    if (density < 0.35 && i % 2 === 1) continue;
    const px = x - w / 2 + 10 + f * (w - 20);
    const top = base + 22 - (hl + (hr - hl) * f);
    g.fillStyle(c.navy, 0.7 * alpha);
    g.fillCircle(px, top + 8 + (i % 3) * 4, 2.5 + 1.5 * density);
  }
  if (arrow && Math.abs(slope) > 0.01) {
    const dir = Math.sign(rise);
    const x0 = x - dir * 44;
    const x1 = x + dir * 44;
    const y0 = base + 22 - (dir > 0 ? hl : hr) - 12;
    const y1 = base + 22 - (dir > 0 ? hr : hl) - 12;
    g.lineStyle(5, 0xffffff, alpha);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.strokePath();
    const a = Math.atan2(y1 - y0, x1 - x0);
    g.fillStyle(0xffffff, alpha);
    g.fillTriangle(x1 + Math.cos(a) * 10, y1 + Math.sin(a) * 10, x1 + Math.cos(a + 2.5) * 12, y1 + Math.sin(a + 2.5) * 12, x1 + Math.cos(a - 2.5) * 12, y1 + Math.sin(a - 2.5) * 12);
  }
}

/** A spark star (gold) or a fizzle (grey puffs); `k` = 1 at the start → 0 at the end. */
export function drawSpark(g: Phaser.GameObjects.Graphics, at: XY, k: number, color: number, fizzle = false): void {
  if (k <= 0) return;
  const r = 16 + 26 * (1 - k);
  if (fizzle) {
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + 0.4;
      g.fillStyle(0xb9c2c6, 0.6 * k);
      g.fillCircle(at.x + Math.cos(a) * r * 0.7, at.y + Math.sin(a) * r * 0.7 - (1 - k) * 20, 6 * k + 2);
    }
    return;
  }
  g.lineStyle(4, color, k);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.3;
    g.beginPath();
    g.moveTo(at.x + Math.cos(a) * r * 0.35, at.y + Math.sin(a) * r * 0.35);
    g.lineTo(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r);
    g.strokePath();
  }
  g.fillStyle(0xffffff, 0.8 * k);
  g.fillCircle(at.x, at.y, 7 * k + 2);
}

/** A few bubbles rising from a point (the spit-back puff). */
export function drawBubbles(g: Phaser.GameObjects.Graphics, at: XY, k: number, c: CellColors): void {
  if (k <= 0) return;
  for (let i = 0; i < 6; i++) {
    const rise = (1 - k) * (60 + i * 14);
    g.lineStyle(3, c.tide, 0.8 * k);
    g.strokeCircle(at.x + (i - 2.5) * 14 + Math.sin(i * 2 + (1 - k) * 6) * 6, at.y - rise, 5 + (i % 3) * 3);
  }
}

// ---------------------------------------------------------------- the skin interface

export interface RouterSkinCtx {
  scene: Phaser.Scene;
  props: PrefabProps<RouterLanesConfig>;
  config: RouterLanesConfig;
  colors: CellColors;
  /** container-local console position */
  consoleLocal: XY;
  /** container-local y of the ground under the console */
  groundLocal: number;
  /** container-local x of the payoff blocker (null when the station has none) */
  blockerLocal: number | null;
  reducedMotion: boolean;
}
export interface RouterBuild {
  /** skin anchors (§4.3 list); `lane_<i>`, `item_<key>`, `energy`, `payoff` and `console` are added by the core */
  anchors: Record<string, XY>;
  /** lane i (config order) mouth + queue height */
  lanes: LaneSlot[];
  /** the ATP port or pipe top (null without energy) */
  energy: XY | null;
  payoff: XY;
  /** shifts the meta's generic tide band into the skin's composition */
  driftOffset: XY;
  /** the eye the pupil tracks from (gatekeeper), else null */
  eye: XY | null;
}
/** Transient state the core keeps for the skins. Progress values run 0 → 1 once started (null = not started). */
export interface RouterDyn {
  now: number; // ms since the view was created
  state: ContraptionState;
  payoff: number | null;
  /** per-lane flash / spark / swallow timers (ms left) */
  laneFlash: number[];
  laneSpark: number[];
  laneSwallow: number[];
  /** eased pupil angle (radians) */
  eye: number;
  /** ATP packets travelling down the pipe (0 → 1) */
  packets: number[];
  /** the camera-shake budget is spent by the core; skins read this only to rumble a part */
  rumble: number;
}
export interface RouterSkin {
  skinId: string;
  /** cargo radius (world units) */
  itemR: number;
  /** draw each cargo's gradient ramp under it (carrier_lanes, gatekeeper_maws) */
  ramps: boolean;
  /** a gentle camera rumble when the payoff starts (the Gatekeeper turning aside); skipped under reduced motion */
  payoffShake?: { px: number; ms: number };
  /** static parts into `back` (behind cargo); returns the layout */
  build(ctx: RouterSkinCtx, back: Phaser.GameObjects.Graphics): RouterBuild;
  /** the moving parts behind the cargo (rings, maws, fins, doors, the eye, the pipe) every frame */
  drawDynamic(g: Phaser.GameObjects.Graphics, pose: RouterLanesPose, dyn: RouterDyn, ctx: RouterSkinCtx, layout: RouterBuild): void;
  /** parts drawn OVER the cargo (maw lips, arch fronts) every frame; optional */
  drawFront?(g: Phaser.GameObjects.Graphics, pose: RouterLanesPose, dyn: RouterDyn, ctx: RouterSkinCtx, layout: RouterBuild): void;
}

// ---------------------------------------------------------------- the view

interface ItemView {
  pos: XY;
  alpha: number;
  fx: { kind: ItemFxKind; start: number; dur: number; dir: number } | null;
  pass: { kind: PassKind; start: number; spark: boolean } | null;
  flash: number;
}

export function createRouterView(scene: Phaser.Scene, props: PrefabProps<RouterLanesConfig>, skin: RouterSkin): PoseView<RouterLanesPose> {
  const config = props.config;
  const anchor = props.station.anchor;
  const ctx: RouterSkinCtx = {
    scene,
    props,
    config,
    colors: cellColors(props.palette),
    consoleLocal: { x: props.station.consoleX - anchor.x, y: props.groundY - anchor.y },
    groundLocal: props.groundY - anchor.y,
    blockerLocal: props.station.payoff.blocker ? props.station.payoff.blocker.x - anchor.x : null,
    reducedMotion: props.reducedMotion,
  };
  const phases = phasesOf(props.station);
  const root = scene.add.container(anchor.x, anchor.y);
  const back = scene.add.graphics();
  const dynamic = scene.add.graphics();
  const cargo = scene.add.graphics();
  const front = scene.add.graphics();
  root.add([back, dynamic, cargo, front]);

  const layout = skin.build(ctx, back);
  const anchors: Record<string, XY> & { console: XY } = { ...layout.anchors, console: ctx.consoleLocal };
  layout.lanes.forEach((l, i) => (anchors[laneAnchor(i)] = { x: l.mouth.x, y: l.mouth.y }));
  anchors[ENERGY_ANCHOR] = layout.energy ?? anchors.console;
  anchors[PAYOFF_ANCHOR] = layout.payoff;

  const items = new Map<string, ItemView>();
  const timers: Phaser.Time.TimerEvent[] = [];
  const dyn: RouterDyn = {
    now: 0,
    state: "dormant",
    payoff: null,
    laneFlash: layout.lanes.map(() => 0),
    laneSpark: layout.lanes.map(() => 0),
    laneSwallow: layout.lanes.map(() => 0),
    eye: Math.PI / 2,
    packets: [],
    rumble: 0,
  };
  let pose: RouterLanesPose | null = null;
  let lastActive = -1;
  let consoleFlash = 0;
  let destroyed = false;

  const later = (ms: number, fn: () => void) => {
    if (ms <= 0) {
      fn();
      return;
    }
    timers.push(scene.time.delayedCall(ms, () => !destroyed && fn()));
  };
  const wait = (ms: number) => new Promise<void>((resolve) => later(ms, resolve));

  const viewOf = (key: string, at: XY): ItemView => {
    let v = items.get(key);
    if (!v) {
      v = { pos: { ...at }, alpha: 0, fx: null, pass: null, flash: 0 };
      items.set(key, v);
    }
    return v;
  };

  const shake = (px: number, ms: number) => {
    if (ctx.reducedMotion) return;
    try {
      scene.cameras.main.shake(ms, px / Math.max(1, scene.scale.width));
    } catch {
      /* a camera-less test scene */
    }
    dyn.rumble = ms;
  };

  const redraw = () => {
    if (!pose) return;
    dynamic.clear();
    cargo.clear();
    front.clear();
    skin.drawDynamic(dynamic, pose, dyn, ctx, layout);
    const tSec = dyn.now / 1000;
    const r = skin.itemR;
    for (const it of pose.items) {
      const v = items.get(it.key);
      if (!v || v.alpha <= 0.01) continue;
      let { x, y } = v.pos;
      let rot = 0;
      let alpha = v.alpha * (1 - it.passed);
      if (v.fx) {
        const u = (dyn.now - v.fx.start) / v.fx.dur;
        if (u >= 0) {
          const o = itemFxOffset(v.fx.kind, u, v.fx.dir);
          x += o.dx;
          y += o.dy;
          rot = o.rot;
          if (v.fx.kind === "spit_back") drawBubbles(cargo, { x: v.pos.x, y: v.pos.y + r }, 1 - clamp01(u), ctx.colors);
        }
      }
      if (v.pass) {
        const u = (dyn.now - v.pass.start) / PASS_MS;
        const lane = it.lane !== null ? layout.lanes[it.lane] : undefined;
        if (u >= 0 && lane) {
          const p = passProgress(u);
          const dest = { x: lane.mouth.x, y: lane.mouth.y + (v.pass.kind === "rise" ? -40 : 30) };
          x += (dest.x - x) * p.travel;
          y += (dest.y - y) * p.travel;
          alpha *= p.alpha;
          if (v.pass.kind === "spin") rot = 6 * p.travel;
          if (v.pass.kind === "ride") y -= 50 * Math.sin(Math.PI * p.travel);
          if (v.pass.spark && u < 0.7) drawSpark(cargo, { x, y: y - r }, 1 - u / 0.7, ctx.colors.atp);
        }
      }
      if (alpha <= 0.01) continue;
      if (skin.ramps && !v.pass) drawRamp(cargo, x, y, it.ramp, pose.rampArrows, ctx.colors, alpha);
      drawHydrationShell(cargo, x, y, r, tSec, it.shell * alpha, ctx.colors, ctx.reducedMotion);
      drawMolecule(cargo, it.glyph, x, y, r, moleculeColor(props.palette, it.glyph), ctx.colors, alpha, rot);
      if (it.focus && !pose.solved) drawFocusRing(cargo, x, y, r, alpha);
      if (v.flash > 0 && Math.floor(v.flash / 110) % 2 === 0) {
        cargo.lineStyle(5, ctx.colors.salmon, alpha);
        cargo.strokeCircle(x, y, r * 1.2);
      }
      anchors[itemAnchor(it.key)] = { x, y };
    }
    if (consoleFlash > 0) {
      front.lineStyle(6, ctx.colors.salmon, Math.min(1, consoleFlash / 300));
      front.strokeRoundedRect(anchors.console.x - 70, anchors.console.y - 170, 140, 170, 12);
    }
    skin.drawFront?.(front, pose, dyn, ctx, layout);
  };

  const view: PoseView<RouterLanesPose> = {
    root,
    anchors,
    applyPose(p: RouterLanesPose) {
      pose = phasedPose(p, phases);
      for (const it of pose.items) {
        const target = itemTarget(it, layout.lanes, layout.driftOffset);
        const v = viewOf(it.key, target);
        if (!anchors[itemAnchor(it.key)]) anchors[itemAnchor(it.key)] = { ...v.pos };
      }
      // a packet per NEW active cargo runs down the ATP pipe (cell §5.11)
      if (lastActive >= 0 && pose.activeCount > lastActive && !ctx.reducedMotion) {
        for (let i = lastActive; i < pose.activeCount; i++) dyn.packets.push(-0.25 * (i - lastActive));
      }
      lastActive = pose.activeCount;
    },
    setState(state: ContraptionState) {
      dyn.state = state;
      try {
        props.fx.dormancy(root, state === "dormant");
      } catch {
        root.setAlpha(state === "dormant" ? 0.7 : 1);
      }
    },
    async playSucceed(plan: SuccessPlan, p: RouterLanesPose) {
      const routed = routeSuccess(plan);
      for (const pass of routed.passes) {
        later(pass.atMs, () => {
          const v = items.get(pass.key);
          if (v) v.pass = { kind: pass.kind, start: dyn.now, spark: pass.spark };
        });
      }
      for (const l of routed.lanes) later(l.atMs, () => (dyn.laneSwallow[l.index] = 450));
      if (routed.payoffAtMs !== null) {
        later(routed.payoffAtMs, () => {
          dyn.payoff = 0;
          if (skin.payoffShake) shake(skin.payoffShake.px, skin.payoffShake.ms);
        });
      }
      await wait(ctx.reducedMotion ? 0 : plan.durationMs);
      if (destroyed) return;
      dyn.payoff = 1;
      view.applyPose(p);
    },
    async playFail(plan: FailurePlan, p: RouterLanesPose) {
      const routed = routeFail(plan);
      for (const f of routed.items) {
        later(f.atMs, () => {
          const v = items.get(f.key);
          if (!v) return;
          if (f.kind === "flash") v.flash = ITEM_FX_MS.flash;
          else {
            const lane = pose?.items.find((i) => i.key === f.key)?.lane ?? null;
            const mouth = lane !== null ? layout.lanes[lane]?.mouth.x ?? 0 : 0;
            v.fx = { kind: f.kind, start: dyn.now, dur: ITEM_FX_MS[f.kind], dir: mouth >= 0 ? 1 : -1 };
          }
        });
      }
      for (const l of routed.lanes) {
        later(l.atMs, () => {
          if (l.kind === "spark") dyn.laneSpark[l.index] = 500;
          else dyn.laneFlash[l.index] = 650;
        });
      }
      if (routed.console !== null) later(routed.console, () => (consoleFlash = 700));
      if (routed.shake) {
        const s = routed.shake;
        later(s.atMs, () => shake(s.px, s.ms));
      }
      await wait(Math.min(1600, plan.durationMs));
      if (destroyed) return;
      for (const v of items.values()) {
        v.fx = null;
        v.flash = 0;
      }
      view.applyPose(pose ?? p); // back to the draft pose
    },
    update(dtMs: number) {
      if (destroyed) return;
      const dt = Math.max(0, dtMs);
      dyn.now += dt;
      const k = ctx.reducedMotion ? 1 : smoothingFactor(dt);
      if (pose) {
        let focusPos: XY | null = null;
        for (const it of pose.items) {
          const v = items.get(it.key);
          if (!v) continue;
          const target = itemTarget(it, layout.lanes, layout.driftOffset);
          v.pos = { x: v.pos.x + (target.x - v.pos.x) * k, y: v.pos.y + (target.y - v.pos.y) * k };
          v.alpha = ctx.reducedMotion ? (it.visible ? 1 : 0) : approach(v.alpha, it.visible ? 1 : 0, dt, 180);
          v.flash = Math.max(0, v.flash - dt);
          if (v.fx && dyn.now - v.fx.start > v.fx.dur) v.fx = null;
          if (it.focus && it.visible) focusPos = v.pos;
        }
        if (layout.eye) {
          const want = focusPos ? eyeAngleFor(layout.eye, focusPos) : Math.PI / 2;
          dyn.eye = ctx.reducedMotion ? want : lerpAngle(dyn.eye, want, smoothingFactor(dt));
        }
      }
      for (let i = 0; i < dyn.laneFlash.length; i++) {
        dyn.laneFlash[i] = Math.max(0, dyn.laneFlash[i]! - dt);
        dyn.laneSpark[i] = Math.max(0, dyn.laneSpark[i]! - dt);
        dyn.laneSwallow[i] = Math.max(0, dyn.laneSwallow[i]! - dt);
      }
      dyn.packets = dyn.packets.map((u) => u + dt / 900).filter((u) => u < 1);
      dyn.rumble = Math.max(0, dyn.rumble - dt);
      consoleFlash = Math.max(0, consoleFlash - dt);
      if (dyn.payoff !== null && dyn.payoff < 1) dyn.payoff = Math.min(1, dyn.payoff + (ctx.reducedMotion ? 1 : dt / 900));
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
