import * as THREE from "three";
import type { HeldProp, Headwear, NpcLook, Outfit } from "../../../contracts/world3d";
import { lobedLatheGeometry, loftGeometry, normalise, planarUVs, type LoftSection, type V3 } from "../structures/geom";
import { B, JOINT } from "./skeleton";

/*
 * The humanoid's geometry, built procedurally in the bind pose and skinned to ./skeleton: a lofted torso with hips,
 * waist and chest, deltoids, lofted arms with elbows, mitten hands with thumbs, lofted legs with knee caps and calves,
 * feet; a head from cranium and jaw ellipsoids with brow, nose, ears, eyes (dark insets), eyebrows and a mouth line;
 * hair (or an Egyptian wig) by variant; then the outfit (tunic, robe, toga, kilt, armor, work clothes, coat, dress, lab
 * coat, uniform, cloak), the headwear and the held prop.
 *
 * Every piece is merged per material SLOT (skin, cloth, accent, linen, hair, dark, leather, metal, gold, wood, glow,
 * foliage, straw) into one skinned BufferGeometry with position, normal, uv, skinIndex and skinWeight, so a character is
 * a handful of draw calls sharing one skeleton. Vertices are weighted to one or two bones, blended across the joints so
 * elbows, knees, hips and shoulders bend smoothly; skirts follow the thighs toward the hem.
 *
 * Pure (no React, no materials): `humanoidModel(key)` is cached per (outfit, headwear, held, build, hair, egypt).
 */

export const CHAR_SLOTS = ["skin", "cloth", "accent", "linen", "hair", "dark", "leather", "metal", "gold", "wood", "glow", "foliage", "straw", "hardhat"] as const;
export type CharSlot = (typeof CHAR_SLOTS)[number];

export interface BodyKey {
  outfit: Outfit;
  headwear: Headwear;
  held: HeldProp;
  /** 0 average, 1 broad, 2 slender */
  build: number;
  /** hair variant 0..3 */
  hair: number;
  /** Old Kingdom Egypt: wigs, shaved heads, sandals, a broad collar with the kilt */
  egypt: boolean;
}

export interface BodyPart {
  slot: CharSlot;
  geometry: THREE.BufferGeometry;
}

export interface HumanoidModel {
  key: string;
  parts: BodyPart[];
  tris: number;
  /** where held flames/lamps sit (hand-relative, bind pose), for the renderer's fx */
  flame: { bone: number; at: V3; size: number; lamp: boolean } | null;
}

export function bodyKeyFor(look: NpcLook, seed: number, egypt: boolean): BodyKey {
  const s = seed >>> 0;
  let build = s % 3;
  if (look.outfit === "dress") build = 2;
  if (look.outfit === "armor" && build === 2) build = 1;
  return { outfit: look.outfit, headwear: look.headwear, held: look.held, build, hair: (s >>> 3) % 4, egypt };
}

export function bodyKeyString(k: BodyKey): string {
  return `${k.outfit}|${k.headwear}|${k.held}|${k.build}|${k.hair}|${k.egypt ? 1 : 0}`;
}

// ------------------------------------------------------------------------------------------------ skinning builder

/** Bone weights for one vertex: [boneA, boneB, weightOfB]. */
export type W = [number, number, number];
export type Weigh = (x: number, y: number, z: number) => W;

export const sm = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Collects bind-pose pieces per slot with per-vertex bone weights; `build()` merges each slot into a skinned geometry. */
export class SkinBuilder<S extends string = CharSlot> {
  private acc = new Map<S, { pos: number[]; nor: number[]; si: number[]; sw: number[] }>();

  constructor(private readonly order: readonly S[] = CHAR_SLOTS as unknown as readonly S[]) {}

  add(slot: S, g0: THREE.BufferGeometry, weigh: Weigh | number, m?: THREE.Matrix4) {
    const g = normalise(g0);
    if (m) {
      g.applyMatrix4(m);
      if (m.determinant() < 0) flip(g);
    }
    const p = g.attributes.position as THREE.BufferAttribute;
    const n = g.attributes.normal as THREE.BufferAttribute;
    const a = this.acc.get(slot) ?? { pos: [], nor: [], si: [], sw: [] };
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      a.pos.push(x, y, z);
      a.nor.push(n.getX(i), n.getY(i), n.getZ(i));
      const w: W = typeof weigh === "number" ? [weigh, weigh, 0] : weigh(x, y, z);
      a.si.push(w[0], w[1], 0, 0);
      a.sw.push(1 - w[2], w[2], 0, 0);
    }
    this.acc.set(slot, a);
    g.dispose();
  }

  build(): { slot: S; geometry: THREE.BufferGeometry }[] {
    const out: { slot: S; geometry: THREE.BufferGeometry }[] = [];
    for (const slot of this.order) {
      const a = this.acc.get(slot);
      if (!a || a.pos.length === 0) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(a.pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(a.nor, 3));
      g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(a.si, 4));
      g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(a.sw, 4));
      planarUVs(g, 4);
      g.computeBoundingBox();
      g.computeBoundingSphere();
      out.push({ slot, geometry: g });
    }
    return out;
  }
}

