import * as THREE from "three";
import type { Biome, ScatterKind } from "../../../contracts/world3d";
import { SCATTER } from "../../core/catalog";
import { mulberry32, type Rng } from "../../core/prng";
import { BARK_PERIOD, CELLS, type Cell } from "./atlas";

/*
 * Procedural species for every ScatterKind, built once per variant at the kind's full size (SCATTER[kind].size[1]
 * metres tall; instances scale down). Deterministic (seeded prng). Every vertex carries:
 *   position, normal, uv (into the foliage atlas, ./atlas.ts), color (baked AO / tint), aWind = (bend, flutter):
 *   bend grows from 0 at the root to 1 at the top (how far the wind sways it), flutter marks leaf cards (fast jitter).
 * Leaf cards get "crown" normals (pointing out of the canopy) so foliage shades as a soft volume, not as flat planes.
 *
 * Materials (see ./Vegetation.tsx): "foliage" (atlas, alpha-tested, trees/bushes/reeds/flowers/crops/cactus/...),
 * "grass" (vertex colours only, opaque), "rock" (photo rock texture, box-projected UVs), "gem" (crystal, ice).
 */

export type VegMaterial = "foliage" | "grass" | "rock" | "gem";

export interface Species {
  kind: ScatterKind;
  material: VegMaterial;
  geometry: THREE.BufferGeometry;
  /** natural full height (m) at instance scale 1 */
  height: number;
  /** how much the kind sways (metres at the top at full wind) */
  sway: number;
  /** leaves/blades flutter amount */
  flutter: number;
  /** sink below the ground (m at scale 1) so roots and rock bases don't float on slopes */
  sink: number;
}

type V3 = [number, number, number];

