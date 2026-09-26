/**
 * scripts/art/build.ts — the art build, in memory (20 §5.2 steps 1–12). `scripts/build-art.ts` is the CLI: it holds
 * the lock, writes (or, with --check, byte-compares) what `buildNamespace` returns.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { AssetManifest, type ManifestEntry } from "../../src/contracts/world";
import { fnv1a32, hash8, runKit, subSeed } from "../../src/game/art/kit/index";
import { expandRecipe, type PuppetRecipeOut } from "../../src/game/art/kit/recipes";
import { resolveTokens, type PaletteTokens } from "../../src/game/art/kit/tokens";
import { reprefixIds, splitDoc } from "../../src/game/art/kit/svg";
import type { KitResult } from "../../src/game/art/kit/types";
import { paletteTokensFor, tokenHex } from "../../src/game/art/palette";
import { engraveSvg, injectRequests } from "./engrave";
import { collectNamespace, defaultRasterScale, groupOfKey, outputPathOf, type ArtEntry, type PartSource, type SourcedEntry } from "./fragments";
import { formatIssues, lintOutput, lintSource } from "./lint";
import { packPuppet, parseHeroPuppet, restFromParts, validateAnims, type Box, type PartSpec } from "./puppet";
import { measureGroups } from "./render";
import { analyseRig, atlasJson, BodiesFile, buildRigSheet, CharactersFile, DISPLAY_SCALE, FRAME_H, FRAME_W, loadBody, parseSheetXml, recolourDefs, renderRig, roleColours, TEXEL_SCALE } from "./rig";
import { extractAnchors, minify, normaliseRoot, rootInfo, stripMarkers } from "./svgx";
import { budgetIssues, textureBytes, zoneVram } from "./vram";

export const PUBLIC_DIR = "public/assets/expedition";
export const INDEX_DIR = "src/world/asset-index";
export const NAMESPACES = ["shared", "orrery_terraces", "living_gate", "archive_of_voices"] as const;
/** Groups of `shared` that load only when a world references them (every other shared entry is always resident). */
export const ON_DEMAND_SHARED_GROUPS = new Set(["char", "companion", "npc", "costume", "vista"]);

export interface BuildOpts {
  root: string;
  kitOnly: boolean;
  log: (line: string) => void;
  /** manifest of `shared` (for the biomes' `all` VRAM); read from disk when absent */
  sharedManifest?: AssetManifest | null;
}
export interface OutFile {
  rel: string; // repo-relative
  data: Buffer;
}
export interface NsResult {
  ns: string;
  manifest: AssetManifest;
  files: OutFile[];
  warnings: string[];
  report: string[];
  /** the rig was not rebuilt (zip missing): committed atlas files must be kept as they are */
  rigKept: boolean;
}
export class BuildError extends Error {}

/** "<key>: <message>", with zod issues flattened to "path: message". */
export function describeError(key: string, e: unknown): string {
  const issues = (e as { issues?: Array<{ path: PropertyKey[]; message: string }> }).issues;
  const msg = Array.isArray(issues) ? issues.map((i) => `${i.path.map(String).join(".") || "(params)"}: ${i.message}`).join("; ") : (e as Error).message;
  return msg.startsWith(key) ? msg : `${key}: ${msg}`;
}

const sha1 = (b: Buffer | string) => crypto.createHash("sha1").update(b).digest("hex");
const r1 = (v: number) => Math.round(v * 10) / 10;
const ID_OK = /^[a-z][a-z0-9_]{0,47}$/;

interface Processed {
  svg: string;
  w: number;
  h: number;
  viewBox: [number, number, number, number];
  pivot: [number, number] | null;
  anchors: Record<string, [number, number]>;
  engraved: string[];
}

