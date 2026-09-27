import type { Encounter } from "../../../../contracts/gamespec";
import type { Progression } from "../../../runner/progression";
import { seededRandom } from "../../types";

/*
 * The puzzle host's "logic board": a square-tile circuit board where power flows from a SOURCE tile to the CORE tile
 * (the boss). Every non-boss encounter is a SEAL on one of 1-3 routes (one per progression track, in track order);
 * between consecutive seals sit 2-6 rotatable conduit tiles whose starting rotation is scrambled. The player rotates
 * conduits until power reaches a seal; an unsolved seal stops the flow, a solved seal passes it on.
 *
 * Everything here is pure and deterministic (seeded by the spec seed), so a spec always yields the same board.
 *
 * Geometry. Rows are split into horizontal bands, one per route. The source sits on the left edge and the core on the
 * right edge of the same row ("mid"). The middle band leaves the source eastward; the band above leaves it north and
 * enters the core from the north; the band below drops down column 0 (a lead-in), crosses, and climbs column W-1 (a
 * lead-out) into the core from the south. Inside a band the route is x-monotone (column by column, wiggling up and
 * down), so routes never cross themselves or each other by construction.
 */

// ---------------------------------------------------------------------------------------------------------------------
// Directions and openings

/** Direction indices: 0 north, 1 east, 2 south, 3 west. Opening masks use one bit per direction. */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
export const BIT = [N, E, S, W] as const;
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;

export const opposite = (d: number): number => (d + 2) % 4;
export const mod4 = (n: number): number => ((n % 4) + 4) % 4;

/** Rotate an opening mask clockwise by `turns` quarter turns (any integer). */
export function rotateMask(mask: number, turns: number): number {
  const r = mod4(turns);
  let out = 0;
  for (let d = 0; d < 4; d++) if (mask & BIT[d]) out |= BIT[(d + r) % 4];
  return out;
}

/** Direction indices set in a mask, in N/E/S/W order. */
export function dirsOf(mask: number): number[] {
  return [0, 1, 2, 3].filter((d) => mask & BIT[d]);
}

export type ConduitKind = "straight" | "corner" | "tee";
export type TileKind = ConduitKind | "rivet" | "source" | "core" | "seal";

/** Openings of each rotatable piece at turn 0. */
export const PIECE_BASE: Record<ConduitKind, number> = { straight: N | S, corner: N | E, tee: N | E | S };

// ---------------------------------------------------------------------------------------------------------------------
// Board model

export interface Tile {
  index: number;
  x: number;
  y: number;
  kind: TileKind;
  /** openings at turn 0 (seal/source/core openings are fixed) */
  base: number;
  /** conduit pieces rotate; seals, source, core and rivets never do */
  rotatable: boolean;
  /** the encounter behind a seal, or the boss behind the core (null for a boss-less core) */
  encounterId: string | null;
  /** for tiles on a route: the openings the route needs (toward the previous and next tile); 0 for decoys */
  need: number;
  /** the route segment a conduit belongs to, or -1 */
  segment: number;
  /** the route (track) a route tile belongs to, or -1 */
  route: number;
}

/** The conduits between two fixed nodes of a route (source, seal, core). */
export interface Segment {
  index: number;
  route: number;
  /** tile index of the node power comes from (source or a seal) */
  from: number;
  /** tile index of the node power flows to (a seal or the core) */
  to: number;
  /** conduit tile indices in flow order */
  cells: number[];
  fromEncounterId: string | null;
  /** the seal's (or the boss core's) encounter; null for the core of a boss-less spec */
  toEncounterId: string | null;
}

export interface Route {
  index: number;
  /** the track's encounter ids, in track order (= order along the route) */
  encounterIds: string[];
  /** every tile on the route between source and core (conduits and seals), in flow order */
  cells: number[];
  segments: number[];
}

export interface Board {
  width: number;
  height: number;
  tiles: Tile[];
  source: number;
  core: number;
  bossId: string | null;
  routes: Route[];
  segments: Segment[];
  /** encounter id → tile index (seals, and the boss → core) */
  tileOf: Record<string, number>;
  /** scrambled starting turns, one per tile */
  start: number[];
  /** a solved configuration, one per tile (decoys keep their start turn) */
  solution: number[];
}

