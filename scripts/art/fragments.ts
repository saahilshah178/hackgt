/**
 * scripts/art/fragments.ts — art sources as per-owner fragments (20 §5.1, §5.2 step 1).
 *
 * `art/<ns>/biome.json` holds namespace settings (main); entries live in `art/<ns>/**\/*.kit.json` and
 * `art/<ns>/**\/*.hero.json`, each `{ "entries": ArtEntry[] }`. An entry has exactly one source:
 *   `file` (a hero SVG beside the fragment) · `gen` + `params` + `seed` (a kit generator) ·
 *   `recipe` + `args` + `seed` (a named composition, src/game/art/kit/recipes.ts) · `parts` (a puppet recipe).
 * Merge rule: a key appears in at most one *.kit.json and at most one *.hero.json; a hero entry needs a kit entry with
 * the same key (its fallback, ladder step 1); the hero wins unless --kit-only or it fails lint.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { AssetKey, PuppetAnim, ZoneTag } from "../../src/contracts/world";
import { Id } from "../../src/contracts/common";
import { KitNameZ } from "../../src/game/art/kit/types";

const Seed = z.number().int().min(0).max(4_294_967_295);
const Pivot = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);

/** One frame source of a puppet recipe part. */
export const PartSource = z.union([
  z.strictObject({ gen: KitNameZ, params: z.unknown().default({}), seed: Seed.nullable().default(null) }),
  z.strictObject({ recipe: z.string().min(1), args: z.unknown().default({}), seed: Seed.nullable().default(null) }),
  z.strictObject({ file: z.string().min(1) }), // a hero SVG (counts once against heroCap)
]);
export type PartSource = z.infer<typeof PartSource>;
export const PuppetRecipePart = z.strictObject({
  name: Id,
  from: z.union([PartSource, z.array(PartSource).min(1).max(8)]), // an array = one frame per source
  pivot: Pivot, // within the part's own box (fractions)
  z: z.number().int().min(-8).max(8).default(0),
  rest: z.tuple([z.number(), z.number()]), // where the pivot sits in the rest pose (design units)
});
export type PuppetRecipePart = z.infer<typeof PuppetRecipePart>;

export const ArtEntry = z
  .strictObject({
    key: AssetKey,
    kind: z.enum(["svg", "puppet"]).default("svg"),
    zone: ZoneTag.default("all"),
    rasterScale: z.number().min(0.25).max(2).nullable().default(null), // null: the group default (20 §5.1)
    tileWidth: z.number().int().min(64).max(2048).nullable().default(null), // null: the generator's
    pivot: Pivot.nullable().default(null), // null: data-pivot / the generator's
    scroll: z.number().min(0).max(1.6).nullable().default(null),
    legacyId: z.string().min(1).max(40).nullable().default(null),
    // sources (exactly one)
    file: z.string().min(1).nullable().default(null),
    gen: KitNameZ.nullable().default(null),
    params: z.unknown().default({}),
    seed: Seed.nullable().default(null),
    recipe: z.string().min(1).nullable().default(null),
    args: z.unknown().default({}),
    parts: z.array(PuppetRecipePart).min(1).max(8).nullable().default(null),
    size: z.tuple([z.number().min(1), z.number().min(1)]).nullable().default(null), // puppet recipe design size
    anims: z.union([z.string().min(1), z.array(PuppetAnim)]).nullable().default(null), // puppets: a file beside the fragment or inline
  })
  .superRefine((e, ctx) => {
    const n = [e.file, e.gen, e.recipe, e.parts].filter((v) => v !== null).length;
    if (n !== 1) ctx.addIssue({ code: "custom", message: `${e.key}: exactly one source (file | gen | recipe | parts), got ${n}` });
    if (e.parts && e.kind !== "puppet") ctx.addIssue({ code: "custom", message: `${e.key}: "parts" needs kind "puppet"` });
    if (e.parts && !e.size) ctx.addIssue({ code: "custom", message: `${e.key}: a puppet recipe needs "size": [w, h]` });
  });
export type ArtEntry = z.infer<typeof ArtEntry>;
export const ArtFragment = z.strictObject({ entries: z.array(ArtEntry).max(400) });

