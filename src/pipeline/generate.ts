import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output, type LanguageModel } from "ai";
import pLimit from "p-limit";
import type { z } from "zod";
import type { Issue } from "../contracts/common";
import type { GameSpec } from "../contracts/gamespec";
import type { Intake, KnowledgeMap } from "../contracts/knowledge";
import {
  assessmentSchema,
  challengeSchema,
  directorSchema,
  narrativeSchema,
  type BlueprintEncounter,
  type BlueprintSlice,
  type ChallengeSlice,
  type NarrativeSlice,
} from "../contracts/slices";
import { mimicChest } from "../mechanics/mimic-chest";
import { getMechanic, mechanicsFor } from "../mechanics/registry";
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
  directorPrompt,
  narrativePrompt,
  repairNote,
  sharedContext,
} from "./prompts";

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

/** One structured call with check -> repair retries. Every agent goes through here. */
async function callAgent<T>(o: {
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

/** More minutes -> more encounters, within what a Director can design well. */
export function encounterRange(minutes: number): [number, number] {
  const min = Math.min(12, Math.max(4, Math.round(minutes * 0.6)));
  const max = Math.min(14, Math.max(min + 1, Math.round(minutes * 1.1)));
  return [min, max];
}

/**
 * Last resort for an encounter whose writer failed twice: a Mimic Chest built from verified facts
 * and a listed misconception. Returns null when the concept doesn't have enough material.
 */
export function fallbackMimic(
  km: KnowledgeMap,
  e: BlueprintEncounter,
  genre: GenerateArgs["intake"]["genre"],
): { encounter: BlueprintEncounter; slice: ChallengeSlice } | null {
  const concept = km.concepts.find((c) => c.id === e.conceptIds[0]);
  const sockets = mimicChest.genres[genre]?.sockets ?? [];
  const socket = e.role === "boss" ? (sockets.includes(e.socket) ? e.socket : undefined) : sockets[0];
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
  const encounter: BlueprintEncounter = { ...e, mechanicId: mimicChest.id, socket };
  return checkChallenge(mimicChest, slice).length === 0 ? { encounter, slice } : null;
}

export async function generateGame(a: GenerateArgs): Promise<{ spec: GameSpec; warnings: Issue[]; repairs: number }> {
  const genre = a.intake.genre;
  const conceptIds = a.km.concepts.map((c) => c.id);
  const shared = sharedContext(a.km, a.intake, genre);
  const limit = pLimit(a.concurrency ?? 6);
  const [minE, maxE] = encounterRange(a.intake.minutes);
  const progress = a.onProgress;

  // 1. Director: the only sequential LLM step.
  const blueprint: BlueprintSlice = await callAgent({
    agent: "director",
    model: a.models.smart,
    schema: directorSchema({ genre, conceptIds, mechanics: mechanicsFor(genre), minEncounters: minE, maxEncounters: maxE }),
    system: DIRECTOR_SYSTEM,
    prompt: directorPrompt(shared, minE, maxE),
    check: (bp) => checkBlueprint(bp, { genre, conceptIds }),
    maxRepairs: 2,
    onProgress: progress,
  });

  const writeChallenge = (e: BlueprintEncounter, notes = "") =>
    limit(() => {
      const m = getMechanic(e.mechanicId)!;
      return callAgent({
        agent: `challenge:${e.id}`,
        model: a.models.smart,
        schema: challengeSchema(m),
        system: `${CHALLENGE_SYSTEM}\n\n# Mechanic: ${m.name}\n${m.authoringGuide}`,
        prompt: challengePrompt(shared, blueprint, e, notes),
        check: (s) => checkChallenge(m, s),
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
  const writeAssessment = (notes = "") =>
    limit(() =>
      callAgent({
        agent: "assessment",
        model: a.models.fast,
        schema: assessmentSchema(conceptIds),
        system: ASSESSMENT_SYSTEM,
        prompt: assessmentPrompt(shared) + notes,
        check: checkAssessment,
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

  // 3. Fallbacks: a failed encounter becomes a Mimic Chest from verified facts, or is dropped.
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
    meta: {
      id: a.gameId,
      createdAt: (a.now?.() ?? new Date()).toISOString(),
      source: { sourceId: a.km.sourceId, title: a.km.title, unsourced: a.km.unsourced },
      genre,
      targetMinutes: a.intake.minutes,
    },
    concepts: a.km.concepts.map(({ id, name, knowledgeType }) => ({ id, name, knowledgeType })),
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
  return { spec: result.spec, warnings: result.warnings, repairs };
}
