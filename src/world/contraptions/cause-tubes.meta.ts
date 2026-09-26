/**
 * cause_tubes — linker.chain (docs/design/20 §4 row 11, §4.2, §4.4, §7.4; civil §5.5 e5, §5.6 e6, §5.11 e11). Wires or
 * tubes grow between housings placed by DISPLAY index (never causal order); a completion gauge; receiving dishes turn
 * to face their source. After Verify a current or a capsule runs the chain in causal order. KC2: the full pure half.
 *
 * ## The pose contract (skins read these fields; zone units relative to station.anchor, x right, y DOWN)
 * - `housings[]` in VIEW display order: `x`/`y` from `housingPositions(layout, count, boardWidth)` (the display index
 *   alone decides the place, so the place reveals nothing), `port` (where wires attach), `hasOut`/`hasIn`, `lamp`
 *   (`off` · `ready` = amber, "a wire leaves this box", NOT correctness · `lit` = cyan, solved only), `dishRad` (the
 *   receiving dish faces its latest source: `atan2(src.y − dst.y, src.x − dst.x)`; rest = outward), `lidDeg` (big_board:
 *   30° open with an outgoing tube), `focus` (the control's focused node).
 * - `wires[]` in draft order: `a`/`b` the ports, `sag` (catenary: `0.12·|Δx| + 24` down; vertical_wire:
 *   `0.08·|Δy| + 16` sideways, `bowDir` away from the mast), `route` (tube: Manhattan corners with ≤ 2 bends, `first`
 *   and `mid` so `_cables.manhattanPath(a, b, {first, mid})` draws the same route), `points` (the reference polyline).
 * - `edges`, `edgeCount`, `gauge = min(1, edges / edgeCount)` (completion only), `run` (the carrier's progress, 1 only
 *   once solved), `gate` (0 closed → 1 open, solved only), `lensU` (the record_lens carriage), `solved`.
 *
 * ## Dynamic anchors every cause_tubes PoseView exposes (besides skin.anchors)
 * `node_<key>` (the housing of that node key), `gauge` (relay_line: the wall gauge; broadcast_relay: the lift;
 * big_board: the launcher) and `payoff` (what the success plan moves: the gate, the lift, the launcher). describe()
 * and the plans use only these, because pose/describe/plans do not know the skin (PoseInput carries no skinId).
 *
 * Live-reveal rule (§2.5.6): discrete mode, so the world shows what each wire DOES (a wire, a lamp that is ready, a
 * dish that listens) and nothing about whether it is right until Verify; metas see the view only.
 */
import { z } from "zod";
import { asTuple } from "../../contracts/slices";
import type { HintTarget, PayoffAnim, ProbeSpec } from "../../contracts/world";
import { clamp01, lerp, lerpAngle } from "../ease";
import { fileCard, fileChip, lensU, probeWindowOf, yearReadout, type TimelineCard, type TimelinePin } from "../record-strip";
import type {
  AudioParam,
  Bounds,
  CardModel,
  ChainView,
  ChipSpec,
  ConfigCtx,
  ConfigIssue,
  ContraptionMeta,
  Described,
  Diagnosis,
  FailBeat,
  FailurePlan,
  Footprint2D,
  HintRung,
  PanelLive,
  PanelStatic,
  PoseInput,
  StaticInput,
  SuccessBeat,
  SuccessPlan,
  WriterCtx,
} from "../types";
import {
  dateAppearsIn,
  err,
  findDates,
  fracYearOf,
  nodeKeysOf,
  probeRangeIssues,
  subsetOf,
  viewTextOf,
  yearProbeFor,
} from "./config-parts";
import { defineSkin } from "./skin-kit";
import { probeFromWriter, wDate, wProbe, type WriterProbe } from "./writer-kit";
import { CauseTubesConfig } from "./cause-tubes.config";
export { CauseTubesConfig } from "./cause-tubes.config";

const hint = (anchor: string, action: HintTarget["action"], holdMs: number): HintTarget => ({ anchor, action, holdMs });

