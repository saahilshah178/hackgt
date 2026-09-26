/**
 * src/game/art/kit/svg.ts — string helpers every generator uses: 1-decimal numbers, token paint, id factories,
 * polygon paths, document wrappers and id re-prefixing (compose/scatter merge children without collisions).
 */
import type { KitResult, Tok } from "./types";

/** A number at 1-decimal precision, never "-0". */
export function n(v: number): string {
  const r = Math.round(v * 10) / 10;
  return (r === 0 ? 0 : r).toString();
}
/** Token paint: {{stone.lit}}. */
export function tk(tok: Tok): string {
  return `{{${tok}}}`;
}
/** A token with haze applied (no-op at 0): stone.lit|haze:0.4. */
export function hz(tok: Tok, haze: number): Tok {
  return haze > 0 ? `${tok}|haze:${Math.round(Math.min(1, haze) * 100) / 100}` : tok;
}

type AttrVal = string | number | null | undefined | false;
/** Serialise attributes in the given order; null/undefined/false are skipped; numbers go through n(). */
export function at(a: Record<string, AttrVal>): string {
  let s = "";
  for (const [k, v] of Object.entries(a)) {
    if (v === null || v === undefined || v === false) continue;
    s += ` ${k}="${typeof v === "number" ? n(v) : v}"`;
  }
  return s;
}
export function el(tag: string, a: Record<string, AttrVal>, children?: string): string {
  return children === undefined ? `<${tag}${at(a)}/>` : `<${tag}${at(a)}>${children}</${tag}>`;
}

export type Pt = readonly [number, number];
/** Closed polygon path data. */
export function poly(points: readonly Pt[], close = true): string {
  if (points.length === 0) return "";
  let d = `M${n(points[0][0])} ${n(points[0][1])}`;
  for (let i = 1; i < points.length; i++) d += `L${n(points[i][0])} ${n(points[i][1])}`;
  return close ? `${d}Z` : d;
}
/** Rect as path data (so many rects merge into one <path>). */
export function rectD(x: number, y: number, w: number, h: number): string {
  return `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`;
}
/** Circle as path data (two arcs). */
export function circleD(cx: number, cy: number, r: number): string {
  return `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`;
}
/** Ellipse as path data. */
export function ellipseD(cx: number, cy: number, rx: number, ry: number): string {
  return `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0Z`;
}
/** Rounded rect path data. */
export function roundRectD(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rr === 0) return rectD(x, y, w, h);
  return (
    `M${n(x + rr)} ${n(y)}h${n(w - 2 * rr)}a${n(rr)} ${n(rr)} 0 0 1 ${n(rr)} ${n(rr)}v${n(h - 2 * rr)}` +
    `a${n(rr)} ${n(rr)} 0 0 1 ${n(-rr)} ${n(rr)}h${n(-(w - 2 * rr))}a${n(rr)} ${n(rr)} 0 0 1 ${n(-rr)} ${n(-rr)}` +
    `v${n(-(h - 2 * rr))}a${n(rr)} ${n(rr)} 0 0 1 ${n(rr)} ${n(-rr)}Z`
  );
}
/** Smooth closed blob through points (Catmull-Rom → cubic Bézier). */
export function blobD(points: readonly Pt[]): string {
  const m = points.length;
  if (m < 3) return poly(points);
  let d = `M${n(points[0][0])} ${n(points[0][1])}`;
  for (let i = 0; i < m; i++) {
    const p0 = points[(i - 1 + m) % m];
    const p1 = points[i];
    const p2 = points[(i + 1) % m];
    const p3 = points[(i + 2) % m];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return `${d}Z`;
}
/** Smooth open curve through points. */
export function curveD(points: readonly Pt[]): string {
  const m = points.length;
  if (m < 3) return poly(points, false);
  let d = `M${n(points[0][0])} ${n(points[0][1])}`;
  for (let i = 0; i < m - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(m - 1, i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return d;
}

/** Id factory: every gradient, clipPath, filter, pattern id gets the generator prefix. */
export class Ids {
  private i = 0;
  constructor(readonly prefix: string) {}
  next(tag: string): string {
    return `${this.prefix}${tag}${this.i++}`;
  }
}

/** The root document every generator returns (no data-pivot: the pivot travels in KitResult). */
export function svgDoc(w: number, h: number, defs: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" width="${n(w)}" height="${n(h)}">${
    defs ? `<defs>${defs}</defs>` : ""
  }${body}</svg>`;
}

/** Build a KitResult with the common defaults. */
export function result(
  w: number,
  h: number,
  defs: string,
  body: string,
  opts: Partial<Pick<KitResult, "pivot" | "anchors" | "tileWidth" | "engrave" | "extras">> = {},
): KitResult {
  return {
    svg: svgDoc(w, h, defs, body),
    w: Math.round(w * 10) / 10,
    h: Math.round(h * 10) / 10,
    pivot: opts.pivot ?? [0.5, 1],
    anchors: opts.anchors ?? {},
    tileWidth: opts.tileWidth ?? null,
    engrave: opts.engrave ?? [],
    ...(opts.extras ? { extras: opts.extras } : {}),
  };
}

const ID_ATTR = /\bid="([^"]+)"/g;
/** Marker ids the build reads (anchors, puppet parts and frames) are never renamed. */
const MARKER_ID = /^(anchor-|part-|f\d+$)/;
/** Re-prefix every id in an SVG string (and its url(#…) / href="#…" references) with `prefix`. */
export function reprefixIds(svg: string, prefix: string): string {
  const ids = new Set<string>();
  for (const m of svg.matchAll(ID_ATTR)) if (!MARKER_ID.test(m[1])) ids.add(m[1]);
  if (ids.size === 0) return svg;
  const map = new Map<string, string>();
  let i = 0;
  for (const id of ids) map.set(id, `${prefix}${i++}`);
  return svg
    .replace(ID_ATTR, (_, id: string) => `id="${map.get(id) ?? id}"`)
    .replace(/url\(#([^)]+)\)/g, (m, id: string) => (map.has(id) ? `url(#${map.get(id)})` : m))
    .replace(/(href)="#([^"]+)"/g, (m, attr: string, id: string) => (map.has(id) ? `${attr}="#${map.get(id)}"` : m));
}

/** Split a generator document into its <defs> content and body content. */
export function splitDoc(svg: string): { defs: string; body: string } {
  const open = svg.indexOf(">") + 1;
  const close = svg.lastIndexOf("</svg>");
  let inner = svg.slice(open, close);
  let defs = "";
  const dm = inner.match(/^<defs>([\s\S]*?)<\/defs>/);
  if (dm) {
    defs = dm[1];
    inner = inner.slice(dm[0].length);
  }
  return { defs, body: inner };
}

/** Rewrite every {{token}} in a fragment to add haze (compose/scatter finish over children). */
export function hazeTokens(svg: string, haze: number): string {
  if (haze <= 0) return svg;
  return svg.replace(/\{\{([^}]+)\}\}/g, (_, t: string) => `{{${hz(t, haze)}}}`);
}

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
