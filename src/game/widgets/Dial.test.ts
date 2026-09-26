import { describe, expect, it } from "vitest";
import { dialToInput } from "./Dial";

describe("Dial.dialToInput", () => {
  it("wraps the slider's numeric value, for both the oscillator and formula variants", () => {
    expect(dialToInput(12.5)).toEqual({ value: 12.5 });
  });
});
