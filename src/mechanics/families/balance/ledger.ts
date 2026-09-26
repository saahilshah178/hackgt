import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, trimNumber } from "../../util";

/*
 * balance · ledger: nodes connected by flows (some to/from "outside", i.e. null); conservation holds at
 * every node (inflow total equals outflow total). Some flows are blanks (value: null); the player fills
 * them in. Code solves the linear system in the blanks and grades by re-checking conservation with
 * whatever the player submitted, so any internally consistent fill passes.
 * Cards: energy_converter, flow_network, current_junction, voltage_loop, electoral_math, budget_balance,
 * accounting_equation.
 */

const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;

const NodeSpec = z.object({
  id: z.string().describe("snake_case id for this node, e.g. 'spring'"),
  label: z.string().describe("Shown on the node, under 40 characters"),
});

const FlowSpec = z.object({
  from: z.string().nullable().describe("Source node id, or null when the flow enters from outside the system"),
  to: z.string().nullable().describe("Destination node id, or null when the flow leaves to outside the system"),
  label: z.string().describe("Shown on this flow, under 60 characters"),
  value: z
    .string()
    .nullable()
    .describe("Exact mathjs expression for this flow's value, or null to make it a blank the player fills in"),
});

const Params = z.object({
  nodes: z.array(NodeSpec).min(2).max(8).describe("2-8 nodes where conservation must hold: inflow total equals outflow total"),
  flows: z
    .array(FlowSpec)
    .min(2)
    .max(10)
    .describe("2-10 directed flows between nodes (or outside, using null); 1-4 of them have value: null and are the blanks"),
});
type Params = z.infer<typeof Params>;

interface BlankValue {
  flowKey: string;
  label: string;
  value: number;
}

interface Solution {
  values: BlankValue[];
  missingLabel: string;
}

interface Input {
  values: { flowKey: string; value: number }[];
}

interface View {
  nodes: { id: string; label: string }[];
  flows: { flowKey: string; from: string | null; to: string | null; label: string; value: number | null }[];
}

const flowKey = (i: number) => `f${i}`;
const TOLERANCE = 0.02;

/** Gaussian elimination with partial pivoting. Returns the unique solution, or null (inconsistent) / "infinite". */
function solveLinear(A: number[][], b: number[]): number[] | null | "infinite" {
  const n = A.length;
  const m = A[0]?.length ?? 0;
  const M = A.map((row, i) => [...row, b[i]]);
  let pivotRow = 0;
  const pivotCols: number[] = [];
  for (let col = 0; col < m && pivotRow < n; col++) {
    let sel = -1;
    for (let r = pivotRow; r < n; r++) {
      if (Math.abs(M[r][col]) > 1e-9) {
        sel = r;
        break;
      }
    }
    if (sel === -1) continue;
    [M[sel], M[pivotRow]] = [M[pivotRow], M[sel]];
    const pv = M[pivotRow][col];
    M[pivotRow] = M[pivotRow].map((v) => v / pv);
    for (let r = 0; r < n; r++) {
      if (r === pivotRow) continue;
      const factor = M[r][col];
      if (Math.abs(factor) > 1e-12) M[r] = M[r].map((v, k) => v - factor * M[pivotRow][k]);
    }
    pivotCols.push(col);
    pivotRow++;
  }
  for (let r = pivotRow; r < n; r++) {
    if (Math.abs(M[r][m]) > 1e-7) return null; // inconsistent
  }
  if (pivotCols.length < m) return "infinite";
  const x = new Array(m).fill(0);
  pivotCols.forEach((col, r) => (x[col] = M[r][m]));
  return x;
}

function buildSystem(p: Params): { A: number[][]; b: number[]; blankFlowIndices: number[] } {
  const nodeIndex = new Map(p.nodes.map((n, i) => [n.id, i]));
  const blankFlowIndices = p.flows.map((f, i) => (f.value === null ? i : -1)).filter((i) => i >= 0);
  const blankCol = new Map(blankFlowIndices.map((i, bi) => [i, bi]));
  const A: number[][] = p.nodes.map(() => new Array(blankFlowIndices.length).fill(0));
  const b: number[] = p.nodes.map(() => 0);
  const addTerm = (nodeId: string | null, coeff: number, bi: number | undefined, val: number | null) => {
    if (nodeId === null) return;
    const ni = nodeIndex.get(nodeId);
    if (ni === undefined) return;
    if (bi !== undefined) A[ni][bi] += coeff;
    else b[ni] -= coeff * (val ?? 0);
  };
  p.flows.forEach((f, i) => {
    const bi = blankCol.get(i);
    const val = f.value === null ? null : evalExact(f.value);
    addTerm(f.to, 1, bi, val);
    addTerm(f.from, -1, bi, val);
  });
  return { A, b, blankFlowIndices };
}

function solve(p: Params): Solution {
  const { A, b, blankFlowIndices } = buildSystem(p);
  const x = solveLinear(A, b);
  if (x === null) throw new Error("balance.ledger: the known flows are inconsistent with conservation at some node");
  if (x === "infinite") throw new Error("balance.ledger: not enough known flows to pin down a unique solution for the blanks");
  const values: BlankValue[] = blankFlowIndices.map((flowIdx, bi) => ({
    flowKey: flowKey(flowIdx),
    label: p.flows[flowIdx].label,
    value: x[bi],
  }));
  return { values, missingLabel: values.map((v) => `${v.label} = ${trimNumber(v.value)}`).join(", ") };
}

