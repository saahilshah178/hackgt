/**
 * prefabs/_cables/geometry.ts — the PURE half of the shared cord and cable drawing (docs/design/20 §7.2 KB: owned by
 * KB (L7); KC imports it read-only for the switchboard cords and the cause-tube wires; KB uses it for the
 * pump_rewiring cables). No Phaser here, so Vitest (node) tests it; draw.ts renders what these functions return.
 *
 * Coordinates are container-local zone units, x right, y DOWN. Every function is deterministic.
 *
 *   sagPath          a hanging cable between two points (parabolic catenary approximation, sag at the midpoint)
 *   catenaryPath     the true catenary of a given length (falls back to sagPath when the ends are too far apart)
 *   bowPath          a vertical wire bowed sideways (mast wires)
 *   manhattanPath    an orthogonal route with ≤ 2 bends (tubes on a board), optionally with rounded corners
 *   Verlet rope      createRope / stepRope / ropePath: a pinned chain (patch cords), gravity 900, fixed iterations
 *   path utilities   pathLength, pointAt (arc-length fraction), trimPath (grow a tube from its start), resample
 */

export interface XY {
  x: number;
  y: number;
}

const xy = (x: number, y: number): XY => ({ x, y });

// ---------------------------------------------------------------- path utilities

export function pathLength(points: readonly XY[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  return total;
}

/** The point at arc-length fraction u ∈ [0, 1] (clamped) along a polyline; the first point for a degenerate path. */
export function pointAt(points: readonly XY[], u: number): XY {
  if (points.length === 0) return xy(0, 0);
  if (points.length === 1) return { ...points[0]! };
  const total = pathLength(points);
  if (!(total > 0)) return { ...points[0]! };
  let d = Math.min(1, Math.max(0, Number.isFinite(u) ? u : 0)) * total;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= l || i === points.length - 1) {
      const f = l === 0 ? 0 : Math.min(1, d / l);
      return xy(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
    }
    d -= l;
  }
  return { ...points[points.length - 1]! };
}

/** The unit tangent at arc-length fraction u (for packets and plugs that face along the cable). */
export function tangentAt(points: readonly XY[], u: number): XY {
  const e = 1e-3;
  const a = pointAt(points, Math.max(0, u - e));
  const b = pointAt(points, Math.min(1, u + e));
  const l = Math.hypot(b.x - a.x, b.y - a.y);
  return l > 0 ? xy((b.x - a.x) / l, (b.y - a.y) / l) : xy(1, 0);
}

/** The first u of a path (a tube growing from its source): the prefix up to arc-length fraction u, ending exactly there. */
export function trimPath(points: readonly XY[], u: number): XY[] {
  if (points.length < 2) return points.map((p) => ({ ...p }));
  const uu = Math.min(1, Math.max(0, Number.isFinite(u) ? u : 0));
  if (uu >= 1) return points.map((p) => ({ ...p }));
  const total = pathLength(points);
  let d = uu * total;
  const out: XY[] = [{ ...points[0]! }];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= l) {
      const f = l === 0 ? 0 : d / l;
      out.push(xy(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f));
      return out;
    }
    out.push({ ...b });
    d -= l;
  }
  return out;
}

/** The piece of a path between arc-length fractions u0 ≤ u1 (dashes, a packet's glowing tail). */
export function subPath(points: readonly XY[], u0: number, u1: number): XY[] {
  if (points.length < 2) return points.map((p) => ({ ...p }));
  const a = Math.min(1, Math.max(0, u0));
  const b = Math.min(1, Math.max(a, u1));
  const total = pathLength(points);
  const from = a * total;
  const to = b * total;
  const out: XY[] = [pointAt(points, a)];
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
    if (d > from && d < to) out.push({ ...points[i]! });
  }
  out.push(pointAt(points, b));
  return out;
}

/** n + 1 points evenly spaced by arc length. */
export function resample(points: readonly XY[], n: number): XY[] {
  const k = Math.max(1, Math.floor(n));
  return Array.from({ length: k + 1 }, (_, i) => pointAt(points, i / k));
}

// ---------------------------------------------------------------- hanging cables

/**
 * A cable hanging between a and b with `sag` units of drop at its midpoint (positive = down), as a parabola over the
 * chord: y(u) = lerp(a.y, b.y, u) + 4·sag·u·(1 − u). The catenary approximation the switchboard and relay-line
 * formulas use; n segments (n + 1 points).
 */
export function sagPath(a: XY, b: XY, sag: number, n = 16): XY[] {
  const k = Math.max(1, Math.floor(n));
  return Array.from({ length: k + 1 }, (_, i) => {
    const u = i / k;
    return xy(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u + 4 * sag * u * (1 - u));
  });
}

