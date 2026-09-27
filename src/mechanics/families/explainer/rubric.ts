/*
 * explainer · rubric: the deterministic grader behind teach_back (no LLM at play time).
 *
 * Pipeline: normalise (NFKC, lowercase, apostrophes dropped so "doesn't" → "doesnt", every other non-letter/number
 * becomes a space) → split into clauses at . , ; : ! ? and newlines (negation never crosses a clause) → tokenise →
 * light, conservative stemming (plurals, -ed, -ing, -ly, a trailing silent e, a doubled final consonant, y → i).
 * A keyword phrase matches when its stemmed tokens appear consecutively inside one clause. A match whose three
 * preceding tokens (same clause) contain a negator is "negated" and never counts. Long tokens (7+ characters,
 * same first letter) tolerate one typo.
 *
 * Everything here is pure and unit-tested in rubric.test.ts. The client never receives keywords: grade() runs on
 * the server/runner side only, and the widget's meter measures effort (length/structure), not correctness.
 */

/** Input beyond this many characters is ignored (a keyword dump gets no further than an honest answer). */
export const MAX_EXPLANATION_CHARS = 1200;
/** Fewer words than this is not an explanation, whatever it contains. */
export const MIN_EXPLANATION_WORDS = 4;
/** How many tokens before a phrase a negator may sit and still negate it. */
export const NEGATION_WINDOW = 3;

/** Normalised (apostrophe-free) negators. */
export const NEGATORS: ReadonlySet<string> = new Set([
  "not",
  "no",
  "never",
  "doesnt",
  "dont",
  "didnt",
  "isnt",
  "arent",
  "wasnt",
  "werent",
  "wont",
  "cant",
  "cannot",
  "couldnt",
  "shouldnt",
  "wouldnt",
  "hasnt",
  "havent",
  "without",
]);

/** Lowercase, NFKC, apostrophes dropped, other punctuation → space, whitespace collapsed. Unicode letters survive. */
export function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’ʼ'`´]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clauses of raw (normalised, unstemmed) tokens. Clause breaks: . , ; : ! ? newlines and similar marks. */
export function clauses(text: string): string[][] {
  return text
    .normalize("NFKC")
    .split(/[.,;:!?\n\r…。，；：！？()[\]{}—–]+/u)
    .map((c) => normalize(c))
    .filter((c) => c.length > 0)
    .map((c) => c.split(" "));
}

/** Flat token list of a phrase (no clause structure). */
export function tokenize(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

const VOWEL = /[aeiouy]/;
const NO_UNDOUBLE = new Set(["l", "s", "z"]);

function isConsonant(ch: string): boolean {
  return /\p{L}/u.test(ch) && !VOWEL.test(ch);
}

/**
 * Light stemmer. Conservative on purpose: it only has to map a word and its inflections onto the same string
 * (both the keyword and the student's words go through it), not produce a dictionary root.
 *   cells → cell · swelled/swelling/swells → swell · causes/caused/causing/cause → caus · studies/studied → studi
 *   stopped → stop · boycotted/boycott → boycot · quickly → quick · processes → process · virus/viruses → virus
 * Tokens of 3 characters or fewer are returned unchanged; digits are never stemmed.
 */
export function stem(token: string): string {
  let w = token;
  if (w.length <= 3 || /\d/.test(w)) return w;

  // 1. inflection (at most one rule)
  if (w.endsWith("ies") && w.length > 4) w = `${w.slice(0, -3)}y`;
  else if (w.endsWith("ied") && w.length > 4) w = `${w.slice(0, -3)}y`;
  else if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (w.endsWith("ing") && w.length - 3 >= 3 && VOWEL.test(w.slice(0, -3))) w = w.slice(0, -3);
  else if (w.endsWith("ed") && !w.endsWith("eed") && w.length - 2 >= 3 && VOWEL.test(w.slice(0, -2))) w = w.slice(0, -2);
  else if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) w = w.slice(0, -1);

  // 2. adverbs
  if (w.endsWith("ly") && w.length - 2 >= 4) w = w.slice(0, -2);

  // 3. doubled final consonant (stopp → stop, boycott → boycot), but not ll / ss / zz
  if (w.length >= 4) {
    const a = w[w.length - 1];
    if (a === w[w.length - 2] && isConsonant(a) && !NO_UNDOUBLE.has(a)) w = w.slice(0, -1);
  }
  // 4. silent final e (cause → caus), but keep "ee"
  if (w.length >= 4 && w.endsWith("e") && !w.endsWith("ee")) w = w.slice(0, -1);
  // 5. y → i (study → studi, matching studies → study → studi)
  if (w.length >= 4 && w.endsWith("y")) w = `${w.slice(0, -1)}i`;
  return w;
}

