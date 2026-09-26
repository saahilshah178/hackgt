import { z } from "zod";
import { defineMode } from "../../types";
import { asPiMultiple, evalExact, formatNumber, looksApproximated, prettyExpr, trimNumber } from "../../util";

/*
 * tuner · oscillator: y = A·wave(b·t + c) + d. The model writes wave, A, b, c, d as exact expressions plus
 * `ask` (period | frequency | amplitude | phase | midline). Code computes the asked quantity; the player
 * dials it in. Cards lock `ask` (phase_gate -> period, pulse_matcher -> frequency, ...).
 */

export const ASKS = ["period", "frequency", "amplitude", "phase", "midline"] as const;
type Ask = (typeof ASKS)[number];

const Params = z.object({
  wave: z.enum(["sin", "cos"]).describe("Function that drives the mechanism"),
  amplitude: z
    .number()
    .min(0.5)
    .max(5)
    .describe("A in y = A·wave(b·t + c) + d. Sets how far it swings; it does NOT change the period"),
  b: z
    .string()
    .describe('Angular frequency b as an exact mathjs expression, e.g. "2" or "pi/2". Never a rounded decimal'),
  c: z.string().describe('Phase term c inside the wave as an exact expression, e.g. "0" or "pi/4". Use "0" unless asking for phase'),
  d: z.number().min(-5).max(5).describe("Vertical shift d (the midline). Use 0 unless asking for midline"),
  ask: z.enum(ASKS).describe("Which quantity the player must dial in"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  b: number;
  c: number;
  period: number;
  frequency: number;
  amplitude: number;
  /** horizontal shift of the graph: −c/b (positive = to the right) */
  phaseShift: number;
  midline: number;
  ask: Ask;
  answer: number;
  answerLabel: string;
}
interface Input {
  value: number;
}
interface View {
  equation: string;
  ask: Ask;
  askLabel: string;
  wave: "sin" | "cos";
  amplitude: number;
  b: number;
  c: number;
  d: number;
  dial: { min: number; max: number; step: number; ticks: { value: number; label: string }[]; unit: string };
}

const TOLERANCE = 0.03; // 3% of the dial range (LIBRARY F1)
const ASK_LABEL: Record<Ask, string> = {
  period: "period",
  frequency: "frequency",
  amplitude: "amplitude",
  phase: "phase shift",
  midline: "midline",
};

function nums(p: Params) {
  const b = evalExact(p.b);
  const c = evalExact(p.c);
  return { b, c };
}

function solve(p: Params): Solution {
  const { b, c } = nums(p);
  if (b === null || b === 0) throw new Error(`tuner.oscillator: b "${p.b}" is not a nonzero number`);
  if (c === null) throw new Error(`tuner.oscillator: c "${p.c}" is not a number`);
  const period = (2 * Math.PI) / Math.abs(b);
  const frequency = 1 / period;
  const phaseShift = c === 0 ? 0 : -c / b; // avoid -0, which JSON drops but toEqual sees
  const midline = p.d;
  const amplitude = p.amplitude;
  const answer = { period, frequency, amplitude, phase: phaseShift, midline }[p.ask];
  const answerLabel = p.ask === "frequency" || p.ask === "amplitude" || p.ask === "midline" ? trimNumber(answer) : formatNumber(answer);
  return { b, c, period, frequency, amplitude, phaseShift, midline, ask: p.ask, answer, answerLabel };
}

function equation(p: Params): string {
  const amp = p.amplitude === 1 ? "" : trimNumber(p.amplitude);
  const bText = /^\d+$/.test(p.b.trim()) ? p.b.trim() : `(${prettyExpr(p.b)})`;
  const c = evalExact(p.c) ?? 0;
  const cText = c === 0 ? "" : c > 0 ? ` + ${prettyExpr(p.c)}` : ` − ${prettyExpr(p.c).replace(/^-/, "")}`;
  const dText = p.d === 0 ? "" : p.d > 0 ? ` + ${trimNumber(p.d)}` : ` − ${trimNumber(-p.d)}`;
  return `y = ${amp}${p.wave}(${bText}t${cText})${dText}`;
}

function dialFor(p: Params, s: Solution): View["dial"] {
  const ticks = (min: number, max: number, unit: number, pi: boolean) => {
    const out: View["dial"]["ticks"] = [];
    for (let v = min; v <= max + 1e-9; v += unit) out.push({ value: Math.round(v * 1e9) / 1e9, label: pi ? formatNumber(v) : trimNumber(v) });
    return out;
  };
  switch (p.ask) {
    case "period": {
      const piMode = asPiMultiple(s.period) !== null;
      const unit = piMode ? Math.PI / 4 : 1;
      const max = Math.max(piMode ? 2 * Math.PI : 4, Math.ceil((2 * s.period) / unit) * unit);
      return { min: 0, max, step: piMode ? Math.PI / 12 : 0.05, ticks: ticks(0, max, unit, piMode), unit: "" };
    }
    case "frequency": {
      const max = Math.max(1, Math.ceil(s.frequency * 2 * 4) / 4);
      return { min: 0, max, step: 0.01, ticks: ticks(0, max, 0.25, false), unit: "cycles/unit" };
    }
    case "amplitude":
      return { min: 0, max: 6, step: 0.1, ticks: ticks(0, 6, 1, false), unit: "" };
    case "phase": {
      const span = Math.abs(s.phaseShift) <= Math.PI ? Math.PI : 2 * Math.PI;
      return { min: -span, max: span, step: Math.PI / 24, ticks: ticks(-span, span, Math.PI / 2, true), unit: "" };
    }
    case "midline":
      return { min: -6, max: 6, step: 0.1, ticks: ticks(-6, 6, 2, false), unit: "" };
  }
}

const DIRECTION: Record<Ask, [string, string]> = {
  period: ["too long: the rings drift behind", "too short: the rings race ahead"],
  frequency: ["too fast: it pulses ahead of the beacon", "too slow: it lags the beacon"],
  amplitude: ["too high: the swing overshoots", "too low: the swing falls short"],
  phase: ["too far right: the peaks trail", "too far left: the peaks lead"],
  midline: ["too high: the whole wave floats above", "too low: the whole wave sinks below"],
};

export const oscillator = defineMode({
  id: "oscillator",
  name: "Oscillator tuner",
  implemented: true,
  blindSolvable: false,
  widget: "dial",
  knowledgeTypes: ["quantitative"],
  directorBlurb:
    "A mechanism moves on y = A·sin(b·t + c) + d or cos; the player dials in its period, frequency, amplitude, phase, or midline so it locks. Periodic functions, trig, waves, orbits.",
  authoringGuide: [
    "Choose b so the period 2π/|b| is a clean value (π/2, π, 2π, 4, 4π...). Write b and c exactly, e.g. \"pi/2\".",
    "Never write the asked quantity as a number anywhere. Use the placeholders {{equation}}, {{b}}, {{c}}, {{period}}, {{frequency}}, {{amplitude}}, {{phase}}, {{midline}}.",
    "The placeholder for the asked quantity (and {{answer}}) is the answer: it may appear only in the last hint and the debrief line.",
    "Hint ladder: 1) what the quantity means, 2) the formula that gives it, 3) plug in this equation's values.",
    "For a boss, use an amplitude other than 1 and a non-integer b so the player must separate 'how far' from 'how fast'.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (looksApproximated(p.b)) problems.push(`b "${p.b}" looks like a rounded decimal; write it exactly, e.g. "pi/2"`);
    if (looksApproximated(p.c)) problems.push(`c "${p.c}" looks like a rounded decimal; write it exactly, e.g. "pi/4"`);
    const { b, c } = nums(p);
    if (b === null || b === 0) {
      problems.push(`b "${p.b}" must evaluate to a nonzero number`);
      return problems;
    }
    if (c === null) {
      problems.push(`c "${p.c}" must evaluate to a number`);
      return problems;
    }
    const period = (2 * Math.PI) / Math.abs(b);
    if (period < 0.5 || period > 8 * Math.PI) {
      problems.push(`period 2π/|b| = ${trimNumber(period)} is outside the dial range [0.5, 8π]; pick another b`);
    }
    if (p.ask === "phase" && c === 0) problems.push("ask is phase but c is 0: the answer would be trivial; use a nonzero c");
    if (p.ask === "midline" && p.d === 0) problems.push("ask is midline but d is 0: the answer would be trivial; use a nonzero d");
    if (p.ask === "phase" && Math.abs(-c / b) > 2 * Math.PI) problems.push("the phase shift −c/b must stay within [−2π, 2π]");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return {
      equation: equation(p),
      b: prettyExpr(p.b),
      c: prettyExpr(p.c),
      period: formatNumber(s.period),
      frequency: trimNumber(s.frequency),
      amplitude: trimNumber(s.amplitude),
      phase: formatNumber(s.phaseShift),
      midline: trimNumber(s.midline),
      answer: s.answerLabel,
    };
  },
  answerVars: (p) => [p.ask, "answer"],
  present(p): View {
    const s = solve(p);
    return {
      equation: equation(p),
      ask: p.ask,
      askLabel: ASK_LABEL[p.ask],
      wave: p.wave,
      amplitude: p.amplitude,
      b: s.b,
      c: s.c,
      d: p.d,
      dial: dialFor(p, s),
    };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const dial = dialFor(p, s);
    const tol = TOLERANCE * (dial.max - dial.min);
    if (Math.abs(input.value - s.answer) <= tol) {
      return { correct: true, feedback: `The ${ASK_LABEL[p.ask]} matches; the mechanism locks into place.` };
    }
    const [high, low] = DIRECTION[p.ask];
    const direction = input.value > s.answer ? high : low;
    const shown = p.ask === "frequency" || p.ask === "amplitude" || p.ask === "midline" ? trimNumber(input.value) : formatNumber(input.value);
    const method = {
      period: `One full cycle of ${p.wave}(b·t) takes 2π/|b|.`,
      frequency: "Frequency is cycles per unit time: 1 / period, and the period is 2π/|b|.",
      amplitude: "Amplitude is |A|, the distance from the midline to a peak, not peak to trough.",
      phase: "Write the inside as b(t − h): the shift h is −c/b.",
      midline: "The midline is d, the value the wave oscillates around.",
    }[p.ask];
    return { correct: false, feedback: `A ${ASK_LABEL[p.ask]} of ${shown} is ${direction}. ${method}` };
  },
  solutionInput: (_p, s) => ({ value: s.answer }),
});
