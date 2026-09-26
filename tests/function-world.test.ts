import { describe, expect, it } from "vitest";
import { limit } from "../src/mechanics/families/function_world/limit";
import { compileFunction, sideLimit } from "../src/mechanics/families/function_world/shared";

const base = { xMin: "-1", xMax: "5", side: "both" as const, overrides: [] as { x: string; y: string | null }[] };
const whole = (expr: string) => [{ expr, from: "-inf", to: "inf", openLeft: true, openRight: true }];

describe("function_world.limit", () => {
  it("approach_target: a continuous function's limit equals f(a)", () => {
    const p = { ...base, pieces: whole("x^2 - 1"), a: "2" };
    expect(limit.check(p)).toEqual([]);
    const s = limit.resolve(p);
    expect(s.kind).toBe("value");
    expect(s.value).toBeCloseTo(3, 4);
    expect(s.fa).toBeCloseTo(3, 9);
    expect(limit.grade(p, limit.solutionInput(p, s)).correct).toBe(true);
    expect(limit.grade(p, { kind: "dne", value: null }).feedback).toMatch(/definite height/);
  });

  it("broken_tile: a hole at a still has a limit; f(a) is undefined", () => {
    const p = { ...base, pieces: whole("(x^2 - 4)/(x - 2)"), a: "2", overrides: [{ x: "2", y: null }] };
    expect(limit.check(p)).toEqual([]);
    const s = limit.resolve(p);
    expect(s.kind).toBe("value");
    expect(s.value).toBeCloseTo(4, 3);
    expect(s.faDefined).toBe(false);
    expect(limit.templateVars(p, s)).toMatchObject({ fa: "undefined", limit: "4" });
    expect(limit.present(p, 0).at).toEqual({ x: 2, y: null, defined: false });
  });

  it("decoy_destination: the tile at a sits elsewhere; landing on it is the classic miss", () => {
    const p = { ...base, pieces: whole("x + 1"), a: "2", overrides: [{ x: "2", y: "7" }] };
    expect(limit.check(p)).toEqual([]);
    const s = limit.resolve(p);
    expect(s.value).toBeCloseTo(3, 4);
    expect(s.fa).toBe(7);
    const miss = limit.grade(p, { kind: "value", value: 7 });
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/tile AT x = 2/);
    expect(limit.grade(p, { kind: "value", value: 3.05 }).correct).toBe(true);
  });

  it("split_gate: a jump gives DNE from both sides but a value from one side", () => {
    const pieces = [
      { expr: "1", from: "-inf", to: "2", openLeft: true, openRight: true },
      { expr: "3", from: "2", to: "inf", openLeft: false, openRight: true },
    ];
    const both = { ...base, pieces, a: "2" };
    expect(limit.check(both)).toEqual([]);
    expect(limit.resolve(both)).toMatchObject({ kind: "dne", left: { kind: "value", value: 1 }, right: { kind: "value", value: 3 }, fa: 3 });
    expect(limit.grade(both, { kind: "dne", value: null }).correct).toBe(true);
    expect(limit.grade(both, { kind: "value", value: 3 }).feedback).toMatch(/don't meet/);
    const left = { ...both, side: "left" as const };
    expect(limit.resolve(left)).toMatchObject({ kind: "value", value: 1 });
  });

  it("runaway_elevator: an infinite limit is unbounded, not a large number", () => {
    const p = { ...base, pieces: whole("1/(x-2)^2"), a: "2", overrides: [{ x: "2", y: null }] };
    expect(limit.check(p)).toEqual([]);
    const s = limit.resolve(p);
    expect(s.kind).toBe("pos_infinity");
    expect(s.label).toBe("+∞");
    expect(limit.grade(p, { kind: "value", value: 1e6 }).feedback).toMatch(/unbounded/);
    expect(limit.grade(p, limit.solutionInput(p, s)).correct).toBe(true);
    const one = { ...base, pieces: whole("1/(x-2)"), a: "2", overrides: [{ x: "2", y: null }] };
    expect(limit.resolve(one).kind).toBe("dne"); // +∞ from the right, −∞ from the left
  });

  it("rejects bad params with actionable problems", () => {
    expect(limit.check({ ...base, pieces: whole("x"), a: "9" }).join(" ")).toMatch(/strictly inside/);
    expect(limit.check({ ...base, pieces: whole("x"), a: "2.0001" }).join(" ")).toMatch(/rounded decimal/);
    expect(limit.check({ ...base, pieces: whole("x +* 2"), a: "2" }).join(" ")).toMatch(/not a valid mathjs/);
    expect(limit.check({ ...base, pieces: [{ expr: "x", from: "-inf", to: "1", openLeft: true, openRight: true }], a: "2" }).join(" ")).toMatch(/undefined or oscillating/);
    expect(limit.check({ ...base, pieces: whole("x + 1"), a: "2", overrides: [{ x: "2", y: "3" }] }).join(" ")).toMatch(/neither a hole nor a decoy/);
    const overlapping = [
      { expr: "x", from: "-inf", to: "3", openLeft: true, openRight: true },
      { expr: "2x", from: "1", to: "inf", openLeft: true, openRight: true },
    ];
    expect(limit.check({ ...base, pieces: overlapping, a: "2" }).join(" ")).toMatch(/overlap/);
  });

  it("samples the path for the plotter with gaps where undefined", () => {
    const p = { ...base, pieces: whole("1/(x-2)^2"), a: "2", overrides: [{ x: "2", y: null }] };
    const view = limit.present(p, 0);
    expect(view.samples.length).toBeGreaterThan(200);
    expect(view.samples.some((s) => s.y === null)).toBe(true); // the blow-up is clipped
    expect(view.yMax).toBeGreaterThan(view.yMin);
  });

  it("sideLimit converges for sin(x)/x at 0", () => {
    const f = compileFunction(whole("sin(x)/x"), [{ x: "0", y: null }]);
    expect(sideLimit(f, 0, "left")).toMatchObject({ kind: "value" });
    expect((sideLimit(f, 0, "right") as { value: number }).value).toBeCloseTo(1, 4);
  });
});
