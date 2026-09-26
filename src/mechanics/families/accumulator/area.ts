import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, prettyExpr, trimNumber } from "../../util";
import { compileF, evalF, integrate, isNonNegative, sampleCurve } from "./shared";

/*
 * accumulator · area: f >= 0 on [a, bMax], so the accumulated area from a is non-decreasing in b. The
 * player dials the upper bound b so the area hits a target; code finds it by bisection. Cards:
 * fill_the_reservoir, integration_window.
 */

const Params = z.object({
  expr: z.string().describe("mathjs expression in x for f(x); must be >= 0 on [a, bMax]"),
  a: z.string().describe("Fixed lower bound, exact"),
  target: z.string().describe("Exact target area for the integral from a to the player's b"),
  bMin: z.string().describe("Lowest value the player's b dial can reach, exact"),
  bMax: z.string().describe("Highest value the player's b dial can reach, exact"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  b: number;
  target: number;
  areaAtBMin: number;
  areaAtBMax: number;
}
interface Input {
  value: number;
}
interface View {
  expr: string;
  a: number;
  bMin: number;
  bMax: number;
  target: number;
  samples: { x: number; y: number | null }[];
}

function nums(p: Params) {
  return { a: evalExact(p.a), target: evalExact(p.target), bMin: evalExact(p.bMin), bMax: evalExact(p.bMax) };
}

function areaFrom(fn: ReturnType<typeof compileF>, a: number, b: number): number {
  return integrate(fn!, a, b);
}

function solve(p: Params): Solution {
  const { a, target, bMin, bMax } = nums(p);
  if (a === null || target === null || bMin === null || bMax === null) throw new Error("accumulator.area: a, target, bMin, bMax must be exact numbers");
  const fn = compileF(p.expr);
  if (!fn) throw new Error(`accumulator.area: expr "${p.expr}" failed to compile`);
  const areaAtBMin = areaFrom(fn, a, bMin);
  const areaAtBMax = areaFrom(fn, a, bMax);
  let lo = bMin;
  let hi = bMax;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const areaMid = areaFrom(fn, a, mid);
    if (areaMid < target) lo = mid;
    else hi = mid;
  }
  return { b: (lo + hi) / 2, target, areaAtBMin, areaAtBMax };
}

export const area = defineMode({
  id: "area",
  name: "Area",
  implemented: true,
  blindSolvable: false,
  widget: "dial",
  knowledgeTypes: ["quantitative"],
  directorBlurb:
    "f(x) >= 0 fills a reservoir from a fixed lower bound a; the player dials the upper bound b so the accumulated area (definite integral) hits a target volume.",
  authoringGuide: [
    "Write expr as a mathjs function of x that stays >= 0 on the whole [a, bMax] range (check() enforces this).",
    "Pick a and the dial range [bMin, bMax], then set target to an exact area strictly between the area at bMin and the area at bMax.",
    "Never write the solving b anywhere in prose; code finds it by bisection.",
    "Placeholders: {{target}}, {{b}} — last hint and debrief only.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    for (const [key, val] of [
      ["a", p.a],
      ["target", p.target],
      ["bMin", p.bMin],
      ["bMax", p.bMax],
    ] as const) {
      if (looksApproximated(val)) problems.push(`${key} "${val}" looks like a rounded decimal; write it exactly`);
      if (evalExact(val) === null) problems.push(`${key} "${val}" does not evaluate to a number`);
    }
    if (problems.length > 0) return problems;
    const { a, target, bMin, bMax } = nums(p);
    if (!(a! <= bMin!)) problems.push("a must be less than or equal to bMin");
    if (!(bMin! < bMax!)) problems.push("bMin must be less than bMax");
    const fn = compileF(p.expr);
    if (!fn) {
      problems.push(`expr "${p.expr}" failed to compile`);
      return problems;
    }
    if (!isNonNegative(fn, a!, bMax!)) problems.push(`expr "${p.expr}" goes negative somewhere on [a, bMax]; area needs f(x) >= 0 there`);
    if (problems.length > 0) return problems;
    const areaAtBMin = areaFrom(fn, a!, bMin!);
    const areaAtBMax = areaFrom(fn, a!, bMax!);
    if (!(target! > areaAtBMin + 1e-9 && target! < areaAtBMax - 1e-9)) {
      problems.push(`target ${trimNumber(target!)} is not strictly between the area at bMin (${trimNumber(areaAtBMin)}) and the area at bMax (${trimNumber(areaAtBMax)})`);
    }
    return problems;
  },
  resolve: solve,
  templateVars(_p, s) {
    return { target: trimNumber(s.target), b: trimNumber(s.b) };
  },
  answerVars: ["b"],
  present(p): View {
    const { a, bMin, bMax, target } = nums(p);
    const fn = compileF(p.expr)!;
    return { expr: prettyExpr(p.expr), a: a!, bMin: bMin!, bMax: bMax!, target: target!, samples: sampleCurve(fn, a!, bMax!) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const { a } = nums(p);
    const tol = 0.03 * (evalExact(p.bMax)! - evalExact(p.bMin)!);
    if (Math.abs(input.value - s.b) <= tol) {
      return { correct: true, feedback: "The reservoir holds exactly the target volume: area from a to your b matches." };
    }
    const fn = compileF(p.expr)!;
    const areaAtInput = areaFrom(fn, a!, input.value);
    const pct = Math.round((areaAtInput / s.target) * 100);
    const verb = areaAtInput > s.target ? "overflowed" : "undershot";
    return { correct: false, feedback: `The reservoir ${verb}: the area from a to your b is ${pct}% of the target. ${areaAtInput > s.target ? "Pull b back" : "Push b further"}.` };
  },
  solutionInput: (_p, s) => ({ value: s.b }),
});
