/**
 * Small, pure geometry helpers in zone units (x right, y DOWN, docs/design/20 §1.3 conventions).
 * Shared by metas (anchor maths, frame bounds), host pure modules (surfaces, framing) and validators.
 */

export interface Vec2 {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type PolyPoint = readonly [number, number];

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}
export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function deg(rad: number): number {
  return (rad * 180) / Math.PI;
}
export function rad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
/** Wraps an angle into (−π, π]. */
export function wrapAngle(a: number): number {
  let r = a % (2 * Math.PI);
  if (r <= -Math.PI) r += 2 * Math.PI;
  if (r > Math.PI) r -= 2 * Math.PI;
  return r;
}
/** Point on a circle with y DOWN: θ = 0 is to the right, θ = π/2 is straight up (C + r(cos θ, −sin θ)). */
export function pointOnCircle(center: Vec2, r: number, theta: number): Vec2 {
  return { x: center.x + r * Math.cos(theta), y: center.y - r * Math.sin(theta) };
}

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}
export function rectRight(r: Rect): number {
  return r.x + r.w;
}
export function rectBottom(r: Rect): number {
  return r.y + r.h;
}
export function rectCenter(r: Rect): Vec2 {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}
export function translateRect(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h };
}
export function inflateRect(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by };
}
export function rectUnion(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(rectRight(a), rectRight(b)) - x, h: Math.max(rectBottom(a), rectBottom(b)) - y };
}
export function rectContainsPoint(r: Rect, p: Vec2): boolean {
  return p.x >= r.x && p.x <= rectRight(r) && p.y >= r.y && p.y <= rectBottom(r);
}
/** True when `inner` lies entirely inside `outer` (edges may touch). */
export function rectContainsRect(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && rectRight(inner) <= rectRight(outer) && rectBottom(inner) <= rectBottom(outer);
}
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < rectRight(b) && b.x < rectRight(a) && a.y < rectBottom(b) && b.y < rectBottom(a);
}

/** True when the polyline's x values strictly increase (heightfields, platforms). */
export function isStrictlyAscending(points: readonly PolyPoint[]): boolean {
  for (let i = 1; i < points.length; i++) if (!(points[i][0] > points[i - 1][0])) return false;
  return true;
}
/** [first x, last x] of a polyline, or null when empty. */
export function polylineSpan(points: readonly PolyPoint[]): readonly [number, number] | null {
  if (points.length === 0) return null;
  return [points[0][0], points[points.length - 1][0]];
}
/** y on an x-ascending polyline at x (linear interpolation); null outside its span. */
export function polylineYAt(points: readonly PolyPoint[], x: number): number | null {
  if (points.length === 0) return null;
  if (x < points[0][0] || x > points[points.length - 1][0]) return null;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) {
      if (x1 === x0) return y1;
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}
/** Point at arc-length fraction u ∈ [0, 1] along a polyline (record_lens rails, ride paths). */
export function pointAlong(points: readonly PolyPoint[], u: number): Vec2 | null {
  if (points.length === 0) return null;
  if (points.length === 1) return { x: points[0][0], y: points[0][1] };
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const l = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    lengths.push(l);
    total += l;
  }
  if (total === 0) return { x: points[0][0], y: points[0][1] };
  let d = Math.min(Math.max(u, 0), 1) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (d <= lengths[i] || i === lengths.length - 1) {
      const f = lengths[i] === 0 ? 0 : Math.min(1, d / lengths[i]);
      return { x: points[i][0] + (points[i + 1][0] - points[i][0]) * f, y: points[i][1] + (points[i + 1][1] - points[i][1]) * f };
    }
    d -= lengths[i];
  }
  return { x: points[points.length - 1][0], y: points[points.length - 1][1] };
}
