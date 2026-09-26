import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import fixture from "../fixtures/trig-dungeon.json";
import { trigIntake, trigKnowledgeMap } from "../fixtures/trig.knowledge-map";
import type { GameSpec } from "../src/contracts/gamespec";
import { getMode } from "../src/mechanics/registry";
import { resetEnvCache } from "../src/server/env";

// blind-solver.ts calls runAgent() directly for the blind solve and the regenerate-through-the-
// writer step; mocking it (rather than LLM_MODE=mock) lets this test control exactly what the
// "solver without the key" answers, to exercise regenerate-once-then-fallback deterministically.
vi.mock("../src/pipeline/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/pipeline/llm")>();
  return { ...actual, runAgent: vi.fn() };
});

// The trig fixture has 3 blindSolvable encounters (e3_amplitude, e4_solve, e5_period_review); this
// test is only about e3_amplitude's disagree -> regenerate -> disagree -> fallback path, so every
// other mode is forced non-blindSolvable here (e5_period_review shares truth_finder.mimic with
// e3_amplitude and is handled explicitly in the mock below instead).
vi.mock("../src/mechanics/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/mechanics/registry")>();
  return {
    ...actual,
    getMode: (familyId: string, mode: string) => {
      const m = actual.getMode(familyId, mode);
      if (!m || (familyId === "truth_finder" && mode === "mimic")) return m;
      return { ...m, blindSolvable: false };
    },
  };
});

const spec = fixture as unknown as GameSpec;

async function importBlindSolver() {
  return import("../src/pipeline/agents/blind-solver");
}

