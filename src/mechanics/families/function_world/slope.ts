import { compile, derivative as mathDerivative } from "mathjs";
import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, prettyExpr, trimNumber } from "../../util";
import { compileFunction, evaluatePath, samplePath, type CompiledFunction } from "./shared";

/*
 * function_world · slope: the world's geometry is y = f(x); the player scrubs a tangent scanner across
 * curved terrain. `ask` picks what they must report: the sign of f' at a, the steepest point, every
 * critical point, the concavity at a, or every inflection point. Code derives every derivative and root;
 * the model only writes the terrain and, when needed, the x it's asking about.
 * Cards: slope_scanner, momentum_direction, zero_force_zones, curvature_gravity, gravity_flip.
 */

const Piece = z.object({
  expr: z.string().describe('mathjs expression in x, e.g. "x^3 - 3*x" or "sin(x)"'),
  from: z.string().describe('Left end of this piece as an exact expression, or "-inf"'),
  to: z.string().describe('Right end as an exact expression, or "inf"'),
  openLeft: z.boolean().describe("true when the piece does NOT include its left endpoint"),
  openRight: z.boolean().describe("true when the piece does NOT include its right endpoint"),
});

const Ask = z.enum(["sign_at", "steepest", "critical_points", "concavity_at", "inflection_points"]);
export type Ask = z.infer<typeof Ask>;

const Params = z.object({
  pieces: z
    .array(Piece)
    .min(1)
    .max(4)
    .describe("Piecewise definition of the terrain, left to right, non-overlapping. One smooth piece is fine."),
  xMin: z.string().describe("Left edge of the visible world, exact"),
  xMax: z.string().describe("Right edge of the visible world, exact"),
  ask: Ask.describe(
    "What the player must report: sign_at (sign of f' at a), steepest (where |f'| is largest), " +
      "critical_points (every x with f'=0), concavity_at (concave up/down at a), inflection_points (where concavity flips)",
  ),
  a: z
    .string()
    .nullable()
    .describe('The x the question is about, exact. Required (non-null) for sign_at and concavity_at; null for the others'),
});
type Params = z.infer<typeof Params>;

interface Solution {
  ask: Ask;
  a: number | null;
  xMin: number;
  xMax: number;
  sign: "positive" | "negative" | "zero" | null;
  x: number | null;
  xs: number[] | null;
  concavity: "up" | "down" | null;
  answerLabel: string;
}

type Input = { sign: "positive" | "negative" | "zero" } | { x: number } | { xs: number[] } | { concavity: "up" | "down" };

interface View {
  ask: Ask;
  a: number | null;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  samples: { x: number; y: number | null }[];
  pieces: string[];
}

const TOL_FRAC = 0.03; // 3% of the x range, for point positions
const SIGN_ZERO_FRAC = 0.02;
const SIGN_AMBIG_FRAC = 0.08;
const GRID_N = 500;

function nums(p: Params) {
  return { xMin: evalExact(p.xMin), xMax: evalExact(p.xMax), a: p.a === null ? null : evalExact(p.a) };
}

/** Analytic derivative when the expression differentiates cleanly, else null (caller falls back to central differences). */
function analyticDerivative(expr: string): ((x: number) => number | null) | null {
  try {
    const d = mathDerivative(expr, "x");
    const compiled = compile(d.toString());
    return (x: number) => {
      try {
        const v = compiled.evaluate({ x }) as unknown;
        return typeof v === "number" && Number.isFinite(v) ? v : null;
      } catch {
        return null;
      }
    };
  } catch {
    return null;
  }
}

function pieceAt(f: CompiledFunction, x: number) {
  return f.pieces.findIndex((p) => {
    const left = p.openLeft ? x > p.from : x >= p.from;
    const right = p.openRight ? x < p.to : x <= p.to;
    return left && right;
  });
}

/** f'(x): analytic per-piece when mathjs can differentiate that piece's expression, else central differences. */
function buildDerivative(f: CompiledFunction, xMin: number, xMax: number): (x: number) => number | null {
  const analytics = f.pieces.map((p) => analyticDerivative(p.expr));
  const h = Math.max(1e-6, (xMax - xMin) * 1e-5);
  return (x: number) => {
    const idx = pieceAt(f, x);
    if (idx >= 0 && analytics[idx]) {
      const v = analytics[idx]!(x);
      if (v !== null) return v;
    }
    const y1 = evaluatePath(f, x - h);
    const y2 = evaluatePath(f, x + h);
    if (y1 === null || y2 === null) return null;
    return (y2 - y1) / (2 * h);
  };
}