export interface BoardInput {
  seed: number;
  encounters: readonly Pick<Encounter, "id">[];
  progression: Pick<Progression, "tracks" | "bossId">;
}

export const MIN_GAP = 2;
export const MAX_GAP = 6;
const MAX_HEIGHT_PER_BAND = 6;

// ---------------------------------------------------------------------------------------------------------------------
// Band shapes: an x-monotone path through a w×h band, from `start` row (entering column 0) to `end` row (leaving
// column w-1). Its length is w + V, V being the total vertical travel; a DP gives which V are reachable.

interface BandShape {
  w: number;
  h: number;
  start: number;
  end: number;
}

/** reach[c][row][v]: from column c entered at `row`, a vertical travel of exactly v can end at `end`. */
function reachTable(b: BandShape): boolean[][][] {
  const maxV = b.w * b.h;
  const reach: boolean[][][] = Array.from({ length: b.w }, () => Array.from({ length: b.h }, () => new Array<boolean>(maxV + 1).fill(false)));
  for (let row = 0; row < b.h; row++) reach[b.w - 1][row][Math.abs(b.end - row)] = true;
  for (let c = b.w - 2; c >= 0; c--)
    for (let row = 0; row < b.h; row++)
      for (let e = 0; e < b.h; e++) {
        const dv = Math.abs(e - row);
        const next = reach[c + 1][e];
        for (let v = 0; v + dv <= maxV; v++) if (next[v]) reach[c][row][v + dv] = true;
      }
  return reach;
}

/** Route length (tiles between source and core) the gap rules allow for n seals. */
export function gapRange(n: number): [number, number] {
  return [n + MIN_GAP * (n + 1), n + MAX_GAP * (n + 1)];
}

/** The length a route with n seals aims for (average gap of 3). */
function desiredLength(n: number): number {
  return n + 3 * (n + 1);
}

/** Best feasible route length for a band (closest to desired), or null. */
function bestLength(b: BandShape, lead: number, n: number, reach: boolean[][][]): number | null {
  const [lo, hi] = gapRange(n);
  const want = desiredLength(n);
  let best: number | null = null;
  for (let p = lo; p <= hi; p++) {
    const v = p - lead - b.w;
    if (v < 0 || v >= reach[0][b.start].length || !reach[0][b.start][v]) continue;
    if (best === null || Math.abs(p - want) < Math.abs(best - want)) best = p;
  }
  return best;
}

/** Walk a random x-monotone path with exactly V vertical travel; returns [col,row] relative to the band. */
function walkBand(b: BandShape, v: number, reach: boolean[][][], rnd: () => number): [number, number][] {
  const cells: [number, number][] = [];
  let row = b.start;
  let left = v;
  for (let c = 0; c < b.w; c++) {
    let exit: number;
    if (c === b.w - 1) exit = b.end;
    else {
      const options: number[] = [];
      for (let e = 0; e < b.h; e++) {
        const dv = Math.abs(e - row);
        if (dv <= left && reach[c + 1][e][left - dv]) options.push(e);
      }
      exit = options[Math.floor(rnd() * options.length)];
    }
    const step = exit >= row ? 1 : -1;
    for (let r = row; ; r += step) {
      cells.push([c, r]);
      if (r === exit) break;
    }
    left -= Math.abs(exit - row);
    row = exit;
  }
  return cells;
}

interface BandPlacement {
  c0: number;
  r0: number;
  shape: BandShape;
  leadIn: [number, number][];
  leadOut: [number, number][];
}

