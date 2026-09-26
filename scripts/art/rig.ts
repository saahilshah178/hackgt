/**
 * scripts/art/rig.ts — one Kenney rig, one raster path (20 §5.5, 02 §3b). Run by `art:build --ns shared`.
 *
 * Per character of art/shared/characters/characters.json:
 * 1. read its body's `Vector/character_<body>.svg` from the Kenney zip (`unzip -p`, nothing extracted into the repo)
 *    and strip `filter="url(#Filter_1)"` (dark offset artefacts);
 * 2. recolour with the body's group-scoped fill map (bodies.json): (symbol group, source hex) → role → the character's
 *    token; an unmapped (group, fill) fails;
 * 3. repack the used frames (protagonists 28 = 7 × 4, NPCs 12 = 6 × 2) with nested viewports — only the instances
 *    whose origin lies in the frame's cell, in document order;
 * 4. bake the painterly finish (the risk-table mitigation of 20 §7.5): per-limb key-light rim (upper left, warm) and
 *    cool shade (lower right), plus a soft outline glow around the figure — so the flat toon cels read as lit;
 * 5. render in Playwright's Chromium at deviceScaleFactor 2 (192 × 256 texels per frame) and write the Phaser JSON hash;
 * 6. compute the 7 RigAnchors per frame from the vector's own transforms (ANCHOR_OFFSETS for face and back);
 * 7. copy Kenney's untinted `_sheetHD.png` + `.xml` as the `load.atlasXML` fallback.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { resolveTokenExpr, toHex, type PaletteTokens } from "../../src/game/art/kit/tokens";
import { renderSvg } from "./render";
import { attrsOf, buildXml, childrenOf, IDENTITY, multiply, parseTransform, parseXml, rotationDeg, tagOf, type Matrix, type XNode } from "./svgx";

export const FRAME_W = 96;
export const FRAME_H = 128;
export const DISPLAY_SCALE = 1.75; // 1× frame px → design units (96 → 168 = 1 H)
export const TEXEL_SCALE = 2; // PNG texels per 1× px
export const PROTAGONIST_POSES = [
  "idle", "walk0", "walk1", "walk2", "walk3", "walk4", "walk5", "walk6", "walk7", "run0", "run1", "run2", "jump", "fall",
  "duck", "hang", "climb0", "climb1", "interact", "switch0", "switch1", "talk", "think", "show", "hold", "cheer0", "cheer1", "back",
] as const;
export const NPC_POSES = ["idle", "walk0", "walk2", "walk4", "walk6", "talk", "think", "show", "interact", "cheer0", "duck", "hold"] as const;
export const GRID = { protagonist: { cols: 7, rows: 4 }, npc: { cols: 6, rows: 2 } } as const;
/** Fixed offsets (1× frame px, in the instance's rotated frame) from the computed head/torso points (20 §5.5). */
export const ANCHOR_OFFSETS = { face: [0, -20], back: [0, -18] } as const;
export const RIG_ANCHORS = ["head", "face", "torso", "back", "hand_r", "hand_l", "feet"] as const;
const HEAD_FAMILY = new Set(["head", "headFocus", "headShock", "headBack"]);
const TORSO_FAMILY = new Set(["body", "bodyBack"]);

