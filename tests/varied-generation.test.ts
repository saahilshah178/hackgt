import { describe, expect, it } from "vitest";
import { GENRES } from "../src/contracts/common";
import { getCard } from "../src/library";
import { varietyProblems } from "../src/library/variety";
import { buildDirectorMenu, generateGame } from "../src/pipeline/generate";
import { getModels } from "../src/pipeline/models";
import { getMockSample } from "../src/pipeline/mock/registry";
import { trigIntake, trigMatches } from "../fixtures/trig.knowledge-map";
import { cellIntake, cellMatches } from "../fixtures/cell-transport.knowledge-map";
import { EncounterRunner } from "../src/game/runner/encounter-runner";

describe("varied generation works across genres and game lengths", () => {
  for (const sample of ["trig", "cell"] as const) {
    for (const genre of GENRES) {
      // The cell source has nine concepts and needs at least ten encounters to teach each before a finale.
      it.each(sample === "cell" ? [10, 15] as const : [5, 10, 15] as const)(`${sample} / ${genre} / %i minutes stays varied and completable`, async minutes => {
        const km = getMockSample(sample)!.km!;
        const matches = sample === "trig" ? trigMatches : cellMatches;
        const intake = { ...(sample === "trig" ? trigIntake : cellIntake), minutes, genre };
        const { spec } = await generateGame({ gameId: `variety_${sample}_${genre}_${minutes}`, km, intake, matches, models: getModels() });
        expect(spec.genre).toBe(genre);
        expect(varietyProblems(spec.encounters.map(e => getCard(e.teachingMechanicId)!), buildDirectorMenu(km, matches, genre).flatMap(f => f.cards))).toEqual([]);
        const runner = new EncounterRunner(spec, { openProgression: true });
        for (let i = 0; i < spec.encounters.length; i++) expect(runner.autoSolve().correct).toBe(true);
        expect(runner.finished).toBe(true);
      });
    }
  }
});
