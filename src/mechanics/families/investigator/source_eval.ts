import { z } from "zod";
import { defineMode } from "../../types";
import { shuffleNotIdentity } from "../../util";

/* investigator · source_eval: rank sources by provenance cues. Cards: source_seer, unreliable_narrator. */

const Params = z.object({
  question: z.string().describe("What the sources are evidence about"),
  sources: z
    .array(z.object({ text: z.string().describe("the source, under 140 characters"), reliability: z.number().int().min(1).max(5).describe("1 (least) to 5 (most) reliable for this question; all distinct"), cues: z.string().describe("the provenance cues that justify its rank (author, timing, incentive, corroboration), under 160 characters") }))
    .min(3)
    .max(5),
});
type Params = z.infer<typeof Params>;

interface Solution {
  order: string[]; // most reliable first
}
interface Input {
  keys: string[];
}
interface View {
  question: string;
  slots: number;
  sources: { key: string; text: string }[];
}

const solve = (p: Params): Solution => ({ order: p.sources.map((s, i) => ({ key: `s${i}`, r: s.reliability })).sort((a, b) => b.r - a.r).map((x) => x.key) });

export const sourceEval = defineMode({
  id: "source_eval",
  name: "Source evaluation",
  implemented: true,
  blindSolvable: true,
  widget: "order",
  knowledgeTypes: ["argument"],
  directorBlurb: "Rank sources by provenance: who made it, when, with what incentive, and whether others corroborate it. Reliability, eyewitness bias, unreliable narrators.",
  authoringGuide: [
    "3-5 sources about one question with distinct reliability scores; include an eyewitness with an incentive to mislead and a later secondary source that corroborates.",
    "The cues sentence is what the player sees after a miss, so make it teach the rule (timing, incentive, corroboration).",
    "Placeholders: {{question}} (safe), {{best}} (the most reliable source: last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const rs = p.sources.map((s) => s.reliability);
    if (new Set(rs).size !== rs.length) problems.push("reliability scores must be distinct");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { question: p.question, best: p.sources[Number(s.order[0].slice(1))]?.text ?? "" };
  },
  answerVars: ["best"],
  present(p, seed): View {
    return { question: p.question, slots: p.sources.length, sources: shuffleNotIdentity(p.sources.map((s, i) => ({ key: `s${i}`, text: s.text })), seed) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if ((input.keys ?? []).length !== s.order.length) return { correct: false, feedback: `Rank all ${s.order.length} sources, most reliable first.` };
    const wrongAt = input.keys.findIndex((k, i) => k !== s.order[i]);
    if (wrongAt === -1) return { correct: true, feedback: "That ranking follows the provenance cues." };
    const placed = p.sources[Number(input.keys[wrongAt].slice(1))];
    return { correct: false, feedback: `Slot ${wrongAt + 1} is off. About "${placed?.text}": ${placed?.cues}` };
  },
  solutionInput: (_p, s) => ({ keys: s.order }),
  blind: {
    schema: z.object({ order: z.array(z.number().int().min(0).max(4)).min(3).max(5).describe("Positions (0-based) of the sources shown, most reliable first") }),
    describe: (_p, view: View) => `${view.question}\nSources:\n${view.sources.map((s, i) => `${i}. ${s.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => ({ keys: (out as { order: number[] }).order.map((i) => view.sources[i]?.key ?? "?") }),
  },
});
