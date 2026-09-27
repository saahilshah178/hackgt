import { describe, expect, it } from "vitest";
import { TEACH_BACK_CHALLENGES } from "../fixtures/teach-back.challenges";
import { trigAssessment } from "../fixtures/trig.slices";
import { trigIntake, trigKnowledgeMap } from "../fixtures/trig.knowledge-map";
import { EncounterRunner } from "../src/game/runner/encounter-runner";
import { getCard } from "../src/library";
import { getMode, socketsFor } from "../src/mechanics/registry";
import { answerVarsFor } from "../src/mechanics/types";
import type { TeachBackParams } from "../src/mechanics/families/explainer/teach_back";
import { assembleGameSpec, type Slices } from "../src/pipeline/assemble";
import { checkChallenge, mergeLockedParams } from "../src/pipeline/validate/checks";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";

/*
 * fixtures/teach-back.challenges.ts: each ready-made teach_back encounter (trig c_period, cell c_osmosis, civil
 * rights c_montgomery) parses, passes check() and checkChallenge(), self-solves from its exemplar, fails on empty
 * input and on its misconception, passes on a paraphrase in different words, assembles into a playable dungeon,
 * and never leaks an answer var in miss feedback.
 */

const mode = getMode("explainer", "teach_back")!;

/** Student-style answers per concept: a synonym-heavy paraphrase (should pass) and a misconception (should fail). */
const STUDENT: Record<string, { paraphrase: string; misconception: string; partial: string }> = {
  c_period: {
    paraphrase: "The sine repeats once the inside has gone a full turn of two pi. With a large b the inside climbs more quickly, so the waves get squished together.",
    misconception: "A bigger b stretches the wave out, so each wave is 2π long but wider.",
    partial: "It repeats after a full turn of 2 pi, that is the whole story.",
  },
  c_osmosis: {
    paraphrase: "Pond water has fewer solutes outside than the cytoplasm, so water rushes in. The membrane is selectively permeable, which is why it keeps filling up.",
    misconception: "The cell is hypotonic and salt enters from the pond, so it swells.",
    partial: "The cell swells because of osmosis happening to it.",
  },
  c_montgomery: {
    paraphrase: "The community coordinated through their churches and ran carpools, the bus company kept losing money, and a federal court struck segregation down.",
    misconception: "Rosa Parks was just tired and acted alone, and then the Supreme Court ruled segregation unconstitutional after the bus company lost money.",
    partial: "People organised a huge carpool system for a year.",
  },
};

function miniBlueprint(cardId: string, teachSocket: string) {
  return {
    genre: "dungeon" as const,
    title: "Teach-back Test Dungeon",
    theme: { setting: "A test vault", tone: "brisk", paletteId: "ember" as const, musicMood: "curious" as const },
    premise: "A minimal dungeon exercising one teach_back encounter plus a boss.",
    characters: [{ id: "guide", name: "Guide", role: "narrator", voiceArchetype: "narrator" as const }],
    encounters: [
      { id: "e1_teach", conceptIds: ["c_radians"], teachingMechanicId: cardId, socket: teachSocket, role: "teach" as const, difficulty: 1, targetMisconception: null, designNote: "teach_back fixture" },
      { id: "e2_boss", conceptIds: ["c_period"], teachingMechanicId: "mimic_chest", socket: "boss", role: "boss" as const, difficulty: 2, targetMisconception: null, designNote: "boss" },
    ],
  };
}

const mimicBoss = {
  prompt: "Three chests, one lie. Point your lantern at it.",
  params: {
    statements: [
      { text: "Water boils at 100°C at sea level", isTrue: true, explanation: "Standard pressure." },
      { text: "Water always boils at exactly 100°C, at any altitude", isTrue: false, explanation: "Boiling point drops with lower pressure at altitude." },
      { text: "Boiling point drops as you climb a mountain", isTrue: true, explanation: "Lower atmospheric pressure." },
    ],
  },
  hints: ["Think about what pressure does to boiling point.", "Altitude lowers pressure.", "The mimic claims: {{mimic}}"],
  wrongFeedback: "That chest is honest.",
  debriefLine: 'The mimic said "{{mimic}}".',
  sourceRef: null,
};

