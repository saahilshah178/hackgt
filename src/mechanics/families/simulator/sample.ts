import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, shuffleNotIdentity, trimNumber } from "../../util";
import { checkSimulationSpec, simulate, SimulationSpec, type SimulationSpecT } from "./engine";

/*
 * simulator · sample: repeated stochastic trials of a system that uses rand(). `resolve` runs `trials`
 * simulations (seeds 1..trials) and reduces the final values of `watch` to one statistic. The writer maps
 * options to numeric ranges of that statistic (`ranges`); `check` requires the statistic to be stable
 * (splitting the trials in half shouldn't move it much) and requires exactly one range to contain it,
 * matching the option marked correct. Cards: repeat_experiment, prediction_stabilizer, long_run_casino,
 * population_collector, capture_the_parameter, odds_forge, meiosis_shuffle, drift_sim, diversification_sim.
 */

const Option = z.object({
  text: z.string().describe("One possible statistic value or range, under 140 characters"),
  isCorrect: z.boolean(),
  explanation: z.string().describe("Why this is right or wrong, under 200 characters; shown after the pick"),
});

const Statistic = z.enum(["mean", "proportion_above", "spread"]);

const Range = z.object({
  optionIndex: z.number().int().min(0).max(3).describe("Which options[] entry this range corresponds to"),
  low: z.string().nullable().describe("Exact mathjs expression: lower edge of this range, or null for no lower edge"),
  high: z.string().nullable().describe("Exact mathjs expression: upper edge of this range, or null for no upper edge"),
});