/** Absolute band placements for k routes on a W-wide board with the given band heights. */
function placeBands(k: number, width: number, heights: number[]): { height: number; mid: number; bands: BandPlacement[] } {
  if (k === 1) {
    const h = heights[0];
    const mid = Math.floor((h - 1) / 2);
    return { height: h, mid, bands: [{ c0: 1, r0: 0, shape: { w: width - 2, h, start: mid, end: mid }, leadIn: [], leadOut: [] }] };
  }
  const [h0, h1] = heights;
  const mid = h0;
  const bands: BandPlacement[] = [
    { c0: 0, r0: 0, shape: { w: width, h: h0, start: h0 - 1, end: h0 - 1 }, leadIn: [], leadOut: [] },
    { c0: 1, r0: mid, shape: { w: width - 2, h: h1, start: 0, end: 0 }, leadIn: [], leadOut: [] },
  ];
  if (k === 2) return { height: h0 + h1, mid, bands };
  const h2 = heights[2];
  const top = mid + h1;
  const leadIn: [number, number][] = [];
  const leadOut: [number, number][] = [];
  for (let y = mid + 1; y < top; y++) leadIn.push([0, y]);
  for (let y = top - 1; y > mid; y--) leadOut.push([width - 1, y]);
  bands.push({ c0: 0, r0: top, shape: { w: width, h: h2, start: 0, end: 0 }, leadIn, leadOut });
  return { height: top + h2, mid, bands };
}

interface Sizing {
  width: number;
  heights: number[];
  lengths: number[];
}

/** Pick a board width and per-band heights so every route fits its seals with 2-6 conduits per gap. */
function sizeBoard(counts: number[]): Sizing {
  const k = counts.length;
  const longest = Math.max(...counts.map(desiredLength));
  const preferred = Math.min(12, Math.max(7, Math.ceil(longest / 2) + 1));
  const widths: number[] = [];
  for (let w = preferred; w <= 13; w++) widths.push(w);
  for (let w = preferred - 1; w >= 5; w--) widths.push(w);
  let fallback: Sizing | null = null;
  for (const width of widths) {
    const heights: number[] = [];
    const lengths: number[] = [];
    let ok = true;
    let slack = 0;
    for (let t = 0; t < k; t++) {
      const minH = k === 1 ? 3 : 2;
      let chosen: { h: number; p: number } | null = null;
      for (let h = minH; h <= MAX_HEIGHT_PER_BAND; h++) {
        heights[t] = h;
        const band = placeBands(k, width, [...heights, 2, 2].slice(0, Math.max(k, t + 1))).bands[t];
        const lead = band.leadIn.length + band.leadOut.length;
        const p = bestLength(band.shape, lead, counts[t], reachTable(band.shape));
        if (p === null) continue;
        if (chosen === null || Math.abs(p - desiredLength(counts[t])) < Math.abs(chosen.p - desiredLength(counts[t]))) chosen = { h, p };
        if (Math.abs(p - desiredLength(counts[t])) <= 3) break;
      }
      if (!chosen) {
        ok = false;
        break;
      }
      heights[t] = chosen.h;
      lengths[t] = chosen.p;
      slack += Math.abs(chosen.p - desiredLength(counts[t]));
    }
    if (!ok) continue;
    const sizing = { width, heights: heights.slice(0, k), lengths };
    if (slack <= 3 * k) return sizing;
    fallback ??= sizing;
  }
  if (fallback) return fallback;
  throw new Error(`puzzle board: no layout fits routes of ${counts.join("/")} seals`);
}

// ---------------------------------------------------------------------------------------------------------------------
// Generation

function dirBetween(ax: number, ay: number, bx: number, by: number): number {
  for (let d = 0; d < 4; d++) if (ax + DX[d] === bx && ay + DY[d] === by) return d;
  throw new Error(`puzzle board: tiles (${ax},${ay}) and (${bx},${by}) are not adjacent`);
}

/** Split `total` conduits into `parts` gaps of MIN_GAP..MAX_GAP, randomly. */
function splitGaps(total: number, parts: number, rnd: () => number): number[] {
  const gaps = new Array<number>(parts).fill(MIN_GAP);
  let extra = total - MIN_GAP * parts;
  while (extra > 0) {
    const open = gaps.map((g, i) => (g < MAX_GAP ? i : -1)).filter((i) => i >= 0);
    gaps[open[Math.floor(rnd() * open.length)]]++;
    extra--;
  }
  return gaps;
}

