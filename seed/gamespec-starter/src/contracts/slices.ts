import { z } from "zod";
import { BOSS_SOCKET } from "../genres/catalog";
import type { AnyMechanic } from "../mechanics/types";
import { EncounterRole, type Genre, MusicMood, PaletteId, SourceRef, VoiceArchetype } from "./common";

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
 * The big trick: ids the model must reference (concepts, mechanics, sockets, characters, encounters)
 * are ENUMS generated from the current game, so constrained decoding makes a dangling reference impossible.
 */

type NonEmpty = [string, ...string[]];

function asTuple(values: readonly string[], what: string): NonEmpty {
  if (values.length === 0) throw new Error(`cannot build an enum of ${what}: list is empty`);
  return [...values] as NonEmpty;
}

// ---------------------------------------------------------------- Director

export interface BlueprintEncounter {
  id: string;
  conceptIds: string[];
  mechanicId: string;
  socket: string;
  role: z.infer<typeof EncounterRole>;
  difficulty: number;
  designNote: string;
}

export interface BlueprintSlice {
  title: string;
  theme: { setting: string; tone: string; paletteId: z.infer<typeof PaletteId>; musicMood: z.infer<typeof MusicMood> };
  premise: string;
  characters: { id: string; name: string; role: string; voiceArchetype: z.infer<typeof VoiceArchetype> }[];
  encounters: BlueprintEncounter[];
}

export function directorSchema(args: {
  genre: Genre;
  conceptIds: readonly string[];
  mechanics: readonly AnyMechanic[];
  minEncounters: number;
  maxEncounters: number;
}): z.ZodType<BlueprintSlice> {
  const conceptEnum = z.enum(asTuple(args.conceptIds, "concept ids"));

  // One variant per mechanic, each listing only the sockets that mechanic supports in this genre.
  // An incompatible mechanic/socket pair is therefore unrepresentable.
  const variants = args.mechanics.map((m) =>
    z.object({
      id: z.string().describe("Unique snake_case id, e.g. e3_amplitude"),
      conceptIds: z.array(conceptEnum).min(1).max(3).describe("1 concept normally; 2-3 only for the boss"),
      mechanicId: z.enum([m.id]),
      socket: z.enum(asTuple(m.genres[args.genre]!.sockets, `${m.id} sockets`)),
      role: EncounterRole,
      difficulty: z.number().int().min(1).max(3),
      designNote: z
        .string()
        .describe("One sentence for the challenge writer: what this encounter should make the player think about"),
    }),
  );
  if (variants.length === 0) throw new Error(`no implemented mechanics for genre ${args.genre}`);
  const encounter = variants.length === 1 ? variants[0] : z.union(variants as unknown as [z.ZodTypeAny, z.ZodTypeAny]);

  return z.object({
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
        `In play order. The last one is the boss (role "boss", socket "${BOSS_SOCKET[args.genre]}"); no other encounter uses that socket.`,
      ),
  }) as unknown as z.ZodType<BlueprintSlice>;
}

// ---------------------------------------------------------------- Challenge writer

export interface ChallengeSlice {
  prompt: string;
  params: unknown;
  hints: string[];
  wrongFeedback: string;
  debriefLine: string;
  sourceRef: z.infer<typeof SourceRef> | null;
}

/** Built per encounter: `params` is exactly that mechanic's schema, not a union of every mechanic. */
export function challengeSchema(m: AnyMechanic): z.ZodType<ChallengeSlice> {
  return z.object({
    prompt: z
      .string()
      .describe("What the player is told at this socket, under 160 characters. May use {{placeholders}}"),
    params: m.paramsSchema,
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

// ---------------------------------------------------------------- Narrative writer

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

// ---------------------------------------------------------------- Assessment writer

export interface AssessmentItemSlice {
  conceptId: string;
  prompt: string;
  correct: string;
  distractors: string[];
}
export interface AssessmentSlice {
  pre: AssessmentItemSlice[];
  post: AssessmentItemSlice[];
}

/** The model writes the right answer in its own field; code shuffles the choices (no position bias, no bad index). */
export function assessmentSchema(conceptIds: readonly string[]): z.ZodType<AssessmentSlice> {
  const item = z.object({
    conceptId: z.enum(asTuple(conceptIds, "concept ids")),
    prompt: z.string(),
    correct: z.string().describe("The single correct answer"),
    distractors: z.array(z.string()).min(3).max(3).describe("Three wrong answers drawn from real misconceptions"),
  });
  return z.object({
    pre: z.array(item).min(3).max(3).describe("Before the game: one item per weakest concept"),
    post: z.array(item).min(3).max(3).describe("After the game: same concepts, new questions (not rewordings)"),
  }) as unknown as z.ZodType<AssessmentSlice>;
}
