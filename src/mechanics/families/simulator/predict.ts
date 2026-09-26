import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, shuffleNotIdentity, trimNumber } from "../../util";
import { checkSimulationSpec, simulate, SimulationSpec, type SimulationSpecT } from "./engine";

/*
 * simulator · predict: the player predicts the direction a system will move (or where it will end up
 * relative to a threshold) BEFORE watching it run. The simulation (seed 0) is the ground truth: `check`
 * rejects a card whose stated `comparison` doesn't match what the system actually does, and rejects
 * stochastic systems whose outcome direction isn't stable across a handful of seeds. Cards: particle_spread,
 * membrane_balance, survival_sim, vaccine_memory, dynamic_reaction_arena, heat_flow_rooms,
 * living_marketplace, population_pyramid, reinforcement_schedule, antibiotic_resistance, hidden_spillover,
 * dock_blocker.
 */

const Option = z.object({
  text: z.string().describe("One possible outcome, under 140 characters"),
  isCorrect: z.boolean(),
  explanation: z.string().describe("Why this outcome is right or wrong, under 200 characters; shown after the pick"),
});

const Comparison = z.enum(["increases", "decreases", "stays", "ends_above", "ends_below"]);

const Params = z.object({
  system: SimulationSpec,
  scenario: z.string().describe("What is about to happen, under 200 characters"),
  watch: z.string().describe("The variable name (in system.variables) whose fate the player predicts"),
  question: z.string().describe("The question shown with the options, under 160 characters"),
  options: z.array(Option).min(2).max(4).describe("2-4 outcome options; EXACTLY ONE has isCorrect: true"),
  comparison: Comparison.describe(
    "How `watch` actually moves by the end of the run: increases/decreases/stays (vs its initial value, 2% band) or ends_above/ends_below (vs threshold)",
  ),
  threshold: z.string().describe("Exact mathjs expression; only used when comparison is ends_above or ends_below"),
});
type Params = z.infer<typeof Params>;

type Outcome = z.infer<typeof Comparison>;

interface Solution {
  correctIndex: number;
  outcome: Outcome;
  initial: number;
  final: number;
}
interface Input {
  optionIndex: number;
}
interface View {
  scenario: string;
  question: string;
  watch: string;
  variables: string[];
  initial: Record<string, number>;
  options: { optionIndex: number; text: string }[];
}

const STAYS_BAND = 0.02;
const STABILITY_SEEDS = [0, 1, 2, 3, 4];

function watchIndex(p: Params): number {
  return p.system.variables.findIndex((v) => v.name === p.watch);
}

function computeOutcome(p: Params, seed: number): { outcome: Outcome; initial: number; final: number } {
  const { trajectory } = simulate(p.system, seed);
  const series = trajectory[p.watch];
  const initial = series[0];
  const final = series[series.length - 1];
  if (p.comparison === "ends_above" || p.comparison === "ends_below") {
    const threshold = evalExact(p.threshold) ?? 0;
    return { outcome: final > threshold ? "ends_above" : "ends_below", initial, final };
  }
  const band = STAYS_BAND * Math.max(Math.abs(initial), 1e-9);
  let outcome: Outcome;
  if (Math.abs(final - initial) <= band) outcome = "stays";
  else outcome = final > initial ? "increases" : "decreases";
  return { outcome, initial, final };
}

function solve(p: Params): Solution {
  const correctIndex = p.options.findIndex((o) => o.isCorrect);
  const { outcome, initial, final } = computeOutcome(p, 0);
  return { correctIndex, outcome, initial, final };
}

function describeOutcome(p: Params, outcome: Outcome): string {
  switch (outcome) {
    case "increases":
      return `${p.watch} actually increases`;
    case "decreases":
      return `${p.watch} actually decreases`;
    case "stays":
      return `${p.watch} actually stays about the same`;
    case "ends_above":
      return `${p.watch} actually ends above the threshold`;
    case "ends_below":
      return `${p.watch} actually ends below the threshold`;
  }
}