/** The turn (0..3) that gives `kind` exactly the openings in `mask`, or -1. */
function turnFor(kind: ConduitKind, mask: number): number {
  for (let t = 0; t < 4; t++) if (rotateMask(PIECE_BASE[kind], t) === mask) return t;
  return -1;
}

export function generateBoard(input: BoardInput): Board {
  const rnd = seededRandom((input.seed ^ 0x5eed_c1c7) >>> 0);
  const bossId = input.progression.bossId;
  // tracks from the progression (1-3); more than three fold into the last, none (boss-only spec) is one empty route
  let tracks = input.progression.tracks.map((t) => [...t]);
  if (tracks.length > 3) tracks = [tracks[0], tracks[1], tracks.slice(2).flat()];
  if (tracks.length === 0) tracks = [[]];
  const k = tracks.length;
  const sizing = sizeBoard(tracks.map((t) => t.length));
  const { width } = sizing;
  const { height, mid, bands } = placeBands(k, width, sizing.heights);

  const at = (x: number, y: number) => y * width + x;
  const inBoard = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      tiles.push({ index: at(x, y), x, y, kind: "rivet", base: 0, rotatable: false, encounterId: null, need: 0, segment: -1, route: -1 });

  const source = at(0, mid);
  const core = at(width - 1, mid);
  tiles[source].kind = "source";
  tiles[core].kind = "core";
  tiles[core].encounterId = bossId;
  const tileOf: Record<string, number> = {};
  if (bossId) tileOf[bossId] = core;

  // 1. route paths (absolute cells, source- and core-exclusive)
  const paths: number[][] = bands.map((band, t) => {
    const reach = reachTable(band.shape);
    const lead = band.leadIn.length + band.leadOut.length;
    const v = sizing.lengths[t] - lead - band.shape.w;
    const inner = walkBand(band.shape, v, reach, rnd).map(([c, r]) => at(band.c0 + c, band.r0 + r));
    return [...band.leadIn.map(([x, y]) => at(x, y)), ...inner, ...band.leadOut.map(([x, y]) => at(x, y))];
  });
  const onRoute = new Set<number>(paths.flat());

  // 2. seals, segments and needed openings
  const routes: Route[] = [];
  const segments: Segment[] = [];
  paths.forEach((cells, t) => {
    const ids = tracks[t];
    const gaps = splitGaps(cells.length - ids.length, ids.length + 1, rnd);
    const sealAt = new Map<number, string>();
    let pos = -1;
    ids.forEach((id, j) => {
      pos += gaps[j] + 1;
      sealAt.set(pos, id);
    });
    const route: Route = { index: t, encounterIds: ids, cells, segments: [] };
    let seg: Segment = { index: segments.length, route: t, from: source, to: core, cells: [], fromEncounterId: null, toEncounterId: bossId };
    cells.forEach((cell, i) => {
      const tile = tiles[cell];
      const prev = i === 0 ? source : cells[i - 1];
      const next = i === cells.length - 1 ? core : cells[i + 1];
      const din = dirBetween(tile.x, tile.y, tiles[prev].x, tiles[prev].y);
      const dout = dirBetween(tile.x, tile.y, tiles[next].x, tiles[next].y);
      tile.need = BIT[din] | BIT[dout];
      tile.route = t;
      if (i === 0) tiles[source].base |= BIT[opposite(din)];
      if (i === cells.length - 1) tiles[core].base |= BIT[opposite(dout)];
      const sealId = sealAt.get(i);
      if (sealId) {
        tile.kind = "seal";
        tile.base = tile.need;
        tile.encounterId = sealId;
        tileOf[sealId] = cell;
        seg.to = cell;
        seg.toEncounterId = sealId;
        segments.push(seg);
        route.segments.push(seg.index);
        seg = { index: segments.length, route: t, from: cell, to: core, cells: [], fromEncounterId: sealId, toEncounterId: bossId };
      } else {
        tile.segment = seg.index;
        seg.cells.push(cell);
      }
    });
    segments.push(seg);
    route.segments.push(seg.index);
    routes.push(route);
  });
  for (const s of segments) for (const c of s.cells) tiles[c].segment = s.index;

  // 3. conduit pieces on routes; a tee's spare opening may only face the edge or a rivet (so a solved board never leaks)
  const reservedRivets = new Set<number>();
  const solution = new Array<number>(tiles.length).fill(0);
  for (const cell of onRoute) {
    const tile = tiles[cell];
    if (tile.kind === "seal") continue;
    const straight = tile.need === (N | S) || tile.need === (E | W);
    let kind: ConduitKind = straight ? "straight" : "corner";
    let mask = tile.need;
    if (rnd() < 0.16) {
      const spare = [0, 1, 2, 3].filter((d) => {
        if (tile.need & BIT[d]) return false;
        const nx = tile.x + DX[d];
        const ny = tile.y + DY[d];
        if (!inBoard(nx, ny)) return true;
        const n = at(nx, ny);
        return !onRoute.has(n) && n !== source && n !== core;
      });
      if (spare.length > 0) {
        const d = spare[Math.floor(rnd() * spare.length)];
        kind = "tee";
        mask = tile.need | BIT[d];
        if (inBoard(tile.x + DX[d], tile.y + DY[d])) reservedRivets.add(at(tile.x + DX[d], tile.y + DY[d]));
      }
    }
    tile.kind = kind;
    tile.base = PIECE_BASE[kind];
    tile.rotatable = true;
    solution[cell] = turnFor(kind, mask);
  }

  // 4. decoys and rivets in the remaining cells
  const start = new Array<number>(tiles.length).fill(0);
  for (const tile of tiles) {
    if (tile.kind !== "rivet" || onRoute.has(tile.index)) continue;
    if (reservedRivets.has(tile.index) || rnd() < 0.12) continue;
    const roll = rnd();
    const kind: ConduitKind = roll < 0.36 ? "straight" : roll < 0.8 ? "corner" : "tee";
    tile.kind = kind;
    tile.base = PIECE_BASE[kind];
    tile.rotatable = true;
    start[tile.index] = Math.floor(rnd() * 4);
    solution[tile.index] = start[tile.index];
  }

  const board: Board = { width, height, tiles, source, core, bossId, routes, segments, tileOf, start, solution };

  // 5. scramble route conduits: every segment starts broken, and no seal (or the core) starts powered
  for (let attempt = 0; attempt < 24; attempt++) {
    for (const seg of segments) {
      for (const c of seg.cells) start[c] = Math.floor(rnd() * 4);
      const wrongWanted = Math.max(1, Math.floor(seg.cells.length / 2));
      const aligned = seg.cells.filter((c) => isAligned(tiles[c], start[c]));
      let wrong = seg.cells.length - aligned.length;
      while (wrong < wrongWanted && aligned.length > 0) {
        const c = aligned.splice(Math.floor(rnd() * aligned.length), 1)[0];
        start[c] = wrongTurn(tiles[c], rnd);
        wrong++;
      }
    }
    if (attempt === 23) for (const seg of segments) for (const c of seg.cells) start[c] = wrongTurn(tiles[c], rnd);
    const powered = floodPower(board, start, new Set());
    const leaked = tiles.some((t) => (t.kind === "seal" || t.kind === "core") && powered[t.index]);
    if (!leaked) break;
  }
  return board;
}

