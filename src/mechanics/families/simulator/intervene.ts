import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, trimNumber } from "../../util";
import { checkSimulationSpec, simulate, SimulationSpec, type SimulationSpecT } from "./engine";

/*
 * simulator · intervene: the player sets a control variable, tick by tick, to keep a target variable
 * inside a band for the whole run (after an initial 10% warm-up). `resolve` grid-searches constant and
 * two-step schedules for one that works; `check` requires that search to succeed AND requires that doing
 * nothing at all fails, so the encounter is never trivial. Cards: atp_gate, feedback_controller,
 * threshold_pulse, greenhouse_dial, recoil_movement.
 */

const Control = z.object({
  variable: z.string().describe("Name of the variable the player sets directly (in system.variables)"),
  min: z.string().describe("Exact mathjs expression: lowest value the control can be set to"),
  max: z.string().describe("Exact mathjs expression: highest value the control can be set to"),
  step: z.string().describe("Exact mathjs expression: the dial's step size"),
});

const Target = z.object({
  variable: z.string().describe("Name of the variable that must stay in band (in system.variables)"),
  low: z.string().describe("Exact mathjs expression: lower edge of the safe band"),
  high: z.string().describe("Exact mathjs expression: upper edge of the safe band"),
});

const Params = z.object({
  system: SimulationSpec,
  control: Control,
  target: Target,
  ticks: z.number().int().min(2).max(200).describe("How many ticks the encounter runs; must match system.ticks"),
  budget: z.number().int().min(1).max(20).describe("Maximum number of times the player may change the control's value"),
});
type Params = z.infer<typeof Params>;

interface ScheduleEntry {
  tick: number;
  value: number;
}
interface Solution {
  schedule: ScheduleEntry[];
}
interface Input {
  schedule: ScheduleEntry[];
}
interface View {
  variables: string[];
  initial: Record<string, number>;
  control: { variable: string; min: number; max: number; step: number };
  target: { variable: string; low: number; high: number };
  ticks: number;
  budget: number;
}

function nums(p: Params) {
  return {
    controlMin: evalExact(p.control.min),
    controlMax: evalExact(p.control.max),
    controlStep: evalExact(p.control.step),
    low: evalExact(p.target.low),
    high: evalExact(p.target.high),
  };
}

function startIndex(ticks: number): number {
  return Math.ceil(ticks * 0.1);
}

/** Whether `target.variable` stays in [low, high] from startIndex through the end of the run. */
function holdsBand(p: Params, schedule: ScheduleEntry[]): boolean {
  const { low, high } = nums(p);
  const { trajectory } = simulate({ ...p.system, ticks: p.ticks }, 0, { variable: p.control.variable, schedule });
  const series = trajectory[p.target.variable];
  const start = startIndex(p.ticks);
  for (let i = start; i < series.length; i++) {
    if (series[i] < (low ?? -Infinity) - 1e-9 || series[i] > (high ?? Infinity) + 1e-9) return false;
  }
  return true;
}

/** First tick the target leaves the band, and which way, or null if it never does. */
function firstBreach(p: Params, schedule: ScheduleEntry[]): { tick: number; direction: "below" | "above" } | null {
  const { low, high } = nums(p);
  const { trajectory } = simulate({ ...p.system, ticks: p.ticks }, 0, { variable: p.control.variable, schedule });
  const series = trajectory[p.target.variable];
  const start = startIndex(p.ticks);
  for (let i = start; i < series.length; i++) {
    if (series[i] < (low ?? -Infinity) - 1e-9) return { tick: i, direction: "below" };
    if (series[i] > (high ?? Infinity) + 1e-9) return { tick: i, direction: "above" };
  }
  return null;
}

function linspace(min: number, max: number, count: number): number[] {
  if (count <= 1) return [min];
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(min + ((max - min) * i) / (count - 1));
  return out;
}

/** Grid search over constant and (budget >= 2) two-step schedules for one that holds the band. */
function findSchedule(p: Params): ScheduleEntry[] | null {
  const { controlMin, controlMax } = nums(p);
  if (controlMin === null || controlMax === null) return null;

  for (const c of linspace(controlMin, controlMax, 21)) {
    const schedule = [{ tick: 0, value: c }];
    if (holdsBand(p, schedule)) return schedule;
  }

  if (p.budget >= 2) {
    const switchTicks = [...new Set([0.25, 0.5, 0.75].map((f) => Math.max(1, Math.round(p.ticks * f))))];
    const values = linspace(controlMin, controlMax, 11);
    for (const c1 of values) {
      for (const c2 of values) {
        if (c1 === c2) continue;
        for (const st of switchTicks) {
          const schedule = [
            { tick: 0, value: c1 },
            { tick: st, value: c2 },
          ];
          if (holdsBand(p, schedule)) return schedule;
        }
      }
    }
  }
  return null;
}