class Builder {
  pos: number[] = [];
  nrm: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  wind: number[] = [];
  idx: number[] = [];
  vertex(p: V3, n: V3, uv: [number, number], c: V3, bend: number, flutter: number): number {
    this.pos.push(p[0], p[1], p[2]);
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    this.nrm.push(n[0] / l, n[1] / l, n[2] / l);
    this.uv.push(uv[0], uv[1]);
    this.col.push(c[0], c[1], c[2]);
    this.wind.push(bend, flutter);
    return this.pos.length / 3 - 1;
  }
  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c);
  }
  quad(a: number, b: number, c: number, d: number) {
    // a b / d c  (counter-clockwise a→b→c)
    this.idx.push(a, b, c, a, c, d);
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("aWind", new THREE.Float32BufferAttribute(this.wind, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// ---------------------------------------------------------------- vector helpers
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cellUv = (c: Cell, u: number, v: number): [number, number] => [c.u0 + (c.u1 - c.u0) * u, c.v0 + (c.v1 - c.v0) * v];
const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
const hexRgb = (hex: string): V3 => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

// ---------------------------------------------------------------- primitives

/**
 * A tapered tube along a polyline with bark UVs tiled every `period` metres (rings are duplicated at each period so the
 * atlas strip repeats without a seam).
 */
function tube(b: Builder, pts: V3[], radii: number[], sides: number, cell: Cell, period: number, color: (t: number) => V3, bendAt: (p: V3) => number, cap = true) {
  // arc lengths
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
  const total = lens[lens.length - 1] || 1;
  // stations: every point plus each multiple of the period (duplicated there)
  const stations: { s: number; dupe: boolean }[] = pts.map((_, i) => ({ s: lens[i], dupe: false }));
  for (let k = 1; k * period < total; k++) stations.push({ s: k * period, dupe: true });
  stations.sort((a, c) => a.s - c.s);
  const at = (s: number) => {
    let i = 1;
    while (i < lens.length - 1 && lens[i] < s) i++;
    const t = (s - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1]);
    return { p: lerp3(pts[i - 1], pts[i], t), r: radii[i - 1] + (radii[i] - radii[i - 1]) * t, dir: norm(sub(pts[i], pts[i - 1])) };
  };
  let prevRing: number[] | null = null;
  let refSide: V3 = [1, 0, 0];
  for (const st of stations) {
    const { p, r, dir } = at(st.s);
    // a stable frame: side ⟂ dir, carried along (parallel transport-ish)
    let side = sub(refSide, mul(dir, dot(refSide, dir)));
    if (Math.hypot(...side) < 1e-4) side = Math.abs(dir[1]) < 0.9 ? norm(cross(dir, [0, 1, 0])) : [1, 0, 0];
    side = norm(side);
    refSide = side;
    const other = norm(cross(dir, side));
    const makeRing = (v: number) => {
      const ring: number[] = [];
      for (let k = 0; k <= sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const n = add(mul(side, Math.cos(a)), mul(other, Math.sin(a)));
        ring.push(b.vertex(add(p, mul(n, r)), n, cellUv(cell, k / sides, v), color(st.s / total), bendAt(p), 0));
      }
      return ring;
    };
    const frac = st.s / period - Math.floor(st.s / period);
    const vTop = st.dupe ? 1 : frac;
    const ring = makeRing(vTop);
    if (prevRing) for (let k = 0; k < sides; k++) b.quad(prevRing[k], prevRing[k + 1], ring[k + 1], ring[k]);
    prevRing = st.dupe ? makeRing(0) : ring;
  }
  if (cap && prevRing) {
    const top = at(total);
    const c = b.vertex(top.p, top.dir, cellUv(cell, 0.5, 0.5), color(1), bendAt(top.p), 0);
    for (let k = 0; k < sides; k++) b.tri(prevRing[k], prevRing[k + 1], c);
  }
}

/** A leaf card: centre `c`, width along `ax`, height along `ay`, UV into `cell`; normals blended toward `crownN`. */
function card(b: Builder, c: V3, ax: V3, ay: V3, w: number, h: number, cell: Cell, color: V3, bend: (p: V3) => number, crownN: (p: V3) => V3, flutter = 1, anchorBottom = false) {
  const fn = norm(cross(ax, ay));
  const corners: [number, number][] = [
    [-0.5, 0],
    [0.5, 0],
    [0.5, 1],
    [-0.5, 1],
  ];
  const ids = corners.map(([sx, sy]) => {
    const off = anchorBottom ? sy : sy - 0.5;
    const p = add(add(c, mul(ax, sx * w)), mul(ay, off * h));
    const cn = crownN(p);
    const n = norm(add(mul(cn, 0.75), mul(fn, dot(fn, cn) >= 0 ? 0.25 : -0.25)));
    return b.vertex(p, n, cellUv(cell, sx + 0.5, sy), color, bend(p), flutter);
  });
  b.quad(ids[0], ids[1], ids[2], ids[3]);
}

/** Two crossed vertical cards (a billboard-ish tuft readable from every side). */
function crossCards(b: Builder, base: V3, w: number, h: number, yaw: number, cell: Cell, color: V3, bend: (p: V3) => number, flutter = 1) {
  for (const a of [yaw, yaw + Math.PI / 2]) {
    const ax: V3 = [Math.cos(a), 0, Math.sin(a)];
    card(b, base, ax, [0, 1, 0], w, h, cell, color, bend, (p) => norm([p[0] - base[0], 0.8, p[2] - base[2]]), flutter, true);
  }
}

/** A thin tapered blade (grass, reed, stalk): `segs` segments from `base` along a drooping curve. */
function blade(b: Builder, base: V3, height: number, width: number, lean: number, yaw: number, segs: number, cell: Cell, colBase: V3, colTip: V3, bendScale: number, totalH: number) {
  const dir: V3 = [Math.cos(yaw), 0, Math.sin(yaw)];
  const side: V3 = [-Math.sin(yaw), 0, Math.cos(yaw)];
  let prev: [number, number] | null = null;
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    const bendOut = Math.sin(lean) * height * t * t;
    const p: V3 = add(add(base, mul(dir, bendOut)), [0, Math.cos(lean * t) * height * t, 0]);
    const w = width * (1 - t * 0.92);
    const c = lerp3(colBase, colTip, Math.pow(t, 0.8));
    const n = norm(add([0, 1, 0], mul(dir, -0.3)));
    const bend = Math.min(1, (p[1] / totalH) * bendScale);
    const l = b.vertex(add(p, mul(side, -w / 2)), n, cellUv(cell, 0.2, t), c, bend, 0.4 * t);
    const r = b.vertex(add(p, mul(side, w / 2)), n, cellUv(cell, 0.8, t), c, bend, 0.4 * t);
    if (prev) b.quad(prev[0], prev[1], r, l);
    prev = [l, r];
  }
}

function hash3(x: number, y: number, z: number, seed: number) {
  let h = seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise3(x: number, y: number, z: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const f = (t: number) => t * t * (3 - 2 * t);
  const xf = f(x - xi);
  const yf = f(y - yi);
  const zf = f(z - zi);
  const L = (a: number, c: number, t: number) => a + (c - a) * t;
  const h = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return L(L(L(h(0, 0, 0), h(1, 0, 0), xf), L(h(0, 1, 0), h(1, 1, 0), xf), yf), L(L(h(0, 0, 1), h(1, 0, 1), xf), L(h(0, 1, 1), h(1, 1, 1), xf), yf), zf);
}

// ---------------------------------------------------------------- species

const WHITE: V3 = [1, 1, 1];

function palm(rng: Rng, H: number): THREE.BufferGeometry {
  const b = new Builder();
  const lean = H * range(rng, 0.05, 0.16);
  const wob = range(rng, -0.3, 0.3);
  const top: V3 = [lean, H * 0.88, wob];
  const pts: V3[] = [];
  const radii: number[] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push([lean * Math.pow(t, 1.7), H * 0.88 * t, wob * Math.sin(t * Math.PI)]);
    const flare = t < 0.06 ? (0.06 - t) * 3 : 0;
    // leaf-scar rings: a gentle ripple along the trunk
    radii.push(H * (0.021 - 0.009 * t) + flare + 0.012 * Math.sin(t * 60));
  }
  const bend = (p: V3) => Math.min(1, Math.pow(Math.max(0, p[1]) / (H * 0.95), 1.6));
  tube(b, pts, radii, 9, CELLS.barkPalm, BARK_PERIOD.barkPalm, (t) => lerp3([0.42, 0.37, 0.32], [0.62, 0.55, 0.47], Math.min(1, t * 2.5)), bend, false);
  // crown: arching fronds, a V-fold along each rachis
  const fronds = 17 + Math.floor(rng() * 5);
  const crownN = (p: V3) => norm(add(sub(p, top), [0, 1.2, 0]));
  for (let k = 0; k < fronds; k++) {
    const az = (k / fronds) * Math.PI * 2 + range(rng, -0.2, 0.2);
    // young fronds stand up, old ones arch far down; together they make the palm's starburst
    const rise = k % 3 === 0 ? range(rng, 0.9, 1.3) : range(rng, 0.2, 0.8);
    const L = H * range(rng, 0.32, 0.42);
    const out: V3 = [Math.cos(az), 0, Math.sin(az)];
    const sideH: V3 = [-Math.sin(az), 0, Math.cos(az)];
    const segs = 8;
    let p: V3 = add(top, mul(out, 0.2));
    let prev: number[] | null = null;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const el = rise - Math.pow(t, 1.3) * (1.9 + rise * 0.6);
      const dir = norm(add(mul(out, Math.cos(el)), [0, Math.sin(el), 0]));
      if (s > 0) p = add(p, mul(dir, L / segs));
      const up = norm(cross(sideH, dir));
      const w = L * 0.3 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05)), 0.6);
      const fold = 0.45 - 1.0 * t; // a V near the base, leaflets hanging from the rachis toward the tip
      const lEdge = add(p, add(mul(sideH, -w * Math.cos(fold)), mul(up, w * Math.sin(fold))));
      const rEdge = add(p, add(mul(sideH, w * Math.cos(fold)), mul(up, w * Math.sin(fold))));
      const c: V3 = lerp3([0.8, 0.82, 0.7], WHITE, t);
      const ids = [
        b.vertex(lEdge, crownN(lEdge), cellUv(CELLS.frond, t, 0.02), c, bend(lEdge), 1),
        b.vertex(p, crownN(p), cellUv(CELLS.frond, t, 0.5), c, bend(p), 0.5),
        b.vertex(rEdge, crownN(rEdge), cellUv(CELLS.frond, t, 0.98), c, bend(rEdge), 1),
      ];
      if (prev) {
        b.quad(prev[0], prev[1], ids[1], ids[0]);
        b.quad(prev[1], prev[2], ids[2], ids[1]);
      }
      prev = ids;
    }
  }
  // a few dead fronds hanging against the trunk
  for (let k = 0; k < 3; k++) {
    const az = range(rng, 0, Math.PI * 2);
    const out: V3 = [Math.cos(az), 0, Math.sin(az)];
    const base = add(top, [0, -0.3, 0]);
    const L = H * 0.22;
    const tip = add(add(base, mul(out, L * 0.35)), [0, -L * 0.9, 0]);
    const ax = norm(cross(sub(tip, base), [0, 1, 0]));
    const mid = lerp3(base, tip, 0.5);
    card(b, mid, norm(sub(tip, base)), ax, L, L * 0.45, CELLS.deadFrond, [0.9, 0.85, 0.8], bend, (q) => norm(add(sub(q, top), [0, 0.3, 0])), 0.3);
  }
  // date clusters
  for (let k = 0; k < 3; k++) {
    const az = range(rng, 0, Math.PI * 2);
    const c = add(top, [Math.cos(az) * 0.35, -0.45, Math.sin(az) * 0.35]);
    const ico = new THREE.IcosahedronGeometry(0.2, 0);
    const pa = ico.getAttribute("position");
    const base = b.pos.length / 3;
    for (let i = 0; i < pa.count; i++) {
      const v: V3 = [pa.getX(i), pa.getY(i) * 1.3, pa.getZ(i)];
      b.vertex(add(c, v), norm(v), cellUv(CELLS.plain, 0.5, 0.5), [0.35, 0.16, 0.06], bend(c), 0);
    }
    for (let i = 0; i < pa.count; i += 3) b.tri(base + i, base + i + 1, base + i + 2);
    ico.dispose();
  }
  return b.build();
}

