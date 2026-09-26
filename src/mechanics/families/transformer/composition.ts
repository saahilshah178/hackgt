import { compile } from "mathjs";
import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, shuffleNotIdentity, trimNumber } from "../../util";

/*
 * transformer · composition: order the machines so the chain produces the target. Two flavours:
 * numeric machines (mathjs in x; the order matters because f∘g ≠ g∘f) and resource stations (each
 * consumes and produces named resources; a station can only run once its inputs exist). Code brute-forces
 * every order to prove the answer is unique. Cards: machine_pipeline, unit_pipeline, photosynthesis_recipe, respiration_forge.
 */

const Machine = z.object({
  id: z.string().describe("snake_case"),
  label: z.string(),
  expr: z.string().describe('numeric kind: mathjs in x, e.g. "2*x". resources kind: ""'),
  consumes: z.array(z.string()).min(0).max(4).describe("resources kind: resource names this station needs"),
  produces: z.array(z.string()).min(0).max(4).describe("resources kind: resource names it outputs"),
});

const Params = z.object({
  kind: z.enum(["numeric", "resources"]),
  machines: z.array(Machine).min(2).max(4),
  input: z.string().describe('numeric: exact starting value. resources: comma-separated starting resources, e.g. "light,water,co2"'),
  target: z.string().describe('numeric: exact target output. resources: the resource that must exist at the end, e.g. "glucose"'),
});
type Params = z.infer<typeof Params>;
interface Solution { order: string[]; trace: string[] }
interface Input { order: string[] }
interface View { kind: "numeric" | "resources"; machines: { id: string; label: string }[]; input: string; target: string }

const SNAKE = /^[a-z][a-z0-9_]{0,47}$/;
const norm = (s: string) => s.trim().toLowerCase();

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]));
}

/** Runs one ordering; returns null when it fails (bad math, or a station whose inputs are missing). */
function run(p: Params, order: string[]): { ok: boolean; trace: string[] } {
  const byId = new Map(p.machines.map((m) => [m.id, m]));
  const trace: string[] = [];
  if (p.kind === "numeric") {
    let x = evalExact(p.input);
    if (x === null) return { ok: false, trace };
    for (const id of order) {
      const m = byId.get(id);
      if (!m) return { ok: false, trace };
      try {
        const v = compile(m.expr).evaluate({ x }) as unknown;
        if (typeof v !== "number" || !Number.isFinite(v)) return { ok: false, trace };
        trace.push(`${m.label}: ${trimNumber(x)} → ${trimNumber(v)}`);
        x = v;
      } catch {
        return { ok: false, trace };
      }
    }
    const target = evalExact(p.target);
    return { ok: target !== null && Math.abs(x - target) <= 1e-6 * (1 + Math.abs(target)), trace };
  }
  const have = new Set(p.input.split(",").map(norm).filter(Boolean));
  for (const id of order) {
    const m = byId.get(id);
    if (!m) return { ok: false, trace };
    const missing = m.consumes.map(norm).filter((r) => !have.has(r));
    if (missing.length) {
      trace.push(`${m.label}: stalls, missing ${missing.join(", ")}`);
      return { ok: false, trace };
    }
    m.consumes.forEach((r) => have.delete(norm(r)));
    m.produces.forEach((r) => have.add(norm(r)));
    trace.push(`${m.label}: makes ${m.produces.join(", ") || "nothing"}`);
  }
  return { ok: have.has(norm(p.target)), trace };
}

function solve(p: Params): Solution {
  const ids = p.machines.map((m) => m.id);
  const winners = permutations(ids).filter((o) => run(p, o).ok);
  if (winners.length !== 1) throw new Error(`transformer.composition: ${winners.length} orderings reach the target; exactly one must`);
  return { order: winners[0], trace: run(p, winners[0]).trace };
}

export const composition = defineMode({
  id: "composition",
  name: "Composition",
  implemented: true,
  blindSolvable: false,
  widget: "order",
  knowledgeTypes: ["procedure", "system"],
  directorBlurb: "Order the machines (or stations) so the chain turns the input into the target; code proves only one order works. Function composition, unit conversion pipelines, multi-step processes like photosynthesis.",
  authoringGuide: [
    "numeric: 2-4 machines with mathjs rules in x, an exact input and target such that exactly one order reaches the target (f∘g ≠ g∘f is the lesson).",
    'resources: stations with consumes/produces lists and comma-separated starting resources; exactly one order lets every station run in turn and ends with the target resource.',
    "Placeholders: {{machineCount}}, {{input}}, {{target}} (safe), {{order}} (the answer: last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const ids = p.machines.map((m) => m.id);
    if (new Set(ids).size !== ids.length) problems.push("machine ids must be unique");
    ids.filter((id) => !SNAKE.test(id)).forEach((id) => problems.push(`machine id "${id}" must be snake_case`));
    if (p.kind === "numeric") {
      if (looksApproximated(p.input) || looksApproximated(p.target)) problems.push("input and target must be exact");
      if (evalExact(p.input) === null || evalExact(p.target) === null) problems.push("input and target must evaluate to numbers");
      p.machines.forEach((m, i) => {
        try { compile(m.expr); } catch { problems.push(`machines[${i}].expr "${m.expr}" is not a valid mathjs expression`); }
      });
    } else {
      p.machines.forEach((m, i) => { if (m.produces.length === 0) problems.push(`machines[${i}] produces nothing`); });
    }
    if (problems.length) return problems;
    const winners = permutations(ids).filter((o) => run(p, o).ok);
    if (winners.length === 0) problems.push("no ordering of the machines reaches the target");
    if (winners.length > 1) problems.push(`${winners.length} orderings reach the target; change a machine so only one works`);
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    const label = (id: string) => p.machines.find((m) => m.id === id)?.label ?? id;
    return { machineCount: String(p.machines.length), input: p.input, target: p.target, order: s.order.map(label).join(" → ") };
  },
  answerVars: ["order"],
  present(p, seed): View {
    return { kind: p.kind, machines: shuffleNotIdentity(p.machines.map((m) => ({ id: m.id, label: m.label })), seed), input: p.input, target: p.target };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const order = input.order ?? [];
    if (order.length !== p.machines.length || new Set(order).size !== order.length) return { correct: false, feedback: `Use every machine exactly once (${p.machines.length} slots).` };
    if (order.every((id, i) => id === s.order[i])) return { correct: true, feedback: `The chain runs: ${s.trace.join("; ")}.` };
    const r = run(p, order);
    const last = r.trace[r.trace.length - 1] ?? "the first machine never gets what it needs";
    return { correct: false, feedback: `That order ${r.ok ? "reaches the target by luck? No:" : "fails:"} ${last}. Each machine's output must be what the next one takes in.` };
  },
  solutionInput: (_p, s) => ({ order: s.order }),
});
