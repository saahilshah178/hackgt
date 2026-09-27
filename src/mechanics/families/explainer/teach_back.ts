import { z } from "zod";
import { defineMode } from "../../types";
import { seededShuffle } from "../../util";
import { MAX_EXPLANATION_CHARS, MIN_EXPLANATION_WORDS, findPhrase, mentionsAnyKeyword, phrasesOverlap, prepare, scoreExplanation, stemPhrase } from "./rubric";

/*
 * explainer · teach_back: the player explains a concept in their own words to a listener character. A
 * deterministic rubric (rubric.ts) grades it: each "idea" lands when any one of its keyword phrases appears
 * un-negated; the explanation passes when `required` ideas land and no misconception phrase is heard. On a miss
 * the listener asks the follow-up question for the first idea that didn't land (or pushes back on the
 * misconception), so the feedback teaches without handing over the words.
 *
 * The view sent to the client carries no keywords and no exemplars; the widget's meter shows effort signals
 * (length, sentences, connectors) only. Not blind-solvable: there is no single answer to compare.
 */

const Idea = z.object({
  label: z
    .string()
    .describe(
      'Short name for this idea, 2-6 words, shown only in feedback and the debrief as "the part about ...". Must NOT contain any of this idea\'s keywords, e.g. "which way the water goes"',
    ),
  keywords: z
    .array(z.string())
    .min(2)
    .max(10)
    .describe(
      "2-10 short phrases (1-3 words each); if ANY ONE appears in the explanation, the idea has landed. Be generous: synonyms, word forms, everyday wording a student would use (e.g. \"water moves in\", \"water enters\", \"flows in\", \"osmosis\"). Matching ignores case, plurals and -ed/-ing endings",
    ),
  followUp: z
    .string()
    .describe(
      "The listener's follow-up question when this idea is missing, under 120 characters, in the listener's voice. It points at the gap without using any of this idea's keywords, e.g. \"But what actually moves, and in which direction?\"",
    ),
  exemplar: z
    .string()
    .describe("One sentence a strong student would write that covers this idea using at least one of its keywords. Shown only in the debrief"),
});

const Misconception = z.object({
  keywords: z
    .array(z.string())
    .min(1)
    .max(8)
    .describe("1-8 short phrases that signal this misconception when stated (not negated) in the explanation, e.g. \"salt moves in\". Must not overlap any idea's keywords"),
  correction: z
    .string()
    .describe("The listener's gentle pushback when they hear it, under 140 characters. Questions the belief without stating the right answer or any idea keyword"),
});

const Params = z.object({
  listener: z
    .string()
    .describe('Who the player explains to, in a few words, e.g. "a new apprentice who missed the lecture". A character from the game world is best'),
  question: z
    .string()
    .describe('What the listener asks, one question under 120 characters, e.g. "Why does the cell swell up in fresh water?" Ask why/how, not a one-word fact'),
  ideas: z
    .array(Idea)
    .min(2)
    .max(4)
    .describe("2-4 distinct ideas a good explanation contains, in the order a teacher would say them. 3 ideas with required 2 is the sweet spot"),
  required: z.number().int().min(1).max(4).describe("How many ideas must land to pass; at most the number of ideas (usually ideas.length - 1)"),
  misconceptions: z
    .array(Misconception)
    .min(0)
    .max(3)
    .describe("0-3 common wrong beliefs about this concept (use the concept's listed misconceptions); stating one fails the explanation with its correction"),
  wordBank: z
    .array(z.string())
    .min(0)
    .max(12)
    .describe("0-12 helper terms offered after the first hint; include at least one keyword from enough ideas to pass, plus a few neutral terms. May be empty"),
});
type Params = z.infer<typeof Params>;

export interface TeachBackSolution {
  /** the ideas' exemplars joined into one model explanation (debrief only) */
  exemplar: string;
  ideaCount: number;
}
export interface TeachBackInput {
  text: string;
}
export interface TeachBackView {
  listener: string;
  question: string;
  ideaCount: number;
  required: number;
  /** helper terms, seed-shuffled; the widget reveals them on request */
  wordBank: string[];
  /** character cap the grader reads */
  maxChars: number;
}

