import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GameSpec } from "../../../../contracts/gamespec";
import { buildProgression } from "../../../runner/progression";
import { buildCasefile, dossierFor, goalOf } from "./burst-casefile.logic";

const CASE = GameSpec.parse(JSON.parse(readFileSync(new URL("../../../../../fixtures/cell-transport-casefile.json", import.meta.url), "utf8")));

describe("Burst Cell casefile", () => {
  it("gives each scene its own room, named for what it shows", () => {
    const cf = buildCasefile(CASE, buildProgression(CASE));
    const scenes = cf.locations.filter((l) => l.kind === "scene");
    expect(scenes.map((s) => s.style)).toEqual(["study", "bench", "archive"].slice(0, scenes.length));
    expect(scenes.map((s) => s.title)).toEqual(["Office", "Lab bench", "Archive"].slice(0, scenes.length));
    for (const s of scenes) expect(s.topic.length).toBeGreaterThan(0);
    for (const slot of ["tallR", "deskL"] as const) {
      const kinds = scenes.map((s) => s.props.find((p) => p.slot === slot)!.kind);
      expect(new Set(kinds).size, `${slot}: ${kinds.join(",")}`).toBe(kinds.length);
    }
  });

  it("the dossier teaches every scene's concepts up front and adds the proof once a lead is cracked", () => {
    expect(goalOf("The student can predict the direction of water movement.")).toBe("predict the direction of water movement");
    const cf = buildCasefile(CASE, buildProgression(CASE));
    const before = dossierFor(CASE, cf, new Set());
    expect(before.length).toBe(cf.locations.filter((l) => l.kind === "scene").length);
    for (const s of before) {
      expect(s.entries.length).toBeGreaterThan(0);
      for (const en of s.entries) {
        expect(en.primer.length).toBeGreaterThan(20);
        expect(en.primer).not.toMatch(/^The student can/);
        expect(en.facts.length).toBeGreaterThanOrEqual(3);
        expect(en.pitfalls.length).toBeGreaterThan(0);
        expect(en.proved).toEqual([]);
        expect(en.solved).toBe(false);
      }
    }
    const first = cf.locations[0].encounterIds[0];
    const after = dossierFor(CASE, cf, new Set([first]));
    const enc = CASE.encounters.find((e) => e.id === first)!;
    const entry = after[0].entries.find((en) => en.conceptId === enc.conceptIds[0])!;
    expect(entry.proved).toEqual([enc.debriefLine]);
    expect(entry.solved).toBe(true);
  });
});
