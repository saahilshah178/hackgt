import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, prettyExpr, trimNumber } from "../../util";
import { compileF, evalF, integrate, sampleCurve } from "./shared";

/* accumulator · signed: net area above and below the axis. Card: energy_ledger. */

const Params = z.object({
  expr: z.string().describe("mathjs f(x) that is positive on part of [a, b] and negative on another part"),
  a: z.string().describe("exact"),
  b: z.string().describe("exact"),
  ask: z.enum(["net", "sign"]).describe("net: the signed area. sign: whether the net is positive, negative, or zero"),
});
type Params = z.infer<typeof Params>;
interface Solution { net: number; above: number; below: number; sign: "positive" | "negative" | "zero" }
interface Input { value: number | null; sign: "positive" | "negative" | "zero" | null }
interface View { expr: string; a: number; b: number; ask: "net" | "sign"; samples: { x: number; y: number | null }[] }

function split(fnExpr: string, a: number, b: number) {
  const fn = compileF(fnExpr)!;
  const n = 2000;
  let above = 0; let below = 0;
  const h = (b - a) / n;
  for (let i = 0; i < n; i++) {
    const x = a + h * (i + 0.5);
    const y = evalF(fn, x) ?? 0;
    if (y > 0) above += y * h; else below += y * h;
  }
  return { above, below: -below, net: integrate(fn, a, b) };
}

function solve(p: Params): Solution {
  const a = evalExact(p.a)!; const b = evalExact(p.b)!;
  const { above, below, net } = split(p.expr, a, b);
  const sign = Math.abs(net) < 1e-6 * (1 + above + below) ? "zero" : net > 0 ? "positive" : "negative";
  return { net, above, below, sign };
}

export const signed = defineMode({
  id: "signed",
  name: "Signed area",
  implemented: true,
  blindSolvable: false,
  widget: "dial",
  knowledgeTypes: ["quantitative"],
  directorBlurb: "Area above the axis charges the battery, area below drains it; the player reads the net. Signed area, definite integrals with sign.",
  authoringGuide: ["Choose f and [a, b] so the curve is above the axis on one stretch and below on another (e.g. \"sin(x)\" on [0, 3pi/2], \"x^2 - 4\" on [0, 3]).", "Placeholders: {{expr}}, {{a}}, {{b}} (safe), {{net}} (the answer: last hint and debrief only)."].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (looksApproximated(p.a) || looksApproximated(p.b)) problems.push("a and b must be exact");
    const a = evalExact(p.a); const b = evalExact(p.b);
    if (a === null || b === null || !(a < b)) { problems.push("a and b must be exact numbers with a < b"); return problems; }
    if (!compileF(p.expr)) { problems.push(`expr "${p.expr}" is not a valid mathjs expression`); return problems; }
    const s = solve(p);
    if (s.above < 1e-6 || s.below < 1e-6) problems.push("f must be positive on part of [a, b] and negative on another part, or there is nothing signed about the area");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) { return { expr: prettyExpr(p.expr), a: prettyExpr(p.a), b: prettyExpr(p.b), net: trimNumber(s.net) }; },
  answerVars: ["net"],
  present(p): View {
    const a = evalExact(p.a)!; const b = evalExact(p.b)!;
    return { expr: prettyExpr(p.expr), a, b, ask: p.ask, samples: sampleCurve(compileF(p.expr)!, a, b) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if (p.ask === "sign") {
      if (input.sign === s.sign) return { correct: true, feedback: "Right: the parts above and below the axis don't cancel the way that guess would need." };
      return { correct: false, feedback: `Area below the axis counts NEGATIVE. Above the axis the region measures ${trimNumber(s.above)}; below it ${trimNumber(s.below)}. Which wins?` };
    }
    const tol = Math.max(0.05, 0.03 * (s.above + s.below));
    if (input.value !== null && Math.abs(input.value - s.net) <= tol) return { correct: true, feedback: "The battery reads exactly that: charge minus drain." };
    if (input.value !== null && Math.abs(input.value - (s.above + s.below)) <= tol) return { correct: false, feedback: "That is the total area if every part counted positive. The part below the axis drains the battery: subtract it." };
    return { correct: false, feedback: `Split the interval where f changes sign: the region above the axis adds, the region below subtracts. Your value is ${input.value !== null && input.value > s.net ? "too high" : "too low"}.` };
  },
  solutionInput: (p, s) => ({ value: p.ask === "net" ? s.net : null, sign: p.ask === "sign" ? s.sign : null }),
});
