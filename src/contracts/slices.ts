import { z } from "zod";
import {
  DOMAINS,
  EncounterRole,
  type FamilyId,
  type Genre,
  KNOWLEDGE_TYPES,
  KnowledgeType,
  MusicMood,
  PaletteId,
  SourceRef,
  VoiceArchetype,
  type Domain,
} from "./common";
import type { TeachingMechanic } from "./library";

/*
 * LLM-FACING SCHEMAS. Each agent call gets its own small schema, built at call time.
 *
 * Rules (OpenAI strict structured outputs, which the AI SDK's OpenAI provider enables by default):
 *   - root is an object; every field required; use .nullable(), never .optional() or .default()
 *   - no z.record() (dynamic keys): use arrays of objects
 *   - z.union (-> anyOf), never z.discriminatedUnion (-> oneOf); single-value z.enum, never z.literal (-> const)
 *   - no string min/max/regex: enforce lengths and formats in code (checks.ts), where failures become repair notes
 *   - bound every integer
 *   - .describe() text is sent to the model: treat it as inline instructions
 * tests/strict-schemas.test.ts walks the generated JSON Schema and enforces all of this.
 *
 * The big trick: ids the model must reference (concepts, cards, sockets, characters, encounters,
 * misconceptions) are ENUMS generated from the current job, so a dangling reference is unrepresentable.
 */

type NonEmpty = [string, ...string[]];

export function asTuple(values: readonly string[], what: string): NonEmpty {
  if (values.length === 0) throw new Error(`cannot build an enum of ${what}: list is empty`);
  return [...values] as NonEmpty;
}

// ---------------------------------------------------------------- S1 Gatekeeper (FAST)

export interface GatekeeperSlice {
  educational: boolean;
  estimatedConcepts: number;
  tooBig: boolean;
  tooSmall: boolean;
  outline: { title: string; pageStart: number; pageEnd: number }[];
  followUps: string[];
}

export function gatekeeperSchema(): z.ZodType<GatekeeperSlice> {
  return z.object({
    educational: z.boolean().describe("true when the material teaches something a student could be tested on"),
    estimatedConcepts: z.number().int().min(0).max(500).describe("How many distinct teachable concepts the material contains"),
    tooBig: z.boolean().describe("true when there is far more than one game's worth (roughly > 30 concepts); a hint only, the student picks concepts"),
    tooSmall: z.boolean().describe("true when there is less than one concept's worth of material"),
    outline: z
      .array(
        z.object({
          title: z.string(),
          pageStart: z.number().int().min(1).max(5000),
          pageEnd: z.number().int().min(1).max(5000),
        }),
      )
      .min(0)
      .max(100)
      .describe("Chapter/section outline with page ranges (chapters and major sections for a whole book); empty for short or unpaged material"),
    followUps: z.array(z.string()).min(0).max(3).describe("Questions to ask the student when the material is ambiguous; usually empty"),
  }) as unknown as z.ZodType<GatekeeperSlice>;
}

// ---------------------------------------------------------------- S2 Curriculum (SMART)

export interface CurriculumConceptSlice {
  id: string;
  unitId: string;
  name: string;
  summary: string;
  knowledgeType: KnowledgeType;
  learningObjective: string;
  importance: "core" | "supporting";
  difficulty: number;
  prerequisites: string[];
  keywords: string[];
  facts: { statement: string; sourceRef: { page: number; quote: string } | null }[];
  misconceptions: { belief: string; correction: string }[];
  formulas: { label: string; mathjs: string; variables: { name: string; unit: string; min: number; max: number }[] }[];
}

export interface CurriculumSlice {
  title: string;
  domain: Domain;
  topic: string;
  level: string;
  outline: { title: string; pageStart: number; pageEnd: number }[];
  units: { id: string; name: string }[];
  concepts: CurriculumConceptSlice[];
}

