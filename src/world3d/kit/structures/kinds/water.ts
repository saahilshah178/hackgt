import * as THREE from "three";
import { basis, xform, type GeoBuilder, type LoftSection, type V2, type V3 } from "../geom";
import type { Ctx } from "../model";
import { basket, cavettoAround, crate, jar, sack } from "../parts";

/*
 * On and over water: boat, dock, bridge, aqueduct. Boats stand with the water surface at local y = 0 and bob (the
 * renderer rocks them); a felucca has a lofted hull with a sheer, a lateen yard and a tall double-sided triangular sail.
 * Docks and bridges put their walking deck at local y = 0 (the composer places the origin at the walk height) and reach
 * down with pilings, piers and abutments so they meet water and banks. A bridge that is a seal target shows its
 * drawbridge leaf raised until the moment is solved.
 */

const scaled = (b: GeoBuilder, s: number, fn: () => void) => b.with(new THREE.Matrix4().makeScale(s, s, s), fn);

// ------------------------------------------------------------------------------------------------ hulls

interface HullSpec {
  /** stations: z, gunwale height, half-beam, depth below the gunwale */
  st: [number, number, number, number][];
  n?: number;
  deckY: number;
  hullSlot?: "wood" | "woodDark" | "metal" | "trim" | "main";
  rail?: "paint" | "paint2" | "woodDark" | "metal" | "glow";
}

/** Outer hull, inner hull, gunwale rails and a deck; returns the station list for fitting things on deck. */
function hull(b: GeoBuilder, spec: HullSpec) {
  const n = spec.n ?? 2.3;
  const slot = spec.hullSlot ?? "wood";
  const outer: LoftSection[] = spec.st.map(([z, y, w, d]) => ({ c: [0, y, z], w, h: d, n }));
  const inner: LoftSection[] = spec.st.map(([z, y, w, d]) => ({ c: [0, y - 0.01, z], w: Math.max(0.02, w - 0.07), h: Math.max(0.02, d - 0.07), n }));
  b.loft(slot, outer, { radial: 18, lowerHalf: true, subdivide: 3, stations: true });
  b.loft(slot === "metal" ? "metal" : "woodDark", inner, { radial: 14, lowerHalf: true, subdivide: 3, flip: true, stations: true });
  // gunwale rails
  for (const sx of [-1, 1]) {
    const pts: V3[] = spec.st.map(([z, y, w]) => [sx * w, y + 0.02, z]);
    b.tube(spec.rail ?? "paint", pts, 0.07, 5, spec.st.length * 6);
  }
  // deck boards where the hull is deep enough
  const halfAt = (y: number, w: number, d: number, top: number) => {
    const t = Math.min(1, Math.max(0, (top - y) / d));
    return w * Math.pow(Math.max(0, 1 - Math.pow(t, n)), 1 / n) * 0.96;
  };
  const deck: V2[] = [];
  const back: V2[] = [];
  for (const [z, y, w, d] of spec.st) {
    if (y - d > spec.deckY - 0.05) continue;
    const hw = halfAt(spec.deckY, w, d, y);
    deck.push([hw, z]);
    back.push([-hw, z]);
  }
  if (deck.length >= 2) {
    const poly = [...deck, ...back.reverse()];
    b.prism("wood", poly, 0.06, xform(0, spec.deckY, 0, 0, Math.PI / 2));
  }
}

function sailSheet(b: GeoBuilder, slot: "sail" | "cloth" | "cloth2", A: V3, B: V3, C: V3, belly: number, n = 6) {
  // triangle A (tack) - C (clew) - B (peak), bellied sideways (x)
  const rows: V3[][] = [];
  for (let i = 0; i <= n; i++) {
    const v = i / n;
    const row: V3[] = [];
    for (let j = 0; j <= n; j++) {
      const u = j / n;
      const fx = (1 - u) * A[0] + u * C[0];
      const fy = (1 - u) * A[1] + u * C[1];
      const fz = (1 - u) * A[2] + u * C[2];
      const bulge = belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.1)) * (1 - v * 0.6);
      row.push([(1 - v) * fx + v * B[0] + bulge, (1 - v) * fy + v * B[1], (1 - v) * fz + v * B[2]]);
    }
    rows.push(row);
  }
  b.sheet(slot, rows, true);
}

/** A square sail on a yard: rows from the yard down, bellied forward (+z). Vertical stripes alternate two slots. */
function squareSail(b: GeoBuilder, cx: number, yTop: number, z: number, w: number, h: number, stripes: number, belly: number) {
  for (let k = 0; k < stripes; k++) {
    const x0 = cx - w / 2 + (k * w) / stripes;
    const x1 = x0 + w / stripes;
    const rows: V3[][] = [];
    for (let i = 0; i <= 4; i++) {
      const v = i / 4;
      rows.push([0, 1, 2].map((j) => {
        const x = x0 + ((x1 - x0) * j) / 2;
        const u = (x - (cx - w / 2)) / w;
        return [x, yTop - v * h, z + belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.2))] as V3;
      }));
    }
    b.sheet(k % 2 ? "cloth2" : "sail", rows, true);
  }
}

