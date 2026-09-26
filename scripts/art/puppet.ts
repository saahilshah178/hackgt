/**
 * scripts/art/puppet.ts — ≤ 8-part puppets (20 §5.5, §5.2 step 8; 02 §3b.5).
 *
 * Sources: a hero SVG assembled in its rest pose (`<g id="part-<name>" data-pivot="x,y" data-z="n"
 * [data-box="x y w h"]>`, multi-frame parts hold `<g id="f0">…<g id="fN">`), or a recipe of kit/hero parts. The build
 * packs every part frame into one sheet with nested viewports (frames of one part side by side, one row per part,
 * boxes on a 4-unit grid so `Texture.add` lands on whole texels at any k = n/4), writes `<name>.rest.svg` and a
 * `puppet` manifest entry; `<name>.anims.json` is validated against `PuppetAnim`.
 */
import { PuppetAnim } from "../../src/contracts/world";
import type { z } from "zod";
import { attrsOf, buildXml, childrenOf, parseXml, tagOf, type XNode } from "./svgx";

type Anim = z.infer<typeof PuppetAnim>;
export type Box = [number, number, number, number];

/** One frame of one part: SVG markup drawn in its own coordinate space, and the region that holds it. */
export interface FrameSpec {
  defs: string; // frame-local defs (ids already unique across the sheet)
  inner: string; // drawn markup
  vb: Box; // region in the frame's coordinates
}
export interface PartSpec {
  name: string;
  z: number;
  frames: FrameSpec[];
  /** the pivot point in the frame's coordinates (frame 0) */
  pivotLocal: [number, number];
  /** the pivot point in the rest pose (design units) */
  rest: [number, number];
}
export interface PackedPart {
  name: string;
  frames: number;
  rest: [number, number];
  pivot: [number, number];
  z: number;
  box: Box;
}
export interface PackedPuppet {
  sheet: string;
  sheetW: number;
  sheetH: number;
  parts: PackedPart[];
}

const up4 = (v: number) => Math.ceil(v / 4) * 4;
const r1 = (v: number) => Math.round(v * 10) / 10;
export class PuppetError extends Error {}

/** Pack parts into one sheet (one row per part, frames contiguous). `sharedDefs` goes in the sheet's root <defs>. */
export function packPuppet(parts: PartSpec[], sharedDefs = ""): PackedPuppet {
  if (parts.length === 0 || parts.length > 8) throw new PuppetError(`a puppet has 1–8 parts, got ${parts.length}`);
  let y = 0;
  let sheetW = 0;
  let body = "";
  const packed: PackedPart[] = [];
  for (const p of parts) {
    if (p.frames.length > 8) throw new PuppetError(`part ${p.name}: ≤ 8 frames`);
    const f0 = p.frames[0];
    const cw = up4(Math.max(...p.frames.map((f) => f.vb[2])));
    const ch = up4(Math.max(...p.frames.map((f) => f.vb[3])));
    p.frames.forEach((f, i) => {
      body += `<svg x="${i * cw}" y="${y}" width="${cw}" height="${ch}" viewBox="${r1(f.vb[0])} ${r1(f.vb[1])} ${cw} ${ch}">${f.defs ? `<defs>${f.defs}</defs>` : ""}${f.inner}</svg>`;
    });
    packed.push({
      name: p.name,
      frames: p.frames.length,
      rest: [r1(p.rest[0]), r1(p.rest[1])],
      pivot: [Math.round(((p.pivotLocal[0] - f0.vb[0]) / cw) * 10000) / 10000, Math.round(((p.pivotLocal[1] - f0.vb[1]) / ch) * 10000) / 10000],
      z: p.z,
      box: [0, y, cw, ch],
    });
    sheetW = Math.max(sheetW, cw * p.frames.length);
    y += ch + 4;
  }
  const sheetH = Math.max(4, y - 4);
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sheetW} ${sheetH}" width="${sheetW}" height="${sheetH}">${sharedDefs ? `<defs>${sharedDefs}</defs>` : ""}${body}</svg>`;
  for (const p of packed) if (p.pivot[0] < 0 || p.pivot[0] > 1 || p.pivot[1] < 0 || p.pivot[1] > 1) throw new PuppetError(`part ${p.name}: its pivot lies outside its box`);
  return { sheet, sheetW, sheetH, parts: packed };
}

