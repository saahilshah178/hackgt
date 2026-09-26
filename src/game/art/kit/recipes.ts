/**
 * src/game/art/kit/recipes.ts — named compositions (02 §3a.1, 20 §5.4). A fragment entry references one as
 * `{ "recipe": "<name>", "args": {…}, "seed": n | null }`. A recipe expands to one generator call (an `svg` entry) or to
 * a puppet recipe (parts from generators + animations as data).
 *
 * - `glass_tank`: plate slate frame + bilayerTile strip_vertical window + waterBand pool (the revision-2 `glassTank`).
 * - `default_zone`: the stand-in layer set any zone of a biome renders before its own set lands (A2 builds on it).
 * - `companion_standin`: an 8-part kit puppet with `idle`, `talk`, `cue` — the kit fallback for Cog, Pip and Wick.
 */
import { z } from "zod";
import type { PuppetAnim } from "../../../contracts/world";
import type { KitName } from "./types";

export interface SvgRecipeOut {
  kind: "svg";
  gen: KitName;
  params: unknown;
}
export interface PuppetRecipePartOut {
  name: string;
  from: Array<{ gen: KitName; params: unknown; seed: number | null }>; // one per frame
  pivot: [number, number];
  z: number;
  rest: [number, number];
}
export interface PuppetRecipeOut {
  kind: "puppet";
  size: [number, number];
  pivot: [number, number];
  parts: PuppetRecipePartOut[];
  anims: PuppetAnim[];
}
export type RecipeOut = SvgRecipeOut | PuppetRecipeOut;
export interface Recipe {
  name: string;
  summary: string;
  args: z.ZodType<unknown>;
  expand(args: unknown): RecipeOut;
}

// ── glass_tank ─────────────────────────────────────────────────────────────────────────────────────────────
const GlassTankArgs = z.strictObject({ w: z.number().min(60).max(1200).default(220), h: z.number().min(80).max(1200).default(320), water: z.number().min(0).max(1).default(0.55) });
const glassTank: Recipe = {
  name: "glass_tank",
  summary: "plate slate frame + bilayerTile strip_vertical window + waterBand pool",
  args: GlassTankArgs,
  expand(raw) {
    const a = GlassTankArgs.parse(raw ?? {});
    const inset = Math.max(10, Math.round(a.w * 0.07));
    const waterH = Math.round((a.h - inset * 2) * a.water);
    return {
      kind: "svg",
      gen: "compose",
      params: {
        w: a.w,
        h: a.h,
        tileWidth: null,
        finish: { ao: false, rim: false, haze: 0 },
        items: [
          { gen: "plate", params: { w: a.w, h: a.h, style: "slate", bevel: inset, rivets: 4, screen: false, ramp: { lit: "stone.lit", base: "stone.base", shade: "stone.shade" }, face: "gel.frost|alpha:0.35", engraved: null }, seed: null, x: a.w / 2, y: a.h / 2, scale: 1, flip: false, alpha: 1 },
          { gen: "waterBand", params: { w: a.w - inset * 2, h: waterH, style: "pool", waveAmp: 2, waveCycles: 4 }, seed: null, x: inset, y: a.h - inset - waterH, scale: 1, flip: false, alpha: 0.9 },
          { gen: "bilayerTile", params: { w: a.h - inset * 2, headR: 6, pitch: 14, tailLen: 10, variant: "strip_vertical" }, seed: null, x: inset, y: inset, scale: 1, flip: false, alpha: 0.85 },
        ],
      },
    };
  },
};

