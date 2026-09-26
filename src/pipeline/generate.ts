import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output, type LanguageModel } from "ai";
import pLimit from "p-limit";
import type { z } from "zod";
import type { Genre, Issue } from "../contracts/common";
import type { GameSpec } from "../contracts/gamespec";
import { conceptWeight, type Intake, type KnowledgeMap } from "../contracts/knowledge";
import type { TeachingMechanic } from "../contracts/library";
import type { MatchResult } from "../contracts/match";
import {
  assessmentSchema,
  challengeSchema,
  directorSchema,
  narrativeSchema,
  type BlueprintEncounter,
  type BlueprintSlice,
  type ChallengeSlice,
  type DirectorMenuFamily,
  type NarrativeSlice,
} from "../contracts/slices";
import { cardPlaysIn, getCard, isCardImplemented } from "../library";
import { autoSelectGenre, BOSS_SOCKET, IMPLEMENTED_GENRES } from "../library/genres";
import { getMode, socketsFor } from "../mechanics/registry";
import { checkAssessment, checkBlueprint, checkChallenge, checkNarrative } from "./validate/checks";
import { validateGameSpec } from "./validate/validate-gamespec";
import { assembleGameSpec, type Slices } from "./assemble";
import {
  ASSESSMENT_SYSTEM,
  CHALLENGE_SYSTEM,
  DIRECTOR_SYSTEM,
  NARRATIVE_SYSTEM,
  assessmentPrompt,
  challengePrompt,
  directorMenu,
  directorPrompt,
  narrativePrompt,
  repairNote,
  sharedContext,
} from "./prompts";

/*
 * The back half of the pipeline (S6–S9) as plain async TypeScript. P6 wraps this in the job
 * orchestrator (SSE events, storage, blind solve); the mock test drives it directly.
 */

export interface Models {
  fast: LanguageModel;
  smart: LanguageModel;
}

export interface Progress {
  agent: string;
  status: "start" | "repair" | "done" | "fallback" | "failed";
  ms?: number;
  note?: string;
}

export interface GenerateArgs {
  gameId: string;
  km: KnowledgeMap;
  intake: Intake;
  /** matcher output per concept (S4) */
  matches: readonly MatchResult[];
  models: Models;
  now?: () => Date;
  onProgress?: (p: Progress) => void;
  concurrency?: number;
}

export class AgentError extends Error {
  constructor(
    readonly agent: string,
    readonly problems: string[],
  ) {
    super(`${agent} failed after repairs: ${problems.join("; ")}`);
  }
}

