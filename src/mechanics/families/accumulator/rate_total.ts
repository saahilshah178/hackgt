import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, prettyExpr, trimNumber } from "../../util";
import { compileF, evalF, integrate, sampleCurve } from "./shared";

/* accumulator · rate_total: accumulate a changing rate into a total. Cards: resource_collector, rate_total_machine, rate_runner. */

const Params = z.object({
  rateExpr: z.string().describe("mathjs rate as a function of t (use the symbol x for time), e.g. \"4 - x/2\" or \"2*x\""),
  t0: z.string().describe("exact start time"),
  t1: z.string().describe("exact end time"),
  initial: z.string().describe("exact starting amount at t0"),
  quantityName: z.string().describe('e.g. "ore", "position", "water"'),
  unit: z.string(),
});
type Params = z.infer<typeof Params>;
interface Solution { total: number; change: number; rateStart: number; rateEnd: number }
interface Input { value: number }
interface View { rateExpr: string; t0: number; t1: number; initial: number; quantityName: string; unit: string; samples: { x: number; y: number | null }[] }

function solve(p: Params): Solution {
  const t0 = evalExact(p.t0)!; const t1 = evalExact(p.t1)!; const initial = evalExact(p.initial)!;
  const fn = compileF(p.rateExpr)!;
  const change = integrate(fn, t0, t1);
  return { total: initial + change, change, rateStart: evalF(fn, t0) ?? 0, rateEnd: evalF(fn, t1) ?? 0 };
}

export const rateTotal = defineMode({
  id: "rate_total",
  name: "Rate to total",
  implemented: true,
  blindSolvable: false,
  widget: "dial",
  knowledgeTypes: ["quantitative"],
  directorBlurb: "A rate changes over time; the player predicts the accumulated total. Accumulation, the fundamental theorem, position from velocity.",
  authoringGuide: ["Write the rate as a function of x (time) that is NOT constant, with exact times and starting amount, so that rate × time gives the wrong answer.", "Placeholders: {{rate}}, {{t0}}, {{t1}}, {{initial}}, {{unit}} (safe), {{total}} (the answer: last hint and debrief only)."].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    for (const v of [p.t0, p.t1, p.initial]) if (looksApproximated(v)) problems.push(`"${v}" looks like a rounded decimal`);
    const t0 = evalExact(p.t0); const t1 = evalExact(p.t1); const initial = evalExact(p.initial);
    if (t0 === null || t1 === null || initial === null || !(t0 < t1)) { problems.push("t0 < t1 and initial must be exact numbers"); return problems; }
    const fn = compileF(p.rateExpr);
    if (!fn) { problems.push(`rateExpr "${p.rateExpr}" is not a valid mathjs expression`); return problems; }
    const s = solve(p);
    if (Math.abs(s.rateStart - s.rateEnd) < 1e-9) problems.push("the rate is constant; rate × time would be right, so the encounter teaches nothing");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) { return { rate: prettyExpr(p.rateExpr), t0: prettyExpr(p.t0), t1: prettyExpr(p.t1), initial: prettyExpr(p.initial), unit: p.unit, total: trimNumber(s.total) }; },
  answerVars: ["total"],
  present(p): View {
    const t0 = evalExact(p.t0)!; const t1 = evalExact(p.t1)!;
    return { rateExpr: prettyExpr(p.rateExpr), t0, t1, initial: evalExact(p.initial)!, quantityName: p.quantityName, unit: p.unit, samples: sampleCurve(compileF(p.rateExpr)!, t0, t1) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const tol = Math.max(0.05, 0.03 * Math.abs(s.change));
    if (Number.isFinite(input.value) && Math.abs(input.value - s.total) <= tol) return { correct: true, feedback: `Exactly: the area under the rate curve is the change in ${p.quantityName}.` };
    const t0 = evalExact(p.t0)!; const t1 = evalExact(p.t1)!; const initial = evalExact(p.initial)!;
    const naive = initial + s.rateEnd * (t1 - t0);
    const naive0 = initial + s.rateStart * (t1 - t0);
    if ([naive, naive0].some((n) => Math.abs(input.value - n) <= tol)) return { correct: false, feedback: `That is rate × time with a single rate, but the rate moved from ${trimNumber(s.rateStart)} to ${trimNumber(s.rateEnd)} ${p.unit}/time. The total is the AREA under the rate curve, added to the ${trimNumber(initial)} you started with.` };
    return { correct: false, feedback: `Your total is ${input.value > s.total ? "too high" : "too low"}. Add the starting ${p.quantityName} to the area under the rate curve between ${prettyExpr(p.t0)} and ${prettyExpr(p.t1)}.` };
  },
  solutionInput: (_p, s) => ({ value: s.total }),
});
