import { describe, expect, it } from "vitest";
import { World3D } from "../src/contracts/world3d";
import { STRUCTURE_KINDS } from "../src/contracts/world3d";
import { STRUCTURES } from "../src/world3d/core/catalog";
import { composeWorld } from "../src/world3d/core/compose";
import { buildHeightfield } from "../src/world3d/core/heightfield";
import { lightRig, sunDirection } from "../src/world3d/core/moods";
import { SAMPLE_WORLDS, NILE_SAMPLE } from "../src/world3d/core/samples";
import { lineOfSight } from "../src/world3d/core/spatial-checks";

describe("world3d core", () => {
  it("every sample world is a valid stored World3D", () => {
    for (const [name, w] of Object.entries(SAMPLE_WORLDS)) expect(World3D.safeParse(w).success, name).toBe(true);
  });

  it("every structure kind has catalog dimensions", () => {
    for (const k of STRUCTURE_KINDS) {
      expect(STRUCTURES[k].radius, k).toBeGreaterThan(0);
      expect(STRUCTURES[k].height, k).toBeGreaterThan(0);
    }
  });

  it("builds the same heightfield for the same world (deterministic)", () => {
    const a = buildHeightfield(NILE_SAMPLE, { res: 129 });
    const b = buildHeightfield(NILE_SAMPLE, { res: 129 });
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights));
    const c = buildHeightfield({ ...NILE_SAMPLE, seed: NILE_SAMPLE.seed + 1 }, { res: 129 });
    expect(Array.from(c.heights)).not.toEqual(Array.from(a.heights));
  });

  it("carves the river below the water level and keeps the plateau dry", () => {
    const hf = buildHeightfield(NILE_SAMPLE, { res: 201 });
    const [p0, p1] = NILE_SAMPLE.terrain.water.course;
    const mid = { x: (p0.x + p1.x) / 2, z: (p0.z + p1.z) / 2 };
    expect(hf.waterDepth(mid.x, mid.z)).toBeGreaterThan(0.5);
    expect(hf.waterDepth(-130, -50)).toBe(0);
    expect(hf.height(-130, -50)).toBeGreaterThan(5);
  });

  it("composes the Nile sample: goal reachable and visible, pads dry, deterministic scatter", () => {
    const a = composeWorld(NILE_SAMPLE, { res: 201, quality: "low" });
    const b = composeWorld(NILE_SAMPLE, { res: 201, quality: "low" });
    expect(a.goal?.id).toBe("great_pyramid");
    expect(a.scatter.map((s) => [s.kind, s.count])).toEqual(b.scatter.map((s) => [s.kind, s.count]));
    expect(Array.from(a.scatter[0].data.slice(0, 10))).toEqual(Array.from(b.scatter[0].data.slice(0, 10)));
    for (const l of a.landmarks.filter((p) => STRUCTURES[p.kind].placement === "land")) expect(a.hf.waterDepth(l.x, l.z), l.id).toBe(0);
    const g = a.goal!;
    expect(lineOfSight(a, { x: a.spawn.x, y: a.spawn.y + 1.7, z: a.spawn.z }, { x: g.x, y: g.y + g.height * 0.9, z: g.z })).toBe(true);
    expect(a.reachable.reduce((s, v) => s + v, 0)).toBeGreaterThan(1000);
  });

  it("adds a bridge when a path must cross the river", () => {
    const w: World3D = {
      ...NILE_SAMPLE,
      landmarks: [...NILE_SAMPLE.landmarks, { id: "east_shrine", kind: "shrine", name: "East shrine", at: { x: 245, z: -60 }, rotation: 270, scale: 1, material: "limestone", style: "ancient_egypt", role: "poi", description: "Across the river." }],
      paths: [{ from: "nilometer", to: "east_shrine", style: "dirt" }],
    };
    const c = composeWorld(w, { res: 201, skipScatter: true });
    expect(c.landmarks.some((l) => l.kind === "bridge")).toBe(true);
    expect(c.fixes.some((f) => f.includes("bridge_auto_1"))).toBe(true);
    expect(c.paths).toHaveLength(1);
    expect(c.world.landmarks.some((l) => l.id === "bridge_auto_1")).toBe(true);
  });

  it("lights every mood with the sun above the horizon", () => {
    for (const mood of ["dawn", "morning", "midday", "golden_hour", "dusk", "overcast", "storm", "night"] as const) {
      const rig = lightRig(mood, "clear", "grassland", 0.3);
      expect(sunDirection(rig).y, mood).toBeGreaterThan(0);
      expect(rig.fog.density, mood).toBeGreaterThan(0);
    }
  });
});
