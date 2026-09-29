import type { Heightfield } from "./heightfield";

/*
 * A coarse walkability grid over the heightfield and the two searches the world needs: flood fill (what can the player
 * reach from the spawn?) and A* (route a path between two places). Blocked cells come from steep slopes, deep water and
 * solid structure footprints; bridge and dock decks re-open water cells.
 */

/** Steepest walkable ground in degrees (the player controller uses the same limit). */
export const MAX_WALK_SLOPE = 38;
/** Deepest water the player can wade (metres). */
export const MAX_WADE_DEPTH = 0.45;

export interface Circle {
  x: number;
  z: number;
  r: number;
}

/** A walkable deck over water (a bridge or a dock): an oriented rectangle. */
export interface Deck {
  x: number;
  z: number;
  /** half length along the heading, half width across */
  halfLength: number;
  halfWidth: number;
  /** heading in radians (0 = along +z) */
  heading: number;
}

export interface NavGrid {
  cell: number;
  n: number;
  half: number;
  /** 1 = walkable */
  walk: Uint8Array;
  toCell(x: number, z: number): { cx: number; cz: number };
  toWorld(cx: number, cz: number): { x: number; z: number };
  walkableAt(x: number, z: number): boolean;
}

export function onDeck(d: Deck, x: number, z: number, pad = 0): boolean {
  const dx = x - d.x;
  const dz = z - d.z;
  const s = Math.sin(d.heading);
  const c = Math.cos(d.heading);
  const along = dx * s + dz * c;
  const across = dx * c - dz * s;
  return Math.abs(along) <= d.halfLength + pad && Math.abs(across) <= d.halfWidth + pad;
}

export function buildNavGrid(hf: Heightfield, opts: { cell?: number; solids?: readonly Circle[]; decks?: readonly Deck[]; edgeMargin?: number } = {}): NavGrid {
  const cell = opts.cell ?? 3;
  const half = hf.size / 2;
  const n = Math.floor(hf.size / cell);
  const walk = new Uint8Array(n * n);
  const margin = opts.edgeMargin ?? 4;
  const solids = opts.solids ?? [];
  const decks = opts.decks ?? [];
  const toWorld = (cx: number, cz: number) => ({ x: -half + (cx + 0.5) * cell, z: -half + (cz + 0.5) * cell });
  for (let cz = 0; cz < n; cz++) {
    for (let cx = 0; cx < n; cx++) {
      const { x, z } = toWorld(cx, cz);
      if (Math.abs(x) > half - margin || Math.abs(z) > half - margin) continue;
      const deck = decks.some((d) => onDeck(d, x, z));
      let ok = deck || (hf.slope(x, z) <= MAX_WALK_SLOPE && hf.waterDepth(x, z) <= MAX_WADE_DEPTH);
      if (ok && !deck) for (const s of solids) if (Math.hypot(x - s.x, z - s.z) < s.r) ok = false;
      if (ok) walk[cz * n + cx] = 1;
    }
  }
  const toCell = (x: number, z: number) => ({
    cx: Math.min(n - 1, Math.max(0, Math.floor((x + half) / cell))),
    cz: Math.min(n - 1, Math.max(0, Math.floor((z + half) / cell))),
  });
  return {
    cell,
    n,
    half,
    walk,
    toCell,
    toWorld,
    walkableAt: (x, z) => {
      const { cx, cz } = toCell(x, z);
      return walk[cz * n + cx] === 1;
    },
  };
}

/** The walkable cell nearest to (x, z) within `maxDist` metres, or null. */
export function nearestWalkable(g: NavGrid, x: number, z: number, maxDist = 30): { cx: number; cz: number } | null {
  const { cx, cz } = g.toCell(x, z);
  const rMax = Math.ceil(maxDist / g.cell);
  for (let r = 0; r <= rMax; r++) {
    let best: { cx: number; cz: number; d: number } | null = null;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const ax = cx + dx;
        const az = cz + dz;
        if (ax < 0 || az < 0 || ax >= g.n || az >= g.n || g.walk[az * g.n + ax] !== 1) continue;
        const d = dx * dx + dz * dz;
        if (!best || d < best.d) best = { cx: ax, cz: az, d };
      }
    }
    if (best) return { cx: best.cx, cz: best.cz };
  }
  return null;
}

/** 8-connected flood fill from (x, z). Returns a Uint8Array mask of reachable cells (all zero if the start is blocked). */
export function floodFrom(g: NavGrid, x: number, z: number): Uint8Array {
  const seen = new Uint8Array(g.n * g.n);
  const start = nearestWalkable(g, x, z, 12);
  if (!start) return seen;
  const queue = new Int32Array(g.n * g.n);
  let head = 0;
  let tail = 0;
  const s = start.cz * g.n + start.cx;
  seen[s] = 1;
  queue[tail++] = s;
  while (head < tail) {
    const i = queue[head++];
    const cx = i % g.n;
    const cz = (i - cx) / g.n;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const ax = cx + dx;
        const az = cz + dz;
        if (ax < 0 || az < 0 || ax >= g.n || az >= g.n) continue;
        const j = az * g.n + ax;
        if (seen[j] || g.walk[j] !== 1) continue;
        // no corner cutting through blocked diagonals
        if (dx && dz && (g.walk[cz * g.n + ax] !== 1 || g.walk[az * g.n + cx] !== 1)) continue;
        seen[j] = 1;
        queue[tail++] = j;
      }
    }
  }
  return seen;
}

