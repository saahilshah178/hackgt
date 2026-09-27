import { describe, expect, it } from "vitest";
import type { PolyPoint } from "@/world/geom";
import { carriageAt, coneAlphaFor, lensChipText, lensUFor, railLength, railLocal, railTangentAt, recordLensOf } from "./record-lens";

// civil e9: the rail follows the arch (civil §5.9 station block)
const ARCH: PolyPoint[] = [
  [1300, 900],
  [1600, 620],
  [2000, 420],
  [2400, 310],
  [2800, 280],
  [3200, 310],
  [3600, 420],
  [4000, 620],
  [4300, 900],
];
const E9 = {
  anchor: { x: 2800, y: 900 },
  accessories: [{ kind: "record_lens", rail: ARCH, carriage: "archive_of_voices.part.lens_carriage", cone: { target: [2800, 900], asset: "archive_of_voices.fx.projector_cone" } }],
};
const YEAR = { min: 1964.4167, max: 1965.6667, window: { start: 1964.4167, end: 1965.6667 }, format: "month_year" as const };

describe("record_lens accessory (civil §5.0.2)", () => {
  it("finds the station's record_lens (and nothing on e12, which has none)", () => {
    const spec = recordLensOf(E9);
    expect(spec?.rail).toHaveLength(9);
    expect(spec?.cone?.target).toEqual([2800, 900]);
    expect(recordLensOf({ accessories: [] })).toBeNull();
    expect(recordLensOf({})).toBeNull();
    expect(recordLensOf({ accessories: [{ kind: "record_lens", rail: [[0, 0]] }] })).toBeNull(); // a rail needs 2 points
  });
  it("maps the rail into the prefab root (container-local) and measures it", () => {
    const local = railLocal(ARCH, E9.anchor);
    expect(local[0]).toEqual([-1500, 0]);
    expect(local[4]).toEqual([0, -620]);
    expect(railLength([[0, 0], [300, 400]])).toBe(500);
  });
  it("u follows the probe through the window (clamped); the carriage rides the rail by arc length", () => {
    expect(lensUFor(YEAR, 1964.4167)).toBe(0);
    expect(lensUFor(YEAR, 1965.6667)).toBe(1);
    expect(lensUFor(YEAR, 1900)).toBe(0);
    expect(lensUFor(YEAR, 2000)).toBe(1);
    expect(lensUFor(YEAR, null)).toBeNull();
    expect(lensUFor(null, 1965)).toBeNull();
    const local = railLocal(ARCH, E9.anchor);
    const crown = carriageAt(local, 0.5); // the arch is symmetric: half its length is the crown
    expect(crown.x).toBeCloseTo(0, 5);
    expect(crown.y).toBeCloseTo(-620, 5);
    expect(carriageAt(local, 0)).toEqual({ x: -1500, y: 0 });
    expect(carriageAt(local, 2)).toEqual({ x: 1500, y: 0 });
  });
  it("the wheels follow the rail's tangent: climbing on the left of the arch, descending on the right", () => {
    const local = railLocal(ARCH, E9.anchor);
    expect(railTangentAt(local, 0.1)).toBeLessThan(0); // y down: climbing = negative angle
    expect(railTangentAt(local, 0.9)).toBeGreaterThan(0);
    expect(railTangentAt([[0, 0], [100, 0]], 0.5)).toBe(0);
  });
  it("the lens chip reads like the panel readout; the cone glows only while live", () => {
    expect(lensChipText({ format: "month_year" }, 1965 + 2 / 12)).toBe("MAR 1965");
    expect(lensChipText({ format: "year" }, 1965.5)).toBe("1965");
    expect(lensChipText({ format: "number" }, 3)).toBeNull();
    expect(lensChipText(null, 1965)).toBeNull();
    expect(coneAlphaFor("dormant")).toBe(0);
    expect(coneAlphaFor("active")).toBeCloseTo(0.35);
    expect(coneAlphaFor("awake")).toBeLessThan(coneAlphaFor("active"));
  });
});
