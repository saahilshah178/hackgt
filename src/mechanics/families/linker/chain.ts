import { z } from "zod";
import { defineMode } from "../../types";
import { shuffleNotIdentity } from "../../util";

/* linker · chain: nodes in causal order (each links to the next), plus 0-2 decoy nodes. */

const Params = z.object({
  nodes: z
    .array(z.string().describe("One node in the chain, under 90 characters"))
    .min(3)
    .max(7)
    .describe("The chain IN CAUSAL ORDER. The game shuffles them for display; never shuffle them yourself"),
  decoys: z
    .array(z.string())
    .min(0)
    .max(2)
    .describe("0-2 plausible nodes that do NOT belong in the chain (use an empty array for none)"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  edges: { from: string; to: string }[]; // consecutive pairs, keys n0..nN
}
interface Input {
  edges: { fromKey: string; toKey: string }[];
}
interface View {
  nodes: { key: string; text: string }[];
  edgeCount: number;
}

const nodeKey = (i: number) => `n${i}`;
const decoyKey = (i: number) => `d${i}`;

function solve(p: Params): Solution {
  const edges: { from: string; to: string }[] = [];
  for (let i = 0; i < p.nodes.length - 1; i++) edges.push({ from: nodeKey(i), to: nodeKey(i + 1) });
  return { edges };
}

function textForKey(p: Params, key: string): string {
  const i = Number(key.slice(1));
  return key.startsWith("d") ? (p.decoys[i] ?? key) : (p.nodes[i] ?? key);
}

function edgeSetEquals(a: { from: string; to: string }[], b: { fromKey: string; toKey: string }[]): boolean {
  if (a.length !== b.length) return false;
  const norm = (from: string, to: string) => `${from}->${to}`;
  const setA = new Set(a.map((e) => norm(e.from, e.to)));
  const setB = new Set(b.map((e) => norm(e.fromKey, e.toKey)));
  if (setA.size !== setB.size) return false;
  for (const e of setA) if (!setB.has(e)) return false;
  return true;
}

export const chain = defineMode({
  id: "chain",
  name: "Chain",
  implemented: true,
  blindSolvable: true,
  widget: "link",
  knowledgeTypes: ["causal", "sequence"],
  directorBlurb:
    "The player links nodes into a causal chain, cause to effect to next effect. 3-7 nodes plus optional decoys that don't belong.",
  authoringGuide: [
    "List the nodes in their true causal order; the game shuffles them for display.",
    "Add 0-2 decoy nodes: plausible-sounding events or causes that don't belong in this chain.",
    "Each node should follow clearly from the one before it, with no ambiguous alternate orderings.",
    "Placeholders available: {{nodeCount}}.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const norm = (s: string) => s.trim().toLowerCase();
    const all = [...p.nodes, ...p.decoys].map(norm);
    if (new Set(all).size !== all.length) problems.push("nodes and decoys must all be distinct");
    return problems;
  },
  resolve: solve,
  templateVars(p) {
    return { nodeCount: String(p.nodes.length) };
  },
  answerVars: [],
  present(p, seed): View {
    const nodes = [
      ...p.nodes.map((text, i) => ({ key: nodeKey(i), text })),
      ...p.decoys.map((text, i) => ({ key: decoyKey(i), text })),
    ];
    return { nodes: shuffleNotIdentity(nodes, seed), edgeCount: p.nodes.length - 1 };
  },
  grade(p, input: Input) {
    const { edges } = solve(p);
    if (edgeSetEquals(edges, input.edges)) return { correct: true, feedback: "The chain topples through to the end." };
    const decoyEdge = input.edges.find((e) => e.fromKey.startsWith("d") || e.toKey.startsWith("d"));
    if (decoyEdge) {
      const badKey = decoyEdge.fromKey.startsWith("d") ? decoyEdge.fromKey : decoyEdge.toKey;
      return { correct: false, feedback: `"${textForKey(p, badKey)}" isn't part of this chain.` };
    }
    const given = new Map(input.edges.map((e) => [e.fromKey, e.toKey]));
    const wrongFrom = edges.find((e) => given.get(e.from) !== e.to);
    if (wrongFrom) {
      return {
        correct: false,
        feedback: `What does "${textForKey(p, wrongFrom.from)}" actually lead to?`,
      };
    }
    return { correct: false, feedback: "Link every node to what it actually causes, in order." };
  },
  solutionInput: (_p, s) => ({
    edges: s.edges.map((e) => ({ fromKey: e.from, toKey: e.to })),
  }),
  blind: {
    schema: z.object({
      edges: z
        .array(
          z.object({
            from: z.number().int().min(0).max(8).describe("Position (0-based) of the node shown"),
            to: z.number().int().min(0).max(8).describe("Position (0-based) of the node it leads to"),
          }),
        )
        .min(2)
        .max(6),
    }),
    describe: (_p, view: View) => `Nodes shown:\n${view.nodes.map((n, i) => `${i}. ${n.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => {
      const o = out as { edges: { from: number; to: number }[] };
      return {
        edges: o.edges.map((e) => ({
          fromKey: view.nodes[e.from]?.key ?? "?",
          toKey: view.nodes[e.to]?.key ?? "?",
        })),
      };
    },
  },
});
