import { describe, expect, it } from "vitest";
import { componentOf, planRoute, type RouteCtx } from "./route";
import { buildSurfaces } from "./surfaces";
import { blockers, sheerEdges } from "./terrain";
import { reqCtxOf, requirementMet } from "./requirements";
import { TEST_ZONE } from "./test-zone";

function ctx(solved: string[], withBlocker = false): RouteCtx {
  const rc = reqCtxOf(solved, null);
  const model = buildSurfaces(TEST_ZONE, rc, []);
  const bl = withBlocker ? blockers([{ encounterId: "e5", zoneId: "z_test", payoff: { blocker: { x: 1850, surface: "ground", asset: null } } }], new Set(solved)) : [];
  return { model, links: TEST_ZONE.links, edges: sheerEdges(model.ground.points, model.maxStepUp), blockers: bl, reqOk: (r) => requirementMet(r, rc) };
}

describe("route planner (walkTo)", () => {
  it("walks straight when no barrier is in the way", () => {
    expect(planRoute(ctx([]), { surface: "ground", x: 100 }, { x: 800 })).toEqual([{ kind: "walk", surface: "ground", x: 800 }]);
  });

  it("climbs the sheer rise and drops down the sheer descent", () => {
    const steps = planRoute(ctx([]), { surface: "ground", x: 100 }, { x: 2800, surface: "ground" });
    expect(steps?.filter((s) => s.kind === "link").map((s) => (s.kind === "link" ? s.linkId : ""))).toEqual(["climb_rise", "drop_edge"]);
    expect(steps?.[steps.length - 1]).toEqual({ kind: "walk", surface: "ground", x: 2800 });
  });

  it("comes back up the descent with the reverse two-way ladder", () => {
    const steps = planRoute(ctx([]), { surface: "ground", x: 2800 }, { x: 1500, surface: "ground" });
    const links = steps?.filter((s) => s.kind === "link");
    expect(links?.[0]).toMatchObject({ linkId: "ladder_edge", dir: "forward" });
  });

  it("reaches a platform by its hop and leaves it by walking off the end", () => {
    const up = planRoute(ctx([]), { surface: "ground", x: 100 }, { x: 600, surface: "ledge" });
    expect(up?.some((s) => s.kind === "link" && s.linkId === "hop_ledge")).toBe(true);
    const down = planRoute(ctx([]), { surface: "ledge", x: 500 }, { x: 900, surface: "ground" });
    expect(down?.[0]).toMatchObject({ kind: "walk", surface: "ledge" });
    expect(down?.some((s) => s.kind === "walk_off" || s.kind === "link")).toBe(true);
  });

  it("returns null past an unsolved blocker and plans once it is solved", () => {
    expect(planRoute(ctx([], true), { surface: "ground", x: 1200 }, { x: 1900 })).toBeNull();
    expect(planRoute(ctx(["e5"], true), { surface: "ground", x: 1200 }, { x: 1900 })).toEqual([{ kind: "walk", surface: "ground", x: 1900 }]);
    // stopping short of the blocker is fine, and the target is kept clear of it
    expect(planRoute(ctx([], true), { surface: "ground", x: 1200 }, { x: 1840 })?.[0]).toMatchObject({ kind: "walk", x: expect.any(Number) });
  });

  it("targets outside every surface are unreachable; gated links open with progress", () => {
    expect(planRoute(ctx([]), { surface: "ground", x: 100 }, { x: 99999 })).toBeNull();
    expect(planRoute(ctx([]), { surface: "ground", x: 3000 }, { x: 3200, surface: "gated" })).toBeNull();
    const via = planRoute(ctx(["e2"]), { surface: "ground", x: 3000 }, { x: 3200, surface: "gated" });
    expect(via?.some((s) => s.kind === "link" && s.linkId === "gear")).toBe(true);
    expect(componentOf(ctx([]), "ground", 100)).toBe(0);
    expect(componentOf(ctx([]), "ground", 3000)).toBe(2);
  });
});
