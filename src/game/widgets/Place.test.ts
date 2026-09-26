import { describe, expect, it } from "vitest";
import { isLimitView, isPlaneView, limitToInput, numberLineToInput, planeToInput } from "./Place";

describe("Place.numberLineToInput / planeToInput", () => {
  it("wraps a number-line value", () => {
    expect(numberLineToInput(3.14)).toEqual({ value: 3.14 });
  });
  it("wraps plane coordinates", () => {
    expect(planeToInput(2, -1)).toEqual({ x: 2, y: -1 });
  });
});

describe("Place.limitToInput", () => {
  it("carries the value only when kind is 'value'", () => {
    expect(limitToInput("value", 4)).toEqual({ kind: "value", value: 4 });
  });
  it("nulls the value for dne/±infinity kinds", () => {
    expect(limitToInput("dne", 4)).toEqual({ kind: "dne", value: null });
    expect(limitToInput("pos_infinity", null)).toEqual({ kind: "pos_infinity", value: null });
    expect(limitToInput("neg_infinity", null)).toEqual({ kind: "neg_infinity", value: null });
  });
});

describe("Place view-shape detection", () => {
  it("distinguishes number_line, plane, and limit views", () => {
    const numberLine = { scale: "linear" as const, min: 0, max: 1, target: "", landmarks: [] };
    const plane = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, gridStep: 1, xLabel: "x", yLabel: "y", labels: "decimal" as const, overlay: "", target: "" };
    const limit = {
      a: 0,
      side: "both" as const,
      xMin: -1,
      xMax: 1,
      yMin: -1,
      yMax: 1,
      samples: [],
      at: { x: 0, y: null, defined: false },
      pieces: [],
    };
    expect(isPlaneView(numberLine)).toBe(false);
    expect(isPlaneView(plane)).toBe(true);
    expect(isLimitView(limit)).toBe(true);
    expect(isLimitView(numberLine)).toBe(false);
  });
});
