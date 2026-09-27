import { describe, expect, it } from "vitest";
import { FOLD_START, foldStage } from "@/world/sims";
import { lampAt, microVesicleAt, PIT, pitShape, playbackAt } from "./endocytosis_lift";

const flat = { depth: 0, wrap: 0, neck: 0, detached: false, travel: 0 };

describe("endocytosis_lift · the membrane path from the fold state", () => {
  it("flat membrane: the surface is the ledge (y 0) and the Halcyon rests on it", () => {
    const s = pitShape(flat);
    expect(s.surface.every((p) => Math.abs(p.y) < 1e-9)).toBe(true);
    expect(s.vesicle).toBeNull();
    expect(s.subY).toBeLessThan(0);
  });
  it("a fold dimples 1.3 H at the pit centre; a fold without touch only dimples through the transient dip", () => {
    const touched = foldStage(foldStage(FOLD_START, "touch"), "fold");
    const s = pitShape({ ...touched, wrap: 0 });
    const centre = s.surface.reduce((a, b) => (Math.abs(b.x - PIT.cx) < Math.abs(a.x - PIT.cx) ? b : a));
    expect(centre.y).toBeCloseTo(PIT.depthUnits, 0);
    const trap = pitShape(foldStage(FOLD_START, "fold"), 34);
    expect(Math.max(...trap.surface.map((p) => p.y))).toBeLessThanOrEqual(34 + 1e-9);
    expect(Math.max(...trap.surface.map((p) => p.y))).toBeGreaterThan(30);
  });
  it("wrapped (300°): the path runs around the cargo's ellipse below the surface and comes back up", () => {
    const s = pitShape({ depth: 1, wrap: 300 / 360, neck: 0.4, detached: false, travel: 0 });
    expect(s.vesicle).toMatchObject({ x: PIT.cx, closed: false });
    const lowest = Math.max(...s.surface.map((p) => p.y));
    expect(lowest).toBeCloseTo(s.subY + PIT.vesicle.ry, 6);
    expect(s.surface[0]!.y).toBe(0);
    expect(s.surface[s.surface.length - 1]!.y).toBe(0);
    for (let i = 1; i < s.surface.length; i++) expect(Number.isFinite(s.surface[i]!.x)).toBe(true);
  });
  it("the neck narrows as neck → 1", () => {
    const open = pitShape({ depth: 1, wrap: 300 / 360, neck: 0, detached: false, travel: 0 });
    const tight = pitShape({ depth: 1, wrap: 300 / 360, neck: 1, detached: false, travel: 0 });
    expect(tight.neckHalf).toBeLessThan(open.neckHalf);
  });
  it("detached: the surface reseals flat and the closed vesicle rides 4 H down with travel", () => {
    const a = pitShape({ depth: 1, wrap: 300 / 360, neck: 1, detached: true, travel: 0 });
    const b = pitShape({ depth: 1, wrap: 300 / 360, neck: 1, detached: true, travel: 1 });
    expect(a.surface.every((p) => p.y === 0)).toBe(true);
    expect(a.vesicle?.closed).toBe(true);
    expect(b.vesicle!.y - a.vesicle!.y).toBeCloseTo(PIT.travelUnits, 6);
  });
});

describe("endocytosis_lift · traps, lamps and playback", () => {
  it("the empty micro-vesicle pinches off and floats away (grows, rises, fades)", () => {
    expect(microVesicleAt(0).r).toBe(0);
    expect(microVesicleAt(0.5).y).toBeLessThan(microVesicleAt(0.1).y);
    expect(microVesicleAt(1).alpha).toBe(0);
  });
  it("four lamps down the post, evenly spaced", () => {
    expect([0, 1, 2, 3].map((j) => lampAt(j).y)).toEqual([0, 1, 2, 3].map((j) => PIT.lampTop + j * PIT.lampGap));
    expect(new Set([0, 1, 2, 3].map((j) => lampAt(j).x)).size).toBe(1);
  });
  it("playback runs 0 → n at msPerStage and clamps", () => {
    expect(playbackAt(1250, 4, 500)).toBeCloseTo(2.5, 9);
    expect(playbackAt(-5, 4, 500)).toBe(0);
    expect(playbackAt(9e9, 4, 500)).toBe(4);
  });
});