/** Steps 3–7 for one SVG document: raw-hex lint, id prefix, tokens, engraving, anchors/pivot, strip, minify, lint. */
function processSvg(raw: string, key: string, palette: PaletteTokens, opts: { layer: boolean; prefix: string; extraAnchors?: Record<string, [number, number]> }): Processed {
  const src = lintSource(raw);
  if (src.length) throw new BuildError(`${key}: ${formatIssues(src)}`);
  const prefixed = reprefixIds(raw, opts.prefix);
  const { svg: tokened, problems } = resolveTokens(prefixed, palette);
  if (problems.length) throw new BuildError(`${key}: ${[...new Set(problems)].join("; ")}`);
  const { svg: engraved, engraved: strings } = engraveSvg(tokened, key);
  const info = rootInfo(engraved);
  const anchors = { ...(opts.extraAnchors ?? {}), ...extractAnchors(engraved) };
  let out = minify(stripMarkers(engraved));
  out = normaliseRoot(out, r1(info.w), r1(info.h), info.viewBox);
  const issues = lintOutput(out, { layer: opts.layer });
  if (issues.length) throw new BuildError(`${key}: ${formatIssues(issues)}`);
  return { svg: out, w: info.w, h: info.h, viewBox: info.viewBox, pivot: info.pivot, anchors, engraved: strings };
}

function anchorList(a: Record<string, [number, number]>, key: string, warnings: string[]): Array<{ name: string; x: number; y: number }> {
  return Object.entries(a)
    .filter(([name]) => {
      if (ID_OK.test(name)) return true;
      warnings.push(`${key}: anchor "${name}" is not Id-legal; dropped`);
      return false;
    })
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    .map(([name, [x, y]]) => ({ name, x: r1(x), y: r1(y) }));
}

function kitSource(entry: ArtEntry): string {
  return entry.gen ? `kit:${entry.gen}` : entry.recipe ? `kit:${entry.recipe.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}` : "kit:compose";
}

interface EntryOut {
  entries: ManifestEntry[];
  files: OutFile[];
  heroFiles: string[];
}

// ── svg entries ────────────────────────────────────────────────────────────────────────────────────────────
function buildSvgEntry(se: SourcedEntry, palette: PaletteTokens, warnings: string[]): EntryOut {
  const e = se.entry;
  const key = e.key;
  const group = groupOfKey(key);
  const layer = group === "layer";
  const prefix = `k${hash8(key)}_`;
  const out: EntryOut = { entries: [], files: [], heroFiles: [] };
  const seed = e.seed ?? fnv1a32(key);
  const emit = (k: string, p: Processed, source: string, kit: KitResult | null, entrySeed: number | null) => {
    const file = outputPathOf(k);
    const tile = e.tileWidth ?? kit?.tileWidth ?? null;
    const tileWidth = tile !== null && Number.isInteger(tile) && tile >= 64 && tile <= 2048 ? tile : null;
    if (tile !== null && tileWidth === null) warnings.push(`${k}: tileWidth ${tile} is outside 64..2048 (whole-texture repeat instead)`);
    const width = Math.max(1, Math.round(p.w));
    const height = Math.max(1, Math.round(p.h));
    out.entries.push({
      kind: "svg",
      key: k,
      zone: e.zone,
      source,
      sha1: sha1(p.svg),
      legacyId: e.legacyId,
      file,
      width,
      height,
      rasterScale: e.rasterScale ?? defaultRasterScale(k, e.gen, "svg", width, height),
      tileWidth,
      pivot: e.pivot ?? kit?.pivot ?? p.pivot ?? [0.5, 1],
      anchors: anchorList(p.anchors, k, warnings),
      scroll: e.scroll,
      seed: entrySeed,
      engraved: p.engraved.slice(0, 16),
    });
    out.files.push({ rel: `${PUBLIC_DIR}/${file}`, data: Buffer.from(p.svg) });
  };
  if (e.file) {
    const abs = path.join(se.dir, e.file);
    if (!fs.existsSync(abs)) throw new BuildError(`${key}: hero file ${path.relative(process.cwd(), abs)} is missing`);
    const p = processSvg(fs.readFileSync(abs, "utf8"), key, palette, { layer, prefix });
    emit(key, p, "hero", null, null);
    out.heroFiles.push(abs);
    return out;
  }
  let kit: KitResult;
  if (e.gen) kit = runKit(e.gen, e.params, seed);
  else if (e.recipe) {
    const r = expandRecipe(e.recipe, e.args);
    if (r.kind !== "svg") throw new BuildError(`${key}: recipe ${e.recipe} makes a puppet; set "kind": "puppet"`);
    kit = runKit(r.gen, r.params, seed);
  } else throw new BuildError(`${key}: an svg entry needs file, gen or recipe`);
  const doOne = (k: string, res: KitResult) => {
    const p = processSvg(injectRequests(res.svg, res.engrave), k, palette, { layer, prefix: `k${hash8(k)}_`, extraAnchors: res.anchors });
    emit(k, p, kitSource(e), res, seed);
  };
  doOne(key, kit);
  for (const [suffix, extra] of Object.entries(kit.extras ?? {})) {
    if (key.split(".").length >= 4) {
      warnings.push(`${key}: extra texture "${suffix}" skipped (the key already has a variant segment)`);
      continue;
    }
    doOne(`${key}.${suffix}`, extra);
  }
  return out;
}

