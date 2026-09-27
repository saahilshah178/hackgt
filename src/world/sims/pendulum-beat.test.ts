/**
 * pendulum-beat — the §7.4 pendulum row (docs/design/20): syncBrightness(T = 4, τ ≤ 30 s) ≥ 0.99; beatHz(T) = |1/4 − 1/T|;
 * the common-start reset zeroes both phases; seeded determinism; the integrated phase never jumps when T changes.
 */
import { describe, expect, it } from "vitest";
import { PendulumSyncConfig } from "../contraptions/pendulum-sync.config";
import type { Draft, SimCtx } from "../types";
import { beatHz, draftValueOf, MIN_PENDULUM_PERIOD, pendulumBeat, pendulumPeriodOf, shieldOmegaOf, syncBrightness, wrapPhase, type PendulumBeatState } from "./pendulum-beat";

const PI = Math.PI;
const CONFIG = PendulumSyncConfig.parse({});
const VIEW = { equation: "y = 3sin((π/2)t)", ask: "period", wave: "sin", amplitude: 3, b: PI / 2, c: 0, d: 0, dial: { min: 0, max: 8, step: 0.05, ticks: [] } };

function draft(value: number | null): Draft | null {
  if (value === null) return null;
  return { encounterId: "e6_boss", modeKey: "tuner.oscillator", input: { value }, complete: true, focus: null, hover: null, probe: null, settled: false, wave: null, marks: null, seq: 1 };
}
const ctx = (value: number | null): SimCtx => ({ draft: draft(value), probe: null, t: 0, aidTier: 0 });

function run(value: number | null, seconds: number, onStep?: (s: PendulumBeatState) => void, view: unknown = VIEW): PendulumBeatState {
  let s = pendulumBeat.init(7, CONFIG, view, ctx(value));
  const n = Math.round(seconds / pendulumBeat.fixedDt);
  for (let i = 0; i < n; i++) {
    s = pendulumBeat.step(s, pendulumBeat.fixedDt, ctx(value));
    onStep?.(s);
  }
  return s;
}

describe("pendulum_beat · the maths", () => {
  it("syncBrightness is ½(1 + cos Δ)", () => {
    expect(syncBrightness(0)).toBe(1);
    expect(syncBrightness(PI)).toBeCloseTo(0, 12);
    expect(syncBrightness(PI / 2)).toBeCloseTo(0.5, 12);
    expect(syncBrightness(-PI / 3)).toBeCloseTo(0.75, 12);
  });

  it("beatHz(T) = |1/4 − 1/T| for the Warden's T₀ = 4", () => {
    expect(beatHz(4, 4)).toBe(0);
    expect(beatHz(4, 2)).toBeCloseTo(0.25, 12);
    expect(beatHz(4, 8)).toBeCloseTo(0.125, 12);
    expect(beatHz(4, 3)).toBeCloseTo(1 / 12, 12);
    // at the edge of the grade tolerance (|T − 4| = 0.24) the beat period is ≥ 62 s: the thread reads as steady
    expect(1 / beatHz(4, 4.24)).toBeGreaterThanOrEqual(62);
    expect(1 / beatHz(4, 3.76)).toBeGreaterThanOrEqual(62);
    expect(beatHz(0, 4)).toBe(0);
    expect(beatHz(4, -1)).toBe(0);
  });

  it("reads the view and the draft", () => {
    expect(shieldOmegaOf(VIEW)).toBeCloseTo(PI / 2, 12);
    expect(shieldOmegaOf({ b: -2 })).toBe(2);
    expect(shieldOmegaOf(null)).toBe(1);
    expect(draftValueOf(draft(3.5))).toBe(3.5);
    expect(draftValueOf(null)).toBeNull();
    expect(pendulumPeriodOf(4, "period")).toBe(4);
    expect(pendulumPeriodOf(0.25, "frequency")).toBe(4);
    expect(pendulumPeriodOf(0, "frequency")).toBeNull();
    expect(pendulumPeriodOf(null, "period")).toBeNull();
    expect(wrapPhase(3 * PI)).toBeCloseTo(PI, 12);
    expect(wrapPhase(-0.5)).toBeCloseTo(-0.5, 12);
  });
});

