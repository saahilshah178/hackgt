import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, trimNumber } from "../../util";
import { compileFunction, evaluatePath, samplePath, type PieceParams } from "./shared";

/* function_world · roots: mark every x where the terrain meets sea level (f = 0). Card: sea_level_roots. */

const Piece = z.object({ expr: z.string(), from: z.string(), to: z.string(), openLeft: z.boolean(), openRight: z.boolean() });
const Params = z.object({
  pieces: z.array(Piece).min(1).max(4).describe('The terrain y = f(x), e.g. one piece "x^2 - 4" on ["-inf","inf"]'),
  xMin: z.string().describe("exact left edge of the visible world"),
  xMax: z.string().describe("exact right edge"),
});
type Params = z.infer<typeof Params>;
interface Solution { roots: number[]; tolerance: number }
interface Input { xs: number[] }
interface View { xMin: number; xMax: number; yMin: number; yMax: number; samples: { x: number; y: number | null }[] }

export function findRoots(pieces: PieceParams[], xMin: number, xMax: number): number[] {
  const f = compileFunction(pieces, []);
  const n = 2000;
  const roots: number[] = [];
  let prevX = xMin;
  let prevY = evaluatePath(f, xMin);
  for (let i = 1; i <= n; i++) {
    const x = xMin + ((xMax - xMin) * i) / n;
    const y = evaluatePath(f, x);
    if (prevY !== null && y !== null && Number.isFinite(prevY) && Number.isFinite(y)) {
      if (prevY === 0) roots.push(prevX);
      else if (prevY * y < 0 && Math.abs(prevY) < 1e6 && Math.abs(y) < 1e6) {
        let lo = prevX, hi = x, ylo = prevY;
        for (let k = 0; k < 60; k++) {
          const mid = (lo + hi) / 2;
          const ym = evaluatePath(f, mid);
          if (ym === null) break;
          if (ym === 0) { lo = hi = mid; break; }
          if (ylo * ym < 0) hi = mid; else { lo = mid; ylo = ym; }
        }
        roots.push((lo + hi) / 2);
      }
    }
    prevX = x; prevY = y;
  }
  const out: number[] = [];
  for (const r of roots.map((r) => Math.round(r * 1e6) / 1e6)) if (!out.some((o) => Math.abs(o - r) < 1e-6)) out.push(r);
  return out;
}

function solve(p: Params): Solution {
  const xMin = evalExact(p.xMin)!; const xMax = evalExact(p.xMax)!;
  return { roots: findRoots(p.pieces, xMin, xMax), tolerance: 0.03 * (xMax - xMin) };
}

export const roots = defineMode({
  id: "roots",
  name: "Roots",
  implemented: true,
  blindSolvable: false,
  widget: "place",
  knowledgeTypes: ["quantitative"],
  directorBlurb: "The terrain is y = f(x); the player marks every point where it meets sea level (f = 0). Zeros, roots, the number of real solutions.",
  authoringGuide: ["Write f with 1-3 zeros strictly inside [xMin, xMax], spaced at least 10% of the range apart. Pick f so a quadratic with two roots (or one, or none nearby) teaches the misconception.", "Placeholders: {{rootCount}} and {{roots}} (answers: last hint and debrief only)."].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (looksApproximated(p.xMin) || looksApproximated(p.xMax)) problems.push("xMin/xMax look like rounded decimals");
    const xMin = evalExact(p.xMin); const xMax = evalExact(p.xMax);
    if (xMin === null || xMax === null || !(xMin < xMax)) { problems.push("xMin and xMax must be exact numbers with xMin < xMax"); return problems; }
    let rs: number[];
    try { rs = findRoots(p.pieces, xMin, xMax); } catch (err) { problems.push(err instanceof Error ? err.message : String(err)); return problems; }
    if (rs.length === 0) problems.push("f has no root in [xMin, xMax]; the player would have nothing to mark");
    const tol = 0.03 * (xMax - xMin);
    for (let i = 1; i < rs.length; i++) if (rs[i] - rs[i - 1] < 3 * tol) problems.push(`roots at ${trimNumber(rs[i - 1])} and ${trimNumber(rs[i])} are too close to tell apart on the dial`);
    if (rs.some((r) => r < xMin + tol || r > xMax - tol)) problems.push("every root must sit clearly inside the visible range");
    return problems;
  },
  resolve: solve,
  templateVars(_p, s) { return { rootCount: String(s.roots.length), roots: s.roots.map(trimNumber).join(", ") }; },
  answerVars: ["rootCount", "roots"],
  present(p): View {
    const xMin = evalExact(p.xMin)!; const xMax = evalExact(p.xMax)!;
    const samples = samplePath(compileFunction(p.pieces, []), xMin, xMax);
    const ys = samples.map((s) => s.y).filter((y): y is number => y !== null);
    const pad = Math.max(1, (Math.max(...ys) - Math.min(...ys)) * 0.15);
    return { xMin, xMax, yMin: Math.floor(Math.min(...ys, 0) - pad), yMax: Math.ceil(Math.max(...ys, 0) + pad), samples };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const xs = (input.xs ?? []).filter(Number.isFinite);
    if (xs.length === 0) return { correct: false, feedback: "Mark every point where the terrain touches sea level." };
    const stray = xs.find((x) => !s.roots.some((r) => Math.abs(r - x) <= s.tolerance));
    if (stray !== undefined) return { correct: false, feedback: `Your mark at x = ${trimNumber(stray)} isn't at sea level: the terrain is ${(evaluatePath(compileFunction(p.pieces, []), stray) ?? 0) > 0 ? "above" : "below"} zero there.` };
    const missed = s.roots.filter((r) => !xs.some((x) => Math.abs(r - x) <= s.tolerance));
    if (missed.length) return { correct: false, feedback: `You marked ${xs.length} point${xs.length === 1 ? "" : "s"}, but the terrain crosses sea level more often than that. Look where it changes sign.` };
    if (xs.length > s.roots.length) return { correct: false, feedback: "Two of your marks sit on the same crossing; one mark per root." };
    return { correct: true, feedback: `All ${s.roots.length} crossing${s.roots.length === 1 ? "" : "s"} found.` };
  },
  solutionInput: (_p, s) => ({ xs: s.roots }),
});
