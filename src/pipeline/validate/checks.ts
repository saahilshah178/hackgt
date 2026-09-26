import type { Genre } from "../../contracts/common";
import type { AssessmentSlice, BlueprintSlice, ChallengeSlice, NarrativeSlice } from "../../contracts/slices";
import { BOSS_SOCKET } from "../../library/genres";
import { getMechanic } from "../../mechanics/registry";
import type { AnyMechanic } from "../../mechanics/types";
import { placeholders } from "../../mechanics/util";

/*
 * Each check returns human-readable problems. The generation loop sends them straight back to the
 * agent that produced the slice ("Your previous answer had these problems: ..."), so write them as
 * instructions a model can act on.
 */

const SNAKE = /^[a-z][a-z0-9_]{0,47}$/;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function checkBlueprint(bp: BlueprintSlice, ctx: { genre: Genre; conceptIds: readonly string[] }): string[] {
  const problems: string[] = [];
  const bossSocket = BOSS_SOCKET[ctx.genre];

  const ids = bp.encounters.map((e) => e.id);
  if (new Set(ids).size !== ids.length) problems.push("encounter ids must be unique");
  ids.filter((id) => !SNAKE.test(id)).forEach((id) => problems.push(`encounter id "${id}" must be lowercase snake_case`));

  const charIds = bp.characters.map((c) => c.id);
  if (new Set(charIds).size !== charIds.length) problems.push("character ids must be unique");
  charIds.filter((id) => !SNAKE.test(id)).forEach((id) => problems.push(`character id "${id}" must be lowercase snake_case`));
  if (bp.title.length > 40) problems.push("title must be under 40 characters");

  bp.encounters.forEach((e, i) => {
    const last = i === bp.encounters.length - 1;
    if (e.role === "boss" && !last) problems.push(`"${e.id}" is a boss but not the last encounter`);
    if (last && e.role !== "boss") problems.push("the last encounter must have role \"boss\"");
    if (e.role === "boss" && e.socket !== bossSocket) problems.push(`the boss must use socket "${bossSocket}"`);
    if (e.role !== "boss" && e.socket === bossSocket) problems.push(`"${e.id}" uses the boss socket but is not the boss`);
    if (new Set(e.conceptIds).size !== e.conceptIds.length) problems.push(`"${e.id}" lists a concept twice`);
    if (e.role !== "boss" && e.conceptIds.length > 1) problems.push(`"${e.id}": only the boss may combine concepts`);
  });

  const covered = new Set(bp.encounters.flatMap((e) => e.conceptIds));
  ctx.conceptIds
    .filter((c) => !covered.has(c))
    .forEach((c) => problems.push(`concept "${c}" is never practiced; give it at least one encounter`));

  const seen = new Set<string>();
  bp.encounters.forEach((e) => {
    if (e.role === "review" && !e.conceptIds.some((c) => seen.has(c))) {
      problems.push(`"${e.id}" is a review, but its concept hasn't appeared earlier`);
    }
    e.conceptIds.forEach((c) => seen.add(c));
  });
  return problems;
}

export function checkChallenge(m: AnyMechanic, slice: ChallengeSlice): string[] {
  const parsed = m.paramsSchema.safeParse(slice.params);
  if (!parsed.success) return parsed.error.issues.map((i) => `params.${i.path.join(".")}: ${i.message}`);

  const problems = m.check(parsed.data);
  if (problems.length > 0) return problems; // can't resolve bad params; fix those first

  const solution = m.resolve(parsed.data);
  const known = Object.keys(m.templateVars(parsed.data, solution));
  const texts: [string, string][] = [
    ["prompt", slice.prompt],
    ...slice.hints.map((h, i): [string, string] => [`hints[${i}]`, h]),
    ["wrongFeedback", slice.wrongFeedback],
    ["debriefLine", slice.debriefLine],
  ];
  const leakProne = new Set(["prompt", "hints[0]", "wrongFeedback"]);
  for (const [field, text] of texts) {
    if (!text.trim()) problems.push(`${field} is empty`);
    if (text.length > 220) problems.push(`${field} is ${text.length} characters; keep it under 220`);
    for (const name of placeholders(text)) {
      if (!known.includes(name)) {
        problems.push(`${field} uses unknown placeholder {{${name}}}. Allowed: ${known.map((k) => `{{${k}}}`).join(", ")}`);
      } else if (leakProne.has(field) && m.answerVars.includes(name)) {
        problems.push(`${field} gives away the answer via {{${name}}}; only later hints and the debrief may use it`);
      }
    }
  }
  if (slice.sourceRef && slice.sourceRef.quote.length > 300) problems.push("sourceRef.quote must be under 300 characters");
  if (!m.grade(parsed.data, m.solutionInput(parsed.data, solution)).correct) {
    problems.push("internal: the computed solution does not pass grade(); regenerate the params");
  }
  return problems;
}

export function checkNarrative(slice: NarrativeSlice): string[] {
  const problems: string[] = [];
  const lines = [...slice.intro, ...slice.outro, ...slice.beats];
  lines.forEach((l) => {
    if (words(l.text) > 24) problems.push(`line "${l.text.slice(0, 40)}..." has ${words(l.text)} words; keep lines to 20`);
  });
  const keys = slice.beats.map((b) => `${b.encounterId}:${b.when}`);
  if (new Set(keys).size !== keys.length) problems.push("at most one beat per encounter per position (before/after)");
  return problems;
}

export function checkAssessment(slice: AssessmentSlice): string[] {
  const problems: string[] = [];
  [...slice.pre.map((q) => ["pre", q] as const), ...slice.post.map((q) => ["post", q] as const)].forEach(([set, q], i) => {
    const options = [q.correct, ...q.distractors].map((o) => o.trim().toLowerCase());
    if (new Set(options).size !== options.length) problems.push(`${set} item ${i}: the correct answer and distractors must all differ`);
  });
  const pre = new Set(slice.pre.map((q) => q.prompt.trim().toLowerCase()));
  if (slice.post.some((q) => pre.has(q.prompt.trim().toLowerCase()))) problems.push("post-check questions must not repeat pre-check questions");
  return problems;
}

/** Convenience for callers holding only a mechanic id. */
export function checkChallengeById(mechanicId: string, slice: ChallengeSlice): string[] {
  const m = getMechanic(mechanicId);
  return m ? checkChallenge(m, slice) : [`unknown mechanic "${mechanicId}"`];
}
