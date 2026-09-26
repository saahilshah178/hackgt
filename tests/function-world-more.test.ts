import { describe, expect, it } from "vitest";
import { asymptote } from "../src/mechanics/families/function_world/asymptote";
import { continuity } from "../src/mechanics/families/function_world/continuity";
import { roots } from "../src/mechanics/families/function_world/roots";

const whole = (expr: string) => [{ expr, from: "-inf", to: "inf", openLeft: true, openRight: true }];

describe("function_world.roots", () => {
  const p = { pieces: whole("x^2 - 4"), xMin: "-5", xMax: "5" };
  it("finds every sign change and grades marks with tolerance", () => {
    expect(roots.check(p)).toEqual([]);
    const s = roots.resolve(p);
    expect(s.roots.map((r) => Math.round(r * 1000) / 1000)).toEqual([-2, 2]);
    expect(roots.grade(p, roots.solutionInput(p, s)).correct).toBe(true);
    expect(roots.grade(p, { xs: [2.1] }).feedback).toMatch(/crosses sea level more often/);
    expect(roots.grade(p, { xs: [0, 2] }).feedback).toMatch(/isn't at sea level.*below/);
    expect(roots.check({ ...p, pieces: whole("x^2 + 1") }).join(" ")).toMatch(/no root/);
    expect(roots.check({ ...p, pieces: whole("(x-1)*(x-1.1)") }).join(" ")).toMatch(/too close|rounded/);
  });
});

describe("function_world.asymptote", () => {
  it("reads horizontal asymptotes, blow-ups, and rejects oscillation", () => {
    const p = { pieces: whole("(2*x + 1)/(x - 3)"), direction: "pos_inf" as const, xMin: "4", xMax: "40" };
    expect(asymptote.check(p)).toEqual([]);
    const s = asymptote.resolve(p);
    expect(s.kind).toBe("value");
    expect(s.value).toBeCloseTo(2, 3);
    expect(asymptote.grade(p, asymptote.solutionInput(p, s)).correct).toBe(true);
    expect(asymptote.grade(p, { kind: "pos_infinity", value: null }).feedback).toMatch(/keeps flattening/);
    expect(asymptote.grade(p, { kind: "value", value: 5 }).feedback).toMatch(/different level/);
    const blow = { ...p, pieces: whole("x^2/(x+1)") };
    expect(asymptote.resolve(blow).kind).toBe("pos_infinity");
    expect(asymptote.check({ ...p, pieces: whole("sin(x)") }).join(" ")).toMatch(/does not settle/);
    expect(asymptote.resolve({ ...p, pieces: whole("2 + sin(x)/x") }).value).toBeCloseTo(2, 3); // crosses its asymptote
  });
});

describe("function_world.continuity", () => {
  const jumpPieces = [
    { expr: "x", from: "-inf", to: "1", openLeft: true, openRight: true },
    { expr: "x + 2", from: "1", to: "inf", openLeft: false, openRight: true },
  ];
  it("finds holes, jumps and blow-ups", () => {
    const p = { pieces: [...jumpPieces], overrides: [{ x: "-1", y: null }], xMin: "-3", xMax: "4", ask: "find" as const, a: "0" };
    expect(continuity.check(p)).toEqual([]);
    const s = continuity.resolve(p);
    expect(s.breaks.map((b) => [b.x, b.kind])).toEqual([[-1, "removable"], [1, "jump"]]);
    expect(continuity.grade(p, continuity.solutionInput(p, s)).correct).toBe(true);
    expect(continuity.grade(p, { xs: [1], kind: null, y: null }).feedback).toMatch(/hole or misplaced tile/);
    expect(continuity.grade(p, { xs: [1, 2.5], kind: null, y: null }).feedback).toMatch(/rolls straight through/);
  });
  it("classifies the break at a and repairs a removable one", () => {
    const cls = { pieces: [...jumpPieces], overrides: [], xMin: "-3", xMax: "4", ask: "classify" as const, a: "1" };
    expect(continuity.check(cls)).toEqual([]);
    expect(continuity.resolve(cls).kindAtA).toBe("jump");
    expect(continuity.grade(cls, { xs: null, kind: "removable", y: null }).feedback).toMatch(/different heights/);
    const rep = { pieces: whole("(x^2 - 4)/(x - 2)"), overrides: [{ x: "2", y: null }], xMin: "-1", xMax: "5", ask: "repair" as const, a: "2" };
    expect(continuity.check(rep)).toEqual([]);
    const s = continuity.resolve(rep);
    expect(s.repairValue).toBeCloseTo(4, 3);
    expect(continuity.grade(rep, continuity.solutionInput(rep, s)).correct).toBe(true);
    expect(continuity.grade(rep, { xs: null, kind: null, y: 7 }).feedback).toMatch(/above/);
    expect(continuity.check({ ...rep, a: "3" }).join(" ")).toMatch(/already continuous/);
    expect(continuity.check({ ...cls, ask: "repair" }).join(" ")).toMatch(/jump, not removable/);
    const inf = { pieces: whole("1/(x-2)"), overrides: [{ x: "2", y: null }], xMin: "0", xMax: "4", ask: "classify" as const, a: "2" };
    expect(continuity.resolve(inf).kindAtA).toBe("infinite");
  });
});
