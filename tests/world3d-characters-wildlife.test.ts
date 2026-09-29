import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { composeWorld } from "../src/world3d/core/compose";
import { NILE_SAMPLE } from "../src/world3d/core/samples";
import { animalModel } from "../src/world3d/kit/wildlife/animals";
import { butterfly, firefly, fishAt, fishPath, flockBird, spawnGround, stepGround, validSpot, type FlyPose, type WorldQuery } from "../src/world3d/kit/wildlife/behavior";

/*
 * Ambient wildlife (src/world3d/kit/wildlife): the animal bodies build at believable sizes with valid skinning; spawns
 * are deterministic and land on valid ground (the ibis by the water); the behaviour state machine keeps every animal
 * on its element for minutes of simulated time; friendly cats walk up to the player; flocks, butterflies, fireflies and
 * fish follow deterministic, finite paths (fish below the surface only).
 */

const composed = composeWorld(NILE_SAMPLE, { skipScatter: true });
const q: WorldQuery = { height: (x, z) => composed.hf.height(x, z), walkable: (x, z) => composed.nav.walkableAt(x, z), waterDepth: (x, z) => composed.hf.waterDepth(x, z) };

describe("animal bodies", () => {
  const sizes: [Parameters<typeof animalModel>[0], number, number][] = [
    ["cat", 0.25, 0.56],
    ["dog", 0.55, 0.95],
    ["goat", 0.8, 1.25],
    ["camel", 2.0, 2.7],
    ["horse", 1.6, 2.2],
    ["ibis", 0.75, 0.95],
  ];
  for (const [kind, lo, hi] of sizes) {
    it(`${kind}: builds a skinned body of believable height`, () => {
      const m = animalModel(kind)!;
      expect(m).toBeTruthy();
      expect(animalModel(kind)).toBe(m);
      const box = new THREE.Box3();
      for (const p of m.parts) {
        p.geometry.computeBoundingBox();
        box.union(p.geometry.boundingBox!);
        const sw = p.geometry.attributes.skinWeight as THREE.BufferAttribute;
        const si = p.geometry.attributes.skinIndex as THREE.BufferAttribute;
        let bad = 0;
        for (let i = 0; i < sw.count; i++) if (Math.abs(sw.getX(i) + sw.getY(i) - 1) > 1e-5 || si.getX(i) >= m.joints.length || si.getY(i) >= m.joints.length) bad++;
        expect(bad).toBe(0);
      }
      expect(box.max.y).toBeGreaterThan(lo);
      expect(box.max.y).toBeLessThan(hi);
      expect(box.min.y).toBeGreaterThan(-0.05);
      expect(m.tris).toBeLessThan(12_000);
    });
  }
  it("returns null for the instanced kinds", () => {
    expect(animalModel("fish")).toBeNull();
    expect(animalModel("bird_flock")).toBeNull();
  });
});

describe("ground behaviour", () => {
  it("spawns deterministically on valid ground, ids unique per kind", () => {
    const a = spawnGround(composed.wildlife, composed.world.seed, q);
    const b = spawnGround(composed.wildlife, composed.world.seed, q);
    expect(a.map((x) => [x.id, x.x, x.z])).toEqual(b.map((x) => [x.id, x.x, x.z]));
    expect(a.length).toBeGreaterThan(0);
    expect(new Set(a.map((x) => x.id)).size).toBe(a.length);
    for (const an of a) expect(validSpot(an.kind, q, an.x, an.z), an.id).toBe(true);
    const ibises = a.filter((x) => x.kind === "ibis");
    expect(ibises.length).toBeGreaterThan(0);
  });

  it("keeps every animal on its element through three simulated minutes", () => {
    const animals = spawnGround(composed.wildlife, composed.world.seed, q);
    const player = { x: composed.spawn.x, z: composed.spawn.z };
    let walked = 0;
    for (let step = 0; step < 180 * 10; step++) {
      for (const an of animals) {
        const x0 = an.x;
        const z0 = an.z;
        stepGround(an, 0.1, q, player);
        walked += Math.hypot(an.x - x0, an.z - z0);
      }
    }
    for (const an of animals) {
      expect(validSpot(an.kind, q, an.x, an.z), `${an.id} at ${an.x.toFixed(1)},${an.z.toFixed(1)}`).toBe(true);
      expect(Math.hypot(an.x - an.homeX, an.z - an.homeZ), an.id).toBeLessThan(an.radius * 1.7 + 12);
    }
    expect(walked).toBeGreaterThan(10);
  });

  it("friendly cats come to sit by a nearby player", () => {
    const cats = spawnGround(composed.wildlife, composed.world.seed, q).filter((a) => a.kind === "cat");
    const cat = cats.find((c) => c.friendly);
    expect(cat).toBeTruthy();
    // stand the player a few metres from the cat on open ground
    let player = { x: cat!.x + 4, z: cat!.z };
    for (const [dx, dz] of [
      [4, 0],
      [-4, 0],
      [0, 4],
      [0, -4],
    ])
      if (validSpot("cat", q, cat!.x + dx, cat!.z + dz)) player = { x: cat!.x + dx, z: cat!.z + dz };
    for (let i = 0; i < 200; i++) stepGround(cat!, 0.1, q, player);
    expect(cat!.withPlayer).toBe(true);
    expect(Math.hypot(player.x - cat!.x, player.z - cat!.z)).toBeLessThan(2.2);
    expect(cat!.mode).toBe("sit");
  });
});

describe("flocks, swarms and fish", () => {
  const home = { x: 10, z: -20, radius: 60 };
  it("flock birds circle high and butterflies flutter low, deterministically", () => {
    const a: FlyPose = { x: 0, y: 0, z: 0, yaw: 0, roll: 0, pitch: 0, flap: 0 };
    const b: FlyPose = { ...a };
    for (let i = 0; i < 12; i++) {
      flockBird(home, i, 99, 12.5, a);
      flockBird(home, i, 99, 12.5, b);
      expect(a).toEqual(b);
      expect(a.y).toBeGreaterThan(18);
      expect(Math.hypot(a.x - home.x, a.z - home.z)).toBeLessThan(home.radius);
      butterfly({ ...home, radius: 10 }, i, 99, 7.1, a);
      expect(a.y).toBeGreaterThan(0.1);
      expect(a.y).toBeLessThan(2);
      const f = { x: 0, y: 0, z: 0 };
      const g = firefly({ ...home, radius: 10 }, i, 99, 3.3, f);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });

  it("fish homes are in the river and their loops can be kept in deep water", () => {
    const fish = composed.wildlife.filter((w) => w.kind === "fish");
    for (const w of fish) {
      expect(composed.hf.waterDepth(w.x, w.z)).toBeGreaterThan(0.5);
      let kept = 0;
      for (let i = 0; i < 40 && kept < 3; i++) {
        const p = fishPath(w, i, composed.world.seed);
        let ok = true;
        for (let k = 0; k < 12 && ok; k++) {
          const s = fishAt(p, (k / 12) * ((Math.PI * 2) / Math.abs(p.w)));
          ok = composed.hf.waterDepth(s.x, s.z) > p.depth + 0.35;
        }
        if (ok) kept++;
      }
      expect(kept).toBeGreaterThan(0);
    }
  });
});
