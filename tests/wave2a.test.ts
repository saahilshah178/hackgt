import { describe, expect, it } from "vitest";
import { WAVE2A } from "../fixtures/wave2a.encounters";
import { trigAssessment } from "../fixtures/trig.slices";
import { trigIntake, trigKnowledgeMap } from "../fixtures/trig.knowledge-map";
import { EncounterRunner } from "../src/game/runner/encounter-runner";
import { getCard } from "../src/library";
import { getMode, socketsFor } from "../src/mechanics/registry";
import { assembleGameSpec, type Slices } from "../src/pipeline/assemble";
import { checkChallenge } from "../src/pipeline/validate/checks";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";

const mimicBossParams = {
  statements: [
    { text: "Water boils at 100°C at sea level", isTrue: true, explanation: "Standard pressure." },
    { text: "Water always boils at exactly 100°C, at any altitude", isTrue: false, explanation: "Boiling point drops with lower pressure at altitude." },
    { text: "Boiling point drops as you climb a mountain", isTrue: true, explanation: "Lower atmospheric pressure." },
  ],
};

/** Builds a two-encounter dungeon blueprint: the fixture as `teach`, plus a mimic_chest boss, using a
 * socket the card is legally allowed to mount on for the dungeon genre (LIBRARY §5). */
function miniBlueprint(cardId: string, teachSocket: string) {
  return {
    genre: "dungeon" as const,
    title: "Wave 2a Test Dungeon",
    theme: { setting: "A test vault", tone: "brisk", paletteId: "ember" as const, musicMood: "curious" as const },
    premise: "A minimal dungeon exercising one wave-2a mode plus a boss.",
    characters: [{ id: "guide", name: "Guide", role: "narrator", voiceArchetype: "narrator" as const }],
    encounters: [
      {
        id: "e1_teach",
        conceptIds: ["c_radians"],
        teachingMechanicId: cardId,
        socket: teachSocket,
        role: "teach" as const,
        difficulty: 1,
        targetMisconception: null,
        designNote: "wave2a fixture encounter",
      },
      {
        id: "e2_boss",
        conceptIds: ["c_period"],
        teachingMechanicId: "mimic_chest",
        socket: "boss",
        role: "boss" as const,
        difficulty: 2,
        targetMisconception: null,
        designNote: "boss",
      },
    ],
  };
}

describe("wave2a fixture encounters", () => {
  for (const { cardId, slice } of WAVE2A) {
    it(`${cardId}'s challenge slice passes checkChallenge`, () => {
      const card = getCard(cardId);
      expect(card, cardId).toBeDefined();
      const mode = getMode(card!.family, card!.mode);
      expect(mode, cardId).toBeDefined();
      expect(checkChallenge(mode!, slice, card!.lockedParams)).toEqual([]);
    });

    it(`${cardId} assembles into a two-encounter dungeon, validates, and autoSolves`, () => {
      const card = getCard(cardId)!;
      const sockets = socketsFor(card.family, "dungeon", "boss").filter((s) => s !== "boss");
      expect(sockets.length, `${cardId}: no non-boss dungeon socket for family ${card.family}`).toBeGreaterThan(0);
      const teachSocket = sockets[0];
      const blueprint = miniBlueprint(cardId, teachSocket);

      const slices: Slices = {
        id: `wave2a_${cardId}`,
        createdAt: "2026-09-26T00:00:00.000Z",
        km: trigKnowledgeMap,
        intake: trigIntake,
        blueprint,
        challenges: {
          e1_teach: slice,
          e2_boss: {
            prompt: "Three chests, one lie. Point your lantern at it.",
            params: mimicBossParams,
            hints: ["Think about what pressure does to boiling point.", "Altitude lowers pressure.", "The mimic claims: {{mimic}}"],
            wrongFeedback: "That chest is honest.",
            debriefLine: "The mimic said \"{{mimic}}\".",
            sourceRef: null,
          },
        },
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
  }
});
