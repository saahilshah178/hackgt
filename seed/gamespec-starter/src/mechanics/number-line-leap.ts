import { z } from "zod";
import { defineMechanic } from "./types";
import { evalExact, formatNumber, looksApproximated, prettyExpr, trimNumber } from "./util";

const Params = z.object({
  min: z.string().describe('Left end as an exact mathjs expression, e.g. "0"'),
  max: z.string().describe('Right end, e.g. "2*pi"'),
  target: z.string().describe('The value to land on, exact, e.g. "5*pi/6". Must NOT sit on a labeled landmark'),
  landmarkStep: z.string().describe('Spacing of labeled landmarks, e.g. "pi/2". Coarser than the target\'s precision'),
  labels: z.enum(["decimal", "pi"]).describe("Landmark label style"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  value: number;
  tolerance: number;
  label: string;
  between: string;
}
interface Input {
  value: number;
}
interface View {
  min: number;
  max: number;
  target: string;
  landmarks: { value: number; label: string }[];
}

function nums(p: Params) {
  return { min: evalExact(p.min), max: evalExact(p.max), target: evalExact(p.target), step: evalExact(p.landmarkStep) };
}

function landmarks(p: Params): View["landmarks"] {
  const { min, max, step } = nums(p);
  const out: View["landmarks"] = [];
  for (let v = min!; v <= max! + 1e-9; v += step!) {
    out.push({ value: v, label: p.labels === "pi" ? formatNumber(v) : trimNumber(v) });
  }
  return out;
}

function solve(p: Params): Solution {
  const { min, max, target } = nums(p);
  if (min === null || max === null || target === null) throw new Error("number_line_leap: bad expressions");
  const marks = landmarks(p);
  const left = [...marks].reverse().find((m) => m.value < target);
  const right = marks.find((m) => m.value > target);
  return {
    value: target,
    tolerance: 0.015 * (max - min),
    label: p.labels === "pi" ? formatNumber(target) : trimNumber(target),
    between: left && right ? `${left.label} and ${right.label}` : "",
  };
}

export const numberLineLeap = defineMechanic({
  id: "number_line_leap",
  name: "Number Line Leap",
  widget: "place",
  knowledgeTypes: ["quantitative", "spatial"],
  implemented: true,
  directorBlurb:
    "The player lands on a value on a number line with only coarse landmarks labeled. Magnitude, fractions, radians, scientific notation, log scales.",
  authoringGuide: [
    "Write every value exactly (\"5*pi/6\", \"3/8\", \"10^-9\"). Never round.",
    "Choose landmarkStep so the target falls BETWEEN labeled landmarks, never on one.",
    "Placeholders: {{target}} (safe anywhere), {{between}} (the two landmarks around it: a strong hint, so only in later hints and the debrief).",
  ].join("\n"),
  genres: {
    dungeon: { sockets: ["altar", "enemy"], skin: "Rune line on the altar floor, or an archery range" },
    platformer: { sockets: ["gap"], skin: "The floor is a number line; land on the value" },
    mystery: { sockets: ["conversation"], skin: "At the auction, bid the right magnitude" },
    puzzle: { sockets: ["tile_puzzle"], skin: "Place the tile at its correct position on the line" },
  },
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    for (const key of ["min", "max", "target", "landmarkStep"] as const) {
      if (looksApproximated(p[key])) problems.push(`${key} "${p[key]}" looks like a rounded decimal; write it exactly`);
    }
    const { min, max, target, step } = nums(p);
    if (min === null || max === null || target === null || step === null) {
      problems.push("min, max, target and landmarkStep must all evaluate to numbers");
      return problems;
    }
    if (!(min < max)) problems.push("min must be less than max");
    if (!(target > min && target < max)) problems.push("target must lie strictly between min and max");
    if (step <= 0) {
      problems.push("landmarkStep must be positive");
      return problems;
    }
    const count = (max - min) / step;
    if (count < 2 || count > 12) problems.push(`landmarkStep gives ${trimNumber(count)} gaps; aim for 2 to 12`);
    const k = (target - min) / step;
    if (Math.abs(k - Math.round(k)) < 1e-6) problems.push("target sits exactly on a labeled landmark; use a coarser landmarkStep");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { target: prettyExpr(p.target), between: s.between };
  },
  answerVars: ["between"],
  present(p): View {
    const { min, max } = nums(p);
    return { min: min!, max: max!, target: prettyExpr(p.target), landmarks: landmarks(p) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const off = input.value - s.value;
    if (Math.abs(off) <= s.tolerance) return { correct: true, feedback: "A perfect landing." };
    return {
      correct: false,
      feedback: `You landed ${off > 0 ? "past" : "short of"} ${prettyExpr(p.target)}. Count how many landmark gaps it takes to get there.`,
    };
  },
  solutionInput: (_p, s) => ({ value: s.value }),
});
