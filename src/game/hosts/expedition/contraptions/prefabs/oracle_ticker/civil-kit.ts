/**
 * The civil drawing kit (KC3, L8; docs/design/20 §4.3, civil §5). Shared by every `archive_of_voices` skin the KC lane
 * draws: wire_ticker, tumbler_vault, witness_projector, walking_road, timeline_bridge, filing_cabinets and
 * provenance_drawers (and the record_lens accessory). It lives under oracle_ticker/ because that is a path the lane
 * owns; nothing in it is specific to the ticker.
 *
 * Two halves:
 *  - PURE helpers (no Phaser at runtime; unit-tested in civil-kit.test.ts): palette resolution, the damped spring the
 *    pendant lamp hangs on, slip flights, stair steps under a payoff polyline, failure curves (tip, sink, dissolve,
 *    grind), the typewriter count, beat routing by anchor prefix.
 *  - Drawing primitives on a Phaser Graphics (brass plates, paper, stamps, lamps, the microfilm-reader console, beams).
 *    Every primitive is a stand-in for a §4.3 kit/hero part until KC4's art lands. World TEXT is never drawn here
 *    (bible §5.3): words are DOM chips from the metas' describe(); paper shows ink bars.
 *
 * Sensitivity (R10, civil §5.0.4): every civil skin is `sensitiveSafe`. Nothing here shakes the camera, bursts
 * particles or strikes; failures are mechanical refusals (a lamp holds, a slab tips, a slip bounces, a tumbler grinds).
 */
import type Phaser from "phaser";
import { clamp, clamp01 } from "@/world/ease";
import type { FailBeat, SuccessBeat } from "@/world/types";
import type { BiomePalette, XY } from "../../types";

// ================================================================ palette

export interface CivilColors {
  stoneLit: number;
  stone: number;
  stoneShade: number;
  stoneDeep: number;
  brass: number;
  brassHi: number;
  brassDeep: number;
  bronze: number;
  navy: number;
  navyDark: number;
  brick: number;
  brickLit: number;
  brickShade: number;
  steel: number;
  steelShade: number;
  concrete: number;
  curb: number;
  asphalt: number;
  asphaltSheen: number;
  paper: number;
  paperAged: number;
  paperTrap: number;
  ink: number;
  cyan: number;
  cyanHi: number;
  cyanShade: number;
  lamp: number;
  salmon: number;
  autumn: number;
  dormant: number;
  water: number;
  waterDeep: number;
  shadow: number;
  lensDormant: number;
  /** ui.accent: the ONLY orange in the world (bound to input: aimed/accused sockets, the lens chip) */
  accent: number;
  white: number;
}

/** "#rrggbb" palette token → 0xrrggbb, or the fallback when the token is missing or malformed. */
export function hexOf(palette: BiomePalette, token: string, fallback: number): number {
  const v = palette[token];
  if (typeof v !== "string") return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(v.trim());
  return m ? parseInt(m[1]!, 16) : fallback;
}