function conifer(rng: Rng, H: number): THREE.BufferGeometry {
  const b = new Builder();
  const bend = (p: V3) => Math.min(1, Math.pow(Math.max(0, p[1]) / H, 1.5));
  tube(b, [[0, 0, 0], [0, H * 0.5, 0], [0, H * 0.97, 0]], [H * 0.022, H * 0.012, H * 0.002], 7, CELLS.bark, BARK_PERIOD.bark, (t) => lerp3([0.7, 0.66, 0.62], WHITE, t), bend);
  const whorls = 13;
  const crownN = (p: V3) => norm([p[0], 0.55 + 0.3 * (p[1] / H), p[2]]);
  for (let w = 0; w < whorls; w++) {
    const t = w / (whorls - 1);
    const y = H * (0.16 + 0.8 * t) + range(rng, -0.2, 0.2);
    const len = Math.pow(1 - t, 0.85) * H * 0.3 + 0.45;
    const count = t > 0.85 ? 4 : 6;
    const shade = 0.62 + 0.38 * t; // lower branches sit in the canopy's shade
    for (let k = 0; k < count; k++) {
      const az = (k / count) * Math.PI * 2 + w * 0.7 + range(rng, -0.25, 0.25);
      const out: V3 = [Math.cos(az), 0, Math.sin(az)];
      const droop = 0.18 + 0.35 * (1 - t) + range(rng, -0.05, 0.08);
      const dir = norm(add(out, [0, -droop, 0]));
      const centre = add([0, y, 0], mul(dir, len * 0.52));
      const sideH: V3 = [-Math.sin(az), 0, Math.cos(az)];
      for (const roll of [-0.55, 0.45]) {
        const ay = norm(add(mul(sideH, Math.cos(roll)), [0, Math.sin(roll), 0]));
        const col: V3 = [shade * 0.95, shade, shade * 0.95];
        card(b, centre, dir, ay, len * 1.08, len * 0.95, CELLS.needles, col, bend, crownN, 0.6);
      }
    }
  }
  crossCards(b, [0, H * 0.9, 0], H * 0.12, H * 0.13, rng() * Math.PI, CELLS.needles, WHITE, bend, 0.5);
  return b.build();
}

