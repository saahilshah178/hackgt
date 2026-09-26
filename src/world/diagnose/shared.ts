/**
 * src/world/diagnose/shared.ts (V1) — the per-mode mirror contract (docs/design/20 §2.5.4, amendment 11).
 *
 * Each mode file mirrors its mode's `grade()` ORDER exactly, reading params + solution + input (never changing the
 * mode). The parity test (diagnose.test.ts) pins every mirror to `grade()`: same `correct`, and the `needle` (the
 * text the mirror expects `grade().feedback` to contain) is in the feedback. Inputs may be malformed (a runner
 * bug, a hand-built test): mirrors never throw.
 */
import type { FailKey, ModeKey } from "../types";

export interface MirrorArgs {
  params: unknown;
  view: unknown;
  solution: unknown;
  input: unknown;
}
export interface Mirror {
  correct: boolean;
  failKey: FailKey | null;
  wrongKeys: readonly string[];
  prefix: number | null;
  disclosed: Readonly<Record<string, string | number>>;
  /** text grade().feedback must contain (the parity needle); null when correct */
  needle: string | null;
}
export interface ModeDiagnoser {
  modeKey: ModeKey;
  failKeys: readonly FailKey[];
  mirror(a: MirrorArgs): Mirror;
}

export const CORRECT: Mirror = { correct: true, failKey: null, wrongKeys: [], prefix: null, disclosed: {}, needle: null };
export function miss(failKey: FailKey, needle: string, wrongKeys: readonly string[] = [], extra: Partial<Pick<Mirror, "prefix" | "disclosed">> = {}): Mirror {
  return { correct: false, failKey, wrongKeys, prefix: extra.prefix ?? null, disclosed: extra.disclosed ?? {}, needle };
}

// ---------------------------------------------------------------- defensive readers

export function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
export function field(v: unknown, k: string): unknown {
  return isObj(v) ? v[k] : undefined;
}
export function arr(v: unknown, k: string): unknown[] {
  const a = field(v, k);
  return Array.isArray(a) ? a : [];
}
export function num(v: unknown, k: string): number | null {
  const x = field(v, k);
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}
export function str(v: unknown, k: string): string | null {
  const x = field(v, k);
  return typeof x === "string" ? x : null;
}
/** "l3" → 3; NaN when there is no index. */
export function keyIndex(key: string): number {
  return Number(key.slice(1));
}
/** The i-th string of params[k] (or of params[k][i][sub]). */
export function textAt(params: unknown, k: string, i: number, sub?: string): string | undefined {
  const row = arr(params, k)[i];
  if (sub === undefined) return typeof row === "string" ? row : undefined;
  const t = field(row, sub);
  return typeof t === "string" ? t : undefined;
}
