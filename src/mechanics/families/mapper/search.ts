import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact } from "../../util";

/*
 * mapper · search: find a hidden integer with higher/lower probes within a budget. Card: half_split_hunt.
 * The view carries the hidden value so the widget can answer probes locally (a DOM peek could read it; the
 * budget, not secrecy, is the mechanic).
 */

const Params = z.object({
  min: z.string().describe("exact integer"),
  max: z.string().describe("exact integer"),
  hidden: z.string().describe("exact integer strictly inside [min, max]"),
  maxProbes: z.number().int().min(1).max(20).describe("Probe budget; ⌈log2(range)⌉ + 1 makes halving necessary"),
  thingName: z.string().describe('e.g. "the page", "the year"'),
});
type Params = z.infer<typeof Params>;
interface Solution { hidden: number; optimalProbes: number; probes: number[] }
interface Input { probes: number[] }
interface View { min: number; max: number; maxProbes: number; hidden: number; thingName: string }

function solve(p: Params): Solution {
  let lo = evalExact(p.min)!;
  let hi = evalExact(p.max)!;
  const hidden = evalExact(p.hidden)!;
  const probes: number[] = [];
  while (probes.length < 64) {
    const mid = Math.floor((lo + hi) / 2);
    probes.push(mid);
    if (mid === hidden) break;
    if (mid < hidden) lo = mid + 1;
    else hi = mid - 1;
  }
  return { hidden, optimalProbes: Math.ceil(Math.log2(evalExact(p.max)! - evalExact(p.min)! + 1)), probes };
}

export const search = defineMode({
  id: "search",
  name: "Search",
  implemented: true,
  blindSolvable: false,
  widget: "place",
  knowledgeTypes: ["procedure", "quantitative"],
  directorBlurb: "Find a hidden value with higher/lower probes inside a tight budget: only halving the range fits. Binary search, estimation strategy.",
  authoringGuide: ["Use an integer range of at least 32 values and a budget of ⌈log2(range)⌉ + 1 probes so linear scanning fails.", "Placeholders: {{min}}, {{max}}, {{budget}}, {{thingName}}, {{hidden}} (the answer: last hint and debrief only)."].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const min = evalExact(p.min); const max = evalExact(p.max); const hidden = evalExact(p.hidden);
    if ([min, max, hidden].some((v) => v === null || !Number.isInteger(v))) { problems.push("min, max and hidden must be integers"); return problems; }
    if (!(min! < max!)) problems.push("min must be less than max");
    if (!(hidden! > min! && hidden! < max!)) problems.push("hidden must lie strictly inside [min, max]");
    if (max! - min! < 15) problems.push("the range should span at least 16 values");
    const needed = Math.ceil(Math.log2(max! - min! + 1));
    if (p.maxProbes < needed) problems.push(`maxProbes must be at least ${needed} for this range`);
    if (p.maxProbes > needed + 2) problems.push(`maxProbes ${p.maxProbes} is generous; use ${needed} or ${needed + 1} so halving matters`);
    return problems;
  },
  resolve: solve,
  templateVars(p, s) { return { min: p.min, max: p.max, budget: String(p.maxProbes), thingName: p.thingName, hidden: String(s.hidden) }; },
  answerVars: ["hidden"],
  present(p): View { return { min: evalExact(p.min)!, max: evalExact(p.max)!, maxProbes: p.maxProbes, hidden: evalExact(p.hidden)!, thingName: p.thingName }; },
  grade(p, input: Input) {
    const s = solve(p);
    const probes = input.probes ?? [];
    if (probes.length === 0) return { correct: false, feedback: "Make a guess; each answer tells you higher or lower." };
    if (probes[probes.length - 1] === s.hidden && probes.length <= p.maxProbes) return { correct: true, feedback: `Found in ${probes.length} probe${probes.length === 1 ? "" : "s"}.` };
    if (probes.length > p.maxProbes) return { correct: false, feedback: `Out of probes. Each guess should cut the remaining range in half: with ${p.maxProbes} probes you can always find one of ${s.hidden > 0 ? evalExact(p.max)! - evalExact(p.min)! + 1 : "the"} values.` };
    const last = probes[probes.length - 1];
    return { correct: false, feedback: `${last} is too ${last < s.hidden ? "low" : "high"}. ${probes.length} of ${p.maxProbes} probes used; aim for the middle of what's left.` };
  },
  solutionInput: (_p, s) => ({ probes: s.probes }),
});
