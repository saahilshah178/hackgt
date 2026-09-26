import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, trimNumber } from "../../util";
import { compileFunction, evaluatePath, samplePath } from "./shared";

/* function_world · secant: shrink Δx toward the derivative at a; the secant slope is not the derivative until Δx → 0. Cards: speed_snapshot, closing_gates. */

const Piece = z.object({ expr: z.string(), from: z.string(), to: z.string(), openLeft: z.boolean(), openRight: z.boolean() });
const Params = z.object({
  pieces: z.array(Piece).min(1).max(2),
  a: z.string().describe("exact point where the instantaneous rate is wanted"),
  windows: z.array(z.string()).min(2).max(5).describe('exact Δx values shown as shrinking windows, largest first, e.g. ["2", "1", "1/2", "1/10"]'),
  xMin: z.string(),
  xMax: z.string(),
  quantity: z.string().describe('what f measures, e.g. "position (m)"'),
});
type Params = z.infer<typeof Params>;
interface Solution { derivative: number; secants: { dx: number; slope: number }[] }
interface Input { value: number }
interface View { a: number; xMin: number; xMax: number; samples: { x: number; y: number | null }[]; windows: number[]; quantity: string }

function slopes(p: Params) {
  const f = compileFunction(p.pieces, []);
  const a = evalExact(p.a)!;
  const secant = (dx: number) => {
    const y1 = evaluatePath(f, a); const y2 = evaluatePath(f, a + dx);
    return y1 === null || y2 === null ? Number.NaN : (y2 - y1) / dx;
  };
  const h = 1e-6;
  const derivative = ((evaluatePath(f, a + h) ?? 0) - (evaluatePath(f, a - h) ?? 0)) / (2 * h);
  return { derivative, secants: p.windows.map((w) => ({ dx: evalExact(w) ?? Number.NaN, slope: secant(evalExact(w) ?? Number.NaN) })) };
}

function solve(p: Params): Solution {
  const { derivative, secants } = slopes(p);
  return { derivative: Math.round(derivative * 1e6) / 1e6, secants: secants.map((s) => ({ dx: s.dx, slope: Math.round(s.slope * 1e6) / 1e6 })) };
}

export const secant = defineMode({
  id: "secant",
  name: "Secant to tangent",
  implemented: true,
  blindSolvable: false,
  widget: "dial",
  knowledgeTypes: ["quantitative"],
  directorBlurb: "Freeze time over shorter and shorter windows to read the instantaneous rate at a; the average rate over a window is not the derivative until the window shrinks. Difference quotient, instantaneous vs average rate.",
  authoringGuide: ["Use a curved f (not linear) so the secant slopes visibly change as the windows shrink; list 2-5 exact Δx values largest first; a strictly inside [xMin, xMax].", "Placeholders: {{a}}, {{quantity}} (safe), {{derivative}} (the answer: last hint and debrief only)."].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (looksApproximated(p.a) || looksApproximated(p.xMin) || looksApproximated(p.xMax)) problems.push("a, xMin, xMax must be exact");
    const a = evalExact(p.a); const xMin = evalExact(p.xMin); const xMax = evalExact(p.xMax);
    if (a === null || xMin === null || xMax === null || !(xMin < xMax) || a <= xMin || a >= xMax) { problems.push("a must be an exact number strictly inside [xMin, xMax]"); return problems; }
    const ws = p.windows.map((w) => evalExact(w));
    if (ws.some((w) => w === null || w <= 0)) problems.push("every window must be an exact positive number");
    else if (ws.some((w, i) => i > 0 && w! >= ws[i - 1]!)) problems.push("windows must shrink: list them largest first");
    if (problems.length) return problems;
    try { compileFunction(p.pieces, []); } catch (err) { problems.push(err instanceof Error ? err.message : String(err)); return problems; }
    const s = solve(p);
    if (s.secants.some((x) => !Number.isFinite(x.slope)) || !Number.isFinite(s.derivative)) problems.push("f must be defined at a and across every window");
    else if (Math.abs(s.secants[0].slope - s.derivative) < 1e-6) problems.push("the widest window already gives the derivative (is f linear?); use a curved f");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) { return { a: p.a, quantity: p.quantity, derivative: trimNumber(s.derivative) }; },
  answerVars: ["derivative"],
  present(p): View {
    const xMin = evalExact(p.xMin)!; const xMax = evalExact(p.xMax)!;
    return { a: evalExact(p.a)!, xMin, xMax, samples: samplePath(compileFunction(p.pieces, []), xMin, xMax), windows: p.windows.map((w) => evalExact(w) ?? 0), quantity: p.quantity };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const tol = Math.max(0.05, 0.03 * Math.abs(s.derivative));
    if (Number.isFinite(input.value) && Math.abs(input.value - s.derivative) <= tol) return { correct: true, feedback: "That is the instantaneous rate: where the secant slopes were heading as the window closed." };
    const hit = s.secants.find((x) => Math.abs(x.slope - input.value) <= tol);
    if (hit) return { correct: false, feedback: `That is the AVERAGE rate over a window of ${trimNumber(hit.dx)}, not the rate at the instant. Watch the slopes as the window shrinks: ${s.secants.map((x) => trimNumber(x.slope)).join(" → ")} …` };
    return { correct: false, feedback: `The secant slopes head ${input.value > s.derivative ? "lower" : "higher"} than that as the window shrinks. Read where the sequence is converging.` };
  },
  solutionInput: (_p, s) => ({ value: s.derivative }),
});
