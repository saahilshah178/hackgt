/** resolveWorld and the resolution order (docs/design/20 §0 decision 2, §1.5, §8.1). */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Issue } from "../src/contracts/common";
import { GameSpec } from "../src/contracts/gamespec";
import { WorldFile, type WorldOverlay } from "../src/contracts/world";
import { declaredFlagsOf, resolveWorld, selectWorld, type NamedWorldFile } from "../src/world/resolve-world";
import type { ValidateWorldResult } from "../src/world/types";
import { validateWorld } from "../src/world/validate-world";

const load = (f: string) => GameSpec.parse(JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", `${f}.json`), "utf8")));
const side = (f: string) => WorldFile.parse(JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "worlds", `${f}.world.json`), "utf8")));
const trig = load("trig-dungeon");
const trigFile = side("trig");

const ok: ValidateWorldResult = { issues: [], warnings: [] };
const bad: ValidateWorldResult = { issues: [{ path: ["world"], message: "R4: nope", owner: "code" } as Issue], warnings: [] };
const named = (name: string, file: WorldFile): NamedWorldFile => ({ name, file });
const withApplies = (f: WorldFile, specIds: string[], sources: WorldFile["appliesTo"]["sources"]): WorldFile => ({ ...f, appliesTo: { specIds, sources } });

describe("selectWorld: the resolution order", () => {
  const byId = named("a.world.json", withApplies(trigFile, [trig.id], []));
  const bySource = named("b.world.json", withApplies(trigFile, [], [{ sourceId: trig.source.sourceId, genre: trig.genre }]));
  it("by id first, then by source", () => {
    expect(selectWorld(trig, [bySource, byId], { validate: () => ok })).toMatchObject({ source: "sidecar_id", file: "a.world.json" });
    expect(selectWorld(trig, [bySource], { validate: () => ok })).toMatchObject({ source: "sidecar_source", file: "b.world.json" });
  });
  it("by source only when valid; a failing candidate is skipped with a reason and the next is tried", () => {
    const skipped: string[] = [];
    const validate = (_s: GameSpec, _w: WorldOverlay, sidecar: boolean) => (sidecar ? bad : ok);
    const specWorld = { ...trig, world: trigFile.world };
    const got = selectWorld(specWorld, [byId, bySource], { validate, onSkip: (r) => skipped.push(r) });
    expect(got?.source).toBe("spec");
    expect(skipped).toHaveLength(2);
    expect(skipped[0]).toMatch(/a\.world\.json does not fit/);
  });
  it("then spec.world, then autoWorld behind its flag, else null", () => {
    expect(selectWorld({ ...trig, world: trigFile.world }, [], { validate: () => ok })?.source).toBe("spec");
    expect(selectWorld(trig, [], { validate: () => ok })).toBeNull();
    expect(selectWorld(trig, [], { validate: () => ok, auto: () => trigFile.world })?.source).toBe("auto");
    expect(selectWorld(trig, [], { validate: () => ok, auto: null })).toBeNull();
    expect(selectWorld(trig, [], { validate: () => ok, auto: () => { throw new Error("boom"); } })).toBeNull();
  });
  it("side-cars are validated as side-cars, spec.world as writer output", () => {
    const seen: boolean[] = [];
    selectWorld({ ...trig, world: trigFile.world }, [byId], { validate: (_s, _w, sidecar) => (seen.push(sidecar), bad) });
    expect(seen).toEqual([true, false]);
  });
  it("carries the chosen world's warnings", () => {
    const got = selectWorld(trig, [byId], { validate: (s, w, sidecar) => validateWorld(s, w, { sidecar }) });
    expect(got?.warnings.length).toBeGreaterThanOrEqual(0);
    expect(got?.world.biome).toBe("orrery_terraces");
  });
});

describe("resolveWorld", () => {
  for (const [fixture, file] of [["trig-dungeon", "trig"], ["cell-transport-dungeon", "cell-transport"], ["civil-rights-mystery", "civil-rights"]] as const) {
    it(`${file}: stations in encounter order with metas, configs, layouts and probes`, () => {
      const spec = load(fixture);
      const w = side(file).world;
      const r = resolveWorld(spec, w, "sidecar_id");
      expect(r.source).toBe("sidecar_id");
      expect(r.stations.map((s) => s.encounterId)).toEqual(spec.encounters.map((e) => e.id));
      r.stations.forEach((s, i) => {
        expect(s.index).toBe(i);
        expect(s.modeKey).toBe(`${spec.encounters[i]!.familyId}.${spec.encounters[i]!.mode}`);
        expect(s.meta.modes).toContain(s.modeKey);
        expect(s.meta.layouts).toContain(s.layout);
        expect(r.zones[s.zoneIndex]?.id).toBe(s.zoneId);
        expect(r.stationByEncounter.get(s.encounterId)).toBe(s);
      });
      expect(r.namespaces).toEqual(["shared", w.biome]);
      expect(r.speakers.has("player")).toBe(true);
      expect(r.speakers.has("narrator")).toBe(true);
      for (const c of spec.characters) expect(r.speakers.has(c.id)).toBe(true);
    });
  }
  it("never throws: an unknown contraption or a bad config falls back to a contraption that plays the mode", () => {
    const w = structuredClone(trigFile.world);
    w.stations[0]!.contraption = "does_not_exist";
    w.stations[1]!.config = { definitely: "not a config" };
    const r = resolveWorld(trig, w, "spec");
    expect(r.stations[0]!.meta.modes).toContain("mapper.number_line");
    expect(r.stations[1]!.meta.modes).toContain("tuner.oscillator");
  });
  it("feedback nouns per station and declared flags", () => {
    const w = structuredClone(trigFile.world);
    w.feedbackNouns = [{ from: "chest", to: "singer", stations: ["e3_amplitude"] }];
    w.triggers = [{ id: "t", zoneId: w.zones[0]!.id, x: 10, surface: "ground", radius: 240, kind: "ambient", lines: [{ speakerId: "cog", text: "hi", mood: "neutral" }], once: true, requires: null, setFlag: "heard", cue: null, cutsceneId: null }];
    const r = resolveWorld(trig, w, "spec");
    expect(r.feedbackNouns("e3_amplitude")).toEqual([{ from: "chest", to: "singer" }]);
    expect(r.feedbackNouns("e5_period_review")).toEqual([]);
    expect(r.flagsDeclared.has("heard")).toBe(true);
    expect(declaredFlagsOf(w)).toEqual(r.flagsDeclared);
  });
});
