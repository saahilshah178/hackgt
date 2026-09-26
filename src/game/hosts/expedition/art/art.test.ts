import { describe, expect, it } from "vitest";
import { WorldOverlay } from "../../../../contracts/world";
import { hash32, groupOfKey, pickColor, stubHintsFor, stubSpecFor, unloadKeys } from "./stub-spec";
import { posesFor, stubAnchors, stubSkeleton } from "./stub-rig";
import { DEV_WORLD_INPUT } from "../__fixtures__/dev-world-data";

describe("stub art spec", () => {
  const world = WorldOverlay.parse(DEV_WORLD_INPUT);
  const hints = stubHintsFor(world);

  it("sizes layers by depth and shapes every group", () => {
    const far = world.zones[0].layerSets[0].layers.find((l) => l.depth === "L1_far");
    if (!far) throw new Error("dev world has an L1 layer");
    expect(stubSpecFor(far.asset, hints)).toMatchObject({ w: 1024, depth: "L1_far", pivot: [0, 0] });
    for (const [key, style] of [
      ["x.ground.path", "strip"],
      ["x.prop.crate", "pillar"],
      ["x.part.ring_gate_console", "pillar"],
      ["x.part.ring_gate_outer", "disc"],
      ["x.costume.scarf", "disc"],
      ["x.companion.cog", "disc"],
      ["x.npc.bot", "figure"],
      ["x.fx.glow", "glow"],
      ["x.vista.end", "vista"],
      ["x.doc.plate", "plaque"],
      ["x.silhouette.crowd", "figure"],
      ["x.ui.icon", "disc"],
      ["x.kit.thing", "block"],
    ] as const) expect(stubSpecFor(key, hints).style).toBe(style);
    const hub = world.zones[0].hub?.asset;
    if (hub) expect(stubSpecFor(hub, hints).style).toBe("arch");
    expect(stubSpecFor(world.zones[0].interiors[0].facade, hints).style).toBe("block");
  });

  it("helpers: hash, group, colour pick, residency diff", () => {
    expect(hash32("a")).toBe(hash32("a"));
    expect(hash32("a")).not.toBe(hash32("b"));
    expect(groupOfKey("shared.char.wren")).toBe("char");
    expect(groupOfKey("x")).toBe("kit");
    expect(pickColor({ a: "#112233", b: "rgba(1,1,1,0.5)" }, ["b", "a"])).toBe("#112233");
    expect(pickColor({}, ["zz"], "#000000")).toBe("#000000");
    expect(unloadKeys(["a", "b", "shared.x", "c"], ["b"], ["shared.x"])).toEqual(["a", "c"]);
  });
});

describe("stub rig", () => {
  it("packs 28 protagonist and 12 NPC poses with 7 anchors each", () => {
    expect(posesFor("protagonist")).toHaveLength(28);
    expect(posesFor("npc")).toHaveLength(12);
    for (const pose of posesFor("protagonist")) {
      const a = stubAnchors(pose);
      expect(a.points.map((p) => p.name).sort()).toEqual(["back", "face", "feet", "hand_l", "hand_r", "head", "torso"]);
      expect(a.points.every((p) => p.x >= 0 && p.x <= 168 && p.y >= 0 && p.y <= 224)).toBe(true);
    }
    expect(stubAnchors("back").facing).toBe("back");
    expect(stubSkeleton("cheer1").mouthOpen).toBe(true);
    expect(stubSkeleton("walk3").footR.x).not.toBe(stubSkeleton("walk7").footR.x);
  });
});
