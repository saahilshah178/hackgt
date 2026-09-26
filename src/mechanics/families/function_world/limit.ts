import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, prettyExpr, trimNumber } from "../../util";
import { combineLimits, compileFunction, evaluateAt, limitLabel, samplePath, sideLimit, type SideLimit } from "./shared";

/*
 * function_world · limit: the world's geometry is y = f(x). The player scrubs x toward a from the left,
 * the right, or both, watching the f(x) marker, then answers: a value, DNE, or ±∞.
 * Cards: approach_target, two_path_convergence, directional_scanner, broken_tile, decoy_destination ★,
 * split_gate, runaway_elevator.
 */

const Piece = z.object({
  expr: z.string().describe('mathjs expression in x, e.g. "x^2 - 1" or "(x^2 - 4)/(x - 2)" or "1/(x-2)^2"'),
  from: z.string().describe('Left end of this piece as an exact expression, or "-inf"'),
  to: z.string().describe('Right end as an exact expression, or "inf"'),
  openLeft: z.boolean().describe("true when the piece does NOT include its left endpoint"),
  openRight: z.boolean().describe("true when the piece does NOT include its right endpoint"),
});

const Params = z.object({
  pieces: z.array(Piece).min(1).max(4).describe("Piecewise definition, left to right, non-overlapping"),
  overrides: z
    .array(z.object({ x: z.string().describe("exact"), y: z.string().nullable().describe("exact value shown at x, or null for a hole (undefined)") }))
    .min(0)
    .max(2)
    .describe("Point overrides: a hole (y null) or a decoy value that differs from the limit"),
  a: z.string().describe("The x the player approaches, exact, e.g. \"2\""),
  side: z.enum(["left", "right", "both"]).describe("Which side(s) the player approaches from"),
  xMin: z.string().describe("Left edge of the visible world, exact"),
  xMax: z.string().describe("Right edge of the visible world, exact"),
});
type Params = z.infer<typeof Params>;

export type AnswerKind = "value" | "dne" | "pos_infinity" | "neg_infinity";

interface Solution {
  kind: AnswerKind;
  value: number | null;
  left: SideLimit;
  right: SideLimit;
  /** f(a) as the world shows it: the override, the piece value, or null when undefined */
  fa: number | null;
  faDefined: boolean;
  label: string;
  yMin: number;
  yMax: number;
}
interface Input {
  kind: AnswerKind;
  value: number | null;
}
interface View {
  a: number;
  side: "left" | "right" | "both";
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** the path y = f(x) for the plotter; null gaps where undefined */
  samples: { x: number; y: number | null }[];
  /** what the world shows AT a: a filled tile at (a, fa), a hole, or nothing */
  at: { x: number; y: number | null; defined: boolean };
  pieces: string[];
}

const TOLERANCE = 0.03;

function nums(p: Params) {
  return { a: evalExact(p.a), xMin: evalExact(p.xMin), xMax: evalExact(p.xMax) };
}

function yRange(samples: { y: number | null }[], extra: number[]): { yMin: number; yMax: number } {
  const ys = [...samples.map((s) => s.y).filter((y): y is number => y !== null), ...extra];
  if (ys.length === 0) return { yMin: -5, yMax: 5 };
  // Clip outliers (blow-ups) with the 5th–95th percentiles, then pad.
  const sorted = [...ys].sort((x, y) => x - y);
  const lo = sorted[Math.floor(sorted.length * 0.05)];
  const hi = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const pad = Math.max(1, (hi - lo) * 0.15);
  return { yMin: Math.floor((lo - pad) * 2) / 2, yMax: Math.ceil((hi + pad) * 2) / 2 };
}

function solve(p: Params): Solution {
  const { a, xMin, xMax } = nums(p);
  if (a === null || xMin === null || xMax === null) throw new Error("function_world.limit: a, xMin, xMax must be exact numbers");
  const f = compileFunction(p.pieces, p.overrides);
  const left = sideLimit(f, a, "left");
  const right = sideLimit(f, a, "right");
  const combined: SideLimit = p.side === "left" ? left : p.side === "right" ? right : combineLimits(left, right);
  const fa = evaluateAt(f, a);
  const samples = samplePath(f, xMin, xMax);
  const { yMin, yMax } = yRange(samples, [fa ?? 0, combined.kind === "value" ? combined.value : 0]);
  return {
    kind: combined.kind,
    value: combined.kind === "value" ? combined.value : null,
    left,
    right,
    fa,
    faDefined: fa !== null,
    label: limitLabel(combined),
    yMin,
    yMax,
  };
}