// ── default_zone ───────────────────────────────────────────────────────────────────────────────────────────
const LAYERS = ["sky", "clouds", "far", "midfar", "mid", "fore", "surface", "underside"] as const;
const DefaultZoneArgs = z.strictObject({
  biome: z.enum(["orrery_terraces", "living_gate", "archive_of_voices"]),
  layer: z.enum(LAYERS),
  w: z.number().int().min(256).max(4096).default(2048),
});
function presetFor(biome: z.infer<typeof DefaultZoneArgs>["biome"], layer: (typeof LAYERS)[number], w: number): SvgRecipeOut {
  const g = (gen: KitName, params: unknown): SvgRecipeOut => ({ kind: "svg", gen, params });
  const item = (gen: KitName, params: unknown, x: number, y: number, scale = 1, flip = false, alpha = 1) => ({ gen, params, seed: null, x, y, scale, flip, alpha });
  if (biome === "orrery_terraces") {
    switch (layer) {
      case "sky":
        return g("skyWash", { h: 1080, stops: ["sky.day.top", "sky.day.mid", "sky.day.horizon"], at: [0, 0.55, 1], dither: 0.02 });
      case "clouds":
        return g("cloudBand", { w, h: 260, style: "lozenge", count: 7, lobe: [16, 30], fill: "stone.lit", under: "sky.peach.mid", alpha: 0.9, blur: 1.2 });
      case "far":
        return g("ridgeBand", { w, h: 620, style: "butte_fluted", peaks: 5, height: [320, 560], flutes: 6, finish: { ao: false, rim: true, haze: 0.4 } });
      case "midfar":
        return g("scatter", { w, h: 520, tileWidth: w, item: { gen: "crystalCluster", params: { w: 150, h: 230 } }, count: 8, variants: 3, band: [470, 520], minGap: 160, scale: [0.7, 1.3], flipChance: 0.5, finish: { ao: false, rim: false, haze: 0.2 } });
      case "mid":
        return g("compose", {
          w,
          h: 600,
          tileWidth: w,
          finish: { ao: false, rim: false, haze: 0 },
          items: [
            item("ashlarWall", { w: 900, h: 300, rounded: 6, cap: { h: 18, tok: "gold.base" }, bands: [{ y: 120, h: 14, tok: "inlay.navy" }], medallions: { every: 150, y: 70, r: 12 } }, 450, 600),
            item("column", { h: 480 }, 1080, 600),
            item("column", { h: 430, broken: 0.25, capital: "none", base: "buried" }, 1290, 600),
            item("arch", { w: 360, h: 420, buried: 0.1 }, 1600, 600),
            item("canopy", { w: 260, h: 340 }, 1880, 600, 1, true),
          ],
        });
      case "fore":
        return g("scatter", { w, h: 260, tileWidth: w, item: { gen: "canopy", params: { style: "bush", w: 260, h: 150 } }, count: 5, variants: 3, band: [250, 260], minGap: 300, scale: [0.8, 1.3], flipChance: 0.5, finish: { ao: false, rim: false, haze: 0 } });
      case "surface":
        return g("groundStrip", { w: 512, h: 208, style: "polygon_paving", lip: "gold.base", grassEdge: { lit: "grass.light", base: "grass.base", shade: "grass.shade" } });
      case "underside":
        return g("ashlarWall", { w: 512, h: 300, rounded: 10, finish: { ao: false, rim: false, haze: 0 } });
    }
  }
  if (biome === "living_gate") {
    const lipid = { head: "lipid.head", headLit: "lipid.head.lit", headShade: "lipid.head.shade", tail: "lipid.tail", core: "lipid.tail.deep", frost: "gel.frost", inlay: "oil.seam", stud: "lipid.tail.hi" };
    switch (layer) {
      case "sky":
        return g("skyWash", { h: 1080, stops: ["gel.frost", "cyto.glow|light:0.35", "cyto.glow"], at: [0, 0.5, 1], dither: 0.02 });
      case "clouds":
        return g("cloudBand", { w, h: 280, style: "swirl", count: 6, lobe: [24, 46], fill: "gel.frost", under: "tide.shallow", alpha: 0.6, blur: 2 });
      case "far":
        return g("ridgeBand", { w, h: 560, style: "cell_dome", peaks: 4, height: [260, 480], flutes: 0, ramp: { lit: "lipid.head.lit", base: "lipid.head", shade: "lipid.head.shade" }, rimLine: "lipid.tail", finish: { ao: false, rim: true, haze: 0.4 } });
      case "midfar":
        return g("lipidColonnade", { w, h: 520, swell: 0.6, rows: 2, saplings: 10, scale: 0.6, tokens: { ...lipid, sapling: "glycan.salmon" } });
      case "mid":
        return g("scatter", { w, h: 560, tileWidth: w, item: { gen: "canopy", params: { style: "bead_tree", w: 220, h: 360, ramp: { lit: "glycan.salmon.hi", base: "glycan.salmon", shade: "glycan.rust" }, trunk: "protein.ring" } }, count: 7, variants: 3, band: [540, 560], minGap: 200, scale: [0.8, 1.3], flipChance: 0.5, finish: { ao: false, rim: false, haze: 0 } });
      case "fore":
        return g("scatter", { w, h: 260, tileWidth: w, item: { gen: "canopy", params: { style: "frond", w: 200, h: 220, ramp: { lit: "glycan.blue.hi", base: "glycan.blue", shade: "oil.seam" }, trunk: null } }, count: 6, variants: 3, band: [255, 260], minGap: 260, scale: [0.8, 1.2], flipChance: 0.5, finish: { ao: false, rim: false, haze: 0 } });
      case "surface":
        return g("bilayerTile", { w: 512, headR: 14, pitch: 32, tailLen: 30, variant: "hall_deck", tokens: lipid });
      case "underside":
        return g("bilayerTile", { w: 512, headR: 12, pitch: 28, tailLen: 40, variant: "gel", tokens: lipid });
    }
  }
  switch (layer) {
    case "sky":
      return g("skyWash", { h: 1080, stops: ["sky.late_afternoon.top", "sky.late_afternoon.top|mix:sky.late_afternoon.horizon:0.5", "sky.late_afternoon.horizon"], at: [0, 0.5, 1], dither: 0.02 });
    case "clouds":
      return g("cloudBand", { w, h: 240, style: "puff", count: 5, lobe: [22, 40], fill: "paper", under: "brick.dusk.lit", alpha: 0.7, blur: 1.5 });
    case "far":
      return g("skyline", { w, h: 520, blocks: 24, height: [90, 260], features: ["steeple", "water_tower", "setback_tower", "obelisk"], fill: "brick.dusk", windowTok: "lamp", windowDensity: 0.12, finish: { ao: false, rim: false, haze: 0.4 } });
    case "midfar":
      return g("compose", {
        w,
        h: 560,
        tileWidth: w,
        finish: { ao: false, rim: false, haze: 0.2 },
        items: [0, 1, 2, 3, 4].map((i) =>
          item("facade", { w: 380, h: 440 + (i % 2) * 60, style: i % 2 ? "commercial" : "brick_row", floors: 3 + (i % 2), bays: 3, ramp: { lit: "brick.lit", base: "brick.base", shade: "brick.shade" }, trim: "stone.base", window: { w: 46, h: 70, tok: "asphalt.wet", arch: i === 2 }, door: null }, 200 + i * 410, 560),
        ),
      });
    case "mid":
      return g("compose", {
        w,
        h: 560,
        tileWidth: w,
        finish: { ao: false, rim: false, haze: 0 },
        items: [
          item("facade", { w: 520, h: 420, style: "storefront", floors: 2, bays: 3, ramp: { lit: "brick.lit", base: "brick.base", shade: "brick.shade" }, trim: "stone.base", window: { w: 60, h: 90, tok: "asphalt.wet", arch: false }, door: { bay: 1, recessed: true }, awning: { stripes: ["autumn", "paper"] } }, 300, 560),
          item("column", { style: "lamp_post", w: 60, h: 320, flutes: 0, bands: 0, capital: "none", base: "step", ramp: { lit: "steel", base: "steel.shade", shade: "asphalt.wet" }, trim: "brass.base" }, 700, 560),
          item("facade", { w: 480, h: 480, style: "moderne", floors: 3, bays: 3, ramp: { lit: "stone.lit", base: "concrete", shade: "curb" }, trim: "stone.lit", window: { w: 56, h: 80, tok: "asphalt.wet", arch: false }, door: { bay: 2, recessed: true } }, 1100, 560),
          item("canopy", { style: "magnolia", w: 260, h: 360, ramp: { lit: "magnolia.hi", base: "magnolia", shade: "asphalt.wet" }, trunk: "bronze.ring" }, 1520, 560),
          item("facade", { w: 400, h: 400, style: "brick_row", floors: 2, bays: 3, ramp: { lit: "brick.lit", base: "brick.base", shade: "brick.shade" }, trim: "stone.base", window: { w: 50, h: 76, tok: "asphalt.wet", arch: true }, door: { bay: 0, recessed: true } }, 1840, 560),
        ],
      });
    case "fore":
      return g("railing", { w, h: 110, style: "wrought_iron", spacing: 26, posts: { every: 10, emblem: false }, wet: true, ramp: { lit: "steel", base: "steel.shade", shade: "asphalt.wet" }, cap: "steel.shade" });
    case "surface":
      return g("groundStrip", { w: 512, h: 208, style: "sidewalk", ramp: { lit: "concrete|light:0.25", base: "concrete", shade: "curb" }, lip: null, grassEdge: null, wet: true });
    case "underside":
      return g("brickWall", { w: 512, h: 300, ramp: { lit: "brick.lit", base: "brick.base", shade: "brick.shade" }, mortar: "brick.shade|dim:0.3" });
  }
}
const defaultZone: Recipe = {
  name: "default_zone",
  summary: "a biome's stand-in layer (sky, clouds, far, midfar, mid, fore, surface, underside) before the zone's own set lands",
  args: DefaultZoneArgs,
  expand(raw) {
    const a = DefaultZoneArgs.parse(raw ?? {});
    return presetFor(a.biome, a.layer, a.w);
  },
};

