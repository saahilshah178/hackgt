import type { Biome, SkyMood, Weather } from "../../contracts/world3d";

/*
 * Light rigs per sky mood, adjusted by weather and biome. The Architect names a mood; code owns the numbers so every
 * world is lit like a photograph rather than a debug scene. The renderer (src/world3d/kit/Sky, post) reads `lightRig()`.
 * Colours are sRGB hex. Angles in degrees: elevation above the horizon, azimuth clockwise from north.
 */

export interface LightRig {
  sun: { elevation: number; azimuth: number; color: string; intensity: number };
  /** night: the moon takes the sun's role (dimmer, bluer) and stars show */
  night: boolean;
  /** three.js Sky shader parameters */
  sky: { turbidity: number; rayleigh: number; mieCoefficient: number; mieDirectionalG: number };
  hemisphere: { sky: string; ground: string; intensity: number };
  fog: { color: string; density: number };
  /** renderer tone-mapping exposure */
  exposure: number;
  post: { bloom: number; saturation: number; contrast: number; warmth: number; vignette: number };
  /** clouds 0..1 */
  clouds: number;
}

const MOODS: Record<SkyMood, LightRig> = {
  dawn: {
    sun: { elevation: 6, azimuth: 95, color: "#ffc59a", intensity: 2.2 },
    night: false,
    sky: { turbidity: 6, rayleigh: 2.4, mieCoefficient: 0.006, mieDirectionalG: 0.85 },
    hemisphere: { sky: "#b8c6e8", ground: "#8a6a58", intensity: 0.7 },
    fog: { color: "#e8c9b4", density: 0.0022 },
    exposure: 0.85,
    post: { bloom: 0.55, saturation: 1.05, contrast: 1.05, warmth: 0.35, vignette: 0.35 },
    clouds: 0.3,
  },
  morning: {
    sun: { elevation: 24, azimuth: 115, color: "#fff0d8", intensity: 3.0 },
    night: false,
    sky: { turbidity: 4, rayleigh: 1.6, mieCoefficient: 0.004, mieDirectionalG: 0.8 },
    hemisphere: { sky: "#bcd6f2", ground: "#8a7a62", intensity: 0.85 },
    fog: { color: "#d6e2ee", density: 0.0015 },
    exposure: 0.8,
    post: { bloom: 0.35, saturation: 1.08, contrast: 1.04, warmth: 0.12, vignette: 0.3 },
    clouds: 0.35,
  },
  midday: {
    sun: { elevation: 62, azimuth: 175, color: "#fffaf0", intensity: 3.4 },
    night: false,
    sky: { turbidity: 3, rayleigh: 1.2, mieCoefficient: 0.003, mieDirectionalG: 0.75 },
    hemisphere: { sky: "#c4dcf5", ground: "#907c62", intensity: 0.95 },
    fog: { color: "#dce8f2", density: 0.0012 },
    exposure: 0.72,
    post: { bloom: 0.25, saturation: 1.05, contrast: 1.06, warmth: 0.05, vignette: 0.25 },
    clouds: 0.3,
  },
  golden_hour: {
    sun: { elevation: 11, azimuth: 250, color: "#ffc27a", intensity: 3.0 },
    night: false,
    sky: { turbidity: 7, rayleigh: 2.0, mieCoefficient: 0.007, mieDirectionalG: 0.86 },
    hemisphere: { sky: "#a9bde0", ground: "#9a6e4c", intensity: 0.75 },
    fog: { color: "#f0cfa4", density: 0.0018 },
    exposure: 0.82,
    post: { bloom: 0.6, saturation: 1.12, contrast: 1.07, warmth: 0.45, vignette: 0.35 },
    clouds: 0.35,
  },
  dusk: {
    sun: { elevation: 2.5, azimuth: 265, color: "#ff8f6a", intensity: 1.6 },
    night: false,
    sky: { turbidity: 8, rayleigh: 3.0, mieCoefficient: 0.008, mieDirectionalG: 0.88 },
    hemisphere: { sky: "#7f86b8", ground: "#6a4a48", intensity: 0.55 },
    fog: { color: "#b98c8c", density: 0.0024 },
    exposure: 0.95,
    post: { bloom: 0.7, saturation: 1.1, contrast: 1.08, warmth: 0.3, vignette: 0.42 },
    clouds: 0.45,
  },
  overcast: {
    sun: { elevation: 35, azimuth: 160, color: "#e6ecf2", intensity: 1.2 },
    night: false,
    sky: { turbidity: 12, rayleigh: 0.6, mieCoefficient: 0.02, mieDirectionalG: 0.6 },
    hemisphere: { sky: "#c5ccd4", ground: "#77736a", intensity: 1.25 },
    fog: { color: "#c3c9cf", density: 0.0032 },
    exposure: 0.9,
    post: { bloom: 0.15, saturation: 0.9, contrast: 1.0, warmth: -0.05, vignette: 0.3 },
    clouds: 0.9,
  },
  storm: {
    sun: { elevation: 25, azimuth: 200, color: "#b9c4d0", intensity: 0.8 },
    night: false,
    sky: { turbidity: 18, rayleigh: 0.4, mieCoefficient: 0.03, mieDirectionalG: 0.5 },
    hemisphere: { sky: "#8a939e", ground: "#4d4a45", intensity: 0.95 },
    fog: { color: "#7d8691", density: 0.0045 },
    exposure: 1.0,
    post: { bloom: 0.2, saturation: 0.8, contrast: 1.1, warmth: -0.15, vignette: 0.5 },
    clouds: 1,
  },
  night: {
    sun: { elevation: 38, azimuth: 140, color: "#aebfe6", intensity: 0.55 },
    night: true,
    sky: { turbidity: 1, rayleigh: 0.2, mieCoefficient: 0.002, mieDirectionalG: 0.7 },
    hemisphere: { sky: "#2d3a5c", ground: "#1d1c24", intensity: 0.45 },
    fog: { color: "#1b2233", density: 0.002 },
    exposure: 1.2,
    post: { bloom: 0.9, saturation: 0.85, contrast: 1.1, warmth: -0.25, vignette: 0.45 },
    clouds: 0.2,
  },
};