export function curriculumSchema(): z.ZodType<CurriculumSlice> {
  const concept = z.object({
    id: z.string().describe("Unique snake_case id starting with c_, e.g. c_period"),
    unitId: z.string().describe("The id of the unit this concept belongs to (must be one of the units above)"),
    name: z.string(),
    summary: z.string().describe("One or two sentences, under 200 characters"),
    knowledgeType: z.enum(KNOWLEDGE_TYPES),
    learningObjective: z.string().describe('"The student can …" in one sentence'),
    importance: z.enum(["core", "supporting"]),
    difficulty: z.number().int().min(1).max(3),
    prerequisites: z.array(z.string()).min(0).max(5).describe("ids of concepts in this map that must come first"),
    keywords: z.array(z.string()).min(1).max(10).describe("lowercase search words and synonyms for this concept"),
    facts: z
      .array(
        z.object({
          statement: z.string().describe("A verifiable claim, under 160 characters"),
          sourceRef: SourceRef.nullable().describe("Page and VERBATIM quote from the material; null only for unsourced topics"),
        }),
      )
      .min(1)
      .max(6),
    misconceptions: z
      .array(z.object({ belief: z.string().describe("The wrong idea, as a student would state it"), correction: z.string() }))
      .min(0)
      .max(4),
    formulas: z
      .array(
        z.object({
          label: z.string(),
          mathjs: z.string().describe('A mathjs expression, e.g. "2 * pi / abs(b)"'),
          variables: z
            .array(z.object({ name: z.string(), unit: z.string(), min: z.number(), max: z.number() }))
            .min(0)
            .max(6),
        }),
      )
      .min(0)
      .max(4),
  });
  return z.object({
    title: z.string().describe("Title of the material, under 80 characters"),
    domain: z.enum(DOMAINS),
    topic: z.string().describe('Short topic label, e.g. "Trigonometric functions"'),
    level: z.string().describe('e.g. "High school", "Intro college"'),
    outline: z
      .array(z.object({ title: z.string(), pageStart: z.number().int().min(1).max(5000), pageEnd: z.number().int().min(1).max(5000) }))
      .min(0)
      .max(40),
    units: z
      .array(z.object({ id: z.string().describe("snake_case starting with u_"), name: z.string() }))
      .min(1)
      .max(8)
      .describe("4-8 units for chapter-sized material; fewer only when the material is short"),
    concepts: z.array(concept).min(1).max(25).describe("8-25 concepts for chapter-sized material"),
  }) as unknown as z.ZodType<CurriculumSlice>;
}

// ---------------------------------------------------------------- S4 Matcher (FAST)

export interface MatcherSlice {
  picks: { teachingMechanicId: string; reason: string; targetsMisconception: string | null }[];
}

/** Picks the best cards for one concept from a code-retrieved shortlist; misconceptions are an enum of the concept's beliefs. */
export function matcherSchema(cardIds: readonly string[], beliefs: readonly string[], picks = 3): z.ZodType<MatcherSlice> {
  const n = Math.min(picks, cardIds.length);
  const misconception = beliefs.length > 0 ? z.enum(asTuple(beliefs, "misconceptions")).nullable() : z.null();
  return z.object({
    picks: z
      .array(
        z.object({
          teachingMechanicId: z.enum(asTuple(cardIds, "card ids")),
          reason: z.string().describe("One sentence: why this mechanic makes the player USE this concept"),
          targetsMisconception: misconception.describe("The listed misconception this card breaks, or null"),
        }),
      )
      .min(n)
      .max(n)
      .describe(`Exactly ${n} cards, best first, no repeats`),
  }) as unknown as z.ZodType<MatcherSlice>;
}

// ---------------------------------------------------------------- S3 Pre-check + S7 Assessment (FAST)

export interface AssessmentItemSlice {
  conceptId: string;
  prompt: string;
  correct: string;
  distractors: string[];
}
export interface PreCheckSlice {
  items: AssessmentItemSlice[];
}
export interface AssessmentSlice {
  post: AssessmentItemSlice[];
}

function assessmentItem(conceptIds: readonly string[]) {
  return z.object({
    conceptId: z.enum(asTuple(conceptIds, "concept ids")),
    prompt: z.string(),
    correct: z.string().describe("The single correct answer"),
    distractors: z.array(z.string()).min(3).max(3).describe("Three wrong answers drawn from real misconceptions"),
  });
}

