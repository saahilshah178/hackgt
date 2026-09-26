import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/trig-dungeon.json";
import { trigIntake, trigKnowledgeMap, trigMatches } from "../fixtures/trig.knowledge-map";
import { trigAssessment, trigBlueprint, trigChallenges, trigNarrative } from "../fixtures/trig.slices";
import { buildDirectorMenu, generateGame, type Progress } from "../src/pipeline/generate";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";

/*
 * Runs the real pipeline (AI SDK generateText + Output.object, zod validation, checks, repairs,
 * assembly, verification) against mock models that answer like the agents would.
 * The same trick gives the app its offline "mock mode": no API key, instant games.
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

/** A fake "team of agents". `quirks` lets a test make specific agents misbehave. */
function mockAgents(quirks: { badFirstE2?: boolean; badFirstNarrative?: boolean; alwaysBadE3?: boolean } = {}) {
  const calls: Record<string, number> = {};
  const doGenerate = async (options: Options) => {
    const { system, user } = textOf(options);
    if (system.startsWith("You are the Director")) return reply(trigBlueprint);
    if (system.startsWith("You are the Narrative Writer")) {
      calls.narrative = (calls.narrative ?? 0) + 1;
      return reply(quirks.badFirstNarrative && calls.narrative === 1 ? { intro: [] } : trigNarrative);
    }
    if (system.startsWith("You are the Assessment Writer")) return reply(trigAssessment);
    if (system.startsWith("You are the Challenge Writer")) {
      const id = /ENCOUNTER_ID: (\S+)/.exec(user)![1];
      calls[id] = (calls[id] ?? 0) + 1;
      const slice = trigChallenges[id];
      if (id === "e2_period" && quirks.badFirstE2 && calls[id] === 1) {
        return reply({ ...slice, params: { wave: "sin", amplitude: 1, b: "2.0000", c: "0", d: 0 } }); // "rounded decimal"
      }
      if (id === "e3_amplitude" && quirks.alwaysBadE3) {
        const params = slice.params as { statements: { isTrue: boolean }[] };
        return reply({ ...slice, params: { statements: params.statements.map((s) => ({ ...s, isTrue: false })) } });
      }
      return reply(slice);
    }
    throw new Error(`mock: unrecognized agent: ${system.slice(0, 40)}`);
  };
  const models = {
    fast: new MockLanguageModelV4({ modelId: "mock-fast", doGenerate }),
    smart: new MockLanguageModelV4({ modelId: "mock-smart", doGenerate }),
  };
  return { models, calls };
}

const base = {
  gameId: "trig_demo_001",
  km: trigKnowledgeMap,
  intake: trigIntake,
  matches: trigMatches,
  now: () => new Date("2026-09-26T02:00:00.000Z"),
};

describe("generateGame with mock models", () => {
  it("builds the Director's menu from the matcher picks, grouped by family with the boss socket added", () => {
    const menu = buildDirectorMenu(trigKnowledgeMap, trigMatches, "dungeon");
    const tuner = menu.find((f) => f.familyId === "tuner")!;
    expect(tuner.cards.map((c) => c.id)).toEqual(["oscillation_reach", "phase_gate", "pulse_matcher"]);
    expect(tuner.sockets).toEqual(["door", "boss"]);
    expect(menu.find((f) => f.familyId === "truth_finder")!.cards.map((c) => c.id)).toEqual(["mimic_chest"]);
  });

  it("repairs a bad slice and a schema failure, then reproduces the fixture byte for byte", async () => {
    const { models, calls } = mockAgents({ badFirstE2: true, badFirstNarrative: true });
    const events: Progress[] = [];
    const { spec, repairs, genre } = await generateGame({ ...base, models, onProgress: (e) => events.push(e) });

    expect(genre).toBe("dungeon");
    expect(spec).toEqual(fixture);
    expect(repairs).toBe(0); // both problems were fixed inside the per-agent loop, before assembly
    expect(calls.e2_period).toBe(2);
    expect(calls.narrative).toBe(2);
    expect(events).toContainEqual(expect.objectContaining({ agent: "challenge:e2_period", status: "repair", note: expect.stringMatching(/rounded decimal/) }));
    expect(events).toContainEqual(expect.objectContaining({ agent: "narrative", status: "repair", note: expect.stringMatching(/JSON schema/) }));
    expect(events.at(-1)).toMatchObject({ agent: "verifier", status: "done" });
  });

  it("falls back to a Mimic Chest built from verified facts when a writer keeps failing", async () => {
    const { models, calls } = mockAgents({ alwaysBadE3: true });
    const events: Progress[] = [];
    const { spec } = await generateGame({ ...base, models, onProgress: (e) => events.push(e) });

    expect(calls.e3_amplitude).toBe(2); // first try + one repair, then give up
    expect(events).toContainEqual(expect.objectContaining({ agent: "challenge:e3_amplitude", status: "fallback" }));
    const e3 = spec.encounters.find((e) => e.id === "e3_amplitude")!;
    const statements = (e3.params as { statements: { text: string; isTrue: boolean }[] }).statements;
    expect(statements.find((s) => !s.isTrue)?.text).toBe("Amplitude is the distance from peak to trough.");
    expect(e3.sourceRef).toEqual({ page: 2, quote: "The amplitude of y = A sin x is |A|." });
    expect(e3.teachingMechanicId).toBe("mimic_chest");
    expect(validateGameSpec(spec).ok).toBe(true);
  });
});
