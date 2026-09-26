import { z } from "zod";
import { defineMode } from "../../types";
import { shuffleNotIdentity } from "../../util";

/* investigator · elimination: a hypotheses x clues matrix. Exactly one hypothesis survives every clue. */

const Hypothesis = z.object({
  id: z.string().describe("snake_case id for this hypothesis"),
  text: z.string().describe("The hypothesis, under 140 characters"),
});

const Clue = z.object({
  text: z.string().describe("The clue, under 160 characters"),
  eliminates: z
    .array(z.string())
    .min(0)
    .max(5)
    .describe("Ids of hypotheses this clue rules out (use an empty array if it rules none out)"),
});

const Params = z.object({
  question: z.string().describe("The question being investigated, under 160 characters"),
  hypotheses: z.array(Hypothesis).min(3).max(5).describe("3-5 candidate explanations, exactly one of which survives every clue"),
  clues: z.array(Clue).min(2).max(6).describe("2-6 clues, revealed in order, each ruling out at least one hypothesis"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  survivorId: string;
  eliminatedBy: Record<string, number>; // hypothesisId -> clue index that eliminates it
}
interface Input {
  hypothesisId: string;
}
interface View {
  question: string;
  hypotheses: { id: string; text: string }[];
  clues: { index: number; text: string }[];
}

const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;

function solve(p: Params): Solution {
  const eliminatedBy: Record<string, number> = {};
  p.clues.forEach((clue, i) => {
    for (const id of clue.eliminates) {
      if (!(id in eliminatedBy)) eliminatedBy[id] = i;
    }
  });
  const survivors = p.hypotheses.filter((h) => !(h.id in eliminatedBy));
  return { survivorId: survivors[0]?.id ?? "", eliminatedBy };
}

export const elimination = defineMode({
  id: "elimination",
  name: "Elimination",
  implemented: true,
  blindSolvable: true,
  widget: "link",
  knowledgeTypes: ["argument", "causal"],
  directorBlurb:
    "A hypotheses x clues matrix: the player reads each clue and eliminates hypotheses until exactly one survives. Inference from evidence.",
  authoringGuide: [
    "Write 3-5 hypotheses with short snake_case ids, and a question that frames what's being investigated.",
    "Write 2-6 clues, each listing the hypothesis ids it rules out (an empty array if it rules none out).",
    "Together the clues must eliminate every hypothesis except exactly one; that one is the answer.",
    "Placeholders available: {{survivor}} (the surviving hypothesis's text); keep it out of the prompt and first hint.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const ids = p.hypotheses.map((h) => h.id);
    ids.forEach((id, i) => {
      if (!SNAKE_CASE.test(id)) problems.push(`hypotheses[${i}].id "${id}" must be lowercase snake_case`);
    });
    if (new Set(ids).size !== ids.length) problems.push("hypothesis ids must be unique");
    p.clues.forEach((clue, i) => {
      clue.eliminates.forEach((id) => {
        if (!ids.includes(id)) problems.push(`clues[${i}].eliminates references unknown hypothesis id "${id}"`);
      });
    });
    const eliminated = new Set(p.clues.flatMap((c) => c.eliminates));
    const survivors = ids.filter((id) => !eliminated.has(id));
    if (survivors.length !== 1) {
      problems.push(`exactly one hypothesis must survive every clue (found ${survivors.length}: ${survivors.join(", ") || "none"})`);
    }
    const usedClues = new Set(p.clues.flatMap((c, i) => (c.eliminates.length > 0 ? [i] : [])));
    p.clues.forEach((clue, i) => {
      if (!usedClues.has(i)) problems.push(`clues[${i}] eliminates no hypothesis; every clue must rule at least one out`);
    });
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { survivor: p.hypotheses.find((h) => h.id === s.survivorId)?.text ?? "" };
  },
  answerVars: ["survivor"],
  present(p, seed): View {
    const hyps = p.hypotheses.map((h) => ({ id: h.id, text: h.text }));
    return {
      question: p.question,
      hypotheses: shuffleNotIdentity(hyps, seed),
      clues: p.clues.map((c, index) => ({ index, text: c.text })),
    };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if (input.hypothesisId === s.survivorId) {
      return { correct: true, feedback: "Every rival hypothesis is ruled out. This one stands." };
    }
    const clueIndex = s.eliminatedBy[input.hypothesisId];
    const hyp = p.hypotheses.find((h) => h.id === input.hypothesisId);
    if (clueIndex === undefined) {
      return { correct: false, feedback: hyp ? `Check "${hyp.text}" against each clue again.` : "Pick one of the hypotheses." };
    }
    return {
      correct: false,
      feedback: `"${hyp?.text ?? input.hypothesisId}" is ruled out: "${p.clues[clueIndex].text}"`,
    };
  },
  solutionInput: (_p, s) => ({ hypothesisId: s.survivorId }),
  blind: {
    schema: z.object({
      hypothesis: z.number().int().min(0).max(4).describe("Position (0-based) of the surviving hypothesis, in the order shown"),
      why: z.string().describe("One sentence"),
    }),
    describe: (_p, view: View) =>
      `${view.question}\nHypotheses:\n${view.hypotheses.map((h, i) => `${i}. ${h.text}`).join("\n")}\nClues:\n${view.clues.map((c) => `${c.index}. ${c.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => {
      const o = out as { hypothesis: number };
      return { hypothesisId: view.hypotheses[o.hypothesis]?.id ?? "?" };
    },
  },
});
