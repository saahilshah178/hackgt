/**
 * src/game/art/kit/shade.ts — the shared shading model (02 §3a.1, bible §5.3): key light from the upper left, lit
 * faces in `*.lit`, shadow faces in `*.shade`, separate soft shadows in {{shadow}} at 30 %, ≤ 3 gradient stops,
 * feGaussianBlur as the only filter. Generators use these helpers and never hand-roll colour maths.
 */
import { el, hz, Ids, n, poly, type Pt, tk } from "./svg";
import type { Finish, Ramp, Tok } from "./types";

export interface Paint {
  def: string;
  ref: string; // url(#id)
}
export type Stop = readonly [offset: number, tok: Tok, opacity?: number];

function stops(list: readonly Stop[]): string {
  return list
    .slice(0, 3)
    .map(([o, t, a]) => el("stop", { offset: n(o * 100) + "%", "stop-color": tk(t), "stop-opacity": a === undefined || a >= 1 ? null : a }))
    .join("");
}

/** A linear gradient (≤ 3 stops). Coordinates are objectBoundingBox fractions unless `user` is set. */
export function linear(ids: Ids, list: readonly Stop[], x1: number, y1: number, x2: number, y2: number, user = false): Paint {
  const id = ids.next("lg");
  return {
    def: el("linearGradient", { id, gradientUnits: user ? "userSpaceOnUse" : null, x1, y1, x2, y2 }, stops(list)),
    ref: `url(#${id})`,
  };
}
/** A radial gradient (≤ 3 stops); objectBoundingBox unless `user`. */
export function radial(ids: Ids, list: readonly Stop[], cx = 0.5, cy = 0.5, r = 0.5, user = false, fx?: number, fy?: number): Paint {
  const id = ids.next("rg");
  return {
    def: el("radialGradient", { id, gradientUnits: user ? "userSpaceOnUse" : null, cx, cy, r, fx: fx ?? null, fy: fy ?? null }, stops(list)),
    ref: `url(#${id})`,
  };
}

/** Diagonal ramp: lit at the upper left → base → shade at the lower right. */
export function rampDiag(ids: Ids, ramp: Ramp, haze = 0): Paint {
  return linear(ids, [[0, hz(ramp.lit, haze)], [0.5, hz(ramp.base, haze)], [1, hz(ramp.shade, haze)]], 0, 0, 1, 1);
}
/** Cylinder ramp (columns, pipes): lit on the left third, shade on the right. */
export function rampCyl(ids: Ids, ramp: Ramp, haze = 0, vertical = true): Paint {
  return vertical
    ? linear(ids, [[0.08, hz(ramp.lit, haze)], [0.45, hz(ramp.base, haze)], [1, hz(ramp.shade, haze)]], 0, 0, 1, 0)
    : linear(ids, [[0.08, hz(ramp.lit, haze)], [0.45, hz(ramp.base, haze)], [1, hz(ramp.shade, haze)]], 0, 0, 0, 1);
}
/** Vertical ramp: lit at the top → shade at the bottom. */
export function rampV(ids: Ids, ramp: Ramp, haze = 0): Paint {
  return linear(ids, [[0, hz(ramp.lit, haze)], [0.55, hz(ramp.base, haze)], [1, hz(ramp.shade, haze)]], 0, 0, 0, 1);
}

/** A Gaussian blur filter (the only filter primitive the lint allows). */
export function blur(ids: Ids, std: number): Paint {
  const id = ids.next("bl");
  return {
    def: el("filter", { id, x: "-50%", y: "-50%", width: "200%", height: "200%" }, el("feGaussianBlur", { stdDeviation: std })),
    ref: `url(#${id})`,
  };
}

/** AO at the foot of a shape: the same path filled with {{shadow}} at 30 % fading to 0 over `fade` above `yBase`. */
export function aoFoot(ids: Ids, d: string, yBase: number, fade: number, finish: Finish): { defs: string; body: string } {
  if (!finish.ao || fade <= 0) return { defs: "", body: "" };
  const g = linear(ids, [[0, "shadow", 0], [1, "shadow", 0.3]], 0, yBase - fade, 0, yBase, true);
  return { defs: g.def, body: el("path", { d, fill: g.ref }) };
}

/** Edges of a closed polygon that face the key light (outward normal pointing up or left). */
export function litEdges(points: readonly Pt[]): Pt[][] {
  const out: Pt[][] = [];
  const m = points.length;
  // orientation: signed area (y down): positive ⇒ clockwise on screen
  let area = 0;
  for (let i = 0; i < m; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % m];
    area += x1 * y2 - x2 * y1;
  }
  const cw = area > 0;
  for (let i = 0; i < m; i++) {
    const a = points[i];
    const b = points[(i + 1) % m];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    // outward normal for a clockwise (screen) polygon is (dy, -dx)
    const nx = cw ? dy : -dy;
    const ny = cw ? -dx : dx;
    const len = Math.hypot(nx, ny) || 1;
    // light direction: from the upper left → the lit side's normal points toward (-1, -1)
    if ((-nx - ny) / len > 0.35) out.push([a, b]);
  }
  return out;
}

/** A rim-light stroke along the lit edges of a polygon. */
export function rimStroke(points: readonly Pt[], tok: Tok, finish: Finish, width = 1.5, opacity = 0.85): string {
  if (!finish.rim) return "";
  const edges = litEdges(points);
  if (edges.length === 0) return "";
  const d = edges.map((e) => poly(e, false)).join("");
  return el("path", {
    d,
    fill: "none",
    stroke: tk(hz(tok, finish.haze)),
    "stroke-width": width,
    "stroke-linecap": "round",
    "stroke-opacity": opacity,
  });
}

/** A soft contact / cast shadow: a blurred ellipse in {{shadow}} at 30 %. */
export function contactShadow(ids: Ids, cx: number, cy: number, rx: number, ry: number, std = 4): { defs: string; body: string } {
  const b = blur(ids, std);
  return {
    defs: b.def,
    body: el("ellipse", { cx, cy, rx, ry, fill: tk("shadow"), "fill-opacity": 0.3, filter: b.ref }),
  };
}

/** Painterly edge jitter: perturb a polygon's vertices by up to `amt` px (seeded by the caller's rng values). */
export function jitterPoly(points: readonly Pt[], amt: number, rand: () => number): Pt[] {
  return points.map(([x, y]) => [x + (rand() * 2 - 1) * amt, y + (rand() * 2 - 1) * amt] as const);
}
