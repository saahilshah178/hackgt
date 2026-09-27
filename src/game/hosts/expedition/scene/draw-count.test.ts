import { describe, expect, it } from "vitest";
import { countDrawn, type DrawNode } from "./draw-count";

describe("draw-object count (§2.11 budget metric)", () => {
  it("counts visible leaves through nested containers", () => {
    const leaf = (extra: Partial<DrawNode> = {}): DrawNode => ({ visible: true, alpha: 1, ...extra });
    const station: DrawNode = { visible: true, list: [leaf(), leaf(), { visible: true, list: [leaf(), leaf({ visible: false })] }] };
    expect(countDrawn([leaf(), station, leaf({ alpha: 0 })])).toBe(4);
  });
  it("a hidden or transparent container hides its subtree; an empty list counts nothing", () => {
    expect(countDrawn([{ visible: false, list: [{}, {}] }, { alpha: 0, list: [{}] }, { list: [] }])).toBe(0);
    expect(countDrawn(undefined)).toBe(0);
    expect(countDrawn([{}, {}])).toBe(2); // Phaser objects default to visible
  });
});