// ── puppets ────────────────────────────────────────────────────────────────────────────────────────────────
function frameFromSvg(raw: string, key: string, palette: PaletteTokens, prefix: string, kitAnchors?: Record<string, [number, number]>): { spec: Omit<PartSpec, "name" | "z" | "rest" | "pivotLocal">; w: number; h: number } {
  const p = processSvg(raw, key, palette, { layer: false, prefix, extraAnchors: kitAnchors });
  const { defs, body } = splitDoc(p.svg);
  const vb: Box = [p.viewBox[0] - 2, p.viewBox[1] - 2, p.viewBox[2] + 4, p.viewBox[3] + 4];
  return { spec: { frames: [{ defs, inner: body, vb }] }, w: p.viewBox[2], h: p.viewBox[3] };
}

async function buildPuppetEntry(se: SourcedEntry, palette: PaletteTokens, warnings: string[]): Promise<EntryOut> {
  const e = se.entry;
  const key = e.key;
  const group = groupOfKey(key);
  const out: EntryOut = { entries: [], files: [], heroFiles: [] };
  const baseSeed = e.seed ?? fnv1a32(key);
  let parts: PartSpec[];
  let sharedDefs = "";
  let restSvg: string;
  let size: [number, number];
  let pivot: [number, number] = e.pivot ?? [0.5, 1];
  let anchors: Record<string, [number, number]> = {};
  let animsRaw: unknown;
  let source = "kit:puppet";
  const loadAnims = (ref: string | unknown[] | null, fallbackFile: string | null, fallback: unknown): unknown => {
    if (Array.isArray(ref)) return ref;
    const file = typeof ref === "string" ? path.join(se.dir, ref) : fallbackFile;
    if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (typeof ref === "string") throw new BuildError(`${key}: anims file ${ref} is missing`);
    return fallback;
  };

  if (e.file) {
    // a hero puppet: one SVG in its rest pose
    source = "hero";
    const abs = path.join(se.dir, e.file);
    if (!fs.existsSync(abs)) throw new BuildError(`${key}: hero file ${e.file} is missing`);
    out.heroFiles.push(abs);
    const raw = fs.readFileSync(abs, "utf8");
    const src = lintSource(raw);
    if (src.length) throw new BuildError(`${key}: ${formatIssues(src)}`);
    const { svg: tokened, problems } = resolveTokens(reprefixIds(raw, `k${hash8(key)}_`), palette);
    if (problems.length) throw new BuildError(`${key}: ${problems.join("; ")}`);
    const { svg } = engraveSvg(tokened, key);
    const info = rootInfo(svg);
    anchors = extractAnchors(svg);
    let parsed = parseHeroPuppet(svg, key);
    if (parsed.needsMeasure.length) {
      const m = await measureGroups(svg, parsed.needsMeasure.map((n) => `part-${n}`));
      const byName: Record<string, Box> = {};
      for (const n of parsed.needsMeasure) if (m[`part-${n}`]) byName[n] = m[`part-${n}`];
      parsed = parseHeroPuppet(svg, key, byName);
    }
    parts = parsed.parts;
    sharedDefs = parsed.sharedDefs;
    restSvg = normaliseRoot(minify(stripMarkers(parsed.rest)), r1(info.w), r1(info.h), info.viewBox);
    size = [info.w, info.h];
    pivot = e.pivot ?? info.pivot ?? [0.5, 1];
    animsRaw = loadAnims(e.anims, abs.replace(/\.svg$/, ".anims.json"), null);
    if (animsRaw === null) throw new BuildError(`${key}: puppet anims missing (${path.basename(abs).replace(/\.svg$/, ".anims.json")} beside the SVG)`);
  } else {
    // a recipe puppet: parts from kit generators, named recipes or hero files
    let recipeParts: Array<{ name: string; z: number; pivot: [number, number]; rest: [number, number]; from: PartSource[] }>;
    let recipeAnims: unknown = null;
    if (e.parts) {
      recipeParts = e.parts.map((p) => ({ name: p.name, z: p.z, pivot: p.pivot, rest: p.rest, from: Array.isArray(p.from) ? p.from : [p.from] }));
      size = e.size!;
    } else {
      const r = expandRecipe(e.recipe!, e.args);
      if (r.kind !== "puppet") throw new BuildError(`${key}: recipe ${e.recipe} makes an svg; use kind "svg"`);
      const pr = r as PuppetRecipeOut;
      recipeParts = pr.parts.map((p) => ({ name: p.name, z: p.z, pivot: p.pivot, rest: p.rest, from: p.from.map((f) => ({ gen: f.gen, params: f.params, seed: f.seed })) }));
      size = pr.size;
      pivot = e.pivot ?? pr.pivot;
      recipeAnims = pr.anims;
    }
    source = e.recipe ? kitSource(e) : "kit:puppet";
    parts = recipeParts.map((rp, pi) => {
      const frames = rp.from.map((src, fi) => {
        const prefix = `k${hash8(key)}_p${pi}f${fi}_`;
        if ("file" in src) {
          const abs = path.join(se.dir, src.file);
          if (!fs.existsSync(abs)) throw new BuildError(`${key}: part ${rp.name} hero file ${src.file} is missing`);
          out.heroFiles.push(abs);
          return frameFromSvg(fs.readFileSync(abs, "utf8"), `${key}:${rp.name}`, palette, prefix);
        }
        const seed = src.seed ?? subSeed(baseSeed, `${rp.name}:${fi}`);
        let res: KitResult;
        if ("gen" in src) res = runKit(src.gen, src.params, seed);
        else {
          const r = expandRecipe(src.recipe, src.args);
          if (r.kind !== "svg") throw new BuildError(`${key}: part ${rp.name}: recipe ${src.recipe} is not an svg recipe`);
          res = runKit(r.gen, r.params, seed);
        }
        return frameFromSvg(injectRequests(res.svg, res.engrave), `${key}:${rp.name}`, palette, prefix, res.anchors);
      });
      const f0 = frames[0];
      return {
        name: rp.name,
        z: rp.z,
        frames: frames.map((f) => f.spec.frames[0]),
        pivotLocal: [rp.pivot[0] * f0.w, rp.pivot[1] * f0.h] as [number, number],
        rest: rp.rest,
      };
    });
    restSvg = minify(restFromParts(parts, size[0], size[1]));
    animsRaw = loadAnims(e.anims, null, recipeAnims);
    if (animsRaw === null) throw new BuildError(`${key}: a recipe puppet needs "anims" (inline or a file)`);
  }
  const packed = packPuppet(parts, sharedDefs);
  const sheet = minify(packed.sheet);
  for (const [label, svg] of [["sheet", sheet], ["rest", restSvg]] as const) {
    const issues = lintOutput(svg);
    if (issues.length) throw new BuildError(`${key} (${label}): ${formatIssues(issues)}`);
  }
  const anims = validateAnims(animsRaw, packed.parts, group, key);
  const file = outputPathOf(key);
  const restFile = outputPathOf(key, ".rest.svg");
  out.entries.push({
    kind: "puppet",
    key,
    zone: e.zone,
    source,
    sha1: sha1(sheet),
    legacyId: e.legacyId,
    file,
    restFile,
    width: Math.max(1, Math.round(size[0])),
    height: Math.max(1, Math.round(size[1])),
    rasterScale: e.rasterScale ?? 1.5,
    pivot,
    parts: packed.parts,
    anims,
    anchors: anchorList(anchors, key, warnings),
  });
  out.files.push({ rel: `${PUBLIC_DIR}/${file}`, data: Buffer.from(sheet) }, { rel: `${PUBLIC_DIR}/${restFile}`, data: Buffer.from(restSvg) });
  return out;
}

