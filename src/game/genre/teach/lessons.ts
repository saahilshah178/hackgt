import type { Genre } from "../../../contracts/common";
import type { Encounter, GameSpec, Lesson } from "../../../contracts/gamespec";

/*
 * Pure helpers behind the teaching layer of the board genres (LessonCard, FieldGuide, the review link after a
 * mistake): which lesson belongs to which concept, which concepts an encounter still has to teach, who teaches them,
 * how a mathjs formula reads on a projector, and the genre-flavoured wording that frames a lesson in each host.
 * No React here, so Vitest covers it directly (tests/teach-lessons.test.ts).
 */

type SpecLike = Pick<GameSpec, "concepts" | "characters"> & { lessons?: GameSpec["lessons"] };
type Concept = GameSpec["concepts"][number];
type Character = GameSpec["characters"][number];

/** The lesson for a concept that the spec has none for (specs made before lessons): its name and objective only. */
export function fallbackLesson(concept: Concept): Lesson {
  return {
    conceptId: concept.id,
    bigIdea: concept.learningObjective,
    explanation: null,
    keyPoints: [],
    formula: null,
    example: null,
    watchOut: null,
    teacherId: null,
  };
}

/** One lesson per concept, keyed by concept id: the spec's own lesson when it has one, otherwise the fallback. */
export function lessonMap(spec: SpecLike): Map<string, Lesson> {
  const given = new Map((spec.lessons ?? []).map((l) => [l.conceptId, l]));
  return new Map(spec.concepts.map((c) => [c.id, given.get(c.id) ?? fallbackLesson(c)]));
}

export interface GuideEntry {
  concept: Concept;
  lesson: Lesson;
}

/** The Field Guide's entries: every concept in spec order with its lesson. */
export function guideEntries(spec: SpecLike): GuideEntry[] {
  const lessons = lessonMap(spec);
  return spec.concepts.map((c) => ({ concept: c, lesson: lessons.get(c.id)! }));
}

/**
 * The concepts an encounter still has to teach before its challenge: its concept ids (in order, de-duplicated) that
 * are known to the spec and have not been taught this session.
 */
export function conceptsToTeach(encounter: Pick<Encounter, "conceptIds">, taught: ReadonlySet<string>, spec: Pick<GameSpec, "concepts">): string[] {
  const known = new Set(spec.concepts.map((c) => c.id));
  return [...new Set(encounter.conceptIds)].filter((id) => known.has(id) && !taught.has(id));
}

/** Who teaches a lesson: its teacherId when that character exists, else the game's first character (or null). */
export function teacherFor(spec: Pick<GameSpec, "characters">, lesson: Pick<Lesson, "teacherId">): Character | null {
  return (lesson.teacherId ? spec.characters.find((c) => c.id === lesson.teacherId) : undefined) ?? spec.characters[0] ?? null;
}

/**
 * The warning to show under a wrong answer: the watch-out of the encounter's concept whose classic mistake is the one
 * the encounter targets, else the first of its concepts that has a watch-out.
 */
export function watchOutFor(
  encounter: Pick<Encounter, "conceptIds" | "targetMisconception">,
  lessons: ReadonlyMap<string, Lesson>,
): { conceptId: string; mistake: string; fix: string } | null {
  const withWatch = encounter.conceptIds.map((id) => lessons.get(id)).filter((l): l is Lesson => !!l?.watchOut);
  const norm = (s: string) => s.trim().toLowerCase().replace(/[.\s]+$/, "");
  const target = encounter.targetMisconception ? norm(encounter.targetMisconception) : null;
  const hit = (target ? withWatch.find((l) => norm(l.watchOut!.mistake) === target) : undefined) ?? withWatch[0];
  return hit ? { conceptId: hit.conceptId, ...hit.watchOut! } : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// formulas

const GREEK: Record<string, string> = {
  pi: "π",
  theta: "θ",
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  lambda: "λ",
  mu: "μ",
  sigma: "σ",
  omega: "ω",
  phi: "φ",
  tau: "τ",
  rho: "ρ",
  epsilon: "ε",
  Delta: "Δ",
  Sigma: "Σ",
  Omega: "Ω",
};
const SUPERSCRIPT: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };

/** Index of the paren that closes the one at `open`, or -1. */
function closingParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")" && --depth === 0) return i;
  }
  return -1;
}

/** Rewrites every `name(...)` call with balanced parens through `fn(inner)`, innermost arguments first. */
function rewriteCalls(s: string, name: string, fn: (inner: string) => string): string {
  const re = new RegExp(`\\b${name}\\(`);
  let out = s;
  for (let guard = 0; guard < 50; guard++) {
    const m = re.exec(out);
    if (!m) break;
    const open = m.index + name.length;
    const close = closingParen(out, open);
    if (close < 0) break;
    const inner = rewriteCalls(out.slice(open + 1, close), name, fn);
    out = out.slice(0, m.index) + fn(inner) + out.slice(close + 1);
  }
  return out;
}

