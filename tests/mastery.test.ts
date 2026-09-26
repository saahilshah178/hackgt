import { describe, expect, it } from "vitest";
import { DEFAULT_MASTERY, emptyMastery, updateMastery, type TelemetryEvent } from "../src/contracts/telemetry";

const ev = (over: Partial<TelemetryEvent>): TelemetryEvent => ({
  gameId: "g",
  encounterId: "e1",
  conceptIds: ["c1"],
  teachingMechanicId: "phase_gate",
  attempt: 1,
  correct: true,
  hintsUsed: 0,
  ms: 1000,
  at: "2026-09-26T02:00:00.000Z",
  ...over,
});

describe("mastery meter (LIBRARY §8)", () => {
  it("starts at the configured initial score", () => {
    expect(emptyMastery(["c1"]).c1).toEqual({ score: DEFAULT_MASTERY.initial, attempts: 0, firstTryCorrect: 0 });
  });

  it("first try without hints +0.15, later correct +0.08, each miss −0.05", () => {
    let s = emptyMastery(["c1", "c2"]);
    s = updateMastery(s, ev({}));
    expect(s.c1).toEqual({ score: 0.65, attempts: 1, firstTryCorrect: 1 });
    s = updateMastery(s, ev({ encounterId: "e2", correct: false }));
    expect(s.c1.score).toBeCloseTo(0.6, 5);
    s = updateMastery(s, ev({ encounterId: "e2", attempt: 2 }));
    expect(s.c1.score).toBeCloseTo(0.68, 5);
    expect(s.c1.firstTryCorrect).toBe(1);
    s = updateMastery(s, ev({ encounterId: "e3", hintsUsed: 1 })); // hints disqualify the first-try bonus
    expect(s.c1.score).toBeCloseTo(0.76, 5);
    expect(s.c2.attempts).toBe(0);
  });

  it("clamps to [0, 1] and applies to every concept in the event", () => {
    let s = emptyMastery(["c1", "c2"]);
    for (let i = 0; i < 6; i++) s = updateMastery(s, ev({ conceptIds: ["c1", "c2"], encounterId: `e${i}` }));
    expect(s.c1.score).toBe(1);
    expect(s.c2.score).toBe(1);
    for (let i = 0; i < 30; i++) s = updateMastery(s, ev({ conceptIds: ["c1"], correct: false }));
    expect(s.c1.score).toBe(0);
  });
});