export const CAUSE_TUBES_SKINS = [
  defineSkin({
    id: "relay_line",
    name: "Relay Line",
    ns: "archive_of_voices",
    nouns: ["relay", "circuit", "junction boxes", "boxes", "wires", "line", "board"],
    parts: [["junction_box", "K"], ["departures_board", "K"], ["divider_rail", "K"], ["rolling_gate", "K"], ["console", "K"]],
    anchors: ["box_0…5", "board", "gate", "gauge", "console"],
    cues: { live: "current_hum", succeed: "beacon_ignite", fail: "fuse_pop" },
    sensitiveSafe: true,
    // civil §5.5: rung 1 circles the departures board, rung 2 lands on the charge gauge, rung 3 hovers at the gate
    hintTargets: [[hint("board", "circle", 1800)], [hint("gauge", "land", 2000)], [hint("gate", "hover", 1500)]],
  }),
  defineSkin({
    id: "broadcast_relay",
    name: "Broadcast Relay",
    ns: "archive_of_voices",
    nouns: ["mast", "relay", "circuit", "dishes", "stations", "broadcast"],
    parts: [["mast", "K"], ["relay_dish", "H"], ["lift_cage", "K"], ["console", "K"]],
    anchors: ["station_0…5", "lift", "top", "console"],
    cues: { live: "current_hum", succeed: "beacon_ignite", fail: "fuse_pop" },
    sensitiveSafe: true,
    // civil §5.6: rung 1 circles the stations bottom to top, rung 2 lands on the lift cage, rung 3 hovers at the top
    hintTargets: [
      [0, 1, 2, 3, 4, 5].map((i) => hint(`station_${i}`, "circle", 600)),
      [hint("lift", "land", 2000)],
      [hint("top", "hover", 1500)],
    ],
  }),
  defineSkin({
    id: "big_board",
    name: "Big Board",
    ns: "archive_of_voices",
    nouns: ["board", "Big Board", "tubes", "canisters", "capsule", "launcher"],
    parts: [["board_wall", "K"], ["canister", "H"], ["launcher", "K"], ["console", "K"]],
    anchors: ["canister_0…6", "launcher", "console"],
    cues: { live: null, succeed: "tube_whoosh", fail: "fuse_pop" },
    sensitiveSafe: true,
    // civil §5.11: rung 1 circles the canisters in display order, rung 2 lands on the launcher, rung 3 hovers the console
    hintTargets: [
      [0, 1, 2, 3, 4, 5, 6].map((i) => hint(`canister_${i}`, "circle", 500)),
      [hint("launcher", "land", 2000)],
      [hint("console", "hover", 1500)],
    ],
  }),
] as const;

const BIOME_TUBES: Readonly<Record<string, Pick<CauseTubesConfig, "connector" | "layout" | "carrier">>> = {
  archive_of_voices: { connector: "catenary", layout: "canopy_row", carrier: "current" },
  living_gate: { connector: "tube", layout: "ring", carrier: "capsule" },
  orrery_terraces: { connector: "tube", layout: "ring", carrier: "current" },
};
function tubesFor(biome: string) {
  return BIOME_TUBES[biome] ?? BIOME_TUBES.orrery_terraces;
}

interface CauseTubesWriter {
  nodes: { key: string; printedDate: string | null }[];
  probe: WriterProbe | null;
}

// ---------------------------------------------------------------- live constants (civil §5.5, §5.6, §5.11)

export interface XY {
  x: number;
  y: number;
}
/** Catenary wires (relay_line): `sag = 0.12·|B.x − A.x| + 24`, drawn `p(t) = lerp(A, B, t) + (0, sag·4t(1 − t))`. */
export const CATENARY_SAG_K = 0.12;
export const CATENARY_SAG_MIN = 24;
/** Vertical mast wires (broadcast_relay): the sag is lateral, `sag_x = 0.08·|B.y − A.y| + 16`. */
export const VERTICAL_SAG_K = 0.08;
export const VERTICAL_SAG_MIN = 16;
/** Cosmetic, prefab-side: a freshly drawn wire overshoots its sag by 15 % then springs back. */
export const WIRE_SETTLE_OVERSHOOT = 0.15;
/** Cosmetic, prefab-side: arrow ticks along a wire every 80 px, pointing from → to. */
export const ARROW_TICK_PX = 80;
/** Cosmetic, prefab-side: a new tube grows from its source at 900 px/s. */
export const TUBE_GROW_PX_S = 900;
/** The success current runs at 600 px/s. */
export const CURRENT_PX_S = 600;
/** big_board: a canister with an outgoing tube opens its glass lid 30° (ready, not correct). */
export const LID_OPEN_DEG = 30;
/** broadcast_relay failure: the `from` station's dish droops 20°. */
export const DISH_DROOP_DEG = 20;

/** Housing sizes (zone units) the skins draw; the ports sit at these offsets from the housing centre. */
export const HOUSING = {
  canopy_row: { w: 150, h: 190, portDy: 95 }, // junction boxes hang below the canopy rail; wires leave the bottom
  mast: { w: 120, h: 110, portDy: 0 }, // relay stations: the dish centre
  ring: { w: 120, h: 150, portDy: 0 }, // pneumatic canisters: the canister centre
} as const;
/** broadcast_relay: stations climb the mast 160 apart (civil e6: y 1680 … 1040 over an anchor at 1820). */
export const MAST_STEP = 160;
export const MAST_BASE_DY = -140;
export const MAST_X = 80;
/** The stray station on its own pole (civil e6's 6th station), used when a mast has ≥ 4 housings. */
export const STRAY_POLE: XY = { x: 380, y: -300 };
/** big_board: the 1100 × 520 wall, its canisters on an ellipse, the launcher at the lower left. */
export const BOARD_HEIGHT = 520;
export const RING_CENTER_DY = -270;
export const RING_RY = 170;

export type Connector = CauseTubesConfig["connector"];
export type TubeLayout = CauseTubesConfig["layout"];

/**
 * Where each housing sits, by DISPLAY index (the view's shuffled order), container-local. Never reads keys, so a
 * housing's place says nothing about its causal position. Every x lies within ±boardWidth/2.
 */
