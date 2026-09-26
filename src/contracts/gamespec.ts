import { z } from "zod";
import {
  EncounterRole,
  FamilyId,
  Genre,
  GenreOrAuto,
  Id,
  KnowledgeType,
  MusicMood,
  PaletteId,
  SCHEMA_VERSION,
  SourceRef,
  VoiceArchetype,
} from "./common";
import { IntakeGoal, IntakeMinutes, Mcq } from "./knowledge";
import { MasteryConfig } from "./telemetry";

export { Mcq };

/**
 * The GameSpec is the complete, self-contained description of one generated game.
 * The runtime is a pure function of it: same spec -> same game, every time.
 *
 * This is the STORED schema (jsonb, fixtures, what /play loads). It is never sent to a model:
 * agents write smaller LLM-facing slices (slices.ts) and code assembles them (pipeline/assemble.ts).
 * That's why this file can use regexes, string lengths, literals and z.unknown() freely.
 */

export const Character = z.object({
  id: Id,
  name: z.string().min(1),
  role: z.string().min(1),
  voiceArchetype: VoiceArchetype,
});
export type Character = z.infer<typeof Character>;

export const Line = z.object({ speakerId: Id, text: z.string().min(1).max(240) });
export const Beat = Line.extend({ encounterId: Id, when: z.enum(["before", "after"]) });

export const Encounter = z.object({
  // ---- written by the Director ----
  id: Id,
  conceptIds: z.array(Id).min(1).max(3),
  /** the catalog card this encounter plays */
  teachingMechanicId: Id,
  socket: z.string().min(1),
  role: EncounterRole,
  difficulty: z.number().int().min(1).max(3),
  /** a misconception belief from the concept, or null */
  targetMisconception: z.string().nullable(),
  // ---- derived by code from the card ----
  familyId: FamilyId,
  mode: z.string().min(1),
  // ---- written by the challenge writer (text already rendered from {{placeholders}}) ----
  prompt: z.string().min(1),
  /** Mode-specific. Validated against that mode's paramsSchema by validateGameSpec(); lockedParams merged in. */
  params: z.unknown(),
  hints: z.array(z.string().min(1)).length(3),
  wrongFeedback: z.string().min(1),
  debriefLine: z.string().min(1),
  sourceRef: SourceRef.nullable(),
  // ---- computed by code ----
  /** mode.resolve(params). Stored for the debrief, telemetry, and debugging; re-checked on load. */
  solution: z.unknown(),
});
export type Encounter = z.infer<typeof Encounter>;

/** Snapshot of the learner's intake, so the debrief can compute pre→post and per-unit views offline. */
export const IntakeSummary = z.object({
  goal: IntakeGoal,
  minutes: IntakeMinutes,
  requestedGenre: GenreOrAuto,
  confidence: z.array(z.object({ unitId: Id, level: z.number().int().min(1).max(5) })),
  preCheckAnswers: z.array(z.number().int().min(0).max(3)).max(3),
});
export type IntakeSummary = z.infer<typeof IntakeSummary>;

export const GameSpec = z.object({
  // ---- code ----
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  createdAt: z.iso.datetime(),
  /** Every shuffle and random choice in the runtime derives from this, so replays are identical. */
  seed: z.number().int().nonnegative(),
  source: z.object({ sourceId: z.string().min(1), title: z.string().min(1), unsourced: z.boolean() }),
  genre: Genre,
  targetMinutes: z.number().int().min(3).max(30),
  intake: IntakeSummary,
  units: z.array(z.object({ id: Id, name: z.string().min(1) })).min(1),
  concepts: z
    .array(z.object({ id: Id, unitId: Id, name: z.string().min(1), knowledgeType: KnowledgeType, learningObjective: z.string().min(1) }))
    .min(1),
  mastery: MasteryConfig,
  // ---- Director ----
  title: z.string().min(1).max(60),
  theme: z.object({ setting: z.string().min(1), tone: z.string().min(1), paletteId: PaletteId, musicMood: MusicMood }),
  premise: z.string().min(1),
  characters: z.array(Character).min(1).max(4),
  encounters: z.array(Encounter).min(1).max(20),
  // ---- code (deterministic from encounters; see pipeline/layout.ts) ----
  layout: z.object({ chunks: z.array(z.object({ chunkId: z.string().min(1), encounterId: Id.nullable() })).min(2) }),
  // ---- narrative agent ----
  narrative: z.object({ intro: z.array(Line).min(1), outro: z.array(Line).min(1), beats: z.array(Beat) }),
  // ---- code (ElevenLabs pipeline); empty until audio finishes ----
  audio: z.object({
    musicTrackId: z.string().nullable(),
    voice: z.array(z.object({ lineKey: z.string().min(1), url: z.string().min(1) })),
  }),
  // ---- pre: copied from the intake; post: assessment agent (choices shuffled by code) ----
  assessment: z.object({ pre: z.array(Mcq).length(3), post: z.array(Mcq).length(3) }),
});
export type GameSpec = z.infer<typeof GameSpec>;
