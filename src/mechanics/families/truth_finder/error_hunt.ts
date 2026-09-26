import { z } from "zod";
import { defineMode } from "../../types";

/* truth_finder · error_hunt: a worked solution, proof, or code with exactly one wrong line. Cards: bug_hunter, grammar_trap. */

const Params = z.object({
  title: z.string().describe('What the lines are, e.g. "a worked solution of 2x + 3 = 11" or "a Python function"'),
  lines: z
    .array(z.object({ text: z.string().describe("one line, under 100 characters"), isWrong: z.boolean(), explanation: z.string().describe("why this line is right or wrong, under 160 characters") }))
    .min(3)
    .max(10)
    .describe("The lines IN ORDER. Exactly one has isWrong true"),
  fixedLine: z.string().describe("The corrected version of the wrong line, shown after the pick"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  wrongIndex: number;
}
interface Input {
  lineIndex: number;
}
interface View {
  title: string;
  lines: { lineIndex: number; text: string }[];
}

const solve = (p: Params): Solution => ({ wrongIndex: p.lines.findIndex((l) => l.isWrong) });

export const errorHunt = defineMode({
  id: "error_hunt",
  name: "Error hunt",
  implemented: true,
  blindSolvable: true,
  widget: "pick",
  knowledgeTypes: ["procedure"],
  directorBlurb: "A worked solution, proof, or program with exactly one wrong line; the player strikes it. Debugging, grammar, algebra steps, proofs.",
  authoringGuide: [
    "Write the lines in their real order (they are never shuffled). Make exactly one wrong, in a way that comes from a listed misconception; the other lines must each follow correctly from the previous one.",
    "Keep the wrong line plausible: the error should be in the reasoning, not a typo.",
    "Placeholders: {{lineCount}}, {{wrongLine}} (the answer: last hint and debrief only), {{fixedLine}} (also an answer).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const wrong = p.lines.filter((l) => l.isWrong).length;
    if (wrong !== 1) problems.push(`exactly one line must have isWrong true (found ${wrong})`);
    p.lines.forEach((l, i) => {
      if (!l.text.trim()) problems.push(`lines[${i}].text is empty`);
      if (l.text.length > 120) problems.push(`lines[${i}].text is ${l.text.length} chars; keep lines under 100`);
    });
    if (!p.fixedLine.trim()) problems.push("fixedLine is empty");
    if (wrong === 1 && p.fixedLine.trim() === p.lines.find((l) => l.isWrong)!.text.trim()) problems.push("fixedLine must differ from the wrong line");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { lineCount: String(p.lines.length), wrongLine: p.lines[s.wrongIndex]?.text ?? "", fixedLine: p.fixedLine };
  },
  answerVars: ["wrongLine", "fixedLine"],
  present(p): View {
    return { title: p.title, lines: p.lines.map((l, lineIndex) => ({ lineIndex, text: l.text })) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if (input.lineIndex === s.wrongIndex) return { correct: true, feedback: `Found it. ${p.lines[s.wrongIndex].explanation} Fixed: ${p.fixedLine}` };
    const picked = p.lines[input.lineIndex];
    if (!picked) return { correct: false, feedback: "Pick one of the lines." };
    return { correct: false, feedback: `Line ${input.lineIndex + 1} is fine: ${picked.explanation} Check each line against the one before it.` };
  },
  solutionInput: (_p, s) => ({ lineIndex: s.wrongIndex }),
  blind: {
    schema: z.object({ line: z.number().int().min(0).max(9).describe("0-based index of the wrong line"), why: z.string() }),
    describe: (_p, view: View) => `${view.title}\n${view.lines.map((l) => `${l.lineIndex}. ${l.text}`).join("\n")}`,
    toInput: (_p, _view: View, out) => ({ lineIndex: (out as { line: number }).line }),
  },
});
