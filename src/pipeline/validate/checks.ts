import type { Genre } from "../../contracts/common";
import type { Concept } from "../../contracts/knowledge";
import type { TeachingMechanic } from "../../contracts/library";
import type { AssessmentItemSlice, AssessmentSlice, BlueprintSlice, ChallengeSlice, NarrativeSlice, PreCheckSlice } from "../../contracts/slices";
import { answerVarsFor, type AnyFamilyMode } from "../../mechanics/types";
import { placeholders } from "../../mechanics/util";

/*
 * Each check returns human-readable problems. The generation loop sends them straight back to the
 * agent that produced the slice ("Your previous answer had these problems: ..."), so write them as
 * instructions a model can act on.
 */

const SNAKE = /^[a-z][a-z0-9_]{0,47}$/;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export interface BlueprintContext {
  genre: Genre;
  conceptIds: readonly string[];
  bossSocket: string;
  getCard: (id: string) => TeachingMechanic | undefined;
  /** when given, targetMisconception must be one of the encounter's concepts' beliefs */
  concepts?: readonly Concept[];
}

export function checkBlueprint(bp: BlueprintSlice, ctx: BlueprintContext): string[] {
  const problems: string[] = [];
  const bossSocket = ctx.bossSocket;

  if (bp.genre !== ctx.genre) problems.push(`genre must be "${ctx.genre}"`);

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
    if (last && e.role !== "boss") problems.push('the last encounter must have role "boss"');
    if (e.role === "boss" && e.socket !== bossSocket) problems.push(`the boss must use socket "${bossSocket}"`);
    if (e.role !== "boss" && e.socket === bossSocket) problems.push(`"${e.id}" uses the boss socket but is not the boss`);
    if (new Set(e.conceptIds).size !== e.conceptIds.length) problems.push(`"${e.id}" lists a concept twice`);
    if (e.role !== "boss" && e.conceptIds.length > 1) problems.push(`"${e.id}": only the boss may combine concepts`);
    if (e.role === "boss" && ctx.conceptIds.length >= 2 && e.conceptIds.length < 2) {
      problems.push(`the boss "${e.id}" must combine the 2-3 weakest concepts`);
    }
    if (!ctx.getCard(e.teachingMechanicId)) problems.push(`"${e.id}" uses unknown card "${e.teachingMechanicId}"`);
    if (e.targetMisconception !== null && ctx.concepts) {
      const beliefs = ctx.concepts.filter((c) => e.conceptIds.includes(c.id)).flatMap((c) => c.misconceptions.map((m) => m.belief));
      if (!beliefs.includes(e.targetMisconception)) {
        problems.push(`"${e.id}": targetMisconception must be one of its concepts' listed misconceptions, or null`);
      }
    }
  });

  const covered = new Set(bp.encounters.flatMap((e) => e.conceptIds));
  ctx.conceptIds
    .filter((c) => !covered.has(c))
    .forEach((c) => problems.push(`concept "${c}" is never practiced; give it at least one encounter`));

  const seen = new Set<string>();
  bp.encounters.forEach((e, i) => {
    if (e.role === "review") {
      if (!e.conceptIds.some((c) => seen.has(c))) problems.push(`"${e.id}" is a review, but its concept hasn't appeared earlier`);
      if (i < 2) problems.push(`"${e.id}" is a review but comes before two other encounters; place reviews after at least 2 encounters`);
    }
    e.conceptIds.forEach((c) => {
      if (!seen.has(c) && e.role !== "teach" && e.role !== "boss") {
        problems.push(`"${e.id}" is the first encounter for concept "${c}" but its role is "${e.role}"; teach before practice`);
      }
      if (!seen.has(c) && e.role === "boss") {
        problems.push(`concept "${c}" first appears in the boss; teach it in an earlier encounter`);
      }
      seen.add(c);
    });
  });
  return problems;
}

/** Merges the card's lockedParams over the model's params (code wins), then runs the mode's checks. */
export function mergeLockedParams(params: unknown, locked?: Record<string, unknown>): unknown {
  if (!locked || typeof params !== "object" || params === null) return params;
  return { ...(params as Record<string, unknown>), ...locked };
}

export function checkChallenge(m: AnyFamilyMode, slice: ChallengeSlice, locked?: Record<string, unknown>): string[] {
  const parsed = m.paramsSchema.safeParse(mergeLockedParams(slice.params, locked));
  if (!parsed.success) return parsed.error.issues.map((i) => `params.${i.path.join(".")}: ${i.message}`);

  const problems = m.check(parsed.data);
  if (problems.length > 0) return problems; // can't resolve bad params; fix those first

  const solution = m.resolve(parsed.data);
  const known = Object.keys(m.templateVars(parsed.data, solution));
  const answerVars = answerVarsFor(m, parsed.data);
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
      } else if (leakProne.has(field) && answerVars.includes(name)) {
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

function checkItems(items: readonly AssessmentItemSlice[], label: string): string[] {
  const problems: string[] = [];
  items.forEach((q, i) => {
    const options = [q.correct, ...q.distractors].map((o) => o.trim().toLowerCase());
    if (new Set(options).size !== options.length) problems.push(`${label} item ${i}: the correct answer and distractors must all differ`);
    if (!q.prompt.trim()) problems.push(`${label} item ${i}: prompt is empty`);
  });
  const prompts = items.map((q) => q.prompt.trim().toLowerCase());
  if (new Set(prompts).size !== prompts.length) problems.push(`${label}: questions must be distinct`);
  return problems;
}

export function checkPreCheck(slice: PreCheckSlice): string[] {
  return checkItems(slice.items, "pre-check");
}

/** The post-check must not repeat the pre-check prompts (passed in from the intake). */
export function checkAssessment(slice: AssessmentSlice, prePrompts: readonly string[] = []): string[] {
  const problems = checkItems(slice.post, "post-check");
  const pre = new Set(prePrompts.map((p) => p.trim().toLowerCase()));
  if (slice.post.some((q) => pre.has(q.prompt.trim().toLowerCase()))) problems.push("post-check questions must not repeat pre-check questions");
  return problems;
}
