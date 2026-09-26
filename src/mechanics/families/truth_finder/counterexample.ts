import { z } from "zod";
import { defineMode } from "../../types";
import { shuffleNotIdentity } from "../../util";

/* truth_finder · counterexample: pick the case that breaks the rule. Cards: syllogism_gate, contract_elements. */

const Params = z.object({
  rule: z.string().describe("The claim to test, under 160 characters, e.g. 'Every promise is a contract'"),
  cases: z
    .array(z.object({ text: z.string().describe("A concrete case, under 140 characters"), breaksRule: z.boolean(), explanation: z.string().describe("why it does or doesn't break the rule, under 160 characters") }))
    .min(3)
    .max(5)
    .describe("Exactly one case breaks the rule; the others satisfy it"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  breakerIndex: number;
}
interface Input {
  caseIndex: number;
}
interface View {
  rule: string;
  cases: { caseIndex: number; text: string }[];
}

const solve = (p: Params): Solution => ({ breakerIndex: p.cases.findIndex((c) => c.breaksRule) });

export const counterexample = defineMode({
  id: "counterexample",
  name: "Counterexample",
  implemented: true,
  blindSolvable: true,
  widget: "pick",
  knowledgeTypes: ["argument", "category"],
  directorBlurb: "A rule and several cases; exactly one case breaks the rule and the player must find it. Validity, definitions with necessary conditions, overgeneralizations.",
  authoringGuide: [
    "State the rule as a student would over-believe it. Write 3-5 concrete cases; exactly one violates the rule for a reason tied to a listed misconception.",
    "Make the satisfying cases tempting (superficially unusual) and the breaker superficially ordinary.",
    "Placeholders: {{rule}} (safe), {{counterexample}} (the answer: last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const n = p.cases.filter((c) => c.breaksRule).length;
    if (n !== 1) problems.push(`exactly one case must break the rule (found ${n})`);
    const texts = p.cases.map((c) => c.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) problems.push("cases must be distinct");
    p.cases.forEach((c, i) => {
      if (c.text.length > 160) problems.push(`cases[${i}].text is too long; keep it under 140 characters`);
    });
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { rule: p.rule, counterexample: p.cases[s.breakerIndex]?.text ?? "" };
  },
  answerVars: ["counterexample"],
  present(p, seed): View {
    return { rule: p.rule, cases: shuffleNotIdentity(p.cases.map((c, caseIndex) => ({ caseIndex, text: c.text })), seed) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if (input.caseIndex === s.breakerIndex) return { correct: true, feedback: `That case breaks the rule: ${p.cases[s.breakerIndex].explanation}` };
    const picked = p.cases[input.caseIndex];
    if (!picked) return { correct: false, feedback: "Pick one of the cases." };
    return { correct: false, feedback: `That case actually satisfies the rule: ${picked.explanation} Look for the case where a required condition is missing.` };
  },
  solutionInput: (_p, s) => ({ caseIndex: s.breakerIndex }),
  blind: {
    schema: z.object({ case: z.number().int().min(0).max(4).describe("0-based position of the case that breaks the rule"), why: z.string() }),
    describe: (_p, view: View) => `Rule: ${view.rule}\nCases:\n${view.cases.map((c, i) => `${i}. ${c.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => ({ caseIndex: view.cases[(out as { case: number }).case]?.caseIndex ?? -1 }),
  },
});
