import { z } from "zod";
import { defineMode } from "../../types";

/*
 * builder · circuit: the player wires a small netlist of logic gates so its output matches a target truth
 * table. `resolve` synthesizes ONE minimal circuit (fewest gates, from the allowed palette) via a
 * cost-ordered search over boolean vectors (each vector is the gate's output bit across every row of the
 * truth table, packed into an integer); that search doubles as `check`'s solvability proof. `grade`
 * interprets the player's own netlist: it topologically evaluates it on every row and reports the first
 * row where the output is wrong. Cards: logic_factory ★, state_explorer, power_grid_builder, truth_table_logic.
 *
 * Input (widget "build"): { gates: [{ id, type, inputs: (inputName | gateId)[] }], output: inputName | gateId }
 * View: { inputs, target: [{inputs, output}] (canonical row order), gates (palette), maxGates }
 */

const GATE_TYPES = ["AND", "OR", "NOT", "NAND", "NOR", "XOR"] as const;
type GateType = (typeof GATE_TYPES)[number];
const GateTypeSchema = z.enum(GATE_TYPES);

const TruthRow = z.object({
  inputs: z.array(z.boolean()).min(1).max(3).describe("The input values for this row, in the same order as params.inputs"),
  output: z.boolean().describe("What the circuit must output for this combination of inputs"),
});

const Params = z.object({
  inputs: z.array(z.string()).min(1).max(3).describe('Names of the circuit inputs, e.g. ["A", "B"]'),
  target: z.array(TruthRow).min(1).max(8).describe("The complete truth table: exactly one row per combination of the inputs (2^n rows), any order"),
  gates: z.array(GateTypeSchema).min(1).max(6).describe('The palette of gate types the player may use, e.g. ["AND", "OR", "NOT"]. No duplicates'),
  maxGates: z.number().int().min(1).max(6).describe("Maximum number of gates the player's circuit may use"),
});
type Params = z.infer<typeof Params>;

interface NetlistGate {
  id: string;
  type: GateType;
  inputs: string[]; // input names or earlier gate ids
}
interface Netlist {
  gates: NetlistGate[];
  output: string;
}
interface Input {
  gates: NetlistGate[];
  output: string;
}

interface Solution {
  vector: number; // target output packed as bits, one per canonical row
  rows: number; // 2^n
  circuit: Netlist;
  minGates: number;
}

interface View {
  inputs: string[];
  target: { inputs: boolean[]; output: boolean }[]; // canonical row order
  gates: GateType[];
  maxGates: number;
}

// ---------------------------------------------------------------- canonical rows + gate ops on packed vectors

function rowInputs(n: number, r: number): boolean[] {
  return Array.from({ length: n }, (_, i) => ((r >> (n - 1 - i)) & 1) === 1);
}

function packInputVector(n: number, index: number): number {
  const rows = 1 << n;
  let v = 0;
  for (let r = 0; r < rows; r++) if (rowInputs(n, r)[index]) v |= 1 << r;
  return v;
}

function applyGate(type: GateType, mask: number, a: number, b: number | null): number {
  switch (type) {
    case "AND":
      return a & (b as number);
    case "OR":
      return a | (b as number);
    case "XOR":
      return a ^ (b as number);
    case "NAND":
      return ~(a & (b as number)) & mask;
    case "NOR":
      return ~(a | (b as number)) & mask;
    case "NOT":
      return ~a & mask;
  }
}

const isUnary = (t: GateType) => t === "NOT";

/** Builds the target vector from params.target, matched to canonical rows by the input combination. */
function targetVector(p: Params): number | null {
  const n = p.inputs.length;
  const rows = 1 << n;
  if (p.target.length !== rows) return null;
  const byKey = new Map<string, boolean>();
  for (const row of p.target) {
    if (row.inputs.length !== n) return null;
    const key = row.inputs.map((b) => (b ? "1" : "0")).join("");
    if (byKey.has(key)) return null; // duplicate row
    byKey.set(key, row.output);
  }
  let v = 0;
  for (let r = 0; r < rows; r++) {
    const key = rowInputs(n, r)
      .map((b) => (b ? "1" : "0"))
      .join("");
    const out = byKey.get(key);
    if (out === undefined) return null; // missing combination
    if (out) v |= 1 << r;
  }
  return v;
}

// ---------------------------------------------------------------- minimal-cost synthesis