// ------------------------------------------------------------------------------------------------ boat

export function boat(c: Ctx) {
  const { b, s, style, variant: v } = c;
  c.bob = true;
  scaled(b, s, () => {
    switch (style) {
      case "nordic":
        return longship(b, v);
      case "medieval":
        return cog(b);
      case "east_asian":
        return junk(b);
      case "classical":
        return galley(b);
      case "mesoamerican":
      case "rustic":
        return canoe(b, v);
      case "industrial":
      case "modern":
        return launch(b, style === "modern");
      case "futuristic":
        return skiff(b);
      default:
        return felucca(b, v);
    }
  });
}

function felucca(b: GeoBuilder, v: number) {
  hull(b, {
    st: [
      [-5.75, 1.08, 0.1, 0.4],
      [-5.0, 0.82, 0.72, 0.92],
      [-3.5, 0.64, 1.15, 1.06],
      [-1.0, 0.56, 1.3, 1.1],
      [1.5, 0.57, 1.28, 1.1],
      [3.8, 0.7, 0.96, 1.02],
      [5.2, 0.98, 0.42, 0.95],
      [5.85, 1.3, 0.08, 0.62],
    ],
    deckY: 0.3,
    rail: "paint",
  });
  // mast, lateen yard, boom and the tall triangular sail
  const A: V3 = [0, 1.25, 5.1];
  const B: V3 = [0, 8.7, -1.3];
  const C: V3 = [0, 1.55, -4.7];
  b.cyl("wood", 0, 0.3, 1.2, 0.11, 0.08, 6.0, 8);
  const ext = (p: V3, q: V3, t: number): V3 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  b.rod("wood", ext(A, B, -0.04), ext(A, B, 1.03), 0.075, 0.05, 6);
  b.rod("wood", ext(A, C, -0.02), ext(A, C, 1.02), 0.05, 0.05, 6);
  sailSheet(b, "sail", [0.05, A[1] + 0.05, A[2] - 0.1], [0.05, B[1] - 0.1, B[2] + 0.05], [0.05, C[1] + 0.05, C[2] + 0.05], 0.75, 7);
  // rigging
  b.rod("rope", [0, 6.2, 1.2], [0, 1.1, 5.7], 0.012, 0.012, 3);
  for (const sx of [-1, 1]) b.rod("rope", [0, 6.0, 1.2], [sx * 1.15, 0.6, 0.2], 0.012, 0.012, 3);
  b.rod("rope", [0, 1.55, -4.7], [0.6, 0.75, -4.2], 0.012, 0.012, 3);
  // steering oar over the stern quarter
  b.rod("wood", [0.55, 1.5, -4.9], [1.0, -0.5, -6.1], 0.05, 0.05, 6);
  b.box("wood", 1.0, -0.35, -6.0, 0.05, 0.9, 0.35, 0, 0.35, 0.2);
  if (v % 2 === 1) {
    // an arched reed canopy amidships
    b.add("thatch", new THREE.CylinderGeometry(0.95, 0.95, 2.2, 10, 1, true, -Math.PI / 2, Math.PI), xform(0, 0.45, -2.6, 0, Math.PI / 2));
  } else {
    jar(b, "paint2", -0.5, 0.36, -2.0, 0.6);
    jar(b, "paint2", 0.2, 0.36, -2.4, 0.5);
    sack(b, 0.4, 0.36, -1.4, 0.6);
    basket(b, -0.4, 0.36, -1.0, 0.3, "foliage");
  }
  // painted eye on the bow
  for (const sx of [-1, 1]) b.at(sx * 0.62, 1.0, 4.6, sx * 1.2, () => b.quad("dark", 0, 0, 0.02, 0.28, 0.12));
}

function longship(b: GeoBuilder, v: number) {
  b.with(new THREE.Matrix4().makeScale(0.9, 1, 0.9), () => longshipUnit(b, v));
}

