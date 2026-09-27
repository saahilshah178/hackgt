import type { GameSpec } from "../../../../contracts/gamespec";
import type { Progression } from "../../../runner/progression";

/*
 * Pure logic for the story host ("an illustrated book / reporter's notebook"). Nothing here touches the DOM or the
 * clock, so a spec always reads the same way:
 *
 * - chapters: the progression's tiers, grouped into 2-5 chapters and titled from the units and concepts inside them;
 * - threads: the progression's tracks, one coloured ribbon each;
 * - choice cards: a verb phrase templated from the encounter's socket plus a one-line teaser from its prompt;
 * - the passage log: prologue, chapter openings, scenes, resolutions, gentle stumbles and the epilogue, assembled from
 *   an event list the host records as the player moves through the book;
 * - the ending, chosen from the first-try rate;
 * - book colours derived from the palette (a lit page on every palette, ink that keeps its contrast).
 */

type Spec = Pick<GameSpec, "title" | "premise" | "theme" | "characters" | "units" | "concepts" | "encounters" | "narrative">;

// ---------------------------------------------------------------------------------------------------------------
// text helpers

/** "Origins (1954–1957)" → { short: "Origins", tag: "1954–1957" }; names without a trailing parenthetical keep tag null. */
export function splitName(name: string): { short: string; tag: string | null } {
  const m = /^(.*\S)\s*\(([^()]+)\)\s*$/.exec(name.trim());
  if (!m) return { short: name.trim(), tag: null };
  return { short: m[1].trim(), tag: m[2].trim() };
}

/** Removes anything that would leak template syntax or placeholder words into story text. */
export function cleanText(text: string): string {
  return text
    .replace(/\{\{[^}]*\}\}/g, "…")
    .replace(/\s+/g, " ")
    .trim();
}

