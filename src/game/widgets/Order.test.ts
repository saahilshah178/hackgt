import { describe, expect, it } from "vitest";
import { placedToInput } from "./Order";

describe("Order.placedToInput", () => {
  it("passes through the placed-slot keys in slot order", () => {
    expect(placedToInput(["s2", "s0", "s1"])).toEqual({ keys: ["s2", "s0", "s1"] });
  });
  it("handles an empty placement", () => {
    expect(placedToInput([])).toEqual({ keys: [] });
  });
});
