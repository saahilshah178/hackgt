import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/*
 * The pure geometry toolkit behind every procedural structure (and the characters' and animals' bodies). No React, no
 * materials: a builder collects triangles into named material SLOTS ("main", "trim", "dark", "roof" ...), and `build()`
 * merges each slot into ONE BufferGeometry, so a whole building is a handful of draw calls. The React side
 * (./index.tsx) maps slots to shared materials from ../materials.
 *
 * Conventions: metres; y up; the model's front faces local +z; origin at ground level in the centre. Every geometry is
 * converted to non-indexed position+normal, and `build()` emits face-planar, metre-scaled UVs (1 UV unit = 1 m, rows
 * horizontal on walls) so tiling textures line up across pieces. Mirrored transforms flip the winding back, so parts can
 * be built once and mirrored.
 *
 * Primitives: box / blk (min-max box), polyLoft (a convex outline swept up a profile of inset/outset rings: plinths,
 * cornices, battered walls, pyramids, hip roofs, obelisks), lathe, lobedLathe (fluted or bundled columns), loft
 * (superellipse cross-sections along a path: sphinx, hulls, animal bodies), prism (gable roofs, wedges), sheet
 * (parametric cloth/sails/awnings), tube (ropes, tails), sphere/ellipsoid, cyl, extrude (THREE.Shape).
 */

export type V3 = readonly [number, number, number];
export type V2 = readonly [number, number];

export const SLOTS = [
  "main",
  "main2",
  "trim",
  "dark",
  "roof",
  "wood",
  "woodDark",
  "cloth",
  "cloth2",
  "sail",
  "metal",
  "glass",
  "gold",
  "glow",
  "paint",
  "paint2",
  "soil",
  "foliage",
  "water",
  "thatch",
  "rope",
  "skin",
  "hair",
  "accent",
] as const;
export type Slot = (typeof SLOTS)[number];

export interface ModelPart {
  slot: Slot;
  geometry: THREE.BufferGeometry;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const ONE = new THREE.Vector3(1, 1, 1);

/** A transform from translation + Euler (yaw first, then pitch, then roll: order YXZ) + optional scale. */
export function xform(x = 0, y = 0, z = 0, yaw = 0, pitch = 0, roll = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  tmpE.set(pitch, yaw, roll, "YXZ");
  tmpQ.setFromEuler(tmpE);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), tmpQ, new THREE.Vector3(sx, sy, sz));
}

/** A transform from explicit local axes (they should be orthonormal and right-handed) and a position. */
export function basis(x: V3, y: V3, z: V3, pos: V3 = [0, 0, 0]): THREE.Matrix4 {
  return new THREE.Matrix4().makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...z)).setPosition(pos[0], pos[1], pos[2]);
}

/** Normalise any geometry to non-indexed position + normal (what the merge expects). */
export function normalise(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes)) if (name !== "position" && name !== "normal") out.deleteAttribute(name);
  if (!out.attributes.normal) out.computeVertexNormals();
  out.morphAttributes = {};
  out.clearGroups();
  return out;
}

/** Flip the winding of a non-indexed geometry (after a mirror). */
function flipWinding(g: THREE.BufferGeometry) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i += 3) {
    for (const a of [p, n]) {
      const x = a.getX(i + 1);
      const y = a.getY(i + 1);
      const z = a.getZ(i + 1);
      a.setXYZ(i + 1, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2));
      a.setXYZ(i + 2, x, y, z);
    }
  }
}

/** Face-planar metre UVs: each triangle is projected on its own plane with a horizontal u axis (v up the face). */
export function planarUVs(g: THREE.BufferGeometry, scale = 1) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(p.count * 2);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const t = new THREE.Vector3();
  const bt = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    n.subVectors(c, b).cross(t.subVectors(a, b));
    if (n.lengthSq() < 1e-14) n.set(0, 1, 0);
    n.normalize();
    if (Math.abs(n.y) > 0.92) {
      t.set(1, 0, 0);
      bt.set(0, 0, n.y > 0 ? -1 : 1);
    } else {
      t.crossVectors(up, n).normalize();
      bt.crossVectors(n, t).normalize();
    }
    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c;
      uv[(i + k) * 2] = v.dot(t) * scale;
      uv[(i + k) * 2 + 1] = v.dot(bt) * scale;
    }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