// ── the rig (shared) ───────────────────────────────────────────────────────────────────────────────────────
async function buildRig(root: string, log: (s: string) => void): Promise<{ entries: ManifestEntry[]; files: OutFile[] } | null> {
  const bodies = BodiesFile.parse(JSON.parse(fs.readFileSync(path.join(root, "art/shared/characters/bodies.json"), "utf8")));
  const chars = CharactersFile.parse(JSON.parse(fs.readFileSync(path.join(root, "art/shared/characters/characters.json"), "utf8")));
  if (!fs.existsSync(path.join(root, bodies.zip))) return null;
  const entries: ManifestEntry[] = [];
  const files: OutFile[] = [];
  const fallbacks = new Set<string>();
  for (const ch of chars.characters) {
    const src = loadBody(root, bodies, ch.body);
    const rig = analyseRig(src.vector);
    const palette = paletteTokensFor(ch.ns);
    const rules = bodies.bodies[ch.body].fills;
    const defs = recolourDefs(rig, rules, roleColours(ch, rules, palette));
    const sheet = buildRigSheet(rig, parseSheetXml(src.sheetXml), defs, ch.frames, {
      key: tokenHex(ch.ns, "char.key_light"),
      shade: tokenHex(ch.ns, "char.shade"),
      glow: tokenHex(ch.ns, "char.outline_glow"),
    });
    const png = await renderRig(sheet);
    const image = `shared/char/${ch.id}.png`;
    const framesFile = `shared/char/${ch.id}.json`;
    files.push({ rel: `${PUBLIC_DIR}/${image}`, data: png }, { rel: `${PUBLIC_DIR}/${framesFile}`, data: Buffer.from(atlasJson(sheet.poses, sheet.cols, `${ch.id}.png`)) });
    const fbImage = `shared/char/kenney/${src.stem}_sheetHD.png`;
    const fbXml = `shared/char/kenney/${src.stem}_sheetHD.xml`;
    if (!fallbacks.has(src.stem)) {
      fallbacks.add(src.stem);
      files.push({ rel: `${PUBLIC_DIR}/${fbImage}`, data: src.hdPng }, { rel: `${PUBLIC_DIR}/${fbXml}`, data: Buffer.from(src.hdXml) });
    }
    const hdNames = parseSheetXml(src.hdXml);
    entries.push({
      kind: "atlas",
      key: `shared.char.${ch.id}`,
      zone: "all",
      source: `rig:${ch.body}`,
      sha1: sha1(png),
      legacyId: null,
      body: ch.body,
      image,
      frames: framesFile,
      frameWidth: FRAME_W * TEXEL_SCALE,
      frameHeight: FRAME_H * TEXEL_SCALE,
      displayWidth: FRAME_W * DISPLAY_SCALE,
      displayHeight: FRAME_H * DISPLAY_SCALE,
      poses: sheet.poses,
      pivot: [0.5, 1],
      anchors: sheet.anchors,
      fallback: { image: fbImage, xml: fbXml, frameNames: Object.fromEntries(sheet.poses.map((p) => [p, hdNames.has(p) ? p : "idle"])) },
    } as ManifestEntry);
    log(`  rig ${ch.id} (${ch.body}, ${sheet.poses.length} frames) → ${image} ${(png.length / 1024).toFixed(0)} KB`);
  }
  return { entries, files };
}

