import { z } from "zod";
import { defineMode } from "../../types";
import { seededShuffle } from "../../util";
import { matchesAny } from "./fuzzy";

/*
 * recall · cloze: fill the blank in a source sentence. The sentence contains exactly one "___".
 * Cards: context_reconstruction, context_clues, guard_dialogue.
 */

const Params = z.object({
  sentence: z.string().describe('The source sentence with exactly one blank written as "___", e.g. "Water moves toward the side with the higher ___ concentration."'),
  answers: z.array(z.string()).min(1).max(6).describe("Accepted fillers; the first is canonical (the word from the source)"),
  wordBank: z.array(z.string()).min(0).max(5).describe("0-5 wrong fillers shown as a word bank with the answer; empty for free typing"),
  hint: z.string().describe("A nudge shown after a miss, under 100 characters; must not contain the answer"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  answer: string;
}
interface Input {
  text: string;
}
interface View {
  before: string;
  after: string;
  /** the word bank (answer + wrong fillers) shuffled, or [] for free typing */
  bank: string[];
}

function parts(p: Params): { before: string; after: string } {
  const i = p.sentence.indexOf("___");
  return { before: p.sentence.slice(0, i).trimEnd(), after: p.sentence.slice(i + 3).trimStart() };
}

export const cloze = defineMode({
  id: "cloze",
  name: "Cloze",
  implemented: true,
  blindSolvable: true,
  widget: "type",
  knowledgeTypes: ["fact", "category"],
  directorBlurb: "Fill the blank in a sentence taken from the source; the surrounding words carry the clue. Vocabulary in context, key terms, period language.",
  authoringGuide: [
    'Copy a real sentence from the facts and blank exactly one word or short phrase with "___". The context must make the blank recoverable.',
    "answers lists accepted fillers (first = the source word). Use wordBank for 2-4 tempting wrong fillers when the concept is choosing the right term.",
    "Placeholders: {{sentence}} (with the blank, safe), {{answer}} (last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const blanks = p.sentence.split("___").length - 1;
    if (blanks !== 1) problems.push(`the sentence must contain exactly one "___" blank (found ${blanks})`);
    if (p.answers.some((a) => !a.trim())) problems.push("answers must not be empty");
    if (p.answers.some((a) => p.hint.toLowerCase().includes(a.toLowerCase()))) problems.push("the hint contains the answer");
    if (p.wordBank.some((w) => matchesAny(w, p.answers))) problems.push("wordBank must not contain an accepted answer");
    if (p.hint.length > 120) problems.push("hint is too long; keep it under 100 characters");
    return problems;
  },
  resolve: (p) => ({ answer: p.answers[0] }),
  templateVars(p, s) {
    return { sentence: p.sentence, answer: s.answer };
  },
  answerVars: ["answer"],
  present(p, seed): View {
    const { before, after } = parts(p);
    const bank = p.wordBank.length > 0 ? seededShuffle([p.answers[0], ...p.wordBank], seed) : [];
    return { before, after, bank };
  },
  grade(p, input: Input) {
    if (matchesAny(input.text ?? "", p.answers)) return { correct: true, feedback: "That is the word the source uses." };
    return { correct: false, feedback: `Not that one. ${p.hint}` };
  },
  solutionInput: (_p, s) => ({ text: s.answer }),
  blind: {
    schema: z.object({ text: z.string().describe("The word or phrase that fills the blank") }),
    describe: (_p, view: View) => `${view.before} ___ ${view.after}${view.bank.length ? `\nWord bank: ${view.bank.join(", ")}` : ""}`,
    toInput: (_p, _view: View, out) => ({ text: (out as { text: string }).text }),
  },
});