function longshipUnit(b: GeoBuilder, v: number) {
  hull(b, {
    st: [
      [-6.4, 2.4, 0.06, 0.4],
      [-6.0, 1.3, 0.35, 1.1],
      [-4.8, 0.8, 1.05, 1.05],
      [-1.5, 0.66, 1.3, 1.05],
      [1.5, 0.66, 1.3, 1.05],
      [4.8, 0.8, 1.05, 1.05],
      [6.0, 1.3, 0.35, 1.1],
      [6.4, 2.4, 0.06, 0.4],
    ],
    n: 2.0,
    deckY: 0.2,
    rail: "woodDark",
  });
  // clinker strakes
  for (let k = 1; k <= 3; k++) {
    for (const sx of [-1, 1]) {
      const pts: V3[] = [];
      for (let i = 0; i <= 12; i++) {
        const z = -5.6 + (i / 12) * 11.2;
        const t = Math.abs(z) / 6.4;
        const w = 1.3 * Math.sqrt(Math.max(0, 1 - t * t * 0.9));
        pts.push([sx * w * (1 - k * 0.07), 0.66 + t * t * 0.9 - k * 0.24, z]);
      }
      b.tube("woodDark", pts, 0.035, 4, 30);
    }
  }
  // dragon head prow and curled stern
  b.tube("woodDark", [[0, 2.3, 6.35], [0, 3.0, 6.55], [0, 3.35, 6.3], [0, 3.2, 6.05]], 0.12, 6, 12);
  b.sphere("paint2", 0, 3.3, 6.5, 0.14, 0.12, 0.28, 8, 6);
  b.tube("woodDark", [[0, 2.3, -6.35], [0, 2.9, -6.55], [0, 3.05, -6.25], [0, 2.8, -6.1]], 0.1, 6, 12);
  // shields along the gunwale
  for (let i = 0; i < 8; i++) {
    const z = -3.5 + i;
    for (const sx of [-1, 1]) b.add(i % 2 ? "paint" : "paint2", new THREE.CylinderGeometry(0.32, 0.32, 0.05, 10), xform(sx * 1.33, 0.55, z, 0, 0, Math.PI / 2));
  }
  // mast, yard and a striped square sail
  b.cyl("wood", 0, 0.2, 0, 0.13, 0.1, 7.2, 8);
  b.rod("wood", [-2.4, 6.5, 0.12], [2.4, 6.5, 0.12], 0.08, 0.08, 6);
  squareSail(b, 0, 6.45, 0.18, 4.6, 3.9 + (v % 2) * 0.3, 7, 0.6);
  b.rod("rope", [0, 7.2, 0], [0, 1.4, 5.9], 0.012, 0.012, 3);
  b.rod("rope", [0, 7.2, 0], [0, 1.4, -5.9], 0.012, 0.012, 3);
}

function cog(b: GeoBuilder) {
  hull(b, {
    st: [
      [-5.0, 2.5, 1.4, 2.6],
      [-3.5, 2.2, 2.0, 2.5],
      [0, 2.0, 2.2, 2.4],
      [3.2, 2.3, 1.9, 2.5],
      [4.9, 2.8, 0.9, 2.3],
      [5.6, 3.1, 0.12, 1.5],
    ],
    n: 2.6,
    deckY: 1.6,
    rail: "woodDark",
  });
  // castles fore and aft
  b.blk("wood", -2.0, 2.3, -5.2, 2.0, 3.6, -3.2);
  b.blk("woodDark", -2.1, 3.6, -5.3, 2.1, 3.8, -3.1);
  b.blk("wood", -1.3, 2.6, 3.4, 1.3, 3.7, 5.0);
  b.cyl("wood", 0, 1.6, 0, 0.16, 0.12, 7.0, 8);
  b.rod("wood", [-2.6, 7.0, 0.15], [2.6, 7.0, 0.15], 0.09, 0.09, 6);
  squareSail(b, 0, 6.95, 0.2, 5.0, 3.6, 5, 0.7);
  b.rod("wood", [0, 2.9, 5.2], [0, 3.8, 6.5], 0.07, 0.05, 6);
}

function junk(b: GeoBuilder) {
  hull(b, {
    st: [
      [-5.4, 2.4, 1.3, 2.2],
      [-4.2, 1.6, 1.6, 1.9],
      [0, 1.1, 1.7, 1.6],
      [3.6, 1.2, 1.4, 1.5],
      [5.2, 1.6, 1.0, 1.3],
      [5.6, 1.8, 0.8, 0.9],
    ],
    n: 3.2,
    deckY: 0.8,
    rail: "paint",
  });
  b.blk("wood", -1.6, 1.8, -5.5, 1.6, 2.9, -3.8);
  b.blk("paint", -1.7, 2.9, -5.6, 1.7, 3.05, -3.7);
  for (const [z, hh, w] of [
    [0.6, 7.2, 3.6],
    [3.9, 5.0, 2.4],
  ] as [number, number, number][]) {
    b.cyl("wood", 0, 0.8, z, 0.12, 0.09, hh, 8);
    // battened lug sail: a tan sheet with horizontal battens
    const rows: V3[][] = [];
    for (let i = 0; i <= 6; i++) {
      const y = hh * 0.95 - (i / 6) * hh * 0.72;
      rows.push([0, 1, 2, 3].map((j) => [0.15 + Math.sin(i * 0.9) * 0.08, y, z - w * 0.35 + (j / 3) * w * (1 - i * 0.03)] as V3));
    }
    b.sheet("cloth", rows, true);
    for (let i = 0; i <= 6; i++) {
      const y = hh * 0.95 - (i / 6) * hh * 0.72;
      b.rod("wood", [0.2, y, z - w * 0.38], [0.2, y, z + w * 0.68], 0.03, 0.03, 4);
    }
  }
}

