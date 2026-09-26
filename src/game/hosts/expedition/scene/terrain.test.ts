import { describe, expect, it } from "vitest";
import { blockers, clampX, edgeHit, sheerEdges, stepBlocked, BLOCKER_MARGIN } from "./terrain";
import { buildSurfaces } from "./surfaces";
import { reqCtxOf } from "./requirements";
import { TEST_ZONE } from "./test-zone";

const ground = TEST_ZONE.ground.points;
const model = buildSurfaces(TEST_ZONE, reqCtxOf([], null), []);
const edges = sheerEdges(ground, TEST_ZONE.ground.maxStepUp);

describe("terrain", () => {
  it("finds the sheer rise and the sheer descent, not the gentle slope", () => {
    expect(edges).toHaveLength(2);
    const [rise, descent] = edges;
    expect(rise.dir).toBe("rise");
    expect(rise.x0).toBeLessThan(1000);
    expect(rise.x1).toBeGreaterThan(1004);
    expect(rise.top).toBe(640);
    expect(rise.bottom).toBe(800);
    expect(descent.dir).toBe("descent");
    expect(descent.x0).toBeLessThan(2400);
    expect(descent.x1).toBeGreaterThan(2404);
    // the 80-unit slope over 400 units (3000 → 3400) is walkable
    expect(edges.some((e) => e.x0 > 2900)).toBe(false);
  });

  it("does not flag a small step below maxStepUp even when it is vertical", () => {
    expect(sheerEdges([[0, 100], [50, 100], [51, 40], [100, 40]], 102)).toEqual([]);
    expect(sheerEdges([[0, 1]], 102)).toEqual([]);
    expect(sheerEdges([[0, 0], [5, 500]], 102)).toEqual([]); // shorter than one window
  });

  it("sheer edges block walking in BOTH directions", () => {
    expect(stepBlocked(ground, 102, 900, 1100)).toBe(true); // into the rise from below
    expect(stepBlocked(ground, 102, 1100, 900)).toBe(true); // off the top, back down the rise
    expect(stepBlocked(ground, 102, 2300, 2500)).toBe(true); // over the descent
    expect(stepBlocked(ground, 102, 2500, 2300)).toBe(true); // up the descent from below
    expect(stepBlocked(ground, 102, 100, 900)).toBe(false);
    expect(stepBlocked(ground, 102, 3000, 3500)).toBe(false);
    expect(edgeHit(edges, 500, 500)).toBeNull();
  });

  it("standing inside an edge only allows moving out toward the nearer end", () => {
    const [rise] = edges;
    const nearLeft = rise.x0 + 1;
    expect(edgeHit(edges, nearLeft, nearLeft - 20)).toBeNull();
    expect(edgeHit(edges, nearLeft, nearLeft + 5)).toBe(nearLeft);
    const nearRight = rise.x1 - 1;
    expect(edgeHit(edges, nearRight, nearRight + 20)).toBeNull();
    expect(edgeHit(edges, nearRight, nearRight - 5)).toBe(nearRight);
  });

  it("clamps walks at edges, blockers and bounds", () => {
    const bl = blockers([{ encounterId: "e1", zoneId: "z_test", payoff: { blocker: { x: 600, surface: "ground", asset: null } } }], new Set());
    expect(bl).toHaveLength(1);
    let r = clampX({ x0: 500, x1: 700, surface: "ground", model, edges, blockers: bl });
    expect(r).toEqual({ x: 600 - BLOCKER_MARGIN, reason: "blocker" });
    r = clampX({ x0: 700, x1: 500, surface: "ground", model, edges, blockers: bl });
    expect(r).toEqual({ x: 600 + BLOCKER_MARGIN, reason: "blocker" });
    r = clampX({ x0: 900, x1: 1100, surface: "ground", model, edges, blockers: [] });
    expect(r.reason).toBe("edge");
    expect(r.x).toBeLessThan(1000);
    r = clampX({ x0: 2500, x1: 2300, surface: "ground", model, edges, blockers: [] });
    expect(r.reason).toBe("edge");
    expect(r.x).toBeGreaterThan(2404);
    r = clampX({ x0: 30, x1: -50, surface: "ground", model, edges, blockers: [] });
    expect(r.reason).toBe("bounds");
    r = clampX({ x0: 3900, x1: 4100, surface: "ground", model, edges, blockers: [] });
    expect(r.reason).toBe("bounds");
    // platforms are not clamped at their ends (the player walks off), only at the zone bounds and their blockers
    r = clampX({ x0: 690, x1: 720, surface: "ledge", model, edges, blockers: [] });
    expect(r).toEqual({ x: 720, reason: null });
    r = clampX({ x0: 30, x1: -20, surface: "ledge", model, edges, blockers: [] });
    expect(r.reason).toBe("bounds");
  });

  it("blockers follow progress: solved stations and other zones drop out", () => {
    const stations = [
      { encounterId: "e1", zoneId: "z_test", payoff: { blocker: { x: 600, surface: "ground", asset: null } } },
      { encounterId: "e2", zoneId: "z_test", payoff: { blocker: { x: 1600, surface: "ground", asset: "a.prop.door" } } },
      { encounterId: "e3", zoneId: "other", payoff: { blocker: { x: 100, surface: "ground", asset: null } } },
      { encounterId: "e4", zoneId: "z_test", payoff: { blocker: null } },
    ];
    expect(blockers(stations, new Set()).map((b) => b.encounterId)).toEqual(["e1", "e2", "e3"]);
    expect(blockers(stations, new Set(["e1"]), "z_test").map((b) => b.encounterId)).toEqual(["e2"]);
    expect(blockers(stations, new Set(["e1", "e2"]), "z_test")).toEqual([]);
  });
});
