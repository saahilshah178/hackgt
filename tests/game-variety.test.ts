import { describe, expect, it } from "vitest";
import fixture from "../fixtures/trig-dungeon.json";
import { trigKnowledgeMap, trigMatches } from "../fixtures/trig.knowledge-map";
import { GameSpec } from "../src/contracts/gamespec";
import { narrativeSchema } from "../src/contracts/slices";
import { availableEncounters, gardenTurn, INITIAL_GARDEN, playStyle } from "../src/game/activity-flow";
import { canVisit, MAP_LOCATIONS, MAP_START, moveOnMap } from "../src/game/activities/map";
import { EncounterRunner } from "../src/game/runner/encounter-runner";
import { getCard } from "../src/library";
import { diverseCards, interactionFor, varietyProblems } from "../src/library/variety";
import { buildDirectorMenu } from "../src/pipeline/generate";
import { constructiveChallenge } from "../src/pipeline/mock/variety";
import { getMode } from "../src/mechanics/registry";
import { checkChallenge } from "../src/pipeline/validate/checks";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";
import { variedFixture } from "./helpers/varied-trig";

const spec = GameSpec.parse(fixture);

describe("flat 2D game styles", () => {
  it("routes every genre to a different play loop, with narrative for argument-heavy topics", () => {
    expect(playStyle(spec)).toBe("top-down");
    expect(playStyle({ ...spec, genre: "puzzle" })).toBe("puzzle");
    expect(playStyle({ ...spec, genre: "strategy" })).toBe("management");
    expect(playStyle({ ...spec, genre: "platformer" })).toBe("side-view");
    expect(playStyle({ ...spec, genre: "mystery" })).toBe("investigation");
    expect(playStyle({ genre: "mystery", concepts: spec.concepts.map(c => ({ ...c, knowledgeType: "argument" })) })).toBe("narrative");
  });

  it("accepts a character-free board with environmental narration", () => {
    const characterless = { ...spec, characters: [], narrative: { intro: [{ speakerId: "narrator", text: "Restore the board." }], outro: [{ speakerId: "narrator", text: "The board is restored." }], beats: [] } };
    expect(validateGameSpec(characterless).ok).toBe(true);
    expect(narrativeSchema([], spec.encounters.map(e => e.id)).safeParse(characterless.narrative).success).toBe(true);
    expect(validateGameSpec({ ...characterless, narrative: { ...characterless.narrative, intro: [{ speakerId: "missing", text: "No." }] } }).ok).toBe(false);
  });

  it("keeps all 20 map locations reachable without right-only traversal", () => {
    const seen = new Set<string>();
    const queue = [MAP_START];
    while (queue.length) {
      const point = queue.shift()!; const key = `${point.x},${point.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push(moveOnMap(point, dx, dy));
    }
    expect(MAP_LOCATIONS.every(p => canVisit(p) && seen.has(`${p.x},${p.y}`))).toBe(true);
    expect(new Set(MAP_LOCATIONS.map(p => `${p.x},${p.y}`)).size).toBe(20);
    expect(moveOnMap({ x: 3, y: 0 }, 1, 0)).toEqual({ x: 3, y: 0 });
    expect(moveOnMap({ x: 0, y: 0 }, -1, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe("nonlinear learning progress", () => {
  it("offers independent lessons, then unlocks reviews and the finale from learning evidence", () => {
    const runner = new EncounterRunner(spec, { openProgression: true });
    expect(availableEncounters(spec, runner.completedIds()).map(e => e.id)).toEqual(spec.encounters.slice(0, 4).map(e => e.id));
    expect(runner.selectEncounter("e6_boss")).toBe(false);
    expect(runner.selectEncounter("e5_period_review")).toBe(false);
    for (const id of ["e4_solve", "e2_period", "e5_period_review", "e1_radians", "e3_amplitude", "e6_boss"]) {
      expect(runner.selectEncounter(id), id).toBe(true);
      expect(runner.autoSolve().correct).toBe(true);
    }
    expect(runner.finished).toBe(true);
    expect(runner.telemetry()).toHaveLength(spec.encounters.length);
    expect(runner.debrief().mastery.every(c => c.attempts > 0)).toBe(true);
    expect(runner.selectEncounter("e1_radians")).toBe(false);
  });

  it("preserves attempts, hints and time when a player changes tasks", () => {
    let now = 0;
    const runner = new EncounterRunner(spec, { openProgression: true, now: () => now });
    runner.selectEncounter("e2_period");
    runner.hint();
    now = 100;
    expect(runner.submit({ value: -100 }).correct).toBe(false);
    runner.selectEncounter("e1_radians");
    now = 500;
    runner.selectEncounter("e2_period");
    expect(runner.hintsUsedOnCurrent).toBe(1);
    now = 600;
    runner.autoSolve();
    expect(runner.telemetry().at(-1)).toMatchObject({ attempt: 2, hintsUsed: 1, ms: 200 });
  });

  it("keeps management resources renewable and harvests earned growth", () => {
    let garden = gardenTurn(gardenTurn(INITIAL_GARDEN, "tend"), "tend");
    expect(garden.water).toBe(0);
    expect(gardenTurn(garden, "tend")).toEqual(garden);
    garden = gardenTurn(garden, "harvest");
    expect(garden).toMatchObject({ harvest: 1, growth: 1 });
    expect(gardenTurn(garden, "compost")).toMatchObject({ harvest: 0, water: 2 });
    garden = gardenTurn(garden, "rest");
    expect(garden).toMatchObject({ water: 2, day: 2 });
    expect(gardenTurn(gardenTurn(garden, "rest"), "rest").water).toBe(4);
    expect(gardenTurn(INITIAL_GARDEN, "harvest")).toEqual(INITIAL_GARDEN);
  });
});

describe("interaction variety", () => {
  const menu = buildDirectorMenu(trigKnowledgeMap, trigMatches, "dungeon").flatMap(f => f.cards);
  it("rejects repeated slider/MCQ plans and accepts constructive plans", () => {
    const mimic = getCard("mimic_chest")!;
    expect(varietyProblems(Array(6).fill(mimic), menu)).toHaveLength(3);
    expect(varietyProblems(variedFixture.encounters.map(e => getCard(e.teachingMechanicId)!), menu)).toEqual([]);
    expect(new Set(variedFixture.encounters.map(e => interactionFor(getCard(e.teachingMechanicId)!))).size).toBeGreaterThanOrEqual(3);
    expect(varietyProblems(Array(6).fill(mimic), [mimic])).toEqual([]);
  });

  it("keeps relevance but breaks ties in favor of different actions", () => {
    const mimic = getCard("mimic_chest")!;
    const picks = diverseCards([{ card: mimic, score: 10 }, { card: getCard("phase_gate")!, score: 9 }, { card: getCard("evidence_sort")!, score: 9 }, { card: mimic, score: 9 }], 3);
    expect(picks[0].card.id).toBe(mimic.id);
    expect(new Set(picks.map(p => interactionFor(p.card))).size).toBe(3);
  });

  it.each(["evidence_sort", "concept_links"])("offline %s tasks have valid, solvable source-grounded inputs", id => {
    const e = { ...spec.encounters[1], teachingMechanicId: id, designNote: "Test" };
    const challenge = constructiveChallenge(trigKnowledgeMap, e)!;
    expect(challenge).not.toBeNull();
    const card = getCard(id)!;
    expect(checkChallenge(getMode(card.family, card.mode)!, challenge)).toEqual([]);
  });
});