function galley(b: GeoBuilder) {
  hull(b, {
    st: [
      [-6.0, 1.9, 0.1, 0.6],
      [-5.3, 1.1, 0.8, 1.2],
      [-3.0, 0.8, 1.2, 1.1],
      [2.5, 0.8, 1.2, 1.1],
      [5.0, 0.9, 0.7, 1.1],
      [5.7, 0.7, 0.2, 0.8],
    ],
    deckY: 0.45,
    rail: "paint2",
  });
  b.tube("metal", [[0, 0.0, 5.4], [0, -0.05, 6.1], [0, 0.1, 6.35]], 0.14, 6, 10);
  b.tube("wood", [[0, 1.8, -5.9], [0, 2.6, -6.2], [0, 3.0, -5.8]], 0.12, 6, 12);
  for (let i = 0; i < 9; i++) for (const sx of [-1, 1]) b.rod("wood", [sx * 1.1, 0.75, -3.5 + i * 0.85], [sx * 2.6, -0.2, -3.2 + i * 0.85], 0.035, 0.03, 4);
  b.cyl("wood", 0, 0.45, 0.4, 0.12, 0.09, 6.4, 8);
  b.rod("wood", [-2.3, 6.3, 0.52], [2.3, 6.3, 0.52], 0.08, 0.08, 6);
  squareSail(b, 0, 6.25, 0.58, 4.4, 3.4, 5, 0.55);
  for (const sx of [-1, 1]) b.at(sx * 0.95, 0.95, 5.0, sx * 1.1, () => b.quad("dark", 0, 0, 0.03, 0.4, 0.18));
}

function canoe(b: GeoBuilder, v: number) {
  hull(b, {
    st: [
      [-5.2, 0.55, 0.12, 0.3],
      [-4.4, 0.45, 0.5, 0.6],
      [0, 0.4, 0.62, 0.62],
      [4.4, 0.45, 0.5, 0.6],
      [5.2, 0.55, 0.12, 0.3],
    ],
    n: 2.2,
    deckY: 0.02,
    rail: "woodDark",
  });
  for (let i = 0; i < 3; i++) b.blk("wood", -0.55, 0.15, -2 + i * 2, 0.55, 0.22, -1.7 + i * 2);
  b.rod("wood", [0.4, 0.3, 2.0], [0.9, 1.3, -3.2], 0.03, 0.03, 4);
  b.box("wood", 0.4, 0.3, 2.0, 0.04, 0.5, 0.18, 0, 0.35);
  // a pole with a pennant so the boat reads from afar
  b.cyl("wood", 0, 0.1, 2.8, 0.05, 0.04, 5.8, 6);
  b.sheet(v % 2 ? "cloth2" : "cloth", [
    [
      [0.02, 5.8, 2.8],
      [0.02, 5.75, 2.1],
      [0.02, 5.65, 1.4],
    ],
    [
      [0.02, 5.1, 2.8],
      [0.02, 5.3, 2.1],
      [0.02, 5.55, 1.4],
    ],
  ], true);
  basket(b, 0, 0.1, -3, 0.3, "foliage");
}

function launch(b: GeoBuilder, modern: boolean) {
  hull(b, {
    st: [
      [-5.2, 1.1, 1.5, 1.2],
      [-2, 1.1, 1.7, 1.25],
      [2, 1.15, 1.6, 1.2],
      [4.6, 1.4, 0.9, 1.1],
      [5.6, 1.7, 0.1, 0.8],
    ],
    n: 3,
    deckY: 0.8,
    hullSlot: modern ? "trim" : "woodDark",
    rail: modern ? "metal" : "paint2",
  });
  b.blk(modern ? "trim" : "wood", -1.1, 0.8, -3.0, 1.1, 2.6, 0.8);
  b.blk("glass", -1.12, 1.8, -0.3, 1.12, 2.4, 0.82);
  b.blk(modern ? "metal" : "roof", -1.3, 2.6, -3.3, 1.3, 2.75, 1.1);
  if (modern) {
    b.rod("metal", [0, 2.75, -1.5], [0, 4.6, -1.8], 0.04, 0.03, 6);
    b.rod("metal", [-0.5, 4.2, -1.8], [0.5, 4.2, -1.8], 0.02, 0.02, 4);
    b.cyl("metal", 0.6, 2.75, -2.4, 0.18, 0.18, 0.5, 10);
  } else {
    b.cyl("paint2", 0, 2.75, -1.6, 0.32, 0.3, 3.2, 12);
    b.cyl("dark", 0, 5.95, -1.6, 0.3, 0.33, 0.1, 12);
  }
  b.cyl("metal", 0, 1.1, 4.3, 0.12, 0.1, 5.4, 6);
}

