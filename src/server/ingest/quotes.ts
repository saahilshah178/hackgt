import type { Concept, KnowledgeMap } from "../../contracts/knowledge";
import type { PageRecord } from "../../contracts/storage";

/*
 * Quote verification (S2): the Curriculum agent cites a page + quote for each fact; before the
 * KnowledgeMap is trusted, code confirms the quote actually appears on that page. A concept can end
 * up with an empty facts[] — it is never dropped, only its unverified facts are.
 */

const SOFT_HYPHEN = "­";
const QUOTE_CHARS: [RegExp, string][] = [
  [/[‘’‚‛′]/g, "'"],
  [/[“”„‟″]/g, '"'],
  [/[–—−]/g, "-"],
];

/**
 * Normalizes text for quote matching: Unicode NFKC, lowercase, unify curly quotes/dashes to
 * straight ones, drop soft hyphens and hyphenation across a line break ("com-\nplete" -> "complete"),
 * then collapse all whitespace (including real newlines) to single spaces and trim.
 */
export function normalizeForMatch(s: string): string {
  let out = s.normalize("NFKC").toLowerCase();
  for (const [pattern, replacement] of QUOTE_CHARS) out = out.replace(pattern, replacement);
  out = out.replaceAll(SOFT_HYPHEN, "");
  out = out.replace(/-\s*\n\s*/g, ""); // de-hyphenate a word split across a line break
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

/** True when `quote` (normalized) appears as a substring of `pageText` (normalized). */
export function findQuote(pageText: string, quote: string): boolean {
  const needle = normalizeForMatch(quote);
  if (!needle) return false;
  return normalizeForMatch(pageText).includes(needle);
}

export interface DroppedFact {
  conceptId: string;
  page: number;
  quote: string;
}

export interface VerifyResult {
  km: KnowledgeMap;
  verified: number;
  dropped: DroppedFact[];
}

/**
 * Drops any fact whose sourceRef quote does not appear on its cited page. A fact with no sourceRef
 * (unsourced topics) is kept as-is. A concept may end up with an empty facts[] — it is never dropped.
 */
export function verifyKnowledgeMapQuotes(km: KnowledgeMap, pages: readonly PageRecord[]): VerifyResult {
  const textByPage = new Map(pages.map((p) => [p.page, p.text]));
  let verified = 0;
  const dropped: DroppedFact[] = [];

  const concepts: Concept[] = km.concepts.map((concept) => {
    const facts = concept.facts.filter((fact) => {
      if (!fact.sourceRef) return true; // nothing to verify
      const pageText = textByPage.get(fact.sourceRef.page);
      const ok = pageText !== undefined && findQuote(pageText, fact.sourceRef.quote);
      if (ok) {
        verified++;
      } else {
        dropped.push({ conceptId: concept.id, page: fact.sourceRef.page, quote: fact.sourceRef.quote });
      }
      return ok;
    });
    return { ...concept, facts };
  });

  return { km: { ...km, concepts }, verified, dropped };
}
