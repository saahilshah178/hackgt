import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ARCH_STYLES, STRUCTURE_KINDS, type ArchStyle, type Material, type StructureKind } from "../src/contracts/world3d";
import { STRUCTURES } from "../src/world3d/core/catalog";
import { GeoBuilder, loftGeometry, lobedLatheGeometry, polyLoftGeometry, rectLoop } from "../src/world3d/kit/structures/geom";
import { scaleBucket, structureModel, type StructureModel } from "../src/world3d/kit/structures/model";
import { cropLayout, fieldsGeometry, quarryGeometry } from "../src/world3d/kit/structures/specials";

/*
 * The procedural structure library (src/world3d/kit/structures): every kind in every style builds, fits its catalog
 * footprint and reaches roughly its catalog height (so what the core's checks reason about is what the player sees),
 * geometry is cached per (kind, style, material, scale bucket, seed % 4), surfaces face outward, and the animated parts
 * the game relies on (gate doors, the tomb seal, the pyramidion glow, windmill sails, fires) exist.
 */

function materialFor(kind: StructureKind, style: ArchStyle): Material {
  if (kind === "boat" || kind === "dock") return "wood";
  if (style === "nordic" || style === "rustic") return "wood";
  if (style === "modern" || style === "futuristic") return "plaster";
  return kind === "house" ? "adobe" : "limestone";
}

/** Largest horizontal half-extent and top of a model, in metres. */
function extents(m: StructureModel) {
  const b = m.bounds;
  return { half: Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z), top: b.max.y };
}

/** Signed volume of a closed-ish triangle soup: positive when the faces point outward. */
function signedVolume(g: THREE.BufferGeometry): number {
  const p = g.attributes.position as THREE.BufferAttribute;
  const idx = g.index;
  const n = idx ? idx.count : p.count;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let v = 0;
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, idx ? idx.getX(i) : i);
    b.fromBufferAttribute(p, idx ? idx.getX(i + 1) : i + 1);
    c.fromBufferAttribute(p, idx ? idx.getX(i + 2) : i + 2);
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return v;
}

describe("structure models", () => {
  for (const kind of STRUCTURE_KINDS) {
    it(`${kind}: builds in every style, fits the footprint and reaches the catalog height`, () => {
      const info = STRUCTURES[kind];
      for (const style of ARCH_STYLES) {
        for (const seed of [1, 6]) {
          const m = structureModel({ kind, style, material: materialFor(kind, style), scale: 1, seed });
          const { half, top } = extents(m);
          const where = `${kind}/${style}/seed ${seed}`;
          expect(m.parts.length, where).toBeGreaterThan(0);
          expect(half, `${where} footprint ${half.toFixed(2)} vs radius ${info.radius}`).toBeLessThanOrEqual(info.radius * 1.15);
          expect(half, `${where} footprint ${half.toFixed(2)} vs radius ${info.radius}`).toBeGreaterThanOrEqual(info.radius * 0.5);
          expect(top, `${where} height ${top.toFixed(2)} vs ${info.height}`).toBeLessThanOrEqual(info.height * 1.35);
          expect(top, `${where} height ${top.toFixed(2)} vs ${info.height}`).toBeGreaterThanOrEqual(info.height * 0.65);
          // a few draw calls, a sane triangle budget
          expect(m.parts.length + m.movers.reduce((n, mv) => n + mv.parts.length, 0), where).toBeLessThanOrEqual(24);
          expect(m.tris, where).toBeLessThan(90_000);
          for (const p of m.parts) {
            expect(p.geometry.attributes.uv, where).toBeTruthy();
            expect(p.geometry.attributes.normal, where).toBeTruthy();
            const arr = p.geometry.attributes.position.array as Float32Array;
            for (let i = 0; i < arr.length; i += 97) expect(Number.isFinite(arr[i]), where).toBe(true);
          }
        }
      }
    });
  }

  it("scales with the placement: footprint and height grow with scale", () => {
    for (const kind of ["temple", "house", "obelisk", "sphinx", "well"] as StructureKind[]) {
      const a = extents(structureModel({ kind, style: "ancient_egypt", material: "limestone", scale: 0.6, seed: 3 }));
      const b = extents(structureModel({ kind, style: "ancient_egypt", material: "limestone", scale: 1.8, seed: 3 }));
      expect(b.half / a.half).toBeGreaterThan(2.4);
      expect(b.top / a.top).toBeGreaterThan(2.4);
      expect(b.half).toBeLessThanOrEqual(STRUCTURES[kind].radius * 1.8 * 1.15 * 1.05);
    }
  });
});

describe("structure caching", () => {
  it("returns the same model for the same kind, style, material, scale bucket and seed % 4", () => {
    const a = structureModel({ kind: "house", style: "ancient_egypt", material: "adobe", scale: 1, seed: 5 });
    const b = structureModel({ kind: "house", style: "ancient_egypt", material: "adobe", scale: 1.01, seed: 9 });
    expect(b).toBe(a);
    const c = structureModel({ kind: "house", style: "ancient_egypt", material: "adobe", scale: 1, seed: 6 });
    expect(c).not.toBe(a);
    const d = structureModel({ kind: "house", style: "medieval", material: "adobe", scale: 1, seed: 5 });
    expect(d).not.toBe(a);
  });

  it("buckets scales finely enough that the residual group scale stays within ±5 %", () => {
    for (let s = 0.2; s <= 4; s += 0.037) {
      const r = s / scaleBucket(s);
      expect(r).toBeGreaterThan(0.95);
      expect(r).toBeLessThan(1.05);
    }
  });
});

