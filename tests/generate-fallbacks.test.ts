import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { trigIntake, trigKnowledgeMap, trigMatches } from "../fixtures/trig.knowledge-map";
import { trigAssessment, trigBlueprint, trigChallenges, trigNarrative } from "../fixtures/trig.slices";
import type { BlueprintEncounter } from "../src/contracts/slices";
import { deriveAssessmentFromPreCheck, generateGame, promoteTeachForDropped, type Progress } from "../src/pipeline/generate";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";

/*
 * M1 (a rejected writer must never fail the job) and M8 (promote the next encounter to "teach" when the
 * concept's teach encounter is dropped). See instructions.md's pipeline-dev brief.
 */

type Options = Parameters<MockLanguageModelV4["doGenerate"]>[0];

function textOf(options: Options) {
  const system = options.prompt.filter((m) => m.role === "system").map((m) => m.content as string).join("\n");
  const user = options.prompt
    .filter((m) => m.role === "user")
    .flatMap((m) => (m.content as { type: string; text?: string }[]).map((p) => p.text ?? ""))
    .join("\n");
  return { system, user };
}

function reply(value: unknown) {
  return {
    content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value) }],
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: {
      inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 50, text: 50, reasoning: 0 },
    },
    warnings: [],
  };
}

function badReply() {
  // Never valid JSON matching any schema: forces NoObjectGeneratedError on every attempt, exhausting
  // the per-agent repair budget every time (an AgentError-shaped failure, same as a model that keeps
  // returning schema-invalid output).
  return { content: [{ type: "text" as const, text: "not json at all" }], finishReason: { unified: "stop" as const, raw: "stop" }, usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }, warnings: [] };
}

function mockAgents(opts: { badNarrative?: boolean; badAssessment?: boolean; badEncounterId?: string } = {}) {
  const doGenerate = async (options: Options) => {
    const { system, user } = textOf(options);
    if (system.startsWith("You are the Director")) return reply(trigBlueprint);
    if (system.startsWith("You are the Narrative Writer")) {
      return opts.badNarrative ? badReply() : reply(trigNarrative);
    }
    if (system.startsWith("You are the Assessment Writer")) {
      return opts.badAssessment ? badReply() : reply(trigAssessment);
    }
    if (system.startsWith("You are the Challenge Writer")) {
      const id = /ENCOUNTER_ID: (\S+)/.exec(user)![1];
      if (id === opts.badEncounterId) return badReply();
      return reply(trigChallenges[id]);
    }
    throw new Error(`mock: unrecognized agent: ${system.slice(0, 40)}`);
  };
  return { fast: new MockLanguageModelV4({ modelId: "mock-fast", doGenerate }), smart: new MockLanguageModelV4({ modelId: "mock-smart", doGenerate }) };
}

const base = {
  gameId: "trig_demo_001",
  km: trigKnowledgeMap,
  intake: trigIntake,
  matches: trigMatches,
  now: () => new Date("2026-09-26T02:00:00.000Z"),
};

describe("generateGame: writer fallbacks never fail the job (M1)", () => {
  it("falls back to a minimal narrative when the narrative writer fails outright", async () => {
    const models = mockAgents({ badNarrative: true });
    const events: Progress[] = [];
    const { spec } = await generateGame({ ...base, models, onProgress: (e) => events.push(e) });

    expect(spec.narrative.beats).toEqual([]);
    expect(spec.narrative.intro).toEqual([{ speakerId: spec.characters[0].id, text: spec.premise }]);
    expect(spec.narrative.outro).toEqual([{ speakerId: spec.characters[0].id, text: "You finished every challenge. Nice work!" }]);
    expect(events).toContainEqual(expect.objectContaining({ agent: "narrative", status: "fallback" }));
    expect(validateGameSpec(spec).ok).toBe(true);
  });

  it("derives the post-check from the pre-check's concepts when the assessment writer fails twice", async () => {
    const models = mockAgents({ badAssessment: true });
    const events: Progress[] = [];
    const { spec } = await generateGame({ ...base, models, onProgress: (e) => events.push(e) });

    const expected = deriveAssessmentFromPreCheck(trigKnowledgeMap, trigIntake.preCheck.items);
    expect(spec.assessment.post.map((q) => q.conceptId)).toEqual(expected.post.map((q) => q.conceptId));
    expect(events).toContainEqual(expect.objectContaining({ agent: "assessment", status: "fallback" }));
    expect(validateGameSpec(spec).ok).toBe(true);
  });

  it("drops a non-boss encounter with no fallback available and promotes the next encounter of its concept to teach (M8)", async () => {
    // c_period needs >= 2 facts and >= 1 misconception for fallbackMimic() to succeed; trim it to one
    // fact so e2_period's writer failure has no fallback and must be dropped instead.
    const km = structuredClone(trigKnowledgeMap);
    const period = km.concepts.find((c) => c.id === "c_period")!;
    period.facts = [period.facts[0]];

    const models = mockAgents({ badEncounterId: "e2_period" });
    const events: Progress[] = [];
    const { spec } = await generateGame({ ...base, km, models, onProgress: (e) => events.push(e) });

    expect(spec.encounters.some((e) => e.id === "e2_period")).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ agent: "challenge:e2_period", status: "fallback", note: "dropped" }));
    // e5_period_review was the next encounter using c_period; it should be promoted to "teach".
    const promoted = spec.encounters.find((e) => e.id === "e5_period_review")!;
    expect(promoted.role).toBe("teach");
    expect(validateGameSpec(spec).ok).toBe(true);
  });
});

describe("promoteTeachForDropped (M8)", () => {
  const enc = (overrides: Partial<BlueprintEncounter>): BlueprintEncounter => ({
    id: "e",
    conceptIds: ["c1"],
    teachingMechanicId: "mimic_chest",
    socket: "chest",
    role: "practice",
    difficulty: 1,
    targetMisconception: null,
    designNote: "",
    ...overrides,
  });

  it("promotes the next non-boss encounter of the dropped concept to teach", () => {
    const encounters = [enc({ id: "e1", role: "practice" }), enc({ id: "e2", role: "review" }), enc({ id: "e3", role: "boss" })];
    promoteTeachForDropped(encounters, ["c1"]);
    expect(encounters[0].role).toBe("teach");
    expect(encounters[1].role).toBe("review");
  });

  it("does nothing when a teach encounter for the concept already exists", () => {
    const encounters = [enc({ id: "e1", role: "teach" }), enc({ id: "e2", role: "practice" })];
    promoteTeachForDropped(encounters, ["c1"]);
    expect(encounters[0].role).toBe("teach");
    expect(encounters[1].role).toBe("practice");
  });

  it("never promotes the boss encounter itself", () => {
    const encounters = [enc({ id: "e1", role: "boss" })];
    promoteTeachForDropped(encounters, ["c1"]);
    expect(encounters[0].role).toBe("boss");
  });
});