export function triCount(parts: readonly { geometry: THREE.BufferGeometry }[]): number {
  let n = 0;
  for (const p of parts) n += (p.geometry.index ? p.geometry.index.count : p.geometry.attributes.position.count) / 3;
  return n;
}

// ------------------------------------------------------------------------------------------------ the builder

export class GeoBuilder {
  private parts = new Map<Slot, THREE.BufferGeometry[]>();
  private matrix = new THREE.Matrix4();
  private stack: THREE.Matrix4[] = [];

  /** Apply `m` (on top of the current frame) to everything added inside `fn`. */
  with(m: THREE.Matrix4, fn: () => void) {
    this.stack.push(this.matrix.clone());
    this.matrix.multiply(m);
    try {
      fn();
    } finally {
      this.matrix = this.stack.pop()!;
    }
  }

  /** Translate + yaw frame (the common case: place a sub-assembly). */
  at(x: number, y: number, z: number, yaw: number, fn: () => void) {
    this.with(xform(x, y, z, yaw), fn);
  }

  /** Mirror across x = 0 (build the left half, mirror for the right). */
  mirrorX(fn: () => void) {
    this.with(new THREE.Matrix4().makeScale(-1, 1, 1), fn);
  }

  add(slot: Slot, geometry: THREE.BufferGeometry, local?: THREE.Matrix4) {
    const g = normalise(geometry);
    const m = local ? tmpM.multiplyMatrices(this.matrix, local) : this.matrix;
    g.applyMatrix4(m);
    if (m.determinant() < 0) flipWinding(g);
    const list = this.parts.get(slot) ?? [];
    list.push(g);
    this.parts.set(slot, list);
  }

  /** Merge another builder's slots into this one (under the current frame). */
  absorb(other: GeoBuilder) {
    for (const [slot, list] of other.parts) for (const g of list) this.add(slot, g.clone());
  }

  isEmpty() {
    return this.parts.size === 0;
  }

  // ---------------------------------------------------------------- primitives (all positioned in the current frame)

  /** Box centred at (x, y, z) with optional yaw/pitch/roll. */
  box(slot: Slot, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0, pitch = 0, roll = 0) {
    this.add(slot, new THREE.BoxGeometry(Math.max(w, 1e-3), Math.max(h, 1e-3), Math.max(d, 1e-3)), xform(x, y, z, yaw, pitch, roll));
  }