export const predict = defineMode({
  id: "predict",
  name: "Predict",
  implemented: true,
  blindSolvable: true,
  widget: "pick",
  knowledgeTypes: ["causal", "system"],
  directorBlurb:
    "The player predicts the direction (or threshold outcome) a live system will move before watching it run; the simulation is the ground truth. Diffusion, osmosis, equilibrium, markets, populations, immunity.",
  authoringGuide: [
    "Write system.variables (1-6, exact initial values) and system.rules (1-4, mathjs over variable names, t, and rand()); set system.ticks.",
    "Set comparison to what `watch` actually does by the end of the run: increases/decreases/stays (vs its start) or ends_above/ends_below (vs threshold).",
    "Write 2-4 options with EXACTLY ONE isCorrect: true, describing plausible predictions; the simulation, not your judgment, is checked against comparison.",
    "If a rule uses rand(), keep the outcome robust: the same comparison must hold whether the run is lucky or unlucky.",
    "{{correct}} (the correct option's text) is the answer: use it only in the last hint and the debrief line.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems = [...checkSimulationSpec(p.system)];
    if (watchIndex(p) === -1) problems.push(`watch "${p.watch}" is not one of system.variables[].name`);
    const correctCount = p.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) problems.push(`exactly one option must be isCorrect: true (found ${correctCount})`);
    const texts = p.options.map((o) => o.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) problems.push("options must be distinct");
    if (p.comparison === "ends_above" || p.comparison === "ends_below") {
      if (looksApproximated(p.threshold)) problems.push(`threshold "${p.threshold}" looks like a rounded decimal; write it exactly`);
      if (evalExact(p.threshold) === null) problems.push(`threshold "${p.threshold}" does not evaluate to a number`);
    }
    if (problems.length > 0) return problems;

    const outcomes = STABILITY_SEEDS.map((seed) => computeOutcome(p, seed).outcome);
    if (new Set(outcomes).size !== 1) {
      problems.push(`the outcome for "${p.watch}" is not stable across seeds (saw ${[...new Set(outcomes)].join(", ")}); tighten the system or remove rand()`);
      return problems;
    }
    const actual = outcomes[0];
    if (actual !== p.comparison) {
      problems.push(`comparison says "${p.comparison}" but the simulation actually shows ${describeOutcome(p, actual)}; fix comparison or the system`);
    }
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { correct: p.options[s.correctIndex]?.text ?? "", watch: p.watch, outcome: describeOutcome(p, s.outcome) };
  },
  answerVars: ["correct", "outcome"],
  present(p, seed): View {
    const { trajectory } = simulate(p.system, 0);
    const initial: Record<string, number> = {};
    for (const v of p.system.variables) initial[v.name] = trajectory[v.name][0];
    const options = p.options.map((o, optionIndex) => ({ optionIndex, text: o.text }));
    return {
      scenario: p.scenario,
      question: p.question,
      watch: p.watch,
      variables: p.system.variables.map((v) => v.name),
      initial,
      options: shuffleNotIdentity(options, seed),
    };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if (input.optionIndex === s.correctIndex) {
      return { correct: true, feedback: `${describeOutcome(p, s.outcome)}: ${p.options[s.correctIndex].explanation}` };
    }
    const correct = p.options[s.correctIndex];
    return {
      correct: false,
      feedback: `Watch it run again: ${describeOutcome(p, s.outcome)} (from ${trimNumber(s.initial)} to ${trimNumber(s.final)}). ${correct?.explanation ?? ""}`.trim(),
    };
  },
  solutionInput: (_p, s) => ({ optionIndex: s.correctIndex }),
  blind: {
    schema: z.object({
      option: z.number().int().min(0).max(3).describe("Position (0-based) of the predicted outcome in the list shown"),
      why: z.string().describe("One sentence"),
    }),
    describe: (p, view: View) =>
      `${p.scenario}\n${p.question}\nWatching: ${view.watch}, starting at ${trimNumber(view.initial[view.watch] ?? 0)}\nOptions:\n${view.options
        .map((o, i) => `${i}. ${o.text}`)
        .join("\n")}`,
    toInput: (_p, view: View, out) => {
      const o = out as { option: number };
      return { optionIndex: view.options[o.option]?.optionIndex ?? -1 };
    },
  },
});

export type { SimulationSpecT };
