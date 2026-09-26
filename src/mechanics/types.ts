import type { z } from "zod";
import type { FamilyId, Genre, KnowledgeType, Widget } from "../contracts/common";

export interface GenreSkin {
  /** Sockets in that genre this family can mount on (the genre's boss socket is always added by the registry). */
  sockets: readonly string[];
  /** One line for the Director and the art/level hosts: how it looks in this genre (LIBRARY §5). */
  skin: string;
}

export interface Grade {
  correct: boolean;
  /** Informative feedback. On a miss it should teach something without handing over the answer. */
  feedback: string;
}

/**
 * For blindSolvable modes: how a FAST model answers the encounter WITHOUT the key. The model only ever
 * sees what the player sees (`describe`), answers in display terms (`schema`), and code maps that back
 * onto the grader's input (`toInput`). Disagreement with resolve() is a verifier catch.
 */
export interface BlindSolver<Params, View, Input> {
  schema: z.ZodType;
  describe(params: Params, view: View): string;
  toInput(params: Params, view: View, output: unknown): Input;
}

/**
 * One file per mode implements this (the seed's plugin contract plus implemented / blindSolvable / widget).
 * The model only ever writes `params`; everything derived (answer key, shuffles, numbers shown to the
 * player) comes from these functions.
 */
export interface FamilyMode<Schema extends z.ZodType = z.ZodType, Solution = unknown, Input = unknown, View = unknown> {
  /** mode name inside the family, e.g. "oscillator" */
  id: string;
  name: string;
  implemented: boolean;
  blindSolvable: boolean;
  widget: Widget;
  knowledgeTypes: readonly KnowledgeType[];
  /** One line the Director reads when choosing mechanics. */
  directorBlurb: string;
  /** Instructions appended to the challenge writer's system prompt for this mode. */
  authoringGuide: string;
  /** LLM-facing params schema. Must stay strict-structured-output friendly (see tests/strict-schemas.test.ts). */
  paramsSchema: Schema;
  /** Semantic rules JSON Schema can't express. Return problems as sentences; [] means valid. */
  check(params: z.infer<Schema>): string[];
  /** The answer key, computed in code. Never written by the model. */
  resolve(params: z.infer<Schema>): Solution;
  /** Values that LLM-written text may reference as {{name}} placeholders. */
  templateVars(params: z.infer<Schema>, solution: Solution): Record<string, string>;
  /** Placeholders that reveal the answer: forbidden in the prompt, the first hint, and wrongFeedback. */
  answerVars: readonly string[] | ((params: z.infer<Schema>) => readonly string[]);
  /** What the widget renders. Shuffles derive from the seed so a replay looks identical. */
  present(params: z.infer<Schema>, seed: number): View;
  grade(params: z.infer<Schema>, input: Input): Grade;
  /** An input that solves the encounter. Used by autoSolve, tests, and the verifier's self-solve check. */
  solutionInput(params: z.infer<Schema>, solution: Solution): Input;
  /** Present when blindSolvable. */
  blind?: BlindSolver<z.infer<Schema>, View, Input>;
}

export function defineMode<Schema extends z.ZodType, Solution, Input, View>(
  def: FamilyMode<Schema, Solution, Input, View>,
): FamilyMode<Schema, Solution, Input, View> {
  return def;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFamilyMode = FamilyMode<z.ZodType, any, any, any>;

/** A family: engine code shared by its modes, plus its genre adapters (LIBRARY §4, §5). */
export interface MechanicFamily {
  id: FamilyId;
  name: string;
  widgets: readonly Widget[];
  knowledgeTypes: readonly KnowledgeType[];
  genres: Partial<Record<Genre, GenreSkin>>;
  modes: Record<string, AnyFamilyMode>;
}

export function defineFamily(def: MechanicFamily): MechanicFamily {
  return def;
}

export function answerVarsFor(mode: AnyFamilyMode, params: unknown): readonly string[] {
  return typeof mode.answerVars === "function" ? mode.answerVars(params) : mode.answerVars;
}