function sentence(s: string): string {
  const t = s.trim();
  return /[.!?]["')\]]?$/.test(t) ? t : `${t}.`;
}

export function joinExemplars(p: Pick<Params, "ideas">): string {
  return p.ideas.map((i) => sentence(i.exemplar)).join(" ");
}

function listenerName(p: Params): string {
  const l = p.listener.trim();
  return l ? l.charAt(0).toUpperCase() + l.slice(1) : "Your listener";
}

function thePartsAbout(labels: string[]): string {
  const parts = labels.map((l) => `the part about ${l.trim()}`);
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

function gradeText(p: Params, text: unknown) {
  const r = scoreExplanation(p, text);
  const who = listenerName(p);
  switch (r.status) {
    case "empty":
      return { correct: false, feedback: `Say something first. ${who} is waiting to hear how you'd explain it.` };
    case "too_short":
      return { correct: false, feedback: `That's only a word or two. Explain it in a full sentence or two, as if ${p.listener.trim() || "they"} had never heard of it.` };
    case "misconception":
      return { correct: false, feedback: p.misconceptions[r.misconception!].correction.trim() };
    case "missing": {
      const next = p.ideas[r.missing[0]];
      return { correct: false, feedback: `${next.followUp.trim()} (${r.matched.length} of ${p.required} ideas landed)` };
    }
    case "pass": {
      const covered = thePartsAbout(r.matched.map((i) => p.ideas[i].label));
      const extra = r.missing.length > 0 ? ` To go further, you could add ${thePartsAbout(r.missing.map((i) => p.ideas[i].label))}.` : "";
      return { correct: true, feedback: `${who} gets it now. You covered ${covered}.${extra}` };
    }
  }
}

export const teachBack = defineMode({
  id: "teach_back",
  name: "Teach it back",
  implemented: true,
  blindSolvable: false,
  widget: "explain",
  knowledgeTypes: ["causal", "system", "procedure", "argument", "category", "fact"],
  directorBlurb:
    "The player explains the concept in their own words to a character who asks why/how; a rubric checks the key ideas landed and no misconception was stated. Best for causes, mechanisms and arguments; strong as a teach-back after practice or as a boss.",
  authoringGuide: [
    "Write a listener (a character from this world) and one why/how question they ask about the concept.",
    "ideas: 3 ideas with required 2 is the sweet spot (2 ideas with required 2 for a narrow concept, 4 with required 3 for a boss). Each idea is one piece of the explanation a teacher would expect.",
    "keywords: 4-8 per idea, each 1-3 words. Be generous: synonyms, everyday wording, and the technical term (\"water moves in\", \"water enters\", \"flows into the cell\", \"osmosis\"). Any ONE phrase lands the idea. Matching ignores case, plurals, -ed/-ing/-ly endings and one typo in long words, but NOT synonyms you didn't list. Avoid phrases that could appear in a wrong answer (a lone \"water\" or \"court\").",
    "label: 2-6 words naming the idea without its keywords (\"which way the water goes\"). followUp: the listener's next question when the idea is missing, pointing at the gap without its keywords.",
    "exemplar: one sentence per idea using at least one of its keywords; together they form a model explanation shown in the debrief.",
    "misconceptions: turn the concept's listed misconceptions into 1-3 entries; keywords are phrases a student holding the belief would write (\"acted alone\", \"just tired\"). They must not overlap any idea keyword. correction: the listener's gentle pushback, a question, no answer.",
    "wordBank: optional helper terms (the key technical words plus a few neutral ones) shown after the first hint; empty for no bank.",
    "Placeholders: {{listener}}, {{question}}, {{required}}, {{ideaCount}} are safe anywhere; {{exemplar}} (the model explanation) and {{ideaLabels}} only in later hints and the debrief.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (!p.listener.trim()) problems.push("listener is empty; name who the player explains to");
    if (!p.question.trim()) problems.push("question is empty; write the listener's why/how question");
    if (p.required > p.ideas.length) problems.push(`required is ${p.required} but there are only ${p.ideas.length} ideas; lower required or add ideas`);

    p.ideas.forEach((idea, i) => {
      if (!idea.label.trim()) problems.push(`ideas[${i}].label is empty`);
      if (!idea.followUp.trim()) problems.push(`ideas[${i}].followUp is empty`);
      if (!idea.exemplar.trim()) problems.push(`ideas[${i}].exemplar is empty`);
      idea.keywords.forEach((k, j) => {
        if (stemPhrase(k).length === 0) problems.push(`ideas[${i}].keywords[${j}] is empty after removing punctuation; use real words`);
      });
      const inLabel = mentionsAnyKeyword(idea.label, idea.keywords);
      if (inLabel) problems.push(`ideas[${i}].label "${idea.label}" contains its own keyword "${inLabel}"; describe the idea without its keywords`);
      const inFollowUp = mentionsAnyKeyword(idea.followUp, idea.keywords);
      if (inFollowUp) problems.push(`ideas[${i}].followUp contains its own keyword "${inFollowUp}"; ask about the gap without saying the answer`);
      if (idea.exemplar.trim() && !idea.keywords.some((k) => findPhrase(prepare(idea.exemplar), k).some((h) => !h.negated))) {
        problems.push(`ideas[${i}].exemplar doesn't use any of its own keywords (un-negated); rewrite it or add its wording to keywords`);
      }
    });

    // no shared keywords between ideas: one phrase would land two ideas
    for (let a = 0; a < p.ideas.length; a++) {
      for (let b = a + 1; b < p.ideas.length; b++) {
        for (const ka of p.ideas[a].keywords) {
          const kb = p.ideas[b].keywords.find((k) => stemPhrase(k).join(" ") === stemPhrase(ka).join(" "));
          if (kb) problems.push(`ideas[${a}] and ideas[${b}] share the keyword "${ka}"; each idea needs its own wording`);
        }
      }
    }

    p.misconceptions.forEach((m, i) => {
      if (!m.correction.trim()) problems.push(`misconceptions[${i}].correction is empty`);
      m.keywords.forEach((k, j) => {
        if (stemPhrase(k).length === 0) problems.push(`misconceptions[${i}].keywords[${j}] is empty after removing punctuation; use real words`);
      });
      p.ideas.forEach((idea, ii) => {
        for (const ik of idea.keywords) {
          const clash = m.keywords.find((mk) => phrasesOverlap(ik, mk));
          if (clash) problems.push(`misconceptions[${i}] keyword "${clash}" overlaps ideas[${ii}] keyword "${ik}"; a right answer would trip the misconception`);
        }
        const said = mentionsAnyKeyword(m.correction, idea.keywords);
        if (said) problems.push(`misconceptions[${i}].correction says ideas[${ii}]'s keyword "${said}"; push back with a question, not the answer`);
      });
    });

    if (p.wordBank.some((w) => stemPhrase(w).length === 0)) problems.push("wordBank has an empty term");
    if (p.wordBank.length > 0) {
      const bankStems = p.wordBank.map((w) => stemPhrase(w).join(" "));
      const helped = p.ideas.filter((idea) => idea.keywords.some((k) => bankStems.includes(stemPhrase(k).join(" ")))).length;
      if (helped < Math.min(p.required, p.ideas.length)) {
        problems.push(`wordBank helps with only ${helped} idea(s) but ${p.required} must land; include one keyword from at least ${p.required} ideas (or leave the bank empty)`);
      }
    }

    // self-solve: the joined exemplars must pass the grader
    const exemplar = joinExemplars(p);
    if (exemplar.length > MAX_EXPLANATION_CHARS) problems.push(`the exemplars together are ${exemplar.length} characters; keep them under ${MAX_EXPLANATION_CHARS}`);
    if (problems.length === 0) {
      const r = scoreExplanation(p, exemplar);
      if (r.status === "misconception") problems.push(`the exemplars trip misconceptions[${r.misconception}]; reword the exemplar or narrow that misconception's keywords`);
      else if (r.status === "too_short") problems.push(`the exemplars total fewer than ${MIN_EXPLANATION_WORDS} words; write a full sentence per idea`);
      else if (!r.correct) problems.push(`the exemplars only land ${r.matched.length} of ${p.required} required ideas; make each exemplar use its own keywords`);
    }
    return problems;
  },
  resolve: (p): TeachBackSolution => ({ exemplar: joinExemplars(p), ideaCount: p.ideas.length }),
  templateVars(p, s) {
    return {
      listener: p.listener,
      question: p.question,
      required: String(p.required),
      ideaCount: String(s.ideaCount),
      exemplar: s.exemplar,
      ideaLabels: p.ideas.map((i) => i.label.trim()).join("; "),
    };
  },
  answerVars: ["exemplar", "ideaLabels"],
  present(p, seed): TeachBackView {
    return {
      listener: p.listener,
      question: p.question,
      ideaCount: p.ideas.length,
      required: p.required,
      wordBank: seededShuffle(p.wordBank, seed),
      maxChars: MAX_EXPLANATION_CHARS,
    };
  },
  grade(p, input: TeachBackInput) {
    return gradeText(p, input?.text);
  },
  solutionInput: (_p, s) => ({ text: s.exemplar }),
});

export type TeachBackParams = Params;
