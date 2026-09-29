import { describe, expect, it } from "vitest";
import { zodSchema } from "ai";
import { getMode } from "../../registry";
import { answerVarsFor } from "../../types";
import { explainer } from "./index";
import { MAX_EXPLANATION_CHARS } from "./rubric";
import { joinExemplars, teachBack, type TeachBackParams } from "./teach_back";

const good: TeachBackParams = {
  listener: "a new lab apprentice",
  question: "Why does a cell swell in fresh water?",
  ideas: [
    {
      label: "where the dissolved stuff is",
      keywords: ["hypotonic", "more solute inside", "saltier inside"],
      followUp: "Is the inside of the cell the same as the pond water?",
      exemplar: "Fresh water is hypotonic, so there is more solute inside the cell",
    },
    {
      label: "what crosses and which way",
      keywords: ["osmosis", "water moves in", "water enters"],
      followUp: "So what actually crosses, and which way?",
      exemplar: "Water moves in by osmosis.",
    },
    {
      label: "why it can't even out",
      keywords: ["semipermeable", "selectively permeable"],
      followUp: "Why doesn't the stuff inside just leak out?",
      exemplar: "The membrane is semipermeable, so the solutes stay put.",
    },
  ],
  required: 2,
  misconceptions: [{ keywords: ["salt moves in", "salt enters"], correction: "Can the dissolved particles really get through?" }],
  wordBank: ["osmosis", "hypotonic", "membrane", "solute"],
};

const clone = (): TeachBackParams => JSON.parse(JSON.stringify(good)) as TeachBackParams;

