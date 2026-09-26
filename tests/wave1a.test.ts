import { describe, expect, it } from "vitest";
import { cellChallenges, cellBlueprint } from "../fixtures/cell-transport.slices";
import { cellIntake, cellKnowledgeMap } from "../fixtures/cell-transport.knowledge-map";
import { historyKnowledgeMap } from "../fixtures/civil-rights.knowledge-map";
import { WAVE1A } from "../fixtures/wave1a.encounters";
import { trigAssessment } from "../fixtures/trig.slices";
import { trigIntake, trigKnowledgeMap } from "../fixtures/trig.knowledge-map";
import { EncounterRunner } from "../src/game/runner/encounter-runner";
import { getCard } from "../src/library";
import { getMode } from "../src/mechanics/registry";
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

/** Builds a two-encounter dungeon blueprint: the fixture as `teach`, plus a mimic_chest boss. */
function miniBlueprint(cardId: string, teachSocket: string) {
  return {
    genre: "dungeon" as const,
    title: "Wave 1a Test Dungeon",
    theme: { setting: "A test vault", tone: "brisk", paletteId: "ember" as const, musicMood: "curious" as const },
    premise: "A minimal dungeon exercising one wave-1a mode plus a boss.",
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
        designNote: "wave1a fixture encounter",
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

describe("wave1a fixture encounters", () => {
  for (const { cardId, slice } of WAVE1A) {
    it(`${cardId}'s challenge slice passes checkChallenge`, () => {
      const card = getCard(cardId);
      expect(card, cardId).toBeDefined();
      const mode = getMode(card!.family, card!.mode);
      expect(mode, cardId).toBeDefined();
      expect(checkChallenge(mode!, slice, card!.lockedParams)).toEqual([]);
    });

    it(`${cardId} assembles into a two-encounter dungeon, validates, and autoSolves`, () => {
      const card = getCard(cardId)!;
      const teachSocket = card.family === "investigator" ? "door" : "enemy";
      const blueprint = miniBlueprint(cardId, teachSocket);

      const slices: Slices = {
        id: `wave1a_${cardId}`,
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

describe("showcase fixtures: cell-transport slices for wave1a modes pass checkChallenge", () => {
  const wave1aEncounterIds = cellBlueprint.encounters
    .filter((e) => {
      const card = getCard(e.teachingMechanicId);
      if (!card) return false;
      const mode = getMode(card.family, card.mode);
      return mode?.implemented === true && ["sorter", "linker", "investigator"].includes(card.family);
    })
    .map((e) => e.id);

  it("found at least one encounter for a wave1a mode", () => {
    expect(wave1aEncounterIds.length).toBeGreaterThan(0);
  });

  for (const id of wave1aEncounterIds) {
    it(`${id} passes checkChallenge`, () => {
      const e = cellBlueprint.encounters.find((x) => x.id === id)!;
      const card = getCard(e.teachingMechanicId)!;
      const mode = getMode(card.family, card.mode)!;
      const slice = cellChallenges[id];
      expect(slice, id).toBeDefined();
      expect(checkChallenge(mode, slice, card.lockedParams)).toEqual([]);
    });
  }
});

describe("cell-transport / civil-rights knowledge maps are readable (sanity, no slices file to check yet for civil-rights)", () => {
  it("cell-transport knowledge map and intake load", () => {
    expect(cellKnowledgeMap.concepts.length).toBeGreaterThan(0);
    expect(cellIntake.minutes).toBeGreaterThan(0);
  });
  it("civil-rights knowledge map loads (no civil-rights.slices.ts exists yet to check challenge params against)", () => {
    expect(historyKnowledgeMap.concepts.length).toBeGreaterThan(0);
  });
});
