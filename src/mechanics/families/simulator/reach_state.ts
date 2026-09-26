import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, trimNumber } from "../../util";
import { checkSimulationSpec, simulate, SimulationSpec, type SimulationSpecT } from "./engine";

/* simulator · reach_state: set an initial parameter so the state hits a target at tick T. Cards: replication_chamber, inheritance_machine, orbit_slingshot, energy_barrier, money_multiplier, marketing_funnel. */

const Params = z.object({
  system: SimulationSpec,
  control: z.object({ variable: z.string().describe("the variable whose INITIAL value the player sets"), min: z.string(), max: z.string(), step: z.string() }),
  target: z.object({ variable: z.string(), value: z.string().describe("exact target value at tick T"), tolerance: z.string().describe("exact absolute tolerance") }),
  atTick: z.number().int().min(1).max(200),
});
type Params = z.infer<typeof Params>;
interface Solution { value: number; reached: number }
interface Input { value: number }
interface View { variables: string[]; initial: Record<string, number>; control: { variable: string; min: number; max: number; step: number }; target: { variable: string; value: number; tolerance: number }; atTick: number; ticks: number }

function withInitial(spec: SimulationSpecT, variable: string, value: number): SimulationSpecT {
  return { ...spec, variables: spec.variables.map((v) => (v.name === variable ? { ...v, initial: String(value) } : v)) };
}

function outcome(p: Params, value: number): number {
  const { trajectory } = simulate(withInitial(p.system, p.control.variable, value), 0);
  const series = trajectory[p.target.variable] ?? [];
  return series[Math.min(p.atTick, series.length - 1)] ?? Number.NaN;
}

function solve(p: Params): Solution {
  const min = evalExact(p.control.min)!; const max = evalExact(p.control.max)!; const step = evalExact(p.control.step)!;
  const target = evalExact(p.target.value)!;
  let best = min; let bestErr = Infinity;
  for (let v = min; v <= max + 1e-9; v += step) {
    const err = Math.abs(outcome(p, v) - target);
    if (err < bestErr) { bestErr = err; best = v; }
  }
  return { value: Math.round(best * 1e9) / 1e9, reached: outcome(p, best) };
}

export const reachState = defineMode({
  id: "reach_state",
  name: "Reach state",
  implemented: true,
  blindSolvable: false,
  widget: "dial",
  knowledgeTypes: ["system", "quantitative"],
  directorBlurb: "Set a starting parameter or rate so the simulated system hits a target at tick T. Exponential growth, recursive sequences, reserve ratios, activation energy.",
  authoringGuide: ["Define the system with the control variable among its variables; the player sets that variable's initial value. Choose the target so exactly one dial position (to within tolerance) reaches it.", "Placeholders: {{targetVariable}}, {{atTick}} (safe), {{control}} (the answer: last hint and debrief only)."].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems = checkSimulationSpec(p.system);
    for (const v of [p.control.min, p.control.max, p.control.step, p.target.value, p.target.tolerance]) if (looksApproximated(v)) problems.push(`"${v}" looks like a rounded decimal`);
    const names = p.system.variables.map((v) => v.name);
    if (!names.includes(p.control.variable)) problems.push(`control.variable "${p.control.variable}" is not a system variable`);
    if (!names.includes(p.target.variable)) problems.push(`target.variable "${p.target.variable}" is not a system variable`);
    if (p.atTick > p.system.ticks) problems.push("atTick must not exceed system.ticks");
    const min = evalExact(p.control.min); const max = evalExact(p.control.max); const step = evalExact(p.control.step); const target = evalExact(p.target.value); const tol = evalExact(p.target.tolerance);
    if ([min, max, step, target, tol].some((v) => v === null) || !(min! < max!) || step! <= 0 || tol! <= 0) problems.push("control min < max, step > 0, target and tolerance > 0 must be exact numbers");
    if (problems.length) return problems;
    const s = solve(p);
    if (Math.abs(s.reached - target!) > tol!) problems.push(`no dial position reaches ${trimNumber(target!)} ± ${trimNumber(tol!)} at tick ${p.atTick} (closest: ${trimNumber(s.reached)}); adjust the target or the range`);
    let hits = 0;
    for (let v = min!; v <= max! + 1e-9; v += step!) if (Math.abs(outcome(p, v) - target!) <= tol!) hits++;
    if (hits > 3) problems.push(`${hits} dial positions all hit the target; tighten the tolerance so the answer is meaningful`);
    return problems;
  },
  resolve: solve,
  templateVars(p, s) { return { targetVariable: p.target.variable, atTick: String(p.atTick), control: trimNumber(s.value) }; },
  answerVars: ["control"],
  present(p): View {
    const initial = Object.fromEntries(p.system.variables.map((v) => [v.name, evalExact(v.initial) ?? 0]));
    return {
      variables: p.system.variables.map((v) => v.name),
      initial,
      control: { variable: p.control.variable, min: evalExact(p.control.min)!, max: evalExact(p.control.max)!, step: evalExact(p.control.step)! },
      target: { variable: p.target.variable, value: evalExact(p.target.value)!, tolerance: evalExact(p.target.tolerance)! },
      atTick: p.atTick,
      ticks: p.system.ticks,
    };
  },
  grade(p, input: Input) {
    const target = evalExact(p.target.value)!; const tol = evalExact(p.target.tolerance)!;
    const reached = outcome(p, input.value);
    if (Number.isFinite(reached) && Math.abs(reached - target) <= tol) return { correct: true, feedback: `At tick ${p.atTick} the ${p.target.variable} reads ${trimNumber(reached)}: on target.` };
    return { correct: false, feedback: `With ${p.control.variable} = ${trimNumber(input.value)}, ${p.target.variable} reaches ${trimNumber(reached)} at tick ${p.atTick}, ${reached > target ? "above" : "below"} the target ${trimNumber(target)}. Watch how a small change early compounds over the run.` };
  },
  solutionInput: (_p, s) => ({ value: s.value }),
});
