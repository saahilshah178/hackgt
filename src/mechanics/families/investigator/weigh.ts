import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, seededShuffle } from "../../util";

/* investigator · weigh: allocate importance among causes; graded on rank order against the source. Card: causal_weighting. */

const Params = z.object({
  question: z.string().describe('e.g. "What caused the Voting Rights Act to pass in 1965?"'),
  causes: z
    .array(z.object({ text: z.string(), weight: z.string().describe("exact relative importance per the source, e.g. \"5\"; all distinct"), why: z.string().describe("the source's reason for this ranking, under 160 characters") }))
    .min(3)
    .max(5),
});
type Params = z.infer<typeof Params>;

interface Solution {
  ranking: string[]; // cause keys, most important first
}
interface Input {
  weights: { causeKey: string; value: number }[];
}
interface View {
  question: string;
  causes: { key: string; text: string }[];
  total: number;
}

function solve(p: Params): Solution {
  const order = p.causes.map((c, i) => ({ key: `c${i}`, w: evalExact(c.weight) ?? 0 })).sort((a, b) => b.w - a.w);
  return { ranking: order.map((o) => o.key) };
}

export const weigh = defineMode({
  id: "weigh",
  name: "Weigh",
  implemented: true,
  blindSolvable: true,
  widget: "dial",
  knowledgeTypes: ["causal", "argument"],
  directorBlurb: "Allocate importance among competing causes; the explanation shifts with the weights. Graded on rank order against the source. Multi-causal explanations, competing interpretations.",
  authoringGuide: [
    "List 3-5 causes with distinct source-based weights (the numbers are relative importance, not percentages) and one sentence of reasoning each.",
    "Include at least one cause that students over-rate (a famous but minor factor) so the ranking teaches something.",
    "Placeholders: {{question}} (safe), {{top}} (the most important cause: last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const ws = p.causes.map((c) => evalExact(c.weight));
    if (ws.some((w) => w === null || w <= 0)) problems.push("every weight must be a positive exact number");
    else if (new Set(ws).size !== ws.length) problems.push("weights must be distinct so the ranking is unambiguous");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { question: p.question, top: p.causes[Number(s.ranking[0].slice(1))]?.text ?? "" };
  },
  answerVars: ["top"],
  present(p, seed): View {
    return { question: p.question, causes: seededShuffle(p.causes.map((c, i) => ({ key: `c${i}`, text: c.text })), seed), total: 100 };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const given = new Map((input.weights ?? []).map((w) => [w.causeKey, w.value]));
    if (s.ranking.some((k) => !given.has(k))) return { correct: false, feedback: "Give every cause a weight." };
    const mine = [...s.ranking].sort((a, b) => (given.get(b) ?? 0) - (given.get(a) ?? 0));
    const vals = mine.map((k) => given.get(k) ?? 0);
    if (new Set(vals).size !== vals.length) return { correct: false, feedback: "Two causes have the same weight; decide which mattered more." };
    const wrongAt = mine.findIndex((k, i) => k !== s.ranking[i]);
    if (wrongAt === -1) return { correct: true, feedback: "That ranking matches the evidence." };
    const over = p.causes[Number(mine[wrongAt].slice(1))];
    const should = p.causes[Number(s.ranking[wrongAt].slice(1))];
    return { correct: false, feedback: `You ranked "${over.text}" at #${wrongAt + 1}, above a cause the source weighs more heavily. ${should.why}` };
  },
  solutionInput: (_p, s) => ({ weights: s.ranking.map((causeKey, i) => ({ causeKey, value: 100 - i * 10 })) }),
  blind: {
    schema: z.object({ ranking: z.array(z.number().int().min(0).max(4)).min(3).max(5).describe("Positions (0-based) of the causes shown, most important first") }),
    describe: (p, view: View) => `${view.question}\nCauses:\n${view.causes.map((c, i) => `${i}. ${c.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => ({ weights: (out as { ranking: number[] }).ranking.map((pos, i) => ({ causeKey: view.causes[pos]?.key ?? "?", value: 100 - i * 10 })) }),
  },
});
