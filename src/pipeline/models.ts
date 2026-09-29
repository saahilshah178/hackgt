import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { getEnv } from "../server/env";
import { getMockModel } from "./mock/models";

/*
 * Model tiers, resolved from env. Model ids live ONLY here (+ env defaults in src/server/env.ts).
 * In mock mode, every tier resolves to a MockLanguageModelV4 backed by the recorded fixture registry
 * (src/pipeline/mock/); in live mode, to an OpenAI model via the AI SDK.
 */

export type Tier = "fast" | "smart" | "coder";

export interface Models {
  fast: LanguageModel;
  smart: LanguageModel;
  coder?: LanguageModel;
}

let openaiProvider: ReturnType<typeof createOpenAI> | undefined;

function openai() {
  if (!openaiProvider) openaiProvider = createOpenAI({ apiKey: getEnv().OPENAI_API_KEY });
  return openaiProvider;
}

function modelIdFor(tier: Tier): string {
  const env = getEnv();
  if (tier === "fast") return env.FAST_MODEL;
  if (tier === "smart") return env.SMART_MODEL;
  return env.CODER_MODEL;
}

/** The live/mock model for one tier. Model ids are read only from env (see modelIdFor). */
export function getModel(tier: Tier): LanguageModel {
  const env = getEnv();
  const id = modelIdFor(tier);
  if (env.LLM_MODE === "mock") return getMockModel(tier, id);
  return openai()(id);
}

/** All three tiers at once, for GenerateArgs.models. */
export function getModels(): Models {
  return { fast: getModel("fast"), smart: getModel("smart"), coder: getModel("coder") };
}

/**
 * The world3d critics' model (docs/design/60 §2.5): CRITIC_MODEL when set, so the reviewer can differ from the author,
 * else the SMART tier. Returns the id too, for the stored CriticReport.
 */
export function getCriticModel(): { model: LanguageModel; id: string } {
  const env = getEnv();
  const id = env.CRITIC_MODEL ?? env.SMART_MODEL;
  return { model: env.LLM_MODE === "mock" ? getMockModel("smart", id) : openai()(id), id };
}

/** A readable id for a model handle (a string id, or a provider/mock model object). */
export function modelIdOf(model: LanguageModel): string {
  return typeof model === "string" ? model : model.modelId;
}

/**
 * Per-tier `providerOptions` for `generateText`. FAST uses low reasoning effort (MEGAPROMPT §3);
 * mock mode passes no provider options (the mock model ignores them anyway, but this keeps the
 * live/mock code paths honest about what actually gets sent).
 */
export function tierOptions(tier: Tier): { openai: { reasoningEffort: "low" } } | undefined {
  if (getEnv().LLM_MODE === "mock") return undefined;
  if (tier === "fast") return { openai: { reasoningEffort: "low" } };
  return undefined;
}