/**
 * A mathjs expression as a reader would write it: `*` → `·`, `pi` → `π` (and other Greek names), `sqrt(x)` → `√(x)`,
 * `abs(x)` → `|x|`, integer powers as superscripts (`x^2` → `x²`), `<=`/`>=`/`!=` → `≤`/`≥`/`≠`, binary minus → `−`.
 * Unknown syntax passes through untouched, so the result is never worse than the input.
 */
export function prettyFormula(expression: string): string {
  let s = expression.trim().replace(/\s+/g, " ");
  s = rewriteCalls(s, "abs", (x) => `|${x.trim()}|`);
  s = rewriteCalls(s, "sqrt", (x) => `√(${x.trim()})`);
  s = s.replace(/\^\s*\(\s*(-?\d+)\s*\)|\^\s*(-?\d+)(?![\d.])/g, (_m, a: string | undefined, b: string | undefined) =>
    [...(a ?? b ?? "")].map((ch) => SUPERSCRIPT[ch] ?? ch).join(""),
  );
  s = s.replace(/\b([A-Za-z]+)\b/g, (w) => GREEK[w] ?? w);
  s = s.replace(/\s*<=\s*/g, " ≤ ").replace(/\s*>=\s*/g, " ≥ ").replace(/\s*!=\s*/g, " ≠ ");
  s = s.replace(/\s*\*\s*/g, " · ");
  // a minus with a space on both sides is binary: typographic minus sign
  s = s.replace(/ - /g, " − ");
  return s.replace(/\s+/g, " ").trim();
}

/** "degrees to radians" → "Degrees to radians". */
export function sentenceCase(s: string): string {
  const t = s.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

// ---------------------------------------------------------------------------------------------------------------------
// genre framing

export interface LessonFrame {
  /** style family the card uses (CSS hook) */
  look: "sign" | "note" | "casefile" | "letter" | "briefing";
  /** the small uppercase label over the card */
  kicker: string;
  /** one framing line that puts the teacher in the scene */
  byline(teacher: string, role: string | null): string;
  /** a sign-off under the card, or null */
  signoff(teacher: string): string | null;
  /** the Field Guide's subtitle in this genre */
  guideSubtitle: string;
}

/** Deterministic pick of a phrasing, so a concept always reads the same but concepts differ from one another. */
function variant<T>(options: readonly T[], key: string): T {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return options[(h >>> 0) % options.length];
}

/** How a lesson is framed in each host's world. `key` (the concept id) varies the wording between lessons. */
export function lessonFrame(genre: Genre, key: string): LessonFrame {
  switch (genre) {
    case "explorer":
      return {
        look: "sign",
        kicker: variant(["Trail sign", "Waymarker", "Signpost"], key),
        byline: (t) => variant([`${t} nailed this up for travellers on this road.`, `Carved by ${t}, who walked this way before you.`, `A note in ${t}'s hand, pinned where you can't miss it.`], key),
        signoff: (t) => `— ${t}`,
        guideSubtitle: "Every trail sign on the road, copied into one book.",
      };
    case "strategy":
      return {
        look: "note",
        kicker: variant(["Village know-how", "A word before you help", "From the town noticeboard"], key),
        byline: (t) => variant([`${t} pulls up a chair: "Here is what you need before you help."`, `${t} leans over the desk: "Let me show you how this works first."`, `${t} tapped this to the noticeboard for newcomers.`], key),
        signoff: () => null,
        guideSubtitle: "The village almanac: everything the neighbours taught you.",
      };
    case "mystery":
      return {
        look: "casefile",
        kicker: variant(["Case notes", "Background file", "Partner's briefing"], key),
        byline: (t) => variant([`From ${t}'s notebook. Read this before you crack the lead.`, `${t} slides a folder across the desk: "The facts first."`, `${t}'s notes on the case so far.`], key),
        signoff: (t) => `Filed by ${t}`,
        guideSubtitle: "Your partner's case notes, one file per fact of the case.",
      };
    case "story":
      return {
        look: "letter",
        kicker: variant(["A letter", "From the mentor's journal", "A page tucked in the book"], key),
        byline: (t) => variant([`A letter from ${t}, left between the pages.`, `${t} wrote this in the margin of the journal.`, `A folded page in ${t}'s handwriting.`], key),
        signoff: (t) => `Yours, ${t}`,
        guideSubtitle: "Every letter and journal page, gathered in one place.",
      };
    default:
      return {
        look: "briefing",
        kicker: "Briefing",
        byline: (t) => `${t} explains before you begin.`,
        signoff: () => null,
        guideSubtitle: "Everything this game teaches, in one place.",
      };
  }
}

/** A short monogram for a character's avatar ("The Editor" → "E", "Ida" → "I", "Mrs. Park" → "P"). */
export function monogram(name: string): string {
  const words = name
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !/^(the|mr|mrs|ms|dr|prof)$/i.test(w));
  return (words[0]?.[0] ?? name.trim()[0] ?? "?").toUpperCase();
}

/** The one line each host shows on its first screen so the player knows the guide exists. */
export const GUIDE_TIP = "Stuck? Open the Field guide (G) any time.";