export class GenerationError extends Error {
  constructor(readonly issues: Issue[]) {
    super(`generated spec failed validation: ${issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
}

/** One structured call with check -> repair retries. Every agent goes through here (P5a moves this into llm.ts). */
export async function callAgent<T>(o: {
  agent: string;
  model: LanguageModel;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  check?: (out: T) => string[];
  maxRepairs?: number;
  onProgress?: (p: Progress) => void;
}): Promise<T> {
  let notes = "";
  let problems: string[] = [];
  const attempts = (o.maxRepairs ?? 1) + 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const t0 = Date.now();
    o.onProgress?.({ agent: o.agent, status: attempt === 1 ? "start" : "repair", note: problems[0] });
    try {
      const { output } = await generateText({
        model: o.model,
        system: o.system,
        prompt: o.prompt + notes,
        output: Output.object({ schema: o.schema, name: o.agent.replace(/[^a-zA-Z0-9_-]/g, "_") }),
      });
      problems = o.check?.(output) ?? [];
      if (problems.length === 0) {
        o.onProgress?.({ agent: o.agent, status: "done", ms: Date.now() - t0 });
        return output;
      }
      notes = repairNote(problems, output);
    } catch (err) {
      // The model's JSON didn't parse or didn't match the zod schema: feed the error back and retry.
      if (NoObjectGeneratedError.isInstance(err) || NoOutputGeneratedError.isInstance(err)) {
        problems = [`your answer did not match the required JSON schema: ${err.message}`];
        notes = repairNote(problems);
        continue;
      }
      throw err; // network/auth/rate-limit errors: let the caller's retry policy handle them
    }
  }
  o.onProgress?.({ agent: o.agent, status: "failed", note: problems[0] });
  throw new AgentError(o.agent, problems);
}

/** MEGAPROMPT §6: 5 min → 5–7, 10 min → 8–12, 15 min → 11–14. */
export function encounterRange(minutes: number): [number, number] {
  if (minutes <= 5) return [5, 7];
  if (minutes <= 10) return [8, 12];
  return [11, 14];
}

/** Genre resolution: the requested genre when its host exists, else auto-select from the weights (LIBRARY §1.1). */
export function resolveGenre(km: KnowledgeMap, intake: Intake): { genre: Genre; reason: string } {
  if (intake.genre !== "auto" && IMPLEMENTED_GENRES.includes(intake.genre)) return { genre: intake.genre, reason: "requested" };
  const weights: Partial<Record<KnowledgeMap["concepts"][number]["knowledgeType"], number>> = {};
  for (const c of km.concepts) weights[c.knowledgeType] = (weights[c.knowledgeType] ?? 0) + conceptWeight(c, intake);
  const { genre } = autoSelectGenre(weights);
  return { genre, reason: intake.genre === "auto" ? "auto-selected from knowledge-type weights" : `"${intake.genre}" has no host yet; auto-selected` };
}

/**
 * The Director's menu: per concept, the matcher's implemented picks that play in this genre, grouped by
 * family with the sockets each family can use. Every concept keeps at least one option (mimic_chest).
 */
export function buildDirectorMenu(km: KnowledgeMap, matches: readonly MatchResult[], genre: Genre): DirectorMenuFamily[] {
  const chosen = new Map<string, TeachingMechanic>();
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

export async function generateGame(a: GenerateArgs): Promise<{ spec: GameSpec; warnings: Issue[]; repairs: number; genre: Genre }> {
  const { genre, reason } = resolveGenre(a.km, a.intake);
  const conceptIds = a.km.concepts.map((c) => c.id);
  const beliefs = [...new Set(a.km.concepts.flatMap((c) => c.misconceptions.map((m) => m.belief)))];
  const shared = sharedContext(a.km, a.intake, genre);
  const limit = pLimit(a.concurrency ?? 6);
  const [minE, maxE] = encounterRange(a.intake.minutes);
  const progress = a.onProgress;
  const bossSocket = BOSS_SOCKET[genre];
  const menu = buildDirectorMenu(a.km, a.matches, genre);
  if (reason !== "requested") progress?.({ agent: "director", status: "start", note: `genre ${genre}: ${reason}` });

  // 1. Director: the only sequential LLM step.
  const blueprint: BlueprintSlice = await callAgent({
    agent: "director",
    model: a.models.smart,
    schema: directorSchema({ genre, conceptIds, families: menu, beliefs, bossSocket, minEncounters: minE, maxEncounters: maxE }),
    system: DIRECTOR_SYSTEM,
    prompt: directorPrompt(shared, directorMenu(menu, genre), minE, maxE),
    check: (bp) => checkBlueprint(bp, { genre, conceptIds, bossSocket, getCard, concepts: a.km.concepts }),
    maxRepairs: 2,
    onProgress: progress,
  });

  const writeChallenge = (e: BlueprintEncounter, notes = "") =>
    limit(() => {
      const card = getCard(e.teachingMechanicId)!;
      const m = getMode(card.family, card.mode)!;
      return callAgent({
        agent: `challenge:${e.id}`,
        model: a.models.smart,
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
        model: a.models.fast,
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
        model: a.models.fast,
        schema: assessmentSchema(conceptIds),
        system: ASSESSMENT_SYSTEM,
        prompt: assessmentPrompt(shared, a.intake.preCheck.items) + notes,
        check: (s) => checkAssessment(s, prePrompts),
        onProgress: progress,
      }),
    );

  // 2. Fan-out: one challenge writer per encounter, plus narrative and assessment, all in parallel.
  const [challengeResults, narrative, assessment] = await Promise.all([
    Promise.all(
      blueprint.encounters.map((e) =>
        writeChallenge(e).then(
          (slice) => ({ e, slice, ok: true as const }),
          (error: unknown) => ({ e, error, ok: false as const }),
        ),
      ),
    ),
    writeNarrative(),
    writeAssessment(),
  ]);

  // 3. Fallbacks: a failed encounter becomes a Mimic Chest from verified facts, or is dropped (never the boss).
  const encounters: BlueprintEncounter[] = [];
  const challenges: Record<string, ChallengeSlice> = {};
  for (const r of challengeResults) {
    if (r.ok) {
      encounters.push(r.e);
      challenges[r.e.id] = r.slice;
      continue;
    }
    const fb = fallbackMimic(a.km, r.e, genre);
    if (fb) {
      progress?.({ agent: `challenge:${r.e.id}`, status: "fallback", note: "replaced with a Mimic Chest from verified facts" });
      encounters.push(fb.encounter);
      challenges[r.e.id] = fb.slice;
    } else if (r.e.role === "boss") {
      throw r.error;
    } else {
      progress?.({ agent: `challenge:${r.e.id}`, status: "fallback", note: "dropped" });
    }
  }
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
  };

  // 4. Assemble + validate. On failure, route each issue to the agent that owns it, once.
  progress?.({ agent: "verifier", status: "start" });
  let result = validateGameSpec(assembleGameSpec(slices));
  let repairs = 0;
  if (!result.ok) {
    const issues = result.issues;
    if (issues.some((i) => i.owner === "director" || i.owner === "code")) throw new GenerationError(issues);

    const byEncounter = new Map<string, string[]>();
    issues
      .filter((i) => i.owner === "challenge_writer" && i.encounterId)
      .forEach((i) => byEncounter.set(i.encounterId!, [...(byEncounter.get(i.encounterId!) ?? []), i.message]));
    const jobs: Promise<unknown>[] = [...byEncounter].map(([id, messages]) => {
      const e = encounters.find((x) => x.id === id)!;
      return writeChallenge(e, repairNote(messages, challenges[id])).then((s) => (challenges[id] = s));
    });
    const own = (owner: Issue["owner"]) => issues.filter((i) => i.owner === owner).map((i) => `${i.path.join(".")}: ${i.message}`);
    if (own("narrative").length) jobs.push(writeNarrative(repairNote(own("narrative"))).then((n) => (slices.narrative = trimBeats(n))));
    if (own("assessment").length) jobs.push(writeAssessment(repairNote(own("assessment"))).then((s) => (slices.assessment = s)));
    await Promise.all(jobs);
    repairs = jobs.length;
    result = validateGameSpec(assembleGameSpec(slices));
    if (!result.ok) throw new GenerationError(result.issues);
  }
  progress?.({ agent: "verifier", status: "done", note: repairs ? `repaired ${repairs} slice(s)` : "all checks passed" });
  return { spec: result.spec, warnings: result.warnings, repairs, genre };
}
