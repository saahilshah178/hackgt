import { z } from "zod";
import { defineMode } from "../../types";
import { shuffleNotIdentity } from "../../util";

/* investigator · argument: a claim plus evidence cards, some weak, irrelevant, or opposing. Cards: counterevidence_attack, precedent_court, theme_evidence, argument_map, evidence_fit. */

const Params = z.object({
  claim: z.string().describe("The claim being argued, under 160 characters"),
  evidence: z
    .array(z.object({ text: z.string().describe("an evidence card, under 160 characters"), role: z.enum(["supports", "weak", "irrelevant", "counter"]), why: z.string().describe("why it plays that role, under 160 characters") }))
    .min(4)
    .max(8)
    .describe("At least 2 supporting cards, at least 1 counter card, and at least 1 weak or irrelevant card"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  supports: string[];
  counters: string[];
}
interface Input {
  supports: string[];
  counters: string[];
}
interface View {
  claim: string;
  cards: { key: string; text: string }[];
}

const solve = (p: Params): Solution => ({
  supports: p.evidence.map((e, i) => ({ e, k: `v${i}` })).filter((x) => x.e.role === "supports").map((x) => x.k),
  counters: p.evidence.map((e, i) => ({ e, k: `v${i}` })).filter((x) => x.e.role === "counter").map((x) => x.k),
});

export const argument = defineMode({
  id: "argument",
  name: "Argument",
  implemented: true,
  blindSolvable: true,
  widget: "link",
  knowledgeTypes: ["argument"],
  directorBlurb: "A claim and a pile of evidence cards: pin the ones that support it, flag the counter-evidence, leave out the weak and irrelevant. Argumentation, precedent, theme evidence, qualifying a claim.",
  authoringGuide: [
    "Write a claim worth arguing, 2-4 supporting cards, 1-2 counter cards that a strong argument must acknowledge, and 1-3 weak or irrelevant cards that merely mention the topic.",
    "The `why` sentence is the teaching feedback; make it name the standard (relevance, specificity, source).",
    "Placeholders: {{claim}} (safe), {{supportCount}}, {{counterCount}}.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const count = (r: string) => p.evidence.filter((e) => e.role === r).length;
    if (count("supports") < 2) problems.push("need at least 2 supporting cards");
    if (count("counter") < 1) problems.push("need at least 1 counter card");
    if (count("weak") + count("irrelevant") < 1) problems.push("need at least 1 weak or irrelevant card");
    const texts = p.evidence.map((e) => e.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) problems.push("evidence cards must be distinct");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { claim: p.claim, supportCount: String(s.supports.length), counterCount: String(s.counters.length) };
  },
  answerVars: [],
  present(p, seed): View {
    return { claim: p.claim, cards: shuffleNotIdentity(p.evidence.map((e, i) => ({ key: `v${i}`, text: e.text })), seed) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const sup = new Set(input.supports ?? []);
    const cnt = new Set(input.counters ?? []);
    const roleOf = (k: string) => p.evidence[Number(k.slice(1))];
    for (const k of sup) if (cnt.has(k)) return { correct: false, feedback: "A card can't both support and oppose the claim." };
    const misSupport = [...sup].find((k) => !s.supports.includes(k));
    if (misSupport) return { correct: false, feedback: `"${roleOf(misSupport).text}" doesn't support the claim. ${roleOf(misSupport).why}` };
    const missedSupport = s.supports.find((k) => !sup.has(k));
    if (missedSupport) return { correct: false, feedback: `You left out a card that supports the claim. Which card gives specific, relevant backing?` };
    const misCounter = [...cnt].find((k) => !s.counters.includes(k));
    if (misCounter) return { correct: false, feedback: `"${roleOf(misCounter).text}" isn't counter-evidence. ${roleOf(misCounter).why}` };
    const missedCounter = s.counters.find((k) => !cnt.has(k));
    if (missedCounter) return { correct: false, feedback: "A strong argument acknowledges the evidence against it. One card pushes the other way; flag it." };
    return { correct: true, feedback: "Supported, qualified, and free of filler: that's a defensible claim." };
  },
  solutionInput: (_p, s) => ({ supports: s.supports, counters: s.counters }),
  blind: {
    schema: z.object({ supports: z.array(z.number().int().min(0).max(7)).min(0).max(8), counters: z.array(z.number().int().min(0).max(7)).min(0).max(8) }).describe("Positions (0-based) of the cards that support the claim, and of the cards that count against it"),
    describe: (_p, view: View) => `Claim: ${view.claim}\nCards:\n${view.cards.map((c, i) => `${i}. ${c.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => {
      const o = out as { supports: number[]; counters: number[] };
      return { supports: o.supports.map((i) => view.cards[i]?.key ?? "?"), counters: o.counters.map((i) => view.cards[i]?.key ?? "?") };
    },
  },
});
