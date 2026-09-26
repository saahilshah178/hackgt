import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, shuffleNotIdentity } from "../../util";

/*
 * sequencer · rank: items with exact `value` expressions, ordered ascending or descending. Values are
 * hidden until graded. Cards: spread_field, periodic_landscape, escape_energy, strata_xray, big_o_race,
 * memory_distance.
 */

const Item = z.object({
  text: z.string().describe("The item shown to the player, under 100 characters"),
  value: z.string().describe("Exact mathjs expression for this item's numeric value on the ranked property, e.g. \"0.98\" or \"3/4\""),
  label: z.string().describe("The value shown to the player after grading, e.g. '1.2 nm'; use '' if there is none"),
});

const Params = z.object({
  property: z.string().describe("The property being ranked, e.g. 'atomic radius'"),
  direction: z.enum(["ascending", "descending"]).describe("Order from first slot to last: ascending (smallest first) or descending (largest first)"),
  items: z.array(Item).min(3).max(7).describe("3-7 items with distinct numeric values"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  order: string[]; // keys i0..iN sorted by value/direction
  values: number[]; // parallel to params.items, by original index
}
interface Input {
  keys: string[];
}
interface View {
  property: string;
  direction: "ascending" | "descending";
  slots: number;
  planks: { key: string; text: string }[];
}

const itemKey = (i: number) => `i${i}`;

function values(p: Params): number[] {
  return p.items.map((it) => evalExact(it.value) ?? NaN);
}

function solve(p: Params): Solution {
  const vals = values(p);
  const indices = p.items.map((_, i) => i);
  indices.sort((a, b) => (p.direction === "ascending" ? vals[a] - vals[b] : vals[b] - vals[a]));
  return { order: indices.map((i) => itemKey(i)), values: vals };
}

function textForKey(p: Params, key: string): string {
  const i = Number(key.slice(1));
  return p.items[i]?.text ?? key;
}

export const rank = defineMode({
  id: "rank",
  name: "Rank",
  implemented: true,
  blindSolvable: true,
  widget: "order",
  knowledgeTypes: ["sequence", "quantitative", "category"],
  directorBlurb:
    "The player orders items by a sourced or computed property, ascending or descending; values stay hidden until graded. Comparative magnitude: trends, growth rates, physical properties.",
  authoringGuide: [
    "Write the property being ranked and pick direction (ascending = smallest first, descending = largest first).",
    "Give every item an exact value expression (a real number, not necessarily rounded) so the ranking is unambiguous: no ties.",
    "label is shown after grading (e.g. '1.2 nm', '12%'); leave it '' if there is nothing worth revealing.",
    "Placeholders available: {{property}}, {{first}}, {{last}} (the correct first/last item's text): keep {{first}}/{{last}} out of the prompt and first hint.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const texts = p.items.map((it) => it.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) problems.push("item texts must be distinct");
    p.items.forEach((it, i) => {
      if (looksApproximated(it.value)) problems.push(`items[${i}].value "${it.value}" looks like a rounded decimal; write it exactly`);
      if (evalExact(it.value) === null) problems.push(`items[${i}].value "${it.value}" must evaluate to a number`);
    });
    const vals = values(p);
    if (vals.every((v) => Number.isFinite(v))) {
      const sorted = [...vals].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        if (Math.abs(sorted[i] - sorted[i - 1]) < 1e-9) {
          problems.push("item values must be distinct; two items evaluate to the same value");
          break;
        }
      }
    }
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return {
      property: p.property,
      first: textForKey(p, s.order[0]),
      last: textForKey(p, s.order[s.order.length - 1]),
    };
  },
  answerVars: ["first", "last"],
  present(p, seed): View {
    const planks = p.items.map((it, i) => ({ key: itemKey(i), text: it.text }));
    return { property: p.property, direction: p.direction, slots: p.items.length, planks: shuffleNotIdentity(planks, seed) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if (input.keys.length !== s.order.length) return { correct: false, feedback: `Rank all ${s.order.length} items.` };
    const wrongAt = input.keys.findIndex((k, i) => k !== s.order[i]);
    if (wrongAt === -1) {
      const labels = p.items
        .filter((it) => it.label)
        .map((it) => `${it.text}: ${it.label}`)
        .join(", ");
      return { correct: true, feedback: labels ? `Correctly ranked. ${labels}.` : "Correctly ranked." };
    }
    return {
      correct: false,
      feedback: `Slot ${wrongAt + 1} is out of place for ${p.property} (${p.direction}). Compare "${textForKey(p, input.keys[wrongAt])}" with its neighbor.`,
    };
  },
  solutionInput: (_p, s) => ({ keys: s.order }),
  blind: {
    schema: z.object({
      order: z
        .array(z.number().int().min(0).max(6))
        .min(3)
        .max(7)
        .describe("Positions (0-based) of the planks shown, ranked in the requested direction"),
    }),
    describe: (p, view: View) =>
      `Rank by ${p.property}, ${p.direction}. Items shown:\n${view.planks.map((pl, i) => `${i}. ${pl.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => {
      const o = out as { order: number[] };
      return { keys: o.order.map((i) => view.planks[i]?.key ?? "?") };
    },
  },
});
