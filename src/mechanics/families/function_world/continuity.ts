import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, trimNumber } from "../../util";
import { combineLimits, compileFunction, evaluateAt, samplePath, sideLimit, type CompiledFunction } from "./shared";

/*
 * function_world · continuity: find where a cart would stop (holes, jumps, blow-ups), classify the break at a,
 * or repair a removable discontinuity by placing the missing value. Cards: unbroken_track, repair_the_track.
 */

const Piece = z.object({ expr: z.string(), from: z.string(), to: z.string(), openLeft: z.boolean(), openRight: z.boolean() });
const Params = z.object({
  pieces: z.array(Piece).min(1).max(4),
  overrides: z.array(z.object({ x: z.string(), y: z.string().nullable() })).min(0).max(3),
  xMin: z.string(),
  xMax: z.string(),
  ask: z.enum(["find", "classify", "repair"]).describe("find: mark every discontinuity. classify: what kind of break is at a. repair: the value that would make f continuous at a"),
  a: z.string().describe('the point for classify/repair; "0" when ask is find'),
});
type Params = z.infer<typeof Params>;
type BreakKind = "removable" | "jump" | "infinite" | "continuous";
interface Break { x: number; kind: BreakKind }
interface Solution { breaks: Break[]; kindAtA: BreakKind | null; repairValue: number | null; tolerance: number }
interface Input { xs: number[] | null; kind: BreakKind | null; y: number | null }
interface View { ask: "find" | "classify" | "repair"; a: number | null; xMin: number; xMax: number; samples: { x: number; y: number | null }[]; points: { x: number; y: number | null }[] }

function classifyAt(f: CompiledFunction, x: number): BreakKind {
  const l = sideLimit(f, x, "left"); const r = sideLimit(f, x, "right");
  const both = combineLimits(l, r);
  const fa = evaluateAt(f, x);
  if (l.kind === "pos_infinity" || l.kind === "neg_infinity" || r.kind === "pos_infinity" || r.kind === "neg_infinity") return "infinite";
  if (both.kind === "value") return fa !== null && Math.abs(fa - both.value) <= 1e-6 * (1 + Math.abs(fa)) ? "continuous" : "removable";
  if (l.kind === "value" && r.kind === "value") return "jump";
  return "jump";
}

function candidates(p: Params, f: CompiledFunction, xMin: number, xMax: number): number[] {
  const xs = new Set<number>();
  for (const pc of f.pieces) for (const b of [pc.from, pc.to]) if (Number.isFinite(b) && b > xMin && b < xMax) xs.add(b);
  for (const o of f.overrides) if (o.x > xMin && o.x < xMax) xs.add(o.x);
  return [...xs].sort((a, b) => a - b);
}

function solve(p: Params): Solution {
  const xMin = evalExact(p.xMin)!; const xMax = evalExact(p.xMax)!;
  const f = compileFunction(p.pieces, p.overrides);
  const breaks = candidates(p, f, xMin, xMax).map((x) => ({ x, kind: classifyAt(f, x) })).filter((b) => b.kind !== "continuous");
  const a = evalExact(p.a);
  const kindAtA = p.ask === "find" || a === null ? null : classifyAt(f, a);
  let repairValue: number | null = null;
  if (p.ask === "repair" && a !== null) {
    const both = combineLimits(sideLimit(f, a, "left"), sideLimit(f, a, "right"));
    repairValue = both.kind === "value" ? both.value : null;
  }
  return { breaks, kindAtA, repairValue, tolerance: 0.03 * (xMax - xMin) };
}