// ── manifest, index, license ───────────────────────────────────────────────────────────────────────────────
const CONST_NAME = (ns: string) => `ASSET_INDEX_${ns.toUpperCase()}`;
export function indexSource(ns: string, entries: readonly ManifestEntry[]): string {
  const lines = entries.map((e) => {
    const anchors = e.kind === "atlas" || e.anchors.length === 0 ? "{}" : `{ ${e.anchors.map((a) => `${a.name}: [${a.x}, ${a.y}]`).join(", ")} }`;
    const w = e.kind === "atlas" ? e.displayWidth : e.width;
    const h = e.kind === "atlas" ? e.displayHeight : e.height;
    const extra = e.kind === "atlas" ? `, poses: ${JSON.stringify(e.poses)}` : e.kind === "puppet" ? `, anims: ${JSON.stringify(e.anims.map((a) => a.id))}` : "";
    return `  ${JSON.stringify(e.key)}: { ns: ${JSON.stringify(ns)}, kind: ${JSON.stringify(e.kind)}, width: ${w}, height: ${h}, anchors: ${anchors}, source: ${JSON.stringify(e.source)}, zone: ${JSON.stringify(e.zone)}${extra} },`;
  });
  return [
    `// GENERATED by scripts/build-art.ts (pnpm art:build --ns ${ns}). Do not edit by hand.`,
    `// ${entries.length} entries from public/assets/expedition/${ns}/manifest.json.`,
    `import type { AssetIndex } from "./types";`,
    ``,
    entries.length ? `export const ${CONST_NAME(ns)}: AssetIndex = {\n${lines.join("\n")}\n};` : `export const ${CONST_NAME(ns)}: AssetIndex = {};`,
    ``,
  ].join("\n");
}