function allFlowValues(p: Params, s: Solution): number[] {
  const byKey = new Map(s.values.map((v) => [v.flowKey, v.value]));
  return p.flows.map((f, i) => (f.value !== null ? evalExact(f.value)! : byKey.get(flowKey(i))!));
}

export const ledger = defineMode({
  id: "ledger",
  name: "Ledger",
  implemented: true,
  blindSolvable: true,
  widget: "build",
  knowledgeTypes: ["quantitative", "system"],
  directorBlurb:
    "Nodes connected by flows; inflow must equal outflow at every node. Some flows are blank; the player fills them in. Conservation laws: energy, current, budgets, accounting.",
  authoringGuide: [
    "Write 2-8 nodes with snake_case ids, and 2-10 flows between them; use from: null for a flow entering from outside, to: null for one leaving to outside.",
    "Give every flow an exact value EXCEPT 1-4 of them, which get value: null; those are the blanks the player fills in.",
    "The known values must pin down the blanks uniquely: don't leave more unknowns than the conservation equations can solve.",
    "Never write the blanks' values anywhere; code solves the linear system.",
    "Placeholders: {{missing}} (each blank's label and value): last hint and debrief only.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const nodeIds = p.nodes.map((n) => n.id);
    nodeIds.forEach((id, i) => {
      if (!SNAKE_CASE.test(id)) problems.push(`nodes[${i}].id "${id}" must be lowercase snake_case`);
    });
    if (new Set(nodeIds).size !== nodeIds.length) problems.push("node ids must be unique");
    p.flows.forEach((f, i) => {
      if (f.from === null && f.to === null) problems.push(`flows[${i}] has both from and to null; a flow needs at least one endpoint`);
      if (f.from !== null && f.from === f.to) problems.push(`flows[${i}]: from and to are the same node`);
      if (f.from !== null && !nodeIds.includes(f.from)) problems.push(`flows[${i}].from "${f.from}" doesn't match any node`);
      if (f.to !== null && !nodeIds.includes(f.to)) problems.push(`flows[${i}].to "${f.to}" doesn't match any node`);
      if (f.value !== null) {
        if (looksApproximated(f.value)) problems.push(`flows[${i}].value "${f.value}" looks like a rounded decimal; write it exactly`);
        if (evalExact(f.value) === null) problems.push(`flows[${i}].value "${f.value}" does not evaluate to a number`);
      }
    });
    if (problems.length > 0) return problems;
    const blankCount = p.flows.filter((f) => f.value === null).length;
    if (blankCount < 1) problems.push("at least one flow must be a blank (value: null)");
    if (blankCount > 4) problems.push(`${blankCount} flows are blank; keep it to at most 4 so the puzzle stays solvable by hand`);
    if (problems.length > 0) return problems;
    const { A, b } = buildSystem(p);
    const x = solveLinear(A, b);
    if (x === null) problems.push("the known flows already contradict conservation at some node; fix a value");
    if (x === "infinite") problems.push("the known flows don't pin down a unique value for every blank; make one more flow known");
    return problems;
  },
  resolve: solve,
  templateVars(_p, s) {
    return { missing: s.missingLabel };
  },
  answerVars: ["missing"],
  present(p): View {
    return {
      nodes: p.nodes.map((n) => ({ id: n.id, label: n.label })),
      flows: p.flows.map((f, i) => ({
        flowKey: flowKey(i),
        from: f.from,
        to: f.to,
        label: f.label,
        value: f.value === null ? null : evalExact(f.value),
      })),
    };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const given = new Map(input.values.map((v) => [v.flowKey, v.value]));
    const blankKeys = s.values.map((v) => v.flowKey);
    const missing = blankKeys.filter((k) => !given.has(k));
    if (missing.length > 0) {
      return { correct: false, feedback: `Fill in every blank flow (${missing.length} still empty) before checking the ledger.` };
    }
    const values = p.flows.map((f, i) => (f.value !== null ? evalExact(f.value)! : given.get(flowKey(i))!));
    const scale = Math.max(1e-9, ...allFlowValues(p, s).map((v) => Math.abs(v)));
    const tol = TOLERANCE * scale;
    for (const node of p.nodes) {
      let net = 0;
      p.flows.forEach((f, i) => {
        const v = values[i];
        if (f.to === node.id) net += v;
        if (f.from === node.id) net -= v;
      });
      if (Math.abs(net) > tol) {
        return {
          correct: false,
          feedback: `"${node.label}" doesn't balance: inflow and outflow differ by ${trimNumber(Math.abs(net))}. Adjust a flow touching that node.`,
        };
      }
    }
    return { correct: true, feedback: "Every node balances: inflow equals outflow everywhere." };
  },
  solutionInput: (_p, s) => ({ values: s.values.map((v) => ({ flowKey: v.flowKey, value: v.value })) }),
  blind: {
    schema: z.object({
      values: z
        .array(
          z.object({
            flow: z.number().int().min(0).max(9).describe("Position (0-based) of the blank flow, in the order shown"),
            value: z.number(),
          }),
        )
        .min(1)
        .max(4),
    }),
    describe: (_p, view: View) =>
      `Nodes: ${view.nodes.map((n) => `${n.id} (${n.label})`).join(", ")}\nFlows:\n${view.flows
        .map((f, i) => `${i}. ${f.label}: ${f.from ?? "outside"} -> ${f.to ?? "outside"} = ${f.value === null ? "?" : trimNumber(f.value)}`)
        .join("\n")}`,
    toInput: (_p, _view: View, out) => {
      const o = out as { values: { flow: number; value: number }[] };
      return { values: o.values.map((v) => ({ flowKey: flowKey(v.flow), value: v.value })) };
    },
  },
});