export const continuity = defineMode({
  id: "continuity",
  name: "Continuity",
  implemented: true,
  blindSolvable: false,
  widget: "place",
  knowledgeTypes: ["quantitative"],
  directorBlurb: "A cart rides the track y = f(x): find where holes, jumps and blow-ups stop it, name the kind of break, or patch a removable hole with the right value. Continuity, discontinuity types.",
  authoringGuide: [
    "Build breaks with the pieces: a hole = override with y null; a decoy point = override with a different y; a jump = two pieces with different values at the join (one side closed); a blow-up = an expression like 1/(x-2) with a hole at 2.",
    "ask=find: 1-3 breaks strictly inside the range. ask=classify: a must be a piece endpoint or override. ask=repair: the break at a must be removable (both sides agree).",
    "Placeholders: {{a}} (safe), {{breakCount}}, {{kind}}, {{repair}} (answers: last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (looksApproximated(p.xMin) || looksApproximated(p.xMax) || looksApproximated(p.a)) problems.push("xMin, xMax and a must be exact");
    const xMin = evalExact(p.xMin); const xMax = evalExact(p.xMax);
    if (xMin === null || xMax === null || !(xMin < xMax)) { problems.push("xMin and xMax must be exact numbers with xMin < xMax"); return problems; }
    let s: Solution;
    try { s = solve(p); } catch (err) { problems.push(err instanceof Error ? err.message : String(err)); return problems; }
    if (p.ask === "find") {
      if (s.breaks.length === 0) problems.push("ask=find needs at least one discontinuity inside the range");
      for (let i = 1; i < s.breaks.length; i++) if (s.breaks[i].x - s.breaks[i - 1].x < 3 * s.tolerance) problems.push("two breaks are too close together to mark separately");
    } else {
      const a = evalExact(p.a);
      if (a === null || a <= xMin || a >= xMax) problems.push("a must be an exact number strictly inside [xMin, xMax]");
      else if (s.kindAtA === "continuous" && p.ask === "repair") problems.push("f is already continuous at a; nothing to repair");
      else if (p.ask === "repair" && s.kindAtA !== "removable") problems.push(`the break at a is ${s.kindAtA}, not removable; ask=repair needs a hole or a decoy point where both sides agree`);
    }
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { a: p.a, breakCount: String(s.breaks.length), kind: s.kindAtA ?? "", repair: s.repairValue === null ? "" : trimNumber(s.repairValue) };
  },
  answerVars: ["breakCount", "kind", "repair"],
  present(p): View {
    const xMin = evalExact(p.xMin)!; const xMax = evalExact(p.xMax)!;
    const f = compileFunction(p.pieces, p.overrides);
    return { ask: p.ask, a: p.ask === "find" ? null : evalExact(p.a), xMin, xMax, samples: samplePath(f, xMin, xMax), points: f.overrides.map((o) => ({ x: o.x, y: o.y })) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if (p.ask === "find") {
      const xs = (input.xs ?? []).filter(Number.isFinite);
      const stray = xs.find((x) => !s.breaks.some((b) => Math.abs(b.x - x) <= s.tolerance));
      if (stray !== undefined) return { correct: false, feedback: `The cart rolls straight through x = ${trimNumber(stray)}: the track is whole there (defined, and both sides meet the point).` };
      const missed = s.breaks.find((b) => !xs.some((x) => Math.abs(b.x - x) <= s.tolerance));
      if (missed) return { correct: false, feedback: `The cart still crashes somewhere you didn't mark: look for a ${missed.kind === "infinite" ? "vertical blow-up" : missed.kind === "jump" ? "jump between two heights" : "hole or misplaced tile"}.` };
      if (xs.length > s.breaks.length) return { correct: false, feedback: "Two marks share one break; one mark per discontinuity." };
      return { correct: true, feedback: `All ${s.breaks.length} break${s.breaks.length === 1 ? "" : "s"} found.` };
    }
    if (p.ask === "classify") {
      if (input.kind === s.kindAtA) return { correct: true, feedback: `Right: a ${s.kindAtA} break at x = ${p.a}.` };
      const hint = { removable: "both sides head to the same height; only the point itself is off", jump: "the two sides arrive at different heights", infinite: "the track shoots off without bound near the point", continuous: "the track is whole there" }[s.kindAtA ?? "continuous"];
      return { correct: false, feedback: `Not that kind. Approach x = ${p.a} from both sides and compare: ${hint}.` };
    }
    if (s.repairValue === null) return { correct: false, feedback: "This break can't be repaired with one point." };
    const tol = Math.max(0.05, Math.abs(s.repairValue) * 0.03);
    if (input.y !== null && Math.abs(input.y - s.repairValue) <= tol) return { correct: true, feedback: "The tile fits: the track is continuous again." };
    return { correct: false, feedback: `The patch sits ${(input.y ?? 0) > s.repairValue ? "above" : "below"} where the two sides of the track are heading. Follow the track in from both sides and read the height they agree on.` };
  },
  solutionInput: (p, s) => ({ xs: p.ask === "find" ? s.breaks.map((b) => b.x) : null, kind: p.ask === "classify" ? s.kindAtA : null, y: p.ask === "repair" ? s.repairValue : null }),
});
