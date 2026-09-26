import { z } from "zod";
import { defineMode } from "../../types";
import { shuffleNotIdentity } from "../../util";

/* linker · network: draw the edges of a relation between nodes. Cards: ecosystem_network, checks_network, migration_flows, deadlock_locks, state_world, supply_chain_flow. */

const Params = z.object({
  relation: z.string().describe('the relation an edge means, e.g. "eats", "checks", "waits for"'),
  directed: z.boolean(),
  nodes: z.array(z.object({ id: z.string().describe("snake_case"), label: z.string() })).min(3).max(8),
  edges: z.array(z.object({ from: z.string(), to: z.string(), why: z.string().describe("why this link exists, under 120 characters") })).min(2).max(14).describe("The TRUE edges; the player must draw exactly these"),
});
type Params = z.infer<typeof Params>;
interface Solution { edges: string[] }
interface Input { edges: { fromId: string; toId: string }[] }
interface View { relation: string; directed: boolean; nodes: { id: string; label: string }[]; edgeCount: number }

const SNAKE = /^[a-z][a-z0-9_]{0,47}$/;
const norm = (p: Params, a: string, b: string) => (p.directed ? `${a}>${b}` : [a, b].sort().join("~"));
const solve = (p: Params): Solution => ({ edges: [...new Set(p.edges.map((e) => norm(p, e.from, e.to)))] });

export const network = defineMode({
  id: "network",
  name: "Network",
  implemented: true,
  blindSolvable: false,
  widget: "link",
  knowledgeTypes: ["system", "causal", "fact"],
  directorBlurb: "Draw the edges of a relation between nodes and find what the structure implies. Food webs, checks and balances, state machines, wait-for graphs.",
  authoringGuide: ["3-8 nodes, 2-14 true edges with a reason each; say whether the relation is directed.", "Choose a structure with a lesson (a cycle, a hub, a missing link).", "Placeholders: {{relation}}, {{nodeCount}}, {{edgeCount}}."].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const ids = p.nodes.map((n) => n.id);
    if (new Set(ids).size !== ids.length) problems.push("node ids must be unique");
    ids.filter((id) => !SNAKE.test(id)).forEach((id) => problems.push(`node id "${id}" must be snake_case`));
    p.edges.forEach((e, i) => {
      if (!ids.includes(e.from) || !ids.includes(e.to)) problems.push(`edges[${i}] refers to an unknown node`);
      if (e.from === e.to) problems.push(`edges[${i}] is a self-loop`);
    });
    const keys = p.edges.map((e) => norm(p, e.from, e.to));
    if (new Set(keys).size !== keys.length) problems.push("edges must be distinct");
    return problems;
  },
  resolve: solve,
  templateVars(p) { return { relation: p.relation, nodeCount: String(p.nodes.length), edgeCount: String(new Set(p.edges.map((e) => norm(p, e.from, e.to))).size) }; },
  answerVars: [],
  present(p, seed): View { return { relation: p.relation, directed: p.directed, nodes: shuffleNotIdentity(p.nodes, seed), edgeCount: solve(p).edges.length }; },
  grade(p, input: Input) {
    const s = new Set(solve(p).edges);
    const given = new Set((input.edges ?? []).map((e) => norm(p, e.fromId, e.toId)));
    const label = (id: string) => p.nodes.find((n) => n.id === id)?.label ?? id;
    const extra = [...given].find((k) => !s.has(k));
    if (extra) {
      const [a, b] = p.directed ? extra.split(">") : extra.split("~");
      return { correct: false, feedback: `${label(a)} does not ${p.relation} ${label(b)}. Remove that link and check the definition of "${p.relation}".` };
    }
    const missing = p.edges.find((e) => !given.has(norm(p, e.from, e.to)));
    if (missing) return { correct: false, feedback: `A link is missing at ${label(missing.from)}: something it ${p.relation}s isn't connected yet.` };
    return { correct: true, feedback: "The network is complete." };
  },
  solutionInput: (p) => ({ edges: p.edges.map((e) => ({ fromId: e.from, toId: e.to })) }),
});
