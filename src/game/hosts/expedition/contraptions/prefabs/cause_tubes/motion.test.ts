import { describe, expect, it } from "vitest";
import { ARROW_TICK_PX, TUBE_GROW_PX_S } from "@/world/contraptions/cause-tubes.meta";
import { arrowTicks, carrierAt, sagSpring, wireGrowU } from "./motion";

describe("cause_tubes prefab motion", () => {
  it("tubes grow at 900 px/s from their source; reduced motion shows them whole", () => {
    expect(TUBE_GROW_PX_S).toBe(900);
    expect(wireGrowU(0, 900)).toBe(0);
    expect(wireGrowU(500, 900)).toBeCloseTo(0.5, 9);
    expect(wireGrowU(1000, 900)).toBe(1);
    expect(wireGrowU(5000, 900)).toBe(1);
    expect(wireGrowU(0, 900, true)).toBe(1);
    expect(wireGrowU(10, 0)).toBe(1);
  });

  it("a new wire overshoots its sag by 15 % and settles", () => {
    expect(sagSpring(0)).toBeCloseTo(1.15, 9);
    expect(Math.abs(sagSpring(600) - 1)).toBeLessThan(0.01);
    expect(sagSpring(900)).toBe(1);
    expect(sagSpring(0, true)).toBe(1);
  });

  it("the carrier walks the chain in order and lights each node as it arrives", () => {
    const order = ["n0", "n1", "n2", "n3", "n4"];
    expect(carrierAt(order, 0)).toEqual({ hop: 0, u: 0, reached: ["n0"] });
    expect(carrierAt(order, 0.375)).toEqual({ hop: 1, u: 0.5, reached: ["n0", "n1"] });
    expect(carrierAt(order, 0.5)).toEqual({ hop: 2, u: 0, reached: ["n0", "n1", "n2"] });
    expect(carrierAt(order, 1)).toEqual({ hop: 3, u: 1, reached: order });
    expect(carrierAt(["n0"], 0.5)).toEqual({ hop: -1, u: 0, reached: ["n0"] });
    expect(carrierAt([], 0.5).reached).toEqual([]);
  });

  it("arrow ticks every 80 px point from → to", () => {
    const ticks = arrowTicks([{ x: 0, y: 0 }, { x: 400, y: 0 }]);
    expect(ticks.map((t) => t.at.x)).toEqual([40, 120, 200, 280, 360]);
    expect(ticks.every((t) => t.angle === 0)).toBe(true);
    const back = arrowTicks([{ x: 0, y: 0 }, { x: -ARROW_TICK_PX * 2, y: 0 }]);
    expect(back).toHaveLength(2);
    expect(back[0].angle).toBeCloseTo(Math.PI, 9);
    expect(arrowTicks([{ x: 0, y: 0 }])).toEqual([]);
  });
});