export function housingPositions(layout: TubeLayout, count: number, boardWidth: number): XY[] {
  const n = Math.max(0, Math.floor(count));
  const W = Math.min(1100, Math.max(600, boardWidth));
  if (n === 0) return [];
  if (layout === "canopy_row") {
    const half = W / 2 - HOUSING.canopy_row.w / 2;
    return Array.from({ length: n }, (_, i) => ({ x: n === 1 ? 0 : -half + (2 * half * i) / (n - 1), y: HOUSING.canopy_row.h / 2 }));
  }
  if (layout === "mast") {
    const onMast = n >= 4 ? n - 1 : n;
    const step = onMast > 1 ? Math.min(MAST_STEP, 900 / (onMast - 1)) : MAST_STEP;
    const out: XY[] = Array.from({ length: onMast }, (_, i) => ({ x: i % 2 === 0 ? -MAST_X : MAST_X, y: MAST_BASE_DY - step * i }));
    if (onMast < n) out.push({ x: Math.min(STRAY_POLE.x, W / 2 - HOUSING.mast.w / 2), y: STRAY_POLE.y });
    return out;
  }
  const rx = Math.min(W / 2 - 120, 420);
  return Array.from({ length: n }, (_, i) => {
    const th = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { x: rx * Math.cos(th), y: RING_CENTER_DY + RING_RY * Math.sin(th) };
  });
}

export function portOf(layout: TubeLayout, housing: XY): XY {
  return { x: housing.x, y: housing.y + HOUSING[layout].portDy };
}

/** Catenary sag (relay_line wires): 0.12·|B.x − A.x| + 24, downward. */
export function catenarySag(a: XY, b: XY): number {
  return CATENARY_SAG_K * Math.abs(b.x - a.x) + CATENARY_SAG_MIN;
}
/** Vertical sag (mast wires): 0.08·|B.y − A.y| + 16, sideways. */
export function verticalSag(a: XY, b: XY): number {
  return VERTICAL_SAG_K * Math.abs(b.y - a.y) + VERTICAL_SAG_MIN;
}
/** p(t) = lerp(A, B, t) + (0, sag·4t(1 − t)). */
export function catenaryPoint(a: XY, b: XY, t: number, sag = catenarySag(a, b)): XY {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) + sag * 4 * t * (1 - t) };
}
/** p(t) = lerp(A, B, t) + (dir·sag_x·4t(1 − t), 0). */
export function verticalPoint(a: XY, b: XY, t: number, dir: 1 | -1, sag = verticalSag(a, b)): XY {
  return { x: lerp(a.x, b.x, t) + dir * sag * 4 * t * (1 - t), y: lerp(a.y, b.y, t) };
}

export interface ManhattanRoute {
  first: "h" | "v";
  mid: number;
}
/** The tube route between two canisters: leave along the longer axis; the middle leg's place varies by source. */
export function manhattanRouteFor(a: XY, b: XY, fromIndex: number): ManhattanRoute {
  return { first: Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? "h" : "v", mid: 0.4 + 0.05 * (Math.abs(fromIndex) % 5) };
}
/** Manhattan corners from a to b (2–4 points, ≤ 2 bends); mirrors `_cables.manhattanPath(a, b, {first, mid})`. */
export function manhattanCorners(a: XY, b: XY, route: ManhattanRoute): XY[] {
  const eps = 1e-9;
  if (Math.abs(a.x - b.x) < eps || Math.abs(a.y - b.y) < eps) return [{ ...a }, { ...b }];
  const m = clamp01(route.mid);
  if (route.first === "h") {
    const mx = lerp(a.x, b.x, m);
    return [{ ...a }, { x: mx, y: a.y }, { x: mx, y: b.y }, { ...b }];
  }
  const my = lerp(a.y, b.y, m);
  return [{ ...a }, { x: a.x, y: my }, { x: b.x, y: my }, { ...b }];
}
/** Direction changes along a polyline (collinear points ignored). */
export function bendsOf(points: readonly XY[]): number {
  let bends = 0;
  let prev: XY | null = null;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const l = Math.hypot(dx, dy);
    if (l < 1e-9) continue;
    const u = { x: dx / l, y: dy / l };
    if (prev && Math.abs(prev.x * u.y - prev.y * u.x) > 1e-9) bends++;
    prev = u;
  }
  return bends;
}

/** The receiving dish's angle: it faces its source. */
export function dishAngle(src: XY, dst: XY): number {
  return Math.atan2(src.y - dst.y, src.x - dst.x);
}
/** Rest angle of a dish no wire reaches: facing outward from the mast. */
export function dishRest(dst: XY): number {
  return dst.x < 0 ? Math.PI : 0;
}
/** Completion only (never correctness): edges laid ÷ the view's edgeCount, clamped to [0, 1]. */
export function gaugeOf(edges: number, edgeCount: number): number {
  return edgeCount > 0 ? clamp01(edges / edgeCount) : 0;
}