export const BiomeSettings = z.strictObject({ paletteId: Id, heroCap: z.number().int().min(0).max(40), zones: z.array(Id).max(8) });
export type BiomeSettings = z.infer<typeof BiomeSettings>;

export interface SourcedEntry {
  entry: ArtEntry;
  fragment: string; // repo-relative fragment path
  dir: string; // absolute directory of the fragment (hero files resolve against it)
  hero: boolean; // from a *.hero.json
}
export interface CollectedNamespace {
  ns: string;
  settings: BiomeSettings;
  kit: Map<string, SourcedEntry>;
  hero: Map<string, SourcedEntry>;
  fragments: string[];
}

function listFragments(dir: string): string[] {
  const out: string[] = [];
  const visit = (d: string) => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) visit(p);
      else if (/\.(kit|hero)\.json$/.test(name)) out.push(p);
    }
  };
  if (fs.existsSync(dir)) visit(dir);
  return out;
}

export class FragmentError extends Error {}

/** Read biome.json and every fragment of a namespace; applies the merge rule. Throws FragmentError on conflicts. */
export function collectNamespace(root: string, ns: string): CollectedNamespace {
  const base = path.join(root, "art", ns);
  const biomeFile = path.join(base, "biome.json");
  if (!fs.existsSync(biomeFile)) throw new FragmentError(`art/${ns}/biome.json is missing`);
  const settings = BiomeSettings.parse(JSON.parse(fs.readFileSync(biomeFile, "utf8")));
  const kit = new Map<string, SourcedEntry>();
  const hero = new Map<string, SourcedEntry>();
  const errors: string[] = [];
  const files = listFragments(base);
  for (const file of files) {
    const rel = path.relative(root, file);
    let parsed: z.infer<typeof ArtFragment>;
    try {
      parsed = ArtFragment.parse(JSON.parse(fs.readFileSync(file, "utf8")));
    } catch (e) {
      errors.push(`${rel}: ${e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : (e as Error).message}`);
      continue;
    }
    const isHero = file.endsWith(".hero.json");
    for (const entry of parsed.entries) {
      if (!entry.key.startsWith(`${ns}.`)) errors.push(`${rel}: ${entry.key} is not in namespace ${ns}`);
      const map = isHero ? hero : kit;
      const prev = map.get(entry.key);
      if (prev) errors.push(`${entry.key} appears in two ${isHero ? "hero" : "kit"} fragments: ${prev.fragment} and ${rel}`);
      else map.set(entry.key, { entry, fragment: rel, dir: path.dirname(file), hero: isHero });
      if (isHero && !entry.file && !entry.parts) errors.push(`${rel}: hero entry ${entry.key} must use "file" (or a puppet "parts" recipe with files)`);
    }
  }
  for (const [key, h] of hero) if (!kit.has(key)) errors.push(`${h.fragment}: hero ${key} has no kit entry (every hero key needs a kit fallback, 20 §5.1)`);
  if (errors.length) throw new FragmentError(errors.join("\n"));
  return { ns, settings, kit, hero, fragments: files.map((f) => path.relative(root, f)) };
}

/** Key → the group (second segment), e.g. "layer". */
export function groupOfKey(key: string): string {
  return key.split(".")[1];
}
/** Key → output path relative to public/assets/expedition/: `<ns>/<group>/<name>[.<variant>].svg`. */
export function outputPathOf(key: string, ext = ".svg"): string {
  const [ns, group, ...rest] = key.split(".");
  return `${ns}/${group}/${rest.join(".")}${ext}`;
}

/** 20 §5.1 rasterScale defaults by group (layers: L1/L2/L5 0.75; clouds and fx glows 0.5; parts by size). */
export function defaultRasterScale(key: string, gen: string | null, kind: string, w: number, h: number): number {
  const group = groupOfKey(key);
  if (kind === "puppet" || group === "costume" || group === "companion" || group === "npc") return 1.5;
  if (gen === "cloudBand") return 0.5;
  if (group === "fx") return 0.5;
  if (group === "layer" || group === "vista") return 0.75;
  if (group === "part") return Math.max(w, h) <= 500 ? 1.5 : 1;
  return 1;
}
