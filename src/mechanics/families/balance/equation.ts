import { compile } from "mathjs";
import { z } from "zod";
import { defineMode } from "../../types";
import { looksApproximated, prettyExpr, trimNumber } from "../../util";

/*
 * balance · equation: a linear equation left = right in x. The player applies the same operation
 * (add, subtract, multiply, divide) to both sides until x stands alone. Code tracks both sides as
 * a*x + b and verifies the final state by substitution; the model only writes the two starting sides.
 * Card: balance_chamber ★.
 */

const Op = z.enum(["add", "subtract", "multiply", "divide"]);
export type Op = z.infer<typeof Op>;

const Params = z.object({
  left: z.string().describe('Left side of the equation, exact mathjs expression in x, e.g. "3*x + 5"'),
  right: z.string().describe('Right side of the equation, exact mathjs expression in x or a plain number, e.g. "20"'),
});
type Params = z.infer<typeof Params>;

interface Coeffs {
  a: number; // coefficient of x
  b: number; // constant term
}

interface OpStep {
  op: Op;
  value: string;
}

interface Solution {
  x: number;
  xLabel: string;
  left: Coeffs;
  right: Coeffs;
  ops: OpStep[];
}

interface Input {
  ops: OpStep[];
}

interface View {
  left: string;
  right: string;
  ops: readonly Op[];
}

const TOL = 1e-6;

