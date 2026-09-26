import { describe, expect, it } from "vitest";
import { averageValue } from "../src/mechanics/families/accumulator/average_value";
import { rateTotal } from "../src/mechanics/families/accumulator/rate_total";
import { signed } from "../src/mechanics/families/accumulator/signed";
import { reachState } from "../src/mechanics/families/simulator/reach_state";

describe("accumulator.signed", () => {
  const p = { expr: "x^2 - 4", a: "0", b: "3", ask: "net" as const };
  it("computes net area and catches the all-positive misconception", () => {
    expect(signed.check(p)).toEqual([]);
    const s = signed.resolve(p);
    expect(s.net).toBeCloseTo(-3, 3); // ∫0^3 (x²−4) = 9 − 12
    expect(s.above).toBeCloseTo(7 / 3, 2); // ∫2^3 (x²−4)
    expect(s.below).toBeCloseTo(16 / 3, 2); // −∫0^2 (x²−4)
    expect(signed.grade(p, signed.solutionInput(p, s)).correct).toBe(true);
    expect(signed.grade(p, { value: s.above + s.below, sign: null }).feedback).toMatch(/counted positive/);
    expect(signed.grade({ ...p, ask: "sign" }, { value: null, sign: "negative" }).correct).toBe(true);
    expect(signed.grade({ ...p, ask: "sign" }, { value: null, sign: "positive" }).feedback).toMatch(/counts NEGATIVE/);
    expect(signed.check({ ...p, expr: "x^2 + 1" }).join(" ")).toMatch(/nothing signed/);
  });
});

describe("accumulator.rate_total", () => {
  const p = { rateExpr: "4 - x/2", t0: "0", t1: "4", initial: "10", quantityName: "ore", unit: "kg" };
  it("adds the area under a changing rate to the starting amount", () => {
    expect(rateTotal.check(p)).toEqual([]);
    const s = rateTotal.resolve(p);
    expect(s.change).toBeCloseTo(12, 3); // ∫0^4 (4 − x/2) = 16 − 4
    expect(s.total).toBeCloseTo(22, 3);
    expect(rateTotal.grade(p, rateTotal.solutionInput(p, s)).correct).toBe(true);
    expect(rateTotal.grade(p, { value: 10 + 4 * 4 }).feedback).toMatch(/rate × time with a single rate/);
    expect(rateTotal.check({ ...p, rateExpr: "3" }).join(" ")).toMatch(/constant/);
  });
});

describe("accumulator.average_value", () => {
  const p = { expr: "x^2", a: "0", b: "3" };
  it("levels the reservoir and catches the endpoint-average misconception", () => {
    expect(averageValue.check(p)).toEqual([]);
    const s = averageValue.resolve(p);
    expect(s.average).toBeCloseTo(3, 3);
    expect(averageValue.grade(p, averageValue.solutionInput(p, s)).correct).toBe(true);
    expect(averageValue.grade(p, { value: 4.5 }).feedback).toMatch(/average of the two endpoint heights/);
    expect(averageValue.check({ ...p, expr: "2*x" }).join(" ")).toMatch(/endpoints equals/);
  });
});

describe("simulator.reach_state", () => {
  const p = {
    system: {
      variables: [{ name: "pop", initial: "100", unit: "cells", min: null, max: null }, { name: "r", initial: "1.1", unit: "", min: null, max: null }],
      rules: [{ target: "pop", expr: "pop * r" }],
      ticks: 10,
    },
    control: { variable: "r", min: "1", max: "2", step: "1/10" },
    target: { variable: "pop", value: "100 * 1.5^5", tolerance: "20" },
    atTick: 5,
  };
  it("finds the growth factor that hits the target at tick T and explains misses", () => {
    expect(reachState.check(p)).toEqual([]);
    const s = reachState.resolve(p);
    expect(s.value).toBeCloseTo(1.5, 6);
    expect(reachState.grade(p, reachState.solutionInput(p, s)).correct).toBe(true);
    const miss = reachState.grade(p, { value: 1.2 });
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/below the target/);
    expect(reachState.check({ ...p, target: { ...p.target, value: "1000000" } }).join(" ")).toMatch(/no dial position/);
    expect(reachState.check({ ...p, control: { ...p.control, variable: "nope" } }).join(" ")).toMatch(/not a system variable/);
  });
});