describe("blind-solver", () => {
  // Runs runAgent's real code path (isMockLLM() === false) instead of the mock-mode "return the key"
  // shortcut, without needing a live OPENAI_API_KEY (runAgent itself is mocked above).
  beforeEach(() => {
    process.env.LLM_MODE = "live";
    process.env.OPENAI_API_KEY = "sk-test-not-used";
    resetEnvCache();
  });
  afterEach(() => {
    delete process.env.LLM_MODE;
    delete process.env.OPENAI_API_KEY;
    resetEnvCache();
    vi.clearAllMocks();
  });

  it("regenerates once on disagreement, then replaces with the Mimic Chest fallback when it still disagrees", async () => {
    const { runAgent } = await import("../src/pipeline/llm");
    const mockRunAgent = runAgent as unknown as Mock;

    const e3 = spec.encounters.find((e) => e.id === "e3_amplitude")!;
    const index = spec.encounters.indexOf(e3);
    const mode = getMode(e3.familyId, e3.mode)!;
    const seed = spec.seed + index;
    const view = mode.present(e3.params, seed) as { chests: { statementIndex: number; text: string }[] };
    // Any chest whose statementIndex isn't the real mimic (1, per fixtures/trig-dungeon.json) disagrees.
    const wrongChest = view.chests.findIndex((c) => c.statementIndex !== 1);
    expect(wrongChest).toBeGreaterThanOrEqual(0);

    const e5 = spec.encounters.find((e) => e.id === "e5_period_review")!;
    const index5 = spec.encounters.indexOf(e5);
    const view5 = mode.present(e5.params, spec.seed + index5) as { chests: { statementIndex: number; text: string }[] };
    const mimicIndex5 = (e5.solution as { mimicIndex: number }).mimicIndex;
    const correctChest5 = view5.chests.findIndex((c) => c.statementIndex === mimicIndex5);

    let challengeCalls = 0;
    mockRunAgent.mockImplementation(async (o: { agent: string }) => {
      if (o.agent === `blind:${e3.id}`) return { chest: wrongChest, why: "a confident but wrong guess" };
      if (o.agent === `blind:${e5.id}`) return { chest: correctChest5, why: "the mimic sticks out" };
      if (o.agent === `challenge:${e3.id}`) {
        challengeCalls++;
        return {
          prompt: "Three chests, one lies about amplitude. Find it.",
          params: {
            statements: [
              { text: "The amplitude of y = 5sin(x) is 5", isTrue: true, explanation: "Amplitude is |A|." },
              { text: "The amplitude of y = 5sin(x) is 10, peak to trough", isTrue: false, explanation: "That's twice the amplitude." },
              { text: "Amplitude never affects the period", isTrue: true, explanation: "Only b changes the period." },
            ],
          },
          hints: ["Look at the midline, not the whole swing.", "Peak-to-trough is double the amplitude.", "The mimic: {{mimic}}"],
          wrongFeedback: "That one holds up.",
          debriefLine: "The mimic said {{mimic}}.",
          sourceRef: null,
        };
      }
      throw new Error(`unexpected agent "${o.agent}" in this test`);
    });

    const { blindSolveAndFix } = await importBlindSolver();
    const events: { agent: string; status: string; note?: string }[] = [];
    const fixed = await blindSolveAndFix({
      spec,
      km: trigKnowledgeMap,
      intake: trigIntake,
      models: { fast: {} as never, smart: {} as never },
      jobId: "job_test",
      onProgress: (e) => events.push(e),
    });

    // regenerated once (the writer call happened), disagreed again, and the encounter was replaced
    expect(challengeCalls).toBe(1);
    expect(events).toContainEqual(expect.objectContaining({ agent: "verifier", status: "repair", note: expect.stringMatching(/blind solver disagreed/) }));
    expect(events).toContainEqual(expect.objectContaining({ agent: "verifier", status: "fallback", note: expect.stringMatching(/replaced e3_amplitude/) }));

    const replaced = fixed.encounters.find((e) => e.id === "e3_amplitude")!;
    expect(replaced.teachingMechanicId).toBe("mimic_chest");
    // every other encounter is untouched
    expect(fixed.encounters.filter((e) => e.id !== "e3_amplitude")).toEqual(spec.encounters.filter((e) => e.id !== "e3_amplitude"));
  });

  // M2: a throw from runAgent (network/schema) must be treated as agreeing, never fail the job; and a
  // non-boss encounter that still disagrees with no fallback available must be dropped outright.
  it("treats a throwing blind solver as agreeing, and drops a non-boss encounter with no fallback available", async () => {
    const { runAgent } = await import("../src/pipeline/llm");
    const mockRunAgent = runAgent as unknown as Mock;

    const e3 = spec.encounters.find((e) => e.id === "e3_amplitude")!;
    const index = spec.encounters.indexOf(e3);
    const mode = getMode(e3.familyId, e3.mode)!;
    const seed = spec.seed + index;
    const view = mode.present(e3.params, seed) as { chests: { statementIndex: number; text: string }[] };
    const wrongChest = view.chests.findIndex((c) => c.statementIndex !== 1);
    expect(wrongChest).toBeGreaterThanOrEqual(0);

    const e5 = spec.encounters.find((e) => e.id === "e5_period_review")!;

    // c_amplitude needs >= 2 facts and >= 1 misconception for fallbackMimic() to succeed; trim it so
    // e3_amplitude's disagreement, after a failed regenerate, has no fallback and must be dropped.
    const km = structuredClone(trigKnowledgeMap);
    km.concepts.find((c) => c.id === "c_amplitude")!.facts.length = 1;

    mockRunAgent.mockImplementation(async (o: { agent: string }) => {
      if (o.agent === `blind:${e3.id}`) return { chest: wrongChest, why: "a confident but wrong guess" };
      if (o.agent === `blind:${e5.id}`) throw new Error("network error: connection reset");
      if (o.agent === `challenge:${e3.id}`) throw new Error("regenerate also failed");
      throw new Error(`unexpected agent "${o.agent}" in this test`);
    });

    const { blindSolveAndFix } = await importBlindSolver();
    const events: { agent: string; status: string; note?: string }[] = [];
    const fixed = await blindSolveAndFix({
      spec,
      km,
      intake: trigIntake,
      models: { fast: {} as never, smart: {} as never },
      jobId: "job_test",
      onProgress: (e) => events.push(e),
    });

    // e5's blind solver threw: treated as agreeing, left untouched.
    expect(fixed.encounters.find((e) => e.id === "e5_period_review")).toEqual(e5);
    expect(events).toContainEqual(expect.objectContaining({ agent: `blind:${e5.id}`, status: "failed", note: expect.stringMatching(/treating it as agreeing/) }));

    // e3 disagreed, regenerate failed, and no fallback exists for the trimmed concept: dropped.
    expect(fixed.encounters.some((e) => e.id === "e3_amplitude")).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ agent: "verifier", status: "fallback", note: "Verifier: dropped e3_amplitude" }));
    expect(fixed.layout.chunks.every((c) => c.encounterId !== "e3_amplitude")).toBe(true);
  });
});
