import { z } from "zod";
import { defineMode } from "../../types";
import { shuffleNotIdentity } from "../../util";

/*
 * truth_finder · predict_reveal: a scenario, 2-4 options with exactly one correct, and a reveal shown
 * after the pick (sourced from the text, or computed by a simulation). Cards: free_fall_drop,
 * frictionless_arena, disturb_the_reactor, weather_fronts, credit_card_trap, oracle_of_consequence, ...
 */

const Option = z.object({
  text: z.string().describe("One possible outcome, under 140 characters"),
  isCorrect: z.boolean(),
  explanation: z.string().describe("Why this outcome is right or wrong, under 200 characters; shown after the pick"),
});

const Params = z.object({
  scenario: z.string().describe("What is about to happen, under 200 characters"),
  options: z.array(Option).min(2).max(4).describe("2-4 options; EXACTLY ONE has isCorrect: true"),
  reveal: z.string().describe("What actually happens, shown after the pick, under 220 characters"),
  revealSource: z.enum(["sourced", "computed"]).describe("Whether reveal comes from the source text or from a computed simulation"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  correctIndex: number;
}
interface Input {
  optionIndex: number;
}
interface View {
  scenario: string;
  options: { optionIndex: number; text: string }[];
}

function solve(p: Params): Solution {
  return { correctIndex: p.options.findIndex((o) => o.isCorrect) };
}

export const predictReveal = defineMode({
  id: "predict_reveal",
  name: "Predict then reveal",
  implemented: true,
  blindSolvable: true,
  widget: "pick",
  knowledgeTypes: ["causal", "quantitative"],
  directorBlurb:
    "The player picks an outcome before a computed simulation or sourced reveal plays. Predictions about physical, chemical, or historical consequences.",
  authoringGuide: [
    "Write a scenario under 200 characters and 2-4 options with EXACTLY ONE isCorrect: true.",
    "Make the wrong options plausible misconceptions, not obviously silly.",
    "Write reveal as what actually happens; mark revealSource \"sourced\" when it comes from the text, \"computed\" when it's derived from a formula or simulation.",
    "{{correct}} (the correct option's text) is the answer: use it only in the last hint and the debrief line.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const correctCount = p.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) problems.push(`exactly one option must be isCorrect: true (found ${correctCount})`);
    const texts = p.options.map((o) => o.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) problems.push("options must be distinct");
    if (p.scenario.length > 220) problems.push(`scenario is ${p.scenario.length} chars; keep it under 200`);
    if (p.reveal.length > 260) problems.push(`reveal is ${p.reveal.length} chars; keep it under 220`);
    p.options.forEach((o, i) => {
      if (o.text.length > 160) problems.push(`options[${i}].text is ${o.text.length} chars; keep it under 140`);
      if (o.explanation.length > 220) problems.push(`options[${i}].explanation is ${o.explanation.length} chars; keep it under 200`);
    });
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { correct: p.options[s.correctIndex]?.text ?? "" };
  },
  answerVars: ["correct"],
  present(p, seed): View {
    const options = p.options.map((o, optionIndex) => ({ optionIndex, text: o.text }));
    return { scenario: p.scenario, options: shuffleNotIdentity(options, seed) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if (input.optionIndex === s.correctIndex) {
      return { correct: true, feedback: `${p.reveal} ${p.options[s.correctIndex].explanation}` };
    }
    const picked = p.options[input.optionIndex];
    return {
      correct: false,
      feedback: picked ? `${p.reveal} ${picked.explanation}` : "Pick one of the options.",
    };
  },
  solutionInput: (_p, s) => ({ optionIndex: s.correctIndex }),
  blind: {
    schema: z.object({
      option: z.number().int().min(0).max(3).describe("Position (0-based) of the predicted outcome in the list shown"),
      why: z.string().describe("One sentence"),
    }),
    describe: (p, view: View) => `${p.scenario}\nOptions:\n${view.options.map((o, i) => `${i}. ${o.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => {
      const o = out as { option: number };
      return { optionIndex: view.options[o.option]?.optionIndex ?? -1 };
    },
  },
});
