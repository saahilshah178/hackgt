import { z } from "zod";
import { defineMode } from "../../types";
import { shuffleNotIdentity } from "../../util";

/* truth_finder · mimic: exactly one false claim, built from a misconception. The universal fallback. */

const Statement = z.object({
  text: z.string().describe("A claim about the concept, under 120 characters"),
  isTrue: z.boolean(),
  explanation: z.string().describe("Why the claim is true or false, under 160 characters; shown after the pick"),
});

const Params = z.object({
  statements: z
    .array(Statement)
    .min(3)
    .max(4)
    .describe("3-4 claims. EXACTLY ONE is false: that chest is the mimic. Build it from a real misconception"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  mimicIndex: number;
}
interface Input {
  statementIndex: number;
}
interface View {
  chests: { statementIndex: number; text: string }[];
}

function solve(p: Params): Solution {
  return { mimicIndex: p.statements.findIndex((s) => !s.isTrue) };
}

export const mimic = defineMode({
  id: "mimic",
  name: "Mimic",
  implemented: true,
  blindSolvable: true,
  widget: "pick",
  knowledgeTypes: ["fact", "category", "quantitative", "causal", "argument", "procedure", "sequence", "spatial", "system"],
  directorBlurb:
    "Several claims, exactly one false (built from a misconception); the player exposes the lie. Works for any concept; the universal fallback.",
  authoringGuide: [
    "Write the false claim from one of the concept's listed misconceptions.",
    "Make the true claims similar in length and tone to the false one: length is a giveaway.",
    "{{mimic}} (the false claim's text) is the answer: use it only in the last hint and the debrief line.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const falseCount = p.statements.filter((s) => !s.isTrue).length;
    if (falseCount !== 1) problems.push(`exactly one statement must be false (found ${falseCount})`);
    const texts = p.statements.map((s) => s.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) problems.push("statements must be distinct");
    p.statements.forEach((s, i) => {
      if (s.text.length > 140) problems.push(`statements[${i}].text is ${s.text.length} chars; keep it under 140`);
      if (s.explanation.length > 200) problems.push(`statements[${i}].explanation is too long; keep it under 200 chars`);
    });
    if (falseCount === 1) {
      const lie = p.statements.find((s) => !s.isTrue)!;
      const truths = p.statements.filter((s) => s.isTrue);
      const avg = truths.reduce((n, s) => n + s.text.length, 0) / Math.max(1, truths.length);
      if (lie.text.length > avg * 1.8 || lie.text.length < avg * 0.55) {
        problems.push("the false claim's length stands out from the others; make the lengths similar");
      }
    }
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { mimic: p.statements[s.mimicIndex]?.text ?? "" };
  },
  answerVars: ["mimic"],
  present(p, seed): View {
    const chests = p.statements.map((s, statementIndex) => ({ statementIndex, text: s.text }));
    return { chests: shuffleNotIdentity(chests, seed) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if (input.statementIndex === s.mimicIndex) {
      return { correct: true, feedback: `Mimic exposed. ${p.statements[s.mimicIndex].explanation}` };
    }
    const picked = p.statements[input.statementIndex];
    return {
      correct: false,
      feedback: picked ? `That chest was honest: ${picked.explanation}` : "Pick one of the chests.",
    };
  },
  solutionInput: (_p, s) => ({ statementIndex: s.mimicIndex }),
  blind: {
    schema: z.object({
      chest: z.number().int().min(0).max(3).describe("Position (0-based) of the FALSE claim in the list shown"),
      why: z.string().describe("One sentence"),
    }),
    describe: (_p, view: View) => view.chests.map((c, i) => `${i}. ${c.text}`).join("\n"),
    toInput: (_p, view: View, out) => {
      const o = out as { chest: number };
      return { statementIndex: view.chests[o.chest]?.statementIndex ?? -1 };
    },
  },
});
