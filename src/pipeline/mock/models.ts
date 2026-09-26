import { MockLanguageModelV4 } from "ai/test";
import type { Tier } from "../models";
import type { BlueprintEncounter, BlueprintSlice, NarrativeSlice } from "../../contracts/slices";
import { adaptBlueprint, adaptNarrative, lastAdaptedBlueprint, mimicChallengeFor, parseDirectorConstraints, sharedContextKey } from "./adapt";
import { getMockSample, resolveMockSample } from "./registry";
import "./trig"; // registers the trig sample as a side effect (P5a)
import "./cell"; // registers the cell-transport sample as a side effect (P5b)
import "./history"; // registers the civil-rights sample as a side effect (P5b)

/*
 * The mock model every tier resolves to when LLM_MODE=mock. It dispatches on the system prompt's
 * opening words to find the agent, then serves the matching recorded fixture from the registry
 * (src/pipeline/mock/registry.ts). The real pipeline code runs unchanged around it: schemas, checks,
 * repairs, assembly and validation all execute for real; only the network call is replaced.
 */

type DoGenerateOptions = Parameters<MockLanguageModelV4["doGenerate"]>[0];
type DoGenerateResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;

function textOf(options: DoGenerateOptions): { system: string; user: string } {
  const system = options.prompt
    .filter((m) => m.role === "system")
    .map((m) => m.content as string)
    .join("\n");
  const user = options.prompt
    .filter((m) => m.role === "user")
    .flatMap((m) => (m.content as { type: string; text?: string }[]).map((p) => p.text ?? ""))
    .join("\n");
  return { system, user };
}

function reply(value: unknown): DoGenerateResult {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
    finishReason: { unified: "stop", raw: "stop" },
    usage: {
      inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 50, text: 50, reasoning: 0 },
    },
    warnings: [],
  } as DoGenerateResult;
}

/** System-prompt prefix -> registry key. Order matters only in that prefixes must not collide. */
const AGENT_PREFIXES: [string, string][] = [
  ["You are the Director", "director"],
  ["You are the Gatekeeper", "gatekeeper"],
  ["You are the Curriculum", "curriculum"],
  ["You are the Matcher", "matcher"],
  ["You are the Pre-check Writer", "precheck"],
  ["You are the Challenge Writer", "challenges"],
  ["You are the Narrative Writer", "narrative"],
  ["You are the Assessment Writer", "assessment"],
  ["You are the Blind Solver", "blindSolver"],
];

async function doGenerate(options: DoGenerateOptions): Promise<DoGenerateResult> {
  const { system, user } = textOf(options);
  const match = AGENT_PREFIXES.find(([prefix]) => system.startsWith(prefix));
  if (!match) throw new Error(`mock model: unrecognized agent (system prompt starts with "${system.slice(0, 40)}")`);
  const [, key] = match;
  // Match on the user turn only (the source's actual title/text): the system prompt is fixed
  // boilerplate per agent and matching against it too risks a spurious keyword hit.
  const sampleId = resolveMockSample({ text: user });
  const sample = getMockSample(sampleId);
  if (!sample) throw new Error(`mock model: no registered sample "${sampleId}"`);

  // M5: the memo in adapt.ts is keyed by a hash of the shared-context block, which is byte-identical
  // for every agent's prompt within one job (see sharedContext() in prompts.ts), so two concurrent
  // jobs on the same sample id no longer clobber each other's adapted blueprint.
  const contextKey = sharedContextKey(user);
  if (key === "director" && sample.km && sample.director) {
    // Adapt the canned blueprint to this job's schema (encounter range, card enum, misconception enum).
    const constraints = parseDirectorConstraints(user, sample.km);
    return reply(adaptBlueprint(contextKey, sample.director as BlueprintSlice, sample.km, constraints));
  }
  if (key === "narrative" && sample.narrative) {
    return reply(adaptNarrative(sample.narrative as NarrativeSlice, lastAdaptedBlueprint(contextKey)));
  }
  if (key === "challenges") {
    const id = /ENCOUNTER_ID:\s*(\S+)/.exec(user)?.[1];
    const slice = id ? sample.challenges?.[id] : undefined;
    if (slice) return reply(slice);
    // A padded mock-mode encounter (mx_*): build its Mimic Chest from the sample's knowledge map.
    const bp = lastAdaptedBlueprint(contextKey);
    const e = bp?.encounters.find((x) => x.id === id) as BlueprintEncounter | undefined;
    if (sample.km && bp && e) return reply(mimicChallengeFor(sample.km, e, bp.genre));
    throw new Error(`mock model: no challenge fixture for encounter "${id ?? "?"}" in sample "${sampleId}"`);
  }
  const value = (sample as Record<string, unknown>)[key];
  if (value === undefined) throw new Error(`mock model: sample "${sampleId}" has no "${key}" fixture`);
  return reply(value);
}

/** One mock model per tier (id kept only for readability in traces/tests). */
export function getMockModel(tier: Tier, modelId: string): MockLanguageModelV4 {
  return new MockLanguageModelV4({ modelId: modelId || `mock-${tier}`, doGenerate });
}
