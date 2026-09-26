import { describe, expect, it } from "vitest";
import type { TraversalLink } from "../../../../contracts/world";
import {
  climbPath, cosmeticHop, cycleFraction, driverOffset, dropArc, edgeDrop, hopArc, hopDuration, isTwoWay, keyForLink,
  linkPrompt, linksInRange, pickLink, planLink, polyAt, ridePath, timedHopOpen, COSMETIC_APEX, LINK_RANGE,
} from "./traversal";
import { buildSurfaces } from "./surfaces";
import { reqCtxOf, requirementMet } from "./requirements";
import { TEST_ZONE } from "./test-zone";

const ctxFor = (solved: string[]) => {
  const rc = reqCtxOf(solved, null);
  return { model: buildSurfaces(TEST_ZONE, rc, []), reqOk: (r: Parameters<typeof requirementMet>[0]) => requirementMet(r, rc) };
};
const link = (id: string) => TEST_ZONE.links.find((l) => l.id === id) as TraversalLink;
type Timed = Extract<TraversalLink, { kind: "timed_hop" }>;

describe("traversal: links in range and keys", () => {
  it("finds links within 70 units on the player's surface, nearest first", () => {
    const ctx = ctxFor([]);
    const near = linksInRange(TEST_ZONE.links, { x: 370, surface: "ground" }, ctx);
    expect(near.map((c) => c.link.id)).toEqual(["hop_ledge"]);
    expect(near[0].key).toBe("space");
    expect(linksInRange(TEST_ZONE.links, { x: 370 + LINK_RANGE + 20, surface: "ground" }, ctx)).toEqual([]);
    // the two-way hop is also usable from the platform end
    const back = linksInRange(TEST_ZONE.links, { x: 430, surface: "ledge" }, ctx);
    expect(back[0].dir).toBe("reverse");
    expect(back[0].end.surface).toBe("ground");
  });

  it("maps climbs and ladders to W or S by the end heights; drops are one-way S", () => {
    const ctx = ctxFor([]);
    const up = linksInRange(TEST_ZONE.links, { x: 985, surface: "ground" }, ctx).find((c) => c.link.id === "climb_rise");
    expect(up?.key).toBe("up");
    const downClimb = linksInRange(TEST_ZONE.links, { x: 1025, surface: "ground" }, ctx).find((c) => c.link.id === "climb_rise");
    expect(downClimb?.key).toBe("down");
    expect(downClimb?.dir).toBe("reverse");
    const atTop = linksInRange(TEST_ZONE.links, { x: 2380, surface: "ground" }, ctx);
    expect(pickLink(atTop, "down")?.link.id).toBe("drop_edge"); // nearer than the ladder's top end
    const ladderUp = linksInRange(TEST_ZONE.links, { x: 2450, surface: "ground" }, ctx).find((c) => c.link.id === "ladder_edge");
    expect(ladderUp?.key).toBe("up");
    // the drop never runs in reverse
    expect(linksInRange(TEST_ZONE.links, { x: 2440, surface: "ground" }, ctx).some((c) => c.link.id === "drop_edge")).toBe(false);
    expect(isTwoWay(link("drop_edge"))).toBe(false);
    expect(keyForLink(link("lift"), 0, 0)).toBe("up");
  });

  it("hides links whose requirement is unmet or whose end is inactive", () => {
    expect(linksInRange(TEST_ZONE.links, { x: 3050, surface: "ground" }, ctxFor([])).some((c) => c.link.id === "gear")).toBe(false);
    expect(linksInRange(TEST_ZONE.links, { x: 3050, surface: "ground" }, ctxFor(["e2"])).some((c) => c.link.id === "gear")).toBe(true);
  });

  it("E boards rides; prompts name the verb", () => {
    const ctx = ctxFor([]);
    const atLift = linksInRange(TEST_ZONE.links, { x: 1510, surface: "ground" }, ctx);
    expect(pickLink(atLift, "interact")?.verb).toBe("ride");
    expect(pickLink([], "space")).toBeNull();
    expect(linkPrompt({ verb: "hop", key: "space" })).toBe("Space · Hop");
    expect(linkPrompt({ verb: "timed_hop", key: "space" })).toBe("Space · Hop");
    expect(linkPrompt({ verb: "drop", key: "down" })).toBe("S · Drop");
    expect(linkPrompt({ verb: "ride", key: "up" })).toBe("E · Board");
    expect(linkPrompt({ verb: "climb", key: "up" })).toBe("W · Climb");
    expect(linkPrompt({ verb: "climb", key: "down" })).toBe("S · Climb down");
    expect(linkPrompt({ verb: "ladder", key: "up" })).toBe("W · Ladder up");
    expect(linkPrompt({ verb: "ladder", key: "down" })).toBe("S · Ladder down");
  });
});