/** Is any reachable cell within `reach` metres of (x, z)? */
export function reachableNear(g: NavGrid, reachable: Uint8Array, x: number, z: number, reach: number): boolean {
  const { cx, cz } = g.toCell(x, z);
  const r = Math.ceil(reach / g.cell) + 1;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const ax = cx + dx;
      const az = cz + dz;
      if (ax < 0 || az < 0 || ax >= g.n || az >= g.n || !reachable[az * g.n + ax]) continue;
      const w = g.toWorld(ax, az);
      if (Math.hypot(w.x - x, w.z - z) <= reach + g.cell * 0.75) return true;
    }
  }
  return false;
}

/**
 * A* between two points over the grid. `cost(x, z)` adds per-cell cost (slope, vegetation); returns the world-space
 * route (start and end included) or null when there is none.
 */
export function findRoute(
  g: NavGrid,
  from: { x: number; z: number },
  to: { x: number; z: number },
  cost: (x: number, z: number) => number = () => 0,
): { x: number; z: number }[] | null {
  const a = nearestWalkable(g, from.x, from.z, 20);
  const b = nearestWalkable(g, to.x, to.z, 20);
  if (!a || !b) return null;
  const N = g.n * g.n;
  const gScore = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const start = a.cz * g.n + a.cx;
  const goal = b.cz * g.n + b.cx;
  const heur = (i: number) => {
    const cx = i % g.n;
    const cz = (i - cx) / g.n;
    return Math.hypot(cx - b.cx, cz - b.cz);
  };
  // binary heap of [f, index]
  const heapF: number[] = [];
  const heapI: number[] = [];
  const push = (f: number, i: number) => {
    heapF.push(f);
    heapI.push(i);
    let k = heapF.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heapF[p] <= heapF[k]) break;
      [heapF[p], heapF[k]] = [heapF[k], heapF[p]];
      [heapI[p], heapI[k]] = [heapI[k], heapI[p]];
      k = p;
    }
  };
  const pop = (): number => {
    const top = heapI[0];
    const lastF = heapF.pop()!;
    const lastI = heapI.pop()!;
    if (heapF.length > 0) {
      heapF[0] = lastF;
      heapI[0] = lastI;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heapF.length && heapF[l] < heapF[m]) m = l;
        if (r < heapF.length && heapF[r] < heapF[m]) m = r;
        if (m === k) break;
        [heapF[m], heapF[k]] = [heapF[k], heapF[m]];
        [heapI[m], heapI[k]] = [heapI[k], heapI[m]];
        k = m;
      }
    }
    return top;
  };
  gScore[start] = 0;
  push(heur(start), start);
  while (heapF.length > 0) {
    const i = pop();
    if (i === goal) break;
    if (closed[i]) continue;
    closed[i] = 1;
    const cx = i % g.n;
    const cz = (i - cx) / g.n;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const ax = cx + dx;
        const az = cz + dz;
        if (ax < 0 || az < 0 || ax >= g.n || az >= g.n) continue;
        const j = az * g.n + ax;
        if (closed[j] || g.walk[j] !== 1) continue;
        if (dx && dz && (g.walk[cz * g.n + ax] !== 1 || g.walk[az * g.n + cx] !== 1)) continue;
        const w = g.toWorld(ax, az);
        const step = (dx && dz ? Math.SQRT2 : 1) * (1 + cost(w.x, w.z));
        const tentative = gScore[i] + step;
        if (tentative < gScore[j]) {
          gScore[j] = tentative;
          came[j] = i;
          push(tentative + heur(j), j);
        }
      }
    }
  }
  if (came[goal] === -1 && goal !== start) return null;
  const cells: number[] = [];
  for (let i = goal; i !== -1; i = came[i]) cells.push(i);
  cells.reverse();
  const route = cells.map((i) => {
    const cx = i % g.n;
    return g.toWorld(cx, (i - cx) / g.n);
  });
  return simplifyRoute([from, ...route, to], g.cell * 0.9);
}

/** Ramer-Douglas-Peucker on a polyline, keeping the corners that matter. */
export function simplifyRoute(points: { x: number; z: number }[], tolerance: number): { x: number; z: number }[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    const A = points[a];
    const B = points[b];
    const dx = B.x - A.x;
    const dz = B.z - A.z;
    const len = Math.hypot(dx, dz) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((points[i].x - A.x) * dz - (points[i].z - A.z) * dx) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > tolerance) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
