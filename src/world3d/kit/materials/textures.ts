import * as THREE from "three";

/*
 * The CC0 texture library on the client: reads public/world3d/textures/manifest.json (written by
 * `pnpm world3d:assets`), loads a texture set (albedo, OpenGL normal, packed AO/roughness/metalness) once per name, and
 * hands out the shared THREE.Textures. Everything is async and optional: when the manifest or a file is missing the
 * callers keep their flat colours, so a checkout without the assets still renders.
 *
 * Browser only (TextureLoader needs Image); on the server every loader resolves to null.
 */

export const TEXTURE_BASE = "/world3d/textures/";

export interface TextureInfo {
  source: string;
  group: "ground" | "structure" | "vegetation";
  size: number;
  /** real-world edge of one tile, metres */
  metres: number;
  /** average albedo, sRGB hex */
  avg: string | null;
  maps: { diff: string; nor: string; arm: string };
}

export interface TextureManifest {
  version: number;
  textures: Record<string, TextureInfo>;
  water: { normal: string };
}

export interface TextureSet {
  name: string;
  info: TextureInfo;
  diff: THREE.Texture;
  nor: THREE.Texture;
  arm: THREE.Texture;
}

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

let manifestPromise: Promise<TextureManifest | null> | null = null;
let manifestValue: TextureManifest | null = null;

export function loadManifest(): Promise<TextureManifest | null> {
  if (!isBrowser()) return Promise.resolve(null);
  manifestPromise ??= fetch(`${TEXTURE_BASE}manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<TextureManifest>) : null))
    .then((m) => (manifestValue = m))
    .catch(() => null);
  return manifestPromise;
}

/** The manifest if it has already arrived (null before, or when the assets are missing). */
export function manifestNow(): TextureManifest | null {
  return manifestValue;
}

const loader = () => new THREE.TextureLoader();
let textureLoader: THREE.TextureLoader | null = null;

function loadTexture(url: string, srgb: boolean): Promise<THREE.Texture | null> {
  textureLoader ??= loader();
  return new Promise((resolve) => {
    textureLoader!.load(
      url,
      (t) => {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 8;
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.generateMipmaps = true;
        t.needsUpdate = true;
        resolve(t);
      },
      undefined,
      () => resolve(null),
    );
  });
}

const sets = new Map<string, Promise<TextureSet | null>>();

/** One shared texture set per name (a GroundTexture, a structure Material, `bark`, `bark_palm`, `field`). */
export function loadTextureSet(name: string): Promise<TextureSet | null> {
  if (!isBrowser()) return Promise.resolve(null);
  let p = sets.get(name);
  if (!p) {
    p = loadManifest().then(async (m) => {
      const info = m?.textures[name];
      if (!info) return null;
      const [diff, nor, arm] = await Promise.all([
        loadTexture(TEXTURE_BASE + info.maps.diff, true),
        loadTexture(TEXTURE_BASE + info.maps.nor, false),
        loadTexture(TEXTURE_BASE + info.maps.arm, false),
      ]);
      if (!diff || !nor || !arm) return null;
      diff.name = `${name}:diff`;
      nor.name = `${name}:nor`;
      arm.name = `${name}:arm`;
      return { name, info, diff, nor, arm };
    });
    sets.set(name, p);
  }
  return p;
}

let waterNormals: Promise<THREE.Texture | null> | null = null;
export function loadWaterNormals(): Promise<THREE.Texture | null> {
  if (!isBrowser()) return Promise.resolve(null);
  waterNormals ??= loadManifest().then((m) => loadTexture(TEXTURE_BASE + (m?.water.normal ?? "water/normal.jpg"), false));
  return waterNormals;
}

/** Decoded pixels of a texture file, drawn at `size`² and flipped so row 0 is the bottom (GL convention). */
export async function loadPixels(url: string, size: number): Promise<Uint8ClampedArray | null> {
  if (!isBrowser()) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none", imageOrientation: "flipY" });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, size, size);
    bitmap.close();
    return ctx.getImageData(0, 0, size, size).data;
  } catch {
    return null;
  }
}

/** sRGB hex → linear RGB triple (for albedo normalisation). */
export function srgbHexToLinear(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

/**
 * The multiplier that moves a texture's average albedo onto a target colour (both sRGB hex), blended `amount` of the
 * way from white, and clamped so a very dark texture can't be blown out. Pure: used by the terrain tint and the
 * structure materials, and unit-tested.
 */
export function albedoTint(target: string, avg: string | null, amount = 0.85, max = 3.2): [number, number, number] {
  if (!avg) return [1, 1, 1];
  const t = srgbHexToLinear(target);
  const a = srgbHexToLinear(avg);
  return [0, 1, 2].map((i) => {
    const ratio = Math.min(max, t[i] / Math.max(0.004, a[i]));
    return 1 + (ratio - 1) * amount;
  }) as [number, number, number];
}