/** f''(x) via central differences on f'. */
function buildSecondDerivative(fPrime: (x: number) => number | null, xMin: number, xMax: number): (x: number) => number | null {
  const h = Math.max(1e-4, (xMax - xMin) * 1e-4);
  return (x: number) => {
    const y1 = fPrime(x - h);
    const y2 = fPrime(x + h);
    if (y1 === null || y2 === null) return null;
    return (y2 - y1) / (2 * h);
  };
}

/** All sign-change roots of fn in (xMin, xMax), refined by bisection, ascending order. */
function findRoots(fn: (x: number) => number | null, xMin: number, xMax: number, n = GRID_N): number[] {
  const xs: number[] = [];
  const ys: (number | null)[] = [];
  for (let i = 0; i <= n; i++) {
    const x = xMin + ((xMax - xMin) * i) / n;
    xs.push(x);
    ys.push(fn(x));
  }
  const roots: number[] = [];
  for (let i = 0; i < n; i++) {
    const y0 = ys[i];
    const y1 = ys[i + 1];
    if (y0 === null || y1 === null) continue;
    if (y0 === 0) {
      roots.push(xs[i]);
      continue;
    }
    if (y0 * y1 < 0) {
      let lo = xs[i];
      let hi = xs[i + 1];
      let flo = y0;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        const fm = fn(mid);
        if (fm === null) break;
        if (fm === 0) {
          lo = mid;
          hi = mid;
          break;
        }
        if (fm > 0 === flo > 0) {
          lo = mid;
          flo = fm;
        } else {
          hi = mid;
        }
      }
      roots.push((lo + hi) / 2);
    }
  }
  return roots;
}

function maxAbsOverGrid(fn: (x: number) => number | null, xMin: number, xMax: number, n = GRID_N): number {
  let best = 0;
  for (let i = 0; i <= n; i++) {
    const x = xMin + ((xMax - xMin) * i) / n;
    const v = fn(x);
    if (v !== null) best = Math.max(best, Math.abs(v));
  }
  return best;
}

interface SteepestResult {
  x: number;
  value: number;
  ambiguous: boolean;
}

function findSteepest(fPrime: (x: number) => number | null, xMin: number, xMax: number, n = GRID_N): SteepestResult {
  const range = xMax - xMin;
  const xs: number[] = [];
  const vs: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = xMin + (range * i) / n;
    const fp = fPrime(x);
    xs.push(x);
    vs.push(fp === null ? -Infinity : Math.abs(fp));
  }
  let bestIdx = 0;
  for (let i = 1; i < vs.length; i++) if (vs[i] > vs[bestIdx]) bestIdx = i;
  const bestValue = vs[bestIdx];
  // Refine near the grid winner with a ternary search assuming local unimodality.
  let lo = xs[Math.max(0, bestIdx - 2)];
  let hi = xs[Math.min(xs.length - 1, bestIdx + 2)];
  for (let k = 0; k < 60; k++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    const v1 = Math.abs(fPrime(m1) ?? -Infinity);
    const v2 = Math.abs(fPrime(m2) ?? -Infinity);
    if (v1 < v2) lo = m1;
    else hi = m2;
  }
  const refinedX = (lo + hi) / 2;
  const refinedValue = Math.abs(fPrime(refinedX) ?? bestValue);
  // Ambiguity: a second local max far away, within 3% relative of the winner.
  let ambiguous = false;
  for (let i = 1; i < vs.length - 1; i++) {
    if (vs[i] <= 0 || !Number.isFinite(vs[i])) continue;
    if (vs[i] >= vs[i - 1] && vs[i] >= vs[i + 1]) {
      const farEnough = Math.abs(xs[i] - refinedX) > TOL_FRAC * range;
      const tooClose = refinedValue > 0 && Math.abs(vs[i] - refinedValue) <= 0.03 * refinedValue;
      if (farEnough && tooClose) ambiguous = true;
    }
  }
  return { x: refinedX, value: refinedValue, ambiguous };
}

interface Analysis {
  problems: string[];
  solution: Solution | null;
  view: { xMin: number; xMax: number; a: number | null; f: CompiledFunction };
}