/** The civil palette (civil §2.2) with the archive_of_voices fallbacks, so a missing token never draws black. */
export function civilColors(palette: BiomePalette): CivilColors {
  const h = (t: string, f: number) => hexOf(palette, t, f);
  return {
    stoneLit: h("stone.lit", 0xfbf1de),
    stone: h("stone.base", 0xf2e3c6),
    stoneShade: h("stone.shade", 0xd9c3a0),
    stoneDeep: h("stone.deep", 0xb89c78),
    brass: h("brass.base", 0xd9a441),
    brassHi: h("brass.hi", 0xf6d27a),
    brassDeep: h("brass.deep", 0xa8782e),
    bronze: h("bronze.ring", 0x6e4a2e),
    navy: h("inlay.navy", 0x27466a),
    navyDark: h("inlay.navy.dark", 0x1b3150),
    brick: h("brick.base", 0xb5654f),
    brickLit: h("brick.lit", 0xd08a6e),
    brickShade: h("brick.shade", 0x7e4038),
    steel: h("steel", 0x9aa3b8),
    steelShade: h("steel.shade", 0x646c85),
    concrete: h("concrete", 0xb9afc6),
    curb: h("curb", 0x8c829e),
    asphalt: h("asphalt.wet", 0x4a4f66),
    asphaltSheen: h("asphalt.sheen", 0x6d6f8c),
    paper: h("paper", 0xf7f1e3),
    paperAged: h("paper.aged", 0xe9d8b4),
    paperTrap: h("paper.trap", 0xd9c08e),
    ink: h("ink", 0x2b3a44),
    cyan: h("recordlight", 0x6ed2f2),
    cyanHi: h("recordlight.hi", 0xc9f3ff),
    cyanShade: h("recordlight.shade", 0x2e8fc0),
    lamp: h("lamp", 0xf6d27a),
    salmon: h("safelight", 0xc4643c),
    autumn: h("autumn", 0xe48c5e),
    dormant: h("dormant", 0xa9a3b8),
    water: h("water.shallow", 0x8fe0ea),
    waterDeep: h("water.deep", 0x4cb6d0),
    shadow: h("shadow", 0x6e7f9a),
    lensDormant: h("lens.dormant", 0x8e8aa0),
    accent: h("ui.accent", 0xe2892c),
    white: 0xffffff,
  };
}

/** Linear blend of two 0xrrggbb colours (t = 0 → a, 1 → b). */
export function mix(a: number, b: number, t: number): number {
  const k = clamp01(t);
  const ch = (s: number) => Math.round(((a >> s) & 0xff) + ((((b >> s) & 0xff) - ((a >> s) & 0xff)) * k));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// ================================================================ pure motion helpers

/** A damped spring's state (value and velocity per second). */
export interface Spring {
  x: number;
  v: number;
}
/**
 * One step of a damped spring toward `target` (semi-implicit Euler, 4 ms substeps so large frames stay stable).
 * `k` is the stiffness in s⁻², `zeta` the damping ratio (< 1 overshoots: the pendant lamp "feels hung", civil §5.4).
 */
export function springStep(s: Spring, target: number, dtMs: number, k: number, zeta: number): Spring {
  let { x, v } = s;
  const c = 2 * zeta * Math.sqrt(Math.max(0, k));
  let left = Math.max(0, Math.min(dtMs, 250)) / 1000;
  while (left > 1e-9) {
    const h = Math.min(0.004, left);
    v += (k * (target - x) - c * v) * h;
    x += v * h;
    left -= h;
  }
  return { x, v };
}

/** Point on a quadratic Bézier from `a` to `b` whose control point sits `apex` above the higher end's midpoint. */
export function quadBezier(a: XY, b: XY, apex: number, u: number): XY {
  const t = clamp01(u);
  const c = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - apex };
  const m = 1 - t;
  return { x: m * m * a.x + 2 * m * t * c.x + t * t * b.x, y: m * m * a.y + 2 * m * t * c.y + t * t * b.y };
}

/** A slip's flight to its drawer (civil §5.8): quadratic Bézier, apex 180 above, one full turn, ease-in-out. */
export function slipFlight(from: XY, to: XY, u: number, apex = 180): { x: number; y: number; rot: number } {
  const t = clamp01(u);
  const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const p = quadBezier(from, to, apex, e);
  return { x: p.x, y: p.y, rot: 2 * Math.PI * e };
}

export interface StepRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/**
 * Stair steps UNDER a payoff polyline (so the player, who walks on the polyline, is never covered): for every rising
 * or falling segment, steps of about `rise` height whose treads sit at or below the line. Flat segments become one
 * slab. `depth` is how far below the line each block extends.
 */
