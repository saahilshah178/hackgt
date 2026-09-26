import { z } from "zod";
import { defineMode } from "../../types";
import { shuffleNotIdentity } from "../../util";

/* sorter · bins: 2-4 categories, 4-10 items, exactly one bin per item. */

const Bin = z.object({
  id: z.string().describe("snake_case id for this bin, e.g. 'diffuses'"),
  label: z.string().describe("Shown on the bin, under 40 characters"),
  feature: z.string().describe("The defining rule for this bin, under 140 characters. Shown when the player misses"),
});

const Item = z.object({
  text: z.string().describe("The item shown to the player, under 100 characters"),
  binId: z.string().describe("The id of the bin this item belongs in; must match one of bins[].id"),
  why: z.string().describe("Why this item belongs in that bin, under 140 characters"),
});

const Params = z.object({
  bins: z.array(Bin).min(2).max(4).describe("2-4 categories the player sorts items into"),
  items: z.array(Item).min(4).max(10).describe("4-10 items, each with exactly one correct bin"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  assignments: Record<string, string>; // itemKey -> binId
}
interface Input {
  assignments: { itemKey: string; binId: string }[];
}
interface View {
  bins: { id: string; label: string }[];
  items: { key: string; text: string }[];
}

const itemKey = (i: number) => `i${i}`;

const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;

function solve(p: Params): Solution {
  const assignments: Record<string, string> = {};
  p.items.forEach((it, i) => (assignments[itemKey(i)] = it.binId));
  return { assignments };
}

function binById(p: Params, id: string) {
  return p.bins.find((b) => b.id === id);
}

export const bins = defineMode({
  id: "bins",
  name: "Bins",
  implemented: true,
  blindSolvable: true,
  widget: "sort",
  knowledgeTypes: ["category"],
  directorBlurb:
    "The player drags items into 2 to 4 labeled bins by a defining feature. Classification, categorization, membership rules.",
  authoringGuide: [
    "Write 2-4 bins, each with a short snake_case id, a label, and the defining feature (shown on a miss).",
    "Write 4-10 items; each item's binId must match one of the bins' ids exactly.",
    "Give every item a 'why' that names the feature that puts it there, not a surface resemblance.",
    "Placeholders available: {{binCount}}, {{itemCount}}.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const binIds = p.bins.map((b) => b.id);
    binIds.forEach((id, i) => {
      if (!SNAKE_CASE.test(id)) problems.push(`bins[${i}].id "${id}" must be lowercase snake_case`);
    });
    if (new Set(binIds).size !== binIds.length) problems.push("bin ids must be unique");
    const texts = p.items.map((it) => it.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) problems.push("item texts must be distinct");
    const used = new Set<string>();
    p.items.forEach((it, i) => {
      if (!binIds.includes(it.binId)) {
        problems.push(`items[${i}].binId "${it.binId}" doesn't match any bin id (${binIds.join(", ")})`);
      } else {
        used.add(it.binId);
      }
    });
    for (const id of binIds) {
      if (!used.has(id)) problems.push(`bin "${id}" has no items assigned to it; every bin needs at least one item`);
    }
    return problems;
  },
  resolve: solve,
  templateVars(p) {
    return { binCount: String(p.bins.length), itemCount: String(p.items.length) };
  },
  answerVars: [],
  present(p, seed): View {
    const items = p.items.map((it, i) => ({ key: itemKey(i), text: it.text }));
    return {
      bins: p.bins.map((b) => ({ id: b.id, label: b.label })),
      items: shuffleNotIdentity(items, seed),
    };
  },
  grade(p, input: Input) {
    const { assignments } = solve(p);
    const given = new Map(input.assignments.map((a) => [a.itemKey, a.binId]));
    const keys = Object.keys(assignments);
    if (keys.some((k) => !given.has(k))) {
      return { correct: false, feedback: `Place all ${keys.length} items into a bin.` };
    }
    const wrongKey = keys.find((k) => given.get(k) !== assignments[k]);
    if (!wrongKey) return { correct: true, feedback: "Every item is where it belongs." };
    const i = Number(wrongKey.slice(1));
    const item = p.items[i];
    const bin = binById(p, item.binId);
    return {
      correct: false,
      feedback: `"${item.text}" belongs in ${bin?.label ?? item.binId}: ${bin?.feature ?? "check the defining rule"}.`,
    };
  },
  solutionInput: (_p, s) => ({
    assignments: Object.entries(s.assignments).map(([itemKey, binId]) => ({ itemKey, binId })),
  }),
  blind: {
    schema: z.object({
      assignments: z
        .array(
          z.object({
            item: z.number().int().min(0).max(9).describe("Position (0-based) of the item shown"),
            bin: z.string().describe("The id of the bin it belongs in"),
          }),
        )
        .min(4)
        .max(10),
      why: z.string().describe("One sentence"),
    }),
    describe: (p, view: View) =>
      `Bins: ${view.bins.map((b) => `${b.id} (${b.label})`).join(", ")}\nItems:\n${view.items.map((it, i) => `${i}. ${it.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => {
      const o = out as { assignments: { item: number; bin: string }[] };
      return {
        assignments: o.assignments.map((a) => ({ itemKey: view.items[a.item]?.key ?? "?", binId: a.bin })),
      };
    },
  },
});
