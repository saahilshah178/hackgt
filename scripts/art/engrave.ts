/**
 * scripts/art/engrave.ts — build-time text-to-path (20 §5.2 step 4, 02 §3e). Build-only: PDF-generated games never
 * engrave (their labels are DOM).
 *
 * Faces: `caps` = Cinzel (wordmarks, stencils, Roman numerals; renders lowercase as small caps; has no π — never
 * maths), `serif` / `serif_italic` = EB Garamond latin + greek (π, ·, −, ×, °). Markup: `^{…}` superscript (0.62 size,
 * raised 0.38 em), `_{…}` subscript (0.62 size, lowered 0.12 em); write `sin^{-1}` (U+207B is in neither font).
 * A glyph missing from every font of the face fails and lists the code points. ≤ 8 KB of engraving per asset.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype, { type Font } from "opentype.js";
import type { EngraveFace, EngraveReq } from "../../src/game/art/kit/types";

export type { EngraveFace };
export interface EngraveOpts {
  face: EngraveFace;
  size: number;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  letterSpacing: number;
  precision: 1;
}
export interface EngraveResult {
  d: string;
  width: number;
  missing: string[]; // "U+03B8 θ"
}
export class EngraveError extends Error {}
export const MAX_ENGRAVE_BYTES = 8 * 1024;

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FONT_FILES: Record<EngraveFace, string[]> = {
  caps: ["@fontsource/cinzel/files/cinzel-latin-400-normal.woff", "@fontsource/cinzel/files/cinzel-latin-ext-400-normal.woff"],
  serif: [
    "@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff",
    "@fontsource/eb-garamond/files/eb-garamond-greek-400-normal.woff",
    "@fontsource/eb-garamond/files/eb-garamond-latin-ext-400-normal.woff",
  ],
  serif_italic: [
    "@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff",
    "@fontsource/eb-garamond/files/eb-garamond-greek-400-italic.woff",
    "@fontsource/eb-garamond/files/eb-garamond-latin-ext-400-italic.woff",
  ],
};
const fontCache = new Map<string, Font>();
function loadFont(rel: string): Font | null {
  const hit = fontCache.get(rel);
  if (hit) return hit;
  const file = path.join(ROOT, "node_modules", rel);
  if (!fs.existsSync(file)) return null;
  const b = fs.readFileSync(file);
  const font = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
  fontCache.set(rel, font);
  return font;
}
function stack(face: EngraveFace): Font[] {
  const fonts = FONT_FILES[face].map(loadFont).filter((f): f is Font => f !== null);
  if (fonts.length === 0) throw new EngraveError(`no font files for face "${face}" (pnpm install @fontsource/cinzel @fontsource/eb-garamond)`);
  return fonts;
}

interface Run {
  text: string;
  level: -1 | 0 | 1;
}
/** Split `a^{b}_{c}` markup into runs. */
export function parseMarkup(text: string): Run[] {
  const runs: Run[] = [];
  let i = 0;
  let buf = "";
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if ((two === "^{" || two === "_{") && text.indexOf("}", i) > i) {
      if (buf) runs.push({ text: buf, level: 0 });
      buf = "";
      const end = text.indexOf("}", i);
      runs.push({ text: text.slice(i + 2, end), level: two === "^{" ? 1 : -1 });
      i = end + 1;
      continue;
    }
    buf += text[i];
    i++;
  }
  if (buf) runs.push({ text: buf, level: 0 });
  return runs;
}

interface Placed {
  font: Font;
  ch: string;
  x: number;
  y: number;
  size: number;
}