export function stairSteps(points: readonly (readonly [number, number])[], rise = 40, depth = 60): StepRect[] {
  const out: StepRect[] = [];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]!;
    const [x1, y1] = points[i]!;
    const w = x1 - x0;
    if (w <= 0) continue;
    const dy = y1 - y0;
    const n = Math.max(1, Math.round(Math.abs(dy) / rise));
    if (Math.abs(dy) < 1) {
      out.push({ x: x0, y: y0, w, h: depth });
      continue;
    }
    for (let s = 0; s < n; s++) {
      const sx0 = x0 + (w * s) / n;
      const sx1 = x0 + (w * (s + 1)) / n;
      // the lower of the two line heights over this step (y DOWN: the larger y) keeps the tread under the line
      const top = Math.max(y0 + (dy * s) / n, y0 + (dy * (s + 1)) / n);
      out.push({ x: sx0, y: top, w: sx1 - sx0, h: depth + Math.abs(dy) / n });
    }
  }
  return out;
}

/** 0 → 1 → 0 sine pulse at `hz` (0.5 + 0.5 sin); reduced motion holds 1. */
export function pulse(tMs: number, hz: number, reducedMotion = false): number {
  return reducedMotion ? 1 : 0.5 + 0.5 * Math.sin(2 * Math.PI * hz * (tMs / 1000));
}

/** Characters typed after `ms` at `cps` (the "type lifts" effect, bible §7.3); reduced motion types everything. */
export function typedCount(length: number, ms: number, cps = 45, reducedMotion = false): number {
  if (reducedMotion) return length;
  return clamp(Math.floor((Math.max(0, ms) / 1000) * cps), 0, length);
}

/** A failing plank/slab/section: tips `deg`, then sinks and fades; u ∈ [0, 1]. Returns to rest at u = 1. */
export function tipCurve(u: number, deg: number): { rot: number; dy: number; alpha: number } {
  const t = clamp01(u);
  if (t < 0.35) {
    const k = t / 0.35;
    return { rot: (deg * Math.PI * k) / 180, dy: 6 * k, alpha: 1 };
  }
  if (t < 0.75) {
    const k = (t - 0.35) / 0.4;
    return { rot: (deg * Math.PI) / 180, dy: 6 + 70 * k * k, alpha: 1 - 0.8 * k };
  }
  const k = (t - 0.75) / 0.25; // the draft still holds it: it rises back into its bay
  return { rot: ((deg * Math.PI) / 180) * (1 - k), dy: 76 * (1 - k), alpha: 0.2 + 0.8 * k };
}

/** A decoy dissolving into scraps: alpha falls and the scraps drift up; comes back at u = 1 (the draft keeps it). */
export function dissolveCurve(u: number): { alpha: number; scatter: number } {
  const t = clamp01(u);
  if (t < 0.7) return { alpha: 1 - t / 0.7, scatter: t / 0.7 };
  const k = (t - 0.7) / 0.3;
  return { alpha: k, scatter: 1 - k };
}

/** A tumbler grinding: a ±`deg` judder `times` times over u ∈ [0, 1] (radians); 0 at both ends. */
export function grindOffset(u: number, deg: number, times: number): number {
  const t = clamp01(u);
  return ((deg * Math.PI) / 180) * Math.sin(2 * Math.PI * times * t) * (1 - t * 0.3);
}

/** A slip bouncing back out of its drawer to the table: a hop whose height decays (u ∈ [0, 1]). */
export function bounceHop(from: XY, to: XY, u: number): XY {
  const t = clamp01(u);
  const x = from.x + (to.x - from.x) * t;
  const base = from.y + (to.y - from.y) * t;
  return { x, y: base - 160 * Math.abs(Math.sin(Math.PI * 1.5 * t)) * (1 - t) };
}

// ================================================================ beat routing

/** "tumbler_2" with prefix "tumbler_" → 2; anything else → null. */
export function anchorIndex(anchor: string, prefix: string): number | null {
  if (!anchor.startsWith(prefix)) return null;
  const rest = anchor.slice(prefix.length);
  return /^\d+$/.test(rest) ? Number(rest) : null;
}

