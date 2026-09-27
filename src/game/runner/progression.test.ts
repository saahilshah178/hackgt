import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GameSpec } from "../../contracts/gamespec";
import { EncounterRunner } from "./encounter-runner";
import { buildProgression, prerequisitesOf, unlockedIds } from "./progression";

const load = (name: string) => GameSpec.parse(JSON.parse(readFileSync(new URL(`../../../fixtures/${name}.json`, import.meta.url), "utf8")));
const FIXTURES = ["trig-dungeon", "cell-transport-dungeon", "civil-rights-mystery", "wave2-dungeon"].map(load);

describe("buildProgression", () => {
  it("only ever requires earlier encounters, so every graph is acyclic and completable in spec order", () => {
    for (const spec of FIXTURES) {
      const p = buildProgression(spec);
      for (const n of p.nodes) for (const r of n.requires) expect(p.byId.get(r)!.index, `${spec.id}/${n.id}`).toBeLessThan(n.index);
    }
  });

  it("gates the boss on every other encounter and nothing on the boss", () => {
    for (const spec of FIXTURES) {
      const p = buildProgression(spec);
      const boss = p.byId.get(p.bossId!)!;
      expect(boss.isBoss).toBe(true);
      expect(boss.requires).toHaveLength(spec.encounters.length - 1);
      for (const n of p.nodes) expect(n.requires).not.toContain(p.bossId);
    }
  });

  it("opens more than one encounter at the start but never everything (a real choice of route)", () => {
    for (const spec of FIXTURES) {
      const open = unlockedIds(buildProgression(spec), new Set());
      expect(open.length, spec.id).toBeGreaterThanOrEqual(2);
      expect(open.length, spec.id).toBeLessThan(spec.encounters.length - 1);
    }
  });

  it("splits a multi-unit spec into at most three tracks, each sequential", () => {
    const civil = buildProgression(FIXTURES[2]);
    expect(civil.tracks.length).toBeGreaterThanOrEqual(2);
    expect(civil.tracks.length).toBeLessThanOrEqual(3);
    for (const track of civil.tracks)
      for (let i = 1; i < track.length; i++) expect(civil.byId.get(track[i])!.requires).toContain(track[i - 1]);
  });

  it("keeps teach before practice across tracks", () => {
    const p = buildProgression(FIXTURES[3]); // wave2: practice encounters of concepts taught elsewhere
    const machine = p.byId.get("w6_machine")!;
    expect(machine.requires).toContain("w1_slope"); // c_period is taught by w1_slope
  });

  it("depth is 0 for roots and one more than the deepest requirement otherwise; tiers group by depth", () => {
    for (const spec of FIXTURES) {
      const p = buildProgression(spec);
      for (const n of p.nodes) {
        const expected = n.requires.length === 0 ? 0 : 1 + Math.max(...n.requires.map((r) => p.byId.get(r)!.depth));
        expect(n.depth).toBe(expected);
      }
      expect(p.tiers.flat().sort()).toEqual(p.nodes.map((n) => n.id).sort());
    }
  });

  it("prerequisitesOf is the transitive closure", () => {
    const p = buildProgression(FIXTURES[0]);
    expect(prerequisitesOf(p, p.bossId!)).toHaveLength(FIXTURES[0].encounters.length - 1);
    for (const n of p.nodes) if (n.requires.length === 0) expect(prerequisitesOf(p, n.id)).toEqual([]);
  });

  it("handles one- and two-encounter specs", () => {
    const one = { ...FIXTURES[0], encounters: FIXTURES[0].encounters.slice(-1) };
    expect(unlockedIds(buildProgression(one), new Set())).toEqual([one.encounters[0].id]);
    const two = { ...FIXTURES[0], encounters: [FIXTURES[0].encounters[0], FIXTURES[0].encounters.at(-1)!] };
    expect(unlockedIds(buildProgression(two), new Set())).toEqual([two.encounters[0].id]);
  });
});

describe("EncounterRunner free order", () => {
  it("lets the player pick any available encounter and finishes when all are solved", () => {
    for (const spec of FIXTURES) {
      const r = new EncounterRunner(spec, { order: "free" });
      let guard = 0;
      while (!r.finished && guard++ < 50) {
        const open = r.available();
        expect(open.length).toBeGreaterThan(0);
        const pick = open[open.length - 1]; // take the LAST open one: a different route from spec order
        r.focus(pick);
        expect(r.current()!.encounter.id).toBe(pick);
        expect(r.autoSolve().correct).toBe(true);
        expect(r.solved().has(pick)).toBe(true);
        expect(r.focused).toBeNull();
      }
      expect(r.finished).toBe(true);
      expect(r.current()).toBeNull();
      expect(r.telemetry()).toHaveLength(spec.encounters.length);
    }
  });

  it("refuses to focus a locked encounter (the boss at the start)", () => {
    const spec = FIXTURES[0];
    const r = new EncounterRunner(spec, { order: "free" });
    expect(() => r.focus(spec.encounters.at(-1)!.id)).toThrow(/not available/);
  });

  it("counts attempts and hints per encounter, so switching away never resets a first try", () => {
    const spec = FIXTURES[1];
    const r = new EncounterRunner(spec, { order: "free", now: () => 0 });
    const [a, b] = r.available();
    r.focus(a);
    r.hint();
    r.submit({}); // malformed → wrong
    r.focus(b);
    expect(r.hintsUsedOnCurrent).toBe(0);
    r.focus(a);
    expect(r.hintsUsedOnCurrent).toBe(1);
    expect(r.attemptsOn(a)).toBe(1);
    r.autoSolve();
    const last = r.telemetry().at(-1)!;
    expect(last.encounterId).toBe(a);
    expect(last.attempt).toBe(2);
    expect(last.hintsUsed).toBe(1);
  });

  it("skipTo marks prerequisites solved and focuses the target", () => {
    const spec = FIXTURES[2];
    const r = new EncounterRunner(spec, { order: "free" });
    const boss = spec.encounters.at(-1)!.id;
    r.skipTo(boss);
    expect(r.available()).toEqual([boss]);
    expect(r.current()!.encounter.id).toBe(boss);
    r.autoSolve();
    expect(r.finished).toBe(true);
  });

  it("peek() previews any encounter without changing state", () => {
    const spec = FIXTURES[0];
    const r = new EncounterRunner(spec, { order: "free" });
    const boss = spec.encounters.at(-1)!.id;
    expect(r.peek(boss)!.encounter.id).toBe(boss);
    expect(r.peek("nope")).toBeNull();
    expect(r.focused).toBeNull();
  });

  it("linear order is unchanged: available() is the current encounter, and focus() is refused", () => {
    const spec = FIXTURES[0];
    const r = new EncounterRunner(spec);
    expect(r.available()).toEqual([spec.encounters[0].id]);
    expect(() => r.focus(spec.encounters[0].id)).toThrow();
    r.autoSolve();
    expect(r.available()).toEqual([spec.encounters[1].id]);
    expect(r.solved().has(spec.encounters[0].id)).toBe(true);
  });
});
