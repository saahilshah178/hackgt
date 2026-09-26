import { describe, expect, it } from "vitest";
import { segmentCenterX, segmentIndexAt, segmentX, totalStripWidth, SEGMENT_WIDTH } from "./layout";

describe("platformer layout", () => {
  it("places segments left to right with no overlap", () => {
    expect(segmentX(0)).toBe(0);
    expect(segmentX(1)).toBe(SEGMENT_WIDTH);
    expect(segmentX(3)).toBe(3 * SEGMENT_WIDTH);
  });

  it("centers an obstacle in the middle of its segment", () => {
    expect(segmentCenterX(0)).toBe(SEGMENT_WIDTH / 2);
    expect(segmentCenterX(2)).toBe(2 * SEGMENT_WIDTH + SEGMENT_WIDTH / 2);
  });

  it("computes total strip width for the camera/world bounds", () => {
    expect(totalStripWidth(5)).toBe(5 * SEGMENT_WIDTH);
    expect(totalStripWidth(0)).toBe(0);
  });

  it("maps an x position back to its segment index, clamped to the strip", () => {
    expect(segmentIndexAt(0, 5)).toBe(0);
    expect(segmentIndexAt(SEGMENT_WIDTH + 10, 5)).toBe(1);
    expect(segmentIndexAt(-50, 5)).toBe(0);
    expect(segmentIndexAt(SEGMENT_WIDTH * 10, 5)).toBe(4);
    expect(segmentIndexAt(10, 0)).toBe(0);
  });
});