/** Three items written at intake time, before the game exists. Code shuffles the choices. */
export function preCheckSchema(conceptIds: readonly string[]): z.ZodType<PreCheckSlice> {
  return z.object({
    items: z.array(assessmentItem(conceptIds)).min(3).max(3).describe("One item per weakest concept, quick to answer"),
  }) as unknown as z.ZodType<PreCheckSlice>;
}

/** The post-check, written during generation: same concepts as the pre-check, new questions. */
export function assessmentSchema(conceptIds: readonly string[]): z.ZodType<AssessmentSlice> {
  return z.object({
    post: z
      .array(assessmentItem(conceptIds))
      .min(3)
      .max(3)
      .describe("After the game: the same concepts as the pre-check, NEW questions (not rewordings)"),
  }) as unknown as z.ZodType<AssessmentSlice>;
}

// ---------------------------------------------------------------- S7 Tutor (FAST)

/** Per concept in the game: the idea explained plainly, and one worked example. Code adds the rest of the lesson. */
export interface TutorSlice {
  lessons: { conceptId: string; explanation: string; example: string }[];
}

export function tutorSchema(conceptIds: readonly string[]): z.ZodType<TutorSlice> {
  return z.object({
    lessons: z
      .array(
        z.object({
          conceptId: z.enum(asTuple(conceptIds, "concepts")).describe("The concept this lesson teaches"),
          explanation: z
            .string()
            .describe("2-4 short sentences, plain words, like a patient tutor: what it is, why it works, how to use it. Grounded in the listed facts."),
          example: z
            .string()
            .describe("One short worked example or concrete case (1-3 sentences) that shows the idea in action, with the reasoning spelled out."),
        }),
      )
      .describe("Exactly one lesson per concept listed in the task, in that order"),
  }) as unknown as z.ZodType<TutorSlice>;
}

// ---------------------------------------------------------------- S6 Director (SMART)

export interface BlueprintEncounter {
  id: string;
  conceptIds: string[];
  teachingMechanicId: string;
  socket: string;
  role: z.infer<typeof EncounterRole>;
  difficulty: number;
  targetMisconception: string | null;
  designNote: string;
}

export interface BlueprintSlice {
  genre: Genre;
  title: string;
  theme: { setting: string; tone: string; paletteId: z.infer<typeof PaletteId>; musicMood: z.infer<typeof MusicMood> };
  premise: string;
  characters: { id: string; name: string; role: string; voiceArchetype: z.infer<typeof VoiceArchetype> }[];
  encounters: BlueprintEncounter[];
}

/** What the Director may choose from: per family, the sockets it can mount on in this genre and the shortlisted cards. */
export interface DirectorMenuFamily {
  familyId: FamilyId;
  sockets: readonly string[];
  cards: readonly TeachingMechanic[];
}

export function directorSchema(args: {
  genre: Genre;
  conceptIds: readonly string[];
  families: readonly DirectorMenuFamily[];
  /** every misconception belief across the concepts, for targetMisconception */
  beliefs: readonly string[];
  bossSocket: string;
  minEncounters: number;
  maxEncounters: number;
}): z.ZodType<BlueprintSlice> {
  const conceptEnum = z.enum(asTuple(args.conceptIds, "concept ids"));
  const misconception = args.beliefs.length > 0 ? z.enum(asTuple(args.beliefs, "misconceptions")).nullable() : z.null();

  // One variant per family, each listing only that family's shortlisted cards and the sockets it supports
  // in this genre. An incompatible card/socket pair is therefore unrepresentable.
  const variants = args.families
    .filter((f) => f.cards.length > 0)
    .map((f) =>
      z.object({
        id: z.string().describe("Unique snake_case id, e.g. e3_amplitude"),
        conceptIds: z.array(conceptEnum).min(1).max(3).describe("1 concept normally; 2-3 only for the boss"),
        teachingMechanicId: z.enum(asTuple(f.cards.map((c) => c.id), `${f.familyId} cards`)),
        socket: z.enum(asTuple(f.sockets, `${f.familyId} sockets`)),
        role: EncounterRole,
        difficulty: z.number().int().min(1).max(3),
        targetMisconception: misconception.describe("The listed misconception this encounter attacks, or null"),
        designNote: z
          .string()
          .describe("One sentence for the challenge writer: what this encounter should make the player think about"),
      }),
    );
  if (variants.length === 0) throw new Error(`no implemented cards for genre ${args.genre}`);
  const encounter = variants.length === 1 ? variants[0] : z.union(variants as unknown as [z.ZodTypeAny, z.ZodTypeAny]);

  return z.object({
    genre: z.enum([args.genre]),
    title: z.string().describe("Game title, under 40 characters"),
    theme: z.object({
      setting: z.string().describe("Where the game takes place; tie it to the subject"),
      tone: z.string(),
      paletteId: PaletteId,
      musicMood: MusicMood,
    }),
    premise: z.string().describe("1-2 sentences: why the player is here and what they must do"),
    characters: z
      .array(
        z.object({
          id: z.string().describe("snake_case"),
          name: z.string(),
          role: z.string(),
          voiceArchetype: VoiceArchetype,
        }),
      )
      .min(1)
      .max(4),
    encounters: z
      .array(encounter)
      .min(args.minEncounters)
      .max(args.maxEncounters)
      .describe(
        `In play order. The last one is the boss (role "boss", socket "${args.bossSocket}"); no other encounter uses that socket.`,
      ),
  }) as unknown as z.ZodType<BlueprintSlice>;
}

