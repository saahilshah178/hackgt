import { z } from "zod";
import { defineMode } from "../../types";
import { shuffleNotIdentity } from "../../util";

/* linker · pairs: 3-6 matched pairs, plus 0-2 decoy rights that don't belong to any left. */

const Pair = z.object({
  left: z.string().describe("Left-side item, under 90 characters"),
  right: z.string().describe("The matching right-side item, under 90 characters"),
  why: z.string().describe("Why they match, under 140 characters. Used as a clue on a miss, never naming the answer"),
});

const Params = z.object({
  pairs: z.array(Pair).min(3).max(6).describe("3-6 matched left/right pairs"),
  decoyRights: z
    .array(z.string())
    .min(0)
    .max(2)
    .describe("0-2 plausible right-side items that do NOT match any left (use an empty array for none)"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  links: Record<string, string>; // leftKey -> rightKey
}
interface Input {
  links: { leftKey: string; rightKey: string }[];
}
interface View {
  lefts: { key: string; text: string }[];
  rights: { key: string; text: string }[];
}

const leftKey = (i: number) => `l${i}`;
const rightKey = (i: number) => `r${i}`;
const decoyKey = (i: number) => `x${i}`;

function solve(p: Params): Solution {
  const links: Record<string, string> = {};
  p.pairs.forEach((_, i) => (links[leftKey(i)] = rightKey(i)));
  return { links };
}

function textForRightKey(p: Params, key: string): string {
  const i = Number(key.slice(1));
  return key.startsWith("x") ? (p.decoyRights[i] ?? key) : (p.pairs[i]?.right ?? key);
}

export const pairs = defineMode({
  id: "pairs",
  name: "Pairs",
  implemented: true,
  blindSolvable: true,
  widget: "link",
  knowledgeTypes: ["fact", "category"],
  directorBlurb:
    "The player links each left item to its matching right item. 3-6 pairs, plus optional decoy rights that don't belong. Term-definition, part-function, quote-figure.",
  authoringGuide: [
    "Write 3-6 pairs: left, right, and a 'why' explaining the match (used as a clue on a miss, never the giveaway).",
    "Add 0-2 decoyRights: plausible-sounding right-side items with no matching left.",
    "Keep lefts and rights each unambiguous: no two lefts that could both fit the same right.",
    "Placeholders available: {{pairCount}}.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const lefts = p.pairs.map((pr) => pr.left.trim().toLowerCase());
    if (new Set(lefts).size !== lefts.length) problems.push("left items must be distinct");
    const rights = [...p.pairs.map((pr) => pr.right.trim().toLowerCase()), ...p.decoyRights.map((r) => r.trim().toLowerCase())];
    if (new Set(rights).size !== rights.length) problems.push("right items (including decoys) must be distinct");
    return problems;
  },
  resolve: solve,
  templateVars(p) {
    return { pairCount: String(p.pairs.length) };
  },
  answerVars: [],
  present(p, seed): View {
    const lefts = p.pairs.map((pr, i) => ({ key: leftKey(i), text: pr.left }));
    const rights = [
      ...p.pairs.map((pr, i) => ({ key: rightKey(i), text: pr.right })),
      ...p.decoyRights.map((text, i) => ({ key: decoyKey(i), text })),
    ];
    return { lefts, rights: shuffleNotIdentity(rights, seed) };
  },
  grade(p, input: Input) {
    const { links } = solve(p);
    const given = new Map(input.links.map((l) => [l.leftKey, l.rightKey]));
    const keys = Object.keys(links);
    if (keys.some((k) => !given.has(k))) {
      return { correct: false, feedback: `Link all ${keys.length} pairs.` };
    }
    const wrongKey = keys.find((k) => given.get(k) !== links[k]);
    if (!wrongKey) return { correct: true, feedback: "Every pair holds." };
    const i = Number(wrongKey.slice(1));
    const pair = p.pairs[i];
    return {
      correct: false,
      feedback: `"${pair.left}" isn't linked to "${textForRightKey(p, given.get(wrongKey)!)}". Clue: ${pair.why}`,
    };
  },
  solutionInput: (_p, s) => ({
    links: Object.entries(s.links).map(([leftKey, rightKey]) => ({ leftKey, rightKey })),
  }),
  blind: {
    schema: z.object({
      links: z
        .array(
          z.object({
            left: z.number().int().min(0).max(5).describe("Position (0-based) of the left item"),
            right: z.number().int().min(0).max(7).describe("Position (0-based) of the right item shown"),
          }),
        )
        .min(3)
        .max(6),
    }),
    describe: (_p, view: View) =>
      `Lefts:\n${view.lefts.map((l, i) => `${i}. ${l.text}`).join("\n")}\nRights:\n${view.rights.map((r, i) => `${i}. ${r.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => {
      const o = out as { links: { left: number; right: number }[] };
      return {
        links: o.links.map((l) => ({
          leftKey: view.lefts[l.left]?.key ?? "?",
          rightKey: view.rights[l.right]?.key ?? "?",
        })),
      };
    },
  },
});
