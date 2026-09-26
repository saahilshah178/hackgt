import { describe, expect, it } from "vitest";
import { secant } from "../src/mechanics/families/function_world/secant";
import { composition } from "../src/mechanics/families/transformer/composition";

const whole = (expr: string) => [{ expr, from: "-inf", to: "inf", openLeft: true, openRight: true }];

describe("transformer.composition", () => {
  const numeric = {
    kind: "numeric" as const,
    machines: [
      { id: "double", label: "Doubler", expr: "2*x", consumes: [], produces: [] },
      { id: "add3", label: "Add three", expr: "x + 3", consumes: [], produces: [] },
    ],
    input: "5",
    target: "16",
  };
  it("finds the unique numeric order and explains f∘g ≠ g∘f", () => {
    expect(composition.check(numeric)).toEqual([]);
    const s = composition.resolve(numeric);
    expect(s.order).toEqual(["add3", "double"]); // (5+3)*2 = 16, not 2*5+3 = 13
    expect(composition.grade(numeric, composition.solutionInput(numeric, s)).correct).toBe(true);
    expect(composition.grade(numeric, { order: ["double", "add3"] }).feedback).toMatch(/Add three: 10 → 13/);
    expect(composition.check({ ...numeric, target: "13", machines: [numeric.machines[0], { ...numeric.machines[1], expr: "x + 3" }] }).join(" ")).not.toMatch(/orderings/);
    expect(composition.check({ ...numeric, machines: [numeric.machines[0], { ...numeric.machines[1], expr: "x * 1" }], target: "10" }).join(" ")).toMatch(/2 orderings/);
  });
  it("orders resource stations (photosynthesis) and stalls a station whose inputs are missing", () => {
    const p = {
      kind: "resources" as const,
      machines: [
        { id: "calvin", label: "Calvin cycle", expr: "", consumes: ["co2", "atp", "nadph"], produces: ["glucose"] },
        { id: "absorb", label: "Chlorophyll absorbs light", expr: "", consumes: ["light"], produces: ["excited_electrons"] },
        { id: "light", label: "Light reactions", expr: "", consumes: ["excited_electrons", "water"], produces: ["atp", "nadph", "oxygen"] },
      ],
      input: "light,water,co2",
      target: "glucose",
    };
    expect(composition.check(p)).toEqual([]);
    const s = composition.resolve(p);
    expect(s.order).toEqual(["absorb", "light", "calvin"]);
    expect(composition.grade(p, { order: ["calvin", "absorb", "light"] }).feedback).toMatch(/stalls, missing atp, nadph/);
    expect(composition.grade(p, composition.solutionInput(p, s)).correct).toBe(true);
    const loose = { ...p, machines: [p.machines[0], { ...p.machines[1], consumes: [], produces: ["co2"] }, { ...p.machines[2], consumes: ["water"] }] };
    expect(composition.check(loose).join(" ")).toMatch(/\d+ orderings reach the target/);
  });
});

describe("function_world.secant", () => {
  const p = { pieces: whole("x^2"), a: "3", windows: ["2", "1", "1/2", "1/10"], xMin: "0", xMax: "6", quantity: "position (m)" };
  it("converges the secant slopes to the derivative and names an average-rate answer", () => {
    expect(secant.check(p)).toEqual([]);
    const s = secant.resolve(p);
    expect(s.derivative).toBeCloseTo(6, 3);
    expect(s.secants.map((x) => x.slope)).toEqual([8, 7, 6.5, 6.1]);
    expect(secant.grade(p, secant.solutionInput(p, s)).correct).toBe(true);
    expect(secant.grade(p, { value: 7 }).feedback).toMatch(/AVERAGE rate over a window of 1/);
    expect(secant.grade(p, { value: 2 }).feedback).toMatch(/head higher/);
    expect(secant.check({ ...p, pieces: whole("3*x + 1") }).join(" ")).toMatch(/linear/);
    expect(secant.check({ ...p, windows: ["1", "2"] }).join(" ")).toMatch(/largest first/);
  });
});