const Params = z.object({
  system: SimulationSpec,
  watch: z.string().describe("The variable name (in system.variables) sampled at the end of each trial"),
  trials: z.number().int().min(10).max(2000).describe("Number of independent trials to run"),
  statistic: Statistic.describe("How the trials' final watch values reduce to one number"),
  threshold: z.string().describe("Exact mathjs expression; only used when statistic is proportion_above"),
  question: z.string().describe("The question shown with the options, under 160 characters"),
  options: z.array(Option).min(2).max(4).describe("2-4 options; EXACTLY ONE has isCorrect: true"),
  ranges: z
    .array(Range)
    .min(2)
    .max(4)
    .describe("One range per option (matched by optionIndex), partitioning where the computed statistic can land"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  value: number;
  correctIndex: number;
}
interface Input {
  optionIndex: number;
}
interface View {
  watch: string;
  trials: number;
  statistic: z.infer<typeof Statistic>;
  question: string;
  variables: string[];
  initial: Record<string, number>;
  options: { optionIndex: number; text: string }[];
}

function finalValues(p: Params, trials: number, offset = 0): number[] {
  const out: number[] = [];
  for (let i = 0; i < trials; i++) {
    const { trajectory } = simulate(p.system, offset + i + 1);
    const series = trajectory[p.watch];
    out.push(series[series.length - 1]);
  }
  return out;
}

function reduce(p: Params, values: number[]): number {
  switch (p.statistic) {
    case "mean":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "proportion_above": {
      const threshold = evalExact(p.threshold) ?? 0;
      return values.filter((v) => v > threshold).length / values.length;
    }
    case "spread":
      return Math.max(...values) - Math.min(...values);
  }
}

function rangeContains(r: z.infer<typeof Range>, value: number): boolean {
  const lo = r.low === null ? null : evalExact(r.low);
  const hi = r.high === null ? null : evalExact(r.high);
  if (lo !== null && value < lo - 1e-9) return false;
  if (hi !== null && value > hi + 1e-9) return false;
  return true;
}

function solve(p: Params): Solution {
  const values = finalValues(p, p.trials);
  const value = reduce(p, values);
  const containing = p.ranges.filter((r) => rangeContains(r, value));
  const correctIndex = containing.length === 1 ? containing[0].optionIndex : -1;
  return { value, correctIndex };
}

function statisticLabel(p: Params, value: number): string {
  switch (p.statistic) {
    case "mean":
      return `a mean of ${trimNumber(value)}`;
    case "proportion_above":
      return `${trimNumber(value * 100)}% of trials above the threshold`;
    case "spread":
      return `a spread of ${trimNumber(value)}`;
  }
}

export const sample = defineMode({
  id: "sample",
  name: "Sample",
  implemented: true,
  blindSolvable: false,
  widget: "pick",
  knowledgeTypes: ["quantitative", "causal"],
  directorBlurb:
    "The player reasons about many stochastic trials of a system before code runs them all: variability, law of large numbers, expected value, sampling bias, genetic drift.",
  authoringGuide: [
    "Write a system whose rules use rand(); pick trials large enough (check requires the statistic to be stable across two halves of the runs).",
    "Pick statistic: mean, proportion_above (needs threshold), or spread (max - min) of watch's final value across trials.",
    "Write 2-4 options and a matching ranges[] entry per option (by optionIndex) with exact low/high bounds (null = unbounded on that side); exactly one range must contain the computed statistic.",
    "Mark isCorrect: true on the option whose range will contain the computed value; never write the computed value itself.",
    "{{correct}} (the correct option's text) is the answer: use it only in the last hint and the debrief line.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems = [...checkSimulationSpec(p.system)];
    const names = p.system.variables.map((v) => v.name);
    if (!names.includes(p.watch)) problems.push(`watch "${p.watch}" is not one of system.variables[].name`);
    const correctCount = p.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) problems.push(`exactly one option must be isCorrect: true (found ${correctCount})`);
    const texts = p.options.map((o) => o.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) problems.push("options must be distinct");
    if (p.ranges.length !== p.options.length) problems.push(`ranges must have exactly one entry per option (${p.options.length} options, ${p.ranges.length} ranges)`);
    const idxs = p.ranges.map((r) => r.optionIndex);
    if (new Set(idxs).size !== idxs.length) problems.push("ranges[].optionIndex must be unique");
    idxs.forEach((i) => {
      if (i < 0 || i >= p.options.length) problems.push(`ranges references optionIndex ${i}, which is out of range`);
    });
    for (const r of p.ranges) {
      for (const [key, val] of [
        ["low", r.low],
        ["high", r.high],
      ] as const) {
        if (val === null) continue;
        if (looksApproximated(val)) problems.push(`ranges[optionIndex=${r.optionIndex}].${key} "${val}" looks like a rounded decimal; write it exactly`);
        if (evalExact(val) === null) problems.push(`ranges[optionIndex=${r.optionIndex}].${key} "${val}" does not evaluate to a number`);
      }
      if (r.low !== null && r.high !== null && !(evalExact(r.low)! < evalExact(r.high)!)) {
        problems.push(`ranges[optionIndex=${r.optionIndex}]: low must be less than high`);
      }
    }
    if (p.statistic === "proportion_above") {
      if (looksApproximated(p.threshold)) problems.push(`threshold "${p.threshold}" looks like a rounded decimal; write it exactly`);
      if (evalExact(p.threshold) === null) problems.push(`threshold "${p.threshold}" does not evaluate to a number`);
    }
    if (problems.length > 0) return problems;

    const half = Math.max(1, Math.floor(p.trials / 2));
    const firstHalf = reduce(p, finalValues(p, half, 0));
    const secondHalf = reduce(p, finalValues(p, p.trials - half, half));
    const scale = Math.max(Math.abs(firstHalf), Math.abs(secondHalf), 1e-9);
    if (Math.abs(firstHalf - secondHalf) > 0.1 * scale) {
      problems.push(`the ${p.statistic} isn't stable across trials (${trimNumber(firstHalf)} vs ${trimNumber(secondHalf)} on two halves); raise trials or tighten the system`);
      return problems;
    }

    const s = solve(p);
    const containing = p.ranges.filter((r) => rangeContains(r, s.value));
    if (containing.length !== 1) {
      problems.push(`the computed ${p.statistic} (${trimNumber(s.value)}) falls in ${containing.length} of the ranges; ranges must partition the outcome so exactly one contains it`);
      return problems;
    }
    const correctOption = p.options.findIndex((o) => o.isCorrect);
    if (containing[0].optionIndex !== correctOption) {
      problems.push(`the computed ${p.statistic} (${trimNumber(s.value)}) falls in the range for option ${containing[0].optionIndex}, but isCorrect: true is on option ${correctOption}`);
    }
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { correct: p.options[s.correctIndex]?.text ?? "", statistic: statisticLabel(p, s.value), trials: String(p.trials) };
  },
  answerVars: ["correct", "statistic"],
  present(p, seed): View {
    const { trajectory } = simulate(p.system, 0);
    const initial: Record<string, number> = {};
    for (const v of p.system.variables) initial[v.name] = trajectory[v.name][0];
    const options = p.options.map((o, optionIndex) => ({ optionIndex, text: o.text }));
    return {
      watch: p.watch,
      trials: p.trials,
      statistic: p.statistic,
      question: p.question,
      variables: p.system.variables.map((v) => v.name),
      initial,
      options: shuffleNotIdentity(options, seed),
    };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if (input.optionIndex === s.correctIndex) {
      return { correct: true, feedback: `Across ${p.trials} trials, ${statisticLabel(p, s.value)}. ${p.options[s.correctIndex].explanation}` };
    }
    const picked = p.options[input.optionIndex];
    if (!picked) return { correct: false, feedback: "Pick one of the options." };
    // Informative failure (H2-style): explain why the PICKED option is wrong without stating the
    // computed statistic or the correct option's explanation, which would hand over the answer.
    return {
      correct: false,
      feedback: `${picked.explanation} Run the ${p.trials} trials again and compare against this option's range.`.trim(),
    };
  },
  solutionInput: (_p, s) => ({ optionIndex: s.correctIndex }),
});
