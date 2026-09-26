import { describe, expect, it } from "vitest";
import { curve } from "../src/mechanics/families/tuner/curve";
import { optimize } from "../src/mechanics/families/tuner/optimize";

describe("tuner.curve", () => {
  const line = { template: "linear" as const, target: [{ name: "m", value: "2" }, { name: "b", value: "-1" }], ranges: [{ name: "m", min: -5, max: 5 }, { name: "b", min: -5, max: 5 }], xMin: "0", xMax: "6" };
  it("derives one checkpoint per parameter and grades by passing through them", () => {
    expect(curve.check(line)).toEqual([]);
    const s = curve.resolve(line);
    expect(s.checkpoints).toEqual([{ x: 2, y: 3 }, { x: 4, y: 7 }]);
    expect(curve.grade(line, curve.solutionInput(line, s)).correct).toBe(true);
    expect(curve.grade(line, { values: [{ name: "m", value: 0.5 }, { name: "b", value: 2 }] }).feedback).toMatch(/slope m/);
    expect(curve.grade(line, { values: [{ name: "m", value: 2 }] }).feedback).toMatch(/Set every parameter/);
  });
  it("supports vertex-form quadratics and exponentials and rejects targets near the range edge", () => {
    const vertex = { template: "quadratic_vertex" as const, target: [{ name: "a", value: "1/2" }, { name: "h", value: "3" }, { name: "k", value: "-2" }], ranges: [{ name: "a", min: -3, max: 3 }, { name: "h", min: -6, max: 6 }, { name: "k", min: -6, max: 6 }], xMin: "-2", xMax: "8" };
    expect(curve.check(vertex)).toEqual([]);
    expect(curve.grade(vertex, curve.solutionInput(vertex, curve.resolve(vertex))).correct).toBe(true);
    const expo = { template: "exponential" as const, target: [{ name: "a", value: "3" }, { name: "b", value: "2" }], ranges: [{ name: "a", min: 0, max: 10 }, { name: "b", min: 0.5, max: 4 }], xMin: "0", xMax: "4" };
    expect(curve.check(expo)).toEqual([]);
    expect(curve.check({ ...line, target: [{ name: "m", value: "4.9" }, { name: "b", value: "0" }] }).join(" ")).toMatch(/well inside its range/);
    expect(curve.check({ ...line, target: [{ name: "m", value: "2" }, { name: "c", value: "1" }] }).join(" ")).toMatch(/needs exactly the parameters/);
  });
});

describe("tuner.optimize", () => {
  const p = { objective: "x * (12 - x)", goal: "max" as const, xMin: "0", xMax: "12", inputName: "workers", outputName: "output per hour" };
  it("finds the interior optimum and gives directional, marginal feedback", () => {
    expect(optimize.check(p)).toEqual([]);
    const s = optimize.resolve(p);
    expect(s.x).toBeCloseTo(6, 3);
    expect(s.value).toBeCloseTo(36, 3);
    expect(optimize.grade(p, optimize.solutionInput(p, s)).correct).toBe(true);
    const miss = optimize.grade(p, { x: 2 });
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/44% below the best.*Nudge workers higher/);
    expect(optimize.grade(p, { x: 12 }).feedback).toMatch(/lower/);
  });
  it("rejects non-unimodal objectives and endpoint optima", () => {
    expect(optimize.check({ ...p, objective: "sin(x)" }).join(" ")).toMatch(/unimodal/);
    expect(optimize.check({ ...p, objective: "x" }).join(" ")).toMatch(/endpoint/);
    expect(optimize.check({ ...p, goal: "min", objective: "(x-5)^2" })).toEqual([]);
    expect(optimize.resolve({ ...p, goal: "min", objective: "(x-5)^2" }).x).toBeCloseTo(5, 3);
    expect(optimize.check({ ...p, objective: "1/(x-3)" }).join(" ")).toMatch(/finite/);
  });
});