  /** Axis-aligned box from its min and max corners (the architect's favourite). */
  blk(slot: Slot, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    this.box(slot, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  }

  /** A convex outline (CCW seen from above, in x/z) swept up a profile of offset rings. See polyLoftGeometry. */
  polyLoft(slot: Slot, loop: readonly V2[], profile: readonly LoftRing[], opts: PolyLoftOptions = {}) {
    this.add(slot, polyLoftGeometry(loop, profile, opts));
  }

  /** Rectangle centred on (cx, cz) with half extents hx, hz, swept up a profile. */
  rectLoft(slot: Slot, cx: number, cz: number, hx: number, hz: number, profile: readonly LoftRing[], opts: PolyLoftOptions = {}) {
    this.polyLoft(slot, rectLoop(cx, cz, hx, hz), profile, opts);
  }

  /** Surface of revolution about the local y axis at (x, z): profile points are [radius, y]. */
  lathe(slot: Slot, x: number, y: number, z: number, profile: readonly V2[], segments = 16, phiStart = 0, phiLength = Math.PI * 2) {
    const pts = profile.map(([r, py]) => new THREE.Vector2(Math.max(r, 0), py));
    this.add(slot, new THREE.LatheGeometry(pts, segments, phiStart, phiLength), xform(x, y, z));
  }

  lobedLathe(slot: Slot, x: number, y: number, z: number, profile: readonly LobeRing[], opts: LobeOptions) {
    this.add(slot, lobedLatheGeometry(profile, opts), xform(x, y, z));
  }

  cyl(slot: Slot, x: number, y0: number, z: number, rBottom: number, rTop: number, h: number, segments = 12, yaw = 0, pitch = 0, roll = 0, open = false) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1, open);
    g.translate(0, h / 2, 0);
    this.add(slot, g, xform(x, y0, z, yaw, pitch, roll));
  }

  /** A cylinder between two points (beams, legs, poles, spokes). */
  rod(slot: Slot, a: V3, b: V3, r0: number, r1 = r0, segments = 8) {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    if (len < 1e-4) return;
    const g = new THREE.CylinderGeometry(r1, r0, len, segments, 1, false);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    this.add(slot, g, new THREE.Matrix4().compose(va, q, ONE));
  }

  /** A square-section beam between two points (timber). */
  beam(slot: Slot, a: V3, b: V3, w: number, h = w) {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    if (len < 1e-4) return;
    const dir = vb.clone().sub(va).normalize();
    const g = new THREE.BoxGeometry(w, h, len);
    g.translate(0, 0, len / 2);
    // orient +z along dir, keeping "up" as vertical as possible
    const up = Math.abs(dir.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), dir.clone().negate(), up);
    m.setPosition(va);
    this.add(slot, g, m);
  }

  sphere(slot: Slot, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, ws = 12, hs = 8, yaw = 0, pitch = 0, roll = 0) {
    this.add(slot, new THREE.SphereGeometry(1, ws, hs), xform(x, y, z, yaw, pitch, roll, rx, ry, rz));
  }

  /** Superellipse cross-sections along a path. See loftGeometry. */
  loft(slot: Slot, sections: readonly LoftSection[], opts: LoftOptions = {}) {
    this.add(slot, loftGeometry(sections, opts));
  }

  /** A polygon (in the x/y plane of a local frame) extruded along local z by `depth`, then placed by `m`. */
  prism(slot: Slot, poly: readonly V2[], depth: number, m: THREE.Matrix4) {
    const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
    this.add(slot, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 }), m);
  }

  extrude(slot: Slot, shape: THREE.Shape, depth: number, m: THREE.Matrix4, curveSegments = 6) {
    this.add(slot, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments }), m);
  }

  /** A parametric grid surface; rows[i][j] are points. Double-sided when asked (cloth seen from both sides). */
  sheet(slot: Slot, rows: readonly (readonly V3[])[], doubleSided = false) {
    this.add(slot, sheetGeometry(rows, doubleSided));
  }

  tube(slot: Slot, points: readonly V3[], radius: number, radial = 6, tubular = 0, closed = false) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed);
    this.add(slot, new THREE.TubeGeometry(curve, tubular || points.length * 4, radius, radial, closed));
  }

  /** A flat quad facing +z in the current frame, centred at (x, y, z) (openings, glyphs, painted panels). */
  quad(slot: Slot, x: number, y: number, z: number, w: number, h: number, yaw = 0, pitch = 0) {
    this.add(slot, new THREE.PlaneGeometry(w, h), xform(x, y, z, yaw, pitch));
  }

  /** Merge each slot into one geometry, emit metre UVs, compute bounds. */
  build(): ModelPart[] {
    const out: ModelPart[] = [];
    for (const slot of SLOTS) {
      const list = this.parts.get(slot);
      if (!list || list.length === 0) continue;
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!merged) continue;
      if (merged !== list[0]) for (const g of list) g.dispose();
      planarUVs(merged);
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      out.push({ slot, geometry: merged });
    }
    this.parts.clear();
    return out;
  }
}

// ------------------------------------------------------------------------------------------------ polyLoft

/** One ring of a polyLoft: the outline offset outward by `o` metres (negative = inset) at height `y`. */
export interface LoftRing {
  o: number;
  y: number;
}

export interface PolyLoftOptions {
  /** close the top with a cap (default true) */
  capTop?: boolean;
  /** close the bottom (default false: it sits on something) */
  capBottom?: boolean;
  /** smooth normals across profile rings (curved mouldings); default flat */
  smooth?: boolean;
}

export function rectLoop(cx: number, cz: number, hx: number, hz: number): V2[] {
  return [
    [cx - hx, cz + hz],
    [cx + hx, cz + hz],
    [cx + hx, cz - hz],
    [cx - hx, cz - hz],
  ];
}

/** A rectangle with its four corners chamfered by `c` (an octagon), CCW from above like rectLoop. */
export function chamferLoop(cx: number, cz: number, hx: number, hz: number, c: number): V2[] {
  return [
    [cx - hx + c, cz + hz],
    [cx + hx - c, cz + hz],
    [cx + hx, cz + hz - c],
    [cx + hx, cz - hz + c],
    [cx + hx - c, cz - hz],
    [cx - hx + c, cz - hz],
    [cx - hx, cz - hz + c],
    [cx - hx, cz + hz - c],
  ];
}

