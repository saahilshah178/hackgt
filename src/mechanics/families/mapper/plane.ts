import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, prettyExpr, trimNumber } from "../../util";

/*
 * mapper · plane: place a point on a 2-D coordinate plane. Cards: intersection_hunt, allowed_region,
 * coordinate_treasure, circular_navigator, vector_winds, component_split, charge_navigator,
 * phase_diagram_pin, earthquake_triangulation, moon_phase_orbit, lat_long_navigator, vanishing_point.
 * No geometry data (lines, circles, regions) is drawn tonight: `overlay` is just a caption.
 */

const Params = z.object({
  xMin: z.string().describe('Left edge of the plane, exact, e.g. "-10"'),
  xMax: z.string().describe('Right edge, exact, e.g. "10"'),
  yMin: z.string().describe('Bottom edge, exact, e.g. "-10"'),
  yMax: z.string().describe('Top edge, exact, e.g. "10"'),
  gridStep: z.string().describe('Spacing between grid lines on both axes, exact, e.g. "1" or "pi/2"'),
  labels: z.enum(["decimal", "pi"]).describe("Axis label style: decimal numbers, or multiples of π"),
  targetX: z.string().describe("The target point's x-coordinate, exact"),
  targetY: z.string().describe("The target point's y-coordinate, exact"),
  xLabel: z.string().describe("Label for the x-axis, e.g. 'x' or 'time (s)'"),
  yLabel: z.string().describe("Label for the y-axis, e.g. 'y' or 'height (m)'"),
  overlay: z
    .string()
    .describe("One line describing what the host draws on the grid (a line, a circle, two lines...); use '' for nothing extra"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  x: number;
  y: number;
  tolerance: number; // fraction of each axis's range, 0.03
  label: string; // "(x, y)"
}
interface Input {
  x: number;
  y: number;
}
interface View {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  gridStep: number;
  xLabel: string;
  yLabel: string;
  labels: "decimal" | "pi";
  overlay: string;
  target: string;
}

const TOLERANCE = 0.03;

function nums(p: Params) {
  return {
    xMin: evalExact(p.xMin),
    xMax: evalExact(p.xMax),
    yMin: evalExact(p.yMin),
    yMax: evalExact(p.yMax),
    step: evalExact(p.gridStep),
    x: evalExact(p.targetX),
    y: evalExact(p.targetY),
  };
}

function fmt(p: Params, v: number): string {
  return p.labels === "pi" ? prettyExpr(String(v)) : trimNumber(v);
}

function solve(p: Params): Solution {
  const n = nums(p);
  if (n.x === null || n.y === null) throw new Error("mapper.plane: target does not evaluate to a number");
  return {
    x: n.x,
    y: n.y,
    tolerance: TOLERANCE,
    label: `(${fmt(p, n.x)}, ${fmt(p, n.y)})`,
  };
}

export const plane = defineMode({
  id: "plane",
  name: "Plane",
  implemented: true,
  blindSolvable: false,
  widget: "place",
  knowledgeTypes: ["spatial", "quantitative"],
  directorBlurb:
    "The player marks a point on a labeled coordinate plane: an intersection, a midpoint, a vector's tip, a unit-circle point. Coordinate geometry and spatial reasoning.",
  authoringGuide: [
    "Write xMin/xMax/yMin/yMax and gridStep exactly (\"pi/2\", \"-10\"); pick gridStep so there are 2-12 grid lines per axis.",
    "Write targetX and targetY exactly; the target must sit strictly inside the plane's bounds.",
    "overlay is a ONE-LINE caption of what the host draws (e.g. \"two intersecting lines\"); leave it '' if the plane is bare.",
    "Placeholders available: {{x}}, {{y}}: both are the answer, so keep them out of the prompt and first hint.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    for (const key of ["xMin", "xMax", "yMin", "yMax", "gridStep", "targetX", "targetY"] as const) {
      if (looksApproximated(p[key])) problems.push(`${key} "${p[key]}" looks like a rounded decimal; write it exactly`);
    }
    const n = nums(p);
    if (n.xMin === null || n.xMax === null || n.yMin === null || n.yMax === null || n.step === null || n.x === null || n.y === null) {
      problems.push("xMin, xMax, yMin, yMax, gridStep, targetX and targetY must all evaluate to numbers");
      return problems;
    }
    if (!(n.xMin < n.xMax)) problems.push("xMin must be less than xMax");
    if (!(n.yMin < n.yMax)) problems.push("yMin must be less than yMax");
    if (n.step <= 0) {
      problems.push("gridStep must be positive");
      return problems;
    }
    if (!(n.x > n.xMin && n.x < n.xMax)) problems.push("targetX must lie strictly inside [xMin, xMax]");
    if (!(n.y > n.yMin && n.y < n.yMax)) problems.push("targetY must lie strictly inside [yMin, yMax]");
    const xLines = (n.xMax - n.xMin) / n.step;
    const yLines = (n.yMax - n.yMin) / n.step;
    if (xLines < 2 || xLines > 12) problems.push(`gridStep gives ${trimNumber(xLines)} lines on the x-axis; aim for 2 to 12`);
    if (yLines < 2 || yLines > 12) problems.push(`gridStep gives ${trimNumber(yLines)} lines on the y-axis; aim for 2 to 12`);
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { x: fmt(p, s.x), y: fmt(p, s.y) };
  },
  answerVars: ["x", "y"],
  present(p): View {
    const n = nums(p);
    return {
      xMin: n.xMin!,
      xMax: n.xMax!,
      yMin: n.yMin!,
      yMax: n.yMax!,
      gridStep: n.step!,
      xLabel: p.xLabel,
      yLabel: p.yLabel,
      labels: p.labels,
      overlay: p.overlay,
      target: "the requested point in words",
    };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const n = nums(p);
    const xTol = TOLERANCE * (n.xMax! - n.xMin!);
    const yTol = TOLERANCE * (n.yMax! - n.yMin!);
    const xOff = input.x - s.x;
    const yOff = input.y - s.y;
    if (Math.abs(xOff) <= xTol && Math.abs(yOff) <= yTol) {
      return { correct: true, feedback: "A perfect landing." };
    }
    if (Math.abs(xOff) > xTol && Math.abs(yOff) > yTol) {
      return {
        correct: false,
        feedback: `Off on both axes: too far ${xOff > 0 ? "right" : "left"} on ${p.xLabel} and too far ${yOff > 0 ? "up" : "down"} on ${p.yLabel}.`,
      };
    }
    if (Math.abs(xOff) > xTol) {
      return { correct: false, feedback: `Off on ${p.xLabel}: move ${xOff > 0 ? "left" : "right"}.` };
    }
    return { correct: false, feedback: `Off on ${p.yLabel}: move ${yOff > 0 ? "down" : "up"}.` };
  },
  solutionInput: (_p, s) => ({ x: s.x, y: s.y }),
});
