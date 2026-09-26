import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GameSpec } from "../contracts/gamespec";
import { getMode } from "../mechanics/registry";
import { bannedValuesFor, leakTokens, leakedValues, leaks, normalizeForLeak } from "./answer-leak";

const trig = JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "trig-dungeon.json"), "utf8")) as GameSpec;

describe("tokenizer", () => {
  it("keeps math runs as one token", () => {
    expect(leakTokens("5π/6 and π/2, 2π, 4.00")).toEqual(["5π/6", "and", "π/2", ",", "2π", ",", "4.00"]);
    expect(leakTokens("y = sin(2t)")).toEqual(["y", "=", "sin", "(", "2", "t", ")"]);
    expect(normalizeForLeak("Set  the timer to PI − 1")).toBe("set the timer to π - 1");
    expect(leakTokens("2pi")).toEqual(["2π"]);
    expect(leakTokens("spin")).toEqual(["spin"]);
  });
});

describe("R8 cases (§8.1)", () => {
  it("trig e2 texts pass for banned π; the leak fails", () => {
    expect(leaks("The Tidewheel Gate. Its ring runs on y = sin(2t). It must lap once and lock, or the canals stay dry.", "π")).toBe(false);
    expect(leaks("Those rings spin on a sine wave. Watch how fast, not how far.", "π")).toBe(false);
    expect(leaks("Set the timer to π.", "π")).toBe(true);
    expect(leaks("Set the timer to pi.", "π")).toBe(true);
    expect(leaks("One period lasts 2π/|b|.", "π")).toBe(false);
    expect(leaks("Half of it is π/2.", "π")).toBe(false);
  });
  it("e6 banned 4: '4 seconds' and '4.00' fail, '40 spans' and '0.4' pass", () => {
    expect(leaks("Wait 4 seconds.", "4")).toBe(true);
    expect(leaks("It reads 4.00 on the dial.", "4")).toBe(true);
    expect(leaks("The bridge is 40 spans long.", "4")).toBe(false);
    expect(leaks("Only 0.4 of a turn.", "4")).toBe(false);
  });
  it("a mimic statement's full text matches as a token sequence", () => {
    const mimic = "Doubling the amplitude doubles the period.";
    expect(leaks("Remember: doubling the amplitude doubles the period!", mimic)).toBe(true);
    expect(leaks("Doubling the amplitude changes nothing about timing.", mimic)).toBe(false);
    expect(leaks("anything", "")).toBe(false);
    expect(leakedValues("wait 4 seconds for π", ["π", "4", "7"])).toEqual(["π", "4"]);
  });
  it("bannedValuesFor reads answerVars through templateVars", () => {
    const e2 = trig.encounters.find((e) => e.id === "e2_period")!;
    const mode = getMode(e2.familyId, e2.mode)!;
    expect(bannedValuesFor(mode, e2.params, e2.solution)).toEqual(["π"]);
    const e6 = trig.encounters.find((e) => e.id === "e6_boss")!;
    expect(bannedValuesFor(getMode(e6.familyId, e6.mode)!, e6.params, e6.solution)).toEqual(["4"]);
    const e3 = trig.encounters.find((e) => e.id === "e3_amplitude")!;
    const banned = bannedValuesFor(getMode(e3.familyId, e3.mode)!, e3.params, e3.solution);
    expect(banned).toHaveLength(1);
    expect(leaks(banned[0]!, banned[0]!)).toBe(true);
    expect(bannedValuesFor(getMode(e3.familyId, e3.mode)!, null, null)).toEqual([]);
  });
});