function flip(g: THREE.BufferGeometry) {
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

/** Weights along a limb segment from joint a to joint b, blending into the parent at a and the child at b. */
export function limb(parent: number, bone: number, child: number, a: V3, b: V3, blendA = 0.035, blendB = 0.035): Weigh {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const L = Math.hypot(dx, dy, dz);
  return (x, y, z) => {
    const d = ((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / L;
    if (blendA > 0 && d < blendA) return [parent, bone, sm((d + blendA) / (2 * blendA))];
    if (child >= 0 && blendB > 0 && d > L - blendB) return [bone, child, sm((d - (L - blendB)) / (2 * blendB))];
    return [bone, bone, 0];
  };
}

/** The torso: hips → spine → chest → neck → head up the middle, shoulders into the arms, hip sides into the thighs. */
function torsoWeigh(sh: number): Weigh {
  return (x, y) => {
    const ax = Math.abs(x);
    let a: number = B.hips;
    let b: number = B.hips;
    let k = 0;
    if (y < 0.99) {
      a = b = B.hips;
    } else if (y < 1.1) {
      a = B.hips;
      b = B.spine;
      k = sm((y - 0.99) / 0.11);
    } else if (y < 1.17) {
      a = b = B.spine;
    } else if (y < 1.29) {
      a = B.spine;
      b = B.chest;
      k = sm((y - 1.17) / 0.12);
    } else if (y < 1.43) {
      a = b = B.chest;
    } else if (y < 1.5) {
      a = B.chest;
      b = B.neck;
      k = sm((y - 1.43) / 0.07) * (1 - sm((ax - 0.05) / 0.05));
    } else if (y < 1.56) {
      a = B.neck;
      b = B.head;
      k = sm((y - 1.5) / 0.06);
    } else a = b = B.head;
    if (y > 1.28 && y < 1.5 && ax > sh - 0.08) {
      const arm = x > 0 ? B.upperArmL : B.upperArmR;
      const ka = sm((ax - (sh - 0.08)) / 0.07) * sm((y - 1.28) / 0.08) * 0.9;
      return [k > 0.5 ? b : a, arm, ka];
    }
    if (y < 0.94 && ax > 0.02) {
      const th = x > 0 ? B.thighL : B.thighR;
      return [B.hips, th, sm((0.94 - y) / 0.1) * sm((ax - 0.02) / 0.05)];
    }
    return [a, b, k];
  };
}

/** Skirts and coat tails: the hips at the waist, following each thigh more toward the hem and the side. */
function skirtWeigh(yTop: number, yHem: number, follow: number): Weigh {
  return (x, y) => {
    const t = clamp01((yTop - y) / Math.max(0.01, yTop - yHem));
    const side = sm(Math.abs(x) / 0.1);
    return [B.hips, x >= 0 ? B.thighL : B.thighR, follow * Math.pow(t, 0.8) * side];
  };
}

// ------------------------------------------------------------------------------------------------ geometry helpers

export const T = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")), new THREE.Vector3(sx, sy, sz));

export const sphere = (rx: number, ry: number, rz: number, ws = 12, hs = 9) => new THREE.SphereGeometry(1, ws, hs).applyMatrix4(new THREE.Matrix4().makeScale(rx, ry, rz));

export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** A limb loft between two joints: [t, halfWidth(x), halfDepth(z), zOffset] rows. */
function limbLoft(a: V3, b: V3, rows: readonly [number, number, number, number?][], radial = 12, capStart = false, capEnd = false): THREE.BufferGeometry {
  const secs: LoftSection[] = rows.map(([t, w, h, oz]) => {
    const c = lerp3(a, b, t);
    return { c: [c[0], c[1], c[2] + (oz ?? 0)], w, h, n: 2.1 };
  });
  return loftGeometry(secs, { radial, capStart, capEnd, subdivide: 2, up: [0, 0, 1] });
}

/** A flat strap following a path around the body (belts, sashes, toga drapes); its face turns away from the body axis. */
function strap(path: readonly V3[], halfW: number, thick: number, closed = false): THREE.BufferGeometry {
  const pts = path.map((p) => new THREE.Vector3(...p));
  const n = pts.length;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const t = next.clone().sub(prev).normalize();
    const out = new THREE.Vector3(p.x, 0, p.z);
    if (out.lengthSq() < 1e-8) out.set(0, 0, 1);
    out.normalize();
    const bn = new THREE.Vector3().crossVectors(out, t).normalize();
    const o2 = new THREE.Vector3().crossVectors(t, bn).normalize();
    for (const [sb, so] of [
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const v = p.clone().addScaledVector(bn, sb * halfW).addScaledVector(o2, so * thick);
      pos.push(v.x, v.y, v.z);
    }
  }
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = i * 4;
    const b = ((i + 1) % n) * 4;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      idx.push(a + k, a + k2, b + k2, a + k, b + k2, b + k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A ring path around the torso at height y (ellipse hx × hz, centre z offset). */
function ring(y: number, hx: number, hz: number, cz = 0, n = 20): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([Math.sin(a) * hx, y, cz + Math.cos(a) * hz]);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ body presets

interface Build {
  sh: number;
  hip: number;
  waist: number;
  chestD: number;
  limb: number;
  bust: number;
}

const BUILDS: Build[] = [
  { sh: 0.19, hip: 0.158, waist: 0.134, chestD: 0.112, limb: 1.0, bust: 0 },
  { sh: 0.205, hip: 0.163, waist: 0.148, chestD: 0.122, limb: 1.13, bust: 0 },
  { sh: 0.172, hip: 0.172, waist: 0.12, chestD: 0.104, limb: 0.9, bust: 1 },
];

/** Torso cross-sections: [y, halfWidth, halfDepth, zCentre]. `inflate` grows them for garments. */
function torsoRows(bp: Build, inflate = 0): [number, number, number, number][] {
  const i = inflate;
  return [
    [0.82, 0.12 + i, 0.085 + i, 0],
    [0.88, bp.hip * 0.97 + i, 0.104 + i, -0.008],
    [0.95, bp.hip + i, 0.112 + i, -0.012],
    [1.02, (bp.hip + bp.waist) / 2 + i, 0.102 + i, -0.006],
    [1.09, bp.waist + i, 0.093 + i, 0],
    [1.18, bp.waist * 1.07 + i, 0.099 + i, -0.004],
    [1.27, bp.sh * 0.86 + i, bp.chestD + i, 0.002],
    [1.35, bp.sh * 0.9 + i, bp.chestD * 0.96 + i, -0.008],
    [1.41, bp.sh * 0.86 + i, bp.chestD * 0.8 + i, -0.02],
    [1.455, 0.1 + i, 0.07 + i, -0.025],
    [1.485, 0.056 + i * 0.5, 0.05 + i * 0.5, -0.022],
  ];
}

/** Front surface z of the torso at height y (garments hang in front of it). */
function bodyFront(bp: Build, y: number): number {
  const rows = torsoRows(bp, 0.012);
  for (let k = 0; k < rows.length - 1; k++) {
    const [ya, , ha, za] = rows[k];
    const [yb, , hb, zb] = rows[k + 1];
    if (y >= ya && y <= yb) {
      const t = (y - ya) / (yb - ya);
      return za + (zb - za) * t + ha + (hb - ha) * t;
    }
  }
  return 0.1;
}

function torsoLoft(bp: Build, inflate: number, y0: number, y1: number, capStart: boolean): THREE.BufferGeometry {
  const rows = torsoRows(bp, inflate);
  const secs: LoftSection[] = [];
  // interpolate rows at the cut heights so garments can cover a band of the torso
  const at = (y: number): [number, number, number, number] => {
    for (let k = 0; k < rows.length - 1; k++) {
      const [ya, wa, ha, za] = rows[k];
      const [yb, wb, hb, zb] = rows[k + 1];
      if (y >= ya && y <= yb) {
        const t = (y - ya) / (yb - ya);
        return [y, wa + (wb - wa) * t, ha + (hb - ha) * t, za + (zb - za) * t];
      }
    }
    return y < rows[0][0] ? rows[0] : rows[rows.length - 1];
  };
  const list = [at(y0), ...rows.filter((r) => r[0] > y0 + 0.005 && r[0] < y1 - 0.005), at(y1)];
  for (const [y, w, h, cz] of list) secs.push({ c: [0, y, cz], w, h, n: 2.35 });
  return loftGeometry(secs, { radial: 20, capStart, subdivide: 2, up: [0, 0, 1] });
}

// ------------------------------------------------------------------------------------------------ outfits

type Sleeve = "none" | "short" | "elbow" | "long" | "wide";
type Feet = "sandal" | "boot" | "shoe" | "bare";

interface OutfitSpec {
  torso: CharSlot;
  sleeve: Sleeve;
  sleeveSlot: CharSlot;
  trousers: CharSlot | null;
  feet: Feet;
  skirt: { slot: CharSlot; top: number; hem: number; flare: number; follow: number; pleats?: boolean } | null;
}

function outfitSpec(o: Outfit, egypt: boolean): OutfitSpec {
  switch (o) {
    case "tunic":
      return { torso: "cloth", sleeve: "short", sleeveSlot: "cloth", trousers: null, feet: egypt ? "sandal" : "sandal", skirt: { slot: "cloth", top: 1.02, hem: 0.56, flare: 0.05, follow: 0.95 } };
    case "robe":
      return { torso: "cloth", sleeve: "wide", sleeveSlot: "cloth", trousers: null, feet: "sandal", skirt: { slot: "cloth", top: 1.02, hem: 0.06, flare: 0.09, follow: 0.7 } };
    case "toga":
      return { torso: "cloth", sleeve: "short", sleeveSlot: "cloth", trousers: null, feet: "sandal", skirt: { slot: "cloth", top: 1.02, hem: 0.3, flare: 0.06, follow: 0.8 } };
    case "kilt":
      return { torso: "skin", sleeve: "none", sleeveSlot: "skin", trousers: null, feet: egypt ? "sandal" : "sandal", skirt: { slot: "linen", top: 1.03, hem: 0.56, flare: 0.05, follow: 0.95, pleats: true } };
    case "armor":
      return { torso: "metal", sleeve: "short", sleeveSlot: "cloth", trousers: null, feet: "boot", skirt: { slot: "leather", top: 1.0, hem: 0.62, flare: 0.05, follow: 1, pleats: true } };
    case "work_clothes":
      return { torso: "cloth", sleeve: "elbow", sleeveSlot: "cloth", trousers: "accent", feet: "boot", skirt: null };
    case "coat":
      return { torso: "cloth", sleeve: "long", sleeveSlot: "cloth", trousers: "accent", feet: "boot", skirt: { slot: "cloth", top: 1.0, hem: 0.46, flare: 0.07, follow: 0.85 } };
    case "dress":
      return { torso: "cloth", sleeve: egypt ? "none" : "short", sleeveSlot: "cloth", trousers: null, feet: egypt ? "sandal" : "shoe", skirt: { slot: "cloth", top: 1.05, hem: 0.07, flare: egypt ? 0.04 : 0.1, follow: 0.75 } };
    case "lab_coat":
      return { torso: "linen", sleeve: "long", sleeveSlot: "linen", trousers: "cloth", feet: "shoe", skirt: { slot: "linen", top: 1.0, hem: 0.5, flare: 0.06, follow: 0.85 } };
    case "uniform":
      return { torso: "cloth", sleeve: "long", sleeveSlot: "cloth", trousers: "cloth", feet: "boot", skirt: null };
    case "cloak":
      return { torso: "accent", sleeve: "long", sleeveSlot: "accent", trousers: "leather", feet: "boot", skirt: { slot: "accent", top: 1.0, hem: 0.62, flare: 0.05, follow: 0.95 } };
  }
}

// ------------------------------------------------------------------------------------------------ the model

const cache = new Map<string, HumanoidModel>();

export function humanoidModel(key: BodyKey): HumanoidModel {
  const k = bodyKeyString(key);
  const hit = cache.get(k);
  if (hit) return hit;
  const sb = new SkinBuilder<CharSlot>(CHAR_SLOTS);
  const flame = buildBody(sb, key);
  const parts = sb.build();
  let tris = 0;
  for (const p of parts) tris += p.geometry.attributes.position.count / 3;
  const m: HumanoidModel = { key: k, parts, tris, flame };
  cache.set(k, m);
  return m;
}

function buildBody(sb: SkinBuilder, key: BodyKey): HumanoidModel["flame"] {
  const bp = BUILDS[key.build % 3];
  const spec = outfitSpec(key.outfit, key.egypt);
  const L = bp.limb;

  // ---------------------------------------------------------------- torso and neck
  const tw = torsoWeigh(bp.sh);
  const torsoSlot = spec.torso;
  const inflate = torsoSlot === "skin" ? 0 : torsoSlot === "metal" ? 0.018 : 0.008;
  if (spec.trousers && torsoSlot !== "metal") {
    sb.add(spec.trousers, torsoLoft(bp, 0.012, 0.82, 1.0, true), tw);
    sb.add(torsoSlot, torsoLoft(bp, inflate, 0.99, 1.485, false), tw);
  } else sb.add(torsoSlot, torsoLoft(bp, inflate, 0.82, 1.485, true), tw);
  if (torsoSlot !== "skin") {
    // the neckline: skin shows above the garment
    sb.add("skin", torsoLoft(bp, 0, 1.44, 1.485, false), tw);
  }
  sb.add("skin", new THREE.CylinderGeometry(0.047, 0.053, 0.14, 12, 1, true), tw, T(0, 1.51, -0.018));
  // shoulders (deltoids)
  for (const sx of [-1, 1]) {
    const j = JOINT[sx > 0 ? B.upperArmL : B.upperArmR];
    const arm = sx > 0 ? B.upperArmL : B.upperArmR;
    const slot: CharSlot = spec.sleeve === "none" ? "skin" : torsoSlot === "metal" ? "metal" : spec.sleeveSlot;
    const d = slot === "skin" ? 0 : slot === "metal" ? 0.014 : 0.009;
    sb.add(slot, sphere(0.05 * L + d, 0.046 * L + d, 0.056 * L + d, 12, 9), (x, y) => [B.chest, arm, sm((Math.abs(x) - 0.13) / 0.06) * 0.95 * (y > 1.3 ? 1 : 0.6)], T(j[0] - sx * 0.004, j[1] - 0.022, j[2]));
  }
  if (bp.bust && torsoSlot !== "skin") {
    for (const sx of [-1, 1]) sb.add(torsoSlot, sphere(0.05, 0.045, 0.03, 10, 8), B.chest, T(sx * 0.052, 1.285, 0.08 + inflate, 0, sx * 0.25));
  }

  // ---------------------------------------------------------------- arms and hands
  for (const sx of [-1, 1]) {
    const left = sx > 0;
    const sh = JOINT[left ? B.upperArmL : B.upperArmR];
    const el = JOINT[left ? B.forearmL : B.forearmR];
    const wr = JOINT[left ? B.handL : B.handR];
    const clav = left ? B.clavL : B.clavR;
    const upper = left ? B.upperArmL : B.upperArmR;
    const fore = left ? B.forearmL : B.forearmR;
    const hand = left ? B.handL : B.handR;
    const upW = limb(clav, upper, fore, sh, el, 0.0, 0.04);
    const foW = limb(upper, fore, hand, el, wr, 0.04, 0.025);
    const upRows: [number, number, number, number?][] = [
      [-0.02, 0.05 * L, 0.054 * L],
      [0.3, 0.047 * L, 0.052 * L, 0.004],
      [0.7, 0.04 * L, 0.044 * L],
      [1.0, 0.035 * L, 0.037 * L],
      [1.08, 0.034 * L, 0.036 * L],
    ];
    const foRows: [number, number, number, number?][] = [
      [-0.05, 0.034 * L, 0.036 * L],
      [0.22, 0.04 * L, 0.041 * L, 0.004],
      [0.6, 0.032 * L, 0.03 * L],
      [1.0, 0.026 * L, 0.02 * L],
    ];
    const sleeveInflate = (rows: [number, number, number, number?][], d: number) => rows.map(([t, w, h, oz]) => [t, w + d, h + d, oz] as [number, number, number, number?]);
    switch (spec.sleeve) {
      case "none":
        sb.add("skin", limbLoft(sh, el, upRows), upW);
        sb.add("skin", limbLoft(el, wr, foRows), foW);
        break;
      case "short":
        sb.add(spec.sleeveSlot, limbLoft(sh, el, sleeveInflate(upRows.slice(0, 3), 0.01).map(([t, w, h, oz], i) => [i === 2 ? 0.48 : t, w, h, oz] as [number, number, number, number?]), 12, false, true), upW);
        sb.add("skin", limbLoft(sh, el, upRows.slice(1)), upW);
        sb.add("skin", limbLoft(el, wr, foRows), foW);
        break;
      case "elbow":
        sb.add(spec.sleeveSlot, limbLoft(sh, el, sleeveInflate(upRows, 0.01)), upW);
        sb.add(spec.sleeveSlot, limbLoft(el, wr, [[-0.05, 0.047, 0.049], [0.12, 0.05, 0.051]], 12, false, true), foW);
        sb.add("skin", limbLoft(el, wr, foRows.slice(1)), foW);
        break;
      case "long":
        sb.add(spec.sleeveSlot, limbLoft(sh, el, sleeveInflate(upRows, 0.011)), upW);
        sb.add(spec.sleeveSlot, limbLoft(el, wr, [[-0.05, 0.045, 0.047], [0.22, 0.05, 0.051], [0.6, 0.043, 0.041], [0.97, 0.037, 0.035]], 12, false, true), foW);
        break;
      case "wide":
        sb.add(spec.sleeveSlot, limbLoft(sh, el, sleeveInflate(upRows, 0.014)), upW);
        sb.add(spec.sleeveSlot, limbLoft(el, wr, [[-0.05, 0.05, 0.052], [0.4, 0.06, 0.065], [0.9, 0.072, 0.08, -0.01], [0.93, 0.07, 0.078, -0.01]], 14), foW);
        sb.add("dark", limbLoft(el, wr, [[0.88, 0.064, 0.072, -0.01], [0.92, 0.062, 0.07, -0.01]], 14, false, true), foW);
        sb.add("skin", limbLoft(el, wr, foRows.slice(2)), foW);
        break;
    }
    if (key.outfit === "armor") sb.add("leather", limbLoft(el, wr, [[0.35, 0.041, 0.041], [0.9, 0.033, 0.03]], 10), foW);
    if (key.outfit === "kilt" && key.egypt) sb.add("gold", limbLoft(sh, el, [[0.55, 0.047, 0.05], [0.63, 0.047, 0.05]], 12), upW);
    buildHand(sb, wr, hand, fore, sx, L);
  }

  // ---------------------------------------------------------------- legs and feet
  for (const sx of [-1, 1]) {
    const left = sx > 0;
    const hip = JOINT[left ? B.thighL : B.thighR];
    const knee = JOINT[left ? B.shinL : B.shinR];
    const ank = JOINT[left ? B.footL : B.footR];
    const thigh = left ? B.thighL : B.thighR;
    const shin = left ? B.shinL : B.shinR;
    const foot = left ? B.footL : B.footR;
    const thW = limb(B.hips, thigh, shin, hip, knee, 0.06, 0.05);
    const shW = limb(thigh, shin, foot, knee, ank, 0.05, 0.03);
    const inX = sx * -0.01;
    const thRows: [number, number, number, number?][] = [
      [-0.12, 0.088 * L, 0.095 * L, -0.005],
      [0.05, 0.086 * L, 0.09 * L, 0.004],
      [0.35, 0.075 * L, 0.078 * L, 0.006],
      [0.75, 0.058 * L, 0.06 * L, 0.002],
      [1.0, 0.051 * L, 0.052 * L],
    ];
    const shRows: [number, number, number, number?][] = [
      [-0.03, 0.05 * L, 0.052 * L],
      [0.22, 0.054 * L, 0.06 * L, -0.012],
      [0.45, 0.047 * L, 0.05 * L, -0.008],
      [0.8, 0.036 * L, 0.036 * L],
      [1.02, 0.033 * L, 0.034 * L],
    ];
    const hipIn: V3 = [hip[0] + inX, hip[1], hip[2]];
    const legSlot: CharSlot = spec.trousers ?? "skin";
    const inf = spec.trousers ? 0.012 : 0;
    sb.add(legSlot, limbLoft(hipIn, knee, thRows.map(([t, w, h, oz]) => [t, w + inf, h + inf, oz] as [number, number, number, number?])), thW);
    if (!spec.trousers) sb.add("skin", sphere(0.032, 0.036, 0.022, 10, 8), (x, y) => [thigh, shin, sm((0.52 - y) / 0.04)], T(knee[0], knee[1] + 0.012, knee[2] + 0.045));
    sb.add(legSlot, limbLoft(knee, ank, shRows.map(([t, w, h, oz]) => [t, w + inf, h + inf, oz] as [number, number, number, number?])), shW);
    if (key.outfit === "armor") sb.add("metal", limbLoft(knee, ank, [[0.08, 0.058, 0.064, 0.008], [0.4, 0.056, 0.062, 0.004], [0.78, 0.044, 0.046]], 12, true, true), shW);
    buildFoot(sb, ank, foot, shin, sx, spec.feet, L);
  }

  // ---------------------------------------------------------------- garments over the body
  if (spec.skirt) {
    const sk = spec.skirt;
    const rows = torsoRows(bp, 0);
    const hipW = bp.hip + 0.018;
    const hipD = sk.pleats ? 0.13 : 0.118;
    const topY = sk.top;
    const secs: LoftSection[] = [];
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = topY - (topY - sk.hem) * t;
      // hug the waist, clear the hips, then flare toward the hem
      const waistW = rows[4][1] + 0.012;
      const w = t < 0.18 ? waistW + (hipW - waistW) * sm(t / 0.18) : hipW + sk.flare * Math.pow((t - 0.18) / 0.82, 1.2) + 0.03 * (t - 0.18);
      const h = t < 0.18 ? 0.1 + (hipD - 0.1) * sm(t / 0.18) : hipD + sk.flare * 0.9 * Math.pow((t - 0.18) / 0.82, 1.2) + 0.02 * (t - 0.18);
      secs.push({ c: [0, y, -0.01], w, h, n: 2.15 });
    }
    if (sk.pleats) {
      const lobe = lobedLatheGeometry(
        secs.map((s) => ({ r: s.w, y: s.c[1], lobe: s.c[1] < topY - 0.04 ? 1 : 0 })).reverse(),
        { segments: 48, lobes: key.outfit === "armor" ? 14 : 24, depth: key.outfit === "armor" ? 0.1 : 0.03, mode: key.outfit === "armor" ? "bundle" : "flute", capTop: false },
      );
      sb.add(sk.slot, lobe, skirtWeigh(topY, sk.hem, sk.follow), T(0, 0, -0.012, 0, 0, 0, 1.06, 1, 0.8));
    } else {
      sb.add(sk.slot, loftGeometry(secs, { radial: 22, subdivide: 2, up: [0, 0, 1] }), skirtWeigh(topY, sk.hem, sk.follow));
      // the inside of long skirts is seen when walking
      if (sk.hem < 0.4) sb.add("dark", loftGeometry(secs.slice(2).map((s) => ({ ...s, w: s.w - 0.004, h: s.h - 0.004 })), { radial: 18, subdivide: 1, up: [0, 0, 1], flip: true }), skirtWeigh(topY, sk.hem, sk.follow));
    }
  }
  garmentExtras(sb, key, bp);

  // ---------------------------------------------------------------- head, hair, headwear, prop
  buildHead(sb, key);
  buildHair(sb, key);
  buildHeadwear(sb, key);
  return buildHeld(sb, key);
}

// ------------------------------------------------------------------------------------------------ hands and feet

function buildHand(sb: SkinBuilder, wr: V3, hand: number, fore: number, sx: number, L: number) {
  const hw: Weigh = (_x, y) => [fore, hand, sm((wr[1] + 0.015 - y) / 0.03)];
  const curl = -sx * 0.012;
  const palm: LoftSection[] = [
    { c: [wr[0], wr[1] + 0.01, wr[2]], w: 0.02 * L, h: 0.032 * L, n: 2.4 },
    { c: [wr[0] + curl * 0.2, wr[1] - 0.035, wr[2] + 0.004], w: 0.021 * L, h: 0.045 * L, n: 3 },
    { c: [wr[0] + curl * 0.5, wr[1] - 0.075, wr[2] + 0.006], w: 0.018 * L, h: 0.044 * L, n: 3.2 },
    { c: [wr[0] + curl * 0.9, wr[1] - 0.115, wr[2] + 0.008], w: 0.014 * L, h: 0.038 * L, n: 3 },
    { c: [wr[0] + curl * 1.6, wr[1] - 0.15, wr[2] + 0.006], w: 0.011 * L, h: 0.03 * L, n: 2.6 },
    { c: [wr[0] + curl * 2.2, wr[1] - 0.168, wr[2] + 0.004], w: 0.008 * L, h: 0.02 * L, n: 2.2 },
  ];
  sb.add("skin", loftGeometry(palm, { radial: 10, subdivide: 2, capStart: true, capEnd: true, up: [0, 0, 1] }), hw);
  // finger separations: two faint grooves on the back of the hand
  // thumb
  const th = new THREE.CatmullRomCurve3([
    new THREE.Vector3(wr[0] - sx * 0.004, wr[1] - 0.022, wr[2] + 0.03 * L),
    new THREE.Vector3(wr[0] - sx * 0.008, wr[1] - 0.06, wr[2] + 0.048 * L),
    new THREE.Vector3(wr[0] - sx * 0.014, wr[1] - 0.09, wr[2] + 0.046 * L),
  ]);
  sb.add("skin", new THREE.TubeGeometry(th, 6, 0.0105 * L, 6, false), hand);
  sb.add("skin", sphere(0.0105 * L, 0.0105 * L, 0.0105 * L, 6, 5), hand, T(wr[0] - sx * 0.014, wr[1] - 0.09, wr[2] + 0.046 * L));
}

function buildFoot(sb: SkinBuilder, ank: V3, foot: number, shin: number, sx: number, feet: Feet, L: number) {
  const fw: Weigh = (_x, y) => [shin, foot, 1 - sm((y - (ank[1] - 0.005)) / 0.035)];
  const out = sx * 0.12;
  const rows: [number, number, number, number][] = [
    [-0.062, 0.03, 0.034, 0.042],
    [-0.02, 0.038, 0.046, 0.05],
    [0.05, 0.044, 0.038, 0.04],
    [0.13, 0.047, 0.024, 0.027],
    [0.185, 0.036, 0.017, 0.019],
    [0.205, 0.02, 0.011, 0.015],
  ];
  const secsFor = (inf: number, hInf: number): LoftSection[] =>
    rows.map(([z, w, h, cy]) => ({ c: [ank[0] + Math.sin(out) * z, cy + hInf * 0.5, ank[2] + Math.cos(out) * z], w: (w + inf) * L, h: h + hInf, n: 2.6, flatBottom: 0.85 }));
  if (feet === "boot" || feet === "shoe") {
    const slot: CharSlot = feet === "boot" ? "leather" : "dark";
    sb.add(slot, loftGeometry(secsFor(0.006, 0.008), { radial: 12, subdivide: 2, capStart: true, capEnd: true }), fw);
    sb.add(slot, loftGeometry(secsFor(0.008, -0.01).map((s) => ({ ...s, c: [s.c[0], 0.008, s.c[2]] as V3, h: 0.012, flatBottom: 0 })), { radial: 10, capStart: true, capEnd: true }), fw);
    if (feet === "boot") sb.add("leather", limbLoft([ank[0], ank[1] - 0.03, ank[2]], [ank[0], 0.36, ank[2] - 0.006], [[0, 0.042, 0.05], [0.5, 0.047, 0.055, -0.008], [1, 0.052, 0.056, -0.01]], 12, false, true), (x, y) => [shin, foot, 1 - sm((y - ank[1] + 0.02) / 0.05)]);
    return;
  }
  sb.add("skin", loftGeometry(secsFor(0, 0), { radial: 12, subdivide: 2, capStart: true, capEnd: true }), fw);
  if (feet === "sandal") {
    // sole and straps
    sb.add("leather", loftGeometry(secsFor(0.008, 0).map((s) => ({ ...s, c: [s.c[0], 0.006, s.c[2]] as V3, h: 0.008, flatBottom: 0 })), { radial: 10, capStart: true, capEnd: true }), foot);
    const zf = ank[2] + 0.06;
    sb.add("leather", strap([[ank[0] - 0.047, 0.03, zf], [ank[0], 0.058, zf + 0.006], [ank[0] + 0.047, 0.03, zf]], 0.009, 0.004), foot);
    sb.add("leather", strap(ring(ank[1] - 0.012, 0.04, 0.045, ank[2], 12).map((p) => [p[0] + ank[0], p[1], p[2]] as V3), 0.007, 0.004, true), () => [shin, foot, 1]);
  }
}

// ------------------------------------------------------------------------------------------------ garment extras

function garmentExtras(sb: SkinBuilder, key: BodyKey, bp: Build) {
  const tw = torsoWeigh(bp.sh);
  const waistRing = (y: number, slot: CharSlot, hw: number, extra = 0.016) => {
    const w = (y < 1.02 ? (bp.hip + bp.waist) / 2 : bp.waist) + extra;
    sb.add(slot, strap(ring(y, w, 0.1 + extra, -0.004, 24), hw, 0.006, true), tw);
  };
  switch (key.outfit) {
    case "tunic":
      waistRing(1.04, "accent", 0.02);
      sb.add("accent", strap(ring(1.465, 0.08, 0.062, -0.02, 18), 0.008, 0.004, true), tw);
      break;
    case "robe":
      waistRing(1.07, "accent", 0.028, 0.02);
      // a hanging sash end
      sb.add("accent", strap([[0.06, 1.05, 0.105], [0.07, 0.9, 0.12], [0.075, 0.72, 0.13]], 0.03, 0.005), skirtWeigh(1.07, 0.6, 0.6));
      break;
    case "toga": {
      // the draped toga: over the left shoulder, across the chest to the right hip, round the back
      const path: V3[] = [
        [0.17, 1.44, -0.05],
        [0.15, 1.47, 0.03],
        [0.09, 1.38, 0.115],
        [0.0, 1.24, 0.13],
        [-0.1, 1.08, 0.12],
        [-0.17, 0.98, 0.04],
        [-0.15, 0.97, -0.08],
        [-0.02, 1.05, -0.14],
        [0.1, 1.22, -0.13],
        [0.16, 1.38, -0.1],
      ];
      sb.add("linen", strap(path, 0.075, 0.012), tw);
      sb.add("linen", strap([[0.2, 1.4, 0.02], [0.22, 1.2, 0.05], [0.23, 0.98, 0.06]], 0.055, 0.01), (x, y) => [B.chest, B.upperArmL, sm((1.4 - y) / 0.2) * 0.6]);
      break;
    }
    case "kilt":
      waistRing(1.035, "accent", 0.022, 0.03);
      // front panel of the shendyt and the broad collar (wesekh)
      sb.add("linen", strap([[0.0, 1.0, 0.13], [0.0, 0.8, 0.155], [0.0, 0.6, 0.165]], 0.055, 0.004), skirtWeigh(1.02, 0.56, 0.4));
      if (key.egypt || key.headwear === "headdress") {
        const bands: [CharSlot, number, number][] = [
          ["gold", 0.07, 0.1],
          ["accent", 0.1, 0.13],
          ["gold", 0.13, 0.15],
          ["cloth", 0.15, 0.172],
        ];
        for (const [slot, r0, r1] of bands) {
          const g = new THREE.LatheGeometry([new THREE.Vector2(r1, 0.02 - r1 * 0.5), new THREE.Vector2(r0, 0.02 - r0 * 0.5)], 24);
          sb.add(slot, g, tw, T(0, 1.46, -0.02, 0, 0, 0, 1, 1, 0.78));
        }
      }
      break;
    case "armor":
      // pauldrons, a belt, a gorget
      for (const sx of [-1, 1]) sb.add("metal", sphere(0.075, 0.05, 0.078, 12, 8), () => [B.chest, sx > 0 ? B.upperArmL : B.upperArmR, 0.7], T(sx * 0.185, 1.43, -0.025, 0, 0, sx * -0.35));
      waistRing(1.0, "leather", 0.03, 0.03);
      sb.add("metal", strap(ring(1.47, 0.078, 0.066, -0.022, 18), 0.018, 0.006, true), tw);
      break;
    case "work_clothes": {
      waistRing(1.02, "leather", 0.02, 0.02);
      // leather apron from the chest to the knees
      const rows: V3[][] = [];
      for (let i = 0; i <= 6; i++) {
        const y = 1.3 - (i / 6) * 0.72;
        const row: V3[] = [];
        for (let j = 0; j <= 4; j++) {
          const u = j / 4 - 0.5;
          const zf = bodyFront(bp, y) + 0.03 + (y < 0.9 ? (0.9 - y) * 0.12 : 0);
          row.push([u * 0.3, y, zf - u * u * 0.25]);
        }
        rows.push(row);
      }
      sb.add("leather", sheetGeometry2(rows), (x, y, z) => (y > 1.0 ? tw(x, y, z) : skirtWeigh(1.0, 0.58, 0.7)(x, y, z)));
      sb.add("leather", strap([[-0.08, 1.3, 0.125], [-0.07, 1.47, 0.03], [0, 1.49, -0.05], [0.07, 1.47, 0.03], [0.08, 1.3, 0.125]], 0.01, 0.004), tw);
      break;
    }
    case "coat":
    case "lab_coat": {
      // lapels, a front opening and buttons
      const slot: CharSlot = key.outfit === "coat" ? "cloth" : "linen";
      for (const sx of [-1, 1]) sb.add(slot, strap([[sx * 0.03, 1.46, 0.07], [sx * 0.07, 1.34, 0.118], [sx * 0.04, 1.2, 0.112]], 0.022, 0.006), tw);
      sb.add("dark", strap([[0, 1.24, 0.113], [0, 1.08, 0.105], [0, 0.95, 0.128], [0, 0.6, 0.155]], 0.004, 0.003), (x, y, z) => (y > 1.0 ? tw(x, y, z) : [B.hips, B.hips, 0]));
      if (key.outfit === "lab_coat") sb.add("cloth", strap([[-0.03, 1.46, 0.06], [0, 1.4, 0.1], [0.03, 1.46, 0.06]], 0.02, 0.004), tw);
      for (let i = 0; i < 4; i++) sb.add(key.outfit === "coat" ? "gold" : "linen", sphere(0.008, 0.008, 0.005, 6, 4), tw, T(0.018, 1.18 - i * 0.07, 0.108));
      break;
    }
    case "dress":
      waistRing(1.08, "accent", 0.018, 0.012);
      if (key.egypt) for (const sx of [-1, 1]) sb.add("cloth", strap([[sx * 0.07, 1.3, 0.1], [sx * 0.1, 1.44, 0.03], [sx * 0.09, 1.42, -0.07]], 0.016, 0.004), tw);
      if (key.egypt) {
        const bands: [CharSlot, number, number][] = [
          ["gold", 0.07, 0.1],
          ["accent", 0.1, 0.125],
          ["gold", 0.125, 0.14],
        ];
        for (const [slot, r0, r1] of bands) sb.add(slot, new THREE.LatheGeometry([new THREE.Vector2(r1, 0.02 - r1 * 0.5), new THREE.Vector2(r0, 0.02 - r0 * 0.5)], 24), tw, T(0, 1.465, -0.02, 0, 0, 0, 1, 1, 0.78));
      }
      break;
    case "uniform":
      waistRing(1.03, "accent", 0.024, 0.02);
      sb.add("gold", sphere(0.018, 0.014, 0.008, 6, 4), tw, T(0, 1.03, 0.125));
      for (let i = 0; i < 5; i++) sb.add("gold", sphere(0.008, 0.008, 0.005, 6, 4), tw, T(0, 1.4 - i * 0.07, 0.117 - (i === 0 ? 0.01 : 0)));
      for (const sx of [-1, 1]) sb.add("gold", new THREE.BoxGeometry(0.07, 0.012, 0.06), () => [B.chest, sx > 0 ? B.upperArmL : B.upperArmR, 0.5], T(sx * 0.16, 1.455, -0.02, 0, 0, sx * -0.2));
      // trouser stripes
      for (const sx of [-1, 1]) {
        const hip = JOINT[sx > 0 ? B.thighL : B.thighR];
        const ank = JOINT[sx > 0 ? B.footL : B.footR];
        const thigh = sx > 0 ? B.thighL : B.thighR;
        const shin = sx > 0 ? B.shinL : B.shinR;
        sb.add("accent", strap([[hip[0] + sx * 0.098, 0.9, 0], [sx * 0.165, 0.52, 0], [ank[0] + sx * 0.046, 0.12, -0.01]], 0.008, 0.003), (x, y) => [thigh, shin, sm((0.55 - y) / 0.1)]);
      }
      break;
    case "cloak": {
      // an open-fronted cape hanging from the shoulders to the calves, lined, with a collar and a clasp
      const secs: LoftSection[] = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const y = 1.47 - t * 1.08;
        secs.push({ c: [0, y, 0.0 - t * 0.03], w: 0.215 + t * 0.1, h: 0.14 + t * 0.07, n: 2.3 });
      }
      const cw: Weigh = (x, y, z) => (y > 1.2 ? tw(x, y, z) : y > 0.95 ? [B.chest, B.hips, sm((1.2 - y) / 0.25)] : [B.hips, x >= 0 ? B.thighL : B.thighR, sm((0.95 - y) / 0.6) * 0.35 * sm(Math.abs(x) / 0.15)]);
      sb.add("cloth", loftGeometry(secs, { radial: 18, lowerHalf: true, subdivide: 2, up: [0, 0, 1] }), cw);
      sb.add("accent", loftGeometry(secs.map((q) => ({ ...q, w: q.w - 0.008, h: q.h - 0.008 })), { radial: 16, lowerHalf: true, subdivide: 1, up: [0, 0, 1], flip: true }), cw);
      sb.add("cloth", strap(ring(1.47, 0.11, 0.095, -0.02, 20), 0.03, 0.012, true), tw);
      sb.add("gold", sphere(0.018, 0.018, 0.01, 8, 6), tw, T(0.05, 1.43, 0.085));
      break;
    }
  }
}

/** A single-sided parametric sheet (rows of points), made double-sided so it reads from either side. */
function sheetGeometry2(rows: readonly (readonly V3[])[]): THREE.BufferGeometry {
  const R = rows.length;
  const C = rows[0].length;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const row of rows) for (const p of row) pos.push(...p);
  for (let r = 0; r < R - 1; r++)
    for (let c = 0; c < C - 1; c++) {
      const a = r * C + c;
      idx.push(a, a + 1, a + C, a + 1, a + C + 1, a + C);
      idx.push(a, a + C, a + 1, a + 1, a + C, a + C + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------------------------------------ head and face

/** Cranium centre (bind pose): hair and headwear are fitted around it. */
const CRANIUM: V3 = [0, 1.655, -0.006];

/** Head cross-sections from the chin to the crown: [y, halfWidth, halfDepth, zCentre, superellipse n]. */
const HEAD_ROWS: [number, number, number, number, number][] = [
  [1.503, 0.018, 0.016, 0.07, 2],
  [1.515, 0.036, 0.034, 0.062, 2.2],
  [1.535, 0.05, 0.056, 0.042, 2.3],
  [1.56, 0.058, 0.072, 0.024, 2.3],
  [1.59, 0.066, 0.086, 0.012, 2.25],
  [1.625, 0.072, 0.094, 0.004, 2.2],
  [1.66, 0.076, 0.099, -0.004, 2.15],
  [1.695, 0.075, 0.098, -0.01, 2.1],
  [1.725, 0.066, 0.087, -0.013, 2.1],
  [1.745, 0.045, 0.058, -0.013, 2],
  [1.753, 0.012, 0.016, -0.012, 2],
];

/** Front surface z of the head at height y and lateral offset x (for placing features on the face). */
function faceZ(y: number, x = 0): number {
  for (let k = 0; k < HEAD_ROWS.length - 1; k++) {
    const [ya, wa, ha, za, na] = HEAD_ROWS[k];
    const [yb, wb, hb, zb] = HEAD_ROWS[k + 1];
    if (y >= ya && y <= yb) {
      const t = (y - ya) / (yb - ya);
      const w = wa + (wb - wa) * t;
      const h = ha + (hb - ha) * t;
      const zc = za + (zb - za) * t;
      const u = Math.min(0.999, Math.abs(x) / w);
      return zc + h * Math.pow(1 - Math.pow(u, na), 1 / na);
    }
  }
  return 0.09;
}

function buildHead(sb: SkinBuilder, key: BodyKey) {
  const h = B.head;
  const slender = key.build === 2;
  const k = slender ? 0.95 : 1;
  sb.add("skin", loftGeometry(HEAD_ROWS.map(([y, w, d, cz, n]) => ({ c: [0, y, cz] as V3, w: w * (y < 1.6 ? k : 1), h: d, n })), { radial: 22, subdivide: 2, capStart: true, capEnd: true, up: [0, 0, 1] }), h);
  // jaw angles and cheekbones soften the ellipse into a face
  for (const sx of [-1, 1]) {
    sb.add("skin", sphere(0.016, 0.02, 0.026, 8, 6), h, T(sx * 0.044 * k, 1.556, 0.028));
    sb.add("skin", sphere(0.022, 0.016, 0.02, 8, 6), h, T(sx * 0.047, 1.615, faceZ(1.615, 0.047) - 0.014));
  }
  // brow ridge
  sb.add("skin", sphere(0.058, 0.011, 0.016, 12, 6), h, T(0, 1.655, faceZ(1.655) - 0.01));
  // nose: a ridge from the brow to the tip, with wings
  const top: V3 = [0, 1.648, faceZ(1.648) - 0.006];
  const tip: V3 = [0, 1.598, faceZ(1.598) + 0.022];
  sb.add("skin", loftGeometry([
    { c: top, w: 0.0065, h: 0.006, n: 2 },
    { c: lerp3(top, tip, 0.55), w: 0.009, h: 0.01, n: 2 },
    { c: tip, w: 0.011, h: 0.011, n: 2 },
  ], { radial: 10, capStart: true, capEnd: true }), h);
  sb.add("skin", sphere(0.0165, 0.009, 0.012, 10, 6), h, T(0, 1.593, faceZ(1.593) + 0.006));
  // lips and the mouth line
  sb.add("skin", sphere(0.02, 0.0065, 0.008, 10, 6), h, T(0, 1.564, faceZ(1.564) + 0.001));
  sb.add("skin", sphere(0.018, 0.007, 0.008, 10, 6), h, T(0, 1.553, faceZ(1.553) + 0.001));
  sb.add("dark", sphere(0.017, 0.0018, 0.004, 8, 4), h, T(0, 1.5585, faceZ(1.5585) + 0.006));
  // eyes: dark almonds set under the brow, lids above them, brows of hair
  for (const sx of [-1, 1]) {
    const ex = sx * 0.03;
    const ez = faceZ(1.636, 0.03);
    sb.add("dark", sphere(0.012, 0.006, 0.004, 10, 6), h, T(ex, 1.636, ez - 0.001));
    sb.add("skin", sphere(0.014, 0.0045, 0.006, 10, 6), h, T(ex, 1.6425, ez - 0.002));
    sb.add("hair", sphere(0.016, 0.003, 0.004, 8, 4), h, T(sx * 0.031, 1.658, faceZ(1.658, 0.031) + 0.001, 0, 0, sx * -0.14));
    if (key.egypt) sb.add("dark", sphere(0.011, 0.0018, 0.003, 6, 4), h, T(sx * 0.047, 1.6365, faceZ(1.636, 0.047) - 0.003, 0, sx * 0.55));
    // ears
    sb.add("skin", sphere(0.009, 0.025, 0.016, 8, 8), h, T(sx * 0.076, 1.628, -0.008, 0, sx * 0.3));
  }
}

function buildHair(sb: SkinBuilder, key: BodyKey) {
  const h = B.head;
  // headwear that covers the whole head hides the hair
  if (key.headwear === "hood" || key.headwear === "helmet" || key.headwear === "headdress" || key.headwear === "turban" || key.headwear === "scarf" || key.headwear === "hard_hat") {
    if (key.headwear === "helmet" || key.headwear === "hard_hat") sb.add("hair", sphere(0.083, 0.05, 0.1, 12, 8), h, T(CRANIUM[0], 1.62, CRANIUM[2] - 0.01));
    return;
  }
  const v = key.hair % 4;
  if (key.egypt) {
    if (v === 2) {
      // shaved head (priests): a faint stubble shade
      sb.add("hair", sphere(0.0785, 0.07, 0.101, 16, 8), h, T(CRANIUM[0], 1.672, CRANIUM[2] - 0.004));
      return;
    }
    // the bob wig: a straight-cut shell from the crown to the jaw (or the shoulders), open at the face, with a fringe
    const bottom = v === 1 ? 1.4 : 1.535;
    const prof: THREE.Vector2[] = [
      new THREE.Vector2(0.001, 1.765),
      new THREE.Vector2(0.06, 1.752),
      new THREE.Vector2(0.092, 1.71),
      new THREE.Vector2(0.104, 1.65),
      new THREE.Vector2(0.108, 1.58),
      new THREE.Vector2(0.112, bottom + 0.02),
      new THREE.Vector2(0.1, bottom),
    ];
    const wig = new THREE.LatheGeometry(prof, 22, 0.78, Math.PI * 2 - 1.56);
    sb.add("hair", wig, (x, y) => (y > 1.5 ? [h, h, 0] : [B.neck, h, 0.6]), T(0, 0, -0.01, 0, 0, 0, 0.97, 1, 1.1));
    // fringe across the forehead
    const fr = new THREE.LatheGeometry([new THREE.Vector2(0.1, 1.735), new THREE.Vector2(0.104, 1.68), new THREE.Vector2(0.1, 1.672)], 18, -0.8, 1.6);
    sb.add("hair", fr, h, T(0, 0, -0.008));
    if (v === 3) sb.add("accent", strap(ring(1.7, 0.1, 0.108, -0.01, 18), 0.009, 0.005, true), h);
    return;
  }
  // short crop: a cap tilted back from the hairline
  sb.add("hair", new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), h, T(CRANIUM[0], CRANIUM[1] + 0.005, CRANIUM[2] - 0.008, 0, 0, 0, 0.083, 0.102, 0.106).multiply(new THREE.Matrix4().makeRotationX(-0.42)));
  // sideburns / back
  sb.add("hair", sphere(0.08, 0.06, 0.08, 14, 8), h, T(0, 1.63, -0.03));
  if (v === 1) {
    // long hair down the back
    sb.add("hair", loftGeometry([
      { c: [0, 1.66, -0.05], w: 0.085, h: 0.07, n: 2.4 },
      { c: [0, 1.52, -0.075], w: 0.09, h: 0.04, n: 3 },
      { c: [0, 1.36, -0.085], w: 0.085, h: 0.025, n: 3 },
    ], { radial: 14, subdivide: 2, capEnd: true, up: [0, 0, 1] }), (x, y) => (y > 1.5 ? [h, h, 0] : [B.neck, B.chest, sm((1.5 - y) / 0.12)]));
  } else if (v === 2) {
    sb.add("hair", sphere(0.04, 0.036, 0.038, 10, 8), h, T(0, 1.69, -0.105));
  } else if (v === 3) {
    // a fuller top
    sb.add("hair", sphere(0.086, 0.05, 0.1, 14, 8), h, T(0, 1.725, 0.0));
  }
}

// ------------------------------------------------------------------------------------------------ headwear

function buildHeadwear(sb: SkinBuilder, key: BodyKey) {
  const h = B.head;
  const hdW: Weigh = (x, y) => (y > 1.53 ? [h, h, 0] : y > 1.45 ? [B.neck, h, sm((y - 1.45) / 0.08)] : [B.chest, B.neck, sm((y - 1.38) / 0.07)]);
  switch (key.headwear) {
    case "none":
      return;
    case "hood": {
      const prof = [
        new THREE.Vector2(0.001, 1.775),
        new THREE.Vector2(0.07, 1.765),
        new THREE.Vector2(0.105, 1.72),
        new THREE.Vector2(0.118, 1.64),
        new THREE.Vector2(0.115, 1.55),
        new THREE.Vector2(0.14, 1.47),
        new THREE.Vector2(0.2, 1.42),
        new THREE.Vector2(0.23, 1.38),
      ];
      sb.add(key.outfit === "cloak" ? "cloth" : key.outfit === "robe" || key.outfit === "coat" ? "cloth" : "accent", new THREE.LatheGeometry(prof, 22, 0.72, Math.PI * 2 - 1.44), hdW, T(0, 0, -0.018, 0, 0, 0, 1, 1, 1.08));
      sb.add("dark", new THREE.LatheGeometry(prof.slice(0, 6).map((p) => new THREE.Vector2(p.x - 0.006, p.y)), 12, -0.7, 1.4), hdW, T(0, 0, -0.03, 0, 0, 0, 1, 1, 0.9));
      return;
    }
    case "wide_hat":
      sb.add("straw", new THREE.CylinderGeometry(0.215, 0.225, 0.012, 24), h, T(0, 1.715, -0.005));
      sb.add("straw", new THREE.CylinderGeometry(0.085, 0.098, 0.1, 18), h, T(0, 1.77, -0.005));
      sb.add("accent", new THREE.CylinderGeometry(0.1, 0.1, 0.018, 18, 1, true), h, T(0, 1.73, -0.005));
      return;
    case "cap":
      sb.add("accent", new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), h, T(0, 1.68, -0.005, 0, 0, 0, 0.087, 0.085, 0.103).multiply(new THREE.Matrix4().makeRotationX(-0.12)));
      sb.add("accent", new THREE.CylinderGeometry(0.075, 0.075, 0.006, 16, 1, false, -0.9, 1.8), h, T(0, 1.69, 0.05, 0, 0, 0, 1, 1, 1.1).multiply(new THREE.Matrix4().makeRotationX(0.12)));
      return;
    case "helmet":
      sb.add("metal", new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), h, T(0, 1.66, -0.006, 0, 0, 0, 0.092, 0.11, 0.112));
      sb.add("metal", new THREE.TorusGeometry(0.1, 0.008, 5, 22), h, T(0, 1.63, -0.006, 0, Math.PI / 2, 0, 1, 1.1, 1).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
      sb.add("metal", new THREE.BoxGeometry(0.012, 0.055, 0.008), h, T(0, 1.625, 0.108));
      for (const sx of [-1, 1]) sb.add("metal", new THREE.BoxGeometry(0.008, 0.07, 0.05), h, T(sx * 0.085, 1.59, 0.02));
      sb.add("accent", new THREE.BoxGeometry(0.018, 0.05, 0.19), h, T(0, 1.785, -0.02));
      return;
    case "headdress": {
      // nemes: striped headcloth, lappets falling in front of the shoulders, a queue at the back
      sb.add("cloth", new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), h, T(0, 1.665, -0.012, 0, 0, 0, 0.1, 0.108, 0.114).multiply(new THREE.Matrix4().makeRotationX(-0.25)));
      sb.add("gold", strap(ring(1.7, 0.098, 0.108, -0.006, 20).filter((p) => p[2] > -0.02), 0.009, 0.005), h);
      for (let k = 0; k < 4; k++) sb.add("gold", new THREE.TorusGeometry(0.1 - k * 0.004, 0.004, 4, 20, Math.PI), h, T(0, 1.665, -0.012 - 0.03 * k, 0, 0, 0, 1, 1.08, 1).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationZ(0)));
      for (const sx of [-1, 1]) {
        // wing behind the ear then the lappet down to the chest, in alternating stripes
        const pts: V3[] = [
          [sx * 0.098, 1.66, 0.0],
          [sx * 0.118, 1.57, 0.02],
          [sx * 0.112, 1.49, 0.05],
          [sx * 0.098, 1.4, 0.085],
          [sx * 0.093, 1.34, 0.1],
        ];
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b2 = pts[i + 1];
          for (let k = 0; k < 3; k++) {
            const t0 = k / 3;
            const t1 = (k + 1) / 3;
            const pa = lerp3(a, b2, t0);
            const pb = lerp3(a, b2, t1);
            const wdt = i === 0 ? 0.03 : 0.04;
            sb.add((i * 3 + k) % 2 ? "gold" : "cloth", loftGeometry([
              { c: pa, w: 0.012, h: wdt, n: 4 },
              { c: pb, w: 0.012, h: wdt, n: 4 },
            ], { radial: 8, capStart: true, capEnd: true, up: [0, 0, 1] }), hdW);
          }
        }
      }
      sb.add("cloth", loftGeometry([
        { c: [0, 1.62, -0.1], w: 0.05, h: 0.02, n: 3 },
        { c: [0, 1.5, -0.1], w: 0.03, h: 0.018, n: 3 },
        { c: [0, 1.44, -0.09], w: 0.02, h: 0.015, n: 3 },
      ], { radial: 8, capEnd: true, up: [0, 0, 1] }), hdW);
      // the uraeus
      sb.add("gold", new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.7, 0.1), new THREE.Vector3(0, 1.73, 0.112), new THREE.Vector3(0, 1.745, 0.105)]), 6, 0.006, 5), h);
      return;
    }
    case "turban":
      for (let k = 0; k < 4; k++) sb.add("accent", new THREE.TorusGeometry(0.086 - k * 0.006, 0.024, 8, 20), h, T(0, 1.69 + k * 0.026, -0.008, 0, k * 0.4, 0, 1, 1, 1.15).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 + (k % 2 ? 0.12 : -0.1))));
      sb.add("accent", sphere(0.075, 0.045, 0.085, 14, 8), h, T(0, 1.76, -0.008));
      return;
    case "scarf": {
      const prof = [new THREE.Vector2(0.001, 1.77), new THREE.Vector2(0.075, 1.755), new THREE.Vector2(0.1, 1.71), new THREE.Vector2(0.108, 1.63), new THREE.Vector2(0.1, 1.55), new THREE.Vector2(0.09, 1.49)];
      sb.add("accent", new THREE.LatheGeometry(prof, 20, 0.85, Math.PI * 2 - 1.7), hdW, T(0, 0, -0.012));
      sb.add("accent", strap(ring(1.49, 0.07, 0.065, -0.02, 18), 0.03, 0.012, true), hdW);
      sb.add("accent", strap([[0.06, 1.5, -0.06], [0.08, 1.38, -0.11], [0.09, 1.25, -0.12]], 0.035, 0.006), (x, y) => [B.neck, B.chest, sm((1.5 - y) / 0.1)]);
      return;
    }
    case "crown":
      sb.add("gold", new THREE.CylinderGeometry(0.093, 0.09, 0.035, 22, 1, true), h, T(0, 1.715, -0.006, 0, 0, 0, 1, 1, 1.1));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        sb.add("gold", new THREE.ConeGeometry(0.014, 0.045, 4), h, T(Math.sin(a) * 0.093, 1.752, -0.006 + Math.cos(a) * 0.102));
      }
      sb.add("accent", sphere(0.01, 0.012, 0.006, 6, 5), h, T(0, 1.715, 0.1));
      return;
    case "hard_hat":
      sb.add("hardhat", new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI * 0.5), h, T(0, 1.675, -0.006, 0, 0, 0, 0.1, 0.1, 0.118));
      sb.add("hardhat", new THREE.CylinderGeometry(0.108, 0.11, 0.008, 22), h, T(0, 1.678, 0.0, 0, 0, 0, 1, 1, 1.25));
      sb.add("hardhat", new THREE.BoxGeometry(0.018, 0.02, 0.2), h, T(0, 1.775, -0.01));
      return;
    case "wreath":
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2;
        if (Math.cos(a) > 0.93) continue;
        sb.add("foliage", sphere(0.011, 0.005, 0.02, 6, 4), h, T(Math.sin(a) * 0.088, 1.705 + Math.cos(a * 2) * 0.004, -0.008 + Math.cos(a) * 0.098, a + 0.5, 0.3));
      }
      return;
  }
}

