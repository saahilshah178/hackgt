import type { ScatterKind } from "../../../contracts/world3d";

/*
 * Pure helpers for instancing the composed scatter: split a batch (stride 5: x, y, z, yaw, scale) into square spatial
 * chunks (frustum culling and distance culling per chunk), pick a geometry variant per instance, thin walk-through kinds
 * by the quality tier, and derive each instance's colour jitter. Deterministic: hashes of the position, never
 * Math.random.
 */

export interface ChunkGroup {
  key: string;
  /** chunk centre on the ground plane */
  cx: number;
  cz: number;
  variant: number;
  /** instance indices into the batch */
  items: number[];
}

/** Chunk edge per kind: small dense kinds get small chunks (tight distance culling), trees big ones (fewer draws). */
export const CHUNK_SIZE: Record<ScatterKind, number> = {
  palm: 140,
  conifer: 140,
  broadleaf: 140,
  birch: 140,
  dead_tree: 180,
  bush: 180,
  reeds: 70,
  tall_grass: 48,
  flowers: 56,
  cactus: 180,
  rock: 180,
  boulder: 240,
  crystal: 180,
  mushroom: 64,
  coral: 90,
  ice_shard: 180,
  crop: 56,
};

/** 0..1 stable hash of a position (and a salt). */
export function positionHash(x: number, z: number, salt = 0): number {
  let h = Math.imul(Math.round(x * 10) | 0, 0x27d4eb2d) ^ Math.imul(Math.round(z * 10) | 0, 0x165667b1) ^ Math.imul(salt + 1, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function chunkBatch(data: Float32Array, count: number, chunkSize: number, variants: number, keep: (i: number) => boolean = () => true): ChunkGroup[] {
  const groups = new Map<string, ChunkGroup>();
  for (let i = 0; i < count; i++) {
    if (!keep(i)) continue;
    const x = data[i * 5];
    const z = data[i * 5 + 2];
    const gx = Math.floor(x / chunkSize);
    const gz = Math.floor(z / chunkSize);
    const variant = variants > 1 ? Math.min(variants - 1, Math.floor(positionHash(x, z, 7) * variants)) : 0;
    const key = `${gx}:${gz}:${variant}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, cx: (gx + 0.5) * chunkSize, cz: (gz + 0.5) * chunkSize, variant, items: [] };
      groups.set(key, g);
    }
    g.items.push(i);
  }
  return [...groups.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** Keeps a deterministic `fraction` of instances (quality thinning of grass-like kinds). */
export function thinning(data: Float32Array, fraction: number): (i: number) => boolean {
  if (fraction >= 1) return () => true;
  if (fraction <= 0) return () => false;
  return (i) => positionHash(data[i * 5], data[i * 5 + 2], 3) < fraction;
}

/** Per-instance colour multiplier: a little brightness and warmth variation so copies never look cloned. */
export function instanceTint(x: number, z: number, amount: number): [number, number, number] {
  const a = positionHash(x, z, 11) * 2 - 1;
  const b = positionHash(x, z, 13) * 2 - 1;
  const l = 1 + a * amount;
  return [l * (1 + b * amount * 0.35), l, l * (1 - b * amount * 0.45)];
}
