import { describe, expect, it } from "vitest";
import { EmblemGlyph } from "../../../contracts/world";
import { EMBLEM_GLYPHS, arcPath, brokenRing, emblemRings, glyphPath, polar } from "./emblem-glyphs";

describe("emblem glyphs", () => {
  it("has one short path per EmblemGlyph", () => {
    for (const g of EmblemGlyph.options) {
      const d = EMBLEM_GLYPHS[g];
      expect(d, g).toMatch(/^M/);
      expect(d.split(/(?=M)/).length, g).toBeLessThanOrEqual(12);
      expect(d).not.toMatch(/NaN|undefined/);
    }
    expect(Object.keys(EMBLEM_GLYPHS).sort()).toEqual([...EmblemGlyph.options].sort());
    expect(glyphPath("nope")).toBe(EMBLEM_GLYPHS.labyrinth);
  });

  it("polar 0° is the top, clockwise", () => {
    const [x, y] = polar(10, 10, 5, 0);
    expect(x).toBeCloseTo(10);
    expect(y).toBeCloseTo(5);
    const [x2, y2] = polar(10, 10, 5, 90);
    expect(x2).toBeCloseTo(15);
    expect(y2).toBeCloseTo(10);
  });

  it("broken rings have one arc per gap; 0 gaps is a whole ring", () => {
    expect(brokenRing(32, 32, 20, 0)).toHaveLength(1);
    expect(brokenRing(32, 32, 20, 3)).toHaveLength(3);
    expect(arcPath(0, 0, 1, 0, 360)).toContain("A");
    const rings = emblemRings(64, 2);
    expect(rings.map((r) => r.role)).toEqual(["outer", "middle", "inner"]);
    expect(rings[1].arcs).toHaveLength(2);
    expect(rings[2].arcs).toHaveLength(2);
    expect(rings[0].r).toBeGreaterThan(rings[1].r);
  });
});
