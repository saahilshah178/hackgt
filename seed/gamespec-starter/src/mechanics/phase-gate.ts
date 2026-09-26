import { z } from "zod";
import { defineMechanic } from "./types";
import { asPiMultiple, evalExact, formatNumber, looksApproximated, prettyExpr, trimNumber } from "./util";

const Params = z.object({
  wave: z.enum(["sin", "cos"]).describe("Function that drives the mechanism"),
  amplitude: z
    .number()
    .min(0.5)
    .max(5)
    .describe("A in y = A·wave(b·t). Sets how far it swings; it does NOT change the period"),
  b: z
    .string()
    .describe('Angular frequency b as an exact mathjs expression, e.g. "2" or "pi/2". Never a rounded decimal'),
});
type Params = z.infer<typeof Params>;

interface Solution {
  b: number;
  period: number;
  periodLabel: string;
}
interface Input {
  period: number;
}
interface View {
  equation: string;
  dial: { min: number; max: number; step: number; ticks: { value: number; label: string }[] };
}

const TOLERANCE = 0.03; // 3% of the true period

function solve(p: Params): Solution {
  const b = evalExact(p.b);
  if (b === null || b === 0) throw new Error(`phase_gate: b "${p.b}" is not a nonzero number`);
  const period = (2 * Math.PI) / Math.abs(b);
  return { b, period, periodLabel: formatNumber(period) };
}

function equation(p: Params): string {
  const amp = p.amplitude === 1 ? "" : trimNumber(p.amplitude);
  const bText = /^\d+$/.test(p.b.trim()) ? p.b.trim() : `(${prettyExpr(p.b)})`;
  return `y = ${amp}${p.wave}(${bText}t)`;
}

export const phaseGate = defineMechanic({
  id: "phase_gate",
  name: "Phase Gate",
  widget: "dial",
  knowledgeTypes: ["quantitative"],
  implemented: true,
  directorBlurb:
    "A mechanism moves on y = A·sin(b·t) or cos; the player dials in its period so it locks. Periodic functions, trig, waves, orbits.",
  authoringGuide: [
    "Choose b so the period 2π/|b| is a clean value (π/2, π, 2π, 4, 4π...). Write b exactly, e.g. \"pi/2\".",
    "Never write the period as a number anywhere. Use the placeholders {{equation}}, {{b}}, {{period}}.",
    "{{period}} is the answer: it may appear only in the last hint and the debrief line.",
    "Hint ladder: 1) what a period is, 2) period = 2π/|b|, 3) plug in this b.",
    "For a boss, use an amplitude other than 1 so the player must ignore it when finding the period.",
  ].join("\n"),
  genres: {
    dungeon: { sockets: ["door", "boss"], skin: "Vault door of concentric rings spinning on the function" },
    platformer: { sockets: ["gate", "moving_platform", "boss"], skin: "Saw-wheel gap that only faces you when the period matches" },
    mystery: { sockets: ["evidence"], skin: "Set the lighthouse beam's sweep period to signal the right ship" },
    puzzle: { sockets: ["tile_puzzle", "boss"], skin: "Tiles rotate on a cycle; align them on the right turn" },
  },
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (looksApproximated(p.b)) problems.push(`b "${p.b}" looks like a rounded decimal; write it exactly, e.g. "pi/2"`);
    const b = evalExact(p.b);
    if (b === null || b === 0) {
      problems.push(`b "${p.b}" must evaluate to a nonzero number`);
      return problems;
    }
    const period = (2 * Math.PI) / Math.abs(b);
    if (period < 0.5 || period > 8 * Math.PI) {
      problems.push(`period 2π/|b| = ${trimNumber(period)} is outside the dial range [0.5, 8π]; pick another b`);
    }
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { equation: equation(p), b: prettyExpr(p.b), period: s.periodLabel };
  },
  answerVars: ["period"],
  present(p): View {
    const s = solve(p);
    const piMode = asPiMultiple(s.period) !== null;
    const unit = piMode ? Math.PI / 4 : 1;
    const max = Math.max(piMode ? 2 * Math.PI : 4, Math.ceil((2 * s.period) / unit) * unit);
    const ticks: View["dial"]["ticks"] = [];
    for (let v = 0; v <= max + 1e-9; v += unit) ticks.push({ value: v, label: formatNumber(v) });
    return { equation: equation(p), dial: { min: 0, max, step: piMode ? Math.PI / 12 : 0.05, ticks } };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if (Math.abs(input.period - s.period) <= TOLERANCE * s.period) {
      return { correct: true, feedback: "The rings lock into place." };
    }
    const direction = input.period > s.period ? "too long: the rings drift behind" : "too short: the rings race ahead";
    return {
      correct: false,
      feedback: `A period of ${formatNumber(input.period)} is ${direction}. One full cycle of ${p.wave}(b·t) takes 2π/|b|.`,
    };
  },
  solutionInput: (_p, s) => ({ period: s.period }),
});
