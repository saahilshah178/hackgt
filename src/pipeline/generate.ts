import pLimit from "p-limit";
import type { LanguageModel } from "ai";
import type { z } from "zod";
import type { Genre, Issue } from "../contracts/common";
import type { GameSpec } from "../contracts/gamespec";
import { conceptWeight, type Intake, type KnowledgeMap } from "../contracts/knowledge";
import type { TeachingMechanic } from "../contracts/library";
import type { MatchResult } from "../contracts/match";
import {
  assessmentSchema,
  challengeSchema,
  tutorSchema,
  directorSchema,
  narrativeSchema,
  type AssessmentItemSlice,
  type AssessmentSlice,
  type BlueprintEncounter,
  type BlueprintSlice,
  type ChallengeSlice,
  type DirectorMenuFamily,
  type NarrativeSlice,
  type TutorSlice,
} from "../contracts/slices";
import { cardPlaysIn, getCard, isCardImplemented } from "../library";
import { autoSelectGenre, BOSS_SOCKET, OFFERED_GENRES } from "../library/genres";
import { getMode, socketsFor } from "../mechanics/registry";
import { emit } from "./events";
import { AgentError, runAgent, type Progress } from "./llm";
import { checkAssessment, checkBlueprint, checkChallenge, checkNarrative, checkTutor } from "./validate/checks";
import { isMockLLM } from "../server/env";
import { validateGameSpec } from "./validate/validate-gamespec";
import { assembleGameSpec, type Slices } from "./assemble";
import { applyProfileTargets, personalCards, profileSummary, recommendGenres } from "./personalize";
import {
  ASSESSMENT_SYSTEM,
  CHALLENGE_SYSTEM,
  DIRECTOR_SYSTEM,
  NARRATIVE_SYSTEM,
  TUTOR_SYSTEM,
  assessmentPrompt,
  challengePrompt,
  directorMenu,
  directorPrompt,
  narrativePrompt,
  repairNote,
  sharedContext,
  tutorPrompt,
} from "./prompts";

/*
 * The back half of the pipeline (S6–S9) as plain async TypeScript. P6 wraps this in the job
 * orchestrator (SSE events, storage, blind solve); the mock test drives it directly.
 */

export interface Models {
  fast: LanguageModel;
  smart: LanguageModel;
}

export type { Progress } from "./llm";

export interface GenerateArgs {
  gameId: string;
  /** Groups this run's events on the bus (src/pipeline/events.ts); defaults to gameId. */
  jobId?: string;
  km: KnowledgeMap;
  intake: Intake;
  /** matcher output per concept (S4) */
  matches: readonly MatchResult[];
  models: Models;
  now?: () => Date;
  onProgress?: (p: Progress) => void;
  concurrency?: number;
  /**
   * The genre already resolved by the caller (the orchestrator resolves it on the student's whole selection,
   * before focusing a big one down, so "Pick for me" plays what the intake page recommended).
   */
  resolved?: { genre: Genre; reason: string };
}

export { AgentError };