function broadleaf(rng: Rng, H: number, birch: boolean): THREE.BufferGeometry {
  const b = new Builder();
  const bend = (p: V3) => Math.min(1, Math.pow(Math.max(0, p[1]) / H, 1.4));
  const barkCell = birch ? CELLS.barkBirch : CELLS.bark;
  const period = birch ? BARK_PERIOD.barkBirch : BARK_PERIOD.bark;
  const trunkTop = H * (birch ? 0.7 : 0.45);
  const lean: V3 = [range(rng, -0.4, 0.4), 0, range(rng, -0.4, 0.4)];
  tube(b, [[0, 0, 0], add([0, trunkTop * 0.5, 0], mul(lean, 0.3)), add([0, trunkTop, 0], lean)], birch ? [H * 0.016, H * 0.012, H * 0.008] : [H * 0.03, H * 0.022, H * 0.016], 7, barkCell, period, (t) => lerp3([0.72, 0.7, 0.66], WHITE, Math.min(1, t * 2)), bend, false);
  // crown blobs at the ends of a few limbs
  const blobs: { c: V3; r: V3 }[] = [];
  const mainC: V3 = add([0, birch ? H * 0.68 : H * 0.66, 0], lean);
  blobs.push({ c: mainC, r: birch ? [H * 0.17, H * 0.28, H * 0.17] : [H * 0.3, H * 0.24, H * 0.3] });
  const limbs = birch ? 2 : 4;
  for (let k = 0; k < limbs; k++) {
    const az = (k / limbs) * Math.PI * 2 + range(rng, -0.4, 0.4);
    const out: V3 = [Math.cos(az), 0, Math.sin(az)];
    const end = add(add([0, trunkTop + H * range(rng, 0.12, 0.2), 0], lean), mul(out, H * (birch ? 0.1 : 0.2)));
    tube(b, [add([0, trunkTop * 0.92, 0], lean), end], [H * (birch ? 0.007 : 0.014), H * 0.005], 5, barkCell, period, () => [0.85, 0.83, 0.8], bend);
    blobs.push({ c: add(end, [0, H * 0.04, 0]), r: birch ? [H * 0.11, H * 0.14, H * 0.11] : [H * 0.2, H * 0.16, H * 0.2] });
  }
  const cards = birch ? 64 : 84;
  const cell = birch ? CELLS.birchLeaves : CELLS.leaves;
  const crownCentre = mainC;
  for (let k = 0; k < cards; k++) {
    const blob = blobs[k % blobs.length];
    // a point on/in the ellipsoid shell
    const u = rng() * 2 - 1;
    const a = rng() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const dirS: V3 = [s * Math.cos(a), u, s * Math.sin(a)];
    const depth = range(rng, 0.62, 1.0);
    const c = add(blob.c, [dirS[0] * blob.r[0] * depth, dirS[1] * blob.r[1] * depth, dirS[2] * blob.r[2] * depth]);
    const outward = norm(sub(c, crownCentre));
    const rnd = norm([rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]);
    const fn = norm(add(outward, mul(rnd, 0.9)));
    let ax = norm(cross([0, 1, 0], fn));
    if (!Number.isFinite(ax[0]) || Math.hypot(...ax) < 0.1) ax = [1, 0, 0];
    const ay = norm(cross(fn, ax));
    const size = H * (birch ? range(rng, 0.1, 0.14) : range(rng, 0.15, 0.21));
    // inner and lower cards are darker (self-shadowing inside the canopy)
    const ao = 0.55 + 0.45 * depth * (0.7 + 0.3 * Math.max(0, dirS[1]));
    card(b, c, ax, ay, size, size, cell, [ao, ao, ao * 0.95], bend, (p) => norm(add(sub(p, crownCentre), [0, H * 0.08, 0])), 1);
  }
  return b.build();
}

function deadTree(rng: Rng, H: number): THREE.BufferGeometry {
  const b = new Builder();
  const bend = (p: V3) => Math.min(1, Math.pow(Math.max(0, p[1]) / H, 1.5)) * 0.4;
  const grey = (t: number): V3 => lerp3([0.7, 0.68, 0.66], [0.95, 0.93, 0.9], t);
  const branch = (from: V3, dir: V3, len: number, r: number, depth: number) => {
    const mid = add(add(from, mul(dir, len * 0.5)), [range(rng, -0.3, 0.3), 0, range(rng, -0.3, 0.3)]);
    const end = add(from, mul(dir, len));
    tube(b, [from, mid, end], [r, r * 0.7, r * 0.25], depth === 0 ? 7 : 4, CELLS.barkDead, BARK_PERIOD.barkDead, grey, bend);
    if (depth >= 2) return;
    const n = depth === 0 ? 5 : 3;
    for (let k = 0; k < n; k++) {
      const t = depth === 0 ? range(rng, 0.45, 0.9) : range(rng, 0.4, 0.8);
      const start = lerp3(from, end, t);
      const az = rng() * Math.PI * 2;
      const up = depth === 0 ? range(rng, 0.2, 0.9) : range(rng, 0.0, 0.8);
      const d = norm(add(mul([Math.cos(az), 0, Math.sin(az)], 1), [0, up, 0]));
      branch(start, norm(add(d, mul(dir, 0.3))), len * range(rng, 0.35, 0.55), r * 0.45, depth + 1);
    }
  };
  branch([0, 0, 0], norm([range(rng, -0.1, 0.1), 1, range(rng, -0.1, 0.1)]), H, H * 0.028, 0);
  return b.build();
}

