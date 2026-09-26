import { compile, type EvalFunction } from "mathjs";
import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, trimNumber } from "../../util";

/*
 * tuner · formula: a mathjs expression with named inputs. All-but-one input is fixed; the player dials
 * the controlled input so the output hits the computed target. Cards: formula_engine (Newton's 2nd law),
 * gear_ratio_gate, percent_shop, arc_builder, pythagoras_bridge, compound_tower, dosage_calculator, ...
 */

const InputSpec = z.object({
  name: z.string().describe("Symbol name used in the expression, e.g. 'F' or 'm'"),
  unit: z.string().describe("Unit label shown next to the value, e.g. 'N' or 'kg'; use '' if unitless"),
  min: z.number().min(-1_000_000).max(1_000_000).describe("Lowest value this input can take"),
  max: z.number().min(-1_000_000).max(1_000_000).describe("Highest value this input can take"),
});

const FixedInput = z.object({
  name: z.string().describe("Symbol name; must match one of inputs[].name"),
  value: z.string().describe('Exact mathjs expression for this input\'s fixed value, e.g. "5" or "2.5"'),
});

const Params = z.object({
  expression: z
    .string()
    .describe('Exact mathjs expression for the OUTPUT the player must hit, e.g. "F / m". Every symbol must be one of inputs[].name'),
  outputName: z.string().describe("Name of the output quantity, e.g. 'acceleration'"),
  outputUnit: z.string().describe("Unit of the output, e.g. 'm/s^2'; use '' if unitless"),
  inputs: z.array(InputSpec).min(1).max(4).describe("Every symbol that appears in expression, with its dial range"),
  controlled: z.string().describe("The name of the ONE input the player dials; must match one of inputs[].name"),
  fixed: z
    .array(FixedInput)
    .min(0)
    .max(3)
    .describe("Exact value for every input except the controlled one; one entry per non-controlled input"),
  solution: z
    .string()
    .describe("Exact mathjs expression for the controlled input's value that makes the output hit the target"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  target: number;
  targetLabel: string;
  controlled: number;
  controlledLabel: string;
  values: Record<string, number>;
}
interface Input {
  value: number;
}
interface View {
  expression: string;
  outputName: string;
  outputUnit: string;
  fixed: { name: string; value: number; unit: string }[];
  dial: { name: string; unit: string; min: number; max: number; step: number; ticks: { value: number; label: string }[] };
  target: number;
  targetLabel: string;
}

const TOLERANCE = 0.03; // 3% of the controlled input's range

function unitOf(p: Params, name: string): string {
  return p.inputs.find((i) => i.name === name)?.unit ?? "";
}

function controlledSpec(p: Params) {
  return p.inputs.find((i) => i.name === p.controlled);
}

/** Fixed values evaluated as numbers, keyed by name. Returns null for any that fail to evaluate. */
function fixedValues(p: Params): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const f of p.fixed) {
    const v = evalExact(f.value);
    if (v === null) return null;
    out[f.name] = v;
  }
  return out;
}

