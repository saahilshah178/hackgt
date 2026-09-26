import { describe, expect, it } from "vitest";
import {
  bendCount,
  bowPath,
  catenaryPath,
  createRope,
  manhattanPath,
  pathLength,
  pinRope,
  pointAt,
  resample,
  roundCorners,
  ropePath,
  sagPath,
  settleRope,
  subPath,
  tangentAt,
  trimPath,
} from "./geometry";

const A = { x: 0, y: 0 };
const B = { x: 300, y: 0 };

describe("_cables geometry", () => {
  it("sagPath hangs `sag` below the chord midpoint and keeps its ends", () => {
    const p = sagPath(A, B, 40, 16);
    expect(p).toHaveLength(17);
    expect(p[0]).toEqual(A);
    expect(p[16]).toEqual(B);
    expect(p[8]!.y).toBeCloseTo(40, 9);
    expect(p[8]!.x).toBeCloseTo(150, 9);
    const tilted = sagPath({ x: 0, y: 0 }, { x: 100, y: 50 }, 0, 4);
    expect(tilted[2]).toEqual({ x: 50, y: 25 });
  });

  it("catenaryPath has the requested arc length and hangs below the chord", () => {
    for (const b of [B, { x: 300, y: -80 }, { x: -200, y: 60 }]) {
      const chord = Math.hypot(b.x, b.y);
      const L = chord * 1.2;
      const p = catenaryPath(A, b, L, 200);
      expect(p[0]!.x).toBeCloseTo(0, 6);
      expect(p[0]!.y).toBeCloseTo(0, 6);
      expect(p.at(-1)!.x).toBeCloseTo(b.x, 6);
      expect(p.at(-1)!.y).toBeCloseTo(b.y, 6);
      expect(pathLength(p)).toBeCloseTo(L, 0);
      const mid = p[100]!;
      expect(mid.y).toBeGreaterThan(b.y / 2); // y down: below the chord
    }
    expect(catenaryPath(A, B, 100, 4)).toEqual(sagPath(A, B, 0, 4)); // too short: taut
  });

  it("bowPath bows sideways by `bow` at the middle", () => {
    const p = bowPath({ x: 0, y: 0 }, { x: 0, y: 400 }, 30, 8);
    expect(p[4]!.x).toBeCloseTo(30, 9);
    expect(p[4]!.y).toBeCloseTo(200, 9);
    expect(p[0]!.x).toBeCloseTo(0, 9);
  });

  it("manhattanPath routes with at most 2 bends, orthogonal legs, exact ends", () => {
    const a = { x: 10, y: 20 };
    const b = { x: 210, y: 140 };
    for (const opts of [{}, { bends: 1 as const }, { first: "v" as const }, { first: "v" as const, bends: 1 as const }, { mid: 0.25 }]) {
      const p = manhattanPath(a, b, opts);
      expect(p[0]).toEqual(a);
      expect(p.at(-1)).toEqual(b);
      expect(bendCount(p)).toBeLessThanOrEqual(2);
      for (let i = 1; i < p.length; i++) expect(p[i]!.x === p[i - 1]!.x || p[i]!.y === p[i - 1]!.y).toBe(true);
    }
    expect(bendCount(manhattanPath(a, b))).toBe(2);
    expect(bendCount(manhattanPath(a, b, { bends: 1 }))).toBe(1);
    expect(manhattanPath(a, { x: 10, y: 400 })).toHaveLength(2);
  });

  it("roundCorners keeps the ends and stays within the corner box", () => {
    const corners = manhattanPath({ x: 0, y: 0 }, { x: 200, y: 100 });
    const r = roundCorners(corners, 20);
    expect(r[0]).toEqual(corners[0]);
    expect(r.at(-1)).toEqual(corners.at(-1));
    for (const p of r) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-9);
      expect(p.x).toBeLessThanOrEqual(200 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(-1e-9);
      expect(p.y).toBeLessThanOrEqual(100 + 1e-9);
    }
    expect(pathLength(r)).toBeLessThan(pathLength(corners));
  });

  it("pointAt / tangentAt / trimPath / subPath / resample work by arc length", () => {
    const p = [A, B, { x: 300, y: 100 }];
    expect(pathLength(p)).toBe(400);
    expect(pointAt(p, 0.5)).toEqual({ x: 200, y: 0 });
    expect(pointAt(p, 0.875)).toEqual({ x: 300, y: 50 });
    expect(pointAt(p, 2)).toEqual({ x: 300, y: 100 });
    expect(tangentAt(p, 0.25)).toEqual({ x: 1, y: 0 });
    expect(tangentAt(p, 0.9).y).toBeCloseTo(1, 6);
    const t = trimPath(p, 0.875);
    expect(pathLength(t)).toBeCloseTo(350, 9);
    expect(t.at(-1)).toEqual({ x: 300, y: 50 });
    expect(trimPath(p, 0)).toEqual([A, A]);
    const s = subPath(p, 0.5, 0.875);
    expect(s[0]).toEqual({ x: 200, y: 0 });
    expect(s.at(-1)).toEqual({ x: 300, y: 50 });
    expect(pathLength(s)).toBeCloseTo(150, 9);
    expect(resample(p, 4).map((q) => q.x)).toEqual([0, 100, 200, 300, 300]);
  });

  it("a Verlet cord settles into a sag between its pins, deterministically", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 240, y: 0 };
    const rope = createRope(a, b, { segments: 12, slack: 1.1 });
    expect(rope.points).toHaveLength(13);
    const settled = settleRope(rope, 0.5);
    const path = ropePath(settled);
    expect(path[0]).toEqual(a);
    expect(path[12]).toEqual(b);
    expect(path[6]!.y).toBeGreaterThan(10); // hangs
    expect(pathLength(path)).toBeCloseTo(240 * 1.1, -1);
    expect(settleRope(rope, 0.5)).toEqual(settled);
    // settled: another 0.5 s barely moves it
    const later = settleRope(settled, 0.5);
    expect(Math.abs(later.points[6]!.y - settled.points[6]!.y)).toBeLessThan(2);
  });

  it("a released cord drops to the floor from its free end", () => {
    const rope = settleRope(createRope({ x: 0, y: 0 }, { x: 200, y: 0 }), 0.5);
    const dropped = settleRope(pinRope(rope, { x: 0, y: 0 }, null), 1.5, { floorY: 150 });
    const path = ropePath(dropped);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path.at(-1)!.y).toBeCloseTo(150, 0);
    for (const p of path) expect(p.y).toBeLessThanOrEqual(150 + 1e-9);
  });
});
