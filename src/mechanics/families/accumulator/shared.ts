import { compile, type EvalFunction } from "mathjs";

/*
 * Shared accumulator machinery: compile f(x) with mathjs, integrate it with Simpson's rule, and sample it
 * for the widget's curve. The model writes `expr`; code computes every area, bound and sample.
 */

export function compileF(expr: string): EvalFunction | null {
  try {
    return compile(expr);
  } catch {
    return null;
  }
}

export function evalF(fn: EvalFunction, x: number): number | null {
  try {
    const v = fn.evaluate({ x });
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** Composite Simpson's rule on [a, b]; n is rounded up to the nearest even number, default 400. */
export function integrate(fn: EvalFunction, a: number, b: number, n = 400): number {
  const steps = n % 2 === 0 ? Math.max(2, n) : n + 1;
  if (a === b) return 0;
  const h = (b - a) / steps;
  let sum = (evalF(fn, a) ?? 0) + (evalF(fn, b) ?? 0);
  for (let i = 1; i < steps; i++) {
    const x = a + i * h;
    const y = evalF(fn, x) ?? 0;
    sum += (i % 2 === 0 ? 2 : 4) * y;
  }
  return (h / 3) * sum;
}

export function sampleCurve(fn: EvalFunction, a: number, b: number, n = 200): { x: number; y: number | null }[] {
  const out: { x: number; y: number | null }[] = [];
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const y = evalF(fn, x);
    out.push({ x: Math.round(x * 1e6) / 1e6, y: y === null ? null : Math.round(y * 1e6) / 1e6 });
  }
  return out;
}

export type Monotonic = "increasing" | "decreasing" | "non_monotonic";

/** Sampled monotonicity of f on [a, b]. Treats a function that fails to evaluate anywhere as non_monotonic. */
export function monotonicity(fn: EvalFunction, a: number, b: number, n = 100): Monotonic {
  let increasing = true;
  let decreasing = true;
  let prev = evalF(fn, a);
  if (prev === null) return "non_monotonic";
  for (let i = 1; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const v = evalF(fn, x);
    if (v === null) return "non_monotonic";
    if (v < prev - 1e-9) increasing = false;
    if (v > prev + 1e-9) decreasing = false;
    prev = v;
  }
  if (increasing) return "increasing";
  if (decreasing) return "decreasing";
  return "non_monotonic";
}

/** True when f(x) >= 0 (with a small tolerance) everywhere sampled on [a, b]. */
export function isNonNegative(fn: EvalFunction, a: number, b: number, n = 100): boolean {
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const v = evalF(fn, x);
    if (v === null || v < -1e-9) return false;
  }
  return true;
}
