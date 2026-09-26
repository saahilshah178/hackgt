import { SCHEMA_VERSION } from "../contracts/common";
import type { Encounter, GameSpec } from "../contracts/gamespec";
import type { Intake, KnowledgeMap } from "../contracts/knowledge";
import type { AssessmentSlice, BlueprintSlice, ChallengeSlice, NarrativeSlice } from "../contracts/slices";
import { DEFAULT_MASTERY } from "../contracts/telemetry";
import { getCard } from "../library";
import { getMode } from "../mechanics/registry";
import { hashString, renderTemplate, seededShuffle } from "../mechanics/util";
import { layoutFromEncounters } from "./layout";
import { mergeLockedParams } from "./validate/checks";

/** Everything the agents (and code) produced, before it becomes one document. */
export interface Slices {
  id: string;
  createdAt: string;
  km: KnowledgeMap;
  intake: Intake;
  blueprint: BlueprintSlice; // Director
  challenges: Record<string, ChallengeSlice>; // challenge writers, keyed by encounter id
  narrative: NarrativeSlice; // narrative writer
  assessment: AssessmentSlice; // assessment writer (post-check)
  audio?: GameSpec["audio"]; // ElevenLabs pipeline, filled later
}

/**
 * Pure and deterministic: same slices -> byte-identical spec. The output is NOT trusted:
 * callers must run validateGameSpec() on it. Slices should already have passed checks.ts.
 */
export function assembleGameSpec(s: Slices): GameSpec {
  const seed = hashString(s.id);

  const encounters: Encounter[] = s.blueprint.encounters.map((b) => {
    const card = getCard(b.teachingMechanicId);
    if (!card) throw new Error(`assemble: unknown card "${b.teachingMechanicId}" in ${b.id}`);
    const m = getMode(card.family, card.mode);
    if (!m) throw new Error(`assemble: card "${card.id}" names unknown mode ${card.family}.${card.mode}`);
    const c = s.challenges[b.id];
    if (!c) throw new Error(`assemble: no challenge slice for encounter ${b.id}`);

    const params = m.paramsSchema.parse(mergeLockedParams(c.params, card.lockedParams)); // code enforces the card's locks
    const solution = m.resolve(params); // the answer key comes from code, never from the model
    const vars = m.templateVars(params, solution);
    const render = (t: string) => renderTemplate(t, vars);

    return {
      id: b.id,
      conceptIds: b.conceptIds,
      teachingMechanicId: card.id,
      socket: b.socket,
      role: b.role,
      difficulty: b.difficulty,
      targetMisconception: b.targetMisconception,
      familyId: card.family,
      mode: card.mode,
      prompt: render(c.prompt),
      params,
      hints: c.hints.map(render),
      wrongFeedback: render(c.wrongFeedback),
      debriefLine: render(c.debriefLine),
      sourceRef: c.sourceRef,
      solution,
    };
  });

  const mcqs = (items: AssessmentSlice["post"], salt: number) =>
    items.map((q, i) => {
      const choices = seededShuffle([q.correct, ...q.distractors], seed + salt + i);
      return { conceptId: q.conceptId, prompt: q.prompt, choices, correctIndex: choices.indexOf(q.correct) };
    });

  return {
    schemaVersion: SCHEMA_VERSION,
    id: s.id,
    createdAt: s.createdAt,
    seed,
    source: { sourceId: s.km.sourceId, title: s.km.title, unsourced: s.km.unsourced },
    genre: s.blueprint.genre,
    targetMinutes: s.intake.minutes,
    intake: {
      goal: s.intake.goal,
      minutes: s.intake.minutes,
      requestedGenre: s.intake.genre,
      confidence: s.km.units.map((u) => ({ unitId: u.id, level: s.intake.confidence[u.id] ?? 3 })),
      preCheckAnswers: s.intake.preCheck.answers,
    },
    units: s.km.units.map(({ id, name }) => ({ id, name })),
    concepts: s.km.concepts.map(({ id, unitId, name, knowledgeType, learningObjective }) => ({ id, unitId, name, knowledgeType, learningObjective })),
    mastery: DEFAULT_MASTERY,
    title: s.blueprint.title,
    theme: s.blueprint.theme,
    premise: s.blueprint.premise,
    characters: s.blueprint.characters,
    encounters,
    layout: layoutFromEncounters(s.blueprint.genre, encounters),
    narrative: s.narrative,
    audio: s.audio ?? { musicTrackId: null, voice: [] },
    assessment: { pre: s.intake.preCheck.items, post: mcqs(s.assessment.post, 202) },
  };
}
