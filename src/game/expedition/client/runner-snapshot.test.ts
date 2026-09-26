import { describe, expect, it } from "vitest";
import { devSpec } from "../../hosts/expedition/__fixtures__/dev-world";
import { EncounterRunner } from "../../runner/encounter-runner";
import { takeSnapshot } from "./runner-snapshot";
import { progressOf } from "./session";

describe("runner snapshot", () => {
  it("D5: the view keeps its identity per encounter index across snapshots", () => {
    const runner = new EncounterRunner(devSpec());
    const views = new Map<number, unknown>();
    const a = takeSnapshot(runner, views);
    runner.hint();
    const b = takeSnapshot(runner, views);
    expect(b.view).toBe(a.view);
    expect(b.hintsUsed).toBe(1);
    expect(runner.current()?.view).not.toBe(a.view); // the runner itself re-presents every call
  });
  it("advances with the runner; progress derives from its index (D3)", () => {
    const spec = devSpec();
    const runner = new EncounterRunner(spec);
    const views = new Map<number, unknown>();
    expect(takeSnapshot(runner, views)).toMatchObject({ index: 0, finished: false, modeKey: `${spec.encounters[0].familyId}.${spec.encounters[0].mode}` });
    runner.autoSolve();
    runner.autoSolve();
    const s = takeSnapshot(runner, views);
    expect(s.index).toBe(2);
    expect(s.submits).toBe(2);
    expect(progressOf(spec, s.index)).toEqual({ solvedIds: [spec.encounters[0].id, spec.encounters[1].id], currentId: spec.encounters[2].id });
  });
  it("a wrong submit does not advance but counts", () => {
    const runner = new EncounterRunner(devSpec());
    const views = new Map<number, unknown>();
    const before = takeSnapshot(runner, views);
    runner.submit({ value: -12345 });
    const after = takeSnapshot(runner, views);
    expect(after.index).toBe(before.index);
    expect(after.submits).toBe(1);
  });
  it("a finished runner snapshots as finished with no view", () => {
    const spec = devSpec();
    const runner = new EncounterRunner(spec);
    for (let i = 0; i < spec.encounters.length; i++) runner.autoSolve();
    expect(takeSnapshot(runner, new Map())).toMatchObject({ index: null, finished: true, view: null, encounter: null });
  });
});
