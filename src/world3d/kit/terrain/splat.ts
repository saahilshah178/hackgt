import type { Biome } from "../../../contracts/world3d";
import { BIOMES, type GroundTexture } from "../../core/biomes";
import { smoothstep } from "../../core/noise";

/*
 * The terrain splat as pure data: which textures a biome's terrain needs (one texture-array layer each), which slot uses
 * which layer, and the blend rules. `splatWeights` is the CPU mirror of the fragment shader in ./shader.ts (same
 * thresholds, same order), so tests can check the rules and other code (vegetation tint, the minimap) can ask what the
 * ground looks like at a point without a GPU.
 *
 * Slots: 0 shore, 1 low, 2 high, 3 cliff (triplanar), 4 peak, 5 path, 6 field (tilled soil), 7 stone (paved paths).
 */

export const SPLAT_SLOTS = ["shore", "low", "high", "cliff", "peak", "path", "field", "stone"] as const;
export type SplatSlot = (typeof SPLAT_SLOTS)[number];

/** Kit-only ground textures beyond core/biomes GROUND_TEXTURES. */
export type TerrainTexture = GroundTexture | "field";

export interface SplatLayers {
  /** unique texture names, one texture-array layer each */
  textures: TerrainTexture[];
  /** slot → layer index into `textures` */
  layerOf: number[];
  /** slot → texture name */
  textureOf: TerrainTexture[];
  /** slot → flat colour (sRGB hex): the biome palette, and the tint target for the photo */
  colors: string[];
  /** slot → roughness multiplier on the photo's roughness */
  roughness: number[];
}

const FIELD_COLOR: Partial<Record<Biome, string>> = { desert: "#6e5638", lunar: "#8b8b88", arctic: "#8a8078" };
const STONE_COLOR: Partial<Record<Biome, string>> = { desert: "#c7b08a", canyon: "#b88a66", lunar: "#8a8a86", volcanic: "#5a524c" };

export function splatLayers(biome: Biome): SplatLayers {
  const g = BIOMES[biome].ground;
  const textureOf: TerrainTexture[] = [g.shore.texture, g.low.texture, g.high.texture, g.cliff.texture, g.peak.texture, g.path.texture, "field", "cobble"];
  const colors = [
    g.shore.color,
    g.low.color,
    g.high.color,
    g.cliff.color,
    g.peak.color,
    g.path.color,
    FIELD_COLOR[biome] ?? "#5f4a33",
    STONE_COLOR[biome] ?? "#9d9384",
  ];
  const textures: TerrainTexture[] = [];
  const layerOf = textureOf.map((t) => {
    let i = textures.indexOf(t);
    if (i < 0) i = textures.push(t) - 1;
    return i;
  });
  const roughness = textureOf.map((t) => (t === "ice" ? 0.25 : t === "snow" ? 0.85 : t === "mud" ? 0.8 : 1));
  return { textures, layerOf, textureOf, colors, roughness };
}

export interface SplatSample {
  /** ground height minus the water level (or the plain height when there is no water) */
  rel: number;
  /** 1 - normal.y: 0 flat, ~0.3 at 45° */
  slope: number;
  /** 0..1 masks */
  path: number;
  field: number;
  stone: number;
  /** large- and mid-scale noise, -1..1 */
  n1: number;
  n2: number;
}

export interface SplatParams {
  hasWater: boolean;
  highLine: number;
  peakLine: number;
}

/** Slot weights (sum 1) at one point, in the shader's order: low → high → peak → shore → cliff → field → path → stone. */
export function splatWeights(s: SplatSample, p: SplatParams): number[] {
  const w = [0, 1, 0, 0, 0, 0, 0, 0];
  const blend = (slot: number, t: number) => {
    if (t <= 0) return;
    for (let j = 0; j < 8; j++) w[j] *= 1 - t;
    w[slot] += t;
  };
  const hi = smoothstep(p.highLine * 0.75, p.highLine * 1.25, s.rel + s.n1 * p.highLine * 0.35 + s.n2 * 1.5);
  const pk = smoothstep(p.peakLine - 8, p.peakLine + 8, s.rel + s.n1 * 10 + s.n2 * 4 - s.slope * 20);
  const sh = p.hasWater ? 1 - smoothstep(0.35, 1.7, s.rel + s.n2 * 0.6 + s.n1 * 0.4) : 0;
  const cl = smoothstep(0.17, 0.3, s.slope + s.n2 * 0.05);
  const fi = smoothstep(0.2, 0.7, s.field + s.n2 * 0.15);
  const stone = smoothstep(0.25, 0.7, s.stone + s.n2 * 0.2);
  const pa = smoothstep(0.25, 0.7, s.path + s.n2 * 0.25) * (1 - stone);
  blend(2, hi);
  blend(4, pk);
  blend(0, sh);
  blend(3, cl);
  blend(6, fi);
  blend(5, pa);
  blend(7, stone);
  return w;
}
