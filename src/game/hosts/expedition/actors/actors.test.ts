import { describe, expect, it } from "vitest";
import { frameFor, locomotion, npcMotion, resolveFrame, NPC_POSES, PROTAGONIST_POSES } from "./pose-animator";
import { placeCostume, springStep, RIG_DISPLAY_H, RIG_DISPLAY_W, type FrameAnchors } from "./costume";
import { flightAt, flightPlan, CIRCLE_RADIUS, HOVER_LIFT } from "./flight";

const ALL = new Set<string>(PROTAGONIST_POSES);
const NPC = new Set<string>(NPC_POSES);

describe("pose animator", () => {
  it("cycles walk at 12 fps, run at 14 fps, climb at 8 fps", () => {
    expect(frameFor("walk", 0, ALL)).toBe("walk0");
    expect(frameFor("walk", 1 / 12 + 1e-6, ALL)).toBe("walk1");
    expect(frameFor("walk", 8 / 12 + 1e-6, ALL)).toBe("walk0");
    expect(frameFor("run", 2 / 14 + 1e-6, ALL)).toBe("run2");
    expect(frameFor("climb", 1 / 8 + 1e-6, ALL)).toBe("climb1");
    expect(frameFor("cheer", 0.3, ALL)).toBe("cheer1");
    expect(frameFor("show", 5, ALL)).toBe("show");
    expect(frameFor("ride", 0, ALL)).toBe("idle");
  });
  it("falls back on NPC atlases (12 frames)", () => {
    expect(frameFor("walk", 1 / 12 + 1e-6, NPC)).toBe("walk0");
    expect(frameFor("run", 0, NPC)).toBe("walk2");
    expect(frameFor("cheer", 0.3, NPC)).toBe("cheer0");
    expect(frameFor("climb", 0, NPC)).toBe("hold");
    expect(frameFor("back", 0, NPC)).toBe("idle");
    expect(resolveFrame("nothing", new Set(["talk"]))).toBe("talk");
    expect(resolveFrame("x", new Set())).toBe("x");
  });
  it("maps NPC poses and speeds", () => {
    expect(npcMotion("work")).toBe("interact");
    expect(npcMotion("wave")).toBe("cheer");
    expect(npcMotion("cheer")).toBe("cheer");
    expect(npcMotion("sit")).toBe("duck");
    expect(npcMotion("talk")).toBe("talk");
    expect(npcMotion("think")).toBe("think");
    expect(npcMotion("ride")).toBe("ride");
    expect(npcMotion("idle")).toBe("idle");
    expect(npcMotion("hidden")).toBe("idle");
    expect(locomotion(0)).toBe("idle");
    expect(locomotion(300)).toBe("walk");
    expect(locomotion(-460)).toBe("run");
  });
});

describe("costume overlays", () => {
  const frame: FrameAnchors = {
    pose: "idle",
    facing: "front",
    points: [
      { name: "head", x: 90, y: 90, rot: 0 },
      { name: "back", x: 80, y: 110, rot: 90 },
      { name: "hand_r", x: 120, y: 150, rot: 0 },
    ],
  };
  const item = { asset: "a.costume.scarf", anchor: "back" as const, dx: 10, dy: 0, follow: "rigid" as const, layer: "behind" as const, hideOn: ["climb0"] };

  it("pos = anchor + R(rot)·(dx, dy), relative to the feet pivot", () => {
    const p = placeCostume(item, frame, false);
    expect(p.x).toBeCloseTo(80 - RIG_DISPLAY_W / 2);
    expect(p.y).toBeCloseTo(120 - RIG_DISPLAY_H);
    expect(p.angle).toBe(90);
    expect(p.front).toBe(false);
    expect(p.visible).toBe(true);
  });
  it("flipX mirrors x and rotation; back-facing frames swap layers; hideOn hides", () => {
    const p = placeCostume({ ...item, anchor: "hand_r", layer: "front" }, frame, true);
    expect(p.x).toBeCloseTo(RIG_DISPLAY_W - 130 - RIG_DISPLAY_W / 2);
    expect(p.front).toBe(true);
    const backFrame = { ...frame, facing: "back" as const };
    expect(placeCostume(item, backFrame, false).front).toBe(true);
    expect(placeCostume({ ...item, layer: "front" }, backFrame, false).front).toBe(false);
    expect(placeCostume(item, { ...frame, pose: "climb0" }, false).visible).toBe(false);
    expect(placeCostume({ ...item, anchor: "feet" }, frame, false).visible).toBe(false);
    expect(placeCostume(item, null, false).visible).toBe(false);
  });
  it("the spring converges on its target", () => {
    let st = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } };
    for (let i = 0; i < 300; i++) st = springStep(st.pos, st.vel, { x: 10, y: -5 }, 1 / 60);
    expect(st.pos.x).toBeCloseTo(10, 1);
    expect(st.pos.y).toBeCloseTo(-5, 1);
    expect(springStep({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }, 0).pos).toEqual({ x: 0, y: 0 });
  });
});

describe("companion hint flights", () => {
  it("flies to each target then circles, lands, hovers or rides for holdMs", () => {
    const plan = flightPlan({ x: 0, y: 0 }, [
      { x: 900, y: 0, action: "circle", holdMs: 1000 },
      { x: 900, y: 300, action: "land", holdMs: 500 },
      { x: 0, y: 0, action: "hover", holdMs: 500 },
      { x: 10, y: 10, action: "ride", holdMs: 100 },
    ]);
    expect(plan.legs).toHaveLength(4);
    const l0 = plan.legs[0];
    expect(flightAt(plan, 0)).toMatchObject({ x: 0, done: false, leg: 0 });
    const circling = flightAt(plan, l0.flyMs + 250);
    expect(Math.hypot(circling.x - 900, circling.y)).toBeCloseTo(CIRCLE_RADIUS);
    const landed = flightAt(plan, plan.legs[1].startMs + plan.legs[1].flyMs + 100);
    expect(landed).toMatchObject({ x: 900, y: 300, leg: 1 });
    const hovering = flightAt(plan, plan.legs[2].startMs + plan.legs[2].flyMs + 1);
    expect(hovering.y).toBeCloseTo(-HOVER_LIFT, 0);
    expect(flightAt(plan, plan.totalMs + 10)).toMatchObject({ x: 10, y: 10, done: true });
    expect(flightAt({ legs: [], totalMs: 0 }, 5).done).toBe(true);
  });
});