/** Solve sinh(z)/z = r for z > 0 (r ≥ 1) by Newton's method. */
function solveSinhRatio(r: number): number {
  let z = r < 3 ? Math.sqrt(6 * (r - 1)) : Math.log(2 * r) + Math.log(Math.log(2 * r));
  for (let i = 0; i < 40; i++) {
    const f = Math.sinh(z) / z - r;
    const df = (Math.cosh(z) * z - Math.sinh(z)) / (z * z);
    const next = z - f / df;
    if (!Number.isFinite(next) || next <= 0) break;
    if (Math.abs(next - z) < 1e-12) return next;
    z = next;
  }
  return z;
}

/**
 * The true catenary of arc length `length` hanging between a and b (y down). When the rope is too short to hang
 * (length ≤ chord) it is drawn taut; when a and b share x it falls back to a sag of half the extra length.
 */
export function catenaryPath(a: XY, b: XY, length: number, n = 16): XY[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (!(length > chord + 1e-6)) return sagPath(a, b, 0, n);
  if (Math.abs(dx) < 1e-6) return sagPath(a, b, (length - chord) / 2, n);
  // standard form with y UP: y = c·cosh((x − x0)/c) + k; convert from y-down by negating
  const h = Math.abs(dx);
  const v = -dy; // rise in y-up
  const r = Math.sqrt(length * length - v * v) / h;
  const z = solveSinhRatio(Math.max(1 + 1e-12, r)); // z = h / (2c)
  const c = h / (2 * z);
  const sign = dx >= 0 ? 1 : -1;
  // x measured from a along +h; the vertex x0 satisfies v = c·(cosh((h − x0)/c) − cosh(−x0/c))
  const x0 = h / 2 - c * Math.atanh(v / length);
  const yUp = (x: number) => c * Math.cosh((x - x0) / c);
  const base = yUp(0);
  const k = Math.max(1, Math.floor(n));
  return Array.from({ length: k + 1 }, (_, i) => {
    const x = (h * i) / k;
    return xy(a.x + sign * x, a.y - (yUp(x) - base));
  });
}

/** A vertical-ish wire from a to b bowed sideways by `bow` units at its middle (positive = +x): mast wires. */
export function bowPath(a: XY, b: XY, bow: number, n = 16): XY[] {
  const k = Math.max(1, Math.floor(n));
  return Array.from({ length: k + 1 }, (_, i) => {
    const u = i / k;
    return xy(a.x + (b.x - a.x) * u + bow * Math.sin(Math.PI * u), a.y + (b.y - a.y) * u);
  });
}

// ---------------------------------------------------------------- orthogonal routes

export interface ManhattanOptions {
  /** 1 bend (an L) or 2 bends (a Z / an S); default 2 */
  bends?: 1 | 2;
  /** which way the route leaves `a`: horizontally or vertically; default "h" */
  first?: "h" | "v";
  /** 2 bends: where the middle leg sits, as a fraction of the way from a to b (default 0.5) */
  mid?: number;
}

/**
 * An orthogonal route from a to b with at most 2 bends (civil big_board tubes, §7.4 "Manhattan routes with ≤ 2
 * bends"). Collinear ends give a straight segment. Returns the corner points (2–4 points).
 */
export function manhattanPath(a: XY, b: XY, opts: ManhattanOptions = {}): XY[] {
  const eps = 1e-9;
  if (Math.abs(a.x - b.x) < eps || Math.abs(a.y - b.y) < eps) return [{ ...a }, { ...b }];
  const first = opts.first ?? "h";
  if ((opts.bends ?? 2) === 1) return first === "h" ? [{ ...a }, xy(b.x, a.y), { ...b }] : [{ ...a }, xy(a.x, b.y), { ...b }];
  const m = Math.min(1, Math.max(0, opts.mid ?? 0.5));
  if (first === "h") {
    const mx = a.x + (b.x - a.x) * m;
    return [{ ...a }, xy(mx, a.y), xy(mx, b.y), { ...b }];
  }
  const my = a.y + (b.y - a.y) * m;
  return [{ ...a }, xy(a.x, my), xy(b.x, my), { ...b }];
}

/** Number of direction changes in a polyline (collinear points ignored). */
export function bendCount(points: readonly XY[]): number {
  let bends = 0;
  let prev: XY | null = null;
  for (let i = 1; i < points.length; i++) {
    const d = xy(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
    const l = Math.hypot(d.x, d.y);
    if (l < 1e-9) continue;
    const u = xy(d.x / l, d.y / l);
    if (prev && Math.abs(prev.x * u.y - prev.y * u.x) > 1e-9) bends++;
    prev = u;
  }
  return bends;
}

/** Rounds each interior corner with a quarter-ish arc of `radius` (clamped to half of each adjacent leg). */
export function roundCorners(points: readonly XY[], radius: number, arcSegments = 6): XY[] {
  if (points.length < 3 || !(radius > 0)) return points.map((p) => ({ ...p }));
  const out: XY[] = [{ ...points[0]! }];
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const l1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    if (!(r > 0)) {
      out.push({ ...p1 });
      continue;
    }
    const s = xy(p1.x + ((p0.x - p1.x) / l1) * r, p1.y + ((p0.y - p1.y) / l1) * r);
    const e = xy(p1.x + ((p2.x - p1.x) / l2) * r, p1.y + ((p2.y - p1.y) / l2) * r);
    // quadratic Bézier through the corner: smooth, deterministic, stays inside the corner
    for (let j = 0; j <= arcSegments; j++) {
      const t = j / arcSegments;
      const mt = 1 - t;
      out.push(xy(mt * mt * s.x + 2 * mt * t * p1.x + t * t * e.x, mt * mt * s.y + 2 * mt * t * p1.y + t * t * e.y));
    }
  }
  out.push({ ...points[points.length - 1]! });
  return out;
}

