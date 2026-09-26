import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, trimNumber } from "../../util";

/*
 * tuner · curve: a template (linear m,b; quadratic a,b,c or a,h,k; exponential a,b). The model gives the target
 * parameters; code derives the checkpoints the curve must pass through (as many as there are parameters, so the
 * fit is unique) and grades by whether the player's curve hits them. Cards: graph_terrain, projectile_architect, move_the_arc.
 */

export const TEMPLATES = {
  linear: { params: ["m", "b"], f: (v: Record<string, number>, x: number) => v.m * x + v.b, label: "y = m·x + b" },
  quadratic_standard: { params: ["a", "b", "c"], f: (v: Record<string, number>, x: number) => v.a * x * x + v.b * x + v.c, label: "y = a·x² + b·x + c" },
  quadratic_vertex: { params: ["a", "h", "k"], f: (v: Record<string, number>, x: number) => v.a * (x - v.h) ** 2 + v.k, label: "y = a·(x − h)² + k" },
  exponential: { params: ["a", "b"], f: (v: Record<string, number>, x: number) => v.a * v.b ** x, label: "y = a·bˣ" },
} as const;
type Template = keyof typeof TEMPLATES;

const Params = z.object({
  template: z.enum(["linear", "quadratic_standard", "quadratic_vertex", "exponential"]),
  target: z.array(z.object({ name: z.string(), value: z.string().describe("exact") })).min(2).max(3).describe("The true parameter values, one per template parameter"),
  ranges: z.array(z.object({ name: z.string(), min: z.number(), max: z.number() })).min(2).max(3).describe("Dial range per parameter; the target must be inside"),
  xMin: z.string().describe("exact left edge of the visible world"),
  xMax: z.string().describe("exact right edge"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  values: Record<string, number>;
  checkpoints: { x: number; y: number }[];
  yRange: number;
}
interface Input {
  values: { name: string; value: number }[];
}
interface View {
  template: Template;
  formula: string;
  params: { name: string; min: number; max: number; step: number }[];
  checkpoints: { x: number; y: number }[];
  xMin: number;
  xMax: number;
}

function values(p: Params): Record<string, number> {
  return Object.fromEntries(p.target.map((t) => [t.name, evalExact(t.value) ?? Number.NaN]));
}

function solve(p: Params): Solution {
  const t = TEMPLATES[p.template];
  const v = values(p);
  const xMin = evalExact(p.xMin)!;
  const xMax = evalExact(p.xMax)!;
  const n = t.params.length;
  const checkpoints = Array.from({ length: n }, (_, i) => {
    const x = xMin + ((xMax - xMin) * (i + 1)) / (n + 1);
    return { x: Math.round(x * 1e6) / 1e6, y: Math.round(t.f(v, x) * 1e6) / 1e6 };
  });
  const ys = Array.from({ length: 41 }, (_, i) => t.f(v, xMin + ((xMax - xMin) * i) / 40)).filter(Number.isFinite);
  return { values: v, checkpoints, yRange: Math.max(1e-9, Math.max(...ys) - Math.min(...ys)) };
}

export const curve = defineMode({
  id: "curve",
  name: "Curve tuner",
  implemented: true,
  blindSolvable: false,
  widget: "dial",
  knowledgeTypes: ["quantitative"],
  directorBlurb: "Tune the parameters of a line, parabola, or exponential until the curve passes through the checkpoints. Slope and intercept, quadratics in standard or vertex form, growth curves.",
  authoringGuide: [
    "Pick the template, give exact target values for its parameters (m,b | a,b,c | a,h,k | a,b) and a dial range per parameter that contains the target with room on both sides.",
    "Code derives the checkpoints the curve must pass through; never describe them as numbers in the text.",
    "Placeholders: {{formula}} (safe), {{targets}} (the answer values: last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const t = TEMPLATES[p.template];
    const names = p.target.map((x) => x.name);
    if ([...t.params].sort().join() !== [...names].sort().join()) problems.push(`template ${p.template} needs exactly the parameters ${t.params.join(", ")}`);
    if ([...t.params].sort().join() !== [...p.ranges.map((r) => r.name)].sort().join()) problems.push(`ranges must cover exactly ${t.params.join(", ")}`);
    for (const tv of p.target) if (looksApproximated(tv.value)) problems.push(`target ${tv.name} "${tv.value}" looks like a rounded decimal; write it exactly`);
    if (looksApproximated(p.xMin) || looksApproximated(p.xMax)) problems.push("xMin/xMax look like rounded decimals");
    const xMin = evalExact(p.xMin);
    const xMax = evalExact(p.xMax);
    if (xMin === null || xMax === null || !(xMin < xMax)) problems.push("xMin and xMax must be exact numbers with xMin < xMax");
    if (problems.length) return problems;
    const v = values(p);
    for (const r of p.ranges) {
      if (!(r.min < r.max)) problems.push(`range for ${r.name} must have min < max`);
      const tv = v[r.name];
      if (!Number.isFinite(tv)) problems.push(`target ${r.name} must evaluate to a number`);
      else if (tv <= r.min + 0.05 * (r.max - r.min) || tv >= r.max - 0.05 * (r.max - r.min)) problems.push(`target ${r.name} = ${trimNumber(tv)} must sit well inside its range [${r.min}, ${r.max}]`);
    }
    if (p.template === "exponential" && (v.b ?? 0) <= 0) problems.push("exponential base b must be positive");
    if (p.template.startsWith("quadratic") && Math.abs(v.a ?? 0) < 1e-9) problems.push("a must be nonzero for a quadratic");
    if (p.template === "linear" && Math.abs(v.m ?? 0) < 1e-9) problems.push("m must be nonzero, or the line is flat and trivial");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { formula: TEMPLATES[p.template].label, targets: TEMPLATES[p.template].params.map((n) => `${n} = ${trimNumber(s.values[n])}`).join(", ") };
  },
  answerVars: ["targets"],
  present(p): View {
    const s = solve(p);
    return {
      template: p.template,
      formula: TEMPLATES[p.template].label,
      params: TEMPLATES[p.template].params.map((name) => {
        const r = p.ranges.find((x) => x.name === name)!;
        return { name, min: r.min, max: r.max, step: (r.max - r.min) / 100 };
      }),
      checkpoints: s.checkpoints,
      xMin: evalExact(p.xMin)!,
      xMax: evalExact(p.xMax)!,
    };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const t = TEMPLATES[p.template];
    const v = Object.fromEntries((input.values ?? []).map((x) => [x.name, x.value]));
    if (t.params.some((n) => !Number.isFinite(v[n]))) return { correct: false, feedback: `Set every parameter: ${t.params.join(", ")}.` };
    const tol = 0.03 * s.yRange;
    const misses = s.checkpoints.map((c) => ({ c, dy: t.f(v, c.x) - c.y })).filter((m) => Math.abs(m.dy) > tol);
    if (misses.length === 0) return { correct: true, feedback: "The curve threads every checkpoint." };
    const m = misses[0];
    const which = p.template === "linear" ? (Math.abs(misses.reduce((a, x) => a + x.dy, 0)) > tol * misses.length ? "the intercept b shifts the whole line; the slope m tilts it" : "the slope m tilts the line about the middle") : p.template === "exponential" ? "a sets the starting height; b sets how fast it climbs" : "a sets how wide and which way it opens; the other parameters move it";
    return { correct: false, feedback: `Your curve passes ${trimNumber(Math.abs(m.dy))} ${m.dy > 0 ? "above" : "below"} the checkpoint at x = ${trimNumber(m.c.x)}. Remember: ${which}.` };
  },
  solutionInput: (p, s) => ({ values: TEMPLATES[p.template].params.map((name) => ({ name, value: s.values[name] })) }),
});
