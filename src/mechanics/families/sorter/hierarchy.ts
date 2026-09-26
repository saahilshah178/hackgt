import { z } from "zod";
import { defineMode } from "../../types";
import { shuffleNotIdentity } from "../../util";

/* sorter · hierarchy: place items at the right level of a nested hierarchy. Cards: taxonomy_tower, maslow_tower. */

const Params = z.object({
  levels: z.array(z.string()).min(3).max(8).describe("Level names from the top (broadest) down, e.g. Kingdom, Phylum, Class"),
  items: z.array(z.object({ text: z.string(), level: z.string().describe("one of levels"), why: z.string() })).min(3).max(10),
});
type Params = z.infer<typeof Params>;
interface Solution { placements: Record<string, string> }
interface Input { placements: { itemKey: string; level: string }[] }
interface View { levels: string[]; items: { key: string; text: string }[] }

const solve = (p: Params): Solution => ({ placements: Object.fromEntries(p.items.map((it, i) => [`i${i}`, it.level])) });

export const hierarchy = defineMode({
  id: "hierarchy",
  name: "Hierarchy",
  implemented: true,
  blindSolvable: true,
  widget: "sort",
  knowledgeTypes: ["category"],
  directorBlurb: "Stack items into the levels of a hierarchy, broadest at the top. Taxonomy, levels of organization, needs pyramids.",
  authoringGuide: ["List the levels top-down; give 3-10 items with the level each belongs to and why.", "Placeholders: {{levelCount}}, {{top}} (the top level name, safe)."].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (new Set(p.levels).size !== p.levels.length) problems.push("levels must be distinct");
    p.items.forEach((it, i) => { if (!p.levels.includes(it.level)) problems.push(`items[${i}].level "${it.level}" is not one of the levels`); });
    return problems;
  },
  resolve: solve,
  templateVars(p) { return { levelCount: String(p.levels.length), top: p.levels[0] }; },
  answerVars: [],
  present(p, seed): View { return { levels: p.levels, items: shuffleNotIdentity(p.items.map((it, i) => ({ key: `i${i}`, text: it.text })), seed) }; },
  grade(p, input: Input) {
    const s = solve(p);
    const given = new Map((input.placements ?? []).map((x) => [x.itemKey, x.level]));
    if (Object.keys(s.placements).some((k) => !given.has(k))) return { correct: false, feedback: "Place every item on a level." };
    const wrong = Object.entries(s.placements).find(([k, lvl]) => given.get(k) !== lvl);
    if (!wrong) return { correct: true, feedback: "The tower stands: every item on its level." };
    const it = p.items[Number(wrong[0].slice(1))];
    const placed = given.get(wrong[0])!;
    const dir = p.levels.indexOf(placed) < p.levels.indexOf(it.level) ? "broader" : "narrower";
    return { correct: false, feedback: `"${it.text}" is more specific than that? Not quite: you placed it at a ${dir} level than it belongs. ${it.why}` };
  },
  solutionInput: (_p, s) => ({ placements: Object.entries(s.placements).map(([itemKey, level]) => ({ itemKey, level })) }),
  blind: {
    schema: z.object({ placements: z.array(z.object({ item: z.number().int().min(0).max(9), level: z.string() })).min(3).max(10) }),
    describe: (p, view: View) => `Levels (top down): ${p.levels.join(" > ")}\nItems:\n${view.items.map((it, i) => `${i}. ${it.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => ({ placements: (out as { placements: { item: number; level: string }[] }).placements.map((x) => ({ itemKey: view.items[x.item]?.key ?? "?", level: x.level })) }),
  },
});