export function circleLoop(cx: number, cz: number, r: number, n: number, phase = 0): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = phase - (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return out;
}

/**
 * Offset a convex loop by `o` (miter joins). Degenerate insets clamp: an inset larger than the inradius collapses the
 * loop toward its medial axis (a rectangle becomes a ridge line: that is how hip roofs and pyramids close).
 */
function offsetLoop(loop: readonly V2[], o: number): V2[] {
  const n = loop.length;
  // orientation: we want outward normals; loops are given with positive signed area in (x, -z) i.e. CCW from above
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = loop[i];
    const [x1, z1] = loop[(i + 1) % n];
    area += x0 * z1 - x1 * z0;
  }
  const s = area < 0 ? -1 : 1;
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const p = loop[i];
    const a = loop[(i - 1 + n) % n];
    const b = loop[(i + 1) % n];
    const e0 = norm2(p[0] - a[0], p[1] - a[1]);
    const e1 = norm2(b[0] - p[0], b[1] - p[1]);
    const n0: V2 = [e0[1] * s, -e0[0] * s];
    const n1: V2 = [e1[1] * s, -e1[0] * s];
    const mx = n0[0] + n1[0];
    const mz = n0[1] + n1[1];
    const dot = 1 + n0[0] * n1[0] + n0[1] * n1[1];
    const k = dot > 1e-6 ? o / dot : 0;
    out.push([p[0] + mx * k, p[1] + mz * k]);
  }
  return out;
}

function norm2(x: number, z: number): V2 {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
}

/** Largest inset before a convex loop collapses (half its smallest width), for clamping pyramids and hip roofs. */
function maxInset(loop: readonly V2[]): number {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of loop) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return Math.min(maxX - minX, maxZ - minZ) / 2;
}

/** Clamp each point of a collapsing rectangle-like loop into the medial segment. */
function clampToMedial(loop: readonly V2[], ring: V2[], inset: number, limit: number): V2[] {
  if (inset <= limit - 1e-6) return ring;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of loop) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const hx = (maxX - minX) / 2;
  const hz = (maxZ - minZ) / 2;
  const rx = Math.max(0, hx - limit);
  const rz = Math.max(0, hz - limit);
  return loop.map(([x, z]) => [cx + Math.sign(x - cx) * rx, cz + Math.sign(z - cz) * rz] as V2);
}

export function polyLoftGeometry(loop: readonly V2[], profile: readonly LoftRing[], opts: PolyLoftOptions = {}): THREE.BufferGeometry {
  const limit = maxInset(loop);
  const rings = profile.map((r) => ({ y: r.y, pts: r.o < -limit + 1e-6 ? clampToMedial(loop, offsetLoop(loop, r.o), -r.o, limit) : offsetLoop(loop, r.o) }));
  const pos: number[] = [];
  const nor: number[] = [];
  const n = loop.length;
  const tri = (a: V3, b: V3, c: V3) => {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-10) return;
    nx /= l;
    ny /= l;
    nz /= l;
    pos.push(...a, ...b, ...c);
    nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  };
  // side walls; figure out winding from the loop orientation so faces point outward
  let area = 0;
  for (let i = 0; i < n; i++) area += loop[i][0] * loop[(i + 1) % n][1] - loop[(i + 1) % n][0] * loop[i][1];
  const flip = area > 0;
  for (let r = 0; r < rings.length - 1; r++) {
    const A = rings[r];
    const B = rings[r + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a0: V3 = [A.pts[i][0], A.y, A.pts[i][1]];
      const a1: V3 = [A.pts[j][0], A.y, A.pts[j][1]];
      const b0: V3 = [B.pts[i][0], B.y, B.pts[i][1]];
      const b1: V3 = [B.pts[j][0], B.y, B.pts[j][1]];
      if (flip) {
        tri(a0, b1, a1);
        tri(a0, b0, b1);
      } else {
        tri(a0, a1, b1);
        tri(a0, b1, b0);
      }
    }
  }
  const cap = (ring: { y: number; pts: V2[] }, up: boolean) => {
    const c: V3 = [ring.pts.reduce((s, p) => s + p[0], 0) / n, ring.y, ring.pts.reduce((s, p) => s + p[1], 0) / n];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a: V3 = [ring.pts[i][0], ring.y, ring.pts[i][1]];
      const b: V3 = [ring.pts[j][0], ring.y, ring.pts[j][1]];
      if (up === !flip) tri(c, a, b);
      else tri(c, b, a);
    }
  };
  if (opts.capTop !== false) cap(rings[rings.length - 1], true);
  if (opts.capBottom) cap(rings[0], false);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  if (opts.smooth) smoothNormals(g, 0.6);
  return g;
}