export function stemPhrase(phrase: string): string[] {
  return tokenize(phrase).map(stem);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Stemmed-token equality, with one typo allowed when both are 7+ characters and share the first letter. */
export function tokenMatches(given: string, wanted: string): boolean {
  if (given === wanted) return true;
  if (given.length < 7 || wanted.length < 7 || given[0] !== wanted[0]) return false;
  if (Math.abs(given.length - wanted.length) > 1) return false;
  return levenshtein(given, wanted) <= 1;
}

/** A text prepared once for many phrase lookups. */
export interface PreparedText {
  /** per clause: the raw (normalised) tokens, used for negator lookup */
  raw: string[][];
  /** per clause: stemmed tokens, used for phrase matching */
  stemmed: string[][];
  wordCount: number;
}

export function prepare(text: string): PreparedText {
  const raw = clauses(text);
  return { raw, stemmed: raw.map((c) => c.map(stem)), wordCount: raw.reduce((n, c) => n + c.length, 0) };
}

export interface PhraseHit {
  clause: number;
  index: number;
  negated: boolean;
}

/** Every occurrence of the phrase (consecutive stemmed tokens within one clause), with its negation status. */
export function findPhrase(text: PreparedText, phrase: string): PhraseHit[] {
  const want = stemPhrase(phrase);
  if (want.length === 0) return [];
  const hits: PhraseHit[] = [];
  text.stemmed.forEach((tokens, clause) => {
    for (let i = 0; i + want.length <= tokens.length; i++) {
      let ok = true;
      for (let k = 0; k < want.length && ok; k++) ok = tokenMatches(tokens[i + k], want[k]);
      if (!ok) continue;
      const before = text.raw[clause].slice(Math.max(0, i - NEGATION_WINDOW), i);
      hits.push({ clause, index: i, negated: before.some((t) => NEGATORS.has(t)) });
    }
  });
  return hits;
}

/** True when any keyword occurs un-negated. */
export function matchesAnyKeyword(text: PreparedText, keywords: readonly string[]): boolean {
  return keywords.some((k) => findPhrase(text, k).some((h) => !h.negated));
}

/** True when any keyword occurs at all, negated or not (used by check(): a follow-up must not say the words). */
export function mentionsAnyKeyword(text: string, keywords: readonly string[]): string | null {
  const prepared = prepare(text);
  return keywords.find((k) => findPhrase(prepared, k).length > 0) ?? null;
}

/** True when phrase a's stemmed tokens appear consecutively inside b's (or vice versa). */
export function phrasesOverlap(a: string, b: string): boolean {
  const x = stemPhrase(a);
  const y = stemPhrase(b);
  if (x.length === 0 || y.length === 0) return false;
  const inside = (short: string[], long: string[]) => {
    for (let i = 0; i + short.length <= long.length; i++) if (short.every((t, k) => long[i + k] === t)) return true;
    return false;
  };
  return x.length <= y.length ? inside(x, y) : inside(y, x);
}

export interface RubricIdea {
  label: string;
  keywords: readonly string[];
  followUp: string;
}
export interface RubricMisconception {
  keywords: readonly string[];
  correction: string;
}
export interface Rubric {
  ideas: readonly RubricIdea[];
  required: number;
  misconceptions: readonly RubricMisconception[];
}

export interface RubricResult {
  /** "empty" and "too_short" are effort failures; the rest are content results */
  status: "empty" | "too_short" | "misconception" | "missing" | "pass";
  correct: boolean;
  /** idea indices that landed, in idea order */
  matched: number[];
  /** idea indices still missing, in idea order */
  missing: number[];
  /** index of the first misconception heard, or null */
  misconception: number | null;
  wordCount: number;
}

/** Scores an explanation against the rubric. Pure; input beyond MAX_EXPLANATION_CHARS is ignored. */
export function scoreExplanation(rubric: Rubric, input: unknown): RubricResult {
  const text = typeof input === "string" ? input.slice(0, MAX_EXPLANATION_CHARS) : "";
  const prepared = prepare(text);
  const base = { matched: [] as number[], missing: rubric.ideas.map((_, i) => i), misconception: null, wordCount: prepared.wordCount };
  if (prepared.wordCount === 0) return { ...base, status: "empty", correct: false };
  if (prepared.wordCount < MIN_EXPLANATION_WORDS) return { ...base, status: "too_short", correct: false };

  const matched: number[] = [];
  const missing: number[] = [];
  rubric.ideas.forEach((idea, i) => (matchesAnyKeyword(prepared, idea.keywords) ? matched : missing).push(i));
  const mIndex = rubric.misconceptions.findIndex((m) => matchesAnyKeyword(prepared, m.keywords));
  const misconception = mIndex >= 0 ? mIndex : null;
  if (misconception !== null) return { status: "misconception", correct: false, matched, missing, misconception, wordCount: prepared.wordCount };
  const pass = matched.length >= rubric.required;
  return { status: pass ? "pass" : "missing", correct: pass, matched, missing, misconception: null, wordCount: prepared.wordCount };
}
