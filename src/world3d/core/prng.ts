/*
 * Deterministic randomness for world building. Nothing in src/world3d uses Math.random: the same World3D and seed must
 * give the same world on the server (checks, digest) and in every browser.
 */

export type Rng = () => number;

/** mulberry32: small, fast, good enough for layout and scatter. Returns floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over a string, for deriving stable sub-seeds ("scatter:palm", "cluster:village_1"). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A child generator for one named purpose, so adding a new consumer never shifts another's sequence. */
export function subRng(seed: number, label: string): Rng {
  return mulberry32((seed ^ hashString(label)) >>> 0);
}

export const range = (rng: Rng, min: number, max: number) => min + (max - min) * rng();
export const intRange = (rng: Rng, min: number, maxInclusive: number) => Math.floor(range(rng, min, maxInclusive + 1));
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}
/** Standard normal via Box-Muller. */
export function gaussian(rng: Rng): number {
  const u = Math.max(rng(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