/** Average normals of coincident vertices whose face normals are within `cosLimit` (keeps hard creases). */
export function smoothNormals(g: THREE.BufferGeometry, cosLimit = 0.5) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const n = g.attributes.normal as THREE.BufferAttribute;
  const key = (i: number) => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < p.count; i++) {
    const k = key(i);
    const l = groups.get(k);
    if (l) l.push(i);
    else groups.set(k, [i]);
  }
  const src = Float32Array.from(n.array as Float32Array);
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    for (const i of list) {
      let sx = 0;
      let sy = 0;
      let sz = 0;
      for (const j of list) {
        const d = src[i * 3] * src[j * 3] + src[i * 3 + 1] * src[j * 3 + 1] + src[i * 3 + 2] * src[j * 3 + 2];
        if (d < cosLimit) continue;
        sx += src[j * 3];
        sy += src[j * 3 + 1];
        sz += src[j * 3 + 2];
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      n.setXYZ(i, sx / l, sy / l, sz / l);
    }
  }
  n.needsUpdate = true;
}

// ------------------------------------------------------------------------------------------------ lobed lathe (columns)

export interface LobeRing {
  r: number;
  y: number;
  /** 0 = round ring (bands, capitals), 1 = full lobes (the shaft) */
  lobe?: number;
}

export interface LobeOptions {
  /** radial segments (a multiple of lobes looks best) */
  segments: number;
  lobes: number;
  /** relative depth of the lobes (0.06 flutes .. 0.18 papyrus bundles) */
  depth: number;
  /** "bundle" = convex stems with sharp valleys (papyrus); "flute" = concave channels with sharp arrises (doric) */
  mode: "bundle" | "flute";
  capTop?: boolean;
}