/** The assembled rest pose from packed parts (recipe puppets): each part's frame 0 placed at rest − pivot·box. */
export function restFromParts(parts: PartSpec[], w: number, h: number, sharedDefs = ""): string {
  const sorted = [...parts].map((p, i) => ({ p, i })).sort((a, b) => a.p.z - b.p.z || a.i - b.i);
  let body = "";
  for (const { p } of sorted) {
    const f = p.frames[0];
    const ox = p.rest[0] - (p.pivotLocal[0] - f.vb[0]);
    const oy = p.rest[1] - (p.pivotLocal[1] - f.vb[1]);
    body += `<svg x="${r1(ox)}" y="${r1(oy)}" width="${r1(f.vb[2])}" height="${r1(f.vb[3])}" viewBox="${f.vb.map(r1).join(" ")}">${f.defs ? `<defs>${f.defs}</defs>` : ""}${f.inner}</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${sharedDefs ? `<defs>${sharedDefs}</defs>` : ""}${body}</svg>`;
}

export interface HeroPuppetParse {
  parts: PartSpec[];
  sharedDefs: string;
  rest: string; // the rest pose: frames other than f0 removed
  needsMeasure: string[]; // part names without data-box (measured by the caller in Chromium)
}

/** Parse a hero puppet SVG (tokens resolved, engraving done). Boxes come from data-box or `measured`. */
export function parseHeroPuppet(svg: string, key: string, measured: Record<string, Box> = {}): HeroPuppetParse {
  const doc = parseXml(svg);
  const root = doc.find((n) => tagOf(n) === "svg");
  if (!root) throw new PuppetError(`${key}: no <svg> root`);
  let sharedDefs = "";
  const parts: PartSpec[] = [];
  const needsMeasure: string[] = [];
  const restChildren: XNode[] = [];
  for (const child of childrenOf(root)) {
    const tag = tagOf(child);
    if (!tag) {
      restChildren.push(child);
      continue;
    }
    if (tag === "defs") {
      sharedDefs += buildXml(childrenOf(child));
      restChildren.push(child);
      continue;
    }
    const a = attrsOf(child);
    if (a.id?.startsWith("anchor-")) continue; // anchor markers: read by extractAnchors, stripped from the outputs
    if (tag !== "g" || !a.id?.startsWith("part-")) throw new PuppetError(`${key}: every drawn element must sit inside a <g id="part-<name>"> (found <${tag}${a.id ? ` id="${a.id}"` : ""}>)`);
    const name = a.id.slice(5);
    const pv = (a["data-pivot"] ?? "").split(/[\s,]+/).map(Number);
    if (pv.length !== 2 || pv.some((v) => !Number.isFinite(v))) throw new PuppetError(`${key}: part ${name} needs data-pivot="x,y" (absolute viewBox units)`);
    const zv = Number(a["data-z"] ?? 0);
    let box: Box | null = null;
    if (a["data-box"]) {
      const b = a["data-box"].split(/[\s,]+/).map(Number);
      if (b.length !== 4 || b.some((v) => !Number.isFinite(v))) throw new PuppetError(`${key}: part ${name} data-box must be "x y w h"`);
      box = [b[0] - 2, b[1] - 2, b[2] + 4, b[3] + 4];
    } else if (measured[name]) {
      const m = measured[name];
      box = [Math.floor(m[0]) - 2, Math.floor(m[1]) - 2, Math.ceil(m[2]) + 4, Math.ceil(m[3]) + 4];
    } else needsMeasure.push(name);
    const kids = childrenOf(child);
    const frameKids = kids.filter((k) => tagOf(k) === "g" && /^f\d+$/.test(attrsOf(k).id ?? ""));
    const frames = frameKids.length > 0 ? frameKids.sort((x, y) => Number(attrsOf(x).id!.slice(1)) - Number(attrsOf(y).id!.slice(1))) : [null];
    const wrapAttrs = { ...a };
    delete wrapAttrs.id;
    for (const k of Object.keys(wrapAttrs)) if (k.startsWith("data-")) delete wrapAttrs[k];
    const wrap = (content: XNode[]) => buildXml([{ g: content, ":@": wrapAttrs }]);
    const b = box ?? [0, 0, 4, 4];
    parts.push({
      name,
      z: Number.isFinite(zv) ? zv : 0,
      frames: frames.map((f) => ({ defs: "", inner: wrap(f === null ? kids : [f]), vb: b })),
      pivotLocal: [pv[0], pv[1]],
      rest: [pv[0], pv[1]],
    });
    // rest pose: only frame 0 of multi-frame parts
    restChildren.push({ g: frameKids.length > 0 ? kids.filter((k) => !(tagOf(k) === "g" && /^f[1-9]\d*$/.test(attrsOf(k).id ?? ""))) : kids, ":@": wrapAttrs });
  }
  if (parts.length === 0) throw new PuppetError(`${key}: no <g id="part-…"> parts`);
  const rest = buildXml([{ svg: restChildren, ":@": attrsOf(root) }]);
  return { parts, sharedDefs, rest, needsMeasure };
}

/** Validate a puppet's animations: schema, known parts, frame indices, required ids per group. */
export function validateAnims(raw: unknown, parts: readonly { name: string; frames: number }[], group: string, key: string): Anim[] {
  const list = PuppetAnim.array().min(1).max(12).safeParse(raw);
  if (!list.success) throw new PuppetError(`${key}: anims: ${list.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const names = new Map(parts.map((p) => [p.name, p.frames]));
  const ids = new Set<string>();
  for (const a of list.data) {
    if (ids.has(a.id)) throw new PuppetError(`${key}: duplicate anim "${a.id}"`);
    ids.add(a.id);
    for (const t of a.tracks) {
      if (!names.has(t.part)) throw new PuppetError(`${key}: anim ${a.id} animates unknown part "${t.part}" (parts: ${[...names.keys()].join(", ")})`);
      if (t.prop === "frame") {
        const n = names.get(t.part)!;
        for (const [, v] of t.keys) if (v < 0 || v >= n) throw new PuppetError(`${key}: anim ${a.id} frame ${v} of part ${t.part} (has ${n})`);
      }
      if (!t.wave && t.keys.length === 0) throw new PuppetError(`${key}: anim ${a.id} track ${t.part}.${t.prop} has neither wave nor keys`);
    }
  }
  const required = group === "companion" ? ["idle", "talk", "cue"] : group === "npc" ? ["idle", "talk"] : ["idle"];
  for (const r of required) if (!ids.has(r)) throw new PuppetError(`${key}: a ${group} puppet needs anim "${r}" (has ${[...ids].join(", ")})`);
  return list.data;
}