// ── data files ─────────────────────────────────────────────────────────────────────────────────────────────
const Hex = z.string().regex(/^#[0-9A-F]{6}$/);
export const BodiesFile = z.strictObject({
  zip: z.string(),
  note: z.string().optional(),
  bodies: z.record(
    z.string(),
    z.strictObject({ dir: z.string(), stem: z.string(), fills: z.array(z.strictObject({ group: z.string(), map: z.record(Hex, z.string()) })) }),
  ),
});
export type BodiesFile = z.infer<typeof BodiesFile>;
export const CharactersFile = z.strictObject({
  note: z.string().optional(),
  characters: z.array(
    z.strictObject({
      id: z.string().regex(/^[a-z][a-z0-9_]*$/),
      body: z.enum(["female_adventurer", "female_person", "male_adventurer", "male_person"]),
      ns: z.string(),
      frames: z.enum(["protagonist", "npc"]),
      roles: z.record(z.string(), z.string()).default({}),
    }),
  ),
});
export type CharacterDef = z.infer<typeof CharactersFile>["characters"][number];

// ── zip ────────────────────────────────────────────────────────────────────────────────────────────────────
export function readZipEntry(zip: string, entry: string): Buffer {
  return execFileSync("unzip", ["-p", zip, entry], { maxBuffer: 64 * 1024 * 1024 });
}
export interface BodySources {
  vector: string;
  sheetXml: string; // 1× SubTextures (coordinates match the vector's viewBox)
  hdPng: Buffer;
  hdXml: string;
  stem: string;
}
export function loadBody(root: string, bodies: BodiesFile, body: string): BodySources {
  const def = bodies.bodies[body];
  if (!def) throw new Error(`bodies.json has no body "${body}"`);
  const zip = path.join(root, bodies.zip);
  if (!fs.existsSync(zip)) throw new Error(`${bodies.zip} is missing (02 §1: download kenney toon-characters into .data/asset-scratch/)`);
  const base = `${def.dir}/`;
  return {
    vector: readZipEntry(zip, `${base}Vector/${def.stem}.svg`).toString("utf8"),
    sheetXml: readZipEntry(zip, `${base}Tilesheet/${def.stem}_sheet.xml`).toString("utf8"),
    hdPng: readZipEntry(zip, `${base}Tilesheet/${def.stem}_sheetHD.png`),
    hdXml: readZipEntry(zip, `${base}Tilesheet/${def.stem}_sheetHD.xml`).toString("utf8"),
    stem: def.stem,
  };
}
export function parseSheetXml(xml: string): Map<string, { x: number; y: number; w: number; h: number }> {
  const out = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const m of xml.matchAll(/<SubTexture\s+name="([^"]+)"\s+x="(\d+)"\s+y="(\d+)"\s+width="(\d+)"\s+height="(\d+)"/g)) out.set(m[1], { x: +m[2], y: +m[3], w: +m[4], h: +m[5] });
  return out;
}

