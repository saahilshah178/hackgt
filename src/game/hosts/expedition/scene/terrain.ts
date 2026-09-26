/**
 * scene/terrain.ts (pure, H1) — what stops walking (docs/design/20 §2.4.1, A8):
 * - blockers: every unsolved station's payoff blocker (the current station's plus every later one);
 * - sheer edges: a ground height change greater than maxStepUp within any 8-unit window, in either direction. Walking
 *   never crosses one: a sheer rise is climbed with a hop/climb/ladder link, a sheer descent with a drop link or the
 *   reverse of a two-way link;
 * - zone bounds.
 */
import type { Payoff, Station } from "../../../../contracts/world";
import type { Pt, SurfaceModel } from "./surfaces";
import { spanOf, yOnLine } from "./surfaces";

export const SHEER_WINDOW = 8;
/** Distance kept between the player's feet and a blocker. */
export const BLOCKER_MARGIN = 36;
/** Distance kept from the zone edges. */
export const BOUNDS_MARGIN = 20;

export interface Blocker {
  encounterId: string;
  x: number;
  surface: string;
  asset: string | null;
}
type StationLike = Pick<Station, "encounterId" | "zoneId"> & { payoff: Pick<Payoff, "blocker"> };

/** Blockers of every unsolved station (optionally only one zone's), in station order. */
export function blockers(stations: readonly StationLike[], solvedIds: ReadonlySet<string>, zoneId?: string): Blocker[] {
  const out: Blocker[] = [];
  for (const st of stations) {
    if (zoneId !== undefined && st.zoneId !== zoneId) continue;
    const b = st.payoff.blocker;
    if (!b || solvedIds.has(st.encounterId)) continue;
    out.push({ encounterId: st.encounterId, x: b.x, surface: b.surface ?? "ground", asset: b.asset ?? null });
  }
  return out;
}

export interface SheerEdge {
  /** the x range the player may not enter by walking */
  x0: number;
  x1: number;
  /** seen while moving right: "descent" = the ground drops away, "rise" = a wall */
  dir: "rise" | "descent";
  top: number; // smallest y (highest point) in the range
  bottom: number; // largest y
}

/**
 * Sheer edges of a heightfield. g(a) = h(a + 8) − h(a) is piecewise linear with breakpoints at every x_i and x_i − 8;
 * the windows where |g| > maxStepUp are found exactly and merged into edge ranges [a, a + 8].
 */
