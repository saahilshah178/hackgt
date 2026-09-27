/**
 * src/world/text-style.ts — the machine-checkable part of docs/WRITING.md and docs/HINTS.md. Pure.
 * The docs are the standard; these checks only catch the patterns a regex can see. The Challenge Writer and the
 * Narrative Writer repair on them (src/pipeline/validate/checks.ts); validateWorld reports them under R9.
 */

/** Only words that are almost never needed in our games; subject words like "journey" or "vital" stay legal. */
const BUZZWORDS = ["delve", "delves", "embark", "tapestry", "testament", "unleash", "elevate", "seamless", "seamlessly", "behold", "dive in"];

/** Hints that would fit any problem (docs/HINTS.md §3). */
const VAGUE_HINTS: RegExp[] = [
  /\bthink about what\b.*\bmeans?\b/i,
  /\bread (the question|the prompt|it|each claim) carefully\b/i,
  /\bremember the definition\b/i,
  /\byou('ve| have) got this\b/i,
  /\btake your time\b/i,
  /\bthink carefully\b/i,
];

/** A sentence longer than this is an error; docs/WRITING.md aims for 12. */
export const MAX_SENTENCE_WORDS = 20;
export const MAX_HINT_WORDS = 24;

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Problems with one spoken or displayed line (docs/WRITING.md §2-3). Empty when the line is fine. */
export function textStyleProblems(text: string): string[] {
  const out: string[] = [];
  if (text.includes("—")) out.push("uses an em dash; split it into two short sentences");
  if (text.includes(";")) out.push("uses a semicolon; split it into two short sentences");
  if (/[A-Za-z)]:\s/.test(text)) out.push("uses a colon to join two ideas; split it into two short sentences");
  const lower = text.toLowerCase();
  for (const w of BUZZWORDS) {
    if (new RegExp(`\\b${w}\\b`).test(lower)) out.push(`uses "${w}"; say it in everyday words`);
  }
  for (const s of sentencesOf(text)) {
    const n = wordCount(s);
    if (n > MAX_SENTENCE_WORDS) out.push(`has a ${n}-word sentence; keep sentences to ${MAX_SENTENCE_WORDS} words or fewer (aim for 12)`);
  }
  return out;
}

/** Problems with a problem's hint ladder (docs/HINTS.md §3). Answer leaks are checked separately. */
export function hintLadderProblems(hints: readonly string[], prompt: string): string[] {
  const out: string[] = [];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9π]+/g, " ").trim();
  const seen = new Set<string>();
  hints.forEach((h, i) => {
    const label = `hint ${i + 1}`;
    if (VAGUE_HINTS.some((re) => re.test(h))) out.push(`${label} is too vague to help; point at something in this problem (docs/HINTS.md)`);
    if (wordCount(h) > MAX_HINT_WORDS) out.push(`${label} is ${wordCount(h)} words; keep hints to 20`);
    const n = norm(h);
    if (n && n === norm(prompt)) out.push(`${label} repeats the prompt; add something new`);
    if (n && seen.has(n)) out.push(`${label} repeats an earlier hint; each hint must add something new`);
    seen.add(n);
  });
  return out;
}
