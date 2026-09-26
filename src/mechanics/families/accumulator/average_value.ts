import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, prettyExpr, trimNumber } from "../../util";
import { compileF, evalF, integrate, sampleCurve } from "./shared";

/* accumulator · average_value: level the reservoir; the average value of f on [a, b] is (1/(b−a))∫f. Card: level_the_reservoir. */

const Params = z.object({
  expr: z.string().describe("mathjs f(x) >= 0 on [a, b]"),
  a: z.string().describe("exact"),
  b: z.string().describe("exact"),
});
type Params = z.infer<typeof Params>;
interface Solution { average: number; endpointAverage: number; area: number }
interface Input { value: number }
interface View { expr: string; a: number; b: number; samples: { x: number; y: number | null }[] }

function solve(p: Params): Solution {
  const a = evalExact(p.a)!; const b = evalExact(p.b)!;
  const fn = compileF(p.expr)!;
  const area = integrate(fn, a, b);
  return { average: area / (b - a), endpointAverage: ((evalF(fn, a) ?? 0) + (evalF(fn, b) ?? 0)) / 2, area };
}

export const averageValue = defineMode({
  id: "average_value",
  name: "Average value",
  implemented: true,
  blindSolvable: false,
  widget: "dial",
  knowledgeTypes: ["quantitative"],
  directorBlurb: "Flatten the uneven water in the reservoir into a rectangle of equal area: the average value of f. Mean value of a function.",
  authoringGuide: ["Choose f >= 0 on [a, b] whose average differs clearly from the average of its endpoint values (e.g. \"x^2\" on [0, 3]).", "Placeholders: {{expr}}, {{a}}, {{b}} (safe), {{average}} (the answer: last hint and debrief only)."].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (looksApproximated(p.a) || looksApproximated(p.b)) problems.push("a and b must be exact");
    const a = evalExact(p.a); const b = evalExact(p.b);
    if (a === null || b === null || !(a < b)) { problems.push("a and b must be exact numbers with a < b"); return problems; }
    const fn = compileF(p.expr);
    if (!fn) { problems.push(`expr "${p.expr}" is not a valid mathjs expression`); return problems; }
    const s = solve(p);
    if (Math.abs(s.average - s.endpointAverage) < 0.05 * Math.max(1, Math.abs(s.average))) problems.push("the average of the endpoints equals the true average here; pick a curvier f so the misconception bites");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) { return { expr: prettyExpr(p.expr), a: prettyExpr(p.a), b: prettyExpr(p.b), average: trimNumber(s.average) }; },
  answerVars: ["average"],
  present(p): View {
    const a = evalExact(p.a)!; const b = evalExact(p.b)!;
    return { expr: prettyExpr(p.expr), a, b, samples: sampleCurve(compileF(p.expr)!, a, b) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const tol = Math.max(0.05, 0.03 * Math.abs(s.average));
    if (Number.isFinite(input.value) && Math.abs(input.value - s.average) <= tol) return { correct: true, feedback: "The water levels out at exactly that height: the same area, flat." };
    if (Math.abs(input.value - s.endpointAverage) <= tol) return { correct: false, feedback: "That is the average of the two endpoint heights. The curve spends more of the interval elsewhere; level the AREA, not the ends." };
    return { correct: false, feedback: `A flat level of ${trimNumber(input.value)} holds ${input.value > s.average ? "more" : "less"} water than the curve does. The level that matches is (area under f) ÷ (b − a).` };
  },
  solutionInput: (_p, s) => ({ value: s.average }),
});
