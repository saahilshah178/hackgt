/**
 * src/game/art/kit/registry.ts — the late-bound generator table, so compose/scatter can run child generators
 * without an import cycle. `index.ts` fills it; everything else calls `runKit()`.
 */
import type { KitGenerator, KitName, KitResult } from "./types";

const REGISTRY = new Map<KitName, KitGenerator<unknown>>();

export function registerKit(gen: KitGenerator<unknown>): void {
  REGISTRY.set(gen.name, gen);
}
export function kitGenerator(name: KitName): KitGenerator<unknown> {
  const g = REGISTRY.get(name);
  if (!g) throw new Error(`unknown kit generator "${name}"`);
  return g;
}

function isPlain(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
/** Deep merge of plain objects (params over defaults); arrays, primitives and null replace. */
export function mergeParams(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (!isPlain(base) || !isPlain(over)) return over;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = mergeParams(base[k], v);
  return out;
}

/** Params merged over the generator's defaults, then validated. Throws a ZodError naming the bad field. */
export function parseKitParams(name: KitName, params: unknown): unknown {
  const g = kitGenerator(name);
  return g.schema.parse(mergeParams(g.defaults, params ?? {}));
}

/** Run a generator by name on (partial) params and a seed. Deterministic. */
export function runKit(name: KitName, params: unknown, seed: number): KitResult {
  const g = kitGenerator(name);
  return g.generate(parseKitParams(name, params), seed >>> 0);
}
