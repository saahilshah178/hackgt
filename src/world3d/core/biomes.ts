import type { Ambience, Biome, ScatterKind, WildlifeKind } from "../../contracts/world3d";

/*
 * Biome presets: how the ground looks and grows. The Architect picks a biome by name; code owns the textures, colours
 * and defaults, so every combination stays coherent. Colours are sRGB hex (the renderer converts); `ground` layers name
 * textures in the material library (src/world3d/kit/materials), each with a flat colour for untextured tiers.
 */

/** Ground textures the terrain splat can use (src/world3d/kit/materials maps each to CC0 texture files). */
export const GROUND_TEXTURES = [
  "sand",
  "dune_sand",
  "grass",
  "dry_grass",
  "forest_floor",
  "mud",
  "gravel",
  "dirt",
  "rock",
  "cliff",
  "dark_rock",
  "snow",
  "ice",
  "regolith",
  "cobble",
] as const;
export type GroundTexture = (typeof GROUND_TEXTURES)[number];

export interface GroundLayer {
  texture: GroundTexture;
  /** flat fallback / tint colour (sRGB hex) */
  color: string;
}

export interface BiomePreset {
  /** display word for the digest and the fallback composer */
  label: string;
  ground: {
    /** near the water / lowest ground */
    shore: GroundLayer;
    /** most of the map */
    low: GroundLayer;
    /** higher ground */
    high: GroundLayer;
    /** steep faces (triplanar) */
    cliff: GroundLayer;
    /** peaks above `peakLine` (snow, bare rock, ash) */
    peak: GroundLayer;
    /** carved paths by default */
    path: GroundLayer;
  };
  /** metres above the water level where `high` starts / where `peak` starts */
  highLine: number;
  peakLine: number;
  /** base noise: amplitude in metres at relief 1, and the feature size (metres per noise unit) */
  noiseAmplitude: number;
  noiseScale: number;
  /** dune-like directional ripples on the base noise (0..1) */
  ripples: number;
  water: { shallow: string; deep: string; foam: string };
  /** what the fallback composer scatters */
  defaultScatter: { kind: ScatterKind; density: number }[];
  defaultWildlife: WildlifeKind[];
  ambience: Ambience;
  /** minimap colours (land, high land, water) */
  map: { land: string; high: string; water: string };
}