const LICENSE = `Art in this directory is generated by \`pnpm art:build\` (scripts/build-art.ts) from art/**.

Character atlases (shared/char/*) are recoloured from Kenney "Toon Characters 1" (https://kenney.nl), CC0 1.0:
  "License (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/
   You may use these assets in personal and commercial projects. Credit (Kenney or www.kenney.nl) would be nice but is
   not mandatory." The untinted fallback sheets in shared/char/kenney/ are Kenney's originals under the same licence.

Engraved lettering is converted to vector paths at build time from:
  Cinzel (@fontsource/cinzel 5.3.0), Copyright 2020 The Cinzel Project Authors, SIL Open Font License 1.1
  EB Garamond (@fontsource/eb-garamond 5.3.0), Copyright 2017 The EB Garamond Project Authors, SIL Open Font License 1.1
  (https://openfontlicense.org). No font files are redistributed.
`;

function alwaysSharedBytes(shared: AssetManifest | null, biome: string, root: string): number {
  if (!shared) return 0;
  let chars: string[] = [];
  try {
    chars = CharactersFile.parse(JSON.parse(fs.readFileSync(path.join(root, "art/shared/characters/characters.json"), "utf8")))
      .characters.filter((c) => c.ns === biome)
      .map((c) => `shared.char.${c.id}`);
  } catch {
    chars = [];
  }
  return shared.entries
    .filter((e) => e.zone === "all" && (!ON_DEMAND_SHARED_GROUPS.has(groupOfKey(e.key)) || chars.includes(e.key)))
    .reduce((s, e) => s + textureBytes(e), 0);
}

