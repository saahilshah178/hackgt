/** Fuzzy answer matching shared by the recall modes: case/space/punctuation-insensitive, one typo allowed on longer answers. */
export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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

/** True when `given` matches any accepted answer: exact after normalization, or within 1 edit for answers of 5+ characters (2 edits for 10+). */
export function matchesAny(given: string, accepted: readonly string[]): boolean {
  const g = normalizeAnswer(given);
  if (!g) return false;
  return accepted.some((a) => {
    const n = normalizeAnswer(a);
    if (n === g) return true;
    const budget = n.length >= 10 ? 2 : n.length >= 5 ? 1 : 0;
    return budget > 0 && levenshtein(g, n) <= budget;
  });
}