export const BIOMES: Record<Biome, BiomePreset> = {
  desert: {
    label: "desert",
    ground: {
      shore: { texture: "mud", color: "#6b5a3e" },
      low: { texture: "sand", color: "#d9b77e" },
      high: { texture: "dune_sand", color: "#e2c28b" },
      cliff: { texture: "rock", color: "#b08d62" },
      peak: { texture: "rock", color: "#c29e70" },
      path: { texture: "gravel", color: "#b59a74" },
    },
    highLine: 8,
    peakLine: 70,
    noiseAmplitude: 14,
    noiseScale: 220,
    ripples: 0.6,
    water: { shallow: "#3f8a86", deep: "#1d4f5c", foam: "#e8efe6" },
    defaultScatter: [
      { kind: "palm", density: 0.5 },
      { kind: "reeds", density: 0.5 },
      { kind: "rock", density: 0.4 },
      { kind: "bush", density: 0.2 },
    ],
    defaultWildlife: ["cat", "camel", "ibis", "bird_flock"],
    ambience: "desert",
    map: { land: "#d8b983", high: "#c9a56c", water: "#3c7f86" },
  },
  grassland: {
    label: "grassland",
    ground: {
      shore: { texture: "mud", color: "#5c4c34" },
      low: { texture: "grass", color: "#6f8f45" },
      high: { texture: "dry_grass", color: "#9a9a5a" },
      cliff: { texture: "rock", color: "#7d7a70" },
      peak: { texture: "rock", color: "#8d8a80" },
      path: { texture: "dirt", color: "#8c7351" },
    },
    highLine: 12,
    peakLine: 90,
    noiseAmplitude: 18,
    noiseScale: 260,
    ripples: 0,
    water: { shallow: "#4d8f8a", deep: "#1f4b5a", foam: "#eef3ef" },
    defaultScatter: [
      { kind: "tall_grass", density: 0.7 },
      { kind: "flowers", density: 0.4 },
      { kind: "broadleaf", density: 0.25 },
      { kind: "rock", density: 0.3 },
    ],
    defaultWildlife: ["horse", "goat", "butterflies", "bird_flock"],
    ambience: "wind",
    map: { land: "#7c9a52", high: "#9aa05f", water: "#4a8a92" },
  },
  forest: {
    label: "forest",
    ground: {
      shore: { texture: "mud", color: "#4b3d2b" },
      low: { texture: "forest_floor", color: "#5a5a32" },
      high: { texture: "grass", color: "#5f7a3a" },
      cliff: { texture: "cliff", color: "#6d6a62" },
      peak: { texture: "rock", color: "#7a776e" },
      path: { texture: "dirt", color: "#7a6246" },
    },
    highLine: 14,
    peakLine: 110,
    noiseAmplitude: 26,
    noiseScale: 240,
    ripples: 0,
    water: { shallow: "#3f6f5f", deep: "#16362f", foam: "#e4ece6" },
    defaultScatter: [
      { kind: "conifer", density: 0.6 },
      { kind: "broadleaf", density: 0.4 },
      { kind: "bush", density: 0.5 },
      { kind: "tall_grass", density: 0.4 },
      { kind: "mushroom", density: 0.3 },
    ],
    defaultWildlife: ["bird_flock", "butterflies", "fireflies", "dog"],
    ambience: "forest",
    map: { land: "#4f6b35", high: "#617a44", water: "#3a6a62" },
  },
  tropical: {
    label: "tropical island",
    ground: {
      shore: { texture: "sand", color: "#e6d3a3" },
      low: { texture: "grass", color: "#5f9442" },
      high: { texture: "forest_floor", color: "#4d6a2f" },
      cliff: { texture: "dark_rock", color: "#5a5048" },
      peak: { texture: "dark_rock", color: "#5a5048" },
      path: { texture: "sand", color: "#d8c79c" },
    },
    highLine: 6,
    peakLine: 120,
    noiseAmplitude: 22,
    noiseScale: 200,
    ripples: 0,
    water: { shallow: "#35c1c1", deep: "#0d5a7a", foam: "#f4fbfa" },
    defaultScatter: [
      { kind: "palm", density: 0.7 },
      { kind: "broadleaf", density: 0.4 },
      { kind: "bush", density: 0.5 },
      { kind: "flowers", density: 0.4 },
    ],
    defaultWildlife: ["bird_flock", "butterflies", "fish"],
    ambience: "ocean",
    map: { land: "#5f9442", high: "#4d6a2f", water: "#2fa7b4" },
  },
  alpine: {
    label: "alpine valley",
    ground: {
      shore: { texture: "gravel", color: "#77746c" },
      low: { texture: "grass", color: "#6c8c46" },
      high: { texture: "rock", color: "#8a8780" },
      cliff: { texture: "cliff", color: "#77746c" },
      peak: { texture: "snow", color: "#eef2f6" },
      path: { texture: "gravel", color: "#8d8778" },
    },
    highLine: 30,
    peakLine: 80,
    noiseAmplitude: 60,
    noiseScale: 300,
    ripples: 0,
    water: { shallow: "#5aa3a8", deep: "#1b4b63", foam: "#f2f6f7" },
    defaultScatter: [
      { kind: "conifer", density: 0.6 },
      { kind: "tall_grass", density: 0.5 },
      { kind: "flowers", density: 0.35 },
      { kind: "boulder", density: 0.4 },
    ],
    defaultWildlife: ["goat", "bird_flock", "butterflies"],
    ambience: "wind",
    map: { land: "#6c8c46", high: "#9a978e", water: "#5aa3a8" },
  },
  volcanic: {
    label: "volcanic island",
    ground: {
      shore: { texture: "dark_rock", color: "#2f2c2b" },
      low: { texture: "dark_rock", color: "#3b3634" },
      high: { texture: "gravel", color: "#4a4441" },
      cliff: { texture: "dark_rock", color: "#2a2625" },
      peak: { texture: "dark_rock", color: "#221f1e" },
      path: { texture: "gravel", color: "#5a524c" },
    },
    highLine: 10,
    peakLine: 90,
    noiseAmplitude: 30,
    noiseScale: 220,
    ripples: 0,
    water: { shallow: "#2f6f7a", deep: "#0f2f3f", foam: "#e2e8e8" },
    defaultScatter: [
      { kind: "dead_tree", density: 0.3 },
      { kind: "rock", density: 0.6 },
      { kind: "boulder", density: 0.5 },
      { kind: "bush", density: 0.2 },
    ],
    defaultWildlife: ["bird_flock"],
    ambience: "volcano",
    map: { land: "#4a4441", high: "#3b3634", water: "#2f6f7a" },
  },
  arctic: {
    label: "arctic tundra",
    ground: {
      shore: { texture: "ice", color: "#cfe3ec" },
      low: { texture: "snow", color: "#eef3f7" },
      high: { texture: "snow", color: "#f4f7fa" },
      cliff: { texture: "cliff", color: "#8a94a0" },
      peak: { texture: "snow", color: "#ffffff" },
      path: { texture: "gravel", color: "#a7adb5" },
    },
    highLine: 10,
    peakLine: 60,
    noiseAmplitude: 22,
    noiseScale: 240,
    ripples: 0.2,
    water: { shallow: "#5c8fa6", deep: "#173c55", foam: "#ffffff" },
    defaultScatter: [
      { kind: "conifer", density: 0.3 },
      { kind: "ice_shard", density: 0.3 },
      { kind: "boulder", density: 0.3 },
    ],
    defaultWildlife: ["dog", "bird_flock"],
    ambience: "wind",
    map: { land: "#e6edf2", high: "#cfd9e2", water: "#4f7f99" },
  },
  canyon: {
    label: "red-rock canyon",
    ground: {
      shore: { texture: "mud", color: "#6a4630" },
      low: { texture: "dirt", color: "#b3643c" },
      high: { texture: "rock", color: "#a8573a" },
      cliff: { texture: "cliff", color: "#9b4f33" },
      peak: { texture: "rock", color: "#b8704a" },
      path: { texture: "gravel", color: "#b88a66" },
    },
    highLine: 16,
    peakLine: 120,
    noiseAmplitude: 40,
    noiseScale: 200,
    ripples: 0.1,
    water: { shallow: "#4d8a80", deep: "#1f4a52", foam: "#efeae2" },
    defaultScatter: [
      { kind: "cactus", density: 0.4 },
      { kind: "bush", density: 0.4 },
      { kind: "boulder", density: 0.4 },
      { kind: "dead_tree", density: 0.2 },
    ],
    defaultWildlife: ["horse", "bird_flock"],
    ambience: "wind",
    map: { land: "#b3643c", high: "#a8573a", water: "#4d8a80" },
  },
  wetland: {
    label: "wetland",
    ground: {
      shore: { texture: "mud", color: "#4d412e" },
      low: { texture: "grass", color: "#5d7a3c" },
      high: { texture: "forest_floor", color: "#5a5a32" },
      cliff: { texture: "rock", color: "#6b675e" },
      peak: { texture: "rock", color: "#6b675e" },
      path: { texture: "dirt", color: "#6e5a40" },
    },
    highLine: 4,
    peakLine: 60,
    noiseAmplitude: 8,
    noiseScale: 180,
    ripples: 0,
    water: { shallow: "#5a7a5a", deep: "#243a2e", foam: "#dfe6dc" },
    defaultScatter: [
      { kind: "reeds", density: 0.8 },
      { kind: "broadleaf", density: 0.3 },
      { kind: "dead_tree", density: 0.2 },
      { kind: "tall_grass", density: 0.5 },
    ],
    defaultWildlife: ["ibis", "fireflies", "fish", "bird_flock"],
    ambience: "river",
    map: { land: "#5d7a3c", high: "#5a5a32", water: "#4f6f5a" },
  },
  coast: {
    label: "rocky coast",
    ground: {
      shore: { texture: "sand", color: "#d9c79c" },
      low: { texture: "grass", color: "#6f8f45" },
      high: { texture: "dry_grass", color: "#98945a" },
      cliff: { texture: "cliff", color: "#7d7a70" },
      peak: { texture: "rock", color: "#8d8a80" },
      path: { texture: "gravel", color: "#a39a86" },
    },
    highLine: 10,
    peakLine: 90,
    noiseAmplitude: 22,
    noiseScale: 220,
    ripples: 0,
    water: { shallow: "#3fa0a8", deep: "#123f5c", foam: "#f4f8f8" },
    defaultScatter: [
      { kind: "tall_grass", density: 0.6 },
      { kind: "conifer", density: 0.25 },
      { kind: "rock", density: 0.4 },
      { kind: "flowers", density: 0.3 },
    ],
    defaultWildlife: ["bird_flock", "dog", "fish"],
    ambience: "ocean",
    map: { land: "#6f8f45", high: "#98945a", water: "#3a8fa0" },
  },
  lunar: {
    label: "lunar surface",
    ground: {
      shore: { texture: "regolith", color: "#8b8b88" },
      low: { texture: "regolith", color: "#9a9a96" },
      high: { texture: "regolith", color: "#a8a8a4" },
      cliff: { texture: "dark_rock", color: "#6a6a67" },
      peak: { texture: "regolith", color: "#b4b4b0" },
      path: { texture: "gravel", color: "#83837f" },
    },
    highLine: 10,
    peakLine: 200,
    noiseAmplitude: 16,
    noiseScale: 160,
    ripples: 0,
    water: { shallow: "#556", deep: "#223", foam: "#ccc" },
    defaultScatter: [
      { kind: "rock", density: 0.7 },
      { kind: "boulder", density: 0.5 },
    ],
    defaultWildlife: [],
    ambience: "night",
    map: { land: "#9a9a96", high: "#b4b4b0", water: "#555566" },
  },
};