function skiff(b: GeoBuilder) {
  b.loft("trim", [
    { c: [0, 0.6, -4.8], w: 0.9, h: 0.35, n: 3 },
    { c: [0, 0.65, -2.5], w: 1.5, h: 0.45, n: 3 },
    { c: [0, 0.65, 1.5], w: 1.4, h: 0.45, n: 3 },
    { c: [0, 0.7, 4.0], w: 0.8, h: 0.35, n: 3 },
    { c: [0, 0.8, 5.4], w: 0.12, h: 0.12, n: 3 },
  ], { radial: 18, subdivide: 3, capStart: true, capEnd: true });
  b.loft("glow", [
    { c: [0, 0.32, -4.6], w: 0.95, h: 0.05, n: 4 },
    { c: [0, 0.3, -2.5], w: 1.52, h: 0.05, n: 4 },
    { c: [0, 0.3, 1.5], w: 1.42, h: 0.05, n: 4 },
    { c: [0, 0.38, 4.0], w: 0.82, h: 0.05, n: 4 },
  ], { radial: 12, subdivide: 3, capStart: true, capEnd: true });
  b.add("glass", new THREE.SphereGeometry(1.0, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), xform(0, 1.05, 0.5, 0, 0, 0, 0.9, 0.7, 1.6));
  b.prism("metal", [[0, 0], [1.6, 0], [0.4, 4.2]], 0.1, xform(-0.05, 1.0, -4.6, -Math.PI / 2));
}

// ------------------------------------------------------------------------------------------------ dock

export function dock(c: Ctx) {
  const { b, s, style, matClass, variant: v } = c;
  const L = 10 * s;
  const W = 1.8 * Math.max(1, s * 0.8);
  if (matClass === "stone") {
    // a stone quay: a solid pier with a coping, steps down to the water and bollards
    b.blk("main", -W, -3.5, -L, W, -0.25, L);
    b.blk("trim", -W - 0.15, -0.25, -L, W + 0.15, 0, L + 0.15);
    for (let i = 0; i < 5; i++) b.blk("main2", W, -0.25 - (i + 1) * 0.28, L * 0.2 + i * 0.35, W + 1.2, -0.25 - i * 0.28, L * 0.2 + i * 0.35 + 0.35);
    for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) b.lathe("trim", sx * (W - 0.35), 0, -L * 0.6 + i * L * 0.5, [[0.18, 0], [0.18, 0.4], [0.24, 0.5], [0.01, 0.55]], 8);
    if (style === "ancient_egypt") cavettoAround(b, -W, -L, W, L, -0.65, 0.3);
    jar(b, "paint2", -W + 0.6, 0, -L * 0.4, 0.7);
    sack(b, -W + 0.8, 0, -L * 0.2, 0.7);
    return;
  }
  // timber jetty: pilings, stringers, planks, bollards, a ladder and cargo
  const pile = (x: number, z: number, top: number) => b.cyl("wood", x, -3.8, z, 0.16 * s, 0.14 * s, top + 3.8, 8);
  const bays = Math.round((2 * L) / (2.4 * s));
  for (let i = 0; i <= bays; i++) {
    const z = -L + (i * 2 * L) / bays;
    for (const sx of [-1, 1]) pile(sx * (W - 0.15), z, i % 2 === 0 ? 0.55 * s : -0.08);
    b.blk("woodDark", -W - 0.05, -0.5, z - 0.1, W + 0.05, -0.2, z + 0.1);
    if (i < bays) for (const sx of [-1, 1]) b.beam("woodDark", [sx * (W - 0.15), -2.4, z], [sx * (W - 0.15), -0.55, z + (2 * L) / bays], 0.08 * s);
  }
  for (const sx of [-1, 1]) b.blk("woodDark", sx * (W - 0.15) - 0.1, -0.2, -L, sx * (W - 0.15) + 0.1, -0.08, L);
  const plank = 0.26 * s;
  const n = Math.floor((2 * L) / plank);
  for (let i = 0; i < n; i++) {
    const z = -L + i * plank;
    const jag = ((i * 37) % 7) * 0.03;
    b.blk(i % 3 === 1 ? "woodDark" : "wood", -W - jag, -0.08, z + 0.012, W + ((i * 11) % 5) * 0.03, 0, z + plank - 0.012);
  }
  // tall mooring posts at the water end
  for (const sx of [-1, 1]) {
    b.cyl("woodDark", sx * (W + 0.15), -3.8, L - 0.4, 0.2 * s, 0.18 * s, 3.8 + 1.4 * s, 8);
    b.add("rope", new THREE.TorusGeometry(0.22 * s, 0.04 * s, 4, 10), xform(sx * (W + 0.15), 0.9 * s, L - 0.4, 0, Math.PI / 2));
  }
  // ladder at the water end
  for (const sx of [-1, 1]) b.rod("wood", [sx * 0.3, 0.2, L + 0.05], [sx * 0.3, -2.2, L + 0.1], 0.04 * s);
  for (let k = 0; k < 6; k++) b.rod("wood", [-0.3, -0.1 - k * 0.35, L + 0.07], [0.3, -0.1 - k * 0.35, L + 0.07], 0.025 * s);
  // rope coil, cargo
  b.add("rope", new THREE.TorusGeometry(0.3 * s, 0.07 * s, 5, 12), xform(W - 0.6, 0.07, L * 0.55, 0, -Math.PI / 2));
  if (v % 2 === 0) {
    crate(b, -W + 0.55, 0, -L * 0.3, 0.7 * s, 0.2);
    crate(b, -W + 0.6, 0.7 * s, -L * 0.3, 0.5 * s, 0.5);
    jar(b, "paint2", -W + 0.5, 0, -L * 0.1, 0.7 * s);
  } else {
    sack(b, W - 0.7, 0, -L * 0.4, 0.7 * s);
    sack(b, W - 0.9, 0, -L * 0.25, 0.65 * s);
    basket(b, -W + 0.6, 0, -L * 0.5, 0.35 * s, "foliage");
  }
}

