import { describe, expect, it } from "vitest";
import type { GameSpec } from "../../../../contracts/gamespec";
import trig from "../../../../../fixtures/trig-dungeon.json";
import { stationSeed, viewsFor } from "./views";

describe("views", () => {
  const spec = trig as unknown as GameSpec;
  it("presents each encounter once with spec.seed + index", () => {
    const v = viewsFor(spec);
    const a = v("e2_period");
    expect(a).toBeTruthy();
    expect(v("e2_period")).toBe(a); // memoized identity (D5)
    expect(v("nope")).toBeNull();
  });
  it("station seeds differ per encounter and are stable", () => {
    expect(stationSeed(spec.seed, "e1_radians")).toBe(stationSeed(spec.seed, "e1_radians"));
    expect(stationSeed(spec.seed, "e1_radians")).not.toBe(stationSeed(spec.seed, "e2_period"));
  });
});