/** Evaluates expression at a given controlled value, with fixed values filled in. Null if it doesn't evaluate to a finite number. */
function evaluateAt(p: Params, fixed: Record<string, number>, controlledValue: number): number | null {
  try {
    const compiled = compile(p.expression);
    const scope: Record<string, number> = { ...fixed, [p.controlled]: controlledValue };
    const v = compiled.evaluate(scope);
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function solve(p: Params): Solution {
  const fixed = fixedValues(p);
  if (fixed === null) throw new Error("tuner.formula: a fixed value does not evaluate to a number");
  const controlled = evalExact(p.solution);
  if (controlled === null) throw new Error(`tuner.formula: solution "${p.solution}" does not evaluate to a number`);
  const target = evaluateAt(p, fixed, controlled);
  if (target === null) throw new Error("tuner.formula: expression does not evaluate to a finite number at the solution");
  const values: Record<string, number> = { ...fixed, [p.controlled]: controlled };
  return {
    target,
    targetLabel: `${trimNumber(target)}${p.outputUnit ? ` ${p.outputUnit}` : ""}`,
    controlled,
    controlledLabel: `${trimNumber(controlled)}${unitOf(p, p.controlled) ? ` ${unitOf(p, p.controlled)}` : ""}`,
    values,
  };
}

function dialFor(p: Params): { min: number; max: number; step: number; ticks: { value: number; label: string }[] } {
  const spec = controlledSpec(p)!;
  const min = spec.min;
  const max = spec.max;
  const span = max - min;
  const step = Number((span / 100).toPrecision(3)) || 0.01;
  const tickCount = 5;
  const ticks: { value: number; label: string }[] = [];
  for (let i = 0; i <= tickCount; i++) {
    const v = min + (span * i) / tickCount;
    ticks.push({ value: Math.round(v * 1e6) / 1e6, label: trimNumber(v) });
  }
  return { min, max, step, ticks };
}

export const formula = defineMode({
  id: "formula",
  name: "Formula tuner",
  implemented: true,
  blindSolvable: false,
  widget: "dial",
  knowledgeTypes: ["quantitative"],
  directorBlurb:
    "A mathjs formula with named inputs; the player dials the controlled input so the output hits the computed target. Any formula-driven quantity: physics laws, ratios, percentages, geometry, dosage.",
  authoringGuide: [
    "List every symbol that appears in expression under inputs[], each with a dial range [min, max].",
    "Pick ONE input as controlled; give an exact expression value for every OTHER input under fixed.",
    "Write solution as the exact expression for the controlled value that makes expression hit the target; check it lies inside the controlled input's [min, max].",
    "Never write a rounded decimal for solution or fixed values; use exact expressions like \"3\" or \"5/2\".",
    "Placeholders available: {{expression}}, {{target}}, and each fixed input's name; {{controlled}} is the answer and belongs only in the last hint and the debrief line.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const names = p.inputs.map((i) => i.name);
    if (new Set(names).size !== names.length) problems.push("inputs[].name must be unique");

    // Every symbol in expression must be one of the declared inputs.
    let compiled: EvalFunction | null = null;
    try {
      compiled = compile(p.expression);
    } catch {
      problems.push(`expression "${p.expression}" failed to compile`);
    }
    if (compiled) {
      const test: Record<string, number> = {};
      for (const n of names) test[n] = 1;
      try {
        const v = compiled.evaluate(test);
        if (typeof v !== "number" || !Number.isFinite(v)) {
          problems.push(`expression "${p.expression}" does not evaluate to a finite number`);
        }
      } catch (e) {
        problems.push(`expression "${p.expression}" references a symbol not in inputs (${e instanceof Error ? e.message : "evaluation error"})`);
      }
    }

    if (!names.includes(p.controlled)) problems.push(`controlled "${p.controlled}" must be one of inputs[].name (${names.join(", ")})`);

    const fixedNames = p.fixed.map((f) => f.name);
    if (new Set(fixedNames).size !== fixedNames.length) problems.push("fixed[].name must be unique");
    const nonControlled = names.filter((n) => n !== p.controlled);
    for (const n of nonControlled) {
      if (!fixedNames.includes(n)) problems.push(`input "${n}" is neither controlled nor fixed; give it a fixed value`);
    }
    for (const n of fixedNames) {
      if (!names.includes(n)) problems.push(`fixed[].name "${n}" is not one of inputs[].name`);
      if (n === p.controlled) problems.push(`"${n}" is both controlled and fixed; the controlled input must be free`);
    }
    for (const f of p.fixed) {
      if (looksApproximated(f.value)) problems.push(`fixed "${f.name}" value "${f.value}" looks like a rounded decimal; write it exactly`);
      if (evalExact(f.value) === null) problems.push(`fixed "${f.name}" value "${f.value}" does not evaluate to a number`);
    }
    if (looksApproximated(p.solution)) problems.push(`solution "${p.solution}" looks like a rounded decimal; write it exactly`);

    if (problems.length > 0) return problems; // can't safely evaluate further

    const spec = controlledSpec(p)!;
    if (!(spec.min < spec.max)) problems.push(`controlled input "${p.controlled}" needs min < max`);

    const fixed = fixedValues(p);
    if (fixed === null) {
      problems.push("a fixed value does not evaluate to a number");
      return problems;
    }
    const solutionValue = evalExact(p.solution);
    if (solutionValue === null) {
      problems.push(`solution "${p.solution}" does not evaluate to a number`);
      return problems;
    }
    if (!(solutionValue >= spec.min && solutionValue <= spec.max)) {
      problems.push(`solution ${trimNumber(solutionValue)} lies outside the controlled input's range [${trimNumber(spec.min)}, ${trimNumber(spec.max)}]`);
    }

    // Monotonicity over the controlled input's range: sample 50 points.
    const N = 50;
    const samples: number[] = [];
    for (let i = 0; i <= N; i++) {
      const v = evaluateAt(p, fixed, spec.min + ((spec.max - spec.min) * i) / N);
      if (v === null) {
        problems.push("expression does not evaluate to a finite number across the controlled input's range");
        return problems;
      }
      samples.push(v);
    }
    let increasing = true;
    let decreasing = true;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i] < samples[i - 1] - 1e-9) increasing = false;
      if (samples[i] > samples[i - 1] + 1e-9) decreasing = false;
    }
    if (!increasing && !decreasing) {
      problems.push(
        `the output is not monotonic in "${p.controlled}" over [${trimNumber(spec.min)}, ${trimNumber(spec.max)}]; the target could have more than one solution`,
      );
    }
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    const vars: Record<string, string> = {
      expression: p.expression,
      target: s.targetLabel,
      outputName: p.outputName,
      controlled: s.controlledLabel,
    };
    for (const f of p.fixed) vars[f.name] = `${trimNumber(s.values[f.name])}${unitOf(p, f.name) ? ` ${unitOf(p, f.name)}` : ""}`;
    return vars;
  },
  answerVars: ["controlled"],
  present(p): View {
    const s = solve(p);
    return {
      expression: p.expression,
      outputName: p.outputName,
      outputUnit: p.outputUnit,
      fixed: p.fixed.map((f) => ({ name: f.name, value: s.values[f.name], unit: unitOf(p, f.name) })),
      dial: { name: p.controlled, unit: unitOf(p, p.controlled), ...dialFor(p) },
      target: s.target,
      targetLabel: s.targetLabel,
    };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const spec = controlledSpec(p)!;
    const tol = TOLERANCE * (spec.max - spec.min);
    const fixed = fixedValues(p) ?? {};
    const got = evaluateAt(p, fixed, input.value);
    if (Math.abs(input.value - s.controlled) <= tol) {
      return { correct: true, feedback: `${p.outputName} hits ${s.targetLabel}: the mechanism locks in.` };
    }
    if (got === null) return { correct: false, feedback: "That setting doesn't produce a valid reading; try a value inside the dial's range." };
    const direction = got > s.target ? "too high" : "too low";
    const dialDirection = input.value > s.controlled ? "lower the dial" : "raise the dial";
    return {
      correct: false,
      feedback: `${p.outputName} came out ${direction} (${trimNumber(got)}${p.outputUnit ? ` ${p.outputUnit}` : ""} vs target ${s.targetLabel}); ${dialDirection}.`,
    };
  },
  solutionInput: (_p, s) => ({ value: s.controlled }),
});