function analyze(p: Params): Analysis {
  const problems: string[] = [];
  const { xMin, xMax, a } = nums(p);
  if (xMin === null || xMax === null) {
    problems.push("xMin and xMax must evaluate to exact numbers");
    return { problems, solution: null, view: { xMin: 0, xMax: 0, a: null, f: { pieces: [], overrides: [] } } };
  }
  if (!(xMin < xMax)) problems.push("xMin must be less than xMax");
  const needsA = p.ask === "sign_at" || p.ask === "concavity_at";
  if (needsA && a === null) problems.push(`ask "${p.ask}" needs a non-null "a"`);
  if (!needsA && p.a !== null) problems.push(`ask "${p.ask}" does not use "a"; set it to null`);
  const buf = TOL_FRAC * (xMax - xMin);
  if (needsA && a !== null && !(a > xMin + buf && a < xMax - buf)) {
    problems.push(`"a" must sit well inside [xMin, xMax] (more than ${trimNumber(buf)} from either edge) so the tangent can be measured`);
  }

  let f: CompiledFunction;
  try {
    f = compileFunction(p.pieces, []);
  } catch (err) {
    problems.push(err instanceof Error ? err.message : String(err));
    return { problems, solution: null, view: { xMin, xMax, a, f: { pieces: [], overrides: [] } } };
  }
  for (let i = 0; i < f.pieces.length; i++) {
    const pc = f.pieces[i];
    if (!(pc.from < pc.to)) problems.push(`pieces[${i}]: from must be less than to`);
    for (let j = i + 1; j < f.pieces.length; j++) {
      const q = f.pieces[j];
      if (pc.to > q.from + 1e-12 && q.to > pc.from + 1e-12) problems.push(`pieces[${i}] and pieces[${j}] overlap; pieces must be non-overlapping`);
    }
  }
  if (problems.length > 0) return { problems, solution: null, view: { xMin, xMax, a, f } };

  const fPrime = buildDerivative(f, xMin, xMax);
  const fSecond = buildSecondDerivative(fPrime, xMin, xMax);

  let solution: Solution | null = null;

  if (p.ask === "sign_at") {
    const fp = a === null ? null : fPrime(a);
    if (fp === null) {
      problems.push("the slope is undefined at that x; move a onto a piece where the terrain is smooth");
    } else {
      const scale = maxAbsOverGrid(fPrime, xMin, xMax);
      const zeroBand = SIGN_ZERO_FRAC * scale;
      const ambigBand = SIGN_AMBIG_FRAC * scale;
      if (scale < 1e-9 || Math.abs(fp) <= zeroBand) {
        solution = { ask: p.ask, a, xMin, xMax, sign: "zero", x: null, xs: null, concavity: null, answerLabel: "zero" };
      } else if (Math.abs(fp) <= ambigBand) {
        problems.push("f' at a is too close to zero to grade confidently; move a away from the flat spot");
      } else {
        const sign = fp > 0 ? "positive" : "negative";
        solution = { ask: p.ask, a, xMin, xMax, sign, x: null, xs: null, concavity: null, answerLabel: sign };
      }
    }
  } else if (p.ask === "concavity_at") {
    const fpp = a === null ? null : fSecond(a);
    if (fpp === null) {
      problems.push("the curvature is undefined at that x; move a onto a piece where the terrain is smooth");
    } else {
      const scale = maxAbsOverGrid(fSecond, xMin, xMax);
      const zeroBand = SIGN_ZERO_FRAC * scale;
      const ambigBand = SIGN_AMBIG_FRAC * scale;
      if (scale < 1e-9 || Math.abs(fpp) <= zeroBand) {
        problems.push("f'' at a is essentially zero (an inflection point, not a clear concavity); move a away from it");
      } else if (Math.abs(fpp) <= ambigBand) {
        problems.push("f'' at a is too close to zero to grade confidently; move a away from the flip");
      } else {
        const concavity = fpp > 0 ? "up" : "down";
        solution = { ask: p.ask, a, xMin, xMax, sign: null, x: null, xs: null, concavity, answerLabel: concavity };
      }
    }
  } else if (p.ask === "steepest") {
    const { x, value, ambiguous } = findSteepest(fPrime, xMin, xMax);
    if (value < 1e-9) {
      problems.push("the slope barely changes anywhere in [xMin, xMax]; there is no clear steepest point");
    } else if (ambiguous) {
      problems.push("two or more spots tie for steepest; reshape the terrain so one point is clearly steepest");
    } else if (!(x > xMin + buf && x < xMax - buf)) {
      problems.push("the steepest point sits at the edge of the domain; widen [xMin, xMax] so the peak is interior");
    } else {
      solution = { ask: p.ask, a: null, xMin, xMax, sign: null, x, xs: null, concavity: null, answerLabel: `x ≈ ${trimNumber(x)}` };
    }
  } else if (p.ask === "critical_points") {
    const roots = findRoots(fPrime, xMin, xMax).filter((r) => r > xMin + buf && r < xMax - buf);
    if (roots.length === 0) {
      problems.push("no critical points exist inside [xMin, xMax]; give the terrain a turn or widen the range");
    } else {
      let ambiguous = false;
      for (let i = 0; i < roots.length; i++) for (let j = i + 1; j < roots.length; j++) if (Math.abs(roots[i] - roots[j]) < buf) ambiguous = true;
      if (ambiguous) {
        problems.push("two critical points are closer together than the grading tolerance; separate them");
      } else {
        solution = {
          ask: p.ask,
          a: null,
          xMin,
          xMax,
          sign: null,
          x: null,
          xs: roots,
          concavity: null,
          answerLabel: `x = ${roots.map((r) => trimNumber(r)).join(", ")}`,
        };
      }
    }
  } else {
    const roots = findRoots(fSecond, xMin, xMax).filter((r) => r > xMin + buf && r < xMax - buf);
    if (roots.length === 0) {
      problems.push("no inflection points exist inside [xMin, xMax]; give the curvature a flip or widen the range");
    } else {
      let ambiguous = false;
      for (let i = 0; i < roots.length; i++) for (let j = i + 1; j < roots.length; j++) if (Math.abs(roots[i] - roots[j]) < buf) ambiguous = true;
      if (ambiguous) {
        problems.push("two inflection points are closer together than the grading tolerance; separate them");
      } else {
        solution = {
          ask: p.ask,
          a: null,
          xMin,
          xMax,
          sign: null,
          x: null,
          xs: roots,
          concavity: null,
          answerLabel: `x = ${roots.map((r) => trimNumber(r)).join(", ")}`,
        };
      }
    }
  }

  return { problems, solution, view: { xMin, xMax, a, f } };
}

