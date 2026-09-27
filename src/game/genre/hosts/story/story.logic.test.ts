import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { GameSpec } from "../../../../contracts/gamespec";
import { PALETTES } from "../../../engine/palettes";
import { buildProgression, unlockedIds } from "../../../runner/progression";
import {
  FRONT_PAGE_AT,
  MAX_CHAPTERS,
  PAGE_THREE_AT,
  bookColors,
  buildChapters,
  buildLog,
  buildThreads,
  choiceText,
  contrast,
  currentChapter,
  firstSentence,
  firstTryRate,
  groupTiers,
  newlyUnlocked,
  notebookEntries,
  pickEnding,
  scenePassage,
  settingPlaces,
  splitName,
  stumblePassage,
  vignetteFor,
  epiloguePassage,
  type Passage,
  type StoryEvent,
} from "./story.logic";

const FIXTURE_DIR = new URL("../../../../../fixtures/", import.meta.url);
const FIXTURES = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => ({ name: f, spec: GameSpec.parse(JSON.parse(readFileSync(new URL(f, FIXTURE_DIR), "utf8"))) }));
const STORY = FIXTURES.find((f) => f.name === "civil-rights-story.json")!.spec;

const BAD = /\{\{|\}\}|\bundefined\b|\bnull\b|NaN|\[object/;

function passageText(p: Passage): string {
  return [p.heading ?? "", p.kicker ?? "", ...p.paragraphs.map((x) => (x.kind === "line" ? `${x.speaker} ${x.text}` : x.text))].join(" ");
}

/** A spec with n encounters, cloned from the story fixture (boss last). */
function specWith(n: number): GameSpec {
  const regular = STORY.encounters.filter((e) => e.role !== "boss");
  const boss = STORY.encounters.find((e) => e.role === "boss")!;
  const encounters = Array.from({ length: n }, (_, i) => {
    if (i === n - 1 && n > 1) return { ...boss, id: `x${i}_boss` };
    const src = regular[i % regular.length];
    return { ...src, id: `x${i}_${src.id}` };
  });
  return { ...STORY, encounters, narrative: { ...STORY.narrative, beats: [] } };
}

/** Plays the progression to the end, always taking the LAST available encounter (off the spec order). */
function playThrough(spec: GameSpec): StoryEvent[] {
  const p = buildProgression(spec);
  const solved = new Set<string>();
  const events: StoryEvent[] = [];
  for (let guard = 0; guard < 100 && solved.size < spec.encounters.length; guard++) {
    const open = unlockedIds(p, solved);
    const id = open[open.length - 1];
    events.push({ kind: "chose", id });
    if (guard % 3 === 0) events.push({ kind: "stumble", id, attempt: 1 });
    events.push({ kind: "filed", id, attempts: guard % 3 === 0 ? 2 : 1 });
    solved.add(id);
  }
  events.push({ kind: "finished", ending: "page_three" });
  return events;
}

describe("chapters", () => {
  it("cover every encounter exactly once, in 2-5 chapters, for every fixture", () => {
    for (const { name, spec } of FIXTURES) {
      const chapters = buildChapters(spec, buildProgression(spec));
      const ids = chapters.flatMap((c) => c.ids);
      expect(ids.sort(), name).toEqual(spec.encounters.map((e) => e.id).sort());
      expect(chapters.length, name).toBeGreaterThanOrEqual(2);
      expect(chapters.length, name).toBeLessThanOrEqual(MAX_CHAPTERS);
      for (const c of chapters) {
        expect(c.ids.length, name).toBeGreaterThan(0);
        expect(c.title, name).not.toMatch(BAD);
        expect(c.subtitle, name).not.toMatch(BAD);
      }
      expect(new Set(chapters.map((c) => c.title)).size, `${name} titles distinct`).toBe(chapters.length);
    }
  });

  it("keep the progression's order: a chapter never needs an encounter from a later chapter", () => {
    for (const { name, spec } of FIXTURES) {
      const p = buildProgression(spec);
      const chapters = buildChapters(spec, p);
      const chapterOf = new Map(chapters.flatMap((c) => c.ids.map((id) => [id, c.index] as const)));
      for (const n of p.nodes) for (const r of n.requires) expect(chapterOf.get(r)!, `${name}/${n.id}`).toBeLessThanOrEqual(chapterOf.get(n.id)!);
    }
  });

  it("titles the showcase from its units and ends on the final question", () => {
    const chapters = buildChapters(STORY, buildProgression(STORY));
    expect(chapters).toHaveLength(5);
    expect(chapters.at(-1)!.hasBoss).toBe(true);
    expect(chapters.at(-1)!.title).toBe("The final question");
    expect(chapters.map((c) => c.title)).toContain("Working with sources");
  });

  it("groupTiers merges the smallest adjacent pair and splits a lone tier", () => {
    expect(groupTiers([["a", "b", "c"]])).toEqual([["a", "b"], ["c"]]);
    expect(groupTiers([["a"]])).toEqual([["a"]]);
    expect(groupTiers([["a"], ["b"], ["c"], ["d"], ["e"], ["f"], ["g"]])).toHaveLength(5);
    expect(groupTiers([["a", "b", "c"], ["d", "e", "f"], ["g", "h", "i"], ["j"], ["k"], ["l"]])).toEqual([
      ["a", "b", "c"],
      ["d", "e", "f"],
      ["g", "h", "i"],
      ["j"],
      ["k", "l"],
    ]);
  });

  it("currentChapter follows the first unfinished chapter", () => {
    const chapters = buildChapters(STORY, buildProgression(STORY));
    expect(currentChapter(chapters, new Set())).toBe(0);
    expect(currentChapter(chapters, new Set(chapters[0].ids))).toBe(1);
    expect(currentChapter(chapters, new Set(STORY.encounters.map((e) => e.id)))).toBe(chapters.length - 1);
  });
});

describe("threads", () => {
  it("one named thread per progression track", () => {
    for (const { name, spec } of FIXTURES) {
      const p = buildProgression(spec);
      const threads = buildThreads(spec, p);
      expect(threads.length, name).toBe(p.tracks.length);
      expect(new Set(threads.map((t) => t.name)).size, name).toBe(threads.length);
      for (const t of threads) expect(t.name, name).not.toMatch(BAD);
    }
    expect(buildThreads(STORY, buildProgression(STORY)).map((t) => t.name)).toEqual(["Origins", "Direct action", "Legislation"]);
  });
});

describe("choice text", () => {
  it("never contains template braces, undefined or null, for every encounter of every fixture", () => {
    for (const { name, spec } of FIXTURES) {
      for (const e of spec.encounters) {
        const c = choiceText(spec, e.id);
        expect(c.verb.length, `${name}/${e.id}`).toBeGreaterThan(5);
        expect(c.verb, `${name}/${e.id}`).not.toMatch(BAD);
        expect(c.teaser, `${name}/${e.id}`).not.toMatch(BAD);
        expect(c.teaser.length, `${name}/${e.id}`).toBeLessThanOrEqual(110);
      }
    }
  });

  it("templates the socket's verb", () => {
    expect(choiceText(STORY, "e1_brown").verb).toBe("Sit down with Ida to talk about Brown v. Board of Education");
    expect(choiceText(STORY, "e1_brown").tag).toBe("1954");
    expect(choiceText(STORY, "e3_little_rock").verb).toMatch(/^Testify at the hearing on Little Rock Nine/);
    expect(choiceText(STORY, "e8_cra").verb).toMatch(/^Open the letter about/);
    expect(choiceText(STORY, "e9_selma").verb).toMatch(/^Reread your notes on/);
    expect(choiceText(STORY, "e12_boss").verb).toBe("Face the final question");
    expect(choiceText(STORY, "e1_brown").teaser).toBe("A torn clipping from May 1954 is missing its key word.");
  });

  it("falls back gracefully for unknown sockets and ids", () => {
    const odd = { ...STORY, encounters: STORY.encounters.map((e) => ({ ...e, socket: "zeppelin" })) };
    expect(choiceText(odd, "e1_brown").verb).toMatch(/^Follow the lead on /);
    expect(choiceText(odd, "e12_boss").verb).toBe("Face the final question");
    expect(choiceText(odd, "nope").verb).not.toMatch(BAD);
    expect(vignetteFor("zeppelin")).toBe("lead");
    expect(vignetteFor("zeppelin", "review")).toBe("journal");
  });

  it("firstSentence trims and never breaks mid-word", () => {
    expect(firstSentence("One. Two.")).toBe("One.");
    expect(firstSentence("Use {{x}} now. Then more.")).toBe("Use … now.");
    const long = firstSentence("word ".repeat(60), 50);
    expect(long.length).toBeLessThanOrEqual(50);
    expect(long.endsWith("…")).toBe(true);
    expect(long).not.toMatch(/wor…$/);
  });

  it("splitName pulls a trailing parenthetical", () => {
    expect(splitName("Origins (1954–1957)")).toEqual({ short: "Origins", tag: "1954–1957" });
    expect(splitName("Plain")).toEqual({ short: "Plain", tag: null });
  });

  it("settingPlaces reads a colon list and ignores other settings", () => {
    expect(settingPlaces(STORY.theme.setting)).toEqual(["kitchens", "church basements", "lunch counters", "courthouse steps"]);
    expect(settingPlaces("A haunted lighthouse")).toEqual([]);
  });
});

describe("passages and the log", () => {
  it("is deterministic", () => {
    const ev = playThrough(STORY);
    const p = buildProgression(STORY);
    const a = buildLog(STORY, p, buildChapters(STORY, p), ev);
    const b = buildLog(STORY, buildProgression(STORY), buildChapters(STORY, buildProgression(STORY)), ev);
    expect(a).toEqual(b);
    expect(buildChapters(STORY, p)).toEqual(buildChapters(STORY, buildProgression(STORY)));
  });

  it("tells a whole story for every fixture: prologue, every chapter, every scene and resolution, the epilogue", () => {
    for (const { name, spec } of FIXTURES) {
      const p = buildProgression(spec);
      const chapters = buildChapters(spec, p);
      const log = buildLog(spec, p, chapters, playThrough(spec));
      expect(log[0].kind, name).toBe("prologue");
      expect(log.at(-1)!.kind, name).toBe("epilogue");
      expect(log.filter((x) => x.kind === "chapter"), name).toHaveLength(chapters.length);
      expect(log.filter((x) => x.kind === "scene"), name).toHaveLength(spec.encounters.length);
      expect(log.filter((x) => x.kind === "resolved"), name).toHaveLength(spec.encounters.length);
      expect(new Set(log.map((x) => x.key)).size, `${name} keys unique`).toBe(log.length);
      for (const x of log) expect(passageText(x), `${name}/${x.key}`).not.toMatch(BAD);
    }
  });

  it("a scene carries the encounter's before beats; a resolution its after beats and the debrief line", () => {
    const scene = scenePassage(STORY, "e2_montgomery");
    expect(scene.paragraphs.some((x) => x.kind === "line" && x.speaker === "Ida" && /just tired/.test(x.text))).toBe(true);
    const p = buildProgression(STORY);
    const log = buildLog(STORY, p, buildChapters(STORY, p), [
      { kind: "chose", id: "e1_brown" },
      { kind: "filed", id: "e1_brown", attempts: 1 },
    ]);
    const resolved = log.find((x) => x.kind === "resolved")!;
    expect(passageText(resolved)).toContain("separate schools are inherently unequal");
    expect(passageText(resolved)).toMatch(/new thread opens: Montgomery bus boycott/i);
  });

  it("returning to a left encounter writes a short return, not the scene again", () => {
    const p = buildProgression(STORY);
    const log = buildLog(STORY, p, buildChapters(STORY, p), [
      { kind: "chose", id: "e1_brown" },
      { kind: "chose", id: "e1_brown" },
    ]);
    expect(log.map((x) => x.kind)).toEqual(["prologue", "chapter", "scene", "return"]);
  });

  it("a stumble uses the first character's name", () => {
    expect(passageText(stumblePassage(STORY, "e1_brown", 1))).toContain("Ida frowns");
    expect(passageText(stumblePassage(STORY, "e1_brown", 5))).toContain("Ida");
  });

  it("newlyUnlocked lists what a solve opens", () => {
    const p = buildProgression(STORY);
    expect(newlyUnlocked(p, new Set(), "e1_brown")).toEqual(["e2_montgomery"]);
    const allButBoss = new Set(STORY.encounters.filter((e) => e.role !== "boss").map((e) => e.id));
    allButBoss.delete("e11_causation");
    expect(newlyUnlocked(p, allButBoss, "e11_causation")).toEqual(["e12_boss"]);
  });

  it("notebook groups filed debrief lines by chapter", () => {
    const p = buildProgression(STORY);
    const chapters = buildChapters(STORY, p);
    const nb = notebookEntries(STORY, chapters, new Set(["e1_brown", "e12_boss"]));
    expect(nb).toHaveLength(chapters.length);
    expect(nb[0].entries.map((e) => e.id)).toEqual(["e1_brown"]);
    expect(nb.at(-1)!.entries.map((e) => e.id)).toEqual(["e12_boss"]);
  });
});

describe("endings", () => {
  it("thresholds on the first-try rate", () => {
    expect(pickEnding(1)).toBe("front_page");
    expect(pickEnding(FRONT_PAGE_AT)).toBe("front_page");
    expect(pickEnding(FRONT_PAGE_AT - 0.01)).toBe("page_three");
    expect(pickEnding(PAGE_THREE_AT)).toBe("page_three");
    expect(pickEnding(PAGE_THREE_AT - 0.01)).toBe("one_more_week");
    expect(pickEnding(0)).toBe("one_more_week");
  });

  it("firstTryRate counts successes on attempt 1", () => {
    expect(firstTryRate({})).toBe(1);
    expect(firstTryRate({ a: 1, b: 1, c: 2, d: 3 })).toBe(0.5);
    expect(firstTryRate({ a: 0, b: 1 })).toBe(1);
  });

  it("every ending is warm and uses the title and outro", () => {
    for (const kind of ["front_page", "page_three", "one_more_week"] as const) {
      const text = passageText(epiloguePassage(STORY, kind));
      expect(text).not.toMatch(BAD);
      expect(text).toContain(STORY.narrative.outro[0].text);
    }
    expect(passageText(epiloguePassage(STORY, "front_page"))).toContain("Letters to Selma");
    expect(passageText(epiloguePassage(STORY, "one_more_week"))).toContain("The Editor");
  });
});

describe("edge cases", () => {
  it("one encounter: one chapter, a full log", () => {
    const one = specWith(1);
    const p = buildProgression(one);
    const chapters = buildChapters(one, p);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].ids).toEqual([one.encounters[0].id]);
    const log = buildLog(one, p, chapters, playThrough(one));
    expect(log.map((x) => x.kind)).toEqual(["prologue", "chapter", "scene", "stumble", "resolved", "epilogue"]);
  });

  it("twenty encounters: at most five chapters, every encounter once, clean text", () => {
    const big = specWith(20);
    const p = buildProgression(big);
    const chapters = buildChapters(big, p);
    expect(chapters.length).toBeLessThanOrEqual(MAX_CHAPTERS);
    expect(chapters.length).toBeGreaterThanOrEqual(2);
    expect(chapters.flatMap((c) => c.ids).sort()).toEqual(big.encounters.map((e) => e.id).sort());
    const log = buildLog(big, p, chapters, playThrough(big));
    for (const x of log) expect(passageText(x)).not.toMatch(BAD);
    for (const e of big.encounters) expect(choiceText(big, e.id).verb).not.toMatch(BAD);
  });

  it("no boss: chapters still cover everything, no 'final question' chapter", () => {
    const noBoss = { ...STORY, encounters: STORY.encounters.filter((e) => e.role !== "boss") };
    const p = buildProgression(noBoss);
    const chapters = buildChapters(noBoss, p);
    expect(chapters.flatMap((c) => c.ids)).toHaveLength(noBoss.encounters.length);
    expect(chapters.some((c) => c.hasBoss)).toBe(false);
  });
});

describe("book colours", () => {
  it("keep body ink, accent ink and thread inks readable on the page for every palette", () => {
    for (const palette of Object.values(PALETTES)) {
      const c = bookColors(palette.css);
      expect(contrast(c.ink, c.paper), palette.id).toBeGreaterThanOrEqual(7);
      expect(contrast(c.accentInk, c.paper), palette.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.inkSoft, c.paper), palette.id).toBeGreaterThanOrEqual(4.5);
      for (const t of c.threads) expect(contrast(t, c.paper), palette.id).toBeGreaterThanOrEqual(4.5);
      // the challenge insert card is dark enough for the panel's light text
      expect(contrast("#f5f3ee", c.leather), palette.id).toBeGreaterThanOrEqual(10);
    }
    expect(bookColors(PALETTES.parchment.css).lightPalette).toBe(true);
    expect(bookColors(PALETTES.ember.css).lightPalette).toBe(false);
  });
});