function bush(rng: Rng, H: number): THREE.BufferGeometry {
  const b = new Builder();
  const centre: V3 = [0, H * 0.45, 0];
  const bend = (p: V3) => Math.min(1, Math.max(0, p[1]) / H) * 0.8;
  for (let k = 0; k < 34; k++) {
    const u = rng() * 1.2 - 0.2;
    const a = rng() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    const d: V3 = [s * Math.cos(a), u, s * Math.sin(a)];
    const depth = range(rng, 0.5, 1);
    const c = add(centre, [d[0] * H * 0.6 * depth, d[1] * H * 0.45 * depth, d[2] * H * 0.6 * depth]);
    const fn = norm(add(d, [rng() - 0.5, rng() - 0.5, rng() - 0.5]));
    let ax = norm(cross([0, 1, 0], fn));
    if (Math.hypot(...ax) < 0.1) ax = [1, 0, 0];
    const ay = norm(cross(fn, ax));
    const size = H * range(rng, 0.45, 0.65);
    const ao = 0.55 + 0.45 * depth;
    card(b, c, ax, ay, size, size, CELLS.bushLeaves, [ao, ao, ao], bend, (p) => norm(add(sub(p, centre), [0, H * 0.2, 0])), 1);
  }
  return b.build();
}

function reeds(rng: Rng, H: number, papyrus: boolean): THREE.BufferGeometry {
  const b = new Builder();
  const base: V3 = [0.33, 0.4, 0.18];
  const tip: V3 = papyrus ? [0.56, 0.6, 0.3] : [0.62, 0.58, 0.32];
  const n = 16;
  for (let k = 0; k < n; k++) {
    const a = rng() * Math.PI * 2;
    const r = range(rng, 0, 0.3);
    blade(b, [Math.cos(a) * r, 0, Math.sin(a) * r], H * range(rng, 0.45, 0.85), range(rng, 0.03, 0.05), range(rng, 0.15, 0.6), a, 4, CELLS.grassCard, base, tip, 1, H);
  }
  const stems = papyrus ? 5 : 4;
  for (let k = 0; k < stems; k++) {
    const a = rng() * Math.PI * 2;
    const r = range(rng, 0, 0.25);
    const h = H * range(rng, 0.8, 1.0);
    const p0: V3 = [Math.cos(a) * r, 0, Math.sin(a) * r];
    blade(b, p0, h, 0.03, range(rng, 0.02, 0.12), a, 3, CELLS.grassCard, [0.3, 0.42, 0.18], [0.5, 0.6, 0.3], 1, H);
    const top = add(p0, [Math.cos(a) * Math.sin(0.08) * h * 0.5, h * 0.98, Math.sin(a) * Math.sin(0.08) * h * 0.5]);
    const bend = () => 1;
    if (papyrus) {
      const yaw = rng() * Math.PI;
      for (let k2 = 0; k2 < 3; k2++) {
        const a2 = yaw + (k2 * Math.PI) / 3;
        const tilt = (k2 - 1) * 0.35;
        const ax: V3 = [Math.cos(a2), 0, Math.sin(a2)];
        const ay = norm([Math.sin(a2) * tilt, 1, -Math.cos(a2) * tilt]);
        const c: V3 = add(top, [0, -0.05, 0]);
        card(b, c, ax, ay, 0.55, 0.5, CELLS.papyrus, [0.8, 0.85, 0.75], bend, (p) => norm([p[0] - c[0], 0.9, p[2] - c[2]]), 0.8, true);
      }
    }
    else crossCards(b, add(top, [0, -0.35, 0]), 0.14, 0.5, rng() * Math.PI, CELLS.cattail, WHITE, bend, 0.2);
  }
  return b.build();
}

function tallGrass(rng: Rng, H: number, blades: number, palette: { base: V3; tip: V3 }): THREE.BufferGeometry {
  const b = new Builder();
  for (let k = 0; k < blades; k++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 0.45;
    const tint = range(rng, 0.85, 1.12);
    blade(b, [Math.cos(a) * r, 0, Math.sin(a) * r], H * range(rng, 0.45, 1), range(rng, 0.04, 0.07), range(rng, 0.2, 0.8), a + range(rng, -0.6, 0.6), 3, CELLS.grassCard, mul(palette.base, tint), mul(palette.tip, tint), 1, H);
  }
  return b.build();
}

