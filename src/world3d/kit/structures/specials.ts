import * as THREE from "three";
import { hashString, mulberry32 } from "../../core/prng";
import { GeoBuilder, xform, type ModelPart } from "./geom";
import { basket, jar, sack } from "./parts";
import { roughStone } from "./kinds/monuments";

/*
 * Pure geometry for the composer's special pieces (core/compose `Special`):
 *   fields  irrigated crop plots: a raised earthen bund, furrow ridges, an irrigation canal with mud banks along one
 *           side and a shade shelter; the crops themselves are instanced by the renderer (cropLayout gives the spots).
 *   quarry  a stepped cut-limestone face (terraces), a floor with blocks being separated, loose blocks, an earth ramp,
 *           a wooden sledge carrying a block, levers, ropes and water jars (wetting the sand for the sledge).
 * Both are built in local space (origin at the piece's centre on the ground, x across the long side) and cached per
 * size bucket and seed % 4.
 */

const cache = new Map<string, ModelPart[]>();
const q = (v: number) => Math.round(v * 2) / 2;

export function fieldsGeometry(halfW: number, halfD: number, seed: number): ModelPart[] {
  const key = `fields|${q(halfW)}|${q(halfD)}|${seed % 4}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const b = new GeoBuilder();
  const W = q(halfW);
  const D = q(halfD);
  const rng = mulberry32(hashString(key));
  // earthen bund around the plot
  for (const [x0, z0, x1, z1] of [
    [-W, -D, W, -D + 0.5],
    [-W, D - 0.5, W, D],
    [-W, -D, -W + 0.5, D],
    [W - 0.5, -D, W, D],
  ] as [number, number, number, number][]) {
    b.rectLoft("soil", (x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0) / 2, Math.abs(z1 - z0) / 2, [
      { o: 0.15, y: -0.1 },
      { o: 0, y: 0.18 },
      { o: -0.12, y: 0.3 },
    ]);
  }
  // furrow ridges across the plot (rows along x)
  const pitch = 0.8;
  const rows = Math.floor((2 * D - 2.4) / pitch);
  for (let i = 0; i < rows; i++) {
    const z = -D + 1.6 + i * pitch;
    b.prism("soil", [[-0.28, 0], [0.28, 0], [0.1, 0.16], [-0.1, 0.16]], 2 * W - 1.2, xform(-W + 0.6, -0.04, z, Math.PI / 2));
  }
  // irrigation canal with mud banks along the -z edge
  const cz = -D - 0.9;
  b.rectLoft("soil", 0, cz - 0.75, W, 0.3, [
    { o: 0.1, y: -0.1 },
    { o: 0, y: 0.2 },
    { o: -0.1, y: 0.28 },
  ]);
  b.blk("water", -W, -0.05, cz - 0.45, W, 0.08, cz + 0.45);
  // a sluice gate where the canal feeds the plot
  const sx = (rng() - 0.5) * W;
  b.blk("wood", sx - 0.6, -0.1, cz + 0.4, sx - 0.5, 0.6, cz + 0.55);
  b.blk("wood", sx + 0.5, -0.1, cz + 0.4, sx + 0.6, 0.6, cz + 0.55);
  b.blk("woodDark", sx - 0.5, -0.05, cz + 0.45, sx + 0.5, 0.35, cz + 0.5);
  // a shade shelter with water jars at one corner (variant)
  if (seed % 2 === 0) {
    const x = W - 1.6;
    const z = D - 1.6;
    for (const [dx, dz] of [
      [-0.8, -0.8],
      [0.8, -0.8],
      [-0.8, 0.8],
      [0.8, 0.8],
    ] as [number, number][])
      b.cyl("wood", x + dx, 0, z + dz, 0.05, 0.05, 1.9, 5);
    b.box("thatch", x, 1.95, z, 2.0, 0.1, 2.0);
    jar(b, "paint2", x - 0.3, 0, z, 0.6);
    basket(b, x + 0.35, 0, z + 0.2, 0.3, "foliage");
  } else {
    // a scarecrow-like marker pole with a cloth
    b.cyl("wood", W - 1.5, 0, 0, 0.04, 0.04, 2.0, 5);
    b.box("cloth", W - 1.5, 1.6, 0, 0.8, 0.5, 0.02);
  }
  const parts = b.build();
  cache.set(key, parts);
  return parts;
}

/** Crop planting spots in local space: x, z, yaw, scale (stride 4), along the furrow ridges. */
export function cropLayout(halfW: number, halfD: number, seed: number, density: number): Float32Array {
  const W = q(halfW);
  const D = q(halfD);
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const pitch = 0.8;
  const rows = Math.floor((2 * D - 2.4) / pitch);
  const step = 0.5 / Math.max(0.2, density);
  const out: number[] = [];
  // a fallow strip keeps the rows from looking like a carpet
  const fallow = Math.floor(rng() * rows);
  for (let i = 0; i < rows; i++) {
    if (Math.abs(i - fallow) < 1) continue;
    const z = -D + 1.6 + i * pitch;
    for (let x = -W + 0.9; x < W - 0.9; x += step * (0.8 + rng() * 0.4)) {
      if (rng() < 0.08) continue;
      out.push(x + (rng() - 0.5) * 0.12, z + (rng() - 0.5) * 0.1, rng() * Math.PI * 2, 0.75 + rng() * 0.5);
    }
  }
  return new Float32Array(out);
}

/** One crop plant: a clump of tapering blades with a seed head, ~1 m tall at scale 1. */
export function cropPlantGeometry(): THREE.BufferGeometry {
  const hit = cache.get("crop-plant");
  if (hit) return hit[0].geometry;
  const b = new GeoBuilder();
  // a leafy clump: four broad arching blades (reads as a green row from the air), ~24 triangles
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    const lean = 0.4 + (k % 2) * 0.25;
    b.with(xform(0, 0, 0, a, 0, lean), () => {
      b.add("foliage", bladeGeometry(0.13, 0.9 - (k % 2) * 0.18));
    });
  }
  const parts = b.build();
  cache.set("crop-plant", parts);
  return parts[0].geometry;
}

function bladeGeometry(w: number, h: number) {
  const g = new THREE.BufferGeometry();
  const pos = [-w / 2, 0, 0, w / 2, 0, 0, w * 0.2, h * 0.6, 0.02, -w * 0.2, h * 0.6, 0.02, 0, h, 0.06];
  const idx = [0, 1, 2, 0, 2, 3, 3, 2, 4, 0, 2, 1, 0, 3, 2, 3, 4, 2];
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function quarryGeometry(radius: number, seed: number): ModelPart[] {
  const R = Math.round(radius / 2) * 2;
  const key = `quarry|${R}|${seed % 4}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const b = new GeoBuilder();
  const rng = mulberry32(hashString(key));
  // the cut face: three terraces rising toward the back (-z), in a U around the floor
  const tiers = 3;
  const th = 2.4;
  for (let t = 0; t < tiers; t++) {
    const inset = t * 3.2;
    const w = R * 0.95 - inset;
    const back = -R * 0.9 + inset;
    const y0 = t * th;
    // back wall block for this tier
    b.blk(t % 2 ? "main" : "main2", -w, y0, -R * 0.95, w, y0 + th, back + 2.2);
    // side arms of the U
    for (const sx of [-1, 1]) b.blk(t % 2 ? "main2" : "main", sx > 0 ? w - 4 + inset * 0.2 : -w, y0, back + 2.2, sx > 0 ? w : -w + 4 - inset * 0.2, y0 + th, R * 0.35 - inset * 0.8);
    // saw/chisel lines on the tier faces (block outlines being cut)
    for (let i = 0; i < Math.floor((2 * w) / 1.6); i++) {
      const x = -w + 0.8 + i * 1.6;
      b.quad("dark", x, y0 + th / 2, back + 2.21, 0.04, th * 0.9);
    }
    b.quad("dark", 0, y0 + th * 0.5, back + 2.215, 2 * w - 0.5, 0.04);
  }
  // quarry floor: cut blocks being separated (a grid with dark channels)
  b.blk("main2", -R * 0.6, -0.2, -R * 0.35, R * 0.6, 0.05, R * 0.25);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
    if (rng() < 0.3) continue;
    const x = -R * 0.5 + i * ((R * 1.0) / 5);
    const z = -R * 0.3 + j * 1.3;
    b.blk(rng() < 0.5 ? "main" : "trim", x - 0.7, 0.05, z - 0.55, x + 0.7, 0.05 + 0.9 + rng() * 0.3, z + 0.55);
  }
  // loose dressed blocks scattered in front
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI - Math.PI;
    const d = R * (0.35 + rng() * 0.45);
    const x = Math.cos(a) * d;
    const z = R * 0.35 + rng() * R * 0.45;
    b.box(rng() < 0.5 ? "main" : "trim", x, 0.55, z, 1.6 + rng() * 0.6, 1.1, 1.1 + rng() * 0.3, rng() * 0.6);
  }
  for (let i = 0; i < 10; i++) roughStone(b, "main2", (rng() - 0.5) * R * 1.6, R * 0.3 + rng() * R * 0.5, 0.4 + rng() * 0.5, 0.4 + rng() * 0.4, 0.3 + rng() * 0.3, rng, 0, rng() * 3);
  // earth ramp up the side terraces
  // (profile points are (z, y); a -90° yaw maps local x → world z and extrudes toward -x)
  b.prism("soil", [[R * 0.3, 0], [-R * 0.5, tiers * th], [-R * 0.5 - 3, tiers * th], [R * 0.3 - 3, 0]], 3.2, xform(R * 0.85, 0, 0, -Math.PI / 2));
  // a wooden sledge carrying a block, with ropes and water jars
  b.at(-R * 0.25, 0, R * 0.62, 0.3, () => {
    for (const sx of [-1, 1]) b.box("wood", sx * 0.55, 0.12, 0, 0.18, 0.22, 3.4, 0, 0, 0);
    for (let k = -1; k <= 1; k++) b.box("woodDark", 0, 0.28, k * 1.1, 1.5, 0.12, 0.2);
    b.box("main", 0, 0.95, 0, 1.3, 1.2, 2.2);
    for (let k = 0; k < 3; k++) b.tube("rope", [[-0.2 + k * 0.2, 0.3, 1.7], [-0.4 + k * 0.4, 0.2, 3.5], [-0.8 + k * 0.8, 0.05, 5.5]], 0.025, 4, 12);
    jar(b, "paint2", 0.9, 0, 2.2, 0.6);
    jar(b, "paint2", -1.0, 0, 2.6, 0.55);
  });
  // levers and a toolkit
  b.rod("wood", [R * 0.1, 0, -R * 0.1], [R * 0.2, 1.6, -R * 0.05], 0.05);
  b.rod("wood", [-R * 0.1, 0, -R * 0.2], [-R * 0.18, 1.5, -R * 0.12], 0.05);
  sack(b, R * 0.3, 0, R * 0.5, 0.7);
  basket(b, R * 0.38, 0, R * 0.42, 0.3, null);
  const parts = b.build();
  cache.set(key, parts);
  return parts;
}