/** The chain the edges spell, from its first node (an out-edge and no in-edge) forward; cycles and forks stop it. */
export function causalOrder(edges: readonly { fromKey: string; toKey: string }[]): string[] {
  if (edges.length === 0) return [];
  const next = new Map<string, string>();
  const incoming = new Set<string>();
  for (const e of edges) {
    if (!next.has(e.fromKey)) next.set(e.fromKey, e.toKey);
    incoming.add(e.toKey);
  }
  const start = edges.map((e) => e.fromKey).find((k) => !incoming.has(k)) ?? edges[0].fromKey;
  const out = [start];
  const seen = new Set(out);
  let cur = next.get(start);
  while (cur !== undefined && !seen.has(cur)) {
    out.push(cur);
    seen.add(cur);
    cur = next.get(cur);
  }
  return out;
}

// ---------------------------------------------------------------- pose

export type HousingLamp = "off" | "ready" | "lit";
export interface TubeHousing {
  key: string;
  index: number; // display index
  label: string; // meta.label ?? the node text
  x: number;
  y: number;
  port: XY;
  hasOut: boolean;
  hasIn: boolean;
  lamp: HousingLamp;
  dishRad: number;
  lidDeg: number;
  focus: boolean;
}
export interface TubeWire {
  fromKey: string;
  toKey: string;
  fromIndex: number;
  toIndex: number;
  a: XY;
  b: XY;
  connector: Connector;
  sag: number; // catenary: down; vertical_wire: sideways (× bowDir); tube: 0
  bowDir: 1 | -1;
  route: ManhattanRoute | null; // tube only
  points: XY[];
}
/** The archetype's pose (skins import this name). */
export interface CauseTubesPose {
  layout: TubeLayout;
  connector: Connector;
  carrier: CauseTubesConfig["carrier"];
  boardWidth: number;
  housings: TubeHousing[];
  wires: TubeWire[];
  edges: number;
  edgeCount: number;
  gauge: number;
  showGauge: boolean;
  focusKey: string | null;
  run: number;
  gate: number;
  lensU: number | null;
  solved: boolean;
}

