import { describe, expect, it } from "vitest";
import { buildSurfaces, heightAt, mergeHeightfield, spanOf, surfaceBelow, surfaceIds, yOnLine, lineOf } from "./surfaces";
import { reqCtxOf, EMPTY_WORLD_STATE } from "./requirements";
import { TEST_ZONE } from "./test-zone";

const bridgeStation = {
  encounterId: "e1",
  zoneId: "z_test",
  payoff: { terrain: [{ surface: "ground", points: [[2380, 640], [2800, 640]] as [number, number][] }] },
};
const platformStation = {
  encounterId: "e3",
  zoneId: "z_test",
  payoff: { terrain: [{ surface: "stairs", points: [[1200, 500], [1100, 560]] as [number, number][] }] },
};

describe("surfaces", () => {
  it("interpolates a polyline and returns null outside its span", () => {
    const pts = [[0, 100], [100, 200]] as const;
    expect(yOnLine(pts, 50)).toBe(150);
    expect(yOnLine(pts, -1)).toBeNull();
    expect(yOnLine(pts, 101)).toBeNull();
    expect(yOnLine([], 3)).toBeNull();
    expect(yOnLine([[5, 1], [5, 9]], 5)).toBe(9);
  });

  it("merges payoff terrain into the heightfield over its span", () => {
    const merged = mergeHeightfield([[0, 0], [10, 0], [20, 50], [30, 0]], [[12, 5], [25, 5]]);
    expect(merged).toEqual([[0, 0], [10, 0], [12, 5], [25, 5], [30, 0]]);
    expect(mergeHeightfield([[0, 0], [1, 1]], [[5, 5]])).toEqual([[0, 0], [1, 1]]);
    // duplicate x values in a patch are dropped to keep x strictly ascending
    expect(mergeHeightfield([[0, 0], [40, 0]], [[10, 1], [10, 2], [20, 3]])).toEqual([[0, 0], [10, 1], [20, 3], [40, 0]]);
  });

  it("activates platforms by requirement and merges solved payoff terrain", () => {
    const before = buildSurfaces(TEST_ZONE, reqCtxOf([], EMPTY_WORLD_STATE), [bridgeStation, platformStation]);
    expect(surfaceIds(before)).toEqual(["ground", "ledge"]);
    expect(heightAt(before, "ground", 2600)).toBe(960);
    expect(before.merged).toEqual([]);
    const after = buildSurfaces(TEST_ZONE, reqCtxOf(["e1", "e2", "e3"], EMPTY_WORLD_STATE), [bridgeStation, platformStation]);
    expect(heightAt(after, "ground", 2600)).toBe(640); // the bridge replaced the chasm floor
    expect(heightAt(after, "ground", 2900)).toBe(800); // the patch end joins the old floor at 3000
    expect(heightAt(after, "ground", 3000)).toBe(960);
    expect(surfaceIds(after)).toEqual(["ground", "ledge", "gated", "stairs"]);
    expect(lineOf(after, "stairs")?.points[0][0]).toBe(1100); // sorted
    expect(lineOf(after, "stairs")?.payoffOf).toBe("e3");
    expect(after.merged).toEqual(["e1", "e3"]);
    // a station in another zone or unsolved does nothing
    const other = buildSurfaces(TEST_ZONE, reqCtxOf(["e9"], EMPTY_WORLD_STATE), [{ ...bridgeStation, encounterId: "e9", zoneId: "elsewhere" }]);
    expect(other.merged).toEqual([]);
  });

  it("reports spans and inactive surfaces", () => {
    const m = buildSurfaces(TEST_ZONE, reqCtxOf([], EMPTY_WORLD_STATE), []);
    expect(spanOf(m, "ledge")).toEqual([400, 700]);
    expect(spanOf(m, "gated")).toBeNull();
    expect(heightAt(m, "gated", 3200)).toBeNull();
    expect(heightAt(m, "ledge", 800)).toBeNull();
  });

  it("finds the surface below a point, falling back to the ground", () => {
    const m = buildSurfaces(TEST_ZONE, reqCtxOf([], EMPTY_WORLD_STATE), []);
    expect(surfaceBelow(m, 500, 100)).toEqual({ surface: "ledge", y: 600 });
    expect(surfaceBelow(m, 500, 700)).toEqual({ surface: "ground", y: 800 });
    expect(surfaceBelow(m, 5000, 0).surface).toBe("ground");
  });
});