export const limit = defineMode({
  id: "limit",
  name: "Limit",
  implemented: true,
  blindSolvable: false,
  widget: "place",
  knowledgeTypes: ["quantitative"],
  directorBlurb:
    "The floor is y = f(x). The player walks toward x = a from the left, right, or both and answers where f(x) is heading: a value, DNE, or ±∞. Limits, holes, jumps, decoy function values, infinite limits.",
  authoringGuide: [
    "Write f as 1-4 pieces with exact endpoints; use \"-inf\"/\"inf\" for unbounded ends. A hole is an override with y null; a decoy is an override whose y differs from the limit.",
    "A jump is two pieces meeting at a with different values; make exactly one side closed at a (or use an override) so f(a) is defined once.",
    "For an infinite limit use an expression that blows up at a, e.g. \"1/(x-2)^2\" (+∞) or \"-1/(x-2)^2\" (−∞); one-sided blow-ups like \"1/(x-2)\" give DNE for both sides.",
    "Keep a strictly inside [xMin, xMax] and leave room on the approach side(s). Never write the limit as a number anywhere.",
    "Placeholders: {{a}}, {{side}}, {{fa}} (what the tile at a shows: a value, or 'undefined'), {{limit}} (the answer: last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    for (const key of ["a", "xMin", "xMax"] as const) if (looksApproximated(p[key])) problems.push(`${key} "${p[key]}" looks like a rounded decimal; write it exactly`);
    p.pieces.forEach((pc, i) => {
      if (looksApproximated(pc.from) || looksApproximated(pc.to)) problems.push(`pieces[${i}] endpoints look like rounded decimals; write them exactly`);
    });
    const { a, xMin, xMax } = nums(p);
    if (a === null || xMin === null || xMax === null) {
      problems.push("a, xMin and xMax must evaluate to numbers");
      return problems;
    }
    if (!(xMin < xMax)) problems.push("xMin must be less than xMax");
    if (!(a > xMin && a < xMax)) problems.push("a must lie strictly inside [xMin, xMax]");
    let f;
    try {
      f = compileFunction(p.pieces, p.overrides);
    } catch (err) {
      problems.push(err instanceof Error ? err.message : String(err));
      return problems;
    }
    for (let i = 0; i < f.pieces.length; i++) {
      const pc = f.pieces[i];
      if (!(pc.from < pc.to)) problems.push(`pieces[${i}]: from must be less than to`);
      for (let j = i + 1; j < f.pieces.length; j++) {
        const q = f.pieces[j];
        if (pc.to > q.from + 1e-12 && q.to > pc.from + 1e-12) problems.push(`pieces[${i}] and pieces[${j}] overlap; pieces must be non-overlapping`);
      }
    }
    const atA = f.overrides.filter((o) => Math.abs(o.x - a) < 1e-12);
    if (atA.length > 1) problems.push("at most one override at x = a");
    const needLeft = p.side !== "right";
    const needRight = p.side !== "left";
    const l = sideLimit(f, a, "left");
    const r = sideLimit(f, a, "right");
    if (needLeft && l.kind === "dne" && (p.side === "left" || r.kind === "dne")) {
      problems.push("f is undefined or oscillating just left of a; the approach path must exist on the side(s) asked (a jump is fine, a gap is not)");
    }
    if (needRight && r.kind === "dne" && (p.side === "right" || l.kind === "dne")) {
      problems.push("f is undefined or oscillating just right of a; the approach path must exist on the side(s) asked");
    }
    if (problems.length) return problems;
    const s = solve(p);
    if (s.kind === "value" && s.value !== null && Math.abs(s.value) > 1e4) problems.push("the limit is enormous; scale the function so values stay within a few units");
    if (s.kind === "value" && s.value !== null && s.faDefined && s.fa !== null && Math.abs(s.fa - s.value) < 1e-9 && p.overrides.length > 0) {
      problems.push("the override at a equals the limit, so it is neither a hole nor a decoy; remove it or change its y");
    }
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return {
      a: prettyExpr(p.a),
      side: p.side === "both" ? "both sides" : `the ${p.side}`,
      fa: s.faDefined && s.fa !== null ? trimNumber(s.fa) : "undefined",
      limit: s.label,
    };
  },
  answerVars: ["limit"],
  present(p): View {
    const s = solve(p);
    const { a, xMin, xMax } = nums(p);
    const f = compileFunction(p.pieces, p.overrides);
    return {
      a: a!,
      side: p.side,
      xMin: xMin!,
      xMax: xMax!,
      yMin: s.yMin,
      yMax: s.yMax,
      samples: samplePath(f, xMin!, xMax!),
      at: { x: a!, y: s.fa, defined: s.faDefined },
      pieces: p.pieces.map((pc) => prettyExpr(pc.expr)),
    };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const sideText = p.side === "both" ? "from both sides" : `from the ${p.side}`;
    if (input.kind !== s.kind) {
      if (s.kind === "dne") {
        return {
          correct: false,
          feedback: `Walk in ${sideText} again: the two approaches don't meet at the same height, so there is no single value to name.`,
        };
      }
      if (s.kind === "pos_infinity" || s.kind === "neg_infinity") {
        return { correct: false, feedback: "Watch the marker as you get closer: it never settles; it keeps climbing (or falling) without bound. That isn't a large number, it's unbounded." };
      }
      if (input.kind === "dne") {
        return { correct: false, feedback: `Approach ${sideText} once more: the path heads to one definite height, even if the tile at x = ${prettyExpr(p.a)} says otherwise.` };
      }
      return { correct: false, feedback: "The marker settles toward a finite height as you approach; name that height." };
    }
    if (s.kind !== "value" || s.value === null) return { correct: true, feedback: "The gate opens: you read where the path was heading." };
    const target = s.value;
    const tol = TOLERANCE * Math.max(1e-9, s.yMax - s.yMin);
    const got = input.value ?? Number.NaN;
    if (Number.isFinite(got) && Math.abs(got - target) <= tol) return { correct: true, feedback: "The gate opens: both paths converge on that height." };
    if (s.faDefined && s.fa !== null && Number.isFinite(got) && Math.abs(got - s.fa) <= tol && Math.abs(s.fa - target) > tol) {
      return { correct: false, feedback: `That is where the tile AT x = ${prettyExpr(p.a)} sits, not where the path is heading. The limit is about the approach, not the value at the point.` };
    }
    return { correct: false, feedback: `You landed ${got > target ? "above" : "below"} where the path is heading. Scrub closer to x = ${prettyExpr(p.a)} and read the marker's height.` };
  },
  solutionInput: (_p, s) => ({ kind: s.kind, value: s.value }),
});