interface Node {
  vec: number;
  cost: number;
  op: GateType | "input";
  inputIndex?: number;
  a?: Node;
  b?: Node;
}

interface SynthResult {
  found: Map<number, Node>;
}

function synthesize(n: number, gates: readonly GateType[], maxGates: number): SynthResult {
  const rows = 1 << n;
  const mask = rows === 32 ? 0xffffffff : (1 << rows) - 1;
  const found = new Map<number, Node>();
  const byCost = new Map<number, Node[]>();
  const cost0: Node[] = [];
  for (let i = 0; i < n; i++) {
    const vec = packInputVector(n, i);
    if (!found.has(vec)) {
      const node: Node = { vec, cost: 0, op: "input", inputIndex: i };
      found.set(vec, node);
      cost0.push(node);
    }
  }
  byCost.set(0, cost0);
  const binaryGates = gates.filter((g) => !isUnary(g));
  const hasNot = gates.includes("NOT");

  for (let c = 1; c <= maxGates; c++) {
    const fresh = new Map<number, Node>();
    if (hasNot) {
      for (const child of byCost.get(c - 1) ?? []) {
        const vec = applyGate("NOT", mask, child.vec, null);
        if (!found.has(vec) && !fresh.has(vec)) fresh.set(vec, { vec, cost: c, op: "NOT", a: child });
      }
    }
    for (let a = 0; a <= c - 1; a++) {
      const b = c - 1 - a;
      if (b < a) continue;
      const nodesA = byCost.get(a) ?? [];
      const nodesB = byCost.get(b) ?? [];
      for (const gt of binaryGates) {
        for (const nodeA of nodesA) {
          for (const nodeB of nodesB) {
            if (a === b && nodeB === nodeA) continue;
            const vec = applyGate(gt, mask, nodeA.vec, nodeB.vec);
            if (!found.has(vec) && !fresh.has(vec)) fresh.set(vec, { vec, cost: c, op: gt, a: nodeA, b: nodeB });
          }
        }
      }
    }
    byCost.set(c, [...fresh.values()]);
    for (const [vec, node] of fresh) found.set(vec, node);
  }
  return { found };
}

/** Turns a synthesized node tree into a netlist, using p.inputs names for leaves and fresh gate ids g0.. for gates. */
function toNetlist(p: Params, node: Node): Netlist {
  const gates: NetlistGate[] = [];
  let counter = 0;
  const emit = (n: Node): string => {
    if (n.op === "input") return p.inputs[n.inputIndex!];
    const id = `g${counter++}`;
    const ins: string[] = [];
    if (n.a) ins.push(emit(n.a));
    if (n.b) ins.push(emit(n.b));
    gates.push({ id, type: n.op, inputs: ins });
    return id;
  };
  const output = emit(node);
  return { gates, output };
}

function solve(p: Params): Solution {
  const n = p.inputs.length;
  const rows = 1 << n;
  const target = targetVector(p);
  if (target === null) throw new Error("builder.circuit: target is not a complete, consistent truth table");
  const { found } = synthesize(n, p.gates, p.maxGates);
  const node = found.get(target);
  if (!node) throw new Error(`builder.circuit: no circuit from the allowed gates reaches this table within ${p.maxGates} gates`);
  const circuit = toNetlist(p, node);
  return { vector: target, rows, circuit, minGates: node.cost };
}

// ---------------------------------------------------------------- grading the player's netlist