/** How weather shifts the rig. Multipliers on fog density and sun intensity; clouds and saturation set or nudged. */
const WEATHER_ADJUST: Record<Weather, { fog: number; sun: number; clouds: number | null; saturation: number; fogTint: string | null }> = {
  clear: { fog: 0.7, sun: 1.0, clouds: null, saturation: 0, fogTint: null },
  haze: { fog: 1.8, sun: 0.9, clouds: null, saturation: -0.05, fogTint: null },
  mist: { fog: 3.0, sun: 0.7, clouds: 0.6, saturation: -0.1, fogTint: "#d3dbe0" },
  light_rain: { fog: 2.2, sun: 0.55, clouds: 0.95, saturation: -0.12, fogTint: "#9aa3ab" },
  snow: { fog: 2.4, sun: 0.7, clouds: 0.85, saturation: -0.15, fogTint: "#e2e8ee" },
  dust: { fog: 2.6, sun: 0.75, clouds: 0.3, saturation: -0.05, fogTint: "#d8b68a" },
  ash: { fog: 2.8, sun: 0.5, clouds: 0.9, saturation: -0.25, fogTint: "#6e6660" },
};

/** Biome tint on the fog (desert dust is warm, forest air is green-grey). null keeps the mood's colour. */
const BIOME_FOG: Partial<Record<Biome, string>> = {
  desert: "#e9cfa6",
  canyon: "#e0b08a",
  volcanic: "#8a7f78",
  arctic: "#dfe8ef",
  forest: "#b9c6b4",
  wetland: "#b7c2b0",
  lunar: "#000000",
};

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `#${((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, "0")}`;
}

/** The final light rig for a world: mood, then weather, then the biome's air, then `fog` (0..1) from the Architect. */
export function lightRig(mood: SkyMood, weather: Weather, biome: Biome, fog01: number): LightRig {
  const base = MOODS[mood];
  const w = WEATHER_ADJUST[weather];
  let fogColor = base.fog.color;
  const biomeFog = BIOME_FOG[biome];
  if (biomeFog && !base.night) fogColor = mixHex(fogColor, biomeFog, 0.45);
  if (w.fogTint) fogColor = mixHex(fogColor, w.fogTint, 0.5);
  const lunar = biome === "lunar";
  return {
    ...base,
    sun: { ...base.sun, intensity: base.sun.intensity * w.sun * (lunar ? 1.3 : 1) },
    night: base.night || lunar,
    sky: lunar ? { turbidity: 0.1, rayleigh: 0, mieCoefficient: 0, mieDirectionalG: 0.7 } : base.sky,
    fog: { color: lunar ? "#000000" : fogColor, density: lunar ? 0 : base.fog.density * w.fog * (0.5 + fog01) },
    clouds: lunar ? 0 : (w.clouds ?? base.clouds),
    post: { ...base.post, saturation: base.post.saturation + w.saturation },
  };
}

/** The sun direction as a unit vector in three.js space (x east, y up, z south). */
export function sunDirection(rig: LightRig): { x: number; y: number; z: number } {
  const el = (rig.sun.elevation * Math.PI) / 180;
  const az = (rig.sun.azimuth * Math.PI) / 180;
  // azimuth clockwise from north (-z): north = (0, -1), east = (1, 0)
  return { x: Math.cos(el) * Math.sin(az), y: Math.sin(el), z: -Math.cos(el) * Math.cos(az) };
}
