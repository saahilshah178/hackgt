import { describe, expect, it } from "vitest";
import { buildRapidQueue, clozeTextToInput, isRapidView, rapidAnswersToInput } from "./Type";

describe("Type.isRapidView", () => {
  it("detects the rapid view by its order/prompts shape", () => {
    expect(isRapidView({ direction: "d", secondsPerItem: 5, order: [0, 1], prompts: [] })).toBe(true);
    expect(isRapidView({ before: "a", after: "b", bank: [] })).toBe(false);
  });
});

describe("Type.buildRapidQueue", () => {
  it("starts from the shuffled first-pass order", () => {
    expect(buildRapidQueue([2, 0, 1])).toEqual([2, 0, 1]);
  });
});

describe("Type.rapidAnswersToInput", () => {
  it("wraps the last-attempt-per-item map as {itemIndex, text} pairs", () => {
    const last = new Map([
      [0, "gato"],
      [2, "perro"],
    ]);
    expect(rapidAnswersToInput(last)).toEqual({ answers: [{ itemIndex: 0, text: "gato" }, { itemIndex: 2, text: "perro" }] });
  });
});

describe("Type.clozeTextToInput", () => {
  it("wraps the typed filler", () => {
    expect(clozeTextToInput("osmosis")).toEqual({ text: "osmosis" });
  });
});