function wrongTurn(tile: Tile, rnd: () => number): number {
  const wrong = [0, 1, 2, 3].filter((t) => !isAligned(tile, t));
  return wrong[Math.floor(rnd() * wrong.length)] ?? 0;
}

// ---------------------------------------------------------------------------------------------------------------------
// Play-time queries

/** The openings a tile has at the given turn (fixed tiles ignore the turn). */
export function openingsAt(tile: Tile, turn: number): number {
  return tile.rotatable ? rotateMask(tile.base, turn) : tile.base;
}

/** A route conduit is aligned when its openings include both the ones its route needs. */
export function isAligned(tile: Tile, turn: number): boolean {
  if (tile.need === 0) return true;
  return (openingsAt(tile, turn) & tile.need) === tile.need;
}

/** The index of the neighbour in direction d, or -1 off the board. */
export function neighbour(board: Board, index: number, d: number): number {
  const t = board.tiles[index];
  const x = t.x + DX[d];
  const y = t.y + DY[d];
  if (x < 0 || y < 0 || x >= board.width || y >= board.height) return -1;
  return y * board.width + x;
}

/** Two adjacent tiles connect when each has an opening facing the other. */
export function connects(board: Board, turns: readonly number[], a: number, d: number): boolean {
  const b = neighbour(board, a, d);
  if (b < 0) return false;
  return (openingsAt(board.tiles[a], turns[a]) & BIT[d]) !== 0 && (openingsAt(board.tiles[b], turns[b]) & BIT[opposite(d)]) !== 0;
}