export function sheerEdges(points: readonly Pt[], maxStepUp: number, window = SHEER_WINDOW): SheerEdge[] {
  if (points.length < 2) return [];
  const lo = points[0][0];
  const hi = points[points.length - 1][0] - window;
  if (hi <= lo) return [];
  const h = (x: number) => yOnLine(points, Math.min(points[points.length - 1][0], Math.max(lo, x))) ?? 0;
  const g = (a: number) => h(a + window) - h(a);
  const bps = new Set<number>([lo, hi]);
  for (const [x] of points) {
    if (x >= lo && x <= hi) bps.add(x);
    if (x - window >= lo && x - window <= hi) bps.add(x - window);
  }
  const xs = [...bps].sort((a, b) => a - b);
  // intervals of a where g > max (descent) or g < -max (rise)
  const raw: { a0: number; a1: number; dir: SheerEdge["dir"] }[] = [];
  const push = (a0: number, a1: number, dir: SheerEdge["dir"]) => {
    const last = raw[raw.length - 1];
    if (last && last.dir === dir && a0 <= last.a1 + 1e-9) last.a1 = Math.max(last.a1, a1);
    else raw.push({ a0, a1, dir });
  };
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    const ga = g(a);
    const gb = g(b);
    for (const dir of ["descent", "rise"] as const) {
      const s = dir === "descent" ? 1 : -1;
      const fa = s * ga - maxStepUp;
      const fb = s * gb - maxStepUp;
      if (fa <= 0 && fb <= 0) continue;
      let a0 = a;
      let a1 = b;
      if (fa <= 0) a0 = a + ((b - a) * (0 - fa)) / (fb - fa);
      if (fb <= 0) a1 = a + ((b - a) * (0 - fa)) / (fb - fa);
      push(a0, a1, dir);
    }
  }
  return raw.map((r) => {
    const x0 = r.a0;
    const x1 = r.a1 + window;
    let top = Infinity;
    let bottom = -Infinity;
    for (const x of [x0, x1, ...points.filter((p) => p[0] > x0 && p[0] < x1).map((p) => p[0])]) {
      const y = h(x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    return { x0, x1, dir: r.dir, top, bottom };
  });
}

/** True when walking from x0 to x1 would enter a sheer edge (standing inside one, only moving out is allowed). */
export function stepBlocked(points: readonly Pt[], maxStepUp: number, x0: number, x1: number): boolean {
  return edgeHit(sheerEdges(points, maxStepUp), x0, x1) !== null;
}

/** The limit x the walk stops at when it would enter an edge, else null. */
export function edgeHit(edges: readonly SheerEdge[], x0: number, x1: number): number | null {
  if (x1 === x0) return null;
  let limit: number | null = null;
  for (const e of edges) {
    if (x1 > x0) {
      if (x0 < e.x0 && x1 >= e.x0) limit = limit === null ? e.x0 - 0.5 : Math.min(limit, e.x0 - 0.5);
      else if (x0 >= e.x0 && x0 <= e.x1 && x0 - e.x0 >= e.x1 - x0) {
        // inside, nearer the right end: moving right leaves the edge (allowed)
      } else if (x0 >= e.x0 && x0 <= e.x1) limit = limit === null ? x0 : Math.min(limit, x0);
    } else {
      if (x0 > e.x1 && x1 <= e.x1) limit = limit === null ? e.x1 + 0.5 : Math.max(limit, e.x1 + 0.5);
      else if (x0 >= e.x0 && x0 <= e.x1 && x0 - e.x0 <= e.x1 - x0) {
        // inside, nearer the left end: moving left leaves the edge (allowed)
      } else if (x0 >= e.x0 && x0 <= e.x1) limit = limit === null ? x0 : Math.max(limit, x0);
    }
  }
  return limit;
}

export type ClampReason = "edge" | "blocker" | "bounds" | null;
export interface ClampArgs {
  x0: number;
  x1: number;
  surface: string;
  model: SurfaceModel;
  edges: readonly SheerEdge[];
  blockers: readonly Blocker[];
}
/**
 * Where a walk from x0 toward x1 on `surface` actually ends: stopped by a sheer edge (ground only), a blocker on that
 * surface, or the zone bounds. Platform ends are not clamped (walking off one drops to the surface below, §2.4.1).
 */
export function clampX(a: ClampArgs): { x: number; reason: ClampReason } {
  let x = a.x1;
  let reason: ClampReason = null;
  const lo = BOUNDS_MARGIN;
  const hi = a.model.width - BOUNDS_MARGIN;
  if (a.surface === "ground") {
    const span = spanOf(a.model, "ground") ?? [0, a.model.width];
    const glo = Math.max(lo, span[0] + 1);
    const ghi = Math.min(hi, span[1] - 1);
    if (x < glo) {
      x = glo;
      reason = "bounds";
    } else if (x > ghi) {
      x = ghi;
      reason = "bounds";
    }
    const hit = edgeHit(a.edges, a.x0, x);
    if (hit !== null && (x > a.x0 ? hit < x : hit > x)) {
      x = hit;
      reason = "edge";
    }
  } else if (x < lo || x > hi) {
    x = Math.min(hi, Math.max(lo, x));
    reason = "bounds";
  }
  for (const b of a.blockers) {
    if (b.surface !== a.surface) continue;
    if (x > a.x0 && a.x0 <= b.x - BLOCKER_MARGIN && x > b.x - BLOCKER_MARGIN) {
      x = b.x - BLOCKER_MARGIN;
      reason = "blocker";
    } else if (x < a.x0 && a.x0 >= b.x + BLOCKER_MARGIN && x < b.x + BLOCKER_MARGIN) {
      x = b.x + BLOCKER_MARGIN;
      reason = "blocker";
    }
  }
  return { x, reason };
}
