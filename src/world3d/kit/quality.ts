import type { Quality } from "../core/compose";

/*
 * Quality tiers for the 3D kit: one table the whole renderer reads (shadow map, pixel ratio, post chain, grass,
 * textures, reflections, particle counts, view distances), plus `detectQuality()`, a cheap GPU heuristic the game uses
 * for its first-run default. Medium is the tier we budget for (≥ 50 fps on a 2021 laptop at 1280×720); High adds AO,
 * SMAA, denser grass and a larger, sharper shadow; Low drops textures and post entirely.
 */

export type { Quality };

export interface QualitySettings {
  /** device pixel ratio range for the Canvas `dpr` prop */
  dpr: [number, number];
  /** sun shadow map edge (texels); 0 disables shadows */
  shadowMapSize: number;
  /** half-extent of the sun's shadow box around the focus point, metres */
  shadowExtent: number;
  /** post-processing: none (renderer tone mapping only), basic (bloom + grade), full (+ AO + SMAA) */
  post: "none" | "basic" | "full";
  /** MSAA samples on the composer's render target (0 = off; SMAA covers High) */
  multisampling: number;
  /** PBR texture maps on structures and the terrain (Low shows the flat colours) */
  textures: boolean;
  /** terrain texture array edge (px) */
  terrainTextureSize: number;
  /** triplanar sampling on steep terrain */
  triplanar: boolean;
  /** fraction of the composed walk-through scatter (grass, flowers, reeds, crops) that is drawn */
  grassDensity: number;
  /** blades per grass clump */
  grassBlades: number;
  /** distance (m) beyond which small scatter (grass, flowers, mushrooms) fades out */
  smallDistance: number;
  /** distance (m) beyond which medium scatter (bushes, rocks, reeds) fades out */
  mediumDistance: number;
  /** trees and boulders cast sun shadows */
  treeShadows: boolean;
  /** environment (image-based lighting) cube size */
  envSize: number;
  /** weather particle count multiplier */
  particles: number;
  /** the outer ring of terrain from the map edge to the horizon */
  horizon: boolean;
  /** baked long-range sun shadows (terrain and landmarks) outside the shadow box */
  bakedShadows: boolean;
  /** planar reflections on water (a second, half-resolution scene render) */
  reflections: boolean;
}

export const QUALITY: Record<Quality, QualitySettings> = {
  low: {
    dpr: [0.75, 1],
    shadowMapSize: 1024,
    shadowExtent: 45,
    post: "none",
    multisampling: 0,
    textures: false,
    terrainTextureSize: 256,
    triplanar: false,
    grassDensity: 0,
    grassBlades: 6,
    smallDistance: 0,
    mediumDistance: 90,
    treeShadows: false,
    envSize: 64,
    particles: 0.35,
    horizon: true,
    bakedShadows: true,
    reflections: false,
  },
  medium: {
    dpr: [1, 1.5],
    shadowMapSize: 2048,
    shadowExtent: 70,
    post: "basic",
    multisampling: 4,
    textures: true,
    terrainTextureSize: 512,
    triplanar: true,
    grassDensity: 0.6,
    grassBlades: 10,
    smallDistance: 70,
    mediumDistance: 170,
    treeShadows: true,
    envSize: 128,
    particles: 0.7,
    horizon: true,
    bakedShadows: true,
    reflections: false,
  },
  high: {
    dpr: [1, 2],
    shadowMapSize: 4096,
    shadowExtent: 90,
    post: "full",
    multisampling: 0,
    textures: true,
    terrainTextureSize: 1024,
    triplanar: true,
    grassDensity: 1,
    grassBlades: 16,
    smallDistance: 110,
    mediumDistance: 260,
    treeShadows: true,
    envSize: 256,
    particles: 1,
    horizon: true,
    bakedShadows: true,
    reflections: true,
  },
};

export function qualitySettings(q: Quality | undefined): QualitySettings {
  return QUALITY[q ?? "high"] ?? QUALITY.high;
}

export interface GpuHints {
  /** WEBGL_debug_renderer_info UNMASKED_RENDERER_WEBGL (or the plain RENDERER string) */
  renderer: string;
  /** navigator.hardwareConcurrency */
  cores?: number;
  /** navigator.deviceMemory (GB, Chrome only) */
  memory?: number;
  mobile?: boolean;
  /** max texture size, a rough capability proxy */
  maxTextureSize?: number;
}

/**
 * Pure tier choice from GPU hints: software renderers and phones get Low; discrete GPUs and Apple silicon get High;
 * integrated Intel/AMD laptop GPUs get Medium (the tier we budget for); unknown GPUs get Medium.
 */
export function qualityFromGpu(h: GpuHints): Quality {
  const r = h.renderer.toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|software|microsoft basic/.test(r)) return "low";
  if (h.mobile) return /apple gpu|adreno \(tm\) 7|mali-g7[1-9]/.test(r) ? "medium" : "low";
  if (h.memory !== undefined && h.memory <= 2) return "low";
  if (h.cores !== undefined && h.cores <= 2) return "low";
  if (/apple m[1-9]|apple gpu/.test(r)) {
    // M-series: Pro/Max/Ultra (or any M2+) comfortably run High; the base M1 is fine too at laptop resolutions
    return "high";
  }
  if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|amd radeon\(tm\) rx|arc a[0-9]/.test(r)) return "high";
  if (/intel.*(uhd|hd graphics)|mali|adreno|powervr/.test(r)) return h.maxTextureSize !== undefined && h.maxTextureSize < 8192 ? "low" : "medium";
  return "medium";
}

/** Reads the GPU from a throwaway WebGL context (browser only; "medium" on the server or when WebGL is missing). */
export function detectQuality(): Quality {
  if (typeof window === "undefined" || typeof document === "undefined") return "medium";
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return "low";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    const nav = navigator as Navigator & { deviceMemory?: number };
    const q = qualityFromGpu({
      renderer,
      cores: nav.hardwareConcurrency,
      memory: nav.deviceMemory,
      mobile: /Android|iPhone|iPad|Mobile/i.test(nav.userAgent),
      maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
    });
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return q;
  } catch {
    return "medium";
  }
}
