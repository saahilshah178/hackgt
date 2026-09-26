import { describe, expect, it } from "vitest";
import fixture from "../fixtures/trig-dungeon.json";
import { trigChallenges, trigSlices } from "../fixtures/trig.slices";
import { EncounterRunner } from "../src/game/runner/encounter-runner";
import { getMechanic } from "../src/mechanics/registry";
import { phaseGate } from "../src/mechanics/phase-gate";
import { assembleGameSpec } from "../src/pipeline/assemble";
import { checkChallenge } from "../src/pipeline/validate/checks";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe("the trig fixture", () => {
  it("validates with no issues or warnings", () => {
    const r = validateGameSpec(fixture);
    expect(r.ok ? [] : r.issues).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("is exactly what the assembler produces from the slices (deterministic, no drift)", () => {
    expect(assembleGameSpec(trigSlices)).toEqual(fixture);
  });

  it("is winnable: autoSolve plays every encounter headlessly", () => {
    const r = validateGameSpec(fixture);
    if (!r.ok) throw new Error("fixture invalid");
    let t = 0;
    const runner = new EncounterRunner(r.spec, { now: () => (t += 1000) });
    while (!runner.finished) expect(runner.autoSolve().correct).toBe(true);
    expect(runner.telemetry()).toHaveLength(6);
    const { mastery, lines } = runner.debrief();
    expect(mastery.find((m) => m.conceptId === "c_period")).toMatchObject({ encounters: 3, firstTry: 3 });
    expect(lines[1].text).toBe("The door followed y = sin(2t); its period is π, because 2π/|b| with b = 2.");
  });

  it("wrong answers teach without giving the answer away", () => {
    const r = validateGameSpec(fixture);
    if (!r.ok) throw new Error("fixture invalid");
    const runner = new EncounterRunner(r.spec);
    runner.skipTo("e2_period");
    const miss = runner.submit({ period: 2 * Math.PI }); // the classic error: ignoring b
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/too long/);
    expect(runner.hint()).toMatch(/come back to where they started/);
    expect(runner.submit({ period: Math.PI }).advanced).toBe(true);
  });

  it("presents shuffled but identical views on every replay", () => {
    const r = validateGameSpec(fixture);
    if (!r.ok) throw new Error("fixture invalid");
    const a = new EncounterRunner(r.spec);
    const b = new EncounterRunner(r.spec);
    a.skipTo("e4_solve");
    b.skipTo("e4_solve");
    const view = a.current()!.view as { planks: { key: string }[] };
    expect(view).toEqual(b.current()!.view);
    expect(view.planks.map((p) => p.key)).not.toEqual(["s0", "s1", "s2", "s3", "d0"]);
  });
});

describe("validation routes problems to the agent that owns them", () => {
  it("two false statements in a Mimic Chest -> challenge writer, that encounter", () => {
    const spec = clone(fixture);
    (spec.encounters[2].params as { statements: { isTrue: boolean }[] }).statements[0].isTrue = false;
    const r = validateGameSpec(spec);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues[0]).toMatchObject({ owner: "challenge_writer", encounterId: "e3_amplitude" });
    expect(r.issues[0].message).toMatch(/exactly one statement must be false/);
  });

  it("a dangling concept id -> director", () => {
    const spec = clone(fixture);
    spec.encounters[0].conceptIds = ["c_nonexistent"];
    const r = validateGameSpec(spec);
    expect(!r.ok && r.issues.some((i) => i.owner === "director" && /unknown concept/.test(i.message))).toBe(true);
  });

  it("a mechanic on a socket it can't mount on -> director", () => {
    const spec = clone(fixture);
    spec.encounters[2].socket = "door"; // Mimic Chest only mounts on "chest" in a dungeon
    const r = validateGameSpec(spec);
    expect(!r.ok && r.issues.some((i) => i.owner === "director" && /can't mount on "door"/.test(i.message))).toBe(true);
  });

  it("a tampered answer key -> code (the model never writes solutions)", () => {
    const spec = clone(fixture);
    (spec.encounters[1].solution as { period: number }).period = 42;
    const r = validateGameSpec(spec);
    expect(!r.ok && r.issues.some((i) => i.owner === "code" && /resolve/.test(i.message))).toBe(true);
  });

  it("a rounded decimal instead of an exact expression is caught", () => {
    const spec = clone(fixture);
    (spec.encounters[5].params as { b: string }).b = "1.5708";
    const r = validateGameSpec(spec);
    expect(!r.ok && r.issues.some((i) => /rounded decimal/.test(i.message))).toBe(true);
  });

  it("an encounter missing from the layout is caught", () => {
    const spec = clone(fixture);
    spec.layout.chunks = spec.layout.chunks.filter((c) => c.encounterId !== "e4_solve");
    const r = validateGameSpec(spec);
    expect(!r.ok && r.issues.some((i) => /"e4_solve" is placed 0 times/.test(i.message))).toBe(true);
  });
});

describe("slice checks (run before assembly, turned into repair notes)", () => {
  it("rejects an answer placeholder in the prompt", () => {
    const slice = { ...trigChallenges.e2_period, prompt: "Set the dial to {{period}}." };
    expect(checkChallenge(phaseGate, slice).join(" ")).toMatch(/prompt gives away the answer via \{\{period\}\}/);
  });

  it("rejects unknown placeholders and lists the allowed ones", () => {
    const slice = { ...trigChallenges.e2_period, debriefLine: "It was {{answer}}." };
    expect(checkChallenge(phaseGate, slice).join(" ")).toMatch(/unknown placeholder \{\{answer\}\}.*\{\{equation\}\}/);
  });

  it("every mechanic's computed solution passes its own grader", () => {
    for (const [id, slice] of Object.entries(trigChallenges)) {
      const e = trigSlices.blueprint.encounters.find((x) => x.id === id)!;
      expect(checkChallenge(getMechanic(e.mechanicId)!, slice)).toEqual([]);
    }
  });
});
