import { describe, expect, it } from "vitest";
import { aidTierOf, tierUnlocked, toHintsUsed } from "./aid-tier";
import type { HintsUsed } from "./types";

describe("aidTierOf = min(2, max(hintsUsed, failedVerifies > 0 ? 1 : 0))", () => {
  it("matches the tier table for every hint count and failure count", () => {
    const table: [HintsUsed, number, 0 | 1 | 2][] = [
      [0, 0, 0],
      [0, 1, 1],
      [0, 5, 1],
      [1, 0, 1],
      [1, 3, 1],
      [2, 0, 2],
      [2, 1, 2],
      [3, 0, 2],
      [3, 9, 2],
    ];
    for (const [hints, fails, tier] of table) expect(aidTierOf(hints, fails), `${hints} hints, ${fails} fails`).toBe(tier);
  });

  it("never exceeds 2 and never goes below 0", () => {
    for (let h = 0 as HintsUsed; h <= 3; h = (h + 1) as HintsUsed) {
      for (let f = 0; f < 6; f++) {
        const t = aidTierOf(h, f);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(2);
      }
    }
  });

  it("clamps raw hint counts and compares tiers", () => {
    expect(toHintsUsed(-1)).toBe(0);
    expect(toHintsUsed(2.7)).toBe(2);
    expect(toHintsUsed(12)).toBe(3);
    expect(toHintsUsed(Number.NaN)).toBe(0);
    expect(tierUnlocked(1, 0)).toBe(false);
    expect(tierUnlocked(1, 1)).toBe(true);
    expect(tierUnlocked(2, 1)).toBe(false);
  });
});
