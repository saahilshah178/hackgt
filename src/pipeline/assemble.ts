import { SCHEMA_VERSION, type Genre } from "../contracts/common";
import type { Encounter, GameSpec } from "../contracts/gamespec";
import type { AssessmentSlice, BlueprintSlice, ChallengeSlice, NarrativeSlice } from "../contracts/slices";
import { getMechanic } from "../mechanics/registry";
import { hashString, renderTemplate, seededShuffle } from "../mechanics/util";
import { layoutFromEncounters } from "./layout";

/** Everything the agents (and code) produced, before it becomes one document. */
export interface Slices {
  meta: {
    id: string;
    createdAt: string;
    source: GameSpec["source"];
    genre: Genre;
    targetMinutes: number;
  };
  concepts: GameSpec["concepts"];
  blueprint: BlueprintSlice; // Director
  challenges: Record<string, ChallengeSlice>; // challenge writer, keyed by encounter id
  narrative: NarrativeSlice; // narrative writer
  assessment: AssessmentSlice; // assessment writer
  audio?: GameSpec["audio"]; // ElevenLabs pipeline, filled later
}

/**
 * Pure and deterministic: same slices -> byte-identical spec. The output is NOT trusted:
 * callers must run validateGameSpec() on it. Slices should already have passed checks.ts.
 */
export function assembleGameSpec(s: Slices): GameSpec {
  const seed = hashString(s.meta.id);

  const encounters: Encounter[] = s.blueprint.encounters.map((b) => {
    const m = getMechanic(b.mechanicId);
    if (!m) throw new Error(`assemble: unknown mechanic "${b.mechanicId}" in ${b.id}`);
    const c = s.challenges[b.id];
    if (!c) throw new Error(`assemble: no challenge slice for encounter ${b.id}`);

    const params = m.paramsSchema.parse(c.params);
    const solution = m.resolve(params); // the answer key comes from code, never from the model
    const vars = m.templateVars(params, solution);
    const render = (t: string) => renderTemplate(t, vars);

    return {
      id: b.id,
      conceptIds: b.conceptIds,
      mechanicId: b.mechanicId,
      socket: b.socket,
      role: b.role,
      difficulty: b.difficulty,
      prompt: render(c.prompt),
      params,
      hints: c.hints.map(render),
      wrongFeedback: render(c.wrongFeedback),
      debriefLine: render(c.debriefLine),
      sourceRef: c.sourceRef,
      solution,
    };
  });

  const mcqs = (items: AssessmentSlice["pre"], salt: number) =>
    items.map((q, i) => {
      const choices = seededShuffle([q.correct, ...q.distractors], seed + salt + i);
      return { conceptId: q.conceptId, prompt: q.prompt, choices, correctIndex: choices.indexOf(q.correct) };
    });

  return {
    schemaVersion: SCHEMA_VERSION,
    id: s.meta.id,
    createdAt: s.meta.createdAt,
    seed,
    source: s.meta.source,
    genre: s.meta.genre,
    targetMinutes: s.meta.targetMinutes,
    concepts: s.concepts,
    title: s.blueprint.title,
    theme: s.blueprint.theme,
    premise: s.blueprint.premise,
    characters: s.blueprint.characters,
    encounters,
    layout: layoutFromEncounters(s.meta.genre, encounters),
    narrative: s.narrative,
    audio: s.audio ?? { musicTrackId: null, voice: [] },
    assessment: { pre: mcqs(s.assessment.pre, 101), post: mcqs(s.assessment.post, 202) },
  };
}