function evaluateNetlist(p: Params, input: Input, mask: number): { ok: true; vec: number } | { ok: false; reason: string } {
  const n = p.inputs.length;
  if (input.gates.length > p.maxGates) {
    return { ok: false, reason: `your circuit uses ${input.gates.length} gates, more than the limit of ${p.maxGates}` };
  }
  const ids = input.gates.map((g) => g.id);
  if (new Set(ids).size !== ids.length) return { ok: false, reason: "two gates share the same id" };
  if (ids.some((id) => p.inputs.includes(id))) return { ok: false, reason: "a gate id reuses an input name" };
  for (const g of input.gates) {
    if (!p.gates.includes(g.type)) return { ok: false, reason: `gate "${g.id}" uses ${g.type}, which isn't in the allowed palette (${p.gates.join(", ")})` };
    const expected = isUnary(g.type) ? 1 : 2;
    if (g.inputs.length !== expected) return { ok: false, reason: `gate "${g.id}" (${g.type}) needs exactly ${expected} input${expected === 1 ? "" : "s"}` };
  }
  // topological evaluation: resolve each gate only once its inputs are known
  const vecOf = new Map<string, number>();
  p.inputs.forEach((name, i) => vecOf.set(name, packInputVector(n, i)));
  const gateById = new Map(input.gates.map((g) => [g.id, g]));
  const resolving = new Set<string>();
  function resolve(name: string): number {
    if (vecOf.has(name)) return vecOf.get(name)!;
    const g = gateById.get(name);
    if (!g) throw new Error(`"${name}" is never defined`);
    if (resolving.has(name)) throw new Error(`circuit has a cycle at gate "${name}"`);
    resolving.add(name);
    const ins = g.inputs.map((i) => resolve(i));
    const vec = applyGate(g.type, mask, ins[0], ins[1] ?? null);
    resolving.delete(name);
    vecOf.set(name, vec);
    return vec;
  }
  try {
    for (const g of input.gates) resolve(g.id);
    const out = resolve(input.output);
    return { ok: true, vec: out };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export const circuit = defineMode({
  id: "circuit",
  name: "Circuit",
  implemented: true,
  blindSolvable: false,
  widget: "build",
  knowledgeTypes: ["procedure", "spatial"],
  directorBlurb:
    "The player wires logic gates from a fixed palette so the circuit's output matches a target truth table. Logic gates, Boolean functions, series/parallel circuits.",
  authoringGuide: [
    'List 1-3 input names, e.g. ["A", "B"], and the FULL truth table as target: one row per combination (2^n rows), each row giving that combination\'s inputs and the required output.',
    'Pick gates (the allowed palette) from AND, OR, NOT, NAND, NOR, XOR, and a maxGates budget (1-6). Code proves a circuit exists within that budget before the encounter ships.',
    "Don't design the wiring yourself; code finds one minimal circuit and uses it to grade the player's own netlist.",
    "A palette of just NAND (or just NOR) can build anything; smaller palettes need more gates, so raise maxGates accordingly.",
    "Placeholders: {{minGates}} (how few gates the target needs): last hint and debrief only.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const n = p.inputs.length;
    if (new Set(p.inputs).size !== p.inputs.length) problems.push("input names must be distinct");
    if (new Set(p.gates).size !== p.gates.length) problems.push("gates must list each palette type at most once");
    const target = targetVector(p);
    if (target === null) {
      problems.push(`target must have exactly ${1 << n} rows, one per combination of the ${n} input(s), with no duplicates or gaps`);
      return problems;
    }
    try {
      solve(p);
    } catch (err) {
      problems.push(err instanceof Error ? err.message : String(err));
    }
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { minGates: String(s.minGates), inputCount: String(p.inputs.length) };
  },
  answerVars: ["minGates"],
  present(p): View {
    const n = p.inputs.length;
    const rows = 1 << n;
    return {
      inputs: [...p.inputs],
      target: Array.from({ length: rows }, (_, r) => {
        const ins = rowInputs(n, r);
        const target = targetVector(p);
        const bit = target !== null ? (target >> r) & 1 : 0;
        return { inputs: ins, output: bit === 1 };
      }),
      gates: [...p.gates],
      maxGates: p.maxGates,
    };
  },
  grade(p, input: Input) {
    const n = p.inputs.length;
    const rows = 1 << n;
    const mask = rows === 32 ? 0xffffffff : (1 << rows) - 1;
    const target = targetVector(p)!;
    const result = evaluateNetlist(p, input, mask);
    if (!result.ok) return { correct: false, feedback: `Invalid circuit: ${result.reason}.` };
    if (result.vec === target) return { correct: true, feedback: "Every row of the truth table matches: the circuit is correct." };
    for (let r = 0; r < rows; r++) {
      const want = (target >> r) & 1;
      const got = (result.vec >> r) & 1;
      if (want !== got) {
        const desc = p.inputs.map((name, i) => `${name}=${rowInputs(n, r)[i] ? 1 : 0}`).join(", ");
        return { correct: false, feedback: `With ${desc}, your circuit gives ${got} but the table needs ${want}.` };
      }
    }
    return { correct: false, feedback: "The circuit doesn't match the target table." };
  },
  solutionInput: (_p, s) => ({ gates: s.circuit.gates, output: s.circuit.output }),
});