/** A beat param as a number (or the fallback). */
export function numParam(b: Pick<FailBeat | SuccessBeat, "params">, key: string, fallback: number): number {
  const v = b.params?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
/** A beat param as a string (or null). */
export function strParam(b: Pick<FailBeat | SuccessBeat, "params">, key: string): string | null {
  const v = b.params?.[key];
  return typeof v === "string" ? v : null;
}

/** The first beat whose anchor and action match (for skins that key effects off a single beat). */
export function findBeat<B extends { anchor: string; action: string }>(beats: readonly B[], action: string, anchorPrefix?: string): B | null {
  return beats.find((b) => b.action === action && (anchorPrefix === undefined || b.anchor.startsWith(anchorPrefix))) ?? null;
}

/** A step_bridge failure plan routed to deck bays (walking_road slabs, timeline_bridge deck sections). */
export interface DeckFailRoute {
  locks: { bay: number; atMs: number }[]; // the correct prefix locks (gold seam)
  tip: { bay: number; atMs: number; deg: number } | null; // the first wrong bay tips…
  sink: { bay: number; atMs: number } | null; // …and sinks back under
  scatter: { bay: number; atMs: number; mode: string } | null; // a decoy dissolves (flat_road) or shortens (arch)
  dims: { bay: number; atMs: number }[];
  wobble: { bay: number; atMs: number } | null;
}
export function routeDeckFail(beats: readonly FailBeat[], prefix = "bay_"): DeckFailRoute {
  const out: DeckFailRoute = { locks: [], tip: null, sink: null, scatter: null, dims: [], wobble: null };
  for (const b of beats) {
    const bay = anchorIndex(b.anchor, prefix);
    if (bay === null) continue;
    if (b.action === "hold_bright") out.locks.push({ bay, atMs: b.atMs });
    else if (b.action === "tip" && !out.tip) out.tip = { bay, atMs: b.atMs, deg: numParam(b, "deg", 12) };
    else if (b.action === "sink" && strParam(b, "mode") !== null && !out.scatter) out.scatter = { bay, atMs: b.atMs, mode: strParam(b, "mode")! };
    else if (b.action === "sink" && !out.sink) out.sink = { bay, atMs: b.atMs };
    else if (b.action === "scatter" && !out.scatter) out.scatter = { bay, atMs: b.atMs, mode: strParam(b, "mode") ?? "dissolve" };
    else if (b.action === "dim") out.dims.push({ bay, atMs: b.atMs });
    else if (b.action === "wobble" && !out.wobble) out.wobble = { bay, atMs: b.atMs };
  }
  return out;
}

/** A step_bridge success plan routed to deck bays and the civil extras (DAY counter run, route sign, arch lamps). */
export interface DeckSuccessRoute {
  locks: { bay: number; atMs: number }[];
  day: { atMs: number; ms: number; to: number } | null;
  sign: number | null;
  arch: number | null;
  payoff: number | null;
}
export function routeDeckSuccess(beats: readonly SuccessBeat[], prefix = "bay_"): DeckSuccessRoute {
  const out: DeckSuccessRoute = { locks: [], day: null, sign: null, arch: null, payoff: null };
  for (const b of beats) {
    const bay = anchorIndex(b.anchor, prefix);
    if (b.action === "lock" && bay !== null) out.locks.push({ bay, atMs: b.atMs });
    else if (b.anchor === "day_counter" && b.action === "light_sequence") out.day = { atMs: b.atMs, ms: numParam(b, "ms", 1500), to: numParam(b, "to", 0) };
    else if (b.anchor === "route_sign" && b.action === "ignite") out.sign = b.atMs;
    else if (b.anchor === "arch_rail" && b.action === "light_sequence") out.arch = b.atMs;
    else if (b.action === "rise" || b.action === "ride") out.payoff = b.atMs;
  }
  return out;
}

/** A router_lanes failure plan routed to the civil drawers: only `wrongKeys[0]`'s item and the disclosed shutter act. */
export interface DrawersFailRoute {
  bounce: { key: string; atMs: number } | null;
  shutter: { lane: number; atMs: number } | null;
  console: number | null;
}
export function routeDrawersFail(beats: readonly FailBeat[]): DrawersFailRoute {
  const out: DrawersFailRoute = { bounce: null, shutter: null, console: null };
  for (const b of beats) {
    if (b.anchor.startsWith("item_") && !out.bounce) out.bounce = { key: b.anchor.slice(5), atMs: b.atMs };
    else if (anchorIndex(b.anchor, "shutter_") !== null && !out.shutter) out.shutter = { lane: anchorIndex(b.anchor, "shutter_")!, atMs: b.atMs };
    else if (b.anchor === "console") out.console ??= b.atMs;
  }
  return out;
}
/** A router_lanes success plan routed to the civil drawers: items slide in, drawers slam, shutters open, the payoff. */
export interface DrawersSuccessRoute {
  files: { key: string; atMs: number }[];
  slams: { lane: number; atMs: number }[];
  shutters: { lane: number; atMs: number }[];
  payoff: number | null;
}
export function routeDrawersSuccess(beats: readonly SuccessBeat[]): DrawersSuccessRoute {
  const out: DrawersSuccessRoute = { files: [], slams: [], shutters: [], payoff: null };
  for (const b of beats) {
    if (b.anchor.startsWith("item_")) out.files.push({ key: b.anchor.slice(5), atMs: b.atMs });
    else if (anchorIndex(b.anchor, "lane_") !== null && b.action === "lock") out.slams.push({ lane: anchorIndex(b.anchor, "lane_")!, atMs: b.atMs });
    else if (anchorIndex(b.anchor, "shutter_") !== null) out.shutters.push({ lane: anchorIndex(b.anchor, "shutter_")!, atMs: b.atMs });
    else if (b.anchor === "payoff") out.payoff ??= b.atMs;
  }
  return out;
}

/** A polyline offset by `d` along its normals (y down; positive d = below a left-to-right line). */
export function offsetPolyline(points: readonly XY[], d: number): XY[] {
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)]!;
    const b = points[Math.min(points.length - 1, i + 1)]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x - (dy / len) * d, y: p.y + (dx / len) * d };
  });
}