function solve(p: Params): Solution {
  const schedule = findSchedule(p);
  if (schedule === null) throw new Error("simulator.intervene: no schedule within budget keeps the target in band; check() should have caught this");
  return { schedule };
}

export const intervene = defineMode({
  id: "intervene",
  name: "Intervene",
  implemented: true,
  blindSolvable: false,
  widget: "dial",
  knowledgeTypes: ["system", "causal"],
  directorBlurb:
    "The player sets a control variable, tick by tick within a limited budget, to keep a target variable inside a safe band. Homeostasis, active transport, thresholds, climate dials, propulsion.",
  authoringGuide: [
    "Write system.variables/rules so the target drifts out of band on its own (check() requires doing nothing to fail).",
    "control.variable is what the player sets; it should appear in system.rules for other variables, or be read via t/rand() elsewhere.",
    "Keep control.min/max/step and target.low/high as exact expressions; pick budget large enough that a 1-2 step schedule can hold the band.",
    "ticks must match system.ticks. Never write the working schedule anywhere in prose.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems = [...checkSimulationSpec(p.system)];
    const names = p.system.variables.map((v) => v.name);
    if (!names.includes(p.control.variable)) problems.push(`control.variable "${p.control.variable}" is not one of system.variables[].name`);
    if (!names.includes(p.target.variable)) problems.push(`target.variable "${p.target.variable}" is not one of system.variables[].name`);
    if (p.ticks !== p.system.ticks) problems.push(`ticks (${p.ticks}) must equal system.ticks (${p.system.ticks})`);
    for (const [key, val] of [
      ["control.min", p.control.min],
      ["control.max", p.control.max],
      ["control.step", p.control.step],
      ["target.low", p.target.low],
      ["target.high", p.target.high],
    ] as const) {
      if (looksApproximated(val)) problems.push(`${key} "${val}" looks like a rounded decimal; write it exactly`);
      if (evalExact(val) === null) problems.push(`${key} "${val}" does not evaluate to a number`);
    }
    if (problems.length > 0) return problems;
    const { controlMin, controlMax, controlStep, low, high } = nums(p);
    if (!(controlMin! < controlMax!)) problems.push("control.min must be less than control.max");
    if (!(controlStep! > 0)) problems.push("control.step must be positive");
    if (!(low! < high!)) problems.push("target.low must be less than target.high");
    if (problems.length > 0) return problems;

    if (holdsBand(p, [])) {
      problems.push("doing nothing already keeps the target in band; this encounter is trivial. Make the target drift out of band without intervention");
      return problems;
    }
    const schedule = findSchedule(p);
    if (schedule === null) {
      problems.push(`no constant or two-step control schedule within budget ${p.budget} keeps "${p.target.variable}" in [${trimNumber(low!)}, ${trimNumber(high!)}]`);
    } else if (schedule.length > p.budget) {
      problems.push(`the schedule that works needs ${schedule.length} changes but budget is ${p.budget}; raise budget`);
    }
    return problems;
  },
  resolve: solve,
  templateVars(p) {
    return { control: p.control.variable, target: p.target.variable };
  },
  answerVars: [],
  present(p): View {
    const { trajectory } = simulate({ ...p.system, ticks: p.ticks }, 0);
    const initial: Record<string, number> = {};
    for (const v of p.system.variables) initial[v.name] = trajectory[v.name][0];
    const { controlMin, controlMax, controlStep, low, high } = nums(p);
    return {
      variables: p.system.variables.map((v) => v.name),
      initial,
      control: { variable: p.control.variable, min: controlMin!, max: controlMax!, step: controlStep! },
      target: { variable: p.target.variable, low: low!, high: high! },
      ticks: p.ticks,
      budget: p.budget,
    };
  },
  grade(p, input: Input) {
    const schedule = (input.schedule ?? []).slice(0, p.budget);
    if ((input.schedule ?? []).length > p.budget) {
      return { correct: false, feedback: `You used ${input.schedule.length} control changes but the budget is ${p.budget}; plan fewer, more decisive changes.` };
    }
    const breach = firstBreach(p, schedule);
    if (breach === null) return { correct: true, feedback: `"${p.target.variable}" stayed in band for the whole run.` };
    return {
      correct: false,
      feedback: `"${p.target.variable}" went ${breach.direction} the safe band at tick ${breach.tick}. Adjust "${p.control.variable}" ${
        breach.direction === "below" ? "earlier or more strongly" : "sooner or ease off"
      }.`,
    };
  },
  solutionInput: (_p, s) => ({ schedule: s.schedule }),
});
