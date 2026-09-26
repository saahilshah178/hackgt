import { z } from "zod";
import { defineMode } from "../../types";
import { shuffleNotIdentity } from "../../util";

/* investigator · perspective: match accounts to actors and their motives. Cards: perspective_switch, character_motive. */

const Params = z.object({
  actors: z.array(z.object({ id: z.string().describe("snake_case"), name: z.string(), motive: z.string().describe("what this actor wanted, under 120 characters") })).min(2).max(4),
  accounts: z
    .array(z.object({ text: z.string().describe("an account, quote, or action, under 160 characters"), actorId: z.string(), why: z.string().describe("how the motive shows in the account, under 160 characters") }))
    .min(3)
    .max(6),
});
type Params = z.infer<typeof Params>;

interface Solution {
  links: Record<string, string>; // accountKey -> actorId
}
interface Input {
  links: { accountKey: string; actorId: string }[];
}
interface View {
  actors: { id: string; name: string; motive: string }[];
  accounts: { key: string; text: string }[];
}

const SNAKE = /^[a-z][a-z0-9_]{0,47}$/;
const solve = (p: Params): Solution => ({ links: Object.fromEntries(p.accounts.map((a, i) => [`a${i}`, a.actorId])) });

export const perspective = defineMode({
  id: "perspective",
  name: "Perspective",
  implemented: true,
  blindSolvable: true,
  widget: "link",
  knowledgeTypes: ["argument", "causal"],
  directorBlurb: "Match accounts, quotes, and actions to the actors whose motives explain them. Historical perspective, characterization, competing testimony.",
  authoringGuide: [
    "2-4 actors with distinct motives; 3-6 accounts, each explained by exactly one actor's motive. Every actor gets at least one account.",
    "Write accounts so the motive, not the wording, gives them away.",
    "Placeholders: {{actorCount}}, {{accountCount}}.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const ids = p.actors.map((a) => a.id);
    if (new Set(ids).size !== ids.length) problems.push("actor ids must be unique");
    ids.filter((id) => !SNAKE.test(id)).forEach((id) => problems.push(`actor id "${id}" must be snake_case`));
    p.accounts.forEach((a, i) => {
      if (!ids.includes(a.actorId)) problems.push(`accounts[${i}].actorId "${a.actorId}" is not an actor`);
    });
    for (const id of ids) if (!p.accounts.some((a) => a.actorId === id)) problems.push(`actor "${id}" has no account`);
    return problems;
  },
  resolve: solve,
  templateVars(p) {
    return { actorCount: String(p.actors.length), accountCount: String(p.accounts.length) };
  },
  answerVars: [],
  present(p, seed): View {
    return { actors: p.actors, accounts: shuffleNotIdentity(p.accounts.map((a, i) => ({ key: `a${i}`, text: a.text })), seed) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const given = new Map((input.links ?? []).map((l) => [l.accountKey, l.actorId]));
    const missing = Object.keys(s.links).find((k) => !given.has(k));
    if (missing) return { correct: false, feedback: "Match every account to an actor." };
    const wrong = Object.entries(s.links).find(([k, actorId]) => given.get(k) !== actorId);
    if (!wrong) return { correct: true, feedback: "Every account matches the motive behind it." };
    const acc = p.accounts[Number(wrong[0].slice(1))];
    const actor = p.actors.find((a) => a.id === given.get(wrong[0]));
    return { correct: false, feedback: `"${acc.text}" doesn't fit ${actor?.name ?? "that actor"}'s motive (${actor?.motive ?? ""}). ${acc.why}` };
  },
  solutionInput: (_p, s) => ({ links: Object.entries(s.links).map(([accountKey, actorId]) => ({ accountKey, actorId })) }),
  blind: {
    schema: z.object({ links: z.array(z.object({ account: z.number().int().min(0).max(5), actor: z.number().int().min(0).max(3) })).min(3).max(6).describe("For each account shown (0-based position), the position of the actor it belongs to") }),
    describe: (_p, view: View) => `Actors:\n${view.actors.map((a, i) => `${i}. ${a.name}: ${a.motive}`).join("\n")}\nAccounts:\n${view.accounts.map((a, i) => `${i}. ${a.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => ({ links: (out as { links: { account: number; actor: number }[] }).links.map((l) => ({ accountKey: view.accounts[l.account]?.key ?? "?", actorId: view.actors[l.actor]?.id ?? "?" })) }),
  },
});