interface Edge {
  fromKey: string;
  toKey: string;
}
function nodesOf(view: unknown): readonly ChainView["nodes"][number][] {
  const v = view as Partial<ChainView> | null;
  return Array.isArray(v?.nodes) ? v.nodes.filter((n) => typeof n?.key === "string") : [];
}
function edgeCountOf(view: unknown): number {
  const v = view as Partial<ChainView> | null;
  return typeof v?.edgeCount === "number" ? v.edgeCount : 0;
}
/** The draft's edges between known nodes, de-duplicated, no self-loops, in draft order. */
export function draftEdges(draft: PoseInput<CauseTubesConfig>["draft"], view: unknown): Edge[] {
  const known = new Set(nodesOf(view).map((n) => n.key));
  const raw = (draft?.input as { edges?: unknown } | null | undefined)?.edges;
  if (!Array.isArray(raw)) return [];
  const out: Edge[] = [];
  const seen = new Set<string>();
  for (const e of raw as unknown[]) {
    const r = e as { fromKey?: unknown; toKey?: unknown } | null;
    const f = typeof r?.fromKey === "string" ? r.fromKey : null;
    const t = typeof r?.toKey === "string" ? r.toKey : null;
    if (f === null || t === null || f === t || !known.has(f) || !known.has(t)) continue;
    const id = `${f}>${t}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ fromKey: f, toKey: t });
  }
  return out;
}

function labelOf(config: CauseTubesConfig, key: string, text: string): string {
  return config.nodes.find((n) => n.key === key)?.meta.label ?? text;
}

/** The reference polyline of one wire (n + 1 points for hanging wires; the corners for tubes). */
export function wirePoints(w: Pick<TubeWire, "a" | "b" | "connector" | "sag" | "bowDir" | "route">, n = 16): XY[] {
  if (w.connector === "tube") return manhattanCorners(w.a, w.b, w.route ?? { first: "h", mid: 0.5 });
  const k = Math.max(1, Math.floor(n));
  return Array.from({ length: k + 1 }, (_, i) =>
    w.connector === "catenary" ? catenaryPoint(w.a, w.b, i / k, w.sag) : verticalPoint(w.a, w.b, i / k, w.bowDir, w.sag),
  );
}

function poseOf(input: PoseInput<CauseTubesConfig>): CauseTubesPose {
  const { config, view } = input;
  const nodes = nodesOf(view);
  const pos = housingPositions(config.layout, nodes.length, config.boardWidth);
  const indexOf = new Map(nodes.map((n, i) => [n.key, i]));
  const edges = draftEdges(input.draft, view);
  const focusKey = typeof input.draft?.focus === "string" && indexOf.has(input.draft.focus) ? input.draft.focus : null;

  const wires: TubeWire[] = edges.map((e) => {
    const fi = indexOf.get(e.fromKey)!;
    const ti = indexOf.get(e.toKey)!;
    const a = portOf(config.layout, pos[fi]);
    const b = portOf(config.layout, pos[ti]);
    const bowDir: 1 | -1 = (a.x + b.x) / 2 < 0 ? -1 : 1;
    const sag = config.connector === "catenary" ? catenarySag(a, b) : config.connector === "vertical_wire" ? verticalSag(a, b) : 0;
    const route = config.connector === "tube" ? manhattanRouteFor(a, b, fi) : null;
    const w = { fromKey: e.fromKey, toKey: e.toKey, fromIndex: fi, toIndex: ti, a, b, connector: config.connector, sag, bowDir, route };
    return { ...w, points: wirePoints(w) };
  });

  const out = new Set(edges.map((e) => e.fromKey));
  const lastSource = new Map<string, string>();
  for (const e of edges) lastSource.set(e.toKey, e.fromKey);
  const housings: TubeHousing[] = nodes.map((n, i) => {
    const src = lastSource.get(n.key);
    const here = pos[i];
    return {
      key: n.key,
      index: i,
      label: labelOf(config, n.key, n.text),
      x: here.x,
      y: here.y,
      port: portOf(config.layout, here),
      hasOut: out.has(n.key),
      hasIn: src !== undefined,
      lamp: input.solved ? "lit" : out.has(n.key) ? "ready" : "off",
      dishRad: src !== undefined ? dishAngle(pos[indexOf.get(src)!], here) : dishRest(here),
      lidDeg: input.solved || out.has(n.key) ? LID_OPEN_DEG : 0,
      focus: n.key === focusKey,
    };
  });
  const edgeCount = edgeCountOf(view);
  const window = probeWindowOf(config.probe);
  return {
    layout: config.layout,
    connector: config.connector,
    carrier: config.carrier,
    boardWidth: config.boardWidth,
    housings,
    wires,
    edges: edges.length,
    edgeCount,
    gauge: input.solved ? 1 : gaugeOf(edges.length, edgeCount),
    showGauge: config.gauge,
    focusKey,
    run: input.solved ? 1 : 0,
    gate: input.solved ? 1 : 0,
    lensU: window && input.probe !== null ? lensU(window, input.probe) : null,
    solved: input.solved,
  };
}

/**
 * Continuous fields ease (gauge, dish angles, lids, run, gate, the lens); discrete fields (wires, lamps, focus) take
 * the target as soon as t > 0: the controller eases with t ≈ 0.14 per frame, so a snap at t ≥ 0.5 would never land.
 */
function lerpPose(from: CauseTubesPose, to: CauseTubesPose, t: number): CauseTubesPose {
  const k = clamp01(t);
  if (k <= 0) return from;
  const prev = new Map(from.housings.map((h) => [h.key, h]));
  return {
    ...to,
    housings: to.housings.map((h) => {
      const p = prev.get(h.key);
      return p ? { ...h, dishRad: lerpAngle(p.dishRad, h.dishRad, k), lidDeg: lerp(p.lidDeg, h.lidDeg, k) } : h;
    }),
    gauge: lerp(from.gauge, to.gauge, k),
    run: lerp(from.run, to.run, k),
    gate: lerp(from.gate, to.gate, k),
    lensU: from.lensU !== null && to.lensU !== null ? lerp(from.lensU, to.lensU, k) : to.lensU,
  };
}

// ---------------------------------------------------------------- describe

function noun(connector: Connector, n: number): string {
  const base = connector === "tube" ? "TUBE" : "WIRE";
  return n === 1 ? base : `${base}S`;
}
export function counterText(pose: Pick<CauseTubesPose, "edges" | "edgeCount" | "connector">): string {
  return `${pose.edges} / ${pose.edgeCount} ${noun(pose.connector, pose.edgeCount)}`;
}

function describePose(pose: CauseTubesPose): Described {
  const chips: ChipSpec[] = pose.housings.map((h) => ({ anchor: `node_${h.key}`, text: h.label, color: "f" }));
  if (pose.showGauge) chips.push({ anchor: "gauge", text: counterText(pose), color: "accent" });
  const things = pose.connector === "tube" ? "tubes" : "wires";
  let srText: string;
  if (pose.solved) {
    srText =
      pose.carrier === "capsule"
        ? "The capsule has run the whole chain: every canister lamp is lit."
        : "The circuit is closed: the current has run the whole chain and every lamp is lit.";
  } else if (pose.edges === 0) {
    srText = `${pose.housings.length} ${pose.connector === "tube" ? "canisters" : "housings"} stand unconnected; no ${things} yet.`;
  } else {
    srText = `${pose.edges} of ${pose.edgeCount} ${things} laid; the gauge reads ${Math.round(pose.gauge * 100)} percent.`;
  }
  return { chips, pins: [], srText, nearMiss: null };
}

// ---------------------------------------------------------------- panel

const FILE_SLOT = 0;
function shortText(text: string, max = 28): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}
function hasFile(input: Pick<StaticInput<CauseTubesConfig>, "record" | "config">): boolean {
  return input.record || input.config.nodes.some((n) => n.meta.printedDate !== null);
}
function graphSlot(input: Pick<StaticInput<CauseTubesConfig>, "record" | "config">): number {
  return hasFile(input) ? 1 : 0;
}

function fileFor(config: CauseTubesConfig, view: unknown, edges: readonly Edge[], focusKey: string | null, touched: ReadonlySet<string>): TimelineCard {
  const pins: TimelinePin[] = [];
  for (const n of config.nodes) {
    const at = n.meta.printedDate ? fracYearOf(n.meta.printedDate) : null;
    if (at === null) continue;
    const label = n.meta.label ?? shortText(viewTextOf(view, n.key), 28);
    const style = n.key === focusKey ? "focus" : touched.has(n.key) ? "draft" : "dim";
    pins.push({ key: `node:${n.key}`, at, label, lane: null, style, spanTo: null });
  }
  const dated = new Set(pins.map((p) => p.key));
  const arrows = edges
    .map((e) => ({ fromKey: `node:${e.fromKey}`, toKey: `node:${e.toKey}` }))
    .filter((a) => dated.has(a.fromKey) && dated.has(a.toKey));
  const card = fileCard({ slot: FILE_SLOT, window: probeWindowOf(config.probe), marks: [{ pins: [], bands: [], arrows }], pins });
  return card;
}

/** Panel node positions mirror the world housings (normalised into [0.08, 0.92]); a single row staggers in two. */
export function panelNodePositions(layout: TubeLayout, count: number, boardWidth: number): XY[] {
  const pos = housingPositions(layout, count, boardWidth);
  if (pos.length === 0) return [];
  const xs = pos.map((p) => p.x);
  const ys = pos.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const nx = (x: number) => (x1 - x0 > 1e-6 ? 0.08 + (0.84 * (x - x0)) / (x1 - x0) : 0.5);
  const ny = (y: number) => (y1 - y0 > 1e-6 ? 0.1 + (0.8 * (y - y0)) / (y1 - y0) : 0.5);
  return pos.map((p, i) => ({ x: nx(p.x), y: layout === "canopy_row" ? (i % 2 === 0 ? 0.3 : 0.7) : ny(p.y) }));
}

function graphFor(input: Pick<PoseInput<CauseTubesConfig>, "config" | "view">, slot: number, edges: readonly Edge[], focusKey: string | null): Extract<CardModel, { kind: "cause_graph" }> {
  const nodes = nodesOf(input.view);
  const pos = panelNodePositions(input.config.layout, nodes.length, input.config.boardWidth);
  const n = edgeCountOf(input.view);
  const things = input.config.connector === "tube" ? "tubes" : "wires";
  return {
    kind: "cause_graph",
    slot,
    title: input.config.connector === "tube" ? "TUBES" : "CIRCUIT",
    nodes: nodes.map((node, i) => ({ key: node.key, label: labelOf(input.config, node.key, node.text), x: pos[i].x, y: pos[i].y })),
    edges: edges.map((e) => ({ ...e, state: e.fromKey === focusKey || e.toKey === focusKey ? "focus" : "draft" })),
    sr: `${nodes.length} events: ${nodes.map((node) => node.text).join("; ")}. ${edges.length} of ${n} ${things} laid.`,
  };
}

function panelStaticOf(input: StaticInput<CauseTubesConfig>): PanelStatic {
  const cards: CardModel[] = [];
  if (hasFile(input)) cards.push(fileFor(input.config, input.view, [], null, new Set()));
  cards.push(graphFor(input, graphSlot(input), [], null));
  return { cards, input: null, probe: input.config.probe, recordPins: [] };
}

function panelLiveOf(stat: PanelStatic, input: PoseInput<CauseTubesConfig>): PanelLive {
  const edges = draftEdges(input.draft, input.view);
  const focus = typeof input.draft?.focus === "string" ? input.draft.focus : null;
  const file = stat.cards.some((c) => c.slot === FILE_SLOT && c.kind === "timeline");
  const gslot = file ? 1 : 0;
  const touched = new Set(edges.flatMap((e) => [e.fromKey, e.toKey]));
  const liveCards: CardModel[] = [graphFor(input, gslot, edges, focus)];
  const n = edgeCountOf(input.view);
  const chips: PanelLive["chips"][number][] = [
    { slot: gslot, value: gaugeOf(edges.length, n), text: counterText({ edges: edges.length, edgeCount: n, connector: input.config.connector }), color: "accent" },
  ];
  if (file) {
    const card = fileFor(input.config, input.view, edges, focus, touched);
    liveCards.unshift(card);
    if (input.probe !== null) chips.unshift({ slot: FILE_SLOT, value: input.probe, text: fileChip(card, input.probe).text, color: "g" });
  }
  const highlights: PanelLive["highlights"][number][] = [];
  for (const k of new Set(edges.map((e) => e.fromKey))) highlights.push({ slot: gslot, key: k, state: k === focus ? "focus" : "placed" });
  if (focus !== null && !highlights.some((h) => h.key === focus)) highlights.push({ slot: gslot, key: focus, state: "focus" });
  return { scrubX: input.probe, readout: yearReadout(input.config.probe?.format ?? "number", input.probe), chips, highlights, liveCards };
}

// ---------------------------------------------------------------- outcomes

function anchorOfKey(view: unknown, key: string | undefined): string {
  return key !== undefined && nodesOf(view).some((n) => n.key === key) ? `node_${key}` : "console";
}

/**
 * The failure plan acts ONLY on `wrongKeys[0]` (§2.5.4): a decoy's fuse pops (the capsule pops out of its lid on
 * big_board); a wrong link's `from` housing sparks and its outgoing wire goes slack (big_board: the capsule jams and
 * the glass fogs; broadcast_relay: the dish droops 20°). Nothing flows on a miss.
 */
function failurePlanOf(d: Diagnosis, input: PoseInput<CauseTubesConfig>): FailurePlan {
  const key = d.wrongKeys[0];
  const anchor = anchorOfKey(input.view, key);
  const cue = "fuse_pop";
  const ring = input.config.layout === "ring";
  const beats: FailBeat[] = [];
  if (d.failKey === "decoy" && key !== undefined) {
    beats.push({ atMs: 0, anchor, action: "spark", params: { key, fx: "fuse_pop" } });
    beats.push({ atMs: 180, anchor, action: "eject", params: { key, what: ring ? "capsule" : "card" } });
    beats.push({ atMs: 500, anchor, action: "dim", params: { key, alpha: 0.5 } });
    return { beats, durationMs: 1200, cue };
  }
  if (d.failKey === "wrong_link" && key !== undefined) {
    if (ring) {
      beats.push({ atMs: 0, anchor, action: "jam", params: { key, fx: "puff" } });
      beats.push({ atMs: 250, anchor, action: "dim", params: { key, fog: 1 } });
    } else {
      beats.push({ atMs: 0, anchor, action: "spark", params: { key } });
      beats.push({ atMs: 120, anchor, action: "flash", params: { key, color: "amber", flicker: 3 } });
      beats.push({ atMs: 300, anchor, action: "sink", params: { key, wire: "out", slack: input.config.layout === "mast" ? 40 : 60 } });
      if (input.config.layout === "mast") beats.push({ atMs: 300, anchor, action: "tip", params: { key, deg: DISH_DROOP_DEG } });
    }
    return { beats, durationMs: 1300, cue };
  }
  // incomplete (Verify needs every edge, so rare): nothing flows
  beats.push({ atMs: 0, anchor: "gauge", action: "stall", params: {} });
  return { beats, durationMs: 800, cue };
}

/** The success plan (the solution draft): the carrier enters at the chain's first node and each lamp lights as it arrives. */
function successPlanOf(input: PoseInput<CauseTubesConfig>, anim: PayoffAnim): SuccessPlan {
  const edges = draftEdges(input.draft, input.view);
  const order = causalOrder(edges);
  const layout = input.config.layout;
  const total = layout === "canopy_row" ? 2400 : 2500;
  const runMs = Math.min(1600, Math.max(600, order.length * 280));
  const step = order.length > 1 ? runMs / (order.length - 1) : 0;
  const beats: SuccessBeat[] = [
    {
      atMs: 0,
      anchor: anchorOfKey(input.view, order[0]),
      action: input.config.carrier === "capsule" ? "ride" : "light_sequence",
      params: { path: order.join(","), carrier: input.config.carrier, color: "cyan", pxPerS: input.config.carrier === "capsule" ? TUBE_GROW_PX_S : CURRENT_PX_S, ms: runMs },
    },
  ];
  order.forEach((k, i) => beats.push({ atMs: Math.round(i * step), anchor: `node_${k}`, action: "ignite", params: { key: k, color: "cyan", order: i } }));
  const after = Math.round(runMs + 100);
  if (layout === "canopy_row") {
    beats.push({ atMs: after, anchor: "board", action: "print", params: { flip: order.join(",") } });
    beats.push({ atMs: after + 250, anchor: "rail", action: "rise", params: { what: "divider_rail" } });
    beats.push({ atMs: after + 450, anchor: "payoff", action: "open", params: { anim } });
  } else if (layout === "mast") {
    beats.push({ atMs: after, anchor: "top", action: "ignite", params: { beam: "record_light" } });
    beats.push({ atMs: after + 300, anchor: "payoff", action: "cycle", params: { anim, what: "lift_cage" } });
  } else {
    beats.push({ atMs: after, anchor: "payoff", action: "cycle", params: { anim, what: "launcher" } });
  }
  return { beats, cardEffects: [], durationMs: Math.min(2500, Math.max(total, after + 600)), cue: input.config.carrier === "capsule" ? "tube_whoosh" : "current_hum" };
}

function audioOf(pose: CauseTubesPose): readonly AudioParam[] {
  if (pose.connector === "tube" || pose.edges === 0 || pose.solved) return [];
  return [{ cue: "current_hum", gain: 0.08 + 0.17 * pose.gauge, pitch: 0.9 + 0.2 * pose.gauge }];
}

// ---------------------------------------------------------------- geometry

function footprintOf(config: CauseTubesConfig): Footprint2D {
  if (config.layout === "mast") return { left: 260, right: 520, height: 1000 };
  return { left: config.boardWidth / 2 + 80, right: config.boardWidth / 2 + 80, height: config.layout === "ring" ? BOARD_HEIGHT + 80 : 560 };
}
/** Relative to station.anchor. Width never exceeds the 1100-wide board plus its margins (amendment 32). */
export function frameBoundsOf(config: CauseTubesConfig): Bounds {
  const W = Math.min(1100, config.boardWidth);
  if (config.layout === "mast") return { x: -360, y: -1080, w: 1020, h: 1260 };
  if (config.layout === "ring") return { x: -W / 2 - 60, y: -BOARD_HEIGHT - 80, w: W + 120, h: BOARD_HEIGHT + 160 };
  return { x: -W / 2 - 80, y: -360, w: W + 160, h: 760 };
}

export const causeTubesMeta: ContraptionMeta<CauseTubesConfig, CauseTubesPose> = {
  id: "cause_tubes",
  name: "Cause Tubes",
  modes: ["linker.chain"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["board"],
  defaultLayout: "board",
  payoffs: ["gate_lifts", "lift_moves", "door_opens", "bridge_forms", "beam_restores"],
  nearMissKeys: [],
  accessories: ["record_lens"],
  skins: CAUSE_TUBES_SKINS,
  control: "tubes",
  configSchema: CauseTubesConfig,
  validateConfig(config: CauseTubesConfig, ctx: ConfigCtx): readonly ConfigIssue[] {
    const out: ConfigIssue[] = [];
    out.push(...subsetOf(["nodes"], "node key", nodeKeysOf(ctx.view), config.nodes.map((n) => n.key)));
    config.nodes.forEach((n, i) => {
      const text = viewTextOf(ctx.view, n.key);
      if (n.meta.printedDate !== null && !dateAppearsIn([text], n.meta.printedDate)) {
        out.push(err(["nodes", i, "meta", "printedDate"], `printed date ${n.meta.printedDate} does not appear in "${text}"`));
      }
    });
    if (!(config.boardWidth <= 1100)) out.push(err(["boardWidth"], `boardWidth ${config.boardWidth} exceeds 1100 (amendment 32)`));
    out.push(...probeRangeIssues(["probe"], config.probe));
    if (config.probeWorld === "record_lens" && !config.probe) out.push(err(["probeWorld"], "record_lens needs a probe"));
    return out;
  },
  defaultConfig(ctx: ConfigCtx): CauseTubesConfig {
    const nodes = nodeKeysOf(ctx.view).map((key) => ({ key, meta: { printedDate: findDates(viewTextOf(ctx.view, key))[0] ?? null } }));
    const years = nodes.map((n) => (n.meta.printedDate ? Math.floor(fracYearOf(n.meta.printedDate) ?? 0) : 0)).filter((y) => y > 0);
    const probe = years.length >= 2 ? yearProbeFor(years) : null;
    return CauseTubesConfig.parse({ nodes, ...tubesFor(ctx.biome), probe, probeWorld: probe ? "record_lens" : "none" });
  },
  writerConfigSchema: (ctx: WriterCtx) =>
    ctx.itemKeys.length === 0
      ? null
      : z.object({
          nodes: z
            .array(z.object({ key: z.enum(asTuple(ctx.itemKeys, "node keys")), printedDate: wDate().nullable() }))
            .min(ctx.itemKeys.length)
            .max(ctx.itemKeys.length),
          probe: wProbe(),
        }),
  fromWriterConfig(w: unknown, ctx: ConfigCtx): CauseTubesConfig {
    const wc = w as CauseTubesWriter;
    const probe = probeFromWriter(wc.probe);
    return CauseTubesConfig.parse({
      nodes: wc.nodes.map((n) => ({ key: n.key, meta: { printedDate: n.printedDate } })),
      ...tubesFor(ctx.biome),
      probe,
      probeWorld: probe && (probe.format === "year" || probe.format === "month_year") ? "record_lens" : "none",
    });
  },
  footprint: footprintOf,
  frameBounds: (config: CauseTubesConfig) => frameBoundsOf(config),
  probe: (config: CauseTubesConfig): ProbeSpec | null => config.probe,
  clock: null,
  sim: null,
  pose: poseOf,
  lerp: lerpPose,
  describe: (pose: CauseTubesPose) => describePose(pose),
  panelStatic: panelStaticOf,
  panelLive: panelLiveOf,
  hintTargets: (rung: HintRung, input: StaticInput<CauseTubesConfig>): readonly HintTarget[] =>
    (CAUSE_TUBES_SKINS.find((s) => s.id === input.skinId) ?? CAUSE_TUBES_SKINS[0]).hintTargets[rung - 1],
  audio: (pose: CauseTubesPose) => audioOf(pose),
  failurePlan: failurePlanOf,
  successPlan: (input: PoseInput<CauseTubesConfig>, anim: PayoffAnim) => successPlanOf(input, anim),
  solvedPose: (input: PoseInput<CauseTubesConfig>) => poseOf({ ...input, solved: true }),
  debug: (pose: CauseTubesPose) => ({
    layout: pose.layout,
    connector: pose.connector,
    edges: pose.edges,
    edgeCount: pose.edgeCount,
    gauge: Math.round(pose.gauge * 1000) / 1000,
    wires: pose.wires.map((w) => `${w.fromKey}>${w.toKey}`).join(","),
    ready: pose.housings.filter((h) => h.lamp === "ready").map((h) => h.key).join(","),
    lit: pose.housings.filter((h) => h.lamp === "lit").length,
    focus: pose.focusKey ?? "",
    run: Math.round(pose.run * 1000) / 1000,
    gate: Math.round(pose.gate * 1000) / 1000,
    lensU: pose.lensU ?? -1,
    solved: pose.solved,
  }),
};
