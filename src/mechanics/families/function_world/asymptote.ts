import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, trimNumber } from "../../util";
import { compileFunction, evaluatePath, limitLabel, samplePath, type PieceParams, type SideLimit } from "./shared";

/* function_world · asymptote: behavior as x → ±∞. Card: long_horizon. */

const Piece = z.object({ expr: z.string(), from: z.string(), to: z.string(), openLeft: z.boolean(), openRight: z.boolean() });
const Params = z.object({
  pieces: z.array(Piece).min(1).max(3),
  direction: z.enum(["pos_inf", "neg_inf"]).describe("which horizon the player travels toward"),
  xMin: z.string(),
  xMax: z.string(),
});
type Params = z.infer<typeof Params>;
type Kind = "value" | "pos_infinity" | "neg_infinity" | "dne";
interface Solution { kind: Kind; value: number | null; label: string }
interface Input { kind: Kind; value: number | null }
interface View { direction: "pos_inf" | "neg_inf"; xMin: number; xMax: number; samples: { x: number; y: number | null }[]; far: { x: number; y: number | null }[] }

export function farLimit(pieces: PieceParams[], direction: "pos_inf" | "neg_inf"): SideLimit {
  const f = compileFunction(pieces, []);
  const xs = [1e2, 1e3, 1e4, 1e5, 1e6].map((m) => (direction === "pos_inf" ? m : -m));
  const ys = xs.map((x) => evaluatePath(f, x));
  if (ys.some((y) => y === null || !Number.isFinite(y))) return { kind: "dne" };
  const v = ys as number[];
  const last = v[v.length - 1], prev = v[v.length - 2];
  const growing = v.every((y, i) => i === 0 || Math.abs(y) >= Math.abs(v[i - 1]) * 1.5);
  if (Math.abs(last) > 1e4 && growing) return last > 0 ? { kind: "pos_infinity" } : { kind: "neg_infinity" };
  if (Math.abs(last - prev) <= 1e-4 * (1 + Math.abs(last))) return { kind: "value", value: Math.round(last * 1e4) / 1e4 };
  return { kind: "dne" };
}

function solve(p: Params): Solution {
  const l = farLimit(p.pieces, p.direction);
  return { kind: l.kind, value: l.kind === "value" ? l.value : null, label: limitLabel(l) };
}

export const asymptote = defineMode({
  id: "asymptote",
  name: "Asymptote",
  implemented: true,
  blindSolvable: false,
  widget: "place",
  knowledgeTypes: ["quantitative"],
  directorBlurb: "Travel far along the terrain and read where it levels off (a horizontal asymptote), or that it never does. Limits at infinity, end behavior, curves that cross their asymptote.",
  authoringGuide: ["Use a rational or exponential-decay expression whose far behavior is clear: e.g. \"(2x+1)/(x-3)\" → 2, \"3 - 5/x\" → 3, \"x^2/(x+1)\" → +∞. For the crossing misconception use something like \"2 + sin(x)/x\".", "Placeholders: {{direction}} (safe), {{limit}} (the answer: last hint and debrief only)."].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (looksApproximated(p.xMin) || looksApproximated(p.xMax)) problems.push("xMin/xMax look like rounded decimals");
    const xMin = evalExact(p.xMin); const xMax = evalExact(p.xMax);
    if (xMin === null || xMax === null || !(xMin < xMax)) { problems.push("xMin and xMax must be exact numbers with xMin < xMax"); return problems; }
    try { compileFunction(p.pieces, []); } catch (err) { problems.push(err instanceof Error ? err.message : String(err)); return problems; }
    const l = farLimit(p.pieces, p.direction);
    if (l.kind === "dne") problems.push("f does not settle and does not blow up in that direction (oscillation or undefined); choose a function with a clear far behavior");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) { return { direction: p.direction === "pos_inf" ? "the right (x → +∞)" : "the left (x → −∞)", limit: s.label }; },
  answerVars: ["limit"],
  present(p): View {
    const xMin = evalExact(p.xMin)!; const xMax = evalExact(p.xMax)!;
    const f = compileFunction(p.pieces, []);
    const far = [10, 100, 1000, 10000].map((m) => { const x = p.direction === "pos_inf" ? m : -m; const y = evaluatePath(f, x); return { x, y: y === null || !Number.isFinite(y) ? null : Math.round(y * 1e4) / 1e4 }; });
    return { direction: p.direction, xMin, xMax, samples: samplePath(f, xMin, xMax), far };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if (input.kind !== s.kind) {
      if (s.kind === "value") return { correct: false, feedback: "Travel further: the terrain keeps flattening toward one altitude even if it wiggles or crosses it on the way." };
      return { correct: false, feedback: "The terrain never levels off in that direction; each step out, the height keeps growing without bound." };
    }
    if (s.kind !== "value" || s.value === null) return { correct: true, feedback: "That is the far behavior." };
    const tol = Math.max(0.05, Math.abs(s.value) * 0.05);
    if (input.value !== null && Math.abs(input.value - s.value) <= tol) return { correct: true, feedback: "That altitude is the asymptote: the terrain approaches it forever." };
    return { correct: false, feedback: `Not that altitude. Read the height at x = ${p.direction === "pos_inf" ? "1000, 10000" : "−1000, −10000"}: the terrain is converging on a different level.` };
  },
  solutionInput: (_p, s) => ({ kind: s.kind, value: s.value }),
});