/** Engrave one string into SVG path data (1-decimal precision). */
export function engrave(text: string, o: EngraveOpts): EngraveResult {
  const fonts = stack(o.face);
  const missing: string[] = [];
  const placed: Placed[] = [];
  let x = 0;
  let prev: { font: Font; ch: string } | null = null;
  for (const run of parseMarkup(text)) {
    const size = run.level === 0 ? o.size : o.size * 0.62;
    const dy = run.level === 1 ? -0.38 * o.size : run.level === -1 ? 0.12 * o.size : 0;
    for (const ch of Array.from(run.text)) {
      const font = fonts.find((f) => f.charToGlyphIndex(ch) > 0) ?? null;
      if (!font) {
        if (ch.trim() === "") {
          x += o.size * 0.25 + o.letterSpacing;
          prev = null;
          continue;
        }
        missing.push(`U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")} ${ch}`);
        continue;
      }
      const glyph = font.charToGlyph(ch);
      if (prev && prev.font === font) x += (font.getKerningValue(prev.font.charToGlyph(prev.ch), glyph) * size) / font.unitsPerEm;
      placed.push({ font, ch, x, y: dy, size });
      x += (glyph.advanceWidth * size) / font.unitsPerEm + o.letterSpacing;
      prev = { font, ch };
    }
  }
  const width = Math.max(0, x - o.letterSpacing);
  const x0 = o.anchor === "middle" ? o.x - width / 2 : o.anchor === "end" ? o.x - width : o.x;
  let d = "";
  if (missing.length === 0) {
    for (const p of placed) d += p.font.charToGlyph(p.ch).getPath(x0 + p.x, o.y + p.y, p.size).toPathData({ decimalPlaces: 1, flipY: false });
  }
  return { d, width, missing: [...new Set(missing)] };
}

const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A generator's engrave request as the `<text data-engrave>` markup the pass converts. */
export function requestToText(r: EngraveReq): string {
  const rot = r.rotate ? ` transform="rotate(${r.rotate} ${r.x.toFixed(1)} ${r.y.toFixed(1)})"` : "";
  return `<text data-engrave="${r.face}" x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" font-size="${r.size.toFixed(1)}" text-anchor="${r.anchor}" fill="{{${r.fill}}}"${rot}>${escape(r.text)}</text>`;
}
/** Insert generator engrave requests before the closing </svg> (they draw on top). */
export function injectRequests(svg: string, reqs: EngraveReq[]): string {
  if (reqs.length === 0) return svg;
  const i = svg.lastIndexOf("</svg>");
  return svg.slice(0, i) + reqs.map(requestToText).join("") + svg.slice(i);
}

/**
 * Replace every `<text data-engrave="face" …>…</text>` with a `<path>`; keeps paint and transform attributes.
 * Throws EngraveError on a missing glyph or when the engraving exceeds 8 KB. Plain `<text>` is left for the lint.
 */
export function engraveSvg(svg: string, key = "?"): { svg: string; engraved: string[]; bytes: number } {
  const engraved: string[] = [];
  let bytes = 0;
  const out = svg.replace(/<text\b([^>]*\bdata-engrave="(caps|serif|serif_italic)"[^>]*)>([\s\S]*?)<\/text>/g, (_m, attrs: string, face: EngraveFace, body: string) => {
    if (/<[a-z]/i.test(body)) throw new EngraveError(`${key}: <text data-engrave> may not contain child elements (use ^{} and _{} markup)`);
    const text = unescape(body).trim();
    const get = (n: string) => attrs.match(new RegExp(`\\s${n}="([^"]*)"`))?.[1] ?? null;
    const anchorAttr = get("text-anchor");
    const res = engrave(text, {
      face,
      size: Number(get("font-size") ?? 16),
      x: Number(get("x") ?? 0),
      y: Number(get("y") ?? 0),
      anchor: anchorAttr === "middle" || anchorAttr === "end" ? anchorAttr : "start",
      letterSpacing: Number(get("letter-spacing") ?? 0),
      precision: 1,
    });
    if (res.missing.length) throw new EngraveError(`${key}: "${text}" (${face}) has glyphs in no font: ${res.missing.join(", ")}`);
    engraved.push(text);
    bytes += res.d.length;
    const keep = attrs
      .replace(/\s(data-engrave|x|y|font-size|font-family|font-style|font-weight|text-anchor|letter-spacing|dominant-baseline)="[^"]*"/g, "")
      .trim();
    return `<path d="${res.d}"${keep ? ` ${keep}` : ""}/>`;
  });
  if (bytes > MAX_ENGRAVE_BYTES) throw new EngraveError(`${key}: ${(bytes / 1024).toFixed(1)} KB of engraving > 8 KB (shorten it, shrink it, or make it a DOM label)`);
  return { svg: out, engraved, bytes };
}