function flowers(rng: Rng, H: number, color: V3): THREE.BufferGeometry {
  const b = new Builder();
  for (let k = 0; k < 7; k++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 0.22;
    const h = H * range(rng, 0.55, 1);
    const p0: V3 = [Math.cos(a) * r, 0, Math.sin(a) * r];
    blade(b, p0, h, 0.012, range(rng, 0.05, 0.3), a, 2, CELLS.grassCard, [0.25, 0.4, 0.15], [0.35, 0.5, 0.2], 1, H);
    const head = add(p0, [Math.cos(a) * h * 0.08, h, Math.sin(a) * h * 0.08]);
    const ax: V3 = norm([rng() - 0.5, 0.2, rng() - 0.5]);
    const fn = norm([rng() * 0.6 - 0.3, 1, rng() * 0.6 - 0.3]);
    const ay = norm(cross(fn, ax));
    const s = H * range(rng, 0.22, 0.32);
    card(b, head, norm(cross(ay, fn)), ay, s, s, CELLS.flower, color, () => 1, () => fn, 0.6);
  }
  return b.build();
}

function crop(rng: Rng, H: number): THREE.BufferGeometry {
  const b = new Builder();
  for (let k = 0; k < 16; k++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 0.3;
    const h = H * range(rng, 0.75, 1);
    const p0: V3 = [Math.cos(a) * r, 0, Math.sin(a) * r];
    blade(b, p0, h * 0.75, 0.02, range(rng, 0.05, 0.25), a, 3, CELLS.grassCard, [0.55, 0.55, 0.25], [0.78, 0.7, 0.35], 1, H);
    const head = add(p0, [Math.cos(a) * h * 0.06, h * 0.72, Math.sin(a) * h * 0.06]);
    crossCards(b, head, 0.09, 0.28, rng() * Math.PI, CELLS.wheat, WHITE, () => 1, 0.5);
  }
  return b.build();
}

function cactus(rng: Rng, H: number): THREE.BufferGeometry {
  const b = new Builder();
  const column = (base: V3, h: number, r: number, green: V3) => {
    const sides = 14;
    const rings = 8;
    let prev: number[] | null = null;
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      const y = h * t;
      const rr = r * (t > 0.85 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.85) / 0.15, 2))) * 0.9 + 0.1 : 1);
      const ring: number[] = [];
      for (let k = 0; k <= sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const rib = 1 + 0.09 * Math.cos(a * 7);
        const n: V3 = [Math.cos(a), t > 0.85 ? (t - 0.85) * 4 : 0, Math.sin(a)];
        const c = mul(green, 0.8 + 0.25 * (rib - 0.91) / 0.18);
        ring.push(b.vertex([base[0] + Math.cos(a) * rr * rib, base[1] + y, base[2] + Math.sin(a) * rr * rib], n, cellUv(CELLS.plain, 0.5, 0.5), c, 0, 0));
      }
      if (prev) for (let k = 0; k < sides; k++) b.quad(prev[k], prev[k + 1], ring[k + 1], ring[k]);
      prev = ring;
    }
  };
  const green: V3 = [0.24, 0.38, 0.18];
  const r = H * 0.075;
  column([0, 0, 0], H, r, green);
  const arms = 1 + Math.floor(rng() * 2.5);
  for (let k = 0; k < arms; k++) {
    const az = rng() * Math.PI * 2;
    const y = H * range(rng, 0.35, 0.6);
    const out: V3 = [Math.cos(az), 0, Math.sin(az)];
    const elbow = add([0, y, 0], mul(out, r * 2.4));
    tube(b, [add([0, y, 0], mul(out, r * 0.5)), elbow, add(elbow, [0, r * 1.2, 0])], [r * 0.6, r * 0.62, r * 0.62], 10, CELLS.plain, 100, () => green, () => 0, false);
    column(add(elbow, [0, r * 1.1, 0]), H * range(rng, 0.2, 0.35), r * 0.62, green);
  }
  return b.build();
}

function rockGeometry(rng: Rng, size: number, detail: number, seed: number): THREE.BufferGeometry {
  // PolyhedronGeometry is already non-indexed: one flat-shadable triangle per face
  const ico = new THREE.IcosahedronGeometry(1, detail);
  const pa = ico.getAttribute("position");
  const sx = range(rng, 0.8, 1.35);
  const sy = range(rng, 0.45, 0.8);
  const sz = range(rng, 0.75, 1.25);
  const pos: number[] = [];
  const disp = (v: V3): V3 => {
    const n = vnoise3(v[0] * 1.6 + 3, v[1] * 1.6, v[2] * 1.6, seed) * 0.5 + vnoise3(v[0] * 3.4, v[1] * 3.4 + 7, v[2] * 3.4, seed + 1) * 0.28 + vnoise3(v[0] * 7, v[1] * 7, v[2] * 7 + 11, seed + 2) * 0.12;
    const r = 0.78 + n * 0.5;
    let y = v[1] * r * sy;
    // flatten the base and cut a sharp facet or two
    y = Math.max(y, -0.18 * sy);
    return [v[0] * r * sx * (size / 2), (y + 0.1 * sy) * (size / 2) * 1.2, v[2] * r * sz * (size / 2)];
  };
  for (let i = 0; i < pa.count; i++) pos.push(...disp([pa.getX(i), pa.getY(i), pa.getZ(i)]));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // box-projected UVs per face (metres), baked AO toward the base, and no wind
  const uv: number[] = [];
  const col: number[] = [];
  const wind: number[] = [];
  const nrm = g.getAttribute("normal");
  const P = g.getAttribute("position");
  const maxY = size * 0.6;
  for (let i = 0; i < P.count; i += 3) {
    const fn = norm([nrm.getX(i) + nrm.getX(i + 1) + nrm.getX(i + 2), nrm.getY(i) + nrm.getY(i + 1) + nrm.getY(i + 2), nrm.getZ(i) + nrm.getZ(i + 1) + nrm.getZ(i + 2)]);
    const axis = Math.abs(fn[0]) > Math.abs(fn[1]) && Math.abs(fn[0]) > Math.abs(fn[2]) ? 0 : Math.abs(fn[1]) > Math.abs(fn[2]) ? 1 : 2;
    for (let k = 0; k < 3; k++) {
      const x = P.getX(i + k);
      const y = P.getY(i + k);
      const z = P.getZ(i + k);
      if (axis === 0) uv.push(z, y);
      else if (axis === 1) uv.push(x, z);
      else uv.push(x, y);
      const ao = 0.55 + 0.45 * Math.min(1, Math.max(0, y / maxY + 0.35));
      col.push(ao, ao, ao);
      wind.push(0, 0);
    }
  }
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("aWind", new THREE.Float32BufferAttribute(wind, 2));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  ico.dispose();
  return g;
}

