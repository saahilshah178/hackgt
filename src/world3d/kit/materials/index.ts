import * as THREE from "three";
import type { ClothColor, Material, SkinTone } from "../../../contracts/world3d";

/*
 * The material library: one cached MeshStandardMaterial per (material, options). Structure builders, characters and
 * props never construct materials themselves, so the whole world shares a handful of GPU programs and the texture set
 * can be upgraded in one place.
 *
 * API (stable): getWorldMaterial(material, opts), clothMaterial(color), skinMaterial(tone), accentMaterial(kind),
 * MATERIAL_BASE. Textured versions attach CC0 PBR maps asynchronously without changing identity (the flat colour shows
 * until the maps arrive, and on the Low tier).
 */

export interface MaterialOptions {
  /** multiply the base colour (sRGB hex), e.g. a painted wall */
  tint?: string;
  /** texture repeats per metre of UV (builders emit metre-scaled UVs); default 0.5 */
  repeat?: number;
  /** 0..3: small colour/roughness variation so repeated pieces don't look cloned */
  variant?: number;
  /** emissive glow (sRGB hex) and intensity, for lit windows, lanterns, the capstone */
  emissive?: string;
  emissiveIntensity?: number;
  side?: THREE.Side;
}

export interface MaterialBase {
  color: string;
  roughness: number;
  metalness: number;
}

export const MATERIAL_BASE: Record<Material, MaterialBase> = {
  sandstone: { color: "#d2ae7c", roughness: 0.92, metalness: 0 },
  limestone: { color: "#e6dcc6", roughness: 0.85, metalness: 0 },
  marble: { color: "#eeebe4", roughness: 0.35, metalness: 0 },
  granite: { color: "#8a7f7a", roughness: 0.7, metalness: 0 },
  basalt: { color: "#3b3836", roughness: 0.9, metalness: 0 },
  brick: { color: "#9b5a44", roughness: 0.9, metalness: 0 },
  adobe: { color: "#c49a6c", roughness: 0.95, metalness: 0 },
  plaster: { color: "#e9e1d2", roughness: 0.9, metalness: 0 },
  wood: { color: "#8a6440", roughness: 0.8, metalness: 0 },
  thatch: { color: "#b79a5c", roughness: 1, metalness: 0 },
  metal: { color: "#9aa0a6", roughness: 0.35, metalness: 0.9 },
  glass: { color: "#bcd8e6", roughness: 0.05, metalness: 0.1 },
  ice: { color: "#cfe8f3", roughness: 0.15, metalness: 0 },
  crystal: { color: "#b9a5e8", roughness: 0.1, metalness: 0.1 },
  gold: { color: "#e2b64a", roughness: 0.3, metalness: 1 },
};

export const CLOTH_HEX: Record<ClothColor, string> = {
  linen: "#ece3cf",
  cream: "#f1e6c8",
  ochre: "#c8913a",
  terracotta: "#b5573a",
  crimson: "#9c2a2f",
  indigo: "#34407a",
  teal: "#2f7f7a",
  emerald: "#2e7a4a",
  olive: "#6b6b35",
  charcoal: "#35363a",
  brown: "#6b4a30",
  gold: "#d4a73a",
  violet: "#6a4a8a",
  sky: "#6fa3d2",
};

export const SKIN_HEX: Record<SkinTone, string> = {
  tone1: "#f3d9c4",
  tone2: "#eac6a6",
  tone3: "#dcad86",
  tone4: "#c8966c",
  tone5: "#ad7a52",
  tone6: "#8f5f3d",
  tone7: "#6f462b",
  tone8: "#4f311f",
};

const cache = new Map<string, THREE.MeshStandardMaterial>();

function vary(hex: string, variant: number): THREE.Color {
  const c = new THREE.Color(hex);
  if (!variant) return c;
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const shift = [0, 0.035, -0.03, 0.02][variant % 4];
  c.setHSL(hsl.h + shift * 0.1, Math.max(0, hsl.s + shift * 0.4), Math.min(1, Math.max(0, hsl.l + shift)));
  return c;
}

export function getWorldMaterial(material: Material, opts: MaterialOptions = {}): THREE.MeshStandardMaterial {
  const key = `${material}|${opts.tint ?? ""}|${opts.repeat ?? 0.5}|${opts.variant ?? 0}|${opts.emissive ?? ""}|${opts.emissiveIntensity ?? 0}|${opts.side ?? 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const base = MATERIAL_BASE[material];
  const color = vary(base.color, opts.variant ?? 0);
  if (opts.tint) color.multiply(new THREE.Color(opts.tint));
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: base.roughness,
    metalness: base.metalness,
    side: opts.side ?? THREE.FrontSide,
    transparent: material === "glass" || material === "ice",
    opacity: material === "glass" ? 0.35 : material === "ice" ? 0.85 : 1,
  });
  if (opts.emissive) {
    m.emissive = new THREE.Color(opts.emissive);
    m.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  m.name = `world:${material}`;
  cache.set(key, m);
  return m;
}

export function clothMaterial(color: ClothColor, variant = 0): THREE.MeshStandardMaterial {
  const key = `cloth|${color}|${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({ color: vary(CLOTH_HEX[color], variant), roughness: 0.9, metalness: 0 });
  m.name = `cloth:${color}`;
  cache.set(key, m);
  return m;
}

export function skinMaterial(tone: SkinTone): THREE.MeshStandardMaterial {
  const key = `skin|${tone}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(SKIN_HEX[tone]), roughness: 0.62, metalness: 0 });
  m.name = `skin:${tone}`;
  cache.set(key, m);
  return m;
}

/** Small shared accents: dark openings (doorways, windows at day), warm glow (lamps), hair, soil. */
export function accentMaterial(kind: "shadow" | "glow" | "hair" | "soil" | "foliage" | "water_dark"): THREE.MeshStandardMaterial {
  const key = `accent|${kind}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const spec: Record<typeof kind, THREE.MeshStandardMaterialParameters> = {
    shadow: { color: "#1a1410", roughness: 1 },
    glow: { color: "#ffcf7a", emissive: new THREE.Color("#ffb347"), emissiveIntensity: 2.2, roughness: 0.6 },
    hair: { color: "#1f1712", roughness: 0.7 },
    soil: { color: "#5a4632", roughness: 1 },
    foliage: { color: "#4e6b2f", roughness: 0.85 },
    water_dark: { color: "#1d3a44", roughness: 0.2 },
  };
  const m = new THREE.MeshStandardMaterial(spec[kind]);
  m.name = `accent:${kind}`;
  cache.set(key, m);
  return m;
}
