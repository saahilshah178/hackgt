import { compile, type EvalFunction } from "mathjs";
import { evalExact } from "../../util";

/*
 * Shared function-world machinery: a piecewise function y = f(x) defined by mathjs expressions on
 * intervals, plus point overrides (a hole, or a "decoy" value at one x). Everything is computed by
 * code; the model only writes the pieces as exact expressions.
 */

export interface PieceParams {
  expr: string;
  from: string; // exact expression or "-inf"
  to: string; // exact expression or "inf"
  openLeft: boolean;
  openRight: boolean;
}

export interface OverrideParams {
  x: string;
  /** exact expression, or null for a hole (f undefined at x) */
  y: string | null;
}

export interface CompiledPiece {
  fn: EvalFunction;
  from: number;
  to: number;
  openLeft: boolean;
  openRight: boolean;
  expr: string;
}

export interface CompiledFunction {
  pieces: CompiledPiece[];
  overrides: { x: number; y: number | null }[];
}

export function evalBound(s: string): number | null {
  const t = s.trim().toLowerCase();
  if (t === "-inf" || t === "-infinity" || t === "-∞") return -Infinity;
  if (t === "inf" || t === "infinity" || t === "∞" || t === "+inf") return Infinity;
  return evalExact(s);
}

/** Compiles the pieces; throws with an actionable message when an expression is bad. */
export function compileFunction(pieces: PieceParams[], overrides: OverrideParams[]): CompiledFunction {
  const compiled: CompiledPiece[] = pieces.map((p, i) => {
    const from = evalBound(p.from);
    const to = evalBound(p.to);
    if (from === null || to === null) throw new Error(`pieces[${i}]: from/to must be exact numbers or inf`);
    let fn: EvalFunction;
    try {
      fn = compile(p.expr);
    } catch {
      throw new Error(`pieces[${i}].expr "${p.expr}" is not a valid mathjs expression`);
    }
    return { fn, from, to, openLeft: p.openLeft, openRight: p.openRight, expr: p.expr };
  });
  const ov = overrides.map((o, i) => {
    const x = evalExact(o.x);
    const y = o.y === null ? null : evalExact(o.y);
    if (x === null || (o.y !== null && y === null)) throw new Error(`overrides[${i}] must use exact numbers`);
    return { x, y };
  });
  return { pieces: compiled, overrides: ov };
}

function inPiece(p: CompiledPiece, x: number): boolean {
  const left = p.openLeft ? x > p.from : x >= p.from;
  const right = p.openRight ? x < p.to : x <= p.to;
  return left && right;
}

/** f(x): the override wins, then the first piece containing x; undefined -> null. NaN/complex -> null. */
export function evaluateAt(f: CompiledFunction, x: number): number | null {
  const o = f.overrides.find((v) => Math.abs(v.x - x) < 1e-12);
  if (o) return o.y;
  const piece = f.pieces.find((p) => inPiece(p, x));
  if (!piece) return null;
  try {
    const v = piece.fn.evaluate({ x }) as unknown;
    return typeof v === "number" && !Number.isNaN(v) ? v : null;
  } catch {
    return null;
  }
}

/** Like evaluateAt but ignores overrides (the "path" the player walks along). */
export function evaluatePath(f: CompiledFunction, x: number): number | null {
  const piece = f.pieces.find((p) => inPiece(p, x));
  if (!piece) return null;
  try {
    const v = piece.fn.evaluate({ x }) as unknown;
    return typeof v === "number" && !Number.isNaN(v) ? v : null;
  } catch {
    return null;
  }
}

export type SideLimit = { kind: "value"; value: number } | { kind: "pos_infinity" } | { kind: "neg_infinity" } | { kind: "dne" };

/** Numeric one-sided limit by shrinking h: 1e-2 … 1e-7. Detects blow-ups and oscillation. */
export function sideLimit(f: CompiledFunction, a: number, side: "left" | "right"): SideLimit {
  const sign = side === "left" ? -1 : 1;
  const hs = [1e-2, 1e-3, 1e-4, 1e-5, 1e-6, 1e-7];
  const values: number[] = [];
  for (const h of hs) {
    const v = evaluatePath(f, a + sign * h);
    if (v === null || !Number.isFinite(v)) return { kind: "dne" };
    values.push(v);
  }
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  const growing = values.every((v, i) => i === 0 || Math.abs(v) >= Math.abs(values[i - 1]) * 2);
  if (Math.abs(last) > 1e5 && growing) return last > 0 ? { kind: "pos_infinity" } : { kind: "neg_infinity" };
  if (Math.abs(last - prev) <= 1e-5 * (1 + Math.abs(last))) {
    // Richardson-style nudge: the sequence converges roughly linearly in h, so the last value is within ~1e-7.
    return { kind: "value", value: Math.round(last * 1e6) / 1e6 };
  }
  return { kind: "dne" };
}

export function combineLimits(left: SideLimit, right: SideLimit): SideLimit {
  if (left.kind === "value" && right.kind === "value") {
    return Math.abs(left.value - right.value) <= 1e-5 * (1 + Math.abs(left.value)) ? { kind: "value", value: (left.value + right.value) / 2 } : { kind: "dne" };
  }
  if (left.kind === right.kind && left.kind !== "dne") return left;
  return { kind: "dne" };
}

export function limitLabel(l: SideLimit): string {
  switch (l.kind) {
    case "value":
      return String(Math.round(l.value * 1000) / 1000);
    case "pos_infinity":
      return "+∞";
    case "neg_infinity":
      return "−∞";
    default:
      return "DNE";
  }
}

/** Samples the path for the plotter: n points per piece within [xMin, xMax]; null where undefined or off-screen. */
export function samplePath(f: CompiledFunction, xMin: number, xMax: number, n = 240): { x: number; y: number | null }[] {
  const out: { x: number; y: number | null }[] = [];
  for (let i = 0; i <= n; i++) {
    const x = xMin + ((xMax - xMin) * i) / n;
    const y = evaluatePath(f, x);
    out.push({ x: Math.round(x * 1e6) / 1e6, y: y === null || !Number.isFinite(y) || Math.abs(y) > 1e4 ? null : Math.round(y * 1e6) / 1e6 });
  }
  return out;
}