function gems(rng: Rng, H: number, ice: boolean): THREE.BufferGeometry {
  const b = new Builder();
  const n = ice ? 5 : 7;
  for (let k = 0; k < n; k++) {
    const az = rng() * Math.PI * 2;
    const tilt = k === 0 ? 0.05 : range(rng, 0.2, 0.7);
    const dir = norm([Math.cos(az) * Math.sin(tilt), Math.cos(tilt), Math.sin(az) * Math.sin(tilt)]);
    const len = H * (k === 0 ? 1 : range(rng, 0.35, 0.75));
    const r = H * (ice ? range(rng, 0.05, 0.1) : range(rng, 0.04, 0.08));
    const sides = ice ? 4 + Math.floor(rng() * 3) : 6;
    const base: V3 = [Math.cos(az) * r * 0.8, -0.1, Math.sin(az) * r * 0.8];
    let sideV = norm(cross(dir, [0, 0, 1]));
    if (Math.hypot(...sideV) < 0.1) sideV = [1, 0, 0];
    const other = norm(cross(dir, sideV));
    const ringAt = (d: number, rr: number) => {
      const ring: V3[] = [];
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2 + (ice ? range(rng, -0.2, 0.2) : 0);
        ring.push(add(add(base, mul(dir, d)), add(mul(sideV, Math.cos(a) * rr), mul(other, Math.sin(a) * rr))));
      }
      return ring;
    };
    const bottom = ringAt(0, r);
    const shoulder = ringAt(len * 0.78, r * (ice ? 0.7 : 1));
    const tip = add(base, mul(dir, len));
    const c: V3 = ice ? [0.8, 0.92, 1] : [0.75, 0.6, 1];
    for (let s = 0; s < sides; s++) {
      const s2 = (s + 1) % sides;
      const facet = (p: V3[]) => {
        const fn = norm(cross(sub(p[1], p[0]), sub(p[2], p[0])));
        const ids = p.map((q) => b.vertex(q, fn, cellUv(CELLS.plain, 0.5, 0.5), c, 0, 0));
        if (ids.length === 3) b.tri(ids[0], ids[1], ids[2]);
        else b.quad(ids[0], ids[1], ids[2], ids[3]);
      };
      facet([bottom[s], bottom[s2], shoulder[s2], shoulder[s]]);
      facet([shoulder[s], shoulder[s2], tip]);
    }
  }
  return b.build();
}

function mushrooms(rng: Rng, H: number): THREE.BufferGeometry {
  const b = new Builder();
  const cap: V3 = rng() < 0.5 ? [0.62, 0.12, 0.08] : [0.5, 0.33, 0.2];
  for (let k = 0; k < 3; k++) {
    const a = rng() * Math.PI * 2;
    const r = k === 0 ? 0 : range(rng, 0.08, 0.2);
    const h = H * (k === 0 ? 1 : range(rng, 0.45, 0.8));
    const p0: V3 = [Math.cos(a) * r, 0, Math.sin(a) * r];
    tube(b, [p0, add(p0, [0, h * 0.7, 0])], [h * 0.07, h * 0.055], 6, CELLS.plain, 100, () => [0.92, 0.88, 0.8], () => 0, false);
    const cr = h * 0.32;
    const rings = 4;
    const sides = 10;
    const top = add(p0, [0, h * 0.62, 0]);
    let prev: number[] | null = null;
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      const phi = (t * Math.PI) / 2;
      const ring: number[] = [];
      for (let s = 0; s <= sides; s++) {
        const th = (s / sides) * Math.PI * 2;
        const n: V3 = [Math.cos(th) * Math.cos(phi), Math.sin(phi), Math.sin(th) * Math.cos(phi)];
        ring.push(b.vertex(add(top, [n[0] * cr, n[1] * cr * 0.7, n[2] * cr]), n, cellUv(CELLS.plain, 0.5, 0.5), cap, 0, 0));
      }
      if (prev) for (let s = 0; s < sides; s++) b.quad(prev[s], prev[s + 1], ring[s + 1], ring[s]);
      prev = ring;
    }
  }
  return b.build();
}

