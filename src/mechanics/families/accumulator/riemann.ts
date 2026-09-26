import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, prettyExpr, trimNumber } from "../../util";
import { compileF, evalF, integrate, monotonicity, sampleCurve } from "./shared";

/*
 * accumulator · riemann: n rectangles (left, right, or midpoint) approximate the area under f on [a, b].
 * Code computes the sum, the exact integral (Simpson's rule) and whether the sum over- or under-estimates.
 * Card: tile_the_region.
 */

const Params = z.object({
  expr: z.string().describe("mathjs expression in x for f(x); f(x) >= 0 on [a, b] is strongly preferred"),
  a: z.string().describe("Left bound, exact"),
  b: z.string().describe("Right bound, exact"),
  n: z.number().int().min(2).max(20).describe("Number of rectangles"),
  method: z.enum(["left", "right", "midpoint"]).describe("Which point of each sub-interval sets the rectangle's height"),
  ask: z.enum(["estimate", "compare"]).describe("estimate: player enters the sum's numeric value. compare: player says whether it over- or underestimates"),
});
type Params = z.infer<typeof Params>;

interface Rectangle {
  x0: number;
  x1: number;
  height: number;
}
interface Solution {
  sum: number;
  exact: number;
  overUnder: "over" | "under";
  rectangles: Rectangle[];
  samples: { x: number; y: number | null }[];
}
type Input = { value: number } | { relation: "over" | "under" };
interface View {
  expr: string;
  a: number;
  b: number;
  n: number;
  method: Params["method"];
  ask: Params["ask"];
  rectangles: Rectangle[];
  samples: { x: number; y: number | null }[];
}

function nums(p: Params) {
  return { a: evalExact(p.a), b: evalExact(p.b) };
}

function samplePointFor(method: Params["method"], x0: number, x1: number): number {
  if (method === "left") return x0;
  if (method === "right") return x1;
  return (x0 + x1) / 2;
}

function solve(p: Params): Solution {
  const { a, b } = nums(p);
  if (a === null || b === null) throw new Error("accumulator.riemann: a, b must be exact numbers");
  const fn = compileF(p.expr);
  if (!fn) throw new Error(`accumulator.riemann: expr "${p.expr}" failed to compile`);
  const w = (b - a) / p.n;
  const rectangles: Rectangle[] = [];
  let sum = 0;
  for (let i = 0; i < p.n; i++) {
    const x0 = a + i * w;
    const x1 = a + (i + 1) * w;
    const sp = samplePointFor(p.method, x0, x1);
    const height = evalF(fn, sp) ?? 0;
    rectangles.push({ x0: Math.round(x0 * 1e6) / 1e6, x1: Math.round(x1 * 1e6) / 1e6, height: Math.round(height * 1e6) / 1e6 });
    sum += height * w;
  }
  const exact = integrate(fn, a, b);
  const overUnder: "over" | "under" = sum >= exact ? "over" : "under";
  return { sum, exact, overUnder, rectangles, samples: sampleCurve(fn, a, b) };
}

export const riemann = defineMode({
  id: "riemann",
  name: "Riemann sum",
  implemented: true,
  blindSolvable: false,
  widget: "place",
  knowledgeTypes: ["quantitative"],
  directorBlurb:
    "n rectangles (left, right, or midpoint) approximate the area under a curve; the player either estimates the sum or says whether it over- or under-estimates the true area.",
  authoringGuide: [
    "Write expr as a mathjs function of x; prefer f(x) >= 0 on [a, b] so the shaded blocks read as area.",
    "Pick n (2-20 rectangles) and method (left/right/midpoint).",
    "Use ask: \"compare\" only when f is monotonic on [a, b] (check() rejects it otherwise); otherwise use \"estimate\".",
    "Never state the sum or the over/under answer anywhere in prose.",
    "Placeholders: {{sum}}, {{exact}}, {{relation}} — last hint and debrief only.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (looksApproximated(p.a)) problems.push(`a "${p.a}" looks like a rounded decimal; write it exactly`);
    if (looksApproximated(p.b)) problems.push(`b "${p.b}" looks like a rounded decimal; write it exactly`);
    const { a, b } = nums(p);
    if (a === null || b === null) {
      problems.push("a and b must evaluate to numbers");
      return problems;
    }
    if (!(a < b)) problems.push("a must be less than b");
    const fn = compileF(p.expr);
    if (!fn) {
      problems.push(`expr "${p.expr}" failed to compile`);
      return problems;
    }
    for (const x of [a, b, (a + b) / 2]) {
      if (evalF(fn, x) === null) {
        problems.push(`expr "${p.expr}" does not evaluate to a finite number on [a, b]`);
        return problems;
      }
    }
    if (p.ask === "compare") {
      const mono = monotonicity(fn, a, b);
      if (mono === "non_monotonic") problems.push(`ask: "compare" needs f to be monotonic on [a, b]; "${p.expr}" is not. Use ask: "estimate" instead`);
    }
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return {
      sum: trimNumber(s.sum),
      exact: trimNumber(s.exact),
      relation: s.overUnder,
      method: p.method,
      n: String(p.n),
    };
  },
  answerVars: ["sum", "relation"],
  present(p): View {
    const s = solve(p);
    const { a, b } = nums(p);
    return { expr: prettyExpr(p.expr), a: a!, b: b!, n: p.n, method: p.method, ask: p.ask, rectangles: s.rectangles, samples: s.samples };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const risingText = s.overUnder === "over" ? "your blocks stick out above the curve" : "your blocks sit below the curve, missing a sliver at the top";
    if (p.ask === "estimate") {
      const value = "value" in input ? input.value : Number.NaN;
      const tol = Math.max(0.03 * Math.abs(s.exact), 0.05);
      if (Number.isFinite(value) && Math.abs(value - s.sum) <= tol) {
        return { correct: true, feedback: `That matches the ${p.method} sum: ${risingText} on this ${p.method === "right" ? "rising" : "curved"} stretch.` };
      }
      return {
        correct: false,
        feedback: `Recompute the ${p.method} sum: add each rectangle's height times its width (${trimNumber((evalExact(p.b)! - evalExact(p.a)!) / p.n)}) across all ${p.n} rectangles.`,
      };
    }
    const relation = "relation" in input ? input.relation : undefined;
    if (relation === s.overUnder) {
      return { correct: true, feedback: `Right: ${risingText}, so the ${p.method} sum ${s.overUnder}estimates the true area.` };
    }
    return {
      correct: false,
      feedback: `Look again at how the ${p.method} sum's flat-topped rectangles sit against the curve between x = ${trimNumber(evalExact(p.a)!)} and x = ${trimNumber(evalExact(p.b)!)}: ${risingText}.`,
    };
  },
  solutionInput: (p, s) => (p.ask === "estimate" ? { value: s.sum } : { relation: s.overUnder }),
});
