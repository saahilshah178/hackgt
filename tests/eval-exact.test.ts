import { describe, expect, it } from "vitest";
import { evalExact, MAX_EXPRESSION_LENGTH } from "../src/mechanics/util";

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
