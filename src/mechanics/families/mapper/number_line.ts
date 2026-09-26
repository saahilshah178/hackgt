import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, formatNumber, looksApproximated, prettyExpr, trimNumber } from "../../util";

/*
 * mapper · number_line: land on a value with only coarse landmarks labeled. Linear or log scale.
 * On a log scale every value is positive, positions are proportional to log10, and landmarkStep is the
 * exponent spacing (e.g. "1" labels 10^0, 10^1, 10^2 ...).
 */

const Params = z.object({
  scale: z.enum(["linear", "log"]).describe("linear for ordinary lines; log for orders of magnitude, pH, scientific notation"),
  min: z.string().describe('Left end as an exact mathjs expression, e.g. "0" (log scale: a positive value such as "10^-3")'),
  max: z.string().describe('Right end, e.g. "2*pi" (log scale: e.g. "10^6")'),
  target: z.string().describe('The value to land on, exact, e.g. "5*pi/6" or "10^3". Must NOT sit on a labeled landmark'),
  landmarkStep: z
    .string()
    .describe('Spacing of labeled landmarks, e.g. "pi/2". On a log scale this is the exponent spacing, e.g. "1" or "3"'),
  labels: z.enum(["decimal", "pi", "power"]).describe("Landmark label style: decimal, multiples of π, or powers of ten"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  value: number;
  /** tolerance in line fraction (0-1), 1.5% of the line */
  tolerance: number;
  /** the target as a fraction of the line, 0-1 */
  fraction: number;
  label: string;
  between: string;
}
interface Input {
  value: number;
}
interface View {
  scale: "linear" | "log";
  min: number;
  max: number;
  target: string;
  landmarks: { value: number; fraction: number; label: string }[];
}

const TOLERANCE = 0.015;

function nums(p: Params) {
  return { min: evalExact(p.min), max: evalExact(p.max), target: evalExact(p.target), step: evalExact(p.landmarkStep) };
}

function toFraction(p: Params, min: number, max: number, v: number): number {
  if (p.scale === "log") return (Math.log10(v) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
  return (v - min) / (max - min);
}

function label(p: Params, v: number): string {
  if (p.labels === "pi") return formatNumber(v);
  if (p.labels === "power") {
    const e = Math.log10(v);
    return Math.abs(e - Math.round(e)) < 1e-9 ? `10^${Math.round(e)}` : trimNumber(v);
  }
  return trimNumber(v);
}

function landmarks(p: Params): View["landmarks"] {
  const { min, max, step } = nums(p);
  const out: View["landmarks"] = [];
  if (min === null || max === null || step === null) return out;
  if (p.scale === "log") {
    const e0 = Math.ceil(Math.log10(min) - 1e-9);
    const e1 = Math.floor(Math.log10(max) + 1e-9);
    for (let e = e0; e <= e1 + 1e-9; e += step) {
      const v = 10 ** e;
      out.push({ value: v, fraction: toFraction(p, min, max, v), label: label(p, v) });
    }
    return out;
  }
  for (let v = min; v <= max + 1e-9; v += step) {
    out.push({ value: v, fraction: toFraction(p, min, max, v), label: label(p, v) });
  }
  return out;
}

function solve(p: Params): Solution {
  const { min, max, target } = nums(p);
  if (min === null || max === null || target === null) throw new Error("mapper.number_line: bad expressions");
  const marks = landmarks(p);
  const left = [...marks].reverse().find((m) => m.value < target);
  const right = marks.find((m) => m.value > target);
  return {
    value: target,
    tolerance: TOLERANCE,
    fraction: toFraction(p, min, max, target),
    label: label(p, target),
    between: left && right ? `${left.label} and ${right.label}` : "",
  };
}

export const numberLine = defineMode({
  id: "number_line",
  name: "Number line",
  implemented: true,
  blindSolvable: false,
  widget: "place",
  knowledgeTypes: ["quantitative", "spatial"],
  directorBlurb:
    "The player lands on a value on a number line with only coarse landmarks labeled. Magnitude, fractions, radians, scientific notation, log scales.",
  authoringGuide: [
    "Write every value exactly (\"5*pi/6\", \"3/8\", \"10^-9\"). Never round.",
    "Choose landmarkStep so the target falls BETWEEN labeled landmarks, never on one.",
    "Use scale \"log\" with labels \"power\" for orders of magnitude; then min, max and target are positive and landmarkStep is the exponent spacing.",
    "Placeholders: {{target}} (safe anywhere), {{between}} (the two landmarks around it: a strong hint, so only in later hints and the debrief).",
  ].join("\n"),
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
    if (p.scale === "log") {
      if (min <= 0 || target <= 0) problems.push("on a log scale min, max and target must be positive");
      if (p.labels === "pi") problems.push('log scales use labels "power" or "decimal", not "pi"');
      if (problems.length) return problems;
      const count = (Math.log10(max) - Math.log10(min)) / step;
      if (count < 2 || count > 12) problems.push(`landmarkStep gives ${trimNumber(count)} decades per label; aim for 2 to 12 labeled landmarks`);
      const k = Math.log10(target);
      if (Math.abs(k - Math.round(k)) < 1e-6 && Math.abs((k - Math.round(k)) / step) < 1e-6) {
        problems.push("target sits exactly on a labeled power of ten; pick a value between landmarks");
      }
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
    return { scale: p.scale, min: min!, max: max!, target: prettyExpr(p.target), landmarks: landmarks(p) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const { min, max } = nums(p);
    const got = toFraction(p, min!, max!, input.value);
    const off = got - s.fraction;
    if (Number.isFinite(got) && Math.abs(off) <= s.tolerance) return { correct: true, feedback: "A perfect landing." };
    return {
      correct: false,
      feedback: `You landed ${off > 0 ? "past" : "short of"} ${prettyExpr(p.target)}. Count how many landmark gaps it takes to get there.`,
    };
  },
  solutionInput: (_p, s) => ({ value: s.value }),
});