// ── analysis ───────────────────────────────────────────────────────────────────────────────────────────────
export interface Instance {
  family: string; // head, headBack, body, hand, arm, leg, Symbol_1, shadow, …
  matrix: Matrix;
  order: number; // document order inside #poses (later = painted in front)
  xml: string; // the instance group, serialised (without its transform; see `matrix`)
}
export interface RigAnalysis {
  defs: XNode[]; // <defs> children (gradients, the filter, the symbol groups)
  instances: Instance[];
}
function familyOf(href: string): string {
  return href.replace(/^#/, "").replace(/_0_Layer[\s\S]*$/, "");
}
export function analyseRig(vector: string): RigAnalysis {
  const doc = parseXml(vector);
  const root = doc.find((n) => tagOf(n) === "svg");
  if (!root) throw new Error("the Kenney vector has no <svg> root");
  const defsNode = childrenOf(root).find((n) => tagOf(n) === "defs");
  const defs = defsNode ? childrenOf(defsNode) : [];
  let posesNode: XNode | null = null;
  let posesMatrix: Matrix = IDENTITY;
  const find = (nodes: XNode[], m: Matrix) => {
    for (const n of nodes) {
      const t = tagOf(n);
      if (!t) continue;
      const a = attrsOf(n);
      const mm = a.transform ? multiply(m, parseTransform(a.transform)) : m;
      if (a.id === "poses") {
        posesNode = n;
        posesMatrix = mm;
        return;
      }
      find(childrenOf(n), mm);
      if (posesNode) return;
    }
  };
  find(childrenOf(root), IDENTITY);
  if (!posesNode) throw new Error('the Kenney vector has no <g id="poses">');
  const instances: Instance[] = [];
  childrenOf(posesNode).forEach((inst, order) => {
    if (tagOf(inst) !== "g") return;
    const a = attrsOf(inst);
    const m = a.transform ? multiply(posesMatrix, parseTransform(a.transform)) : posesMatrix;
    const hrefs: string[] = [];
    const collect = (nodes: XNode[]) => {
      for (const n of nodes) {
        if (tagOf(n) === "use") hrefs.push(attrsOf(n)["xlink:href"] ?? attrsOf(n).href ?? "");
        collect(childrenOf(n));
      }
    };
    collect(childrenOf(inst));
    if (hrefs.length === 0) return;
    const inner = { ...a };
    delete inner.transform;
    delete inner.id;
    instances.push({ family: familyOf(hrefs[0]), matrix: m, order, xml: buildXml([{ g: childrenOf(inst), ":@": inner }]) });
  });
  return { defs, instances };
}

/** Instances whose origin lies in the frame rect, in document order. */
export function instancesIn(rig: RigAnalysis, rect: { x: number; y: number; w: number; h: number }): Instance[] {
  return rig.instances.filter((i) => i.matrix[4] >= rect.x && i.matrix[4] < rect.x + rect.w && i.matrix[5] >= rect.y && i.matrix[5] < rect.y + rect.h).sort((a, b) => a.order - b.order);
}

export interface AnchorPoint {
  name: (typeof RIG_ANCHORS)[number];
  x: number;
  y: number;
  rot: number;
}
export interface FrameAnchors {
  pose: string;
  facing: "front" | "back";
  points: AnchorPoint[];
}
const round1 = (v: number) => Math.round(v * 10) / 10;
function offset(m: Matrix, [dx, dy]: readonly [number, number]): [number, number] {
  const r = (rotationDeg(m) * Math.PI) / 180;
  return [m[4] + Math.cos(r) * dx - Math.sin(r) * dy, m[5] + Math.sin(r) * dx + Math.cos(r) * dy];
}
/** The 7 RigAnchors of one frame, in display units from the frame's top-left (20 §5.5 table). */
export function frameAnchors(rig: RigAnalysis, pose: string, rect: { x: number; y: number; w: number; h: number }): FrameAnchors {
  const inst = instancesIn(rig, rect);
  const heads = inst.filter((i) => HEAD_FAMILY.has(i.family));
  const torsos = inst.filter((i) => TORSO_FAMILY.has(i.family));
  const hands = inst.filter((i) => i.family === "hand");
  if (heads.length !== 1 || torsos.length !== 1 || hands.length !== 2) throw new Error(`frame ${pose}: expected 1 head, 1 torso, 2 hands; got ${heads.length}, ${torsos.length}, ${hands.length}`);
  const [head, torso] = [heads[0], torsos[0]];
  const [handB, handF] = hands; // document order: the later one is painted in front
  const loc = ([x, y]: readonly [number, number]): [number, number] => [round1((x - rect.x) * DISPLAY_SCALE), round1((y - rect.y) * DISPLAY_SCALE)];
  const rot = (m: Matrix) => round1(rotationDeg(m));
  const pt = (name: AnchorPoint["name"], xy: readonly [number, number], r: number): AnchorPoint => {
    const [x, y] = loc(xy);
    return { name, x, y, rot: r === 0 ? 0 : r };
  };
  const points: AnchorPoint[] = [
    pt("head", [head.matrix[4], head.matrix[5]], rot(head.matrix)),
    pt("face", offset(head.matrix, ANCHOR_OFFSETS.face), rot(head.matrix)),
    pt("torso", [torso.matrix[4], torso.matrix[5]], rot(torso.matrix)),
    pt("back", offset(torso.matrix, ANCHOR_OFFSETS.back), rot(torso.matrix)),
    pt("hand_r", [handF.matrix[4], handF.matrix[5]], rot(handF.matrix)),
    pt("hand_l", [handB.matrix[4], handB.matrix[5]], rot(handB.matrix)),
    pt("feet", [torso.matrix[4], rect.y + 127], 0),
  ];
  const facing = head.family === "headBack" || torso.family === "bodyBack" ? "back" : "front";
  return { pose, facing, points };
}

// ── recolour ───────────────────────────────────────────────────────────────────────────────────────────────
/** The token expression a character uses for a role: override → char.<id>.<role> → char.<role> (shared defaults). */
export function roleToken(ch: CharacterDef, role: string, palette: PaletteTokens): string {
  if (ch.roles[role]) return ch.roles[role];
  const own = `char.${ch.id}.${role}`;
  if (palette[own] !== undefined) return own;
  const shared = `char.${role}`;
  if (palette[shared] !== undefined) return shared;
  throw new Error(`character ${ch.id}: no colour for role "${role}" (add ${own} to palettes/${ch.ns}.ts, or a roles override in characters.json)`);
}

/** Recolour the <defs> symbol groups. Returns the serialised defs (filter removed) or throws listing unmapped fills. */
export function recolourDefs(rig: RigAnalysis, rules: BodiesFile["bodies"][string]["fills"], colourOf: (role: string) => string): string {
  const compiled = rules.map((r) => ({ re: new RegExp(r.group), map: r.map }));
  const unmapped = new Set<string>();
  const recolour = (node: XNode, gid: string): XNode => {
    const t = tagOf(node);
    if (!t) return node;
    const a = { ...attrsOf(node) };
    if (a.fill && /^#[0-9A-Fa-f]{6}$/.test(a.fill)) {
      const hex = a.fill.toUpperCase();
      const rule = compiled.find((c) => c.re.test(gid) && c.map[hex]);
      if (!rule) unmapped.add(`${gid} ${hex}`);
      else a.fill = colourOf(rule.map[hex]);
    }
    return { [t]: childrenOf(node).map((c) => recolour(c, gid)), ":@": a };
  };
  const out: XNode[] = [];
  for (const d of rig.defs) {
    const t = tagOf(d);
    if (t === "filter") continue; // Filter_1: stripped (02 §3b.2)
    const gid = attrsOf(d).id ?? "";
    out.push(t === "g" ? recolour(d, gid) : d);
  }
  if (unmapped.size) throw new Error(`unmapped (group, fill) pairs — extend art/shared/characters/bodies.json:\n  ${[...unmapped].sort().join("\n  ")}`);
  return buildXml(out);
}

// ── the painterly finish (render-only filters; the PNG is not an SVG asset, so the lint does not apply) ──────
export interface FinishColours {
  key: string; // warm key light (upper left)
  shade: string; // cool shade (lower right)
  glow: string; // soft outline glow
}
function finishDefs(c: FinishColours): string {
  return (
    `<filter id="rig_limb" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">` +
    `<feOffset in="SourceAlpha" dx="1.3" dy="1.5" result="o1"/><feComposite in="SourceAlpha" in2="o1" operator="out" result="e1"/>` +
    `<feGaussianBlur in="e1" stdDeviation="0.7" result="b1"/><feFlood flood-color="${c.key}" flood-opacity="0.62"/>` +
    `<feComposite in2="b1" operator="in"/><feComposite in2="SourceAlpha" operator="in" result="rim"/>` +
    `<feOffset in="SourceAlpha" dx="-1.8" dy="-2" result="o2"/><feComposite in="SourceAlpha" in2="o2" operator="out" result="e2"/>` +
    `<feGaussianBlur in="e2" stdDeviation="1.2" result="b2"/><feFlood flood-color="${c.shade}" flood-opacity="0.42"/>` +
    `<feComposite in2="b2" operator="in"/><feComposite in2="SourceAlpha" operator="in" result="sh"/>` +
    `<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="sh"/><feMergeNode in="rim"/></feMerge></filter>` +
    `<filter id="rig_frame" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="g1"/><feFlood flood-color="${c.glow}" flood-opacity="0.34"/>` +
    `<feComposite in2="g1" operator="in" result="glow"/>` +
    `<feGaussianBlur in="SourceAlpha" stdDeviation="0.8" result="g2"/><feFlood flood-color="${c.glow}" flood-opacity="0.22"/>` +
    `<feComposite in2="g2" operator="in" result="glow2"/>` +
    `<feMerge><feMergeNode in="glow"/><feMergeNode in="glow2"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    // the key-light tint: soft-light gradient (warm upper left → neutral → cool lower right), masked to the figure
    `<filter id="rig_white" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>` +
    `<linearGradient id="rig_key" x1="0.1" y1="0.15" x2="0.9" y2="0.95"><stop offset="0" stop-color="${c.key}"/><stop offset="0.5" stop-color="#808080"/><stop offset="1" stop-color="${c.shade}"/></linearGradient>`
  );
}

export interface RigSheet {
  svg: string; // 1× units
  w: number;
  h: number;
  poses: string[];
  cols: number;
  anchors: FrameAnchors[];
}
/** The repacked, recoloured, finished render sheet for one character (1× units; render at TEXEL_SCALE). */
export function buildRigSheet(rig: RigAnalysis, sheet: Map<string, { x: number; y: number; w: number; h: number }>, recolouredDefs: string, kind: "protagonist" | "npc", colours: FinishColours): RigSheet {
  const poses = kind === "protagonist" ? [...PROTAGONIST_POSES] : [...NPC_POSES];
  const { cols, rows } = GRID[kind];
  let body = "";
  const anchors: FrameAnchors[] = [];
  poses.forEach((pose, i) => {
    const rect = sheet.get(pose);
    if (!rect) throw new Error(`the Kenney sheet XML has no frame "${pose}"`);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const inst = instancesIn(rig, rect);
    const limbs = inst
      .map((it) => {
        const m = it.matrix.map((v) => Math.round(v * 10000) / 10000).join(" ");
        const plain = it.family === "shadow"; // the contact shadow is not a limb
        const g = `<g transform="matrix(${m})">${it.xml}</g>`;
        return plain ? g : `<g filter="url(#rig_limb)">${g}</g>`;
      })
      .join("");
    const figure = inst
      .filter((it) => it.family !== "shadow")
      .map((it) => `<g transform="matrix(${it.matrix.map((v) => Math.round(v * 10000) / 10000).join(" ")})">${it.xml}</g>`)
      .join("");
    const mask = `<mask id="rig_m${i}" maskUnits="userSpaceOnUse" x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}"><g filter="url(#rig_white)">${figure}</g></mask>`;
    const tint = `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="url(#rig_key)" mask="url(#rig_m${i})" style="mix-blend-mode:soft-light" opacity="0.85"/>`;
    body += `<svg x="${col * FRAME_W}" y="${row * FRAME_H}" width="${FRAME_W}" height="${FRAME_H}" viewBox="${rect.x} ${rect.y} ${rect.w} ${rect.h}">${mask}<g filter="url(#rig_frame)"><g style="isolation:isolate">${limbs}${tint}</g></g></svg>`;
    anchors.push(frameAnchors(rig, pose, rect));
  });
  const w = cols * FRAME_W;
  const h = rows * FRAME_H;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${recolouredDefs}${finishDefs(colours)}</defs>${body}</svg>`;
  return { svg, w, h, poses, cols, anchors };
}

/** Phaser JSON-hash atlas for a rendered sheet (frame names = pose names). */
export function atlasJson(poses: readonly string[], cols: number, image: string): string {
  const fw = FRAME_W * TEXEL_SCALE;
  const fh = FRAME_H * TEXEL_SCALE;
  const frames: Record<string, unknown> = {};
  poses.forEach((p, i) => {
    const x = (i % cols) * fw;
    const y = Math.floor(i / cols) * fh;
    frames[p] = { frame: { x, y, w: fw, h: fh }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: fw, h: fh }, sourceSize: { w: fw, h: fh } };
  });
  const rows = Math.ceil(poses.length / cols);
  return `${JSON.stringify({ frames, meta: { app: "quest-forge art:build (scripts/art/rig.ts)", image, format: "RGBA8888", size: { w: cols * fw, h: rows * fh }, scale: "1" } }, null, 1)}\n`;
}

export async function renderRig(sheet: RigSheet): Promise<Buffer> {
  return renderSvg(sheet.svg, sheet.w, sheet.h, TEXEL_SCALE);
}

/** Resolve every role the body's fill map uses to a hex colour for this character. */
export function roleColours(ch: CharacterDef, rules: BodiesFile["bodies"][string]["fills"], palette: PaletteTokens): (role: string) => string {
  const cache = new Map<string, string>();
  const roles = new Set(rules.flatMap((r) => Object.values(r.map)));
  for (const role of roles) cache.set(role, toHex(resolveTokenExpr(roleToken(ch, role, palette), palette)));
  return (role) => {
    const c = cache.get(role);
    if (!c) throw new Error(`role ${role} was not resolved`);
    return c;
  };
}