/** Build one namespace in memory. Throws BuildError (with every problem) on failure. */
export async function buildNamespace(ns: string, opts: BuildOpts): Promise<NsResult> {
  const { root, log } = opts;
  const collected = collectNamespace(root, ns);
  // biome.json names the palette (a PDF-generated gen_<id> namespace borrows a biome's, 02 §6)
  const palette = paletteTokensFor(collected.settings.paletteId);
  const warnings: string[] = [];
  const errors: string[] = [];
  const entries: ManifestEntry[] = [];
  const files: OutFile[] = [];
  const heroFiles = new Set<string>();
  const keys = [...new Set([...collected.kit.keys(), ...collected.hero.keys()])].sort();
  for (const key of keys) {
    const heroSe = opts.kitOnly ? undefined : collected.hero.get(key);
    const kitSe = collected.kit.get(key)!;
    const run = async (se: SourcedEntry) => (se.entry.kind === "puppet" ? buildPuppetEntry(se, palette, warnings) : buildSvgEntry(se, palette, warnings));
    try {
      let res: EntryOut;
      if (heroSe) {
        try {
          res = await run(heroSe);
        } catch (e) {
          warnings.push(`${key}: hero failed (${(e as Error).message}); using its kit entry (fallback ladder step 1)`);
          res = await run(kitSe);
        }
      } else res = await run(kitSe);
      entries.push(...res.entries);
      files.push(...res.files);
      res.heroFiles.forEach((f) => heroFiles.add(f));
    } catch (e) {
      errors.push(describeError(key, e));
    }
  }
  let rigKept = false;
  if (ns === "shared") {
    const rig = await buildRig(root, log);
    if (rig) {
      entries.push(...rig.entries);
      files.push(...rig.files);
    } else {
      rigKept = true;
      const committed = path.join(root, PUBLIC_DIR, "shared/manifest.json");
      if (fs.existsSync(committed)) {
        const m = AssetManifest.parse(JSON.parse(fs.readFileSync(committed, "utf8")));
        entries.push(...m.entries.filter((x) => x.kind === "atlas"));
      }
      warnings.push("the Kenney zip is missing (.data/asset-scratch/toon-characters.zip): character atlases kept as committed");
    }
  }
  if (errors.length) throw new BuildError(`${ns}:\n  ${errors.join("\n  ")}`);
  entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const dup = entries.find((e, i) => i > 0 && entries[i - 1].key === e.key);
  if (dup) throw new BuildError(`${ns}: duplicate output key ${dup.key}`);
  const svgFiles = files.filter((f) => f.rel.endsWith(".svg"));
  const totalBytes = svgFiles.reduce((s, f) => s + f.data.length, 0);
  const gzipBytes = svgFiles.reduce((s, f) => s + zlib.gzipSync(f.data, { level: 9 }).length, 0);
  const shared = ns === "shared" ? null : (opts.sharedManifest ?? readManifest(root, "shared"));
  const { vram, swapPeakMb } = zoneVram(entries, collected.settings.zones, ns === "shared" ? 0 : alwaysSharedBytes(shared, ns, root));
  const manifest = AssetManifest.parse({
    namespace: ns,
    paletteId: collected.settings.paletteId,
    heroCap: collected.settings.heroCap,
    heroCount: Math.min(heroFiles.size, 40),
    entries,
    totalBytes,
    gzipBytes,
    vram,
    swapPeakMb,
  });
  const budget = budgetIssues({ ...manifest, heroCount: heroFiles.size });
  if (heroFiles.size > collected.settings.heroCap) budget.unshift(`${ns}: ${heroFiles.size} hero files > heroCap ${collected.settings.heroCap}`);
  if (budget.length) throw new BuildError(`${ns}: over budget (20 §5.8):\n  ${[...new Set(budget)].join("\n  ")}`);
  files.push(
    { rel: `${PUBLIC_DIR}/${ns}/manifest.json`, data: Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`) },
    { rel: `${PUBLIC_DIR}/${ns}/License.txt`, data: Buffer.from(LICENSE) },
    { rel: `${INDEX_DIR}/${ns}.generated.ts`, data: Buffer.from(indexSource(ns, entries)) },
  );
  const report = [
    `${ns}: ${entries.length} entries (${entries.filter((e) => e.kind === "svg").length} svg, ${entries.filter((e) => e.kind === "puppet").length} puppet, ${entries.filter((e) => e.kind === "atlas").length} atlas), heroes ${heroFiles.size}/${collected.settings.heroCap}`,
    `  SVG ${(totalBytes / 1024).toFixed(1)} KB raw / ${(gzipBytes / 1024).toFixed(1)} KB gzip; VRAM @dpr1.5 ${vram.map((v) => `${v.zone} ${v.mb} MB`).join(", ")}; swap peak ${swapPeakMb} MB`,
  ];
  return { ns, manifest, files, warnings, report, rigKept };
}

export function readManifest(root: string, ns: string): AssetManifest | null {
  const file = path.join(root, PUBLIC_DIR, ns, "manifest.json");
  if (!fs.existsSync(file)) return null;
  return AssetManifest.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

/** Contact-sheet support: a kit entry rendered at other seeds (token-resolved, engraved, minified SVG). */
export function kitVariants(root: string, ns: string, key: string, seeds: readonly number[]): Array<{ seed: number; svg: string }> {
  const collected = collectNamespace(root, ns);
  const se = collected.kit.get(key);
  if (!se || se.entry.kind !== "svg" || se.entry.file) return [];
  const palette = paletteTokensFor(collected.settings.paletteId);
  const e = se.entry;
  const out: Array<{ seed: number; svg: string }> = [];
  for (const seed of seeds) {
    let res: KitResult;
    if (e.gen) res = runKit(e.gen, e.params, seed);
    else if (e.recipe) {
      const r = expandRecipe(e.recipe, e.args);
      if (r.kind !== "svg") continue;
      res = runKit(r.gen, r.params, seed);
    } else continue;
    try {
      out.push({ seed, svg: processSvg(injectRequests(res.svg, res.engrave), key, palette, { layer: groupOfKey(key) === "layer", prefix: `k${hash8(key)}_s${seed}_` }).svg });
    } catch {
      /* a variant that fails lint is simply not shown */
    }
  }
  return out;
}