export class GenerationError extends Error {
  constructor(readonly issues: Issue[]) {
    super(`generated spec failed validation: ${issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
}

/** One structured call with check -> repair retries. Every agent goes through runAgent() (src/pipeline/llm.ts). */
export function callAgent<T>(o: {
  agent: string;
  tier: "smart" | "fast";
  model: LanguageModel;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  check?: (out: T) => string[];
  maxRepairs?: number;
  onProgress?: (p: Progress) => void;
  jobId?: string;
}): Promise<T> {
  return runAgent({
    jobId: o.jobId ?? "local",
    agent: o.agent,
    tier: o.tier,
    model: o.model,
    schema: o.schema,
    system: o.system,
    prompt: o.prompt,
    check: o.check,
    maxRepairs: o.maxRepairs,
    onProgress: o.onProgress,
  });
}

/** MEGAPROMPT §6: 5 min → 5–7, 10 min → 8–12, 15 min → 11–14. */
export function encounterRange(minutes: number): [number, number] {
  if (minutes <= 5) return [5, 7];
  if (minutes <= 10) return [8, 12];
  return [11, 14];
}

/**
 * Genre resolution: the requested genre when its host exists, else auto-select. With the matcher's results
 * in hand, "auto" plays the top of recommendGenres (material fit + matched components + interests); without
 * them it falls back to the knowledge-type weights alone (LIBRARY §1.1).
 */
export function resolveGenre(km: KnowledgeMap, intake: Intake, matches?: readonly MatchResult[]): { genre: Genre; reason: string } {
  if (intake.genre !== "auto" && OFFERED_GENRES.includes(intake.genre)) return { genre: intake.genre, reason: "requested" };
  const why = intake.genre === "auto" ? "auto-selected" : `"${intake.genre}" is no longer offered; auto-selected`;
  if (matches && matches.length > 0) {
    const [top] = recommendGenres(km, intake, matches);
    if (top) return { genre: top.genre, reason: `${why} for this learner (${top.reasons[0] ?? `fit ${top.score}`})` };
  }
  const weights: Partial<Record<KnowledgeMap["concepts"][number]["knowledgeType"], number>> = {};
  for (const c of km.concepts) weights[c.knowledgeType] = (weights[c.knowledgeType] ?? 0) + conceptWeight(c, intake);
  const { genre } = autoSelectGenre(weights);
  return { genre, reason: `${why} from knowledge-type weights` };
}

/**
 * The Director's menu: per concept, the matcher's implemented picks that play in this genre, grouped by
 * family with the sockets each family can use. Every concept keeps at least one option (mimic_chest), and the
 * universal teach_back card (explain it in your own words) is always offered.
 */
export function buildDirectorMenu(
  km: KnowledgeMap,
  matches: readonly MatchResult[],
  genre: Genre,
  /** extra implemented cards for this learner (personalCards: the ones that break their flagged misconceptions) */
  extra: readonly TeachingMechanic[] = [],
): DirectorMenuFamily[] {
  const chosen = new Map<string, TeachingMechanic>();
  for (const card of extra) if (isCardImplemented(card) && cardPlaysIn(card, genre)) chosen.set(card.id, card);
  const fallback = getCard("mimic_chest");
  for (const c of km.concepts) {
    const picks = matches.find((m) => m.conceptId === c.id)?.picks ?? [];
    let any = false;
    for (const p of picks) {
      const card = getCard(p.teachingMechanicId);
      if (card && isCardImplemented(card) && cardPlaysIn(card, genre)) {
        chosen.set(card.id, card);
        any = true;
      }
    }
    if (!any && fallback) chosen.set(fallback.id, fallback);
  }
  if (fallback && cardPlaysIn(fallback, genre)) chosen.set(fallback.id, fallback);
  // the universal explain-it-back card is always on the menu: an alternative to multiple choice for any concept
  const explain = getCard("teach_back");
  if (explain && isCardImplemented(explain) && cardPlaysIn(explain, genre)) chosen.set(explain.id, explain);
  const byFamily = new Map<TeachingMechanic["family"], TeachingMechanic[]>();
  for (const card of chosen.values()) byFamily.set(card.family, [...(byFamily.get(card.family) ?? []), card]);
  return [...byFamily].map(([familyId, cards]) => ({
    familyId,
    sockets: socketsFor(familyId, genre, BOSS_SOCKET[genre]),
    cards: cards.sort((a, b) => a.id.localeCompare(b.id)),
  }));
}

/**
 * Last resort for an encounter whose writer failed twice: a Mimic Chest built from verified facts
 * and a listed misconception. Returns null when the concept doesn't have enough material.
 */
export function fallbackMimic(
  km: KnowledgeMap,
  e: BlueprintEncounter,
  genre: Genre,
): { encounter: BlueprintEncounter; slice: ChallengeSlice } | null {
  const card = getCard("mimic_chest");
  const mode = card && getMode(card.family, card.mode);
  if (!card || !mode) return null;
  const concept = km.concepts.find((c) => c.id === e.conceptIds[0]);
  const sockets = socketsFor(card.family, genre, BOSS_SOCKET[genre]);
  const socket = e.role === "boss" ? BOSS_SOCKET[genre] : sockets.find((s) => s !== BOSS_SOCKET[genre]);
  if (!concept || socket === undefined || concept.facts.length < 2 || concept.misconceptions.length === 0) return null;
  const [a, b] = concept.facts;
  const lie = concept.misconceptions[0];
  const slice: ChallengeSlice = {
    prompt: `Three claims about ${concept.name}. One of them is false. Find it.`,
    params: {
      statements: [
        { text: a.statement, isTrue: true, explanation: "This one checks out against your source." },
        { text: lie.belief, isTrue: false, explanation: lie.correction },
        { text: b.statement, isTrue: true, explanation: "This one checks out against your source." },
      ],
    },
    hints: [
      `Think about what ${concept.name} really means.`,
      "Two claims agree with your notes. Which one doesn't?",
      "The false claim is: {{mimic}}",
    ],
    wrongFeedback: "That claim holds up. Look for the one that contradicts your notes.",
    debriefLine: `The false claim was "{{mimic}}". ${lie.correction}`,
    sourceRef: a.sourceRef,
  };
  const encounter: BlueprintEncounter = { ...e, teachingMechanicId: card.id, socket, targetMisconception: lie.belief };
  return checkChallenge(mode, slice, card.lockedParams).length === 0 ? { encounter, slice } : null;
}

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** M1: a narrative writer that fails outright (AgentError or network) never fails the job: a minimal narrative keeps the game playable. */
function minimalNarrative(blueprint: BlueprintSlice): NarrativeSlice {
  const speakerId = blueprint.characters[0].id;
  return { intro: [{ speakerId, text: blueprint.premise }], outro: [{ speakerId, text: "Well played." }], beats: [] };
}

/**
 * M1: last resort for an assessment writer that fails twice: derive the post-check straight from the
 * pre-check's concepts and misconceptions instead of calling the model again. For each pre-check
 * concept, the correct answer is the listed misconception's correction; distractors are that
 * misconception's belief plus other concepts' beliefs, padded with facts if there still aren't three.
 */
export function deriveAssessmentFromPreCheck(km: KnowledgeMap, preCheckItems: readonly { conceptId: string }[]): AssessmentSlice {
  const allBeliefs = km.concepts.flatMap((c) => c.misconceptions.map((m) => m.belief));
  const post: AssessmentItemSlice[] = preCheckItems.map((item) => {
    const concept = km.concepts.find((c) => c.id === item.conceptId);
    const name = concept?.name ?? item.conceptId;
    const misconception = concept?.misconceptions[0];
    const correct = misconception?.correction ?? concept?.facts[0]?.statement ?? `${name} works as described in the notes.`;
    const factFillers = (concept?.facts ?? []).map((f) => f.statement);
    const pool = [misconception?.belief, ...allBeliefs, ...factFillers].filter((s): s is string => !!s && s !== correct);
    const distractors = [...new Set(pool)].slice(0, 3);
    while (distractors.length < 3) distractors.push(`Not related to ${name}.`);
    return { conceptId: item.conceptId, prompt: `After playing, which statement about ${name} is correct?`, correct, distractors };
  });
  return { post };
}

/**
 * M8: when an encounter is dropped outright (no fallback possible) and it was the first ("teach")
 * encounter for one of its concepts, that concept would otherwise be practiced before it's taught.
 * Promotes the next remaining encounter for that concept to role "teach" — since the boss is always
 * last, a promoted non-boss encounter always precedes it.
 */
export function promoteTeachForDropped(encounters: Pick<BlueprintEncounter, "role" | "conceptIds">[], droppedTeachConceptIds: readonly string[]): void {
  for (const conceptId of droppedTeachConceptIds) {
    if (encounters.some((e) => e.role === "teach" && e.conceptIds.includes(conceptId))) continue;
    const next = encounters.find((e) => e.role !== "boss" && e.conceptIds.includes(conceptId));
    if (next) next.role = "teach";
  }
}

export async function generateGame(a: GenerateArgs): Promise<{ spec: GameSpec; warnings: Issue[]; repairs: number; genre: Genre }> {
  const { genre, reason } = a.resolved ?? resolveGenre(a.km, a.intake, a.matches);
  const conceptIds = a.km.concepts.map((c) => c.id);
  const beliefs = [...new Set(a.km.concepts.flatMap((c) => c.misconceptions.map((m) => m.belief)))];
  const shared = sharedContext(a.km, a.intake, genre);
  const limit = pLimit(a.concurrency ?? 6);
  const [minE, maxE] = encounterRange(a.intake.minutes);
  const progress = a.onProgress;
  const jobId = a.jobId ?? a.gameId;
  // Every runAgent() call below auto-emits to the job's event bus (llm.ts); these few notes are
  // generated directly by this function (not through runAgent), so they need the same treatment to
  // reach the SSE stream (GET /api/jobs/:id/stream) — not just callers that pass onProgress.
  const note = (p: Progress) => {
    progress?.(p);
    emit(jobId, p);
  };
  const bossSocket = BOSS_SOCKET[genre];
  const extraCards = personalCards(a.km, a.intake.profile, genre);
  const menu = buildDirectorMenu(a.km, a.matches, genre, extraCards);
  const baseMenu = new Set(buildDirectorMenu(a.km, a.matches, genre).flatMap((f) => f.cards.map((c) => c.id)));
  const addedCards = extraCards.filter((c) => !baseMenu.has(c.id) && menu.some((f) => f.cards.some((x) => x.id === c.id)));
  if (reason !== "requested") note({ agent: "director", status: "start", note: `genre ${genre}: ${reason}` });
  const summary = profileSummary(a.km, a.intake.profile, addedCards);
  if (summary) note({ agent: "personalize", status: "done", note: summary });

  // 1. Director: the only sequential LLM step.
  const blueprint: BlueprintSlice = await callAgent({
    agent: "director",
    tier: "smart",
    model: a.models.smart,
    jobId,
    schema: directorSchema({ genre, conceptIds, families: menu, beliefs, bossSocket, minEncounters: minE, maxEncounters: maxE }),
    system: DIRECTOR_SYSTEM,
    prompt: directorPrompt(shared, directorMenu(menu, genre), minE, maxE),
    check: (bp) => checkBlueprint(bp, { genre, conceptIds, bossSocket, getCard, concepts: a.km.concepts }),
    maxRepairs: 2,
    onProgress: progress,
  });
  // Code, not the model, guarantees that every misconception the learner ticked is attacked somewhere.
  const retargeted = applyProfileTargets(blueprint, a.km, a.intake.profile);
  if (retargeted > 0) {
    note({ agent: "personalize", status: "done", note: `aimed ${retargeted} encounter${retargeted === 1 ? "" : "s"} at the misconceptions you flagged` });
  }

  const writeChallenge = (e: BlueprintEncounter, notes = "") =>
    limit(() => {
      const card = getCard(e.teachingMechanicId)!;
      const m = getMode(card.family, card.mode)!;
      return callAgent({
        agent: `challenge:${e.id}`,
        tier: "smart",
        model: a.models.smart,
        jobId,
        schema: challengeSchema(m.paramsSchema, Object.keys(card.lockedParams ?? {})),
        system: CHALLENGE_SYSTEM,
        prompt: challengePrompt(shared, blueprint, e, card, m, notes),
        check: (s) => checkChallenge(m, s, card.lockedParams),
        maxRepairs: e.role === "boss" ? 2 : 1,
        onProgress: progress,
      });
    });
  const characterIds = blueprint.characters.map((c) => c.id);
  const encounterIds = blueprint.encounters.map((e) => e.id);
  const writeNarrative = (notes = "") =>
    limit(() =>
      callAgent({
        agent: "narrative",
        tier: "fast",
        model: a.models.fast,
        jobId,
        schema: narrativeSchema(characterIds, encounterIds),
        system: NARRATIVE_SYSTEM,
        prompt: narrativePrompt(shared, blueprint) + notes,
        check: checkNarrative,
        onProgress: progress,
      }),
    );
  const prePrompts = a.intake.preCheck.items.map((q) => q.prompt);
  const writeAssessment = (notes = "") =>
    limit(() =>
      callAgent({
        agent: "assessment",
        tier: "fast",
        model: a.models.fast,
        jobId,
        schema: assessmentSchema(conceptIds),
        system: ASSESSMENT_SYSTEM,
        prompt: assessmentPrompt(shared, a.intake.preCheck.items) + notes,
        check: (s) => checkAssessment(s, prePrompts),
        onProgress: progress,
      }),
    );

  // M1: a narrative writer that fails outright (its own repair budget exhausted, or a network error)
  // must never fail the job: fall back to a minimal narrative instead of rejecting.
  const writeNarrativeSafe = (notes = ""): Promise<NarrativeSlice> =>
    writeNarrative(notes).catch((err: unknown) => {
      note({ agent: "narrative", status: "fallback", note: `writer failed (${errMsg(err)}); using a minimal narrative` });
      return minimalNarrative(blueprint);
    });
  // M1: same for the assessment (post-check) writer, but it gets one retry first since a good
  // post-check matters more than a good narrative line.
  const writeAssessmentSafe = async (notes = ""): Promise<AssessmentSlice> => {
    try {
      return await writeAssessment(notes);
    } catch {
      try {
        return await writeAssessment(notes);
      } catch (err) {
        note({
          agent: "assessment",
          status: "fallback",
          note: `writer failed twice (${errMsg(err)}); deriving the post-check from the pre-check's concepts`,
        });
        return deriveAssessmentFromPreCheck(a.km, a.intake.preCheck.items);
      }
    }
  };

  // The Tutor writes the plain-words explanation and worked example for every lesson. Code builds the rest of
  // each lesson from the knowledge map (lessons.ts), so a failed or skipped tutor still ships a lesson per concept;
  // mock mode has no recorded tutor replies, so it is skipped there.
  const writeTutorSafe = (): Promise<TutorSlice | null> =>
    isMockLLM()
      ? Promise.resolve(null)
      : limit(() =>
          callAgent({
            agent: "tutor",
            tier: "fast",
            model: a.models.fast,
            jobId,
            schema: tutorSchema(conceptIds),
            system: TUTOR_SYSTEM,
            prompt: tutorPrompt(shared, conceptIds),
            check: (s) => checkTutor(s, conceptIds),
            onProgress: progress,
          }),
        ).catch((err: unknown) => {
          note({ agent: "tutor", status: "fallback", note: `tutor failed (${errMsg(err)}); lessons use the source's facts only` });
          return null;
        });

  // 2. Fan-out: one challenge writer per encounter, plus narrative, assessment and tutor, all in parallel.
  const [challengeResults, narrative, assessment, tutor] = await Promise.all([
    Promise.all(
      blueprint.encounters.map((e) =>
        writeChallenge(e).then(
          (slice) => ({ e, slice, ok: true as const }),
          (error: unknown) => ({ e, error, ok: false as const }),
        ),
      ),
    ),
    writeNarrativeSafe(),
    writeAssessmentSafe(),
    writeTutorSafe(),
  ]);

  // 3. Fallbacks: a failed encounter becomes a Mimic Chest from verified facts, or is dropped (never the boss).
  const encounters: BlueprintEncounter[] = [];
  const challenges: Record<string, ChallengeSlice> = {};
  const droppedTeachConceptIds: string[] = [];
  for (const r of challengeResults) {
    if (r.ok) {
      encounters.push(r.e);
      challenges[r.e.id] = r.slice;
      continue;
    }
    const fb = fallbackMimic(a.km, r.e, genre);
    if (fb) {
      note({ agent: `challenge:${r.e.id}`, status: "fallback", note: "replaced with a Mimic Chest from verified facts" });
      encounters.push(fb.encounter);
      challenges[r.e.id] = fb.slice;
    } else if (r.e.role === "boss") {
      throw r.error;
    } else {
      note({ agent: `challenge:${r.e.id}`, status: "fallback", note: "dropped" });
      if (r.e.role === "teach") droppedTeachConceptIds.push(...r.e.conceptIds);
    }
  }
  promoteTeachForDropped(encounters, droppedTeachConceptIds);
  const kept = new Set(encounters.map((e) => e.id));
  const trimBeats = (n: NarrativeSlice): NarrativeSlice => ({ ...n, beats: n.beats.filter((b) => kept.has(b.encounterId)) });

  const slices: Slices = {
    id: a.gameId,
    createdAt: (a.now?.() ?? new Date()).toISOString(),
    km: a.km,
    intake: a.intake,
    blueprint: { ...blueprint, encounters },
    challenges,
    narrative: trimBeats(narrative),
    assessment,
    tutor,
  };

  // 4. Assemble + validate. On failure, route each issue to the agent that owns it, once.
  note({ agent: "verifier", status: "start" });
  let result = validateGameSpec(assembleGameSpec(slices));
  let repairs = 0;
  if (!result.ok) {
    const issues = result.issues;
    if (issues.some((i) => i.owner === "director" || i.owner === "code")) throw new GenerationError(issues);

    const byEncounter = new Map<string, string[]>();
    issues
      .filter((i) => i.owner === "challenge_writer" && i.encounterId)
      .forEach((i) => byEncounter.set(i.encounterId!, [...(byEncounter.get(i.encounterId!) ?? []), i.message]));
    // M1: a repair write that rejects (AgentError from an exhausted repair budget, or a network
    // failure) must not reject Promise.all and fail the whole job — fall back the same way step 3
    // does: a Mimic Chest from verified facts, or drop the encounter (never the boss).
    const jobs: Promise<unknown>[] = [...byEncounter].map(([id, messages]) => {
      const e = encounters.find((x) => x.id === id)!;
      return writeChallenge(e, repairNote(messages, challenges[id])).then(
        (s) => {
          challenges[id] = s;
        },
        (error: unknown) => {
          const idx = encounters.findIndex((x) => x.id === id);
          const current = encounters[idx];
          const fb = fallbackMimic(a.km, current, genre);
          if (fb) {
            note({ agent: `challenge:${id}`, status: "fallback", note: "replaced with a Mimic Chest from verified facts" });
            encounters[idx] = fb.encounter;
            challenges[id] = fb.slice;
            return;
          }
          if (current.role === "boss") throw error;
          note({ agent: `challenge:${id}`, status: "fallback", note: "dropped" });
          if (current.role === "teach") droppedTeachConceptIds.push(...current.conceptIds);
          encounters.splice(idx, 1);
          delete challenges[id];
        },
      );
    });
    const own = (owner: Issue["owner"]) => issues.filter((i) => i.owner === owner).map((i) => `${i.path.join(".")}: ${i.message}`);
    if (own("narrative").length) jobs.push(writeNarrativeSafe(repairNote(own("narrative"))).then((n) => (slices.narrative = n)));
    if (own("assessment").length) jobs.push(writeAssessmentSafe(repairNote(own("assessment"))).then((s) => (slices.assessment = s)));
    await Promise.all(jobs);
    promoteTeachForDropped(encounters, droppedTeachConceptIds);
    slices.blueprint = { ...slices.blueprint, encounters };
    const keptAfterRepair = new Set(encounters.map((e) => e.id));
    slices.narrative = { ...slices.narrative, beats: slices.narrative.beats.filter((b) => keptAfterRepair.has(b.encounterId)) };
    repairs = jobs.length;
    result = validateGameSpec(assembleGameSpec(slices));
    if (!result.ok) throw new GenerationError(result.issues);
  }
  note({ agent: "verifier", status: "done", note: repairs ? `repaired ${repairs} slice(s)` : "all checks passed" });
  return { spec: result.spec, warnings: result.warnings, repairs, genre };
}
