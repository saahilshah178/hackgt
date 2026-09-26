/**
 * scripts/art/svgx.ts — SVG plumbing for the art build (20 §5.2 steps 6–7): XML parsing, 2D transforms, root and
 * pivot reading, anchor extraction (`<* id="anchor-<name>">` through the transform stack), stripping and minifying.
 */
import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";

// ── XML ────────────────────────────────────────────────────────────────────────────────────────────────────
export type XNode = Record<string, unknown>; // preserveOrder node: { tag: XNode[], ":@"?: attrs } | { "#text": string }
export const ATTR = ":@";
const PARSE_OPTS = { preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: "", allowBooleanAttributes: true, parseAttributeValue: false, trimValues: false, processEntities: false } as const;
const parser = new XMLParser(PARSE_OPTS);
const builder = new XMLBuilder({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: "", suppressEmptyNode: true, processEntities: false });

export function parseXml(xml: string): XNode[] {
  return parser.parse(xml) as XNode[];
}
export function buildXml(nodes: XNode[]): string {
  return builder.build(nodes) as string;
}
/** null when well-formed, else a message with the line. */
export function xmlError(xml: string): string | null {
  const v = XMLValidator.validate(xml, { allowBooleanAttributes: true });
  return v === true ? null : `${v.err.msg} (line ${v.err.line})`;
}
export function tagOf(node: XNode): string | null {
  for (const k of Object.keys(node)) if (k !== ATTR && k !== "#text") return k;
  return null;
}
export function attrsOf(node: XNode): Record<string, string> {
  return (node[ATTR] as Record<string, string> | undefined) ?? {};
}
export function childrenOf(node: XNode): XNode[] {
  const t = tagOf(node);
  return t ? ((node[t] as XNode[]) ?? []) : [];
}
/** Depth-first walk with a transform stack. `fn` returns false to skip the subtree. */
export function walk(nodes: XNode[], fn: (node: XNode, tag: string, m: Matrix, depth: number) => boolean | void, m: Matrix = IDENTITY, depth = 0): void {
  for (const node of nodes) {
    const tag = tagOf(node);
    if (!tag || tag.startsWith("?")) continue;
    const a = attrsOf(node);
    const local = a.transform ? multiply(m, parseTransform(a.transform)) : m;
    // nested <svg x y> establishes a new origin (viewBox ignored here: generators and heroes do not nest)
    const inner = tag === "svg" && depth > 0 && (a.x || a.y) ? multiply(local, [1, 0, 0, 1, Number(a.x ?? 0), Number(a.y ?? 0)]) : local;
    if (fn(node, tag, inner, depth) === false) continue;
    walk(childrenOf(node), fn, inner, depth + 1);
  }
}

// ── transforms ─────────────────────────────────────────────────────────────────────────────────────────────
/** [a, b, c, d, e, f] as in SVG matrix(a b c d e f): x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = readonly [number, number, number, number, number, number];
export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
export function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
/** Rotation of a matrix in degrees (atan2(b, a)). */
export function rotationDeg(m: Matrix): number {
  return (Math.atan2(m[1], m[0]) * 180) / Math.PI;
}
export function parseTransform(s: string): Matrix {
  let m: Matrix = IDENTITY;
  for (const f of s.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const v = f[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let t: Matrix = IDENTITY;
    if (f[1] === "matrix" && v.length >= 6) t = [v[0], v[1], v[2], v[3], v[4], v[5]];
    else if (f[1] === "translate") t = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
    else if (f[1] === "scale") t = [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0];
    else if (f[1] === "rotate") {
      const a = ((v[0] ?? 0) * Math.PI) / 180;
      const [cx, cy] = [v[1] ?? 0, v[2] ?? 0];
      const r: Matrix = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
      t = multiply(multiply([1, 0, 0, 1, cx, cy], r), [1, 0, 0, 1, -cx, -cy]);
    } else if (f[1] === "skewX") t = [1, 0, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
    else if (f[1] === "skewY") t = [1, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
    m = multiply(m, t);
  }
  return m;
}

// ── root, pivot, anchors ───────────────────────────────────────────────────────────────────────────────────
export interface RootInfo {
  w: number;
  h: number;
  viewBox: [number, number, number, number];
  pivot: [number, number] | null;
}
export function rootInfo(svg: string): RootInfo {
  const open = svg.match(/<svg\b[^>]*>/);
  if (!open) throw new Error("no <svg> root");
  const attr = (name: string) => open[0].match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;
  const vb = (attr("viewBox") ?? "").split(/[\s,]+/).filter(Boolean).map(Number);
  const w = Number(attr("width") ?? vb[2]);
  const h = Number(attr("height") ?? vb[3]);
  if (vb.length !== 4 || !Number.isFinite(w) || !Number.isFinite(h)) throw new Error('the root <svg> needs viewBox="0 0 W H" and width/height');
  const pv = attr("data-pivot");
  let pivot: [number, number] | null = null;
  if (pv) {
    const [fx, fy] = pv.split(/[\s,]+/).map(Number);
    if (!(fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1)) throw new Error(`data-pivot="${pv}" must be fractions "fx,fy" in [0, 1]`);
    pivot = [fx, fy];
  }
  return { w, h, viewBox: [vb[0], vb[1], vb[2], vb[3]], pivot };
}

/** Anchors from `<* id="anchor-<name>" cx cy>` (or x/y), in design units through every ancestor transform. */
export function extractAnchors(svg: string): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  walk(parseXml(svg), (node, _tag, m) => {
    const a = attrsOf(node);
    const id = a.id;
    if (id && id.startsWith("anchor-")) {
      const x = Number(a.cx ?? a.x ?? 0);
      const y = Number(a.cy ?? a.y ?? 0);
      const [px, py] = apply(m, x, y);
      out[id.slice(7)] = [Math.round(px * 10) / 10, Math.round(py * 10) / 10];
    }
  });
  return out;
}
/** Removes anchor markers and every data-* attribute (after they were read). */
export function stripMarkers(svg: string): string {
  return svg
    .replace(/<([a-zA-Z]+)\b[^>]*\bid="anchor-[^"]*"[^>]*\/>/g, "")
    .replace(/<([a-zA-Z]+)\b[^>]*\bid="anchor-[^"]*"[^>]*>\s*<\/\1>/g, "")
    .replace(/\s+data-[\w-]+="[^"]*"/g, "");
}

// ── minify ─────────────────────────────────────────────────────────────────────────────────────────────────
const GEOM_ATTRS = new Set(["d", "points", "transform", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "viewBox", "fx", "fy", "stroke-width", "stdDeviation", "font-size"]);
const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
function round1(s: string): string {
  return s.replace(NUM, (m) => {
    const v = Math.round(Number(m) * 10) / 10;
    return (v === 0 ? 0 : v).toString();
  });
}
/** Collapse whitespace, drop comments/prolog, round geometry to 1 decimal. Deterministic. */
export function minify(svg: string): string {
  let s = svg
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/\s([\w:-]+)="([^"]*)"/g, (m, k: string, v: string) => (GEOM_ATTRS.has(k) ? ` ${k}="${round1(v).replace(/\s+/g, " ").trim()}"` : m));
  s = s.replace(/\s\/>/g, "/>").replace(/\s>/g, ">");
  return s;
}

/** Rewrites the root <svg> so it carries exactly xmlns, viewBox, width, height (design size). */
export function normaliseRoot(svg: string, w: number, h: number, viewBox: [number, number, number, number]): string {
  return svg.replace(/<svg\b[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(" ")}" width="${w}" height="${h}">`);
}
