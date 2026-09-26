import { z } from "zod";
import { defineMode } from "../../types";

/* sorter · type_match: real-time bins. Waves appear in order (not shuffled); the player answers each with a category. */

const Category = z.object({
  id: z.string().describe("snake_case id for this category, e.g. 'hypertonic'"),
  label: z.string().describe("Shown on the category button, under 40 characters"),
});

const Wave = z.object({
  text: z.string().describe("The labeled enemy/item that appears, under 100 characters"),
  categoryId: z.string().describe("The id of the category this wave belongs to; must match one of categories[].id"),
  why: z.string().describe("Why this belongs to that category, under 140 characters"),
});

const Params = z.object({
  categories: z.array(Category).min(2).max(4).describe("2-4 categories the player answers with"),
  waves: z.array(Wave).min(4).max(10).describe("4-10 waves, IN THE ORDER they appear. Do not shuffle them yourself"),
  secondsPerWave: z.number().int().min(3).max(15).describe("Seconds the player has to answer each wave"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  answers: string[]; // categoryId per wave, in wave order
}
interface Input {
  answers: { waveIndex: number; categoryId: string }[];
}
interface View {
  categories: { id: string; label: string }[];
  waves: { waveIndex: number; text: string }[];
  secondsPerWave: number;
}

const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;

function solve(p: Params): Solution {
  return { answers: p.waves.map((w) => w.categoryId) };
}

export const type_match = defineMode({
  id: "type_match",
  name: "Type match",
  implemented: true,
  blindSolvable: true,
  widget: "pick",
  knowledgeTypes: ["category"],
  directorBlurb:
    "Real-time bins: a labeled enemy or item appears and the player answers with the right category before time runs out. The Zombie Division mechanic.",
  authoringGuide: [
    "Write 2-4 categories with short snake_case ids and labels.",
    "Write 4-10 waves IN THE ORDER they should appear; do not shuffle them, the widget presents them in order.",
    "Each wave's categoryId must match one of the categories' ids exactly.",
    "secondsPerWave should give enough time to reason, not just react (8-10s is typical).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const catIds = p.categories.map((c) => c.id);
    catIds.forEach((id, i) => {
      if (!SNAKE_CASE.test(id)) problems.push(`categories[${i}].id "${id}" must be lowercase snake_case`);
    });
    if (new Set(catIds).size !== catIds.length) problems.push("category ids must be unique");
    const texts = p.waves.map((w) => w.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) problems.push("wave texts must be distinct");
    const used = new Set<string>();
    p.waves.forEach((w, i) => {
      if (!catIds.includes(w.categoryId)) {
        problems.push(`waves[${i}].categoryId "${w.categoryId}" doesn't match any category id (${catIds.join(", ")})`);
      } else {
        used.add(w.categoryId);
      }
    });
    for (const id of catIds) {
      if (!used.has(id)) problems.push(`category "${id}" has no waves; every category needs at least one wave`);
    }
    return problems;
  },
  resolve: solve,
  templateVars(p) {
    return { categoryCount: String(p.categories.length), waveCount: String(p.waves.length) };
  },
  answerVars: [],
  present(p): View {
    return {
      categories: p.categories.map((c) => ({ id: c.id, label: c.label })),
      waves: p.waves.map((w, waveIndex) => ({ waveIndex, text: w.text })),
      secondsPerWave: p.secondsPerWave,
    };
  },
  grade(p, input: Input) {
    const { answers } = solve(p);
    const given = new Map(input.answers.map((a) => [a.waveIndex, a.categoryId]));
    const wrongAt = answers.findIndex((expected, i) => given.get(i) !== expected);
    if (wrongAt === -1) return { correct: true, feedback: "Every wave hit the right category." };
    const wave = p.waves[wrongAt];
    const cat = p.categories.find((c) => c.id === wave.categoryId);
    return {
      correct: false,
      feedback: `"${wave.text}" is ${cat?.label ?? wave.categoryId}: ${wave.why}`,
    };
  },
  solutionInput: (_p, s) => ({
    answers: s.answers.map((categoryId, waveIndex) => ({ waveIndex, categoryId })),
  }),
  blind: {
    schema: z.object({
      answers: z
        .array(z.string())
        .min(4)
        .max(10)
        .describe("Category ids, one per wave, in the order the waves are shown"),
    }),
    describe: (p, view: View) =>
      `Categories: ${view.categories.map((c) => `${c.id} (${c.label})`).join(", ")}\nWaves in order:\n${view.waves.map((w) => `${w.waveIndex}. ${w.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => {
      const o = out as { answers: string[] };
      return { answers: view.waves.map((w, i) => ({ waveIndex: w.waveIndex, categoryId: o.answers[i] ?? "?" })) };
    },
  },
});