// ================================================================ beat clock (Phaser timers)

export interface BeatClock {
  /** runs fn after ms (immediately when ms ≤ 0 or under reduced motion) */
  later(ms: number, fn: () => void): void;
  wait(ms: number): Promise<void>;
  clear(): void;
}
export function beatClock(scene: Phaser.Scene, reducedMotion: boolean, alive: () => boolean): BeatClock {
  const timers: Phaser.Time.TimerEvent[] = [];
  const later = (ms: number, fn: () => void) => {
    if (ms <= 0 || reducedMotion) {
      fn();
      return;
    }
    timers.push(scene.time.delayedCall(ms, () => alive() && fn()));
  };
  return {
    later,
    wait: (ms: number) => new Promise<void>((resolve) => later(ms, resolve)),
    clear() {
      for (const t of timers) t.remove(false);
      timers.length = 0;
    },
  };
}

// ================================================================ scene helpers

/** Phaser.BlendModes.ADD (the runtime Phaser module is not imported here: the kit stays loadable in node tests). */
export const BLEND_ADD = 1;

type HeightFn = (x: number, surface?: string) => number | null;
type Pts = readonly (readonly [number, number])[];
/** y on an x-ascending polyline (clamped to its ends); null when empty. */
function polyY(points: Pts, x: number): number | null {
  if (points.length === 0) return null;
  if (x <= points[0]![0]) return points[0]![1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]!;
    const [x1, y1] = points[i]!;
    if (x <= x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1]![1];
}
/**
 * Container-local AUTHORED ground y at container-local x (the prefab root sits at station.anchor): the zone's ground
 * as drawn before any payoff terrain merges, so a part never jumps when a stairwell or a road merges under it.
 * Sources, in order: `props.heightAt` (TODO(w1): the PrefabProps.heightAt outside diff), the ExpeditionScene's authored
 * zone ground (duck-typed) for the "ground" surface, the scene's `groundAt` for other surfaces, the console's ground.
 * Memoised per (x, surface): the first answer wins.
 */