// ---------------------------------------------------------------- Verlet rope (patch cords)

export interface Rope {
  points: XY[]; // current positions
  prev: XY[]; // previous positions (Verlet)
  rest: number; // rest length of each segment
  pinA: XY | null; // null = released (the cord drops from that end)
  pinB: XY | null;
}
export interface RopeOptions {
  /** segments (points − 1); civil e7: 12 */
  segments?: number;
  /** total length ÷ chord (≥ 1); 1.08 hangs gently */
  slack?: number;
  /** minimum total length (so a cord between close jacks still droops) */
  minLength?: number;
}
export interface RopeStepOptions {
  gravity?: number; // units/s² (civil e7: 900)
  damping?: number; // velocity kept per step (0.98)
  iterations?: number; // constraint passes (8)
  /** floor y below which points cannot fall (a released cord lands on the floor) */
  floorY?: number | null;
}

/** A rope pinned at a and b, initialised on a gentle sag so it settles in ~0.5 s. */
export function createRope(a: XY, b: XY, opts: RopeOptions = {}): Rope {
  const n = Math.max(2, Math.floor(opts.segments ?? 12));
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  const length = Math.max(opts.minLength ?? 0, chord * Math.max(1, opts.slack ?? 1.08), 1);
  const extra = Math.max(0, length - chord);
  const start = sagPath(a, b, Math.sqrt(Math.max(0, (3 * length * extra) / 8)), n); // parabola of about that length
  return { points: start, prev: start.map((p) => ({ ...p })), rest: length / n, pinA: { ...a }, pinB: { ...b } };
}

/** Moves the pins (a jack moved, or a plug was lifted). Pass null to release that end. */
export function pinRope(rope: Rope, a: XY | null, b: XY | null): Rope {
  return { ...rope, pinA: a ? { ...a } : null, pinB: b ? { ...b } : null };
}

/** One Verlet step (pure: returns a new rope). */
export function stepRope(rope: Rope, dt: number, opts: RopeStepOptions = {}): Rope {
  const g = opts.gravity ?? 900;
  const damping = opts.damping ?? 0.98;
  const iterations = Math.max(1, Math.floor(opts.iterations ?? 8));
  const h = Math.min(Math.max(0, dt), 1 / 20);
  const floor = opts.floorY ?? null;
  const pts = rope.points.map((p, i) => {
    const q = rope.prev[i]!;
    const vx = (p.x - q.x) * damping;
    const vy = (p.y - q.y) * damping;
    return xy(p.x + vx, p.y + vy + g * h * h);
  });
  const prev = rope.points.map((p) => ({ ...p }));
  const last = pts.length - 1;
  for (let it = 0; it < iterations; it++) {
    if (rope.pinA) pts[0] = { ...rope.pinA };
    if (rope.pinB) pts[last] = { ...rope.pinB };
    for (let i = 0; i < last; i++) {
      const p = pts[i]!;
      const q = pts[i + 1]!;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = Math.hypot(dx, dy) || 1e-9;
      const diff = (d - rope.rest) / d;
      const fixedP = (i === 0 && rope.pinA !== null) as boolean;
      const fixedQ = (i + 1 === last && rope.pinB !== null) as boolean;
      const wp = fixedP ? 0 : fixedQ ? 1 : 0.5;
      const wq = fixedQ ? 0 : fixedP ? 1 : 0.5;
      pts[i] = xy(p.x + dx * diff * wp, p.y + dy * diff * wp);
      pts[i + 1] = xy(q.x - dx * diff * wq, q.y - dy * diff * wq);
    }
    if (floor !== null) for (let i = 0; i <= last; i++) if (pts[i]!.y > floor) pts[i] = xy(pts[i]!.x, floor);
  }
  if (rope.pinA) pts[0] = { ...rope.pinA };
  if (rope.pinB) pts[last] = { ...rope.pinB };
  return { ...rope, points: pts, prev };
}

/** Steps a rope for `seconds` at a fixed 1/60 s (settling a freshly seated cord, tests). */
export function settleRope(rope: Rope, seconds: number, opts: RopeStepOptions = {}): Rope {
  let r = rope;
  const n = Math.max(0, Math.round(seconds * 60));
  for (let i = 0; i < n; i++) r = stepRope(r, 1 / 60, opts);
  return r;
}

/** The rope's current polyline (copies). */
export function ropePath(rope: Rope): XY[] {
  return rope.points.map((p) => ({ ...p }));
}