function solve(p: Params): Solution {
  const { problems, solution } = analyze(p);
  if (problems.length > 0 || solution === null) throw new Error(`function_world.slope: ${problems.join("; ") || "no answer"}`);
  return solution;
}

function describeAsk(ask: Ask): string {
  switch (ask) {
    case "sign_at":
      return "the sign of the slope";
    case "steepest":
      return "the steepest point";
    case "critical_points":
      return "the critical points";
    case "concavity_at":
      return "the concavity";
    case "inflection_points":
      return "the inflection points";
  }
}

export const slope = defineMode({
  id: "slope",
  name: "Slope",
  implemented: true,
  blindSolvable: false,
  widget: "place",
  knowledgeTypes: ["quantitative"],
  directorBlurb:
    "The floor is y = f(x); the player scrubs a tangent scanner across the terrain and reports the sign of the slope, the steepest point, every critical point, the concavity, or every inflection point. Derivatives, critical points, concavity, inflection points.",
  authoringGuide: [
    'Write f as 1-4 exact pieces; a single smooth piece is enough for most cards, e.g. { expr: "x^3 - 3*x", from: "-inf", to: "inf", openLeft: false, openRight: false }.',
    'Pick ask and, only for sign_at and concavity_at, an exact "a" placed well inside [xMin, xMax]; leave a null for steepest, critical_points, and inflection_points.',
    "Never write the sign, the steepest x, the critical points, the concavity, or the inflection points yourself; code finds every one of them from the terrain.",
    "Keep the terrain smooth enough that the requested answer is unambiguous: one clear sign at a, one clear peak in |f'|, well-separated critical or inflection points.",
    "Placeholders: {{ask}}, {{a}} (only set when ask needs it), {{answer}} (the computed answer: last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (looksApproximated(p.xMin) || looksApproximated(p.xMax)) problems.push("xMin and xMax must be exact, not rounded decimals");
    if (p.a !== null && looksApproximated(p.a)) problems.push('"a" looks like a rounded decimal; write it exactly');
    p.pieces.forEach((pc, i) => {
      if (looksApproximated(pc.from) || looksApproximated(pc.to)) problems.push(`pieces[${i}] endpoints look like rounded decimals; write them exactly`);
    });
    if (problems.length > 0) return problems;
    return analyze(p).problems;
  },
  resolve: solve,
  templateVars(p, s) {
    const vars: Record<string, string> = { ask: describeAsk(p.ask), answer: s.answerLabel };
    if (s.a !== null) vars.a = prettyExpr(p.a!);
    return vars;
  },
  answerVars: ["answer"],
  present(p, _seed): View {
    const { view } = analyze(p);
    const samples = samplePath(view.f, view.xMin, view.xMax);
    const ys = samples.map((s) => s.y).filter((y): y is number => y !== null);
    let yMin = -5;
    let yMax = 5;
    if (ys.length > 0) {
      const sorted = [...ys].sort((x, y) => x - y);
      const lo = sorted[Math.floor(sorted.length * 0.05)];
      const hi = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
      const pad = Math.max(1, (hi - lo) * 0.15);
      yMin = Math.floor((lo - pad) * 2) / 2;
      yMax = Math.ceil((hi + pad) * 2) / 2;
    }
    return {
      ask: p.ask,
      a: view.a,
      xMin: view.xMin,
      xMax: view.xMax,
      yMin,
      yMax,
      samples,
      pieces: p.pieces.map((pc) => prettyExpr(pc.expr)),
    };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const tol = TOL_FRAC * (s.xMax - s.xMin);
    if (s.ask === "sign_at") {
      const inp = input as { sign: "positive" | "negative" | "zero" };
      if (inp.sign === s.sign) return { correct: true, feedback: "That's the direction the terrain pushes right there." };
      return {
        correct: false,
        feedback: `Scan the tangent again right at x = ${prettyExpr(p.a!)}: is the terrain rising, falling, or flat there? You answered ${inp.sign}.`,
      };
    }
    if (s.ask === "concavity_at") {
      const inp = input as { concavity: "up" | "down" };
      if (inp.concavity === s.concavity) return { correct: true, feedback: "That's how the slope itself is bending there." };
      return {
        correct: false,
        feedback: `Watch how the slope changes just before and after x = ${prettyExpr(p.a!)}, not just whether f rises or falls. You answered ${inp.concavity}.`,
      };
    }
    if (s.ask === "steepest") {
      const inp = input as { x: number };
      if (Math.abs(inp.x - s.x!) <= tol) return { correct: true, feedback: "The tangent is tilted furthest from flat right there." };
      const dir = inp.x < s.x! ? "right" : "left";
      return { correct: false, feedback: `Not the steepest spot yet; slide the scanner ${dir} and compare how tilted the tangent gets.` };
    }
    if (s.ask === "critical_points") {
      const inp = input as { xs: number[] };
      const { missingCount, extraCount, extraValues } = matchSets(s.xs!, inp.xs, tol);
      if (missingCount === 0 && extraCount === 0) return { correct: true, feedback: "Every zero-force zone is marked." };
      if (extraCount > 0) {
        return {
          correct: false,
          feedback: `Near x ≈ ${trimNumber(extraValues[0])} the slope isn't actually flat; recheck the tangent there.`,
        };
      }
      return {
        correct: false,
        feedback: `You found ${s.xs!.length - missingCount} of ${s.xs!.length} zero-force zones; keep scanning the rest of the terrain.`,
      };
    }
    // inflection_points
    const inp = input as { xs: number[] };
    const { missingCount, extraCount, extraValues } = matchSets(s.xs!, inp.xs, tol);
    if (missingCount === 0 && extraCount === 0) return { correct: true, feedback: "Every curvature flip is marked." };
    if (extraCount > 0) {
      return { correct: false, feedback: `Near x ≈ ${trimNumber(extraValues[0])} the curvature doesn't actually flip; recheck how the slope is bending there.` };
    }
    return {
      correct: false,
      feedback: `You found ${s.xs!.length - missingCount} of ${s.xs!.length} inflection points; keep scanning for where curvature flips.`,
    };
  },
  solutionInput(_p, s): Input {
    switch (s.ask) {
      case "sign_at":
        return { sign: s.sign! };
      case "steepest":
        return { x: s.x! };
      case "critical_points":
        return { xs: s.xs! };
      case "concavity_at":
        return { concavity: s.concavity! };
      case "inflection_points":
        return { xs: s.xs! };
    }
  },
});

function matchSets(expected: number[], got: number[], tol: number): { missingCount: number; extraCount: number; extraValues: number[] } {
  const usedGot = new Set<number>();
  let missingCount = 0;
  for (const e of expected) {
    const idx = got.findIndex((g, i) => !usedGot.has(i) && Math.abs(g - e) <= tol);
    if (idx === -1) missingCount++;
    else usedGot.add(idx);
  }
  const extraValues = got.filter((_, i) => !usedGot.has(i));
  return { missingCount, extraCount: extraValues.length, extraValues };
}