// ── companion_standin ──────────────────────────────────────────────────────────────────────────────────────
const StandinArgs = z.strictObject({
  body: z.string().default("gold.base"), // shell token
  bodyLit: z.string().default("gold.hi"),
  bodyShade: z.string().default("gold.deep"),
  trim: z.string().default("inlay.navy"),
  glow: z.string().default("glow.cyan"),
  wing: z.string().default("stone.lit"),
});
const companionStandin: Recipe = {
  name: "companion_standin",
  summary: "an 8-part kit companion (shell, gears, lens head, two wings, feet, key, eye glow) with idle, talk and cue",
  args: StandinArgs,
  expand(raw) {
    const a = StandinArgs.parse(raw ?? {});
    const ramp = { lit: a.bodyLit, base: a.body, shade: a.bodyShade };
    const ring = (r: number, width: number, tok: string, extra: Record<string, unknown> = {}) => ({ r, width, tok, edge: a.bodyShade, gaps: [], notches: [], studs: null, teeth: null, grooves: null, spokes: null, wave: null, sockets: null, ticks: null, labels: [], ...extra });
    const src = (gen: KitName, params: unknown, seed: number | null = null) => [{ gen, params, seed }];
    const W = 72;
    const H = 72;
    const parts: PuppetRecipePartOut[] = [
      { name: "wing_l", z: -2, pivot: [0.5, 0.95], rest: [24, 42], from: src("crystalCluster", { w: 30, h: 30, form: "fan", shards: 4, lean: -45, ramp: { lit: a.wing, base: `${a.wing}|dim:0.15`, shade: `${a.wing}|dim:0.35` }, glow: null }) },
      { name: "wing_r", z: -2, pivot: [0.5, 0.95], rest: [48, 42], from: src("crystalCluster", { w: 30, h: 30, form: "fan", shards: 4, lean: 45, ramp: { lit: a.wing, base: `${a.wing}|dim:0.15`, shade: `${a.wing}|dim:0.35` }, glow: null }) },
      { name: "feet", z: -1, pivot: [0.5, 0], rest: [36, 56], from: src("plate", { w: 22, h: 8, style: "slab", bevel: 1, rivets: 0, screen: false, ramp, face: a.body, engraved: null }) },
      { name: "body", z: 0, pivot: [0.5, 0.5], rest: [36, 42], from: src("ringStack", { size: 34, ellipse: 1, rings: [ring(17, 5, a.body)], hub: { r: 12, ramp }, cutout: null, knurl: true }) },
      { name: "belly_gears", z: 1, pivot: [0.5, 0.5], rest: [36, 44], from: src("ringStack", { size: 16, ellipse: 1, rings: [ring(8, 3, a.bodyShade, { teeth: { n: 10, depth: 1.5 } })], hub: { r: 3, ramp }, cutout: null, knurl: false }) },
      { name: "head", z: 2, pivot: [0.5, 0.5], rest: [36, 22], from: src("ringStack", { size: 30, ellipse: 1, rings: [ring(15, 4, a.body), ring(10, 3, a.trim)], hub: { r: 6, ramp: { lit: "haze", base: a.glow, shade: a.trim } }, cutout: null, knurl: false }) },
      { name: "key", z: 1, pivot: [0.5, 0.5], rest: [54, 50], from: src("ringStack", { size: 14, ellipse: 0.45, rings: [ring(7, 3, a.bodyLit)], hub: { r: 2, ramp }, cutout: null, knurl: false }) },
      { name: "eye_glow", z: 3, pivot: [0.5, 0.5], rest: [36, 22], from: src("glowSprite", { size: 28, shape: "radial", core: "haze", edge: a.glow, falloff: 0.4, frames: 1 }) },
    ];
    const wave = (part: string, prop: "rot" | "x" | "y" | "scaleX" | "scaleY" | "alpha", amp: number, hz: number, phase = 0) => ({ part, prop, wave: { amp, hz, phase }, keys: [] as Array<[number, number]> });
    const keys = (part: string, prop: "rot" | "x" | "y" | "scaleX" | "scaleY" | "alpha", k: Array<[number, number]>) => ({ part, prop, wave: null, keys: k });
    const anims: PuppetAnim[] = [
      {
        id: "idle",
        loop: true,
        ms: 1250,
        tracks: [
          wave("body", "y", 3, 0.8),
          wave("head", "y", 3, 0.8, 0.05),
          wave("eye_glow", "y", 3, 0.8, 0.05),
          wave("belly_gears", "y", 3, 0.8),
          wave("belly_gears", "rot", 90, 0.25),
          wave("wing_l", "rot", -18, 1.6),
          wave("wing_r", "rot", 18, 1.6),
          keys("eye_glow", "alpha", [[0, 0.5], [625, 0.7], [1250, 0.5]]),
        ],
      },
      {
        id: "talk",
        loop: true,
        ms: 500,
        tracks: [wave("head", "rot", 4, 2), keys("eye_glow", "alpha", [[0, 0.4], [250, 0.95], [500, 0.4]]), wave("belly_gears", "rot", 180, 0.5), wave("wing_l", "rot", -10, 2), wave("wing_r", "rot", 10, 2)],
      },
      {
        id: "cue",
        loop: true,
        ms: 600,
        tracks: [
          wave("wing_l", "rot", -34, 4),
          wave("wing_r", "rot", 34, 4),
          keys("eye_glow", "scaleX", [[0, 1], [300, 1.4], [600, 1]]),
          keys("eye_glow", "scaleY", [[0, 1], [300, 1.4], [600, 1]]),
          keys("eye_glow", "alpha", [[0, 0.7], [300, 1], [600, 0.7]]),
          keys("key", "scaleX", [[0, 1], [150, -1], [300, 1], [450, -1], [600, 1]]),
        ],
      },
    ];
    return { kind: "puppet", size: [W, H], pivot: [0.5, 1], parts, anims };
  },
};

export const RECIPES: Readonly<Record<string, Recipe>> = {
  glass_tank: glassTank,
  default_zone: defaultZone,
  companion_standin: companionStandin,
};
export function expandRecipe(name: string, args: unknown): RecipeOut {
  const r = RECIPES[name];
  if (!r) throw new Error(`unknown recipe "${name}" (known: ${Object.keys(RECIPES).join(", ")})`);
  return r.expand(args);
}