// ------------------------------------------------------------------------------------------------ bridge

export function bridge(c: Ctx) {
  const { b, s, style, matClass } = c;
  const L = 18 * s;
  const W = 2.4 * Math.max(1, s * 0.8);
  const timber = matClass === "timber" || style === "nordic" || style === "rustic";
  const drawbridge = style === "medieval" || style === "nordic" || style === "rustic" || (timber && style !== "east_asian");
  if (style === "industrial" || style === "modern" || style === "futuristic") {
    steelBridge(b, L, W, s, style);
    return;
  }
  if (timber || style === "east_asian") {
    // pile bents, stringers, plank deck and rails
    const bays = Math.max(4, Math.round((2 * L) / (4 * s)));
    for (let i = 0; i <= bays; i++) {
      const z = -L + (i * 2 * L) / bays;
      if (drawbridge && Math.abs(z) < 3.9 * s) continue;
      for (const sx of [-1, 0, 1]) b.cyl("wood", sx * (W - 0.2), -5, z, 0.18 * s, 0.16 * s, 4.8, 8);
      b.blk("woodDark", -W - 0.2, -0.55, z - 0.14, W + 0.2, -0.2, z + 0.14);
      b.beam("woodDark", [-W + 0.2, -3.8, z], [W - 0.2, -0.6, z], 0.1 * s);
    }
    const deckRange: [number, number][] = drawbridge ? [[-L, -4 * s], [4 * s, L]] : [[-L, L]];
    for (const [z0, z1] of deckRange) plankDeck(b, z0, z1, W, s, style === "east_asian" ? "paint" : "wood");
    if (drawbridge) {
      // abutment piers either side of the lifting leaf
      for (const sz of [-1, 1]) {
        b.blk("main", -W - 0.3, -5, sz * 4 * s - 0.6 * s, W + 0.3, 0, sz * 4 * s + 0.6 * s);
        for (const sx of [-1, 1]) b.cyl("wood", sx * (W + 0.1), 0, sz * 4.4 * s, 0.14 * s, 0.14 * s, 2.8 * s, 6);
      }
      c.mover("lower", [0, 0, -3.4 * s], [-1.2, 0, 0], true, (mb) => {
        plankDeck(mb, -3.4 * s, 3.4 * s, W - 0.1, s, "wood");
        for (const sx of [-1, 1]) mb.blk("woodDark", sx * (W - 0.25) - 0.08, -0.3, -3.4 * s, sx * (W - 0.25) + 0.08, -0.08, 3.4 * s);
        for (const sx of [-1, 1]) mb.rod("rope", [sx * (W - 0.2), 0.05, 3.3 * s], [sx * (W + 0.1), 2.7 * s, 4.4 * s], 0.025 * s);
      });
    }
    // railings
    const railSlot = style === "east_asian" ? "paint" : "wood";
    for (const sx of [-1, 1]) {
      for (const [z0, z1] of deckRange) {
        const n = Math.max(2, Math.round((z1 - z0) / (1.8 * s)));
        for (let i = 0; i <= n; i++) b.blk(railSlot, sx * W - 0.06, 0, z0 + ((z1 - z0) * i) / n - 0.06, sx * W + 0.06, 1.05 * s, z0 + ((z1 - z0) * i) / n + 0.06);
        b.blk(railSlot, sx * W - 0.07, 0.95 * s, z0, sx * W + 0.07, 1.1 * s, z1);
        b.blk(railSlot, sx * W - 0.04, 0.5 * s, z0, sx * W + 0.04, 0.58 * s, z1);
      }
    }
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) b.cyl(style === "east_asian" ? "paint2" : "woodDark", sx * W, -0.3, sz * L, 0.14 * s, 0.12 * s, 2.8 * s, 8);
    return;
  }
  // masonry bridge: a side elevation with arches (flat spans for Egypt) extruded across the width
  const egypt = style === "ancient_egypt";
  const spans = 3;
  const bottom = -6.5 * s;
  const span = (2 * L - 2.4 * s) / spans;
  const pier = 2.2 * s;
  const outline: V2[] = [
    [-L - 1.2 * s, 0],
    [L + 1.2 * s, 0],
    [L + 1.2 * s, bottom],
  ];
  for (let k = spans - 1; k >= 0; k--) {
    const z0 = -L + 1.2 * s + k * span + pier / 2;
    const z1 = z0 + span - pier;
    const rise = Math.min((z1 - z0) / 2, 5.2 * s);
    const springY = -1.3 * s - rise;
    outline.push([z1, bottom], [z1, springY]);
    if (egypt || style === "mesoamerican") outline.push([z1, -1.4 * s], [z0, -1.4 * s]);
    else {
      for (let i = 1; i < 12; i++) {
        const a = (i / 12) * Math.PI;
        outline.push([(z0 + z1) / 2 + Math.cos(a) * ((z1 - z0) / 2), springY + Math.sin(a) * rise]);
      }
    }
    outline.push([z0, springY], [z0, bottom]);
  }
  outline.push([-L - 1.2 * s, bottom]);
  b.prism("main", outline, W * 2, xform(W, 0, 0, -Math.PI / 2));
  // parapets with coping, cutwaters at the piers, a paved deck
  for (const sx of [-1, 1]) {
    b.blk("main", sx * W - 0.3 * s, 0, -L - 1.2 * s, sx * W + (sx > 0 ? 0.05 : -0.05), 0.85 * s, L + 1.2 * s);
    b.blk("trim", sx * W - 0.36 * s, 0.85 * s, -L - 1.2 * s, sx * W + (sx > 0 ? 0.1 : -0.1), 1.02 * s, L + 1.2 * s);
    b.blk("trim", sx * W - 0.05, -1.3 * s, -L - 1.2 * s, sx * W + sx * 0.25, -1.05 * s, L + 1.2 * s);
  }
  b.blk("trim", -W, -0.02, -L - 1.2 * s, W, 0.04, L + 1.2 * s);
  for (let k = 1; k < spans; k++) {
    const z = -L + 1.2 * s + k * span;
    // cutwaters: triangular prisms (profile in z/x) rising from the river bed
    for (const sx of [-1, 1]) b.prism("main2", [[0, 0], [pier / 2, sx * 1.4 * s], [pier, 0]], -bottom - 1.6 * s, basis([0, 0, 1], [1, 0, 0], [0, 1, 0], [sx * W, bottom, z - pier / 2]));
  }
  if (!egypt) {
    // end piers crowned by lamps or finials
    for (const sz of [-1, 1])
      for (const sx of [-1, 1]) {
        b.blk("trim", sx * W - 0.4 * s, 0, sz * (L + 0.6 * s) - 0.4 * s, sx * W + 0.4 * s, 1.9 * s, sz * (L + 0.6 * s) + 0.4 * s);
        b.lathe("trim", sx * W, 1.9 * s, sz * (L + 0.6 * s), [[0.42 * s, 0], [0.42 * s, 0.12 * s], [0.25 * s, 0.25 * s], [0.12 * s, 0.7 * s], [0.001, 0.85 * s]], 8);
      }
  }
  if (egypt) {
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
      b.rectLoft("trim", sx * W, sz * (L + 0.6 * s), 0.45 * s, 0.45 * s, [
        { o: 0, y: 0 },
        { o: -0.15 * s, y: 2.2 * s },
      ]);
      b.lathe("gold", sx * W, 2.2 * s, sz * (L + 0.6 * s), [[0.3 * s, 0], [0.001, 0.45 * s]], 4, Math.PI / 4);
    }
  }
}

