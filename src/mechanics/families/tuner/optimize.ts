import { compile } from "mathjs";
import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, prettyExpr, trimNumber } from "../../util";

/*
 * tuner · optimize: an objective f(x) on [min, max]; code finds the argmax/argmin numerically and checks
 * that the objective is unimodal so the optimum is unique. Cards: peak_efficiency, resonance_breaker,
 * opportunity_fork, two_nation_trade, one_more_unit, crowded_factory.
 */

const Params = z.object({
  objective: z.string().describe('mathjs expression in x, e.g. "-(x-4)^2 + 20" or "x*(12 - x)"'),
  goal: z.enum(["max", "min"]),
  xMin: z.string().describe("exact"),
  xMax: z.string().describe("exact"),
  inputName: z.string().describe('e.g. "workers", "price", "frequency"'),
  outputName: z.string().describe('e.g. "output per hour", "revenue", "amplitude"'),
});
type Params = z.infer<typeof Params>;

interface Solution {
  x: number;
  value: number;
  xLabel: string;
}
interface Input {
  x: number;
}
interface View {
  objective: string;
  goal: "max" | "min";
  xMin: number;
  xMax: number;
  inputName: string;
  outputName: string;
  /** the objective sampled for the meter (the optimum is not marked) */
  samples: { x: number; y: number }[];
}

function fn(expr: string): (x: number) => number {
  const c = compile(expr);
  return (x) => {
    const v = c.evaluate({ x }) as unknown;
    return typeof v === "number" && Number.isFinite(v) ? v : Number.NaN;
  };
}

function sample(p: Params, n = 200): { x: number; y: number }[] {
  const f = fn(p.objective);
  const a = evalExact(p.xMin)!;
  const b = evalExact(p.xMax)!;
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = a + ((b - a) * i) / n;
    return { x, y: f(x) };
  });
}

/** True when the sampled objective rises then falls (max) or falls then rises (min) at most once. */
function unimodal(ys: number[], goal: "max" | "min"): boolean {
  const s = goal === "max" ? ys : ys.map((y) => -y);
  let phase: "up" | "down" = "up";
  for (let i = 1; i < s.length; i++) {
    const d = s[i] - s[i - 1];
    if (Math.abs(d) < 1e-12) continue;
    if (phase === "up" && d < 0) phase = "down";
    else if (phase === "down" && d > 0) return false;
  }
  return true;
}

function solve(p: Params): Solution {
  const f = fn(p.objective);
  let lo = evalExact(p.xMin)!;
  let hi = evalExact(p.xMax)!;
  const better = (a: number, b: number) => (p.goal === "max" ? a > b : a < b);
  // coarse grid, then golden-section refinement around the best cell
  const pts = sample(p, 400);
  let best = pts[0];
  for (const pt of pts) if (better(pt.y, best.y)) best = pt;
  const step = (hi - lo) / 400;
  lo = Math.max(lo, best.x - step);
  hi = Math.min(hi, best.x + step);
  const g = (Math.sqrt(5) - 1) / 2;
  let c = hi - g * (hi - lo);
  let d = lo + g * (hi - lo);
  for (let i = 0; i < 60; i++) {
    if (better(f(c), f(d))) hi = d;
    else lo = c;
    c = hi - g * (hi - lo);
    d = lo + g * (hi - lo);
  }
  const x = (lo + hi) / 2;
  return { x, value: f(x), xLabel: trimNumber(x) };
}

export const optimize = defineMode({
  id: "optimize",
  name: "Optimizer",
  implemented: true,
  blindSolvable: false,
  widget: "dial",
  knowledgeTypes: ["quantitative", "causal"],
  directorBlurb: "Dial the input that maximizes (or minimizes) an objective; the meter shows the output live. Optimization, marginal thinking, resonance, diminishing returns.",
  authoringGuide: [
    "Write the objective as a mathjs expression in x that rises then falls (or the reverse) exactly once on [xMin, xMax]; the optimum must be strictly inside the range (the classic misconception is that it sits at an endpoint).",
    "Name the input and output in the subject's words (workers → output per hour, price → revenue).",
    "Placeholders: {{objective}} (safe), {{xMin}}, {{xMax}}, {{best}} (the answer: last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (looksApproximated(p.xMin) || looksApproximated(p.xMax)) problems.push("xMin/xMax look like rounded decimals; write them exactly");
    const a = evalExact(p.xMin);
    const b = evalExact(p.xMax);
    if (a === null || b === null || !(a < b)) {
      problems.push("xMin and xMax must be exact numbers with xMin < xMax");
      return problems;
    }
    let pts: { x: number; y: number }[];
    try {
      pts = sample(p);
    } catch {
      problems.push(`objective "${p.objective}" is not a valid mathjs expression`);
      return problems;
    }
    if (pts.some((q) => !Number.isFinite(q.y))) problems.push("the objective must be finite everywhere on [xMin, xMax]");
    else if (!unimodal(pts.map((q) => q.y), p.goal)) problems.push(`the objective must be unimodal for goal ${p.goal} (rise then fall once for max); it isn't on this range`);
    if (problems.length) return problems;
    const s = solve(p);
    const span = b - a;
    if (s.x <= a + 0.05 * span || s.x >= b - 0.05 * span) problems.push("the optimum sits at (or within 5% of) an endpoint; widen the range or change the objective so the peak is inside");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { objective: prettyExpr(p.objective), xMin: prettyExpr(p.xMin), xMax: prettyExpr(p.xMax), best: s.xLabel };
  },
  answerVars: ["best"],
  present(p): View {
    return { objective: prettyExpr(p.objective), goal: p.goal, xMin: evalExact(p.xMin)!, xMax: evalExact(p.xMax)!, inputName: p.inputName, outputName: p.outputName, samples: sample(p, 120) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const span = evalExact(p.xMax)! - evalExact(p.xMin)!;
    if (Number.isFinite(input.x) && Math.abs(input.x - s.x) <= 0.03 * span) return { correct: true, feedback: `That is the ${p.goal === "max" ? "peak" : "trough"}: the ${p.outputName} can't get any ${p.goal === "max" ? "higher" : "lower"}.` };
    const f = fn(p.objective);
    const here = f(input.x);
    const pct = Math.abs(s.value) > 1e-9 ? Math.round((Math.abs(here - s.value) / Math.abs(s.value)) * 100) : 0;
    const dir = input.x < s.x ? "higher" : "lower";
    return { correct: false, feedback: `At ${p.inputName} = ${trimNumber(input.x)} the ${p.outputName} is ${pct}% ${p.goal === "max" ? "below the best" : "above the best"}. Nudge ${p.inputName} ${dir} and watch whether the meter improves; the ${p.goal === "max" ? "peak" : "trough"} is where one more step stops helping.` };
  },
  solutionInput: (_p, s) => ({ x: s.x }),
});