/** Can power pass THROUGH this tile? Unsolved seals and the core stop it; rivets have no openings anyway. */
function passes(tile: Tile, solved: ReadonlySet<string>): boolean {
  if (tile.kind === "core") return false;
  if (tile.kind === "seal") return tile.encounterId !== null && solved.has(tile.encounterId);
  return true;
}

/** Flood fill from the source through matching openings. Seals and the core are reached but only solved seals pass. */
export function floodPower(board: Board, turns: readonly number[], solved: ReadonlySet<string>): boolean[] {
  const powered = new Array<boolean>(board.tiles.length).fill(false);
  powered[board.source] = true;
  const queue = [board.source];
  while (queue.length > 0) {
    const i = queue.shift()!;
    if (i !== board.source && !passes(board.tiles[i], solved)) continue;
    for (let d = 0; d < 4; d++) {
      if (!connects(board, turns, i, d)) continue;
      const j = neighbour(board, i, d);
      if (powered[j]) continue;
      powered[j] = true;
      queue.push(j);
    }
  }
  return powered;
}

/** The core is charged when every branch feeding it arrives powered (each of its openings meets a lit conduit). */
export function coreCharged(board: Board, turns: readonly number[], powered: readonly boolean[]): boolean {
  const dirs = dirsOf(board.tiles[board.core].base);
  if (dirs.length === 0) return false;
  return dirs.every((d) => {
    const n = neighbour(board, board.core, d);
    return n >= 0 && powered[n] && connects(board, turns, board.core, d);
  });
}

export function isSegmentSolved(board: Board, segment: Segment, turns: readonly number[]): boolean {
  return segment.cells.every((c) => isAligned(board.tiles[c], turns[c]));
}

/** Is this segment fused (locked golden) because the node it feeds is solved, or the game is over? */
export function isFused(segment: Segment, solved: ReadonlySet<string>, finished: boolean): boolean {
  if (finished) return true;
  return segment.toEncounterId !== null && solved.has(segment.toEncounterId);
}

/** The smallest forward turn (>= turn) that aligns a route conduit; keeps rotation animations going clockwise. */
export function alignTurn(tile: Tile, turn: number): number {
  for (let k = 0; k < 4; k++) if (isAligned(tile, turn + k)) return turn + k;
  return turn;
}

/** Rotate every conduit of a segment into place (the "auto-fix" used for the debug path and the finale). */
export function fixSegment(board: Board, turns: readonly number[], segment: Segment): number[] {
  const out = [...turns];
  for (const c of segment.cells) out[c] = alignTurn(board.tiles[c], out[c]);
  return out;
}

/**
 * The turns to draw and flood with: the player's turns, except that a fused segment (its seal solved, or the game
 * finished) is snapped into place. That keeps the board coherent when a seal is solved without power having reached
 * it (the debug path) and lights the whole board at the finale.
 */
export function effectiveTurns(board: Board, turns: readonly number[], solved: ReadonlySet<string>, finished: boolean): number[] {
  let out: number[] = [...turns];
  for (const seg of board.segments) if (isFused(seg, solved, finished) && !isSegmentSolved(board, seg, out)) out = fixSegment(board, out, seg);
  return out;
}