// ------------------------------------------------------------------------------------------------ held props

/** Grip centre of each hand in the bind pose; a gripped rod runs along z through it (vertical once the elbow bends). */
const GRIP_R: V3 = [JOINT[B.handR][0] + 0.006, JOINT[B.handR][1] - 0.07, JOINT[B.handR][2] + 0.01];
const GRIP_L: V3 = [JOINT[B.handL][0] - 0.006, JOINT[B.handL][1] - 0.07, JOINT[B.handL][2] + 0.01];

function rodAlongZ(r: number, z0: number, z1: number, segs = 8) {
  const g = new THREE.CylinderGeometry(r, r, z1 - z0, segs);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, (z0 + z1) / 2);
  return g;
}

function buildHeld(sb: SkinBuilder, key: BodyKey): HumanoidModel["flame"] {
  const hr = B.handR;
  const hl = B.handL;
  const [gx, gy, gz] = GRIP_R;
  const at = (x: number, y: number, z: number) => T(gx + x, gy + y, gz + z);
  switch (key.held) {
    case "none":
      return null;
    case "staff":
      sb.add("wood", rodAlongZ(0.017, -1.08, 0.82), hr, at(0, 0, 0));
      if (key.egypt) sb.add("gold", new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI * 1.2), hr, at(0, -0.04, 0.84).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)));
      else sb.add("wood", sphere(0.03, 0.03, 0.035, 8, 6), hr, at(0, 0, 0.83));
      return null;
    case "spear":
      sb.add("wood", rodAlongZ(0.014, -1.1, 1.05), hr, at(0, 0, 0));
      sb.add("metal", new THREE.ConeGeometry(0.028, 0.2, 4).rotateX(Math.PI / 2), hr, at(0, 0, 1.15));
      sb.add("metal", rodAlongZ(0.018, 1.02, 1.06), hr, at(0, 0, 0));
      return null;
    case "torch":
      sb.add("wood", rodAlongZ(0.02, -0.28, 0.3), hr, at(0, 0, 0));
      sb.add("leather", rodAlongZ(0.032, 0.26, 0.38, 8), hr, at(0, 0, 0));
      return { bone: hr, at: [gx, gy, gz + 0.4], size: 0.26, lamp: false };
    case "lantern": {
      // a ring handle in the fist, the lantern hanging below
      sb.add("metal", new THREE.TorusGeometry(0.035, 0.005, 4, 12), hr, at(0, -0.02, 0).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)));
      const cy = -0.2;
      sb.add("metal", new THREE.CylinderGeometry(0.03, 0.055, 0.04, 8), hr, at(0, cy + 0.1, 0));
      sb.add("metal", new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8), hr, at(0, cy - 0.08, 0));
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        sb.add("metal", new THREE.CylinderGeometry(0.005, 0.005, 0.16, 4), hr, at(Math.sin(a) * 0.05, cy, Math.cos(a) * 0.05));
      }
      sb.add("glow", new THREE.CylinderGeometry(0.042, 0.042, 0.12, 8), hr, at(0, cy, 0));
      return { bone: hr, at: [gx, gy + cy, gz], size: 0.12, lamp: true };
    }
    case "tool":
      sb.add("wood", rodAlongZ(0.012, -0.1, 0.24), hr, at(0, 0, 0));
      sb.add("metal", new THREE.BoxGeometry(0.03, 0.12, 0.035), hr, at(0, 0.02, 0.24));
      // a chisel in the other hand
      sb.add("metal", rodAlongZ(0.006, -0.02, 0.16), hl, T(GRIP_L[0], GRIP_L[1], GRIP_L[2]));
      return null;
    case "scroll":
      sb.add("linen", rodAlongZ(0.024, -0.14, 0.14, 12), hr, at(0, 0, 0));
      for (const z of [-0.15, 0.15]) sb.add("wood", rodAlongZ(0.01, z - 0.012, z + 0.012, 6), hr, at(0, 0, 0));
      return null;
    case "book":
      sb.add("accent", new THREE.BoxGeometry(0.035, 0.2, 0.15), hl, T(GRIP_L[0] + 0.008, GRIP_L[1] - 0.03, GRIP_L[2] + 0.01));
      sb.add("linen", new THREE.BoxGeometry(0.03, 0.19, 0.142), hl, T(GRIP_L[0] + 0.01, GRIP_L[1] - 0.03, GRIP_L[2] + 0.018));
      return null;
    case "tablet": {
      const digital = key.outfit === "lab_coat" || key.outfit === "uniform" || key.outfit === "work_clothes";
      if (digital) {
        sb.add("dark", new THREE.BoxGeometry(0.012, 0.24, 0.17), hl, T(GRIP_L[0] + 0.004, GRIP_L[1] - 0.04, GRIP_L[2] + 0.02));
        sb.add("glow", new THREE.BoxGeometry(0.002, 0.2, 0.14), hl, T(GRIP_L[0] - 0.003, GRIP_L[1] - 0.04, GRIP_L[2] + 0.02));
      } else {
        // a scribe's palette: a wooden slat with ink wells and a reed pen
        sb.add("wood", new THREE.BoxGeometry(0.014, 0.3, 0.06), hl, T(GRIP_L[0] + 0.004, GRIP_L[1] - 0.05, GRIP_L[2] + 0.02));
        for (const dy of [0.06, 0.1]) sb.add("dark", sphere(0.012, 0.012, 0.012, 6, 4), hl, T(GRIP_L[0] - 0.004, GRIP_L[1] - 0.05 + dy, GRIP_L[2] + 0.02));
        sb.add("straw", rodAlongZ(0.003, -0.02, 0.18, 4), hr, at(0, 0, 0));
      }
      return null;
    }
    case "basket": {
      const [lx, ly, lz] = GRIP_L;
      sb.add("straw", new THREE.TorusGeometry(0.1, 0.008, 4, 14, Math.PI), hl, T(lx, ly - 0.1, lz, Math.PI / 2, 0, 0).multiply(new THREE.Matrix4().makeRotationX(Math.PI)));
      sb.add("straw", new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.08, 0.005), new THREE.Vector2(0.11, 0.1), new THREE.Vector2(0.115, 0.11)], 12), hl, T(lx + 0.02, ly - 0.3, lz));
      sb.add("foliage", sphere(0.1, 0.03, 0.1, 10, 5), hl, T(lx + 0.02, ly - 0.19, lz));
      return null;
    }
  }
}

export { GRIP_R, GRIP_L };