function plankDeck(b: GeoBuilder, z0: number, z1: number, W: number, s: number, slot: "wood" | "paint") {
  const plank = 0.3 * s;
  const n = Math.max(1, Math.floor((z1 - z0) / plank));
  for (let i = 0; i < n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    b.blk(i % 4 === 2 ? "woodDark" : slot === "paint" ? "wood" : slot, -W - 0.05, -0.12, z + 0.015, W + 0.05, 0, z + (z1 - z0) / n - 0.015);
  }
  for (const sx of [-1, 0, 1]) b.blk("woodDark", sx * (W - 0.3) - 0.1, -0.4, z0, sx * (W - 0.3) + 0.1, -0.12, z1);
}

function steelBridge(b: GeoBuilder, L: number, W: number, s: number, style: string) {
  b.blk(style === "futuristic" ? "trim" : "main", -W, -0.9 * s, -L - 1, W, 0, L + 1);
  b.blk("trim", -W + 0.1, -0.02, -L - 1, W - 0.1, 0.03, L + 1);
  for (const sz of [-1, 1]) b.blk("main", -W - 0.4, -6, sz * L * 0.45 - 0.8 * s, W + 0.4, -0.9 * s, sz * L * 0.45 + 0.8 * s);
  if (style === "futuristic") {
    for (const sx of [-1, 1]) {
      b.blk("glass", sx * W - 0.03, 0, -L - 1, sx * W + 0.03, 1.1 * s, L + 1);
      b.blk("glow", sx * W - 0.05, -0.05, -L - 1, sx * W + 0.05, 0.05, L + 1);
    }
    // gateway rings at both ends
    for (const sz of [-1, 1]) {
      b.add("trim", new THREE.TorusGeometry(W + 0.4 * s, 0.22 * s, 8, 28, Math.PI), xform(0, 0, sz * (L + 0.5)));
      b.add("glow", new THREE.TorusGeometry(W + 0.4 * s, 0.06 * s, 4, 28, Math.PI), xform(0, 0, sz * (L + 0.5) + sz * 0.2 * s));
    }
    return;
  }
  // Warren trusses either side
  const panels = 8;
  const H = 3.4 * s;
  for (const sx of [-1, 1]) {
    const x = sx * (W + 0.05);
    b.beam("metal", [x, H, -L], [x, H, L], 0.28 * s);
    b.beam("metal", [x, 0.1, -L], [x, 0.1, L], 0.28 * s);
    for (let i = 0; i < panels; i++) {
      const z0 = -L + (i * 2 * L) / panels;
      const z1 = z0 + (2 * L) / panels;
      b.beam("metal", [x, 0.1, z0], [x, H, (z0 + z1) / 2], 0.18 * s);
      b.beam("metal", [x, H, (z0 + z1) / 2], [x, 0.1, z1], 0.18 * s);
    }
  }
  for (let i = 0; i <= panels; i += 2) b.beam("metal", [-W, H, -L + (i * 2 * L) / panels], [W, H, -L + (i * 2 * L) / panels], 0.16 * s);
}

