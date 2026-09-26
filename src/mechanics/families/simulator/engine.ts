import { compile, type EvalFunction } from "mathjs";
import { z } from "zod";
import { evalExact, looksApproximated, mulberry32 } from "../../util";

/*
 * simulator engine: a deterministic discrete-time system. `variables` hold state, `rules` say how each
 * variable's next value is computed from the PREVIOUS tick's state (synchronous update), `t` (the tick
 * index of the state being read FROM) and `rand()` (uniform 0-1 from a seeded RNG) are available inside
 * rule expressions. Values clamp to [min, max] after every tick. The model writes variables/rules/ticks;
 * code runs the simulation and that run IS the answer key.
 */

export const VariableSpec = z.object({
  name: z.string().describe("snake_case state variable name, e.g. 'glucose'"),
  initial: z.string().describe("Exact mathjs expression for this variable's value at t = 0"),
  unit: z.string().describe("Unit label shown next to the value; use '' if unitless"),
  min: z.number().min(-1_000_000).max(1_000_000).nullable().describe("Clamp floor for this variable, or null for no floor"),
  max: z.number().min(-1_000_000).max(1_000_000).nullable().describe("Clamp ceiling for this variable, or null for no ceiling"),
});
export type VariableSpecT = z.infer<typeof VariableSpec>;

export const RuleSpec = z.object({
  target: z.string().describe("Must be one of variables[].name: the variable this rule updates each tick"),
  expr: z
    .string()
    .describe("mathjs expression over the variable names (read at the PREVIOUS tick), t (tick index), and rand() (uniform 0-1)"),
});
export type RuleSpecT = z.infer<typeof RuleSpec>;

export const SimulationSpec = z.object({
  variables: z.array(VariableSpec).min(1).max(6).describe("1-6 state variables"),
  rules: z.array(RuleSpec).min(1).max(6).describe("1-6 update rules, one per variable that changes; a variable with no rule stays constant"),
  ticks: z.number().int().min(2).max(200).describe("How many ticks the simulation runs"),
});
export type SimulationSpecT = z.infer<typeof SimulationSpec>;

export interface Intervention {
  variable: string;
  schedule: { tick: number; value: number }[];
}

function clampFns(spec: SimulationSpecT) {
  const mins = new Map(spec.variables.map((v) => [v.name, v.min]));
  const maxs = new Map(spec.variables.map((v) => [v.name, v.max]));
  return (name: string, v: number) => {
    let x = v;
    const lo = mins.get(name);
    const hi = maxs.get(name);
    if (lo !== null && lo !== undefined && x < lo) x = lo;
    if (hi !== null && hi !== undefined && x > hi) x = hi;
    return x;
  };
}

/** Runs the simulation. Throws with an actionable message if an initial value or a rule fails to evaluate to a finite number. */
export function simulate(spec: SimulationSpecT, seed: number, interventions?: Intervention): { trajectory: Record<string, number[]> } {
  const rng = mulberry32(seed);
  const names = spec.variables.map((v) => v.name);
  const clamp = clampFns(spec);
  const compiled = new Map<string, EvalFunction>();
  for (const r of spec.rules) {
    try {
      compiled.set(r.target, compile(r.expr));
    } catch {
      throw new Error(`simulator.engine: rule for "${r.target}" ("${r.expr}") failed to compile`);
    }
  }

  const trajectory: Record<string, number[]> = {};
  for (const n of names) trajectory[n] = [];

  let state: Record<string, number> = {};
  for (const v of spec.variables) {
    const val = evalExact(v.initial);
    if (val === null) throw new Error(`simulator.engine: variable "${v.name}" initial "${v.initial}" does not evaluate to a number`);
    state[v.name] = clamp(v.name, val);
  }
  const applyOverride = (tick: number) => {
    if (!interventions) return;
    const hit = interventions.schedule.find((s) => s.tick === tick);
    if (hit) state[interventions.variable] = clamp(interventions.variable, hit.value);
  };
  applyOverride(0);
  for (const n of names) trajectory[n].push(state[n]);

  for (let t = 1; t <= spec.ticks; t++) {
    const prev = state;
    const next: Record<string, number> = { ...prev };
    for (const r of spec.rules) {
      const fn = compiled.get(r.target)!;
      const scope: Record<string, unknown> = { ...prev, t: t - 1, rand: () => rng() };
      let v: unknown;
      try {
        v = fn.evaluate(scope);
      } catch {
        throw new Error(`simulator.engine: rule for "${r.target}" failed to evaluate at tick ${t}`);
      }
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new Error(`simulator.engine: rule for "${r.target}" produced a non-finite value at tick ${t}`);
      }
      next[r.target] = clamp(r.target, v);
    }
    state = next;
    applyOverride(t);
    for (const n of names) trajectory[n].push(state[n]);
  }
  return { trajectory };
}

/**
 * Shared `check` helper: every rule target is a variable (one rule per variable), every expression
 * compiles and evaluates at t = 0 to a finite number, and a full run never overflows to non-finite.
 */
export function checkSimulationSpec(spec: SimulationSpecT): string[] {
  const problems: string[] = [];
  const names = spec.variables.map((v) => v.name);
  if (new Set(names).size !== names.length) problems.push("variables[].name must be unique");
  for (const v of spec.variables) {
    if (looksApproximated(v.initial)) problems.push(`variables "${v.name}" initial "${v.initial}" looks like a rounded decimal; write it exactly`);
    if (evalExact(v.initial) === null) problems.push(`variables "${v.name}" initial "${v.initial}" does not evaluate to a number`);
    if (v.min !== null && v.max !== null && !(v.min < v.max)) problems.push(`variables "${v.name}": min must be less than max`);
  }
  const targets = spec.rules.map((r) => r.target);
  for (const r of spec.rules) {
    if (!names.includes(r.target)) problems.push(`rules target "${r.target}" is not one of variables[].name (${names.join(", ")})`);
  }
  if (new Set(targets).size !== targets.length) problems.push("rules[].target must be unique: one rule per variable");
  if (problems.length > 0) return problems;

  for (const r of spec.rules) {
    let fn: EvalFunction;
    try {
      fn = compile(r.expr);
    } catch {
      problems.push(`rules for "${r.target}": expr "${r.expr}" failed to compile`);
      continue;
    }
    const scope: Record<string, unknown> = { t: 0, rand: () => 0.5 };
    for (const v of spec.variables) scope[v.name] = evalExact(v.initial)!;
    try {
      const val = fn.evaluate(scope);
      if (typeof val !== "number" || !Number.isFinite(val)) problems.push(`rules for "${r.target}": expr does not evaluate to a finite number at t = 0`);
    } catch {
      problems.push(`rules for "${r.target}": expr failed to evaluate at t = 0`);
    }
  }
  if (problems.length > 0) return problems;

  try {
    simulate(spec, 0);
  } catch (e) {
    problems.push(e instanceof Error ? e.message : "the simulation failed to run to completion");
  }
  return problems;
}
