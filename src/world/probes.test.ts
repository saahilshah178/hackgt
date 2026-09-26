/** Every §2.5.4 probe row, with hand-built inputs from the three fixtures (incl. assignedTo on type_match and decoyPresent with itemKey null). */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GameSpec } from "../contracts/gamespec";
import { MisconceptionProbe } from "../contracts/world";
import { getMode } from "../mechanics/registry";
import { matchProbes, predicatesFor, probeMatches, probeRefIssues, scalarTolerance, solutionKeys, type ProbeCtx } from "./probes";

const specs = Object.fromEntries(
  ["trig-dungeon", "cell-transport-dungeon", "civil-rights-mystery"].map((f) => [f, JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", `${f}.json`), "utf8")) as GameSpec]),
);
function ctxOf(file: string, id: string, input: unknown): ProbeCtx {
  const spec = specs[file]!;
  const i = spec.encounters.findIndex((e) => e.id === id);
  const e = spec.encounters[i]!;
  return { modeKey: `${e.familyId}.${e.mode}`, view: getMode(e.familyId, e.mode)!.present(e.params, spec.seed + i), solution: e.solution, input };
}
const probe = (p: unknown) => MisconceptionProbe.parse(p);

describe("nearValue (number_line, oscillator)", () => {
  it("number_line: within solution.tolerance × (max − min) × tolFactor", () => {
    const c = ctxOf("trig-dungeon", "e1_radians", { value: 0 });
    const tol = scalarTolerance(c.modeKey, c.view, c.solution);
    expect(tol).toBeGreaterThan(0);
    const p = probe({ predicate: "nearValue", value: "pi/2", key: "quarter" });
    expect(probeMatches(p, { ...c, input: { value: Math.PI / 2 + tol * 0.9 } })).toBe(true);
    expect(probeMatches(p, { ...c, input: { value: Math.PI / 2 + tol * 1.1 } })).toBe(false);
    expect(probeMatches(probe({ predicate: "nearValue", value: "pi/2", tolFactor: 2, key: "quarter" }), { ...c, input: { value: Math.PI / 2 + tol * 1.5 } })).toBe(true);
  });
  it("oscillator: 3 % of the dial (the mode's own constant)", () => {
    const c = ctxOf("trig-dungeon", "e2_period", { value: 0 });
    const dial = (c.view as { dial: { min: number; max: number } }).dial;
    expect(scalarTolerance(c.modeKey, c.view, c.solution)).toBeCloseTo(0.03 * (dial.max - dial.min));
    const p = probe({ predicate: "nearValue", value: "2*pi", key: "full_turn" });
    expect(probeMatches(p, { ...c, input: { value: 2 * Math.PI } })).toBe(true);
    expect(probeMatches(p, { ...c, input: { value: Math.PI } })).toBe(false);
    expect(probeMatches(probe({ predicate: "nearValue", value: "bogus(", key: "x" }), { ...c, input: { value: 1 } })).toBe(false);
  });
});

describe("aimedIndex (mimic, predict_reveal)", () => {
  it("matches the chosen statementIndex / optionIndex", () => {
    const m = ctxOf("trig-dungeon", "e3_amplitude", { statementIndex: 1 });
    expect(probeMatches(probe({ predicate: "aimedIndex", index: 1, key: "k" }), m)).toBe(true);
    expect(probeMatches(probe({ predicate: "aimedIndex", index: 2, key: "k" }), m)).toBe(false);
    const pr = ctxOf("civil-rights-mystery", "e3_little_rock", { optionIndex: 2 });
    expect(probeMatches(probe({ predicate: "aimedIndex", index: 2, key: "k" }), pr)).toBe(true);
    expect(probeMatches(probe({ predicate: "aimedIndex", index: 0, key: "k" }), pr)).toBe(false);
  });
});

describe("keyInSlot and decoyPresent (linear)", () => {
  const c = ctxOf("trig-dungeon", "e4_solve", { keys: ["s1", "s0", "d0", "s3"] });
  it("keyInSlot: a slot, or anywhere when slot is null", () => {
    expect(probeMatches(probe({ predicate: "keyInSlot", itemKey: "s1", slot: 0, key: "k" }), c)).toBe(true);
    expect(probeMatches(probe({ predicate: "keyInSlot", itemKey: "s1", slot: 1, key: "k" }), c)).toBe(false);
    expect(probeMatches(probe({ predicate: "keyInSlot", itemKey: "s3", key: "k" }), c)).toBe(true);
    expect(probeMatches(probe({ predicate: "keyInSlot", itemKey: "s2", key: "k" }), c)).toBe(false);
  });
  it("decoyPresent: a named decoy, or any decoy with itemKey null", () => {
    expect(probeMatches(probe({ predicate: "decoyPresent", itemKey: "d0", key: "k" }), c)).toBe(true);
    expect(probeMatches(probe({ predicate: "decoyPresent", itemKey: null, key: "k" }), c)).toBe(true);
    const clean = { ...c, input: { keys: ["s1", "s0", "s2", "s3"] } };
    expect(probeMatches(probe({ predicate: "decoyPresent", itemKey: null, key: "k" }), clean)).toBe(false);
    expect(solutionKeys(c.modeKey, c.solution)).toEqual(new Set(["s0", "s1", "s2", "s3"]));
  });
});

describe("decoyPresent and linkedTo (chain, pairs)", () => {
  it("chain: any edge end; itemKey null = any decoy (civil e11)", () => {
    const c = ctxOf("civil-rights-mystery", "e11_causation", { edges: [{ fromKey: "n0", toKey: "d1" }, { fromKey: "n1", toKey: "n2" }] });
    expect(probeMatches(probe({ predicate: "decoyPresent", itemKey: null, key: "k" }), c)).toBe(true);
    expect(probeMatches(probe({ predicate: "decoyPresent", itemKey: "d1", key: "k" }), c)).toBe(true);
    expect(probeMatches(probe({ predicate: "decoyPresent", itemKey: "d0", key: "k" }), c)).toBe(false);
    expect(probeMatches(probe({ predicate: "linkedTo", fromKey: "n1", toKey: "n2", key: "k" }), c)).toBe(true);
    expect(probeMatches(probe({ predicate: "linkedTo", fromKey: "n2", toKey: "n1", key: "k" }), c)).toBe(false);
    const clean = { ...c, input: { edges: [{ fromKey: "n0", toKey: "n1" }] } };
    expect(probeMatches(probe({ predicate: "decoyPresent", itemKey: null, key: "k" }), clean)).toBe(false);
  });
  it("pairs: rightKey decoys and lN → rM links (civil e7)", () => {
    const c = ctxOf("civil-rights-mystery", "e7_march", { links: [{ leftKey: "l0", rightKey: "x0" }, { leftKey: "l1", rightKey: "r1" }] });
    expect(probeMatches(probe({ predicate: "decoyPresent", itemKey: "x0", key: "k" }), c)).toBe(true);
    expect(probeMatches(probe({ predicate: "decoyPresent", itemKey: null, key: "k" }), c)).toBe(true);
    expect(probeMatches(probe({ predicate: "linkedTo", fromKey: "l0", toKey: "x0", key: "k" }), c)).toBe(true);
    expect(probeMatches(probe({ predicate: "linkedTo", fromKey: "l1", toKey: "x0", key: "k" }), c)).toBe(false);
  });
});

describe("assignedTo (bins, type_match)", () => {
  it("bins: item in bin (cell e2)", () => {
    const c = ctxOf("cell-transport-dungeon", "e2_selectivity", { assignments: [{ itemKey: "i2", binId: "diffuses" }] });
    expect(probeMatches(probe({ predicate: "assignedTo", itemKey: "i2", binId: "diffuses", key: "k" }), c)).toBe(true);
    expect(probeMatches(probe({ predicate: "assignedTo", itemKey: "i2", binId: "protein", key: "k" }), c)).toBe(false);
  });
  it("type_match: w<i> ↔ waveIndex i, binId ↔ the answered category; a missing answer never matches (cell e5)", () => {
    const c = ctxOf("cell-transport-dungeon", "e5_tonicity", { answers: [{ waveIndex: 2, categoryId: "hypertonic" }] });
    expect(probeMatches(probe({ predicate: "assignedTo", itemKey: "w2", binId: "hypertonic", key: "k" }), c)).toBe(true);
    expect(probeMatches(probe({ predicate: "assignedTo", itemKey: "w2", binId: "isotonic", key: "k" }), c)).toBe(false);
    expect(probeMatches(probe({ predicate: "assignedTo", itemKey: "w1", binId: "hypertonic", key: "k" }), c)).toBe(false);
    expect(probeMatches(probe({ predicate: "assignedTo", itemKey: "i2", binId: "hypertonic", key: "k" }), c)).toBe(false);
  });
});

describe("matchProbes and references", () => {
  it("returns matched keys in station order; predicates outside the mode never match", () => {
    const c = ctxOf("trig-dungeon", "e3_amplitude", { statementIndex: 0 });
    const ps = [
      probe({ predicate: "aimedIndex", index: 1, key: "a" }),
      probe({ predicate: "aimedIndex", index: 0, key: "b" }),
      probe({ predicate: "keyInSlot", itemKey: "s0", key: "c" }),
    ];
    expect(matchProbes(ps, c)).toEqual(["b"]);
    expect(predicatesFor("balance.equation")).toEqual([]);
  });
  it("probeRefIssues checks keys against the view", () => {
    const tm = ctxOf("cell-transport-dungeon", "e5_tonicity", {});
    expect(probeRefIssues(probe({ predicate: "assignedTo", itemKey: "w9", binId: "hypertonic", key: "k" }), tm.modeKey, tm.view)[0]).toMatch(/5 waves/);
    expect(probeRefIssues(probe({ predicate: "assignedTo", itemKey: "w4", binId: "salty", key: "k" }), tm.modeKey, tm.view)[0]).toMatch(/category/);
    expect(probeRefIssues(probe({ predicate: "assignedTo", itemKey: "w4", binId: "hypertonic", key: "k" }), tm.modeKey, tm.view)).toEqual([]);
    const lin = ctxOf("trig-dungeon", "e4_solve", {});
    expect(probeRefIssues(probe({ predicate: "keyInSlot", itemKey: "s9", slot: 7, key: "k" }), lin.modeKey, lin.view)).toHaveLength(2);
    expect(probeRefIssues(probe({ predicate: "decoyPresent", itemKey: null, key: "k" }), lin.modeKey, lin.view)).toEqual([]);
    const pr = ctxOf("civil-rights-mystery", "e7_march", {});
    expect(probeRefIssues(probe({ predicate: "linkedTo", fromKey: "l0", toKey: "x0", key: "k" }), pr.modeKey, pr.view)).toEqual([]);
    expect(probeRefIssues(probe({ predicate: "linkedTo", fromKey: "r0", toKey: "l0", key: "k" }), pr.modeKey, pr.view)).toHaveLength(2);
    const mi = ctxOf("trig-dungeon", "e3_amplitude", {});
    expect(probeRefIssues(probe({ predicate: "aimedIndex", index: 9, key: "k" }), mi.modeKey, mi.view)).toHaveLength(1);
    expect(probeRefIssues(probe({ predicate: "nearValue", value: "pi", key: "k" }), mi.modeKey, mi.view)[0]).toMatch(/not defined/);
    const bins = ctxOf("cell-transport-dungeon", "e2_selectivity", {});
    expect(probeRefIssues(probe({ predicate: "assignedTo", itemKey: "i2", binId: "nowhere", key: "k" }), bins.modeKey, bins.view)).toHaveLength(1);
  });
});