function evalAt(expr: string, x: number): number | null {
  try {
    const v = compile(expr).evaluate({ x }) as unknown;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** Reads expr as a*x + b by sampling at x = 0, 1, 2; null when it doesn't evaluate or isn't linear. */
function coeffs(expr: string): Coeffs | null {
  const f0 = evalAt(expr, 0);
  const f1 = evalAt(expr, 1);
  const f2 = evalAt(expr, 2);
  if (f0 === null || f1 === null || f2 === null) return null;
  const a = f1 - f0;
  const drift = f2 - f1 - a;
  if (Math.abs(drift) > 1e-6 * (1 + Math.abs(a) + Math.abs(f2))) return null;
  return { a, b: f0 };
}

function applyLinearOp(state: Coeffs, op: Op, v: Coeffs): { state: Coeffs } | { error: string } {
  if ((op === "multiply" || op === "divide") && Math.abs(v.a) > TOL) {
    return { error: "you can only multiply or divide by a plain number, not an expression that contains x" };
  }
  switch (op) {
    case "add":
      return { state: { a: state.a + v.a, b: state.b + v.b } };
    case "subtract":
      return { state: { a: state.a - v.a, b: state.b - v.b } };
    case "multiply":
      return { state: { a: state.a * v.b, b: state.b * v.b } };
    case "divide":
      if (Math.abs(v.b) < 1e-12) return { error: "dividing by zero is undefined; every operation must be reversible, so pick a nonzero value" };
      return { state: { a: state.a / v.b, b: state.b / v.b } };
  }
}

function describeLinear(state: Coeffs): string {
  const a = state.a;
  const b = state.b;
  if (Math.abs(a) < TOL) return trimNumber(b);
  const aStr = Math.abs(a - 1) < TOL ? "x" : Math.abs(a + 1) < TOL ? "-x" : `${trimNumber(a)}x`;
  if (Math.abs(b) < TOL) return aStr;
  return `${aStr} ${b >= 0 ? "+" : "-"} ${trimNumber(Math.abs(b))}`;
}

function solve(p: Params): Solution {
  const L = coeffs(p.left);
  const R = coeffs(p.right);
  if (L === null || R === null) throw new Error("balance.equation: left and right must be linear expressions in x");
  const denom = L.a - R.a;
  if (Math.abs(denom) < 1e-9) throw new Error("balance.equation: no unique solution (x cancels from both sides)");
  const x = (R.b - L.b) / denom;

  const ops: OpStep[] = [];
  let Lc = { ...L };
  let Rc = { ...R };
  const applyCanonical = (op: Op, v: Coeffs) => {
    ops.push({ op, value: Math.abs(v.a) > TOL ? `${trimNumber(v.a)}*x` : trimNumber(v.b) });
    const left = applyLinearOp(Lc, op, v);
    const right = applyLinearOp(Rc, op, v);
    if ("error" in left || "error" in right) throw new Error("balance.equation: internal canonical-op error");
    Lc = left.state;
    Rc = right.state;
  };
  if (Math.abs(Rc.a) > 1e-9) applyCanonical("subtract", { a: Rc.a, b: 0 });
  if (Math.abs(Lc.b) > 1e-9) applyCanonical("subtract", { a: 0, b: Lc.b });
  if (Math.abs(Lc.a - 1) > 1e-9) applyCanonical("divide", { a: 0, b: Lc.a });

  return { x, xLabel: trimNumber(x), left: L, right: R, ops };
}

export const equation = defineMode({
  id: "equation",
  name: "Equation",
  implemented: true,
  blindSolvable: false,
  widget: "build",
  knowledgeTypes: ["procedure", "quantitative"],
  directorBlurb:
    "A linear equation left = right in x. The player applies the same operation to both sides (add, subtract, multiply, divide) until x stands alone. Solving linear equations, keeping both sides equal.",
  authoringGuide: [
    'Write left and right as exact mathjs expressions in x, e.g. left: "3*x + 5", right: "20".',
    "Both sides may contain x (e.g. x on both sides); the engine tracks each as a*x + b and checks it stays linear.",
    "Never write rounded decimals; use exact fractions like \"5/2\" instead of \"2.5\".",
    "The coefficient of x must differ between the two sides, or there is no single solution.",
    "Placeholders: {{left}}, {{right}} (the starting sides), {{x}} (the answer: last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (looksApproximated(p.left)) problems.push('"left" looks like a rounded decimal; write it exactly');
    if (looksApproximated(p.right)) problems.push('"right" looks like a rounded decimal; write it exactly');
    if (problems.length > 0) return problems;
    const L = coeffs(p.left);
    const R = coeffs(p.right);
    if (L === null) problems.push('"left" must be a linear expression in x that evaluates to a number');
    if (R === null) problems.push('"right" must be a linear expression in x that evaluates to a number');
    if (problems.length > 0) return problems;
    const denom = L!.a - R!.a;
    if (Math.abs(denom) < 1e-9) {
      problems.push("x cancels from both sides, so the equation has no unique solution (either none or infinitely many)");
    }
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { left: prettyExpr(p.left), right: prettyExpr(p.right), x: s.xLabel };
  },
  answerVars: ["x"],
  present(p): View {
    return { left: prettyExpr(p.left), right: prettyExpr(p.right), ops: ["add", "subtract", "multiply", "divide"] };
  },
  grade(p, input: Input) {
    const s = solve(p);
    let Lc = { ...s.left };
    let Rc = { ...s.right };
    for (const step of input.ops) {
      const v = coeffs(step.value);
      if (v === null) {
        return { correct: false, feedback: `"${step.value}" doesn't evaluate to a number or a simple expression in x; check that operation.` };
      }
      const left = applyLinearOp(Lc, step.op, v);
      if ("error" in left) return { correct: false, feedback: left.error };
      const right = applyLinearOp(Rc, step.op, v);
      if ("error" in right) return { correct: false, feedback: right.error };
      Lc = left.state;
      Rc = right.state;
    }
    const leftAlone = Math.abs(Lc.a - 1) < TOL && Math.abs(Lc.b) < TOL && Math.abs(Rc.a) < TOL;
    const rightAlone = Math.abs(Rc.a - 1) < TOL && Math.abs(Rc.b) < TOL && Math.abs(Lc.a) < TOL;
    if (!leftAlone && !rightAlone) {
      return {
        correct: false,
        feedback: `Not solved yet: the left side now reads ${describeLinear(Lc)} and the right reads ${describeLinear(Rc)}. Keep applying the same operation to both sides until x stands alone.`,
      };
    }
    const answerGiven = leftAlone ? Rc.b : Lc.b;
    if (Math.abs(answerGiven - s.x) <= 1e-6 * (1 + Math.abs(s.x))) {
      return { correct: true, feedback: "Both pans hold steady: x stands alone and the chamber unlocks." };
    }
    return {
      correct: false,
      feedback: "Something in your operations broke the balance: applying the same operation to both sides should keep the equation true. Check each step again.",
    };
  },
  solutionInput: (_p, s) => ({ ops: s.ops }),
});
