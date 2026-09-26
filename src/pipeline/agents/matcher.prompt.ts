import type { Concept } from "../../contracts/knowledge";
import type { ScoredCard } from "../../library";

/*
 * System prompt + user prompt builder for S4 Matcher (FAST). Only reached in live mode: in mock
 * mode (or on any failure) the matcher takes the top 3 retrieval candidates by score instead
 * (src/pipeline/agents/matcher.ts). The mock dispatcher (src/pipeline/mock/models.ts) recognizes
 * this agent by the exact opening words below, should a mock ever be registered for it.
 */

export const MATCHER_SYSTEM = `You are the Matcher. For one concept, pick the best teaching-mechanic cards from a pre-scored shortlist the retrieval system already built.

Rules:
- Pick cards, best first, with no repeats.
- reason: one sentence on why the mechanic makes the player USE the concept to win, not just recall it.
- targetsMisconception: copy one of the concept's listed misconceptions EXACTLY if the card breaks it, or null.`;

export function matcherPrompt(concept: Concept, candidates: readonly ScoredCard[]): string {
  const beliefs = concept.misconceptions.map((m) => m.belief);
  const list = candidates
    .map(
      (c) =>
        `- ${c.card.id} [${c.card.family}.${c.card.mode}] "${c.card.concept}": ${c.card.playerAction}. Breaks: "${c.card.misconception}". (retrieval score ${c.score.toFixed(1)})`,
    )
    .join("\n");
  return [
    `# Concept: ${concept.name}\n${concept.summary}`,
    `# Misconceptions\n${beliefs.length > 0 ? beliefs.map((b) => `- ${b}`).join("\n") : "(none listed)"}`,
    `# Shortlist (pick only from these)\n${list}`,
  ].join("\n\n");
}