export function localGround(scene: unknown, props: { station: { anchor: XY }; groundY: number }): (x: number, surface?: string) => number {
  const anchor = props.station.anchor;
  const fromProps = (props as { heightAt?: HeightFn }).heightAt;
  const sc = scene as { groundAt?: (x: number, surface?: string) => number; zone?: { ground?: { points?: Pts } } } | null;
  const cache = new Map<string, number>();
  return (x: number, surface?: string) => {
    const key = `${Math.round(x)}|${surface ?? "ground"}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const zx = x + anchor.x;
    let y: number | null = null;
    try {
      if (fromProps) y = fromProps(zx, surface);
      else if ((surface ?? "ground") === "ground" && sc?.zone?.ground?.points) y = polyY(sc.zone.ground.points, zx);
      else if (sc?.groundAt) y = sc.groundAt.call(scene, zx, surface);
    } catch {
      y = null;
    }
    const out = (typeof y === "number" && Number.isFinite(y) ? y : props.groundY) - anchor.y;
    cache.set(key, out);
    return out;
  };
}

// ================================================================ drawing primitives (stand-ins for §4.3 parts)

type G = Phaser.GameObjects.Graphics;

export function fillPoly(g: G, pts: readonly XY[]): void {
  if (pts.length < 3) return;
  g.beginPath();
  g.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]!.x, pts[i]!.y);
  g.closePath();
  g.fillPath();
}
export function strokePoly(g: G, pts: readonly XY[], closed = false): void {
  if (pts.length < 2) return;
  g.beginPath();
  g.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]!.x, pts[i]!.y);
  if (closed) g.closePath();
  g.strokePath();
}
/** A rectangle rotated by `rot` about its centre (cx, cy). */
export function rotRect(cx: number, cy: number, w: number, h: number, rot: number): XY[] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => ({ x: cx + x! * c - y! * s, y: cy + x! * s + y! * c }));
}

/** The soft contact shadow (bible §5.3: coloured, never black). */
export function drawShadow(g: G, x: number, y: number, w: number, c: CivilColors, alpha = 0.28): void {
  g.fillStyle(c.shadow, alpha);
  g.fillEllipse(x + w * 0.12, y + 2, w, Math.max(8, w * 0.12));
}

/** Rivets along a segment. */
export function drawRivets(g: G, a: XY, b: XY, spacing: number, r: number, color: number, alpha = 1): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.floor(len / spacing));
  g.fillStyle(color, alpha);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    g.fillCircle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r);
  }
}

/** A brass plate with a lit top edge and a deep bottom edge (kit `plate`). */
export function drawBrassPlate(g: G, x: number, y: number, w: number, h: number, c: CivilColors, radius = 8): void {
  g.fillStyle(c.brassDeep, 1);
  g.fillRoundedRect(x, y, w, h, radius);
  g.fillStyle(c.brass, 1);
  g.fillRoundedRect(x + 3, y + 3, w - 6, h - 8, Math.max(2, radius - 2));
  g.fillStyle(c.brassHi, 0.9);
  g.fillRect(x + radius, y + 4, w - 2 * radius, 3);
}

/** A wooden cabinet body (kit `shelving`): oak with a lit left edge. */
export function drawWoodBody(g: G, x: number, y: number, w: number, h: number, c: CivilColors): void {
  g.fillStyle(mix(c.bronze, c.ink, 0.35), 1);
  g.fillRoundedRect(x, y, w, h, 6);
  g.fillStyle(c.bronze, 1);
  g.fillRoundedRect(x + 5, y + 5, w - 10, h - 10, 4);
  g.fillStyle(mix(c.bronze, c.brassHi, 0.35), 0.8);
  g.fillRect(x + 6, y + 6, 6, h - 12);
}

/** Paper (a slip, a page, a card): paper fill, a thin ink edge and `lines` ink bars (words are DOM, bible §5.3). */
export function drawPaper(
  g: G,
  cx: number,
  cy: number,
  w: number,
  h: number,
  c: CivilColors,
  opts: { rot?: number; fill?: number; lines?: number; alpha?: number; typed?: number } = {},
): void {
  const rot = opts.rot ?? 0;
  const alpha = opts.alpha ?? 1;
  const fill = opts.fill ?? c.paper;
  g.fillStyle(c.ink, 0.35 * alpha);
  fillPoly(g, rotRect(cx + 3, cy + 4, w, h, rot));
  g.fillStyle(fill, alpha);
  fillPoly(g, rotRect(cx, cy, w, h, rot));
  const lines = opts.lines ?? 0;
  if (lines <= 0) return;
  const typed = clamp01(opts.typed ?? 1);
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const at = (dx: number, dy: number): XY => ({ x: cx + dx * cs - dy * sn, y: cy + dx * sn + dy * cs });
  g.lineStyle(Math.max(2, h / (lines * 3.2)), c.ink, 0.7 * alpha);
  for (let i = 0; i < lines; i++) {
    const fy = -h / 2 + (h * (i + 1)) / (lines + 1);
    const full = w * (i === lines - 1 ? 0.55 : 0.8);
    const shown = clamp01(typed * lines - i) * full;
    if (shown <= 0.5) continue;
    const a = at(-w * 0.4, fy);
    const b = at(-w * 0.4 + shown, fy);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.strokePath();
  }
}

/** A rubber stamp mark (RETRACTED / NOT WHAT HAPPENED / a made-year): a rotated inked frame with two ink bars. */
export function drawStamp(g: G, cx: number, cy: number, w: number, h: number, rotDeg: number, color: number, alpha: number): void {
  if (alpha <= 0.01) return;
  const rot = (rotDeg * Math.PI) / 180;
  g.lineStyle(Math.max(3, h * 0.12), color, alpha);
  strokePoly(g, rotRect(cx, cy, w, h, rot), true);
  g.fillStyle(color, 0.85 * alpha);
  fillPoly(g, rotRect(cx, cy - h * 0.12, w * 0.72, h * 0.16, rot));
  fillPoly(g, rotRect(cx, cy + h * 0.16, w * 0.5, h * 0.12, rot));
}

/** A lamp globe on its fitting: `on` 0…1 lights it in `color` with a halo (glow = live, bible §5.3). */
export function drawLampGlobe(g: G, x: number, y: number, r: number, on: number, c: CivilColors, color = c.lamp): void {
  const k = clamp01(on);
  if (k > 0.01) {
    g.fillStyle(color, 0.18 * k);
    g.fillCircle(x, y, r * 3.2);
    g.fillStyle(color, 0.3 * k);
    g.fillCircle(x, y, r * 1.9);
  }
  g.fillStyle(c.brassDeep, 1);
  g.fillRect(x - r * 0.55, y - r * 1.25, r * 1.1, r * 0.5);
  g.fillStyle(mix(c.lensDormant, color, k), 1);
  g.fillCircle(x, y, r);
  g.fillStyle(0xffffff, 0.35 + 0.5 * k);
  g.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.35);
}

/** A beam: three stacked lines (outer 18, inner 6, core 2; bible §6.2) in `color`; draw into an ADD-blend Graphics. */
export function drawBeam(g: G, from: XY, to: XY, color: number, alpha: number, scale = 1): void {
  if (alpha <= 0.01) return;
  const seg = (w: number, col: number, a: number) => {
    g.lineStyle(w * scale, col, a * alpha);
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(to.x, to.y);
    g.strokePath();
  };
  seg(18, color, 0.18);
  seg(6, color, 0.7);
  seg(2, 0xffffff, 1);
  g.fillStyle(color, 0.35 * alpha);
  g.fillCircle(to.x, to.y, 16 * scale);
}

/** A soft light cone from a small source to a wide target (projector light, lamp pools); ADD-blend Graphics. */
export function drawCone(g: G, from: XY, to: XY, nearHalf: number, farHalf: number, color: number, alpha: number): void {
  if (alpha <= 0.01) return;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (const [f, a] of [
    [1, 0.35],
    [0.62, 0.6],
    [0.3, 1],
  ] as const) {
    g.fillStyle(color, alpha * a * 0.45);
    fillPoly(g, [
      { x: from.x + nx * nearHalf * f, y: from.y + ny * nearHalf * f },
      { x: to.x + nx * farHalf * f, y: to.y + ny * farHalf * f },
      { x: to.x - nx * farHalf * f, y: to.y - ny * farHalf * f },
      { x: from.x - nx * nearHalf * f, y: from.y - ny * nearHalf * f },
    ]);
  }
}

/**
 * The civil console (`archive_of_voices.prop.console_reader`, 0.7 H): a microfilm reader on a brass-and-oak pedestal
 * with a hooded screen that glows cyan while the station is live. `lit` 0…1. Returns the screen centre.
 */
export function drawConsoleReader(g: G, at: XY, c: CivilColors, lit: number): XY {
  const h = 128;
  drawShadow(g, at.x, at.y, 110, c);
  g.fillStyle(c.brassDeep, 1);
  g.fillRoundedRect(at.x - 34, at.y - 12, 68, 12, 4);
  g.fillStyle(mix(c.bronze, c.ink, 0.3), 1);
  g.fillRect(at.x - 14, at.y - h + 44, 28, h - 56);
  g.fillStyle(c.bronze, 1);
  g.fillRect(at.x - 14, at.y - h + 44, 12, h - 56);
  // the reader body and hood
  const top = at.y - h;
  g.fillStyle(mix(c.bronze, c.ink, 0.45), 1);
  g.fillRoundedRect(at.x - 50, top + 2, 100, 48, 8);
  g.fillStyle(c.brass, 1);
  g.fillRoundedRect(at.x - 46, top + 6, 92, 40, 6);
  const screen = mix(0x0f2a33, 0x3b7682, lit);
  g.fillStyle(screen, 1);
  g.fillRoundedRect(at.x - 38, top + 11, 76, 30, 4);
  if (lit > 0.01) {
    g.fillStyle(c.cyan, 0.5 * lit);
    g.fillRect(at.x - 34, top + 16, 50, 3);
    g.fillRect(at.x - 34, top + 24, 62, 3);
    g.fillRect(at.x - 34, top + 32, 40, 3);
    g.fillStyle(c.cyan, 0.16 * lit);
    g.fillEllipse(at.x, top + 26, 150, 70);
  }
  // the film reel knobs
  for (const dx of [-54, 54]) {
    g.fillStyle(c.brassDeep, 1);
    g.fillCircle(at.x + dx, top + 26, 10);
    g.fillStyle(c.brassHi, 1);
    g.fillCircle(at.x + dx, top + 26, 4);
  }
  return { x: at.x, y: top + 26 };
}

/** A lamp post (kit `column` lamp_post): a slim brass post with a globe on top; returns the globe centre. */
export function drawLampPost(g: G, base: XY, height: number, on: number, c: CivilColors, color = c.lamp): XY {
  g.fillStyle(c.navyDark, 1);
  g.fillRect(base.x - 4, base.y - height, 8, height);
  g.fillStyle(c.brassDeep, 1);
  g.fillRoundedRect(base.x - 10, base.y - 10, 20, 10, 3);
  g.fillRect(base.x - 7, base.y - height + 4, 14, 6);
  const globe = { x: base.x, y: base.y - height - 10 };
  drawLampGlobe(g, globe.x, globe.y, 10, on, c, color);
  return globe;
}
