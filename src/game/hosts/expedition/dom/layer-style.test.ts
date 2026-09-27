import { describe, expect, it } from "vitest";
import { BLEND_ALPHA, domLayerAlpha } from "./layer-style";

describe("DOM layer blend stand-in (§2.11 frame budget)", () => {
  it("normal layers keep their alpha; blended layers trade the blend for a lower alpha", () => {
    expect(domLayerAlpha("normal", 0.7)).toBe(0.7);
    expect(domLayerAlpha(undefined, 1)).toBe(1);
    expect(domLayerAlpha("add", 0.12)).toBeCloseTo(0.12 * BLEND_ALPHA.add, 3);
    expect(domLayerAlpha("multiply", 0.25)).toBeLessThan(0.25);
    expect(domLayerAlpha("screen", 0.5)).toBeLessThan(0.5);
  });
  it("clamps to [0, 1]", () => {
    expect(domLayerAlpha("normal", 1.4)).toBe(1);
    expect(domLayerAlpha("add", -1)).toBe(0);
  });
});