describe("explainer.teach_back: params and check()", () => {
  it("is registered, implemented, not blind-solvable, on the explain widget", () => {
    expect(getMode("explainer", "teach_back")).toBe(teachBack);
    expect(teachBack.implemented).toBe(true);
    expect(teachBack.blindSolvable).toBe(false);
    expect(teachBack.widget).toBe("explain");
    expect(Object.keys(explainer.genres).sort()).toEqual(["dungeon", "explorer", "mystery", "platformer", "puzzle", "story", "strategy", "world3d"]);
  });

  it("valid params parse and pass check()", () => {
    expect(teachBack.paramsSchema.safeParse(good).success).toBe(true);
    expect(teachBack.check(good)).toEqual([]);
  });

  it("the JSON schema has every field required (strict mode)", () => {
    const json = zodSchema(teachBack.paramsSchema).jsonSchema as { required: string[] };
    expect(json.required.sort()).toEqual(["ideas", "listener", "misconceptions", "question", "required", "wordBank"]);
  });

  it("rejects required > ideas.length", () => {
    const p = { ...clone(), required: 4 };
    expect(teachBack.check(p).join("\n")).toMatch(/required is 4 but there are only 3 ideas/);
  });

  it("rejects a keyword that is empty after normalisation", () => {
    const p = clone();
    p.ideas[0].keywords.push("?!");
    expect(teachBack.check(p).join("\n")).toMatch(/ideas\[0\]\.keywords\[3\] is empty/);
  });

  it("rejects a label or followUp that says its own keyword (stemmed)", () => {
    const p = clone();
    p.ideas[1].label = "the osmosis part";
    p.ideas[1].followUp = "Where does water enter?";
    const problems = teachBack.check(p).join("\n");
    expect(problems).toMatch(/ideas\[1\]\.label .* contains its own keyword "osmosis"/);
    expect(problems).toMatch(/ideas\[1\]\.followUp contains its own keyword "water enters"/);
  });

  it("rejects an exemplar that doesn't use its own keywords, and exemplars that don't self-solve", () => {
    const p = clone();
    p.ideas[0].exemplar = "The pond is different from the cell.";
    p.ideas[1].exemplar = "Stuff happens.";
    const problems = teachBack.check(p).join("\n");
    expect(problems).toMatch(/ideas\[0\]\.exemplar doesn't use any of its own keywords/);
    expect(problems).toMatch(/ideas\[1\]\.exemplar doesn't use any of its own keywords/);
  });

  it("rejects idea keywords that overlap a misconception's", () => {
    const p = clone();
    p.misconceptions[0].keywords.push("osmosis happens");
    expect(teachBack.check(p).join("\n")).toMatch(/misconceptions\[0\] keyword "osmosis happens" overlaps ideas\[1\] keyword "osmosis"/);
  });

  it("rejects exemplars that trip a misconception", () => {
    const p = clone();
    p.misconceptions[0].keywords = ["solutes stay put"];
    expect(teachBack.check(p).join("\n")).toMatch(/the exemplars trip misconceptions\[0\]/);
  });

  it("rejects a correction that states an idea keyword", () => {
    const p = clone();
    p.misconceptions[0].correction = "No, it's osmosis!";
    expect(teachBack.check(p).join("\n")).toMatch(/correction says ideas\[1\]'s keyword "osmosis"/);
  });

  it("rejects two ideas sharing a keyword", () => {
    const p = clone();
    p.ideas[2].keywords.push("Osmosis");
    expect(teachBack.check(p).join("\n")).toMatch(/ideas\[1\] and ideas\[2\] share the keyword "osmosis"/);
  });

  it("rejects a word bank that doesn't help with enough ideas; accepts an empty one", () => {
    const p = { ...clone(), wordBank: ["membrane", "solute", "hypotonic"] };
    expect(teachBack.check(p).join("\n")).toMatch(/wordBank helps with only 1 idea/);
    expect(teachBack.check({ ...clone(), wordBank: [] })).toEqual([]);
  });

  it("rejects exemplars longer than the grader reads", () => {
    const p = clone();
    p.ideas[0].exemplar = `It is hypotonic. ${"More words here. ".repeat(80)}`;
    expect(teachBack.check(p).join("\n")).toMatch(new RegExp(`keep them under ${MAX_EXPLANATION_CHARS}`));
  });
});

describe("explainer.teach_back: resolve, present, grade", () => {
  const s = teachBack.resolve(good);

  it("resolve joins the exemplars into one explanation (adding missing full stops)", () => {
    expect(s).toEqual({ exemplar: joinExemplars(good), ideaCount: 3 });
    expect(s.exemplar).toBe(
      "Fresh water is hypotonic, so there is more solute inside the cell. Water moves in by osmosis. The membrane is semipermeable, so the solutes stay put.",
    );
  });

  it("solutionInput passes grade()", () => {
    const g = teachBack.grade(good, teachBack.solutionInput(good, s));
    expect(g.correct).toBe(true);
    expect(g.feedback).toMatch(/gets it now. You covered the part about where the dissolved stuff is, the part about what crosses/);
  });

  it("present() sends no keywords or exemplars to the client and shuffles the word bank by seed", () => {
    const v = teachBack.present(good, 7);
    expect(Object.keys(v).sort()).toEqual(["ideaCount", "listener", "maxChars", "question", "required", "wordBank"]);
    expect(v.ideaCount).toBe(3);
    expect(v.required).toBe(2);
    expect([...v.wordBank].sort()).toEqual([...good.wordBank].sort());
    expect(teachBack.present(good, 7)).toEqual(v);
    const serialized = JSON.stringify(v);
    for (const idea of good.ideas) {
      expect(serialized).not.toContain(idea.exemplar);
      expect(serialized).not.toContain(idea.followUp);
      for (const k of idea.keywords) if (!good.wordBank.includes(k)) expect(serialized, k).not.toContain(k);
    }
  });

  it("a missing idea gets that idea's follow-up question and a count, never keywords or exemplars", () => {
    const g = teachBack.grade(good, { text: "Water moves in because of osmosis and the cell gets fat." });
    expect(g.correct).toBe(false);
    expect(g.feedback).toBe("Is the inside of the cell the same as the pond water? (1 of 2 ideas landed)");
    for (const idea of good.ideas) {
      expect(g.feedback).not.toContain(idea.exemplar);
      for (const k of idea.keywords) expect(g.feedback.toLowerCase()).not.toContain(k.toLowerCase());
    }
  });

  it("a misconception gets its correction", () => {
    const g = teachBack.grade(good, { text: "It is hypotonic, and salt moves in so the cell swells up." });
    expect(g).toEqual({ correct: false, feedback: "Can the dissolved particles really get through?" });
  });

  it("empty, whitespace, missing and too-short input get gentle effort feedback", () => {
    expect(teachBack.grade(good, { text: "" }).feedback).toMatch(/^Say something first/);
    expect(teachBack.grade(good, { text: "   \n " }).correct).toBe(false);
    expect(teachBack.grade(good, {} as { text: string }).feedback).toMatch(/^Say something first/);
    expect(teachBack.grade(good, { text: "osmosis" }).feedback).toMatch(/full sentence/);
  });

  it("templateVars: exemplar and ideaLabels are answer vars; the rest are safe", () => {
    const vars = teachBack.templateVars(good, s);
    expect(vars).toMatchObject({ listener: good.listener, question: good.question, required: "2", ideaCount: "3", exemplar: s.exemplar });
    expect(answerVarsFor(teachBack, good)).toEqual(["exemplar", "ideaLabels"]);
  });

  it("has a director blurb and an authoring guide that mention the sweet spot", () => {
    expect(teachBack.directorBlurb.length).toBeGreaterThan(20);
    expect(teachBack.authoringGuide).toMatch(/3 ideas with required 2/);
  });
});
