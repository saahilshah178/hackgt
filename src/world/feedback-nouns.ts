/**
 * src/world/feedback-nouns.ts (V1) — display-only noun swaps on grade() feedback (docs/design/20 §2.5.4, amendment 36).
 *
 * Whole-word, case-preserving replacement, longest `from` first, applied only to display text ("That chest was
 * honest" → "That singer was honest"). Grading, telemetry and the debrief keep the original text. Pure.
 */
import type { FeedbackNoun } from "../contracts/world";

export interface NounSwap {
  from: string;
  to: string;
}

/** The swaps that apply to one station: entries with `stations: null` (every station) or listing the encounter. */
export function feedbackNounsFor(nouns: readonly Pick<FeedbackNoun, "from" | "to" | "stations">[], encounterId: string): NounSwap[] {
  return nouns.filter((n) => n.stations === null || n.stations.includes(encounterId)).map(({ from, to }) => ({ from, to }));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** Carries the case pattern of `matched` onto `to`: ALL CAPS, Capitalized, or as written. */
export function matchCase(matched: string, to: string): string {
  if (matched.length > 1 && matched === matched.toUpperCase() && matched !== matched.toLowerCase()) return to.toUpperCase();
  const first = matched.charAt(0);
  if (first !== first.toLowerCase() && first === first.toUpperCase()) return to.charAt(0).toUpperCase() + to.slice(1);
  return to;
}

/**
 * Applies the swaps to `text`: whole words only (letters/digits/apostrophes bound a word), case-insensitive match,
 * case-preserving output, longest `from` first, each position replaced at most once ("chest" → "singer" never
 * re-matches inside a later swap's output).
 */
export function applyFeedbackNouns(text: string, swaps: readonly NounSwap[]): string {
  const sorted = [...swaps].filter((s) => s.from.length > 0).sort((a, b) => b.from.length - a.from.length);
  if (sorted.length === 0) return text;
  const alt = sorted.map((s) => escapeRe(s.from)).join("|");
  const re = new RegExp(`(?<![\\p{L}\\p{N}'’])(${alt})(?![\\p{L}\\p{N}'’])`, "giu");
  return text.replace(re, (m) => {
    const hit = sorted.find((s) => s.from.toLowerCase() === m.toLowerCase());
    return hit ? matchCase(m, hit.to) : m;
  });
}
