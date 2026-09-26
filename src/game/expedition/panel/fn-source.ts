/**
 * panel/fn-source.ts — function sources for plots (docs/design/20 §3.2). Pure.
 * `closure` sources are built in JS from view numbers (the oscillator's A·sin(b t + c) + d); `expr` sources evaluate
 * an exact mathjs expression through the sandboxed evalExactAt (claim traces, reliefs). Samples are memoized per
 * (source, window, n) so a panel re-render never re-samples.
 */
import { evalExactAt } from "../../../mechanics/util";
import { sample, type Pt } from "../../../world/graph-math";
import type { OscillatorView } from "../../../world/types";

export type FnSource = { kind: "closure"; id: string; fn: (x: number) => number } | { kind: "expr"; expr: string; variable: string };

/** y = A·sin(b t + c) + d (or cos) from an oscillator view. */
export function oscillatorFn(v: Pick<OscillatorView, "wave" | "amplitude" | "b" | "c" | "d">): (t: number) => number {
  const f = v.wave === "cos" ? Math.cos : Math.sin;
  return (t: number) => v.amplitude * f(v.b * t + v.c) + v.d;
}
export function oscillatorSource(v: OscillatorView): FnSource {
  return { kind: "closure", id: `osc:${v.wave}:${v.amplitude}:${v.b}:${v.c}:${v.d}`, fn: oscillatorFn(v) };
}
export function exprSource(expr: string, variable = "x"): FnSource {
  return { kind: "expr", expr, variable };
}

/** Evaluates a source at x (NaN where the expression is undefined). */
export function evalSource(src: FnSource, x: number): number {
  if (src.kind === "closure") return src.fn(x);
  const v = evalExactAt(src.expr, { [src.variable]: x });
  return v === null ? Number.NaN : v;
}

const CACHE = new Map<string, Pt[][]>();
const CACHE_MAX = 64;

/** Memoized graph-math.sample of a source over [x0, x1]. */
export function sampleSource(src: FnSource, x0: number, x1: number, n = 240): Pt[][] {
  const key = `${src.kind === "closure" ? src.id : `${src.variable}=>${src.expr}`}|${x0}|${x1}|${n}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const out = sample((x) => evalSource(src, x), x0, x1, n);
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value as string);
  CACHE.set(key, out);
  return out;
}