describe("animated parts and state", () => {
  const find = (kind: StructureKind, style: ArchStyle, material: Material = "limestone") => structureModel({ kind, style, material, scale: 1, seed: 2 });

  it("gates swing open unless sealed, and every style has doors", () => {
    for (const style of ARCH_STYLES) {
      const m = find("gate", style);
      const doors = m.movers.filter((mv) => mv.kind === "swing" || mv.kind === "slide");
      expect(doors.length, style).toBeGreaterThanOrEqual(2);
      expect(doors.every((d) => d.defaultOpen), style).toBe(true);
    }
  });

  it("the Egyptian tomb has a sealing slab that slides aside when opened", () => {
    const seal = find("tomb", "ancient_egypt").movers.find((mv) => mv.kind === "slide");
    expect(seal).toBeTruthy();
    expect(seal!.defaultOpen).toBe(false);
    expect(Math.hypot(...seal!.amount)).toBeGreaterThan(1);
  });

  it("the pyramid carries a gilded pyramidion that can glow", () => {
    const glow = find("pyramid", "ancient_egypt").movers.find((mv) => mv.kind === "glow");
    expect(glow).toBeTruthy();
    expect(glow!.parts.some((p) => p.slot === "gold")).toBe(true);
    const top = find("pyramid", "ancient_egypt").bounds.max.y;
    expect(glow!.pivot[1]).toBeGreaterThan(top * 0.9);
  });

  it("windmill sails spin, boats bob, beacons and campfires carry fires", () => {
    expect(find("windmill", "medieval", "wood").movers.some((mv) => mv.kind === "spin")).toBe(true);
    expect(find("windmill", "modern", "plaster").movers.some((mv) => mv.kind === "spin")).toBe(true);
    expect(find("boat", "ancient_egypt", "wood").bob).toBe(true);
    for (const style of ARCH_STYLES) {
      expect(find("beacon", style).fires.length, style).toBeGreaterThan(0);
      expect(find("campfire", style).fires.length, style).toBeGreaterThan(0);
      expect(find("lighthouse", style).fires.length, style).toBeGreaterThan(0);
    }
  });

  it("medieval bridges have a drawbridge leaf that lowers", () => {
    const leaf = find("bridge", "medieval", "wood").movers.find((mv) => mv.kind === "lower");
    expect(leaf).toBeTruthy();
    expect(leaf!.amount[0]).toBeLessThan(0);
  });
});

describe("geometry toolkit", () => {
  it("polyLoft, loft and lobed lathe surfaces face outward", () => {
    const box = polyLoftGeometry(rectLoop(0, 0, 2, 1), [
      { o: 0, y: 0 },
      { o: 0, y: 3 },
    ], { capBottom: true });
    expect(signedVolume(box)).toBeCloseTo(2 * 4 * 3, 1);
    const pyramid = polyLoftGeometry(rectLoop(0, 0, 3, 3), [
      { o: 0, y: 0 },
      { o: -3, y: 4 },
    ], { capBottom: true });
    expect(signedVolume(pyramid)).toBeCloseTo((36 * 4) / 3, 0);
    const tube = loftGeometry([
      { c: [0, 0, -1], w: 0.5, h: 0.5, n: 2 },
      { c: [0, 0, 1], w: 0.5, h: 0.5, n: 2 },
    ], { radial: 24, capStart: true, capEnd: true });
    expect(signedVolume(tube)).toBeGreaterThan(1.4);
    const col = lobedLatheGeometry([
      { r: 0.5, y: 0 },
      { r: 0.5, y: 2 },
    ], { segments: 32, lobes: 8, depth: 0.1, mode: "bundle" });
    expect(signedVolume(col)).toBeGreaterThan(0);
  });

  it("emits metre-scaled UVs: a 4 m wall spans 4 UV units", () => {
    const b = new GeoBuilder();
    b.blk("main", -2, 0, -0.1, 2, 3, 0.1);
    const [part] = b.build();
    const uv = part.geometry.attributes.uv as THREE.BufferAttribute;
    let minU = Infinity;
    let maxU = -Infinity;
    for (let i = 0; i < uv.count; i++) {
      minU = Math.min(minU, uv.getX(i));
      maxU = Math.max(maxU, uv.getX(i));
    }
    expect(maxU - minU).toBeCloseTo(4, 3);
  });

  it("merges each slot into one geometry", () => {
    const b = new GeoBuilder();
    for (let i = 0; i < 20; i++) b.box("main", i, 0, 0, 0.5, 0.5, 0.5);
    b.box("trim", 0, 2, 0, 1, 1, 1);
    const parts = b.build();
    expect(parts.map((p) => p.slot)).toEqual(["main", "trim"]);
    expect(parts[0].geometry.attributes.position.count).toBe(20 * 36);
  });
});

describe("special pieces", () => {
  it("fields and quarries build, cached, and crops follow the furrows deterministically", () => {
    const f = fieldsGeometry(10, 8, 3);
    expect(f.length).toBeGreaterThan(1);
    expect(fieldsGeometry(10.1, 8.1, 7)).toBe(f);
    const q = quarryGeometry(24, 1);
    expect(q.length).toBeGreaterThan(2);
    const a = cropLayout(10, 8, 42, 1);
    const b = cropLayout(10, 8, 42, 1);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(a.length / 4).toBeGreaterThan(300);
    for (let i = 0; i < a.length; i += 4) {
      expect(Math.abs(a[i])).toBeLessThan(10);
      expect(Math.abs(a[i + 1])).toBeLessThan(8);
    }
    expect(cropLayout(10, 8, 42, 0.3).length).toBeLessThan(a.length);
  });
});