describe("traversal: arcs", () => {
  it("hop arcs hit both endpoints, peak above both and last 0.38–0.9 s", () => {
    const a = hopArc({ x: 0, y: 800 }, { x: 100, y: 700 }, 100);
    expect(a.at(0)).toMatchObject({ x: 0, y: 800 });
    expect(a.at(1)).toMatchObject({ x: 100, y: 700 });
    expect(a.at(0.5).y).toBeLessThan(700);
    expect(a.at(0.1).frame).toBe("jump");
    expect(a.at(0.95).frame).toBe("fall");
    expect(hopDuration(0)).toBe(0.38);
    expect(hopDuration(100000)).toBe(0.9);
    expect(hopDuration(500)).toBeCloseTo(0.58);
  });

  it("drop arcs are quadratic in y with duration sqrt(2Δy/1800)", () => {
    const d = dropArc({ x: 0, y: 0 }, { x: 40, y: 900 });
    expect(d.duration).toBeCloseTo(1);
    expect(d.at(0.5).y).toBeCloseTo(225);
    expect(d.at(1)).toMatchObject({ x: 40, y: 900, frame: "fall" });
  });

  it("climbs move at 220 units/s", () => {
    const c = climbPath({ x: 0, y: 440 }, { x: 0, y: 0 });
    expect(c.duration).toBeCloseTo(2);
    expect(c.at(0.5)).toMatchObject({ x: 0, y: 220, frame: "climb" });
    expect(c.at(1).frame).toBe("idle");
  });

  it("the cosmetic hop never changes surface and peaks at 51 units", () => {
    const h = cosmeticHop({ x: 10, y: 500 }, "ledge");
    expect(h.endSurface).toBe("ledge");
    expect(h.at(0.5).y).toBeCloseTo(500 - COSMETIC_APEX);
    expect(h.at(1).y).toBeCloseTo(500);
    expect(h.at(0.2).frame).toBe("jump");
    expect(h.at(0.8).frame).toBe("fall");
  });

  it("walking off a platform end drops to the surface below with a 40-unit drift", () => {
    const { model } = ctxFor([]);
    const d = edgeDrop({ x: 700, y: 600 }, 1, model);
    expect(d.endSurface).toBe("ground");
    expect(d.endX).toBe(740);
    expect(d.at(1).y).toBe(800);
    const left = edgeDrop({ x: 400, y: 600 }, -1, model);
    expect(left.endX).toBe(360);
    const offWorld = edgeDrop({ x: 3990, y: 0 }, 1, model);
    expect(offWorld.at(1).y).toBe(model.height);
  });

  it("rides follow the path with an eased tween", () => {
    const r = ridePath([[0, 0], [100, 0], [100, 100]], 2000);
    expect(r.duration).toBe(2);
    expect(r.at(0)).toMatchObject({ x: 0, y: 0, frame: "ride" });
    expect(r.at(1)).toMatchObject({ x: 100, y: 100 });
    expect(polyAt([[0, 0], [10, 0]], 0.5)).toEqual({ x: 5, y: 0 });
    expect(polyAt([], 0.5)).toEqual({ x: 0, y: 0 });
    expect(polyAt([[3, 4]], 0.5)).toEqual({ x: 3, y: 4 });
    expect(polyAt([[0, 0], [0, 0], [4, 0]], 1)).toEqual({ x: 4, y: 0 });
  });
});

describe("traversal: timed hops and planning", () => {
  const gear = link("gear") as Timed;

  it("cycle fraction and window (open [0.25, 0.5) of a 2 s period)", () => {
    expect(cycleFraction(2, 0, 0.6)).toBeCloseTo(0.3);
    expect(cycleFraction(2, 0.5, 1.5)).toBeCloseTo(0.25);
    expect(timedHopOpen(gear, 0.6)).toBe(true);
    expect(timedHopOpen(gear, 0.2)).toBe(false);
    expect(timedHopOpen(gear, 1.0)).toBe(false); // c = 0.5 is the closed end
    expect(timedHopOpen({ ...gear, open: [0.9, 0.1] }, 0.0)).toBe(true); // a window that wraps
    expect(driverOffset(gear, 0.5)).toBeCloseTo(gear.amplitude);
  });

  it("a timed hop lands on `to` inside the window and on `missTo` outside it (both outcomes)", () => {
    const ctx = ctxFor(["e2"]);
    const choice = linksInRange(TEST_ZONE.links, { x: 3050, surface: "ground" }, ctx).find((c) => c.link.id === "gear");
    if (!choice) throw new Error("gear link not in range");
    const hit = planLink(choice, ctx.model, { tSec: 0.6, driverTop: { x: 3090, y: 650 } });
    expect(hit.landed).toBe("to");
    expect(hit.endSurface).toBe("gated");
    expect(hit.at(1)).toMatchObject({ x: 3120, y: 700 });
    expect(hit.at(0.49).y).toBeLessThan(700);
    const hitNoDriver = planLink(choice, ctx.model, { tSec: 0.6 });
    expect(hitNoDriver.landed).toBe("to");
    const miss = planLink(choice, ctx.model, { tSec: 0.1 });
    expect(miss.landed).toBe("missTo");
    expect(miss.endSurface).toBe("ground");
    expect(miss.endX).toBe(3200);
  });

  it("plans every link kind into a path that ends on the far end", () => {
    const ctx = ctxFor([]);
    const plan = (x: number, surface: string, id: string, key: "space" | "up" | "down" | "interact") => {
      const c = pickLink(linksInRange(TEST_ZONE.links, { x, surface }, ctx).filter((q) => q.link.id === id), key);
      if (!c) throw new Error(`no ${id} at ${x}`);
      return planLink(c, ctx.model, { tSec: 0 });
    };
    const hop = plan(360, "ground", "hop_ledge", "space");
    expect([hop.kind, hop.endSurface, hop.at(1).y]).toEqual(["hop", "ledge", 600]);
    const climb = plan(980, "ground", "climb_rise", "up");
    expect([climb.kind, climb.at(1).y]).toEqual(["climb", 640]);
    const drop = plan(2380, "ground", "drop_edge", "down");
    expect([drop.kind, drop.at(1).y]).toEqual(["drop", 960]);
    const ladder = plan(2450, "ground", "ladder_edge", "up");
    expect([ladder.kind, ladder.at(1).y]).toEqual(["ladder", 640]);
    const ride = plan(1500, "ground", "lift", "interact");
    expect([ride.kind, ride.endX]).toEqual(["ride", 1800]);
  });
});