/** Can the player rotate this tile right now? (conduits outside fused segments) */
export function canRotate(board: Board, index: number, solved: ReadonlySet<string>, finished: boolean): boolean {
  const tile = board.tiles[index];
  if (!tile.rotatable || finished) return false;
  if (tile.segment < 0) return true;
  return !isFused(board.segments[tile.segment], solved, finished);
}

/**
 * Frontier segments: power has reached the node they start from (the source or a solved seal) but the node they feed
 * is still unsolved. These are the segments the player should be routing right now.
 */
export function frontierSegments(board: Board, powered: readonly boolean[], solved: ReadonlySet<string>): Segment[] {
  return board.segments.filter((seg) => {
    if (seg.toEncounterId !== null && solved.has(seg.toEncounterId)) return false;
    if (seg.fromEncounterId !== null && !solved.has(seg.fromEncounterId)) return false;
    return powered[seg.from];
  });
}

/** Route conduits (in the given segments, or the frontier) that are rotated wrong: what "Reveal route" highlights. */
export function misrotated(board: Board, turns: readonly number[], segments: readonly Segment[]): number[] {
  return segments.flatMap((seg) => seg.cells.filter((c) => !isAligned(board.tiles[c], turns[c])));
}

/** Along each route from the source: how many route tiles the power has actually flowed through, in order. */
export function litPrefix(board: Board, turns: readonly number[], powered: readonly boolean[], solved: ReadonlySet<string>): number[] {
  return board.routes.map((route) => {
    let prev = board.source;
    let n = 0;
    for (const cell of route.cells) {
      const t = board.tiles[prev];
      const d = dirBetween(t.x, t.y, board.tiles[cell].x, board.tiles[cell].y);
      if (!powered[cell] || !connects(board, turns, prev, d)) return n;
      n++;
      if (!passes(board.tiles[cell], solved)) return n;
      prev = cell;
    }
    return n;
  });
}

export type SealState = "solved" | "ready" | "blocked" | "unpowered" | "dormant";

/**
 * A seal's (or the core's) state: solved; `ready` (powered and the runner lists it available: it can be opened);
 * `blocked` (powered but a cross-track requirement is missing); `unpowered` (available but power doesn't reach it);
 * `dormant` (neither).
 */
export function sealState(opts: { solved: boolean; powered: boolean; available: boolean }): SealState {
  if (opts.solved) return "solved";
  if (opts.powered && opts.available) return "ready";
  if (opts.powered) return "blocked";
  if (opts.available) return "unpowered";
  return "dormant";
}

/** Unsolved requirements of an encounter, in progression order. */
export function missingRequirements(progression: Pick<Progression, "byId">, id: string, solved: ReadonlySet<string>): string[] {
  return (progression.byId.get(id)?.requires ?? []).filter((r) => !solved.has(r));
}

// ---------------------------------------------------------------------------------------------------------------------
// Presentation helpers (pure)

/** Truncate a label to `max` characters with an ellipsis, preferring a word boundary. */
export function shortLabel(text: string, max = 12): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space >= Math.floor(max / 2) ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** The first sentence of a premise, or a truncation of it. */
export function shortPremise(text: string, max = 200): string {
  const t = text.trim();
  const m = /^.+?[.!?](\s|$)/.exec(t);
  const first = m ? m[0].trim() : t;
  if (first.length <= max) return first;
  return `${first.slice(0, max - 1).trimEnd()}…`;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** Relative luminance (0..1) of a hex colour. */
export function luminanceOf(hex: string): number {
  return luminance(parseHex(hex));
}

/** "A", "A and B", "A, B and C". */
export function listText(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** The palette accent, lightened toward white until it glows against a near-black board (luminance >= min). */
export function powerColor(accent: string, min = 0.3): string {
  const rgb = parseHex(accent);
  let out = rgb;
  for (let f = 0; f <= 1.0001 && luminance(out) < min; f += 0.05)
    out = rgb.map((c) => Math.round(c + (255 - c) * f)) as [number, number, number];
  return `#${out.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Linear mix of two hex colours (t = 0 → a, 1 → b). */
export function mixHex(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return `#${x.map((c, i) => Math.round(c + (y[i] - c) * t).toString(16).padStart(2, "0")).join("")}`;
}