/** The first sentence of `text`, cut at a word boundary to at most `max` characters (with an ellipsis). */
export function firstSentence(text: string, max = 110): string {
  const t = cleanText(text);
  const m = /^(.+?[.!?])(?=\s+[A-Z0-9“"'‘(]|\s*$)/.exec(t);
  let s = (m ? m[1] : t).trim();
  if (s.length > max) {
    const cut = s.slice(0, max - 1);
    const space = cut.lastIndexOf(" ");
    s = `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:–—-]+$/, "")}…`;
  }
  return s;
}

/** "A, B and C" */
export function listText(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Small stable string hash (FNV-1a) so template choice is deterministic per encounter. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function pick<T>(items: readonly T[], key: string): T {
  return items[hashString(key) % items.length];
}

function characterName(spec: Spec, id: string): string {
  return spec.characters.find((c) => c.id === id)?.name ?? id;
}

function conceptName(spec: Spec, id: string): string {
  return spec.concepts.find((c) => c.id === id)?.name ?? id.replace(/^c_/, "").replace(/_/g, " ");
}

function encounterOf(spec: Spec, id: string) {
  return spec.encounters.find((e) => e.id === id);
}

/** The encounter's main concept, short form ("Brown v. Board of Education"), and its tag ("1954"). */
export function encounterTopic(spec: Spec, id: string): { short: string; full: string; tag: string | null } {
  const e = encounterOf(spec, id);
  const full = e ? conceptName(spec, e.conceptIds[0]) : id;
  const { short, tag } = splitName(full);
  return { short, full, tag };
}

function beatsOf(spec: Spec, id: string, when: "before" | "after") {
  return spec.narrative.beats.filter((b) => b.encounterId === id && b.when === when);
}

/** Who you talk to at this encounter: its first "before" speaker, else the first character. */
export function speakerFor(spec: Spec, id: string): string {
  const b = beatsOf(spec, id, "before")[0];
  return b ? characterName(spec, b.speakerId) : (spec.characters[0]?.name ?? "your guide");
}

/** The mentor who reacts to a stumble: the first character. */
export function mentorName(spec: Spec): string {
  return spec.characters[0]?.name ?? "Your guide";
}

/** The voice waiting for the final story: the boss's "before" speaker, else the last character. */
export function judgeName(spec: Spec): string {
  const boss = [...spec.encounters].reverse().find((e) => e.role === "boss");
  const b = boss ? beatsOf(spec, boss.id, "before")[0] : undefined;
  if (b) return characterName(spec, b.speakerId);
  return spec.characters[spec.characters.length - 1]?.name ?? "The editor";
}

/**
 * Places named in the setting ("…: kitchens, church basements, lunch counters and courthouse steps"), lowercased and
 * without leading articles. Empty when the setting is not a list of places after a colon.
 */
export function settingPlaces(setting: string): string[] {
  const i = setting.indexOf(":");
  if (i === -1) return [];
  return setting
    .slice(i + 1)
    .split(/,|\band\b|;/)
    .map((p) => p.trim().replace(/^(a|an|the)\s+/i, "").replace(/[.!?]+$/, ""))
    .filter((p) => p.length >= 3 && p.length <= 40 && !/[{}]/.test(p))
    .map((p) => (/^[A-Z][a-z]/.test(p) && !/^[A-Z][a-z]+\s[A-Z]/.test(p) ? p[0].toLowerCase() + p.slice(1) : p));
}

// ---------------------------------------------------------------------------------------------------------------
// sockets

export type VignetteKind = "dialogue" | "choice" | "letter" | "debate" | "journal" | "trial" | "climax" | "lead";

const STORY_SOCKETS: readonly VignetteKind[] = ["dialogue", "choice", "letter", "debate", "journal", "trial", "climax"];

/** The line-art vignette for a socket; sockets from other genres fall back by role. */
export function vignetteFor(socket: string, role?: string): VignetteKind {
  if ((STORY_SOCKETS as readonly string[]).includes(socket)) return socket as VignetteKind;
  if (role === "boss") return "climax";
  if (role === "review") return "journal";
  return "lead";
}

/** A short label for the socket ("A conversation", "A letter"), used as a card kicker. */
export function socketLabel(socket: string, role?: string): string {
  switch (vignetteFor(socket, role)) {
    case "dialogue":
      return "A conversation";
    case "choice":
      return "A decision";
    case "letter":
      return "A letter";
    case "debate":
      return "A meeting";
    case "journal":
      return "Your notes";
    case "trial":
      return "A hearing";
    case "climax":
      return "The last chapter";
    default:
      return "A new lead";
  }
}

export interface ChoiceText {
  /** "Sit down with Ida to talk about Brown v. Board of Education" */
  verb: string;
  /** the first sentence of the prompt, trimmed */
  teaser: string;
  /** the concept's parenthetical, e.g. a date ("1954"), or null */
  tag: string | null;
}

/** The choice card text for an encounter. Never contains template braces, "undefined" or "null". */
export function choiceText(spec: Spec, id: string): ChoiceText {
  const e = encounterOf(spec, id);
  const topic = encounterTopic(spec, id);
  const concept = topic.short;
  const socket = e?.socket ?? "";
  const role = e?.role;
  let verb: string;
  if (socket === "climax" || (role === "boss" && !(STORY_SOCKETS as readonly string[]).includes(socket))) verb = "Face the final question";
  else
    switch (socket) {
      case "dialogue":
        verb = `Sit down with ${speakerFor(spec, id)} to talk about ${concept}`;
        break;
      case "choice":
        verb = `Decide how to handle ${concept}`;
        break;
      case "letter":
        verb = `Open the letter about ${concept}`;
        break;
      case "debate":
        verb = `Speak at the meeting on ${concept}`;
        break;
      case "journal":
        verb = `Reread your notes on ${concept}`;
        break;
      case "trial":
        verb = `Testify at the hearing on ${concept}`;
        break;
      default:
        verb = role === "review" ? `Look back over ${concept}` : `Follow the lead on ${concept}`;
    }
  return { verb: cleanText(verb), teaser: e ? firstSentence(e.prompt) : "", tag: topic.tag };
}

// ---------------------------------------------------------------------------------------------------------------
// chapters and threads

export interface Chapter {
  index: number;
  /** encounter ids in this chapter, in progression tier order */
  ids: string[];
  /** "Origins", "First leads", "The final question" */
  title: string;
  /** concept names or a date span */
  subtitle: string;
  hasBoss: boolean;
}

const MIXED_TITLES = ["First leads", "Following the threads", "Where the threads cross", "Deeper in", "Loose ends"];
export const MAX_CHAPTERS = 5;

/**
 * Groups the progression's tiers into chapters: one per tier, merging the smallest adjacent pair (ties: the later
 * pair) until there are at most five. A single tier with several encounters is split in two so there are always at
 * least two chapters when there are at least two encounters.
 */
export function groupTiers(tiers: readonly (readonly string[])[]): string[][] {
  let groups = tiers.filter((t) => t.length > 0).map((t) => [...t]);
  if (groups.length === 1 && groups[0].length >= 2) {
    const g = groups[0];
    const half = Math.ceil(g.length / 2);
    groups = [g.slice(0, half), g.slice(half)];
  }
  while (groups.length > MAX_CHAPTERS) {
    let best = 0;
    for (let i = 1; i < groups.length - 1; i++) {
      if (groups[i].length + groups[i + 1].length <= groups[best].length + groups[best + 1].length) best = i;
    }
    groups = [...groups.slice(0, best), [...groups[best], ...groups[best + 1]], ...groups.slice(best + 2)];
  }
  return groups;
}

export function buildChapters(spec: Spec, progression: Pick<Progression, "tiers" | "bossId">): Chapter[] {
  const unitOfConcept = new Map(spec.concepts.map((c) => [c.id, c.unitId]));
  const unitName = new Map(spec.units.map((u) => [u.id, u.name]));
  const usedTitles = new Set<string>();
  let mixed = 0;
  return groupTiers(progression.tiers).map((ids, index) => {
    const hasBoss = progression.bossId !== null && ids.includes(progression.bossId);
    const concepts = ids.map((id) => encounterTopic(spec, id).short);
    const unique = [...new Set(concepts)];
    const conceptLine = unique.slice(0, 3).join(" · ") + (unique.length > 3 ? ` · and ${unique.length - 3} more` : "");
    let title: string;
    let subtitle = conceptLine;
    const counts = new Map<string, number>();
    for (const id of ids) {
      if (id === progression.bossId) continue;
      const e = encounterOf(spec, id);
      const u = e ? unitOfConcept.get(e.conceptIds[0]) : undefined;
      if (u) counts.set(u, (counts.get(u) ?? 0) + 1);
    }
    const regular = ids.length - (hasBoss ? 1 : 0);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const unit = top && top[1] * 2 > regular ? splitName(unitName.get(top[0]) ?? "") : null;
    if (hasBoss) {
      title = "The final question";
    } else if (unit && unit.short && !usedTitles.has(unit.short)) {
      title = unit.short;
      if (unit.tag) subtitle = `${unit.tag} · ${conceptLine}`;
    } else {
      title = MIXED_TITLES[Math.min(mixed, MIXED_TITLES.length - 1)];
      mixed++;
    }
    usedTitles.add(title);
    return { index, ids, title: cleanText(title), subtitle: cleanText(subtitle), hasBoss };
  });
}

export function chapterIndexOf(chapters: readonly Chapter[], id: string): number {
  return chapters.findIndex((c) => c.ids.includes(id));
}

/** The chapter the log last opened (0 before any): what the header shows while reading. */
export function lastOpenedChapter(log: readonly Passage[]): number {
  for (let i = log.length - 1; i >= 0; i--) if (log[i].kind === "chapter" && log[i].chapter !== undefined) return log[i].chapter!;
  return 0;
}

/** The chapter the story is "in": the first one with an unsolved encounter (the last one when all are solved). */
export function currentChapter(chapters: readonly Chapter[], solved: ReadonlySet<string>): number {
  const i = chapters.findIndex((c) => c.ids.some((id) => !solved.has(id)));
  return i === -1 ? Math.max(0, chapters.length - 1) : i;
}

export interface Thread {
  index: number;
  ids: string[];
  /** the unit of the track's first encounter, or its first concept */
  name: string;
}

export function buildThreads(spec: Spec, progression: Pick<Progression, "tracks">): Thread[] {
  const unitOfConcept = new Map(spec.concepts.map((c) => [c.id, c.unitId]));
  const unitName = new Map(spec.units.map((u) => [u.id, u.name]));
  const used = new Set<string>();
  return progression.tracks.map((ids, index) => {
    const e = encounterOf(spec, ids[0]);
    const unit = e ? unitName.get(unitOfConcept.get(e.conceptIds[0]) ?? "") : undefined;
    let name = unit ? splitName(unit).short : encounterTopic(spec, ids[0]).short;
    if (!name || used.has(name)) name = encounterTopic(spec, ids[0]).short;
    if (used.has(name)) name = `Thread ${index + 1}`;
    used.add(name);
    return { index, ids: [...ids], name: cleanText(name) };
  });
}

/** Encounters that `id` unlocks: not yet solved, require `id`, and have every other requirement solved. */
export function newlyUnlocked(progression: Pick<Progression, "nodes">, solvedBefore: ReadonlySet<string>, id: string): string[] {
  const after = new Set(solvedBefore);
  after.add(id);
  return progression.nodes.filter((n) => !after.has(n.id) && n.requires.includes(id) && n.requires.every((r) => after.has(r))).map((n) => n.id);
}

// ---------------------------------------------------------------------------------------------------------------
// passages

export type Para = { kind: "narration"; text: string } | { kind: "line"; speaker: string; text: string };

export type PassageKind = "prologue" | "chapter" | "scene" | "return" | "resolved" | "stumble" | "epilogue";

export interface Passage {
  key: string;
  kind: PassageKind;
  encounterId?: string;
  /** a heading (chapter title, "Prologue", ending title) */
  heading?: string;
  /** a small kicker above the heading ("Chapter 2") */
  kicker?: string;
  /** for chapter openings: the chapter's index */
  chapter?: number;
  /** render the first narration paragraph with a drop cap */
  dropCap?: boolean;
  vignette?: VignetteKind;
  paragraphs: Para[];
}

export function prologuePassage(spec: Spec): Passage {
  const paragraphs: Para[] = [{ kind: "narration", text: cleanText(spec.premise) }];
  for (const l of spec.narrative.intro) paragraphs.push({ kind: "line", speaker: characterName(spec, l.speakerId), text: cleanText(l.text) });
  paragraphs.push({ kind: "narration", text: cleanText(`${spec.theme.setting.replace(/[.\s]+$/, "")}.`) });
  return { key: "prologue", kind: "prologue", heading: cleanText(spec.title), kicker: "Prologue", dropCap: true, paragraphs };
}

export function chapterPassage(spec: Spec, chapter: Chapter, total: number): Passage {
  const topics = [...new Set(chapter.ids.map((id) => encounterTopic(spec, id).short))];
  const lead =
    chapter.hasBoss && chapter.ids.length === 1
      ? `Every page you have filled leads here. One question is left, and it is the one that matters.`
      : chapter.index === 0
        ? `The first ${topics.length === 1 ? "lead is" : "leads are"} ${listText(topics)}. Pick a thread and follow it; the others will wait.`
        : pick(
            [
              `New pages, new names: ${listText(topics)}.`,
              `The threads pull tighter. Ahead: ${listText(topics)}.`,
              `You turn to a fresh page. Waiting there: ${listText(topics)}.`,
            ],
            `${chapter.index}:${chapter.title}`,
          );
  return {
    key: `chapter-${chapter.index}`,
    kind: "chapter",
    chapter: chapter.index,
    kicker: `Chapter ${chapter.index + 1} of ${total}`,
    heading: chapter.title,
    dropCap: true,
    paragraphs: [{ kind: "narration", text: cleanText(lead) }],
  };
}

function sceneOpening(spec: Spec, id: string): string {
  const e = encounterOf(spec, id);
  const concept = encounterTopic(spec, id).short;
  const who = speakerFor(spec, id);
  switch (vignetteFor(e?.socket ?? "", e?.role)) {
    case "dialogue":
      return `${who} pulls up a chair across from you. The talk turns to ${concept}.`;
    case "choice":
      return `Two ways forward, and both run through ${concept}. You have to choose.`;
    case "letter":
      return `An envelope waits for you, addressed in a careful hand. Inside: ${concept}.`;
    case "debate":
      return `The room is full and loud. Tonight's question is ${concept}.`;
    case "journal":
      return `You flip back through your notebook to the pages on ${concept}.`;
    case "trial":
      return `The hearing room falls quiet. You are called to speak on ${concept}.`;
    case "climax":
      return `Everything you have written comes down to this.`;
    default:
      return `The next lead brings you to ${concept}.`;
  }
}

/** The scene written when the player chooses an encounter: an opening, the place, the "before" beats. */
export function scenePassage(spec: Spec, id: string): Passage {
  const e = encounterOf(spec, id);
  const paragraphs: Para[] = [{ kind: "narration", text: cleanText(sceneOpening(spec, id)) }];
  const places = settingPlaces(spec.theme.setting);
  if (places.length > 0 && e?.role !== "boss") {
    const index = spec.encounters.findIndex((x) => x.id === id);
    const place = places[(Math.max(0, index) + (hashString(spec.title) % places.length)) % places.length];
    const templates = [`The trail leads to the ${place}.`, `Your next stop: the ${place}.`, `Somewhere near the ${place}, the story picks up again.`, `Back to the ${place}, notebook open.`];
    paragraphs.push({ kind: "narration", text: cleanText(templates[Math.max(0, index) % templates.length]) });
  }
  for (const b of beatsOf(spec, id, "before")) paragraphs.push({ kind: "line", speaker: characterName(spec, b.speakerId), text: cleanText(b.text) });
  return { key: `scene-${id}`, kind: "scene", encounterId: id, vignette: vignetteFor(e?.socket ?? "", e?.role), heading: choiceText(spec, id).verb, paragraphs };
}

/** Coming back to an encounter the player left open. */
export function returnPassage(spec: Spec, id: string, n: number): Passage {
  const concept = encounterTopic(spec, id).short;
  return {
    key: `return-${id}-${n}`,
    kind: "return",
    encounterId: id,
    paragraphs: [{ kind: "narration", text: cleanText(pick([`You come back to ${concept}, with fresh eyes.`, `Back to ${concept}. The page is where you left it.`], `${id}:${n}`)) }],
  };
}

/** Written after a correct answer: the "after" beats, the consequence, and what it opens up. */
export function resolvedPassage(spec: Spec, id: string, unlocked: readonly string[]): Passage {
  const e = encounterOf(spec, id);
  const paragraphs: Para[] = [];
  for (const b of beatsOf(spec, id, "after")) paragraphs.push({ kind: "line", speaker: characterName(spec, b.speakerId), text: cleanText(b.text) });
  const debrief = cleanText(e?.debriefLine ?? "");
  if (debrief)
    paragraphs.push({
      kind: "narration",
      text: pick([`You write it down: “${debrief}”`, `In your notebook, underlined twice: “${debrief}”`, `You get it on paper before it slips away: “${debrief}”`], id),
    });
  const names = [...new Set(unlocked.map((u) => encounterTopic(spec, u).short))];
  const boss = unlocked.find((u) => encounterOf(spec, u)?.role === "boss");
  if (boss && unlocked.length === 1) paragraphs.push({ kind: "narration", text: "Only one question is left." });
  else if (names.length === 1) paragraphs.push({ kind: "narration", text: cleanText(`A new thread opens: ${names[0]}.`) });
  else if (names.length > 1) paragraphs.push({ kind: "narration", text: cleanText(`New threads open: ${listText(names)}.`) });
  return { key: `resolved-${id}`, kind: "resolved", encounterId: id, paragraphs };
}

/** A gentle in-story beat after a wrong answer (attempt = how many graded tries so far). */
export function stumblePassage(spec: Spec, id: string, attempt: number): Passage {
  const m = mentorName(spec);
  const text =
    attempt <= 1
      ? `${m} frowns. “Try that again — slower.”`
      : attempt === 2
        ? `${m} taps the page. “Read it once more. What is it really asking?”`
        : `${m} slides a hint across the table. “No shame in asking. One step at a time.”`;
  return { key: `stumble-${id}-${attempt}`, kind: "stumble", encounterId: id, paragraphs: [{ kind: "narration", text: cleanText(text) }] };
}

// ---------------------------------------------------------------------------------------------------------------
// endings

export type EndingKind = "front_page" | "page_three" | "one_more_week";

export const FRONT_PAGE_AT = 0.75;
export const PAGE_THREE_AT = 0.4;

/** First-try rate over the encounters with a recorded success (attempts at the moment of success). 1 when none. */
export function firstTryRate(attemptsAtSuccess: Readonly<Record<string, number>>): number {
  const values = Object.values(attemptsAtSuccess).filter((n) => n > 0);
  if (values.length === 0) return 1;
  return values.filter((n) => n === 1).length / values.length;
}

export function pickEnding(rate: number): EndingKind {
  if (rate >= FRONT_PAGE_AT) return "front_page";
  if (rate >= PAGE_THREE_AT) return "page_three";
  return "one_more_week";
}

export function endingTitle(kind: EndingKind): string {
  return kind === "front_page" ? "Front page" : kind === "page_three" ? "Page 3" : "One more week";
}

/** The ending's warm one-paragraph verdict. */
export function endingLine(spec: Spec, kind: EndingKind): string {
  const title = cleanText(spec.title);
  const judge = judgeName(spec);
  if (kind === "front_page") return `Your story, “${title}”, runs on the front page. You got most of it right the first time, and it shows in every line.`;
  if (kind === "page_three") return `Your story, “${title}”, runs on page 3: solid, careful work. Every correction you made is in there, and the story is better for it.`;
  return `${judge} reads it twice and sends you back for one more week. “You're close. Everything you fixed along the way is already in the draft. The next one runs.”`;
}

/** A one-line caption for the finale page (the full verdict is in the epilogue passage). */
export function endingBlurb(kind: EndingKind): string {
  if (kind === "front_page") return "Above the fold, in the biggest type the paper owns.";
  if (kind === "page_three") return "A careful story, right where the careful readers look.";
  return "Not in print yet, but every page of the draft is yours.";
}

export function epiloguePassage(spec: Spec, kind: EndingKind): Passage {
  const paragraphs: Para[] = [{ kind: "narration", text: cleanText(endingLine(spec, kind)) }];
  for (const l of spec.narrative.outro) paragraphs.push({ kind: "line", speaker: characterName(spec, l.speakerId), text: cleanText(l.text) });
  paragraphs.push({ kind: "narration", text: "The end." });
  return { key: "epilogue", kind: "epilogue", kicker: "Epilogue", heading: endingTitle(kind), dropCap: true, paragraphs };
}

// ---------------------------------------------------------------------------------------------------------------
// the log

export type StoryEvent =
  | { kind: "chose"; id: string }
  | { kind: "filed"; id: string; attempts: number }
  | { kind: "stumble"; id: string; attempt: number }
  | { kind: "finished"; ending: EndingKind };

/**
 * The whole story so far, from the events the host recorded: prologue, chapter 1's opening, then per event a scene
 * (or a return), a resolution or a stumble. Chapter openings are written in order, once each: when the player first
 * chooses an encounter of a later chapter, or when every encounter of the current one is filed; the epilogue ends it.
 */
export function buildLog(spec: Spec, progression: Pick<Progression, "nodes">, chapters: readonly Chapter[], events: readonly StoryEvent[]): Passage[] {
  const out: Passage[] = [prologuePassage(spec)];
  if (chapters.length > 0) out.push(chapterPassage(spec, chapters[0], chapters.length));
  let shown = 0;
  const advanceTo = (k: number) => {
    for (; shown < k; ) {
      shown++;
      out.push(chapterPassage(spec, chapters[shown], chapters.length));
    }
  };
  const filed = new Set<string>();
  const chosen = new Map<string, number>();
  for (const ev of events) {
    if (ev.kind === "chose") {
      advanceTo(chapterIndexOf(chapters, ev.id));
      const n = chosen.get(ev.id) ?? 0;
      chosen.set(ev.id, n + 1);
      out.push(n === 0 ? scenePassage(spec, ev.id) : returnPassage(spec, ev.id, n));
    } else if (ev.kind === "stumble") {
      out.push(stumblePassage(spec, ev.id, ev.attempt));
    } else if (ev.kind === "filed") {
      if (filed.has(ev.id)) continue;
      const unlocked = newlyUnlocked(progression, filed, ev.id);
      filed.add(ev.id);
      out.push(resolvedPassage(spec, ev.id, unlocked));
      advanceTo(chapters.findIndex((c) => c.ids.some((id) => !filed.has(id))));
    } else {
      out.push(epiloguePassage(spec, ev.ending));
    }
  }
  return out;
}

/** Notebook entries (debrief lines) of the filed encounters, grouped by chapter. */
export function notebookEntries(spec: Spec, chapters: readonly Chapter[], filed: ReadonlySet<string>): { chapter: Chapter; entries: { id: string; topic: string; line: string }[] }[] {
  return chapters.map((chapter) => ({
    chapter,
    entries: chapter.ids
      .filter((id) => filed.has(id))
      .map((id) => ({ id, topic: encounterTopic(spec, id).short, line: cleanText(encounterOf(spec, id)?.debriefLine ?? "") })),
  }));
}

// ---------------------------------------------------------------------------------------------------------------
// colours

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Mixes `a` toward `b` by t (0 = a, 1 = b). */
export function mixHex(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

export function luminance(hex: string): number {
  const c = parseHex(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `color` darkened toward ink-black until it reaches `min` contrast on `paper`. */
export function inkOn(color: string, paper: string, min = 4.5): string {
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = mixHex(color, "#1a120b", t);
    if (contrast(c, paper) >= min) return c;
  }
  return "#1a120b";
}

export interface BookColors {
  /** the desk the book lies on */
  desk: string;
  deskEdge: string;
  /** page paper and its shaded edge */
  paper: string;
  paperShade: string;
  /** body text */
  ink: string;
  /** muted ink for captions */
  inkSoft: string;
  /** the palette accent as an ink that reads on the paper */
  accentInk: string;
  /** the ribbon bookmark */
  ribbon: string;
  /** the dark "insert card" behind the challenge panel */
  leather: string;
  /** one ink per thread (track) */
  threads: string[];
  /** the final question's ink */
  boss: string;
  /** true when the palette background is light (the page around the host is light) */
  lightPalette: boolean;
}

const THREAD_INKS = ["#9e2b25", "#22577a", "#3f6b2a", "#6b3f8a"];

export function bookColors(css: { background: string; wall: string; floor: string; accent: string }): BookColors {
  const lightPalette = luminance(css.background) > 0.45;
  const paper = lightPalette ? mixHex(css.background, "#fffaf0", 0.45) : mixHex("#f4ecd9", css.accent, 0.04);
  const desk = lightPalette ? mixHex(css.wall, "#140c06", 0.72) : mixHex(css.background, "#000000", 0.2);
  const ink = "#2a1d12";
  return {
    desk,
    deskEdge: mixHex(desk, lightPalette ? "#000000" : css.floor, 0.35),
    paper,
    paperShade: mixHex(paper, "#8a6a3c", 0.22),
    ink,
    inkSoft: inkOn("#6d5a45", paper, 4.6),
    accentInk: inkOn(css.accent, paper, 4.6),
    ribbon: mixHex(inkOn(css.accent, paper, 3), "#7a1f1a", lightPalette ? 0.1 : 0.25),
    leather: mixHex("#1d150e", css.accent, 0.07),
    threads: THREAD_INKS.map((c) => inkOn(c, paper, 4.6)),
    boss: inkOn("#9a6b00", paper, 4.6),
    lightPalette,
  };
}
