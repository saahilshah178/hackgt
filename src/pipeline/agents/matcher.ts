import type { LanguageModel } from "ai";
import type { Genre } from "../../contracts/common";
import type { Concept, KnowledgeMap } from "../../contracts/knowledge";
import type { MatchPick, MatchResult } from "../../contracts/match";
import { matcherSchema, type MatcherSlice } from "../../contracts/slices";
import { getCard, retrieveCards, type ScoredCard } from "../../library";
import { isMockLLM } from "../../server/env";
import { runAgent } from "../llm";
import { MATCHER_SYSTEM, matcherPrompt } from "./matcher.prompt";

/*
 * S4 Matcher (code + FAST): per concept, retrieveCards() builds a shortlist; in live mode FAST picks
 * the best 3 with a reason and targeted misconception. In mock mode, or on any failure, code falls
 * back to the top 3 by retrieval score (MEGAPROMPT §4) — no mock response is needed for this agent.
 */

/** No repeated cards; every pick must come from the shortlist offered. */
export function checkMatcher(slice: MatcherSlice, cardIds: readonly string[]): string[] {
  const problems: string[] = [];
  const ids = slice.picks.map((p) => p.teachingMechanicId);
  if (new Set(ids).size !== ids.length) problems.push("picks must not repeat a card");
  ids.filter((id) => !cardIds.includes(id)).forEach((id) => problems.push(`pick "${id}" is not in the shortlist`));
  return problems;
}

/** Guarantees at least one candidate (mimic_chest) so a concept never ends up with zero picks. */
function withFallbackCandidate(candidates: readonly ScoredCard[]): ScoredCard[] {
  if (candidates.length > 0) return [...candidates];
  const mimic = getCard("mimic_chest");
  return mimic ? [{ card: mimic, score: 1, targetsMisconception: null, implemented: true }] : [];
}

function topPicks(candidates: readonly ScoredCard[]): MatchPick[] {
  return candidates.slice(0, 3).map((c) => ({
    teachingMechanicId: c.card.id,
    score: c.score,
    reason: "top retrieval score",
    targetsMisconception: c.targetsMisconception,
  }));
}

export interface RunMatcherArgs {
  jobId: string;
  /** Usually omitted: the matcher runs at intake time, before the student has chosen a genre. */
  genre?: Genre;
  /** Overrides the FAST model (tests inject a mock model here); unused in mock mode. */
  model?: LanguageModel;
}

async function pickForConcept(concept: Concept, km: KnowledgeMap, a: RunMatcherArgs): Promise<MatchResult> {
  const { candidates: raw, wishlist } = retrieveCards({
    concept: {
      name: concept.name,
      summary: concept.summary,
      keywords: concept.keywords,
      knowledgeType: concept.knowledgeType,
      misconceptions: concept.misconceptions,
    },
    domain: km.subject.domain,
    topic: km.subject.topic,
    genre: a.genre,
    limit: 12,
  });
  const candidates = withFallbackCandidate(raw);
  const wishlistOut = wishlist.map((w) => ({ teachingMechanicId: w.card.id, score: w.score }));
  const fallback = (): MatchResult => ({ conceptId: concept.id, picks: topPicks(candidates), wishlist: wishlistOut });

  if (isMockLLM() || candidates.length === 0) return fallback();

  const cardIds = candidates.map((c) => c.card.id);
  const beliefs = [...new Set(concept.misconceptions.map((m) => m.belief))];
  try {
    const result = await runAgent({
      jobId: a.jobId,
      agent: `matcher:${concept.id}`,
      tier: "fast",
      model: a.model,
      schema: matcherSchema(cardIds, beliefs, Math.min(3, cardIds.length)),
      system: MATCHER_SYSTEM,
      prompt: matcherPrompt(concept, candidates),
      check: (s) => checkMatcher(s, cardIds),
      maxRepairs: 1,
    });
    const picks: MatchPick[] = result.picks.map((p) => {
      const scored = candidates.find((c) => c.card.id === p.teachingMechanicId);
      return { teachingMechanicId: p.teachingMechanicId, score: scored?.score ?? 0, reason: p.reason, targetsMisconception: p.targetsMisconception };
    });
    return { conceptId: concept.id, picks, wishlist: wishlistOut };
  } catch {
    return fallback();
  }
}

export function runMatcher(km: KnowledgeMap, a: RunMatcherArgs): Promise<MatchResult[]> {
  return Promise.all(km.concepts.map((c) => pickForConcept(c, km, a)));
}
