import { z } from "zod";
import { defineMode } from "../../types";
import { seededShuffle } from "../../util";
import { matchesAny } from "./fuzzy";

/*
 * recall · rapid: retrieval practice. Items appear one by one; the player types the answer; cooldowns
 * between repeats follow spacing intervals (the widget schedules repeats of missed items at 1, 3, 7 items
 * later; grading counts an item as known when its last attempt was correct). Card: rune_recall ★.
 */

const Item = z.object({
  prompt: z.string().describe("What is shown, e.g. the word in the other language or the definition"),
  answers: z.array(z.string()).min(1).max(6).describe("Accepted answers; the first is canonical. Spelling is fuzzy-matched"),
  hint: z.string().describe("A nudge shown after a miss, under 80 characters; must not contain the answer"),
});

const Params = z.object({
  items: z.array(Item).min(3).max(12).describe("The flashcards, in a sensible teaching order"),
  secondsPerItem: z.number().int().min(3).max(30).describe("Time the player has per item"),
  direction: z.string().describe('Label for the task, e.g. "Spanish → English" or "term → definition"'),
});
type Params = z.infer<typeof Params>;

interface Solution {
  canonical: string[];
}
interface Input {
  /** last attempt per item index, in item order (missing = never answered) */
  answers: { itemIndex: number; text: string }[];
}
interface View {
  direction: string;
  secondsPerItem: number;
  /** shuffled order of item indices for the first pass; repeats are scheduled by the widget */
  order: number[];
  prompts: { itemIndex: number; prompt: string }[];
}

function solve(p: Params): Solution {
  return { canonical: p.items.map((it) => it.answers[0]) };
}

export const rapid = defineMode({
  id: "rapid",
  name: "Rapid recall",
  implemented: true,
  blindSolvable: true,
  widget: "type",
  knowledgeTypes: ["fact"],
  directorBlurb: "Flashcards under time pressure: type the answer; missed items come back on a spacing schedule. Vocabulary, terms, formulas, dates.",
  authoringGuide: [
    "3-12 items. List every accepted spelling/synonym in answers (first = canonical). Keep prompts unambiguous: one right answer per prompt.",
    "Hints nudge (first letter, category, a related word) without containing the answer.",
    "Placeholders: {{count}}, {{direction}}, {{first}} (the first item's canonical answer: last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const prompts = p.items.map((it) => it.prompt.trim().toLowerCase());
    if (new Set(prompts).size !== prompts.length) problems.push("item prompts must be distinct");
    p.items.forEach((it, i) => {
      if (!it.prompt.trim()) problems.push(`items[${i}].prompt is empty`);
      if (it.answers.some((a) => !a.trim())) problems.push(`items[${i}] has an empty answer`);
      if (it.hint.length > 100) problems.push(`items[${i}].hint is too long; keep it under 80 characters`);
      if (it.answers.some((a) => matchesAny(it.hint, [a]) || it.hint.toLowerCase().includes(a.toLowerCase()))) problems.push(`items[${i}].hint contains the answer`);
    });
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { count: String(p.items.length), direction: p.direction, first: s.canonical[0] };
  },
  answerVars: ["first"],
  present(p, seed): View {
    const order = seededShuffle(
      p.items.map((_, i) => i),
      seed,
    );
    return { direction: p.direction, secondsPerItem: p.secondsPerItem, order, prompts: p.items.map((it, itemIndex) => ({ itemIndex, prompt: it.prompt })) };
  },
  grade(p, input: Input) {
    const last = new Map<number, string>();
    for (const a of input.answers ?? []) last.set(a.itemIndex, a.text);
    const missed = p.items.map((it, i) => ({ it, i })).filter(({ it, i }) => !matchesAny(last.get(i) ?? "", it.answers));
    if (missed.length === 0) return { correct: true, feedback: `All ${p.items.length} recalled.` };
    const m = missed[0];
    return { correct: false, feedback: `${missed.length} of ${p.items.length} still missing. For "${m.it.prompt}": ${m.it.hint}` };
  },
  solutionInput: (_p, s) => ({ answers: s.canonical.map((text, itemIndex) => ({ itemIndex, text })) }),
  blind: {
    schema: z.object({ answers: z.array(z.string()).min(3).max(12).describe("One answer per prompt, in the order the prompts are listed") }),
    describe: (p, view: View) => `${view.direction}. Prompts:\n${view.prompts.map((x) => `${x.itemIndex}. ${x.prompt}`).join("\n")}`,
    toInput: (_p, view: View, out) => ({ answers: (out as { answers: string[] }).answers.map((text, i) => ({ itemIndex: view.prompts[i]?.itemIndex ?? i, text })) }),
  },
});
