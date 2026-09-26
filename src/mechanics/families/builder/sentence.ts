import { z } from "zod";
import { defineMode } from "../../types";
import { shuffleNotIdentity } from "../../util";

/*
 * builder · sentence: word tiles the player arranges into a grammatically accepted order. `accepted` lists
 * every valid ordering (agreement/word-order can allow more than one); grading walks the "trie" of accepted
 * orderings position by position, so the reported position is the first one from which NO accepted ordering
 * can still be reached, not just a mismatch against one arbitrarily chosen ordering. Cards: spell_syntax,
 * citation_builder.
 *
 * Input (widget "build"): { order: string[] } - the tile TEXTS in the order the player placed them (tiles
 * are assumed to have distinct texts, so texts double as ids here).
 */

const Params = z.object({
  tiles: z.array(z.string()).min(2).max(8).describe("Word/element tiles with DISTINCT texts, in any order; code shuffles them for display"),
  accepted: z
    .array(z.array(z.string()))
    .min(1)
    .max(4)
    .describe("Every grammatically/format-accepted ordering of those SAME tile texts (a permutation of tiles each)"),
  rules: z
    .array(z.string())
    .min(1)
    .max(4)
    .describe('Short names of the rules this enforces, shown on a miss, e.g. "adjective agreement", "verb before object"'),
});
type Params = z.infer<typeof Params>;

interface Input {
  order: string[];
}
interface Solution {
  order: string[];
}
interface View {
  tiles: string[];
  rules: string[];
}

function isPermutation(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
}

/** First position from which no accepted ordering's prefix still matches; -1 if fully correct. */
function firstDeparture(order: readonly string[], accepted: readonly string[][]): number {
  let candidates = accepted.filter((a) => a.length === order.length);
  for (let i = 0; i < order.length; i++) {
    const next = candidates.filter((a) => a[i] === order[i]);
    if (next.length === 0) return i;
    candidates = next;
  }
  return -1;
}

function solve(p: Params): Solution {
  return { order: p.accepted[0] };
}

export const sentence = defineMode({
  id: "sentence",
  name: "Sentence",
  implemented: true,
  blindSolvable: true,
  widget: "build",
  knowledgeTypes: ["procedure"],
  directorBlurb:
    "The player arranges word tiles into a correctly ordered (and agreeing) sentence or citation. Word order, agreement, citation format.",
  authoringGuide: [
    "List tiles with DISTINCT texts (split multi-word chunks if two tiles would otherwise repeat a word).",
    "List every ordering of those tiles that should count as correct in accepted; word-order or agreement rules can make more than one valid.",
    'Name the rules this checks in rules (short labels), e.g. "adjective agreement", "verb conjugation", "MLA element order".',
    "Placeholders: {{answer}} (one accepted ordering, space-joined): last hint and debrief only.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (new Set(p.tiles).size !== p.tiles.length) problems.push("tiles must have distinct texts");
    p.accepted.forEach((a, i) => {
      if (!isPermutation(a, p.tiles)) problems.push(`accepted[${i}] must be a reordering of exactly the given tiles`);
    });
    if (new Set(p.accepted.map((a) => a.join("\u0000"))).size !== p.accepted.length) problems.push("accepted orderings must be distinct");
    if (p.rules.some((r) => !r.trim())) problems.push("rules must not contain empty strings");
    return problems;
  },
  resolve: solve,
  templateVars(_p, s) {
    return { answer: s.order.join(" ") };
  },
  answerVars: ["answer"],
  present(p, seed): View {
    return { tiles: shuffleNotIdentity(p.tiles, seed), rules: [...p.rules] };
  },
  grade(p, input: Input) {
    if (!isPermutation(input.order, p.tiles)) {
      return { correct: false, feedback: `Use each of the ${p.tiles.length} tiles exactly once.` };
    }
    const dep = firstDeparture(input.order, p.accepted);
    if (dep === -1) return { correct: true, feedback: "That ordering is correct." };
    return {
      correct: false,
      feedback: `"${input.order[dep]}" doesn't belong at position ${dep + 1}; check ${p.rules.join(", ")}.`,
    };
  },
  solutionInput: (_p, s) => ({ order: s.order }),
  blind: {
    schema: z.object({
      order: z.array(z.number().int().min(0).max(7)).min(2).max(8).describe("Positions (0-based) of the tiles shown, in the intended reading order"),
    }),
    describe: (_p, view: View) => `Tiles shown:\n${view.tiles.map((t, i) => `${i}. ${t}`).join("\n")}\nRules: ${view.rules.join(", ")}`,
    toInput: (_p, view: View, out) => {
      const o = out as { order: number[] };
      return { order: o.order.map((i) => view.tiles[i] ?? "?") };
    },
  },
});
