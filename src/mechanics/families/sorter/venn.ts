import { z } from "zod";
import { defineMode } from "../../types";
import { shuffleNotIdentity } from "../../util";

/* sorter · venn: 2–3 overlapping sets plus a "neither" region. Card: federalism_venn. */

const Params = z.object({
  sets: z.array(z.object({ id: z.string().describe("snake_case"), label: z.string(), feature: z.string().describe("the defining rule, shown on a miss") })).min(2).max(3),
  items: z.array(z.object({ text: z.string(), setIds: z.array(z.string()).min(0).max(3).describe("every set the item belongs to; empty = neither"), why: z.string() })).min(4).max(10),
});
type Params = z.infer<typeof Params>;
interface Solution { regions: Record<string, string[]> }
interface Input { assignments: { itemKey: string; setIds: string[] }[] }
interface View { sets: { id: string; label: string }[]; items: { key: string; text: string }[] }

const SNAKE = /^[a-z][a-z0-9_]{0,47}$/;
const keyOf = (ids: readonly string[]) => [...ids].sort().join("+") || "neither";
const solve = (p: Params): Solution => ({ regions: Object.fromEntries(p.items.map((it, i) => [`i${i}`, [...it.setIds].sort()])) });

export const venn = defineMode({
  id: "venn",
  name: "Venn",
  implemented: true,
  blindSolvable: true,
  widget: "sort",
  knowledgeTypes: ["category"],
  directorBlurb: "Place items into overlapping sets, including the overlap and the 'neither' region. Shared vs exclusive powers, overlapping categories.",
  authoringGuide: ["2-3 sets with a defining feature each; 4-10 items, including at least one in an overlap and one in neither.", "Placeholders: {{setCount}}, {{itemCount}}."].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const ids = p.sets.map((s) => s.id);
    if (new Set(ids).size !== ids.length) problems.push("set ids must be unique");
    ids.filter((id) => !SNAKE.test(id)).forEach((id) => problems.push(`set id "${id}" must be snake_case`));
    p.items.forEach((it, i) => it.setIds.forEach((s) => { if (!ids.includes(s)) problems.push(`items[${i}] refers to unknown set "${s}"`); }));
    if (!p.items.some((it) => it.setIds.length >= 2)) problems.push("include at least one item in an overlap");
    if (!p.items.some((it) => it.setIds.length === 0)) problems.push("include at least one item that belongs to neither set");
    return problems;
  },
  resolve: solve,
  templateVars(p) { return { setCount: String(p.sets.length), itemCount: String(p.items.length) }; },
  answerVars: [],
  present(p, seed): View {
    return { sets: p.sets.map((s) => ({ id: s.id, label: s.label })), items: shuffleNotIdentity(p.items.map((it, i) => ({ key: `i${i}`, text: it.text })), seed) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const given = new Map((input.assignments ?? []).map((a) => [a.itemKey, keyOf(a.setIds)]));
    const missing = Object.keys(s.regions).find((k) => !given.has(k));
    if (missing) return { correct: false, feedback: "Place every item in a region." };
    const wrong = Object.entries(s.regions).find(([k, ids]) => given.get(k) !== keyOf(ids));
    if (!wrong) return { correct: true, feedback: "Every item sits in the right region." };
    const it = p.items[Number(wrong[0].slice(1))];
    const region = it.setIds.length === 0 ? "neither set" : it.setIds.map((id) => p.sets.find((x) => x.id === id)?.label).join(" AND ");
    const features = it.setIds.map((id) => p.sets.find((x) => x.id === id)?.feature).filter(Boolean).join("; ");
    return { correct: false, feedback: `"${it.text}" belongs to ${region}. ${features || it.why}` };
  },
  solutionInput: (_p, s) => ({ assignments: Object.entries(s.regions).map(([itemKey, setIds]) => ({ itemKey, setIds })) }),
  blind: {
    schema: z.object({ assignments: z.array(z.object({ item: z.number().int().min(0).max(9), sets: z.array(z.string()).min(0).max(3) })).min(4).max(10).describe("For each item shown (0-based position), the ids of the sets it belongs to (empty for neither)") }),
    describe: (p, view: View) => `Sets:\n${p.sets.map((s) => `- ${s.id}: ${s.label}`).join("\n")}\nItems:\n${view.items.map((it, i) => `${i}. ${it.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => ({ assignments: (out as { assignments: { item: number; sets: string[] }[] }).assignments.map((a) => ({ itemKey: view.items[a.item]?.key ?? "?", setIds: a.sets })) }),
  },
});
