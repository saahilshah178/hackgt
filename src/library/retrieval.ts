import type { Domain, Genre, KnowledgeType } from "../contracts/common";
import type { TeachingMechanic } from "../contracts/library";
import { CARDS, cardPlaysIn, isCardImplemented } from "./index";

/**
 * The Matcher (MEGAPROMPT §4, S4). Scores every catalog card against a concept from the KnowledgeMap
 * and returns the top candidates (implemented + genre-filtered) plus a wishlist of high-scoring cards
 * whose family·mode isn't built yet.
 */
export interface RetrievalQuery {
  concept: {
    name: string;
    summary: string;
    keywords: string[];
    knowledgeType: KnowledgeType;
    misconceptions: { belief: string; correction: string }[];
  };
  domain: Domain;
  topic: string;
  /** When set, only cards whose family has a socket in this genre (cardPlaysIn) are considered. */
  genre?: Genre;
  /** Default false: only cards whose family·mode is implemented go in `candidates`. */
  includeUnimplemented?: boolean;
  /** Default 12. */
  limit?: number;
}

export interface ScoredCard {
  card: TeachingMechanic;
  score: number;
  targetsMisconception: string | null;
  implemented: boolean;
}

// ---------------------------------------------------------------- tokens

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "did", "do", "does", "for", "from",
  "had", "has", "have", "how", "if", "in", "into", "is", "it", "its", "may", "of", "on", "or", "our",
  "over", "same", "she", "should", "so", "some", "such", "than", "that", "the", "their", "them", "then",
  "there", "these", "they", "this", "those", "to", "under", "up", "was", "we", "were", "what", "when",
  "where", "which", "who", "why", "will", "with", "would", "you", "your", "not", "no", "any", "all",
  "each", "other", "his", "her", "him", "one", "two", "also", "than", "into", "onto", "per", "via",
  "vs", "about", "after", "before", "between", "during",
]);

/** Small synonym map so near-equivalent phrasing scores as a match. Applied after tokenizing. */
const SYNONYMS: Record<string, string> = {
  sin: "sine",
  cos: "cosine",
  tan: "tangent",
  eqn: "equation",
  eqns: "equation",
  ww1: "world war i",
  wwi: "world war i",
  ww2: "world war ii",
  wwii: "world war ii",
  deriv: "derivative",
  derivatives: "derivative",
  integrals: "integral",
  probability: "chance",
  chances: "chance",
  fractions: "fraction",
  photosynthesis: "photosynthesis",
  govt: "government",
  govenment: "government",
};

function singularize(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  // Drop only the trailing "s" (not "es"): "causes" -> "cause", "fractions" -> "fraction".
  // Imperfect for a handful of -es plurals (box/boxes), but keeps the mapping consistent both
  // directions, which is what token overlap needs.
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Lowercase, split on non-letters, strip stopwords, strip plurals, apply the synonym map. */
export function tokens(text: string): string[] {
  const words = text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
  const out: string[] = [];
  for (const w of words) {
    const singular = singularize(w);
    const mapped = SYNONYMS[w] ?? SYNONYMS[singular] ?? singular;
    // a synonym target that is itself a phrase ("world war i") expands to multiple tokens
    for (const piece of mapped.split(" ")) if (piece.length > 0) out.push(piece);
  }
  return out;
}

export function jaccard(a: Iterable<string>, b: Iterable<string>): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ---------------------------------------------------------------- scoring

function domainScore(cardDomain: Domain, queryDomain: Domain): number {
  if (cardDomain === queryDomain) return 3;
  if (cardDomain === "general" || queryDomain === "general") return 1.5;
  return 0;
}

export function scoreCard(card: TeachingMechanic, q: RetrievalQuery): ScoredCard {
  const conceptTokens = tokens(
    [q.concept.name, q.concept.summary, ...q.concept.keywords, q.topic].join(" "),
  );
  const cardTokens = tokens([card.concept, ...card.keywords].join(" "));
  const conceptSim = jaccard(conceptTokens, cardTokens);

  const knowledgeTypeMatch = card.knowledgeTypes.includes(q.concept.knowledgeType) ? 1 : 0;

  let bestMisconceptionJaccard = 0;
  let bestBelief: string | null = null;
  const cardMisconceptionTokens = tokens(card.misconception);
  for (const m of q.concept.misconceptions) {
    const j = jaccard(tokens(m.belief), cardMisconceptionTokens);
    if (j > bestMisconceptionJaccard) {
      bestMisconceptionJaccard = j;
      bestBelief = m.belief;
    }
  }

  const score =
    3 * domainScore(card.domain, q.domain) +
    2 * conceptSim +
    2 * knowledgeTypeMatch +
    3 * bestMisconceptionJaccard +
    0.5 * (card.flagship ? 1 : 0);

  return {
    card,
    score,
    targetsMisconception: bestMisconceptionJaccard > 0 ? bestBelief : null,
    implemented: isCardImplemented(card),
  };
}

export function retrieveCards(q: RetrievalQuery): { candidates: ScoredCard[]; wishlist: ScoredCard[] } {
  const limit = q.limit ?? 12;
  const includeUnimplemented = q.includeUnimplemented ?? false;

  const pool = q.genre !== undefined ? CARDS.filter((c) => cardPlaysIn(c, q.genre as Genre)) : CARDS;
  const scored = pool.map((card) => scoreCard(card, q)).sort((a, b) => b.score - a.score);

  const eligible = scored.filter((s) => includeUnimplemented || s.implemented);
  const candidates = eligible.slice(0, limit);

  const wishlist = scored
    .filter((s) => !s.implemented && s.score >= 4)
    .slice(0, 5);

  return { candidates, wishlist };
}