describe("pendulum_beat · the sim", () => {
  it("at T = 4 the thread stays ≥ 0.99 bright for 30 s (B = ½(1 + cos Δ), Δ = φs − φp)", () => {
    let minB = 1;
    const end = run(4, 30, (s) => (minB = Math.min(minB, s.B)));
    expect(minB).toBeGreaterThanOrEqual(0.99);
    expect(end.t).toBeCloseTo(30, 6);
    expect(end.phiS).toBeCloseTo((PI / 2) * 30, 6);
    expect(end.beatHz).toBe(0);
  });

  it("at T ≠ 4 the thread beats at |1/4 − 1/T| (dims, then realigns)", () => {
    // T = 2: Δ = 2π t (1/4 − 1/2) → B = ½(1 + cos(πt/2)); after 2 s the swings are opposite, after 4 s together again
    let s = run(2, 2);
    expect(s.B).toBeCloseTo(0, 6);
    expect(s.beatHz).toBeCloseTo(0.25, 12);
    s = run(2, 4);
    expect(s.B).toBeCloseTo(1, 6);
  });

  it("the common start: init zeroes both phases and B = 1 (the controller re-inits on open and on settle)", () => {
    const s0 = pendulumBeat.init(1, CONFIG, VIEW, ctx(6.5));
    expect(s0).toMatchObject({ t: 0, phiP: 0, phiS: 0, B: 1, T: 6.5 });
    expect(pendulumBeat.resetOn).toEqual(expect.arrayContaining(["open", "settle"]));
    expect(pendulumBeat.readout(s0)).toMatchObject({ phiP: 0, phiS: 0, B: 1, T0: 4 });
    expect(pendulumBeat.readout(pendulumBeat.init(1, CONFIG, null, ctx(null)))).toMatchObject({ B: 1 });
  });

  it("is deterministic: the same seed and inputs give identical states", () => {
    const a: PendulumBeatState[] = [];
    const b: PendulumBeatState[] = [];
    run(3.3, 5, (s) => a.push(s));
    run(3.3, 5, (s) => b.push(s));
    expect(a).toEqual(b);
  });

  it("integrates the pendulum phase: changing T mid-swing never makes the phase jump", () => {
    let s = pendulumBeat.init(1, CONFIG, VIEW, ctx(4));
    for (let i = 0; i < 30; i++) s = pendulumBeat.step(s, pendulumBeat.fixedDt, ctx(4));
    const before = s.phiP;
    s = pendulumBeat.step(s, pendulumBeat.fixedDt, ctx(1));
    expect(s.phiP - before).toBeCloseTo((2 * PI * pendulumBeat.fixedDt) / 1, 9); // one step at the new rate
    // below 0.25 s the pendulum shivers at the floor rate instead of spinning up without bound
    const shiver = pendulumBeat.step(s, pendulumBeat.fixedDt, ctx(0.01));
    expect(shiver.phiP - s.phiP).toBeCloseTo((2 * PI * pendulumBeat.fixedDt) / MIN_PENDULUM_PERIOD, 9);
  });

  it("a new value that arrives already settled is a common start too (t, φs and φp restart; t0 = the station clock)", () => {
    let s = pendulumBeat.init(1, CONFIG, VIEW, { draft: draft(3), probe: null, t: 0, aidTier: 0 });
    for (let i = 0; i < 45; i++) s = pendulumBeat.step(s, pendulumBeat.fixedDt, { draft: draft(3), probe: null, t: (i + 1) / 30, aidTier: 0 });
    expect(s.phiP).toBeGreaterThan(1);
    const settled4 = { ...draft(4)!, settled: true };
    const r = pendulumBeat.step(s, pendulumBeat.fixedDt, { draft: settled4, probe: null, t: 46 / 30, aidTier: 0 });
    expect(r.t).toBeCloseTo(pendulumBeat.fixedDt, 12);
    expect(r.phiS).toBeCloseTo((PI / 2) * pendulumBeat.fixedDt, 12);
    expect(r.phiP).toBeCloseTo((2 * PI * pendulumBeat.fixedDt) / 4, 12);
    expect(r.t0).toBeCloseTo(45 / 30, 12);
    expect(r.B).toBeGreaterThan(0.999);
    // the same settled value again is not a restart
    const again = pendulumBeat.step(r, pendulumBeat.fixedDt, { draft: settled4, probe: null, t: 47 / 30, aidTier: 0 });
    expect(again.t).toBeCloseTo(2 * pendulumBeat.fixedDt, 12);
    // a value still being dragged (settled: false) never restarts
    const drag = pendulumBeat.step(again, pendulumBeat.fixedDt, { draft: draft(5), probe: null, t: 48 / 30, aidTier: 0 });
    expect(drag.t).toBeCloseTo(3 * pendulumBeat.fixedDt, 12);
  });

  it("without a draft the pendulum rests while the shield keeps time", () => {
    const s = run(null, 2);
    expect(s.phiP).toBe(0);
    expect(s.phiS).toBeCloseTo(PI, 6);
    expect(s.T).toBeNull();
    expect(s.beatHz).toBe(0);
  });
});
