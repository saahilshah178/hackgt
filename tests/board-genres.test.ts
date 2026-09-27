import { beforeEach, describe, expect, it } from "vitest";
import { cellIntake, cellKnowledgeMap, cellMatches } from "../fixtures/cell-transport.knowledge-map";
import { historyIntake, historyKnowledgeMap, historyMatches } from "../fixtures/civil-rights.knowledge-map";
import { trigIntake, trigKnowledgeMap, trigMatches } from "../fixtures/trig.knowledge-map";
import type { Genre } from "../src/contracts/common";
import { EncounterRunner } from "../src/game/runner/encounter-runner";
import { BOARD_GENRES, BOSS_SOCKET, IMPLEMENTED_GENRES, SOCKETS } from "../src/library/genres";
import { generateGame } from "../src/pipeline/generate";
import { getModels } from "../src/pipeline/models";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";
import { resetEnvCache } from "../src/server/env";

/*
 * The board genres (not a left-to-right walk) work end to end in mock mode for every sample topic: a requested
 * genre is honoured, the spec validates with that genre's sockets, and the free-order runner can finish it along a
 * route that differs from the spec order.
 */

const SAMPLES = [
  { name: "trig", km: trigKnowledgeMap, intake: trigIntake, matches: trigMatches },
  { name: "cell", km: cellKnowledgeMap, intake: cellIntake, matches: cellMatches },
  { name: "history", km: historyKnowledgeMap, intake: historyIntake, matches: historyMatches },
];

describe("board genres in mock mode", () => {
  beforeEach(() => {
    process.env.LLM_MODE = "mock";
    resetEnvCache();
  });

  it("every board genre is implemented and distinct from the side-view hosts", () => {
    for (const g of BOARD_GENRES) expect(IMPLEMENTED_GENRES).toContain(g);
    expect(BOARD_GENRES).not.toContain("dungeon");
    expect(BOARD_GENRES).not.toContain("platformer");
  });

  for (const sample of SAMPLES) {
    for (const genre of BOARD_GENRES as readonly Genre[]) {
      it(`${sample.name} as ${genre}: generates, validates and plays to the end in free order`, async () => {
        const { spec, genre: got } = await generateGame({
          gameId: `${sample.name}_${genre}_test`,
          km: sample.km,
          intake: { ...sample.intake, genre },
          matches: sample.matches,
          models: getModels(),
          now: () => new Date("2026-09-26T20:00:00.000Z"),
        });
        expect(got).toBe(genre);
        expect(spec.genre).toBe(genre);
        const v = validateGameSpec(spec);
        expect(v.ok, JSON.stringify(v.ok ? [] : v.issues.slice(0, 3))).toBe(true);
        for (const e of spec.encounters) expect(SOCKETS[genre] as readonly string[]).toContain(e.socket);
        expect(spec.encounters.at(-1)!.socket).toBe(BOSS_SOCKET[genre]);

        const runner = new EncounterRunner(spec, { order: "free" });
        const route: string[] = [];
        for (let guard = 0; !runner.finished && guard < 40; guard++) {
          const open = runner.available();
          const pick = open[open.length - 1];
          runner.focus(pick);
          route.push(pick);
          expect(runner.autoSolve().correct).toBe(true);
        }
        expect(runner.finished).toBe(true);
        expect(new Set(route).size).toBe(spec.encounters.length);
      });
    }
  }
});