describe("teach_back fixture encounters", () => {
  it("covers the three sample concepts", () => {
    expect(TEACH_BACK_CHALLENGES.map((c) => c.conceptId)).toEqual(["c_period", "c_osmosis", "c_montgomery"]);
  });

  for (const { cardId, conceptId, slice } of TEACH_BACK_CHALLENGES) {
    describe(`${conceptId} (${cardId})`, () => {
      const card = getCard(cardId);
      const params = mode.paramsSchema.parse(mergeLockedParams(slice.params, card?.lockedParams)) as TeachBackParams;
      const student = STUDENT[conceptId];

      it("sits on an explainer.teach_back card and passes check() and checkChallenge()", () => {
        expect(card, cardId).toBeDefined();
        expect(`${card!.family}.${card!.mode}`).toBe("explainer.teach_back");
        expect(mode.check(params)).toEqual([]);
        expect(checkChallenge(mode, slice, card!.lockedParams)).toEqual([]);
        expect(slice.hints).toHaveLength(3);
        expect(slice.sourceRef).toBeNull();
      });

      it("the exemplar self-solves; empty input is a gentle miss", () => {
        const s = mode.resolve(params);
        expect(mode.grade(params, mode.solutionInput(params, s)).correct).toBe(true);
        const empty = mode.grade(params, { text: "" });
        expect(empty.correct).toBe(false);
        expect(empty.feedback).toMatch(/Say something first/);
      });

      it("a paraphrase with synonyms passes", () => {
        const g = mode.grade(params, { text: student.paraphrase });
        expect(g.correct, g.feedback).toBe(true);
      });

      it("a misconception answer fails with the listener's correction", () => {
        const g = mode.grade(params, { text: student.misconception });
        expect(g.correct).toBe(false);
        expect(params.misconceptions.map((m) => m.correction)).toContain(g.feedback);
      });

      it("a partial answer gets the next idea's follow-up and a count, with no answer text", () => {
        const g = mode.grade(params, { text: student.partial });
        expect(g.correct).toBe(false);
        expect(g.feedback).toMatch(/\(1 of 2 ideas landed\)$/);
        expect(params.ideas.map((i) => i.followUp).some((f) => g.feedback.startsWith(f))).toBe(true);
        const vars = mode.templateVars(params, mode.resolve(params));
        for (const v of answerVarsFor(mode, params)) expect(g.feedback).not.toContain(vars[v]);
        for (const idea of params.ideas) expect(g.feedback).not.toContain(idea.exemplar);
      });

      it("prompt, hints[0] and wrongFeedback never use an answer placeholder or quote an exemplar", () => {
        for (const text of [slice.prompt, slice.hints[0], slice.wrongFeedback]) {
          expect(text).not.toMatch(/\{\{\s*(exemplar|ideaLabels)\s*\}\}/);
          for (const idea of params.ideas) expect(text).not.toContain(idea.exemplar);
        }
      });

      it("assembles into a two-encounter dungeon, validates, and autoSolves", () => {
        const sockets = socketsFor("explainer", "dungeon", "boss").filter((x) => x !== "boss");
        expect(sockets).toEqual(["altar"]);
        const slices: Slices = {
          id: `teach_back_${conceptId}`,
          createdAt: "2026-09-26T00:00:00.000Z",
          km: trigKnowledgeMap,
          intake: trigIntake,
          blueprint: miniBlueprint(cardId, sockets[0]),
          challenges: { e1_teach: slice, e2_boss: mimicBoss },
          narrative: { intro: [{ speakerId: "guide", text: "Welcome." }], outro: [{ speakerId: "guide", text: "Done." }], beats: [] },
          assessment: trigAssessment,
        };
        const spec = assembleGameSpec(slices);
        const result = validateGameSpec(spec);
        expect(result.ok ? [] : result.issues).toEqual([]);
        if (!result.ok) return;
        const runner = new EncounterRunner(result.spec);
        expect(runner.autoSolve().correct).toBe(true);
        expect(runner.autoSolve().correct).toBe(true);
        expect(runner.finished).toBe(true);
      });
    });
  }
});

describe("teach_back answer-leak sweep (mirrors tests/answer-leak.test.ts)", () => {
  for (const { conceptId, slice } of TEACH_BACK_CHALLENGES) {
    it(`${conceptId}: mutated solution inputs are graded wrong and never echo the exemplar or labels`, () => {
      const params = mode.paramsSchema.parse(slice.params);
      const s = mode.resolve(params);
      const vars = mode.templateVars(params, s);
      const leaks = answerVarsFor(mode, params).map((v) => vars[v]);
      const text = (mode.solutionInput(params, s) as { text: string }).text;
      for (const candidate of [{ text: `${[...text].reverse().join("")}__mutated` }, { text: "mutated_value" }, { text: "" }]) {
        const g = mode.grade(params, candidate);
        expect(g.correct).toBe(false);
        for (const v of leaks) expect(g.feedback).not.toContain(v);
      }
    });
  }
});