// ------------------------------------------------------------------------------------------------ aqueduct

export function aqueduct(c: Ctx) {
  const { b, r, h, s, style } = c;
  const L = r * 0.97;
  const D = 1.6 * s;
  if (style === "modern" || style === "industrial" || style === "futuristic") {
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const x = -L + (i * 2 * L) / n;
      b.rectLoft("trim", x, 0, 0.5 * s, 0.8 * s, [
        { o: 0.2 * s, y: -0.3 },
        { o: 0, y: h * 0.72 },
        { o: 0.3 * s, y: h * 0.78 },
      ]);
    }
    b.cyl(style === "futuristic" ? "glass" : "metal", -L, h * 0.78 + 1.0 * s, 0, 1.0 * s, 1.0 * s, 2 * L, 16, 0, 0, -Math.PI / 2);
    if (style === "futuristic") b.cyl("glow", -L, h * 0.78 + 1.0 * s, 0, 0.35 * s, 0.35 * s, 2 * L, 8, 0, 0, -Math.PI / 2);
    return;
  }
  const flat = style === "ancient_egypt" || style === "mesoamerican";
  const tier = (y0: number, y1: number, n: number, depth: number, shape: "round" | "pointed" | "flat") => {
    const outline: V2[] = [
      [L, y1],
      [-L, y1],
      [-L, y0],
    ];
    const bay = (2 * L) / n;
    const pier = bay * 0.26;
    for (let i = 0; i < n; i++) {
      const x0 = -L + i * bay + pier / 2;
      const x1 = x0 + bay - pier;
      const top = y1 - (y1 - y0) * 0.18;
      const spring = shape === "flat" ? top : top - (x1 - x0) / 2;
      outline.push([x0, y0], [x0, spring]);
      if (shape === "flat") outline.push([x1, top]);
      else
        for (let k = 1; k < 10; k++) {
          const a = Math.PI - (k / 10) * Math.PI;
          const yy = shape === "pointed" ? spring + Math.sin(a) * ((x1 - x0) / 2) * 1.2 : spring + Math.sin(a) * ((x1 - x0) / 2);
          outline.push([(x0 + x1) / 2 + Math.cos(a) * ((x1 - x0) / 2), yy]);
        }
      outline.push([x1, spring], [x1, y0]);
    }
    outline.push([L, y0]);
    b.prism("main", outline, depth, xform(0, 0, -depth / 2));
  };
  const shape = flat ? "flat" : style === "medieval" ? "pointed" : "round";
  tier(-0.5, h * 0.62, 6, D * 1.2, shape);
  b.blk("trim", -L, h * 0.62, -D * 0.7, L, h * 0.66, D * 0.7);
  tier(h * 0.66, h * 0.9, 12, D, shape);
  // the water channel (specus) on top
  b.blk("trim", -L, h * 0.9, -D * 0.6, L, h * 0.93, D * 0.6);
  for (const sz of [-1, 1]) b.blk("main", -L, h * 0.93, sz * D * 0.55 - 0.15 * s, L, h, sz * D * 0.55 + 0.15 * s);
  b.blk("water", -L, h * 0.93, -D * 0.4, L, h * 0.97, D * 0.4);
}