function coral(rng: Rng, H: number): THREE.BufferGeometry {
  const b = new Builder();
  const colors: V3[] = [
    [0.9, 0.45, 0.35],
    [0.85, 0.6, 0.3],
    [0.7, 0.4, 0.75],
  ];
  const c = colors[Math.floor(rng() * colors.length)];
  const grow = (from: V3, dir: V3, len: number, r: number, depth: number) => {
    const end = add(from, mul(dir, len));
    tube(b, [from, end], [r, r * 0.7], 5, CELLS.plain, 100, () => c, () => 0, depth >= 2);
    if (depth >= 2) return;
    for (let k = 0; k < 3; k++) {
      const az = rng() * Math.PI * 2;
      grow(end, norm(add(dir, [Math.cos(az) * 0.8, 0.3, Math.sin(az) * 0.8])), len * 0.7, r * 0.7, depth + 1);
    }
  };
  for (let k = 0; k < 3; k++) {
    const az = rng() * Math.PI * 2;
    grow([Math.cos(az) * 0.1, 0, Math.sin(az) * 0.1], norm([Math.cos(az) * 0.4, 1, Math.sin(az) * 0.4]), H * 0.4, H * 0.05, 0);
  }
  return b.build();
}

// ---------------------------------------------------------------- catalogue

export interface SpeciesOptions {
  biome: Biome;
  /** blades per grass clump (quality) */
  grassBlades: number;
}

const GRASS_PALETTE: Partial<Record<Biome, { base: string; tip: string }>> = {
  desert: { base: "#3d4a1c", tip: "#a8a35a" },
  canyon: { base: "#4a4320", tip: "#b3a062" },
  grassland: { base: "#2f4a17", tip: "#8fa846" },
  alpine: { base: "#2c4a1a", tip: "#86a64a" },
  forest: { base: "#23391a", tip: "#6f8f3a" },
  wetland: { base: "#2c4a1f", tip: "#7f9a44" },
  tropical: { base: "#244a17", tip: "#7fae42" },
  coast: { base: "#34471d", tip: "#94a257" },
  volcanic: { base: "#333a1c", tip: "#7d8246" },
  arctic: { base: "#4a4c38", tip: "#a8a88a" },
};

const FLOWER_COLORS: V3[] = [hexRgb("#f4f1ea"), hexRgb("#f2c53d"), hexRgb("#b76fd6"), hexRgb("#e5553f")];

/** How many geometry variants each kind gets (more variety costs draw calls). */
export const VARIANTS: Record<ScatterKind, number> = {
  palm: 2,
  conifer: 2,
  broadleaf: 2,
  birch: 2,
  dead_tree: 2,
  bush: 2,
  reeds: 1,
  tall_grass: 1,
  flowers: 3,
  cactus: 2,
  rock: 2,
  boulder: 2,
  crystal: 1,
  mushroom: 1,
  coral: 1,
  ice_shard: 1,
  crop: 1,
};

export function buildSpecies(kind: ScatterKind, variant: number, opts: SpeciesOptions): Species {
  const H = SCATTER[kind].size[1];
  const seed = 0x5eed + variant * 7919 + kind.length * 131 + kind.charCodeAt(0) * 17;
  const rng = mulberry32(seed);
  const papyrus = opts.biome === "desert" || opts.biome === "tropical" || opts.biome === "canyon";
  const pal = GRASS_PALETTE[opts.biome] ?? GRASS_PALETTE.grassland!;
  const make = (material: VegMaterial, geometry: THREE.BufferGeometry, sway: number, flutter: number, sink = 0.05): Species => ({ kind, material, geometry, height: H, sway, flutter, sink });
  switch (kind) {
    case "palm":
      return make("foliage", palm(rng, H), 0.55, 0.08, 0.2);
    case "conifer":
      return make("foliage", conifer(rng, H), 0.35, 0.04, 0.2);
    case "broadleaf":
      return make("foliage", broadleaf(rng, H, false), 0.35, 0.06, 0.2);
    case "birch":
      return make("foliage", broadleaf(rng, H, true), 0.45, 0.07, 0.2);
    case "dead_tree":
      return make("foliage", deadTree(rng, H), 0.12, 0, 0.2);
    case "bush":
      return make("foliage", bush(rng, H), 0.12, 0.05, 0.1);
    case "reeds":
      return make("foliage", reeds(rng, H, papyrus), 0.35, 0.04, 0.05);
    case "tall_grass":
      return make("grass", tallGrass(rng, H, opts.grassBlades, { base: hexRgb(pal.base), tip: hexRgb(pal.tip) }), 0.22, 0.03, 0.03);
    case "flowers":
      return make("foliage", flowers(rng, H, FLOWER_COLORS[variant % FLOWER_COLORS.length]), 0.1, 0.02, 0.02);
    case "crop":
      return make("foliage", crop(rng, H), 0.2, 0.03, 0.03);
    case "cactus":
      return make("foliage", cactus(rng, H), 0, 0, 0.1);
    case "mushroom":
      return make("foliage", mushrooms(rng, H), 0, 0, 0.02);
    case "coral":
      return make("foliage", coral(rng, H), 0.05, 0, 0.05);
    case "rock":
      return make("rock", rockGeometry(rng, H, 2, seed), 0, 0, H * 0.18);
    case "boulder":
      return make("rock", rockGeometry(rng, H, 3, seed), 0, 0, H * 0.14);
    case "crystal":
      return make("gem", gems(rng, H, false), 0, 0, 0.2);
    case "ice_shard":
      return make("gem", gems(rng, H, true), 0, 0, 0.3);
  }
}
