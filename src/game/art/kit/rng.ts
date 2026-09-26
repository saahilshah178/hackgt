/**
 * src/game/art/kit/rng.ts — seeded randomness for the kit (02 §3a.1). No npm dependency, no Math.random.
 */

/** mulberry32: a tiny, fast, well-distributed 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash of a string: the default seed of a fragment entry (`seed = entry.seed ?? fnv1a32(key)`). */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 8 hex chars of fnv1a32: the per-key id prefix `k<hash8(key)>_`. */
export function hash8(s: string): string {
  return fnv1a32(s).toString(16).padStart(8, "0");
}

/** A seeded random source with the helpers the generators use. */
export interface Rng {
  next(): number; // [0, 1)
  range(lo: number, hi: number): number; // uniform in [lo, hi)
  int(lo: number, hi: number): number; // integer in [lo, hi] inclusive
  jitter(v: number, amount: number): number; // v ± amount
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  shuffle<T>(items: readonly T[]): T[];
}

export function rng(seed: number): Rng {
  const next = mulberry32(seed);
  const r: Rng = {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => Math.min(hi, lo + Math.floor((hi - lo + 1) * next())),
    jitter: (v, amount) => v + (next() * 2 - 1) * amount,
    pick: (items) => items[Math.min(items.length - 1, Math.floor(next() * items.length))],
    chance: (p) => next() < p,
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
  return r;
}

/** A derived seed for a sub-stream (variant i of a scatter, child j of a compose). Stable and well mixed. */
export function subSeed(seed: number, salt: number | string): number {
  return fnv1a32(`${seed >>> 0}:${salt}`);
}