export function lobedLatheGeometry(profile: readonly LobeRing[], o: LobeOptions): THREE.BufferGeometry {
  const seg = o.segments;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r < profile.length; r++) {
    const ring = profile[r];
    const lobe = ring.lobe ?? 1;
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      const wave = o.mode === "bundle" ? Math.pow(Math.abs(Math.cos((o.lobes * th) / 2)), 0.55) : 1 - Math.pow(Math.abs(Math.sin((o.lobes * th) / 2)), 0.7);
      const k = 1 - o.depth * lobe * (1 - wave);
      pos.push(Math.sin(th) * ring.r * k, ring.y, Math.cos(th) * ring.r * k);
    }
  }
  const row = seg + 1;
  for (let r = 0; r < profile.length - 1; r++) {
    for (let i = 0; i < seg; i++) {
      const a = r * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  if (o.capTop !== false) {
    const top = profile[profile.length - 1];
    const ci = pos.length / 3;
    pos.push(0, top.y, 0);
    const base = (profile.length - 1) * row;
    for (let i = 0; i < seg; i++) idx.push(ci, base + i, base + i + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------------------------------------ loft

/** One cross-section of a loft: centre, half-width (local x), half-height (local up), superellipse exponent. */
export interface LoftSection {
  c: V3;
  w: number;
  h: number;
  /** 2 = ellipse, 4+ = rounded box, 1 = diamond; default 2.4 */
  n?: number;
  /** shift the section's top/bottom: squash the lower half (flat belly on the ground) with 0..1 */
  flatBottom?: number;
  /** roll of the section around the path (radians) */
  roll?: number;
}

export interface LoftOptions {
  radial?: number;
  capStart?: boolean;
  capEnd?: boolean;
  /** only the lower half of each section (open hulls): the result is a trough, open on top */
  lowerHalf?: boolean;
  /** subdivide between sections with Catmull-Rom (smoother silhouettes); default 1 = no subdivision */
  subdivide?: number;
  /** fixed up vector for the section frames (default +y; use +z for vertical lofts such as necks) */
  up?: V3;
  /** turn the surface inside out (the inner face of a hull) */
  flip?: boolean;
  /** keep every section in a plane parallel to x/y (hull stations), instead of perpendicular to the path */
  stations?: boolean;
}

function lerpSection(a: LoftSection, b: LoftSection, t: number): LoftSection {
  const l = (x: number, y: number) => x + (y - x) * t;
  return {
    c: [l(a.c[0], b.c[0]), l(a.c[1], b.c[1]), l(a.c[2], b.c[2])],
    w: l(a.w, b.w),
    h: l(a.h, b.h),
    n: l(a.n ?? 2.4, b.n ?? 2.4),
    flatBottom: l(a.flatBottom ?? 0, b.flatBottom ?? 0),
    roll: l(a.roll ?? 0, b.roll ?? 0),
  };
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function subdivideSections(s: readonly LoftSection[], k: number): LoftSection[] {
  if (k <= 1 || s.length < 3) return [...s];
  const out: LoftSection[] = [];
  for (let i = 0; i < s.length - 1; i++) {
    const p0 = s[Math.max(0, i - 1)];
    const p1 = s[i];
    const p2 = s[i + 1];
    const p3 = s[Math.min(s.length - 1, i + 2)];
    for (let j = 0; j < k; j++) {
      const t = j / k;
      const lin = lerpSection(p1, p2, t);
      lin.c = [catmull(p0.c[0], p1.c[0], p2.c[0], p3.c[0], t), catmull(p0.c[1], p1.c[1], p2.c[1], p3.c[1], t), catmull(p0.c[2], p1.c[2], p2.c[2], p3.c[2], t)];
      lin.w = Math.max(1e-4, catmull(p0.w, p1.w, p2.w, p3.w, t));
      lin.h = Math.max(1e-4, catmull(p0.h, p1.h, p2.h, p3.h, t));
      out.push(lin);
    }
  }
  out.push(s[s.length - 1]);
  return out;
}

const spow = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);

export function loftGeometry(sections0: readonly LoftSection[], o: LoftOptions = {}): THREE.BufferGeometry {
  const sections = subdivideSections(sections0, o.subdivide ?? 1);
  const radial = o.radial ?? 16;
  const pos: number[] = [];
  const idx: number[] = [];
  const upRef = new THREE.Vector3(...(o.up ?? [0, 1, 0]));
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  const count = sections.length;
  const a0 = o.lowerHalf ? Math.PI : 0;
  const span = o.lowerHalf ? Math.PI : Math.PI * 2;
  const cols = o.lowerHalf ? radial + 1 : radial + 1;
  for (let s = 0; s < count; s++) {
    const S = sections[s];
    const prev = sections[Math.max(0, s - 1)];
    const next = sections[Math.min(count - 1, s + 1)];
    tan.set(next.c[0] - prev.c[0], next.c[1] - prev.c[1], next.c[2] - prev.c[2]);
    if (tan.lengthSq() < 1e-12) tan.set(0, 0, 1);
    tan.normalize();
    if (o.stations) {
      side.set(1, 0, 0);
      up.set(0, 1, 0);
    } else {
      side.crossVectors(upRef, tan);
      if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
      side.normalize();
      up.crossVectors(tan, side).normalize();
    }
    if (S.roll) {
      const q = new THREE.Quaternion().setFromAxisAngle(tan, S.roll);
      side.applyQuaternion(q);
      up.applyQuaternion(q);
    }
    const e = 2 / (S.n ?? 2.4);
    for (let i = 0; i < cols; i++) {
      const th = a0 + (i / radial) * span;
      const cx = spow(Math.cos(th), e) * S.w;
      let cy = spow(Math.sin(th), e) * S.h;
      if (cy < 0 && S.flatBottom) cy *= 1 - S.flatBottom;
      pos.push(S.c[0] + side.x * cx + up.x * cy, S.c[1] + side.y * cx + up.y * cy, S.c[2] + side.z * cx + up.z * cy);
    }
  }
  for (let s = 0; s < count - 1; s++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = s * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  const capAt = (s: number, start: boolean) => {
    const S = sections[s];
    const ci = pos.length / 3;
    let cy = 0;
    if (o.lowerHalf) cy = 0;
    pos.push(S.c[0], S.c[1] + cy, S.c[2]);
    for (let i = 0; i < cols - 1; i++) {
      const a = s * cols + i;
      if (start) idx.push(ci, a + 1, a);
      else idx.push(ci, a, a + 1);
    }
  };
  if (o.capStart) capAt(0, true);
  if (o.capEnd) capAt(count - 1, false);
  if (o.flip) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------------------------------------ sheet

export function sheetGeometry(rows: readonly (readonly V3[])[], doubleSided = false): THREE.BufferGeometry {
  const R = rows.length;
  const C = rows[0].length;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const row of rows) for (const p of row) pos.push(p[0], p[1], p[2]);
  for (let r = 0; r < R - 1; r++) {
    for (let c = 0; c < C - 1; c++) {
      const a = r * C + c;
      const b = a + 1;
      const d = a + C;
      const e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (!doubleSided) return g;
  const back = g.clone();
  const bi = back.index!.array as Uint32Array | Uint16Array;
  const flipped: number[] = [];
  for (let i = 0; i < bi.length; i += 3) flipped.push(bi[i], bi[i + 2], bi[i + 1]);
  back.setIndex(flipped);
  const bn = back.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < bn.count; i++) bn.setXYZ(i, -bn.getX(i), -bn.getY(i), -bn.getZ(i));
  const merged = mergeGeometries([g.toNonIndexed(), back.toNonIndexed()], false)!;
  g.dispose();
  back.dispose();
  return merged;
}

// ------------------------------------------------------------------------------------------------ triangle soup

/** Hand-built faceted geometry: add triangles/quads (CCW seen from outside), flat normals. */
export class TriSoup {
  private pos: number[] = [];
  private nor: number[] = [];

  tri(a: V3, b: V3, c: V3) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-12) return this;
    nx /= l;
    ny /= l;
    nz /= l;
    this.pos.push(...a, ...b, ...c);
    this.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    return this;
  }

  /** a-b-c-d counter-clockwise seen from the front. */
  quad(a: V3, b: V3, c: V3, d: V3) {
    this.tri(a, b, c);
    this.tri(a, c, d);
    return this;
  }

  get empty() {
    return this.pos.length === 0;
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    return g;
  }
}

// ------------------------------------------------------------------------------------------------ small helpers

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The cavetto-and-torus cornice profile of Egyptian architecture, as polyLoft rings above `y` (wall face at o = 0). */
export function cavettoProfile(y: number, size: number, topInset = -0.4): LoftRing[] {
  const R = size;
  const out: LoftRing[] = [
    { o: 0, y },
    // torus roll
    { o: size * 0.12, y: y + size * 0.06 },
    { o: size * 0.16, y: y + size * 0.14 },
    { o: size * 0.12, y: y + size * 0.22 },
    { o: 0, y: y + size * 0.28 },
  ];
  const base = y + size * 0.28;
  for (let i = 1; i <= 6; i++) {
    const th = (i / 6) * (Math.PI / 2);
    out.push({ o: R * 0.85 * (1 - Math.cos(th)), y: base + R * 0.85 * Math.sin(th) });
  }
  const top = base + R * 0.85;
  out.push({ o: R * 0.85, y: top + size * 0.12 });
  out.push({ o: topInset, y: top + size * 0.12 });
  return out;
}

/** A classical cornice: fascia, ovolo, corona, cyma (all outward steps), above `y`. */
export function classicalCorniceProfile(y: number, size: number): LoftRing[] {
  const s = size;
  return [
    { o: 0, y },
    { o: 0, y: y + s * 0.1 },
    { o: s * 0.12, y: y + s * 0.1 },
    { o: s * 0.12, y: y + s * 0.22 },
    { o: s * 0.3, y: y + s * 0.34 },
    { o: s * 0.55, y: y + s * 0.4 },
    { o: s * 0.55, y: y + s * 0.62 },
    { o: s * 0.7, y: y + s * 0.8 },
    { o: s * 0.72, y: y + s * 0.9 },
    { o: -s * 0.3, y: y + s * 0.9 },
  ];
}

/** A plinth / base moulding: a chamfered or stepped ring at the foot of a wall. */
export function plinthProfile(h: number, out: number, steps = 1): LoftRing[] {
  const rings: LoftRing[] = [];
  for (let i = 0; i < steps; i++) {
    const o = out * (1 - i / steps);
    const y0 = (h * i) / steps;
    const y1 = (h * (i + 1)) / steps;
    rings.push({ o, y: y0 }, { o, y: y1 - (h / steps) * 0.15 }, { o: o - (out / steps) * 0.6, y: y1 });
  }
  return rings;
}
