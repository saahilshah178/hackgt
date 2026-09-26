import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, trimNumber } from "../../util";

/*
 * balance · ratio: a recipe or reaction consumes ingredients in fixed proportion. Given what is
 * available, which ingredient runs out first (the limiting one) and how much product can be made?
 * Cards: reaction_factory, production_bottleneck.
 */

const Params = z.object({
  recipe: z
    .array(z.object({ name: z.string(), amount: z.string().describe("exact amount needed per batch"), unit: z.string() }))
    .min(2)
    .max(4)
    .describe("Ingredients (or reactants) per batch"),
  available: z.array(z.object({ name: z.string(), amount: z.string().describe("exact amount on hand") })).min(2).max(4).describe("Same names as the recipe"),
  product: z.object({ name: z.string(), perBatch: z.string().describe("exact product per batch"), unit: z.string() }),
  ask: z.enum(["limiting", "product", "both"]).describe("limiting: which ingredient runs out first. product: how much product ships. both: both"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  batches: number;
  limiting: string;
  product: number;
  leftovers: { name: string; amount: number }[];
}
interface Input {
  limiting: string | null;
  product: number | null;
}
interface View {
  ask: "limiting" | "product" | "both";
  recipe: { name: string; amount: number; unit: string }[];
  available: { name: string; amount: number }[];
  product: { name: string; perBatch: number; unit: string };
}

const norm = (s: string) => s.trim().toLowerCase();

function solve(p: Params): Solution {
  const rows = p.recipe.map((r) => {
    const have = p.available.find((a) => norm(a.name) === norm(r.name));
    const need = evalExact(r.amount)!;
    const avail = evalExact(have?.amount ?? "0")!;
    return { name: r.name, need, avail, batches: avail / need };
  });
  const limiting = rows.reduce((a, b) => (b.batches < a.batches ? b : a));
  const batches = limiting.batches;
  const product = batches * evalExact(p.product.perBatch)!;
  return {
    batches,
    limiting: limiting.name,
    product,
    leftovers: rows.map((r) => ({ name: r.name, amount: Math.max(0, r.avail - batches * r.need) })),
  };
}

export const ratio = defineMode({
  id: "ratio",
  name: "Ratio",
  implemented: true,
  blindSolvable: true,
  widget: "pick",
  knowledgeTypes: ["quantitative", "procedure"],
  directorBlurb: "Feed ingredients in a fixed ratio: which one runs out first, and how much product results? Stoichiometry, limiting reagent, recipes, scaling.",
  authoringGuide: [
    "Names in available must match the recipe. Choose amounts so exactly one ingredient limits and the leftover of the others is visible (not all ratios equal).",
    "The trap to build in: the ingredient with the SMALLEST available amount (or mass) is often not the limiting one.",
    "Placeholders: {{productName}}, {{unit}}, {{limiting}} and {{product}} (answers: last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const names = p.recipe.map((r) => norm(r.name));
    if (new Set(names).size !== names.length) problems.push("recipe names must be distinct");
    for (const r of p.recipe) if (!p.available.some((a) => norm(a.name) === norm(r.name))) problems.push(`available is missing "${r.name}"`);
    for (const a of p.available) if (!names.includes(norm(a.name))) problems.push(`available lists "${a.name}", which is not in the recipe`);
    for (const r of [...p.recipe.map((x) => x.amount), ...p.available.map((x) => x.amount), p.product.perBatch]) {
      if (looksApproximated(r)) problems.push(`"${r}" looks like a rounded decimal; write it exactly`);
      const v = evalExact(r);
      if (v === null || v <= 0) problems.push(`"${r}" must be a positive number`);
    }
    if (problems.length) return problems;
    const rows = p.recipe.map((r) => evalExact(p.available.find((a) => norm(a.name) === norm(r.name))!.amount)! / evalExact(r.amount)!);
    const min = Math.min(...rows);
    if (rows.filter((b) => Math.abs(b - min) < 1e-9).length > 1) problems.push("two ingredients run out at the same time; change an amount so exactly one limits");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { productName: p.product.name, unit: p.product.unit, limiting: s.limiting, product: trimNumber(s.product) };
  },
  answerVars: ["limiting", "product"],
  present(p): View {
    return {
      ask: p.ask,
      recipe: p.recipe.map((r) => ({ name: r.name, amount: evalExact(r.amount)!, unit: r.unit })),
      available: p.available.map((a) => ({ name: a.name, amount: evalExact(a.amount)! })),
      product: { name: p.product.name, perBatch: evalExact(p.product.perBatch)!, unit: p.product.unit },
    };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const needLimiting = p.ask !== "product";
    const needProduct = p.ask !== "limiting";
    if (needLimiting && (input.limiting === null || norm(input.limiting) !== norm(s.limiting))) {
      const picked = p.recipe.find((r) => input.limiting !== null && norm(r.name) === norm(input.limiting));
      const hint = picked
        ? `"${picked.name}" makes ${trimNumber(evalExact(p.available.find((a) => norm(a.name) === norm(picked.name))!.amount)! / evalExact(picked.amount)!)} batches' worth; compare that with the others.`
        : "Divide each available amount by the amount one batch needs; the smallest quotient runs out first.";
      return { correct: false, feedback: `That ingredient isn't the one that runs out first. ${hint}` };
    }
    if (needProduct) {
      const tol = Math.max(0.02 * s.product, 1e-9);
      if (input.product === null || !Number.isFinite(input.product) || Math.abs(input.product - s.product) > tol) {
        const direction = (input.product ?? 0) > s.product ? "more than the limiting ingredient allows" : "less than the batches you can actually run";
        return { correct: false, feedback: `That is ${direction}. Batches = available ÷ needed for the limiting ingredient; product = batches × ${trimNumber(evalExact(p.product.perBatch)!)} ${p.product.unit}.` };
      }
    }
    return { correct: true, feedback: `Right: ${s.limiting} runs out first, and the leftovers of the others pile up.` };
  },
  solutionInput: (_p, s) => ({ limiting: s.limiting, product: s.product }),
  blind: {
    schema: z.object({
      limiting: z.string().nullable().describe("Name of the ingredient that runs out first, or null if not asked"),
      product: z.number().nullable().describe("Amount of product, or null if not asked"),
    }),
    describe: (p, view: View) =>
      [
        `Per batch: ${view.recipe.map((r) => `${trimNumber(r.amount)} ${r.unit} ${r.name}`).join(", ")} → ${trimNumber(view.product.perBatch)} ${view.product.unit} ${view.product.name}`,
        `Available: ${view.available.map((a) => `${trimNumber(a.amount)} ${a.name}`).join(", ")}`,
        `Question: ${p.ask === "limiting" ? "which ingredient runs out first?" : p.ask === "product" ? "how much product?" : "which runs out first, and how much product?"}`,
      ].join("\n"),
    toInput: (_p, _view: View, out) => {
      const o = out as { limiting: string | null; product: number | null };
      return { limiting: o.limiting, product: o.product };
    },
  },
});
