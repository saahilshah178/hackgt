import { describe, expect, it } from "vitest";
import { approach, EASE, lerpAngle, lerpRecord, smoothingFactor, snap } from "./ease";
import {
  isStrictlyAscending,
  pointAlong,
  pointOnCircle,
  polylineYAt,
  rectContainsRect,
  rectsIntersect,
  rectUnion,
  wrapAngle,
} from "./geom";

describe("geom", () => {
  it("places points on a y-down circle as C + r(cos θ, −sin θ)", () => {
    const c = { x: 100, y: 200 };
    expect(pointOnCircle(c, 10, 0)).toEqual({ x: 110, y: 200 });
    const up = pointOnCircle(c, 10, Math.PI / 2);
    expect(up.x).toBeCloseTo(100, 9);
    expect(up.y).toBeCloseTo(190, 9);
  });

  it("interpolates heightfields and walks polylines by arc length", () => {
    const g = [
      [0, 1440],
      [1780, 1440],
      [1800, 1287],
    ] as const;
    expect(isStrictlyAscending(g)).toBe(true);
    expect(polylineYAt(g, 890)).toBe(1440);
    expect(polylineYAt(g, 1790)).toBeCloseTo(1363.5, 6);
    expect(polylineYAt(g, 2000)).toBeNull();
    expect(pointAlong([[0, 0], [10, 0], [10, 10]], 0.75)).toEqual({ x: 10, y: 5 });
  });

  it("wraps angles into (−π, π] and combines rectangles", () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI, 12);
    const u = rectUnion({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: -5, w: 10, h: 10 });
    expect(u).toEqual({ x: 0, y: -5, w: 15, h: 15 });
    expect(rectContainsRect(u, { x: 1, y: 1, w: 2, h: 2 })).toBe(true);
    expect(rectsIntersect({ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 })).toBe(false);
  });
});

describe("ease", () => {
  it("anchors every curve at 0 and 1", () => {
    for (const [name, f] of Object.entries(EASE)) {
      expect(f(0), name).toBeCloseTo(0, 9);
      expect(f(1), name).toBeCloseTo(1, 9);
    }
  });

  it("smooths with τ = 110 ms (95 % in about 330 ms) and snaps discrete fields at 0.5", () => {
    let v = 0;
    for (let t = 0; t < 330; t += 16.5) v = approach(v, 1, 16.5);
    expect(v).toBeGreaterThan(0.94);
    expect(smoothingFactor(0)).toBe(0);
    expect(snap("a", "b", 0.49)).toBe("a");
    expect(snap("a", "b", 0.5)).toBe("b");
    expect(lerpRecord({ n: 0, on: false }, { n: 10, on: true }, 0.25)).toEqual({ n: 2.5, on: false });
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI, 1);
  });
});