// ---------------------------------------------------------------- S7 Challenge writer (SMART)

export interface ChallengeSlice {
  prompt: string;
  params: unknown;
  hints: string[];
  wrongFeedback: string;
  debriefLine: string;
  sourceRef: z.infer<typeof SourceRef> | null;
}

/**
 * Built per encounter: `params` is exactly that mode's schema, minus any keys the card locks
 * (code merges lockedParams afterwards, so the model can't fight them).
 */
export function challengeSchema(paramsSchema: z.ZodType, lockedKeys: readonly string[] = []): z.ZodType<ChallengeSlice> {
  let params: z.ZodType = paramsSchema;
  if (lockedKeys.length > 0 && paramsSchema instanceof z.ZodObject) {
    const shape = paramsSchema.shape as Record<string, z.ZodType>;
    params = z.object(Object.fromEntries(Object.entries(shape).filter(([k]) => !lockedKeys.includes(k))));
  }
  return z.object({
    prompt: z
      .string()
      .describe("What the player is told at this socket, under 160 characters. May use {{placeholders}}"),
    params,
    hints: z
      .array(z.string())
      .min(3)
      .max(3)
      .describe("Hint ladder, under 160 characters each: nudge, then method, then nearly the answer"),
    wrongFeedback: z
      .string()
      .describe("Shown after a wrong attempt. Name the likely misconception; do not give the answer"),
    debriefLine: z
      .string()
      .describe("Shown after the game. Names the concept outright and ties it to the mechanic. Use {{placeholders}} for values"),
    sourceRef: SourceRef.nullable().describe("Page and verbatim quote supporting this challenge; null for unsourced topics"),
  }) as unknown as z.ZodType<ChallengeSlice>;
}

// ---------------------------------------------------------------- S7 Narrative writer (FAST)

export interface NarrativeSlice {
  intro: { speakerId: string; text: string }[];
  outro: { speakerId: string; text: string }[];
  beats: { encounterId: string; when: "before" | "after"; speakerId: string; text: string }[];
}

export function narrativeSchema(characterIds: readonly string[], encounterIds: readonly string[]): z.ZodType<NarrativeSlice> {
  const speaker = z.enum(asTuple(characterIds, "character ids"));
  const line = z.object({ speakerId: speaker, text: z.string().describe("Spoken line, 20 words max") });
  return z.object({
    intro: z.array(line).min(1).max(3),
    outro: z.array(line).min(1).max(2),
    beats: z
      .array(
        z.object({
          encounterId: z.enum(asTuple(encounterIds, "encounter ids")),
          when: z.enum(["before", "after"]),
          speakerId: speaker,
          text: z.string().describe("Spoken line, 20 words max. Never state an answer"),
        }),
      )
      .min(0)
      .max(encounterIds.length * 2),
  }) as unknown as z.ZodType<NarrativeSlice>;
}
