import { describe, expect, it } from "vitest";
import { evalExact, evalExactAt, MAX_EXPRESSION_LENGTH } from "../src/mechanics/util";

describe("evalExact sandbox", () => {
  it("evaluates ordinary exact expressions", () => {
    expect(evalExact("5*pi/6")).toBeCloseTo((5 * Math.PI) / 6, 12);
    expect(evalExact("2^10")).toBe(1024);
    expect(evalExact("sqrt(2)/2")).toBeCloseTo(Math.SQRT2 / 2, 12);
    expect(evalExact("-3/4")).toBe(-0.75);
  });

  it("returns null for non-numbers, non-finite values and garbage", () => {
    expect(evalExact("1/0")).toBeNull();
    expect(evalExact("[1, 2]")).toBeNull();
    expect(evalExact("\"text\"")).toBeNull();
    expect(evalExact("2 +")).toBeNull();
    expect(evalExact("")).toBeNull();
  });

  it("refuses the functions that mutate the instance or evaluate code", () => {
    for (const expr of [
      "import({ pi: 3 }, { override: true }); pi",
      "createUnit(\"foo\"); 1",
      "evaluate(\"2+2\")",
      "parse(\"2+2\").evaluate()",
      "compile(\"2+2\").evaluate()",
      "simplify(\"2x+x\")",
      "derivative(\"x^2\", \"x\")",
    ]) {
      expect(evalExact(expr), expr).toBeNull();
    }
    // The sandbox must not have leaked: pi is still pi afterwards.
    expect(evalExact("pi")).toBeCloseTo(Math.PI, 12);
  });

  it("caps expression length", () => {
    expect(evalExact("1+".repeat(MAX_EXPRESSION_LENGTH) + "1")).toBeNull();
    expect(evalExact("1+".repeat(20) + "1")).toBe(21);
  });
});

describe("evalExactAt sandbox (free variables from a scope)", () => {
  it("evaluates expressions in x at a point", () => {
    expect(evalExactAt("3*sin(x)", { x: Math.PI / 2 })).toBeCloseTo(3, 12);
    expect(evalExactAt("2*sin(x) - 1", { x: Math.PI / 6 })).toBeCloseTo(0, 12);
    expect(evalExactAt("sin(2*t + c)", { t: Math.PI / 4, c: 0 })).toBeCloseTo(1, 12);
    expect(evalExactAt("pi/2", {})).toBeCloseTo(Math.PI / 2, 12);
  });

  it("returns null for unbound symbols, non-finite results and garbage", () => {
    expect(evalExactAt("3*sin(y)", { x: 1 })).toBeNull();
    expect(evalExactAt("1/x", { x: 0 })).toBeNull();
    expect(evalExactAt("tan(x) +", { x: 1 })).toBeNull();
    expect(evalExactAt("", { x: 1 })).toBeNull();
    expect(evalExactAt("f(x) = x^2", { x: 2 })).toBeNull();
  });

  it("rejects bad scopes instead of evaluating them", () => {
    expect(evalExactAt("x", { x: Number.NaN })).toBeNull();
    expect(evalExactAt("x", { x: Number.POSITIVE_INFINITY })).toBeNull();
    expect(evalExactAt("x", { "x-1": 1 } as Record<string, number>)).toBeNull();
    expect(evalExactAt("x", { x: "1" } as unknown as Record<string, number>)).toBeNull();
    const big: Record<string, number> = {};
    for (let i = 0; i < 9; i++) big[`v${i}`] = i;
    expect(evalExactAt("v0", big)).toBeNull();
    expect(evalExactAt("x", null as unknown as Record<string, number>)).toBeNull();
  });

  it("never leaks assignments into the caller's scope or later calls", () => {
    const scope = { x: 1 };
    expect(evalExactAt("x = 5", scope)).toBe(5);
    expect(scope).toEqual({ x: 1 });
    expect(evalExactAt("x", scope)).toBe(1);
    expect(evalExactAt("y", { x: 1 })).toBeNull();
  });

  it("keeps the same function blocklist and length cap as evalExact", () => {
    for (const expr of ["import({ pi: 3 }, { override: true }); pi", "evaluate(\"x+1\")", "parse(\"x\").evaluate()", "derivative(\"x^2\", \"x\")"]) {
      expect(evalExactAt(expr, { x: 1 }), expr).toBeNull();
    }
    expect(evalExactAt("pi", {})).toBeCloseTo(Math.PI, 12);
    expect(evalExactAt("x+".repeat(MAX_EXPRESSION_LENGTH) + "x", { x: 1 })).toBeNull();
  });
});
