import type { z } from "zod";
import type { Genre, KnowledgeType, Widget } from "../contracts/common";

export interface GenreSkin {
  /** Sockets in that genre this mechanic can mount on. */
  sockets: readonly string[];
  /** One line for the Director and the art/level hosts: how it looks in this genre. */
  skin: string;
}

export interface Grade {
  correct: boolean;
  /** Informative feedback. On a miss it should teach something without handing over the answer. */
  feedback: string;
}

/**
 * One file per mechanic implements this. The model only ever writes `params`;
 * everything derived (answer key, shuffles, numbers shown to the player) comes from these functions.
 */
export interface MechanicDefinition<Schema extends z.ZodType = z.ZodType, Solution = unknown, Input = unknown, View = unknown> {
  id: string;
  name: string;
  widget: Widget;
  knowledgeTypes: readonly KnowledgeType[];
  implemented: boolean;
  /** One line the Director reads when choosing mechanics. */
  directorBlurb: string;
  /** Instructions appended to the challenge writer's system prompt for this mechanic. */
  authoringGuide: string;
  genres: Partial<Record<Genre, GenreSkin>>;
  /** LLM-facing params schema. Must stay strict-structured-output friendly (see tests/strict-schemas.test.ts). */
  paramsSchema: Schema;
  /** Semantic rules JSON Schema can't express. Return problems as sentences; [] means valid. */
  check(params: z.infer<Schema>): string[];
  /** The answer key, computed in code. Never written by the model. */
  resolve(params: z.infer<Schema>): Solution;
  /** Values that LLM-written text may reference as {{name}} placeholders. */
  templateVars(params: z.infer<Schema>, solution: Solution): Record<string, string>;
  /** Placeholders that reveal the answer: forbidden in the prompt, the first hint, and wrongFeedback. */
  answerVars: readonly string[];
  /** What the widget renders. Shuffles derive from the seed so a replay looks identical. */
  present(params: z.infer<Schema>, seed: number): View;
  grade(params: z.infer<Schema>, input: Input): Grade;
  /** An input that solves the encounter. Used by autoSolve, tests, and the verifier's self-solve check. */
  solutionInput(params: z.infer<Schema>, solution: Solution): Input;
}

export function defineMechanic<Schema extends z.ZodType, Solution, Input, View>(
  def: MechanicDefinition<Schema, Solution, Input, View>,
): MechanicDefinition<Schema, Solution, Input, View> {
  return def;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMechanic = MechanicDefinition<z.ZodType, any, any, any>;
