import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, trimNumber } from "../../util";

/* linker · path: a weighted graph; find the cheapest (or any valid) route. Code runs Dijkstra. Card: weighted_path_planner. */

const Params = z.object({
  nodes: z.array(z.object({ id: z.string().describe("snake_case"), label: z.string() })).min(3).max(10),
  edges: z.array(z.object({ from: z.string(), to: z.string(), weight: z.string().describe("exact positive cost") })).min(2).max(20),
  directed: z.boolean(),
  start: z.string(),
  goal: z.string(),
  ask: z.enum(["shortest", "any"]).describe("shortest: the route must have minimal total cost. any: any valid route"),
  costName: z.string().describe('e.g. "minutes", "gold"'),
});
type Params = z.infer<typeof Params>;
interface Solution { path: string[]; cost: number; fewestEdgesCost: number | null }
interface Input { path: string[] }
interface View { nodes: { id: string; label: string }[]; edges: { from: string; to: string; weight: number }[]; directed: boolean; start: string; goal: string; ask: "shortest" | "any"; costName: string }

const SNAKE = /^[a-z][a-z0-9_]{0,47}$/;

function adjacency(p: Params): Map<string, { to: string; w: number }[]> {
  const adj = new Map<string, { to: string; w: number }[]>();
  for (const n of p.nodes) adj.set(n.id, []);
  for (const e of p.edges) {
    const w = evalExact(e.weight) ?? Number.NaN;
    adj.get(e.from)?.push({ to: e.to, w });
    if (!p.directed) adj.get(e.to)?.push({ to: e.from, w });
  }
  return adj;
}

function dijkstra(p: Params, weightOf: (w: number) => number): { path: string[]; cost: number } | null {
  const adj = adjacency(p);
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const todo = new Set(p.nodes.map((n) => n.id));
  for (const id of todo) dist.set(id, Infinity);
  dist.set(p.start, 0);
  while (todo.size) {
    let u = "";
    let best = Infinity;
    for (const id of todo) if ((dist.get(id) ?? Infinity) < best) { best = dist.get(id)!; u = id; }
    if (!u) break;
    todo.delete(u);
    if (u === p.goal) break;
    for (const { to, w } of adj.get(u) ?? []) {
      const nd = best + weightOf(w);
      if (nd < (dist.get(to) ?? Infinity)) { dist.set(to, nd); prev.set(to, u); }
    }
  }
  if (!Number.isFinite(dist.get(p.goal) ?? Infinity)) return null;
  const path = [p.goal];
  while (path[0] !== p.start) path.unshift(prev.get(path[0])!);
  return { path, cost: dist.get(p.goal)! };
}

function pathCost(p: Params, path: string[]): number | null {
  const adj = adjacency(p);
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const e = (adj.get(path[i - 1]) ?? []).find((x) => x.to === path[i]);
    if (!e) return null;
    cost += e.w;
  }
  return cost;
}

function solve(p: Params): Solution {
  const best = dijkstra(p, (w) => w);
  if (!best) throw new Error("linker.path: goal unreachable");
  const fewest = dijkstra(p, () => 1);
  return { path: best.path, cost: best.cost, fewestEdgesCost: fewest ? pathCost(p, fewest.path) : null };
}

export const path = defineMode({
  id: "path",
  name: "Path",
  implemented: true,
  blindSolvable: false,
  widget: "link",
  knowledgeTypes: ["procedure", "quantitative"],
  directorBlurb: "Find the cheapest route across a weighted graph; the route with the fewest hops is a trap. Shortest paths, routing, planning under costs.",
  authoringGuide: ["3-10 nodes and 2-20 weighted edges (exact positive numbers). For ask=shortest, make the fewest-edge route MORE expensive than the best route.", "Placeholders: {{costName}}, {{start}}, {{goal}}, {{bestCost}} (the answer: last hint and debrief only)."].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const ids = p.nodes.map((n) => n.id);
    if (new Set(ids).size !== ids.length) problems.push("node ids must be unique");
    ids.filter((id) => !SNAKE.test(id)).forEach((id) => problems.push(`node id "${id}" must be snake_case`));
    if (!ids.includes(p.start) || !ids.includes(p.goal)) problems.push("start and goal must be nodes");
    if (p.start === p.goal) problems.push("start and goal must differ");
    p.edges.forEach((e, i) => {
      if (!ids.includes(e.from) || !ids.includes(e.to)) problems.push(`edges[${i}] refers to an unknown node`);
      if (looksApproximated(e.weight)) problems.push(`edges[${i}].weight looks like a rounded decimal`);
      const w = evalExact(e.weight);
      if (w === null || w <= 0) problems.push(`edges[${i}].weight must be a positive number`);
    });
    if (problems.length) return problems;
    let s: Solution;
    try { s = solve(p); } catch { problems.push("the goal is unreachable from the start"); return problems; }
    if (p.ask === "shortest" && s.fewestEdgesCost !== null && s.fewestEdgesCost <= s.cost + 1e-9 && s.path.length !== (dijkstra(p, () => 1)?.path.length ?? 0)) {
      problems.push("the fewest-hop route is already the cheapest; add a cheap detour so the lesson (hops ≠ cost) holds");
    }
    return problems;
  },
  resolve: solve,
  templateVars(p, s) { return { costName: p.costName, start: p.nodes.find((n) => n.id === p.start)?.label ?? p.start, goal: p.nodes.find((n) => n.id === p.goal)?.label ?? p.goal, bestCost: trimNumber(s.cost) }; },
  answerVars: ["bestCost"],
  present(p): View {
    return { nodes: p.nodes, edges: p.edges.map((e) => ({ from: e.from, to: e.to, weight: evalExact(e.weight) ?? 0 })), directed: p.directed, start: p.start, goal: p.goal, ask: p.ask, costName: p.costName };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const route = input.path ?? [];
    if (route[0] !== p.start || route[route.length - 1] !== p.goal) return { correct: false, feedback: "The route must start at the start and end at the goal." };
    const cost = pathCost(p, route);
    if (cost === null) return { correct: false, feedback: "Two consecutive stops on your route aren't connected." };
    if (p.ask === "any" || Math.abs(cost - s.cost) < 1e-9) return { correct: true, feedback: `Route accepted: ${trimNumber(cost)} ${p.costName}.` };
    return { correct: false, feedback: `Your route costs ${trimNumber(cost)} ${p.costName}; a cheaper one exists. Fewer hops isn't cheaper when a single edge is expensive: add up the weights, not the stops.` };
  },
  solutionInput: (_p, s) => ({ path: s.path }),
});
