import * as THREE from "three";
import type { WildlifeKind } from "../../../contracts/world3d";
import { lerp3, limb, SkinBuilder, sm, sphere, T, type Weigh } from "../characters/body";
import { loftGeometry, type LoftSection, type V3 } from "../structures/geom";

/*
 * Animal bodies (pure geometry, no React). Ground animals share one parametric, skinned QUADRUPED (a lofted torso with
 * haunches and chest, a neck and a lofted head with snout, ears, eyes and nose, four two-segment legs ending in paws or
 * hooves, a tail) whose proportions come from a per-species spec: a lithe Egyptian cat, a slim pharaoh hound, a
 * bearded goat with swept-back horns, a humped camel with a long curved neck, a maned horse. The sacred ibis is a
 * skinned wader (white body, black head and neck, down-curved bill, long legs with backward-bending ankles). Flock
 * birds, butterflies and fish are small static meshes the renderer instances.
 *
 * Bones (quadruped): root, hips, chest, neck, head, tail1, tail2, then upper/lower for FL, FR, HL, HR. Convention as
 * the humanoid: legs hang down and swing forward with -x; the torso bone runs toward +z (the head end).
 */

export const ANIMAL_SLOTS = ["coat", "coat2", "dark", "horn", "white"] as const;
export type AnimalSlot = (typeof ANIMAL_SLOTS)[number];

export interface AnimalModel {
  kind: WildlifeKind;
  parts: { slot: AnimalSlot; geometry: THREE.BufferGeometry }[];
  joints: V3[];
  parent: number[];
  /** leg length (hip to ground) and torso length, for gait */
  legLen: number;
  bodyLen: number;
  tris: number;
}

export const QB = { root: 0, hips: 1, chest: 2, neck: 3, head: 4, tail1: 5, tail2: 6, flU: 7, flL: 8, frU: 9, frL: 10, hlU: 11, hlL: 12, hrU: 13, hrL: 14 } as const;
export const Q_PARENT = [-1, 0, 1, 2, 3, 1, 5, 2, 7, 2, 9, 1, 11, 1, 13];

interface QuadSpec {
  len: number;
  H: number;
  bodyW: number;
  bodyH: number;
  hipW: number;
  hipH: number;
  neckLen: number;
  /** neck elevation (radians above horizontal) */
  neckUp: number;
  neckW: number;
  /** vertical offset of the neck's midpoint from the straight line (negative dips: the camel's S) */
  neckCurve?: number;
  headLen: number;
  headW: number;
  headH: number;
  /** head pitch down (radians) */
  headDown: number;
  snout: number;
  ear: "cat" | "dog" | "goat" | "horse" | "camel";
  earLen: number;
  tailLen: number;
  tailW: number;
  tailUp: number;
  legW: number;
  hoof: boolean;
  hump?: number;
  horns?: number;
  mane?: boolean;
  beard?: boolean;
}

const SPECS: Record<"cat" | "dog" | "goat" | "camel" | "horse", QuadSpec> = {
  cat: { len: 0.26, H: 0.21, bodyW: 0.058, bodyH: 0.07, hipW: 0.06, hipH: 0.072, neckLen: 0.08, neckUp: 0.75, neckW: 0.035, headLen: 0.1, headW: 0.047, headH: 0.045, headDown: 0.25, snout: 0.35, ear: "cat", earLen: 0.05, tailLen: 0.3, tailW: 0.012, tailUp: 0.9, legW: 0.018, hoof: false },
  dog: { len: 0.42, H: 0.42, bodyW: 0.085, bodyH: 0.12, hipW: 0.08, hipH: 0.095, neckLen: 0.18, neckUp: 0.8, neckW: 0.05, headLen: 0.22, headW: 0.06, headH: 0.06, headDown: 0.3, snout: 0.75, ear: "dog", earLen: 0.1, tailLen: 0.3, tailW: 0.016, tailUp: 1.3, legW: 0.026, hoof: false },
  goat: { len: 0.55, H: 0.5, bodyW: 0.15, bodyH: 0.17, hipW: 0.14, hipH: 0.15, neckLen: 0.2, neckUp: 0.95, neckW: 0.062, headLen: 0.22, headW: 0.058, headH: 0.07, headDown: 0.95, snout: 0.6, ear: "goat", earLen: 0.1, tailLen: 0.1, tailW: 0.03, tailUp: 1.2, legW: 0.035, hoof: true, horns: 0.3, beard: true },
  camel: { len: 1.3, H: 1.3, bodyW: 0.3, bodyH: 0.36, hipW: 0.27, hipH: 0.32, neckLen: 1.0, neckUp: 0.6, neckW: 0.11, neckCurve: -0.2, headLen: 0.55, headW: 0.14, headH: 0.16, headDown: 0.3, snout: 0.7, ear: "camel", earLen: 0.07, tailLen: 0.5, tailW: 0.04, tailUp: -0.2, legW: 0.075, hoof: false, hump: 0.45 },
  horse: { len: 0.95, H: 1.0, bodyW: 0.26, bodyH: 0.32, hipW: 0.27, hipH: 0.3, neckLen: 0.72, neckUp: 0.95, neckW: 0.16, headLen: 0.58, headW: 0.12, headH: 0.13, headDown: 1.0, snout: 0.8, ear: "horse", earLen: 0.13, tailLen: 0.7, tailW: 0.07, tailUp: -0.5, legW: 0.07, hoof: true, mane: true },
};

const cache = new Map<string, AnimalModel>();

export function animalModel(kind: WildlifeKind): AnimalModel | null {
  const hit = cache.get(kind);
  if (hit) return hit;
  let m: AnimalModel | null = null;
  if (kind === "cat" || kind === "dog" || kind === "goat" || kind === "camel" || kind === "horse") m = quadruped(kind, SPECS[kind]);
  else if (kind === "ibis") m = ibis();
  if (m) cache.set(kind, m);
  return m;
}

function quadruped(kind: WildlifeKind, s: QuadSpec): AnimalModel {
  const sb = new SkinBuilder<AnimalSlot>(ANIMAL_SLOTS);
  const H = s.H;
  const zH = -s.len / 2;
  const zC = s.len / 2;
  const neckBase: V3 = [0, H + s.bodyH * 0.55, zC + s.bodyH * 0.25];
  const headJ: V3 = [0, neckBase[1] + Math.sin(s.neckUp) * s.neckLen, neckBase[2] + Math.cos(s.neckUp) * s.neckLen];
  const tail1: V3 = [0, H + s.hipH * 0.45, zH - s.hipH * 0.75];
  const tail2: V3 = [0, tail1[1] + Math.sin(s.tailUp) * s.tailLen * 0.5, tail1[2] - Math.cos(s.tailUp) * s.tailLen * 0.5];
  const fx = s.bodyW * 0.62;
  const hx = s.hipW * 0.64;
  const fU: V3 = [fx, H, zC - s.bodyH * 0.1];
  const fL: V3 = [fx, H * 0.47, zC - s.bodyH * 0.12];
  const hU: V3 = [hx, H, zH + s.hipH * 0.15];
  const hL: V3 = [hx, H * 0.42, zH + s.hipH * 0.15 - H * 0.1];
  const joints: V3[] = [
    [0, 0, 0],
    [0, H, zH],
    [0, H, zC],
    neckBase,
    headJ,
    tail1,
    tail2,
    fU,
    fL,
    [-fx, fU[1], fU[2]],
    [-fx, fL[1], fL[2]],
    hU,
    hL,
    [-hx, hU[1], hU[2]],
    [-hx, hL[1], hL[2]],
  ];
  // torso: rump → haunch → belly → chest → brisket
  const torsoW: Weigh = (x, y, z) => {
    const t = (z - zH) / (zC - zH);
    const base: [number, number, number] = [QB.hips, QB.chest, sm((t - 0.25) / 0.5)];
    if (y < H + s.bodyH * 0.1 && Math.abs(x) > s.bodyW * 0.25) {
      const front = t > 0.5;
      const leg = front ? (x > 0 ? QB.flU : QB.frU) : x > 0 ? QB.hlU : QB.hrU;
      const k = sm((H + s.bodyH * 0.1 - y) / (s.bodyH * 0.6)) * sm(front ? (t - 0.7) / 0.2 : (0.3 - t) / 0.2) * 0.8;
      if (k > 0.05) return [front ? QB.chest : QB.hips, leg, k];
    }
    return base;
  };
  const torso: LoftSection[] = [
    { c: [0, H + s.hipH * 0.3, zH - s.hipH * 0.95], w: s.hipW * 0.35, h: s.hipH * 0.45, n: 2.2 },
    { c: [0, H + s.hipH * 0.2, zH - s.hipH * 0.55], w: s.hipW * 0.85, h: s.hipH * 0.9, n: 2.4 },
    { c: [0, H + s.hipH * 0.12, zH], w: s.hipW, h: s.hipH, n: 2.5 },
    { c: [0, H + s.bodyH * 0.02, 0], w: s.bodyW * 0.92, h: s.bodyH * 0.95, n: 2.4 },
    { c: [0, H + s.bodyH * 0.08, zC], w: s.bodyW, h: s.bodyH, n: 2.5 },
    { c: [0, H + s.bodyH * 0.25, zC + s.bodyH * 0.45], w: s.bodyW * 0.7, h: s.bodyH * 0.72, n: 2.3 },
    { c: [0, H + s.bodyH * 0.35, zC + s.bodyH * 0.7], w: s.bodyW * 0.3, h: s.bodyH * 0.35, n: 2 },
  ];
  sb.add("coat", loftGeometry(torso, { radial: 18, subdivide: 2, capStart: true, capEnd: true }), torsoW);
  if (s.hump) sb.add("coat", sphere(s.bodyW * 0.7, s.hump, s.len * 0.32, 14, 10), torsoW, T(0, H + s.bodyH * 0.75, -s.len * 0.05));
  // neck and head
  const neckW = limb(QB.chest, QB.neck, QB.head, neckBase, headJ, s.neckW * 1.5, s.neckW);
  const neckSecs: LoftSection[] = [0, 0.2, 0.4, 0.6, 0.8, 1.02].map((t) => {
    const l = lerp3(neckBase, headJ, t);
    const c: V3 = [l[0], l[1] + (s.neckCurve ?? 0) * Math.sin(Math.PI * Math.min(1, t)), l[2]];
    const w = s.neckW * (1.35 - 0.45 * t);
    return { c, w, h: w * (kind === "horse" || kind === "camel" ? 1.35 : 1.1), n: 2.2 };
  });
  sb.add("coat", loftGeometry(neckSecs, { radial: 14, subdivide: 2, up: [0, 1, 0] }), neckW);
  if (s.mane) sb.add("dark", loftGeometry(neckSecs.map((q) => ({ c: [q.c[0], q.c[1] + q.h * 0.85, q.c[2] - q.h * 0.2] as V3, w: 0.025, h: q.h * 0.35, n: 2 })), { radial: 8, subdivide: 2, capStart: true, capEnd: true }), neckW);
  // the head points forward and pitches down by headDown
  const dir: V3 = [0, -Math.sin(s.headDown), Math.cos(s.headDown)];
  const hp = (t: number, up = 0): V3 => [0, headJ[1] + dir[1] * s.headLen * t + up, headJ[2] + dir[2] * s.headLen * t];
  const headSecs: LoftSection[] = [
    { c: hp(-0.18), w: s.headW * 0.6, h: s.headH * 0.55, n: 2.2 },
    { c: hp(0.05), w: s.headW, h: s.headH, n: 2.3 },
    { c: hp(0.32), w: s.headW * 0.95, h: s.headH * 0.9, n: 2.3 },
    { c: hp(0.6, -s.headH * 0.12 * s.snout), w: s.headW * (1 - 0.45 * s.snout), h: s.headH * (1 - 0.4 * s.snout), n: 2.4 },
    { c: hp(0.92, -s.headH * 0.2 * s.snout), w: s.headW * (1 - 0.55 * s.snout), h: s.headH * (1 - 0.5 * s.snout), n: 2.4 },
    { c: hp(1.0, -s.headH * 0.22 * s.snout), w: s.headW * (0.9 - 0.6 * s.snout), h: s.headH * (0.9 - 0.55 * s.snout), n: 2.2 },
  ];
  sb.add("coat", loftGeometry(headSecs, { radial: 14, subdivide: 2, capStart: true, capEnd: true }), QB.head);
  const nose = hp(1.0, -s.headH * 0.22 * s.snout);
  sb.add("dark", sphere(s.headW * 0.22, s.headW * 0.16, s.headW * 0.1), QB.head, T(nose[0], nose[1] + s.headH * 0.05, nose[2] + s.headW * 0.08));
  for (const sx of [-1, 1]) {
    const e = hp(0.22, s.headH * 0.35);
    sb.add("dark", sphere(s.headW * 0.16, s.headW * 0.13, s.headW * 0.1, 8, 6), QB.head, T(sx * s.headW * 0.78, e[1], e[2], 0, sx * 0.9));
    // ears
    const ea = hp(-0.02, s.headH * 0.8);
    const earGeo = new THREE.ConeGeometry(s.earLen * (s.ear === "cat" ? 0.42 : s.ear === "dog" ? 0.34 : 0.3), s.earLen, 6).scale(1, 1, s.ear === "goat" || s.ear === "horse" ? 0.5 : 0.35);
    const tilt = s.ear === "goat" ? 1.35 : s.ear === "camel" ? 0.9 : 0.35;
    sb.add("coat", earGeo, QB.head, T(sx * s.headW * 0.55, ea[1] + s.earLen * 0.3, ea[2], 0, 0, -sx * tilt).multiply(new THREE.Matrix4().makeTranslation(0, s.earLen * 0.45, 0)));
    if (s.horns) {
      const hb = hp(0.08, s.headH * 0.85);
      // swept back over the neck in a shallow arc, tapering
      const horn = s.horns;
      const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => new THREE.Vector3(sx * (s.headW * 0.28 + t * 0.06), hb[1] + Math.sin(t * Math.PI * 0.55) * horn * 0.32, hb[2] - t * horn * 0.95));
      for (let k = 0; k < 4; k++) {
        const r0 = s.headW * 0.2 * (1 - k * 0.22);
        sb.add("horn", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(k, k + 2)), 2, r0, 6), QB.head);
      }
    }
  }
  if (s.beard) {
    const c = hp(0.8, -s.headH * 0.6);
    sb.add("coat2", new THREE.ConeGeometry(s.headW * 0.25, s.headH * 1.1, 6).rotateX(Math.PI), QB.head, T(c[0], c[1] - s.headH * 0.3, c[2]));
  }
  // tail
  const tailEnd: V3 = [0, tail2[1] + Math.sin(s.tailUp + 0.3) * s.tailLen * 0.5, tail2[2] - Math.cos(s.tailUp + 0.3) * s.tailLen * 0.5];
  const tailW: Weigh = (x, y, z) => {
    const d = Math.hypot(y - tail1[1], z - tail1[2]);
    return d < s.tailLen * 0.45 ? [QB.tail1, QB.tail2, sm((d - s.tailLen * 0.3) / (s.tailLen * 0.3))] : [QB.tail2, QB.tail2, 0];
  };
  if (kind === "horse") {
    sb.add("dark", loftGeometry([
      { c: tail1, w: s.tailW * 0.6, h: s.tailW * 0.6, n: 2 },
      { c: [0, tail1[1] - 0.12, tail1[2] - 0.12], w: s.tailW, h: s.tailW * 0.8, n: 2 },
      { c: [0, tail1[1] - 0.45, tail1[2] - 0.16], w: s.tailW * 1.1, h: s.tailW * 0.7, n: 2 },
      { c: [0, tail1[1] - 0.72, tail1[2] - 0.12], w: s.tailW * 0.4, h: s.tailW * 0.4, n: 2 },
    ], { radial: 10, subdivide: 2, capEnd: true }), tailW);
  } else {
    sb.add("coat", new THREE.TubeGeometry(new THREE.CatmullRomCurve3([tail1, tail2, tailEnd].map((p) => new THREE.Vector3(...p))), 12, s.tailW, 6), tailW);
    if (kind === "camel") sb.add("dark", sphere(s.tailW * 1.4, s.tailW * 2.5, s.tailW * 1.4), QB.tail2, T(tailEnd[0], tailEnd[1] - s.tailW, tailEnd[2]));
  }
  // legs
  const legs: [number, number, V3, V3, boolean][] = [
    [QB.flU, QB.flL, fU, fL, true],
    [QB.frU, QB.frL, joints[QB.frU], joints[QB.frL], true],
    [QB.hlU, QB.hlL, hU, hL, false],
    [QB.hrU, QB.hrL, joints[QB.hrU], joints[QB.hrL], false],
  ];
  for (const [u, l, a, b, front] of legs) {
    const par = front ? QB.chest : QB.hips;
    const foot: V3 = [b[0], 0.02, b[2] + (front ? 0 : H * 0.12)];
    const thick = (front ? 1 : 1.25) * (kind === "camel" || kind === "horse" ? 1.3 : 1);
    sb.add("coat", loftGeometry([
      { c: [a[0], a[1] + s.legW * 1.5, a[2]], w: s.legW * 1.6 * thick, h: s.legW * 2.2 * thick, n: 2.2 },
      { c: lerp3(a, b, 0.4), w: s.legW * 1.25 * thick, h: s.legW * 1.6 * thick, n: 2.2 },
      { c: b, w: s.legW * 0.95, h: s.legW, n: 2.2 },
    ], { radial: 10, subdivide: 2, up: [0, 0, 1] }), limb(par, u, l, a, b, s.legW * 2, s.legW * 1.2));
    sb.add("coat", loftGeometry([
      { c: b, w: s.legW * 0.9, h: s.legW, n: 2.2 },
      { c: lerp3(b, foot, 0.6), w: s.legW * 0.7, h: s.legW * 0.72, n: 2.2 },
      { c: foot, w: s.legW * 0.8, h: s.legW * 0.8, n: 2.2 },
    ], { radial: 8, subdivide: 1, up: [0, 0, 1] }), limb(u, l, -1, b, foot, s.legW * 1.2, 0));
    if (s.hoof) sb.add("dark", new THREE.CylinderGeometry(s.legW * 0.85, s.legW * 1.05, s.legW * 1.2, 8), l, T(foot[0], s.legW * 0.6, foot[2]));
    else sb.add(kind === "camel" ? "coat2" : "coat", sphere(s.legW * (kind === "camel" ? 1.8 : 1.25), s.legW * 0.7, s.legW * (kind === "camel" ? 2.0 : 1.5), 8, 6), l, T(foot[0], s.legW * 0.55, foot[2] + s.legW * 0.4));
  }
  // a pale belly / muzzle on some species
  if (kind === "goat" || kind === "dog" || kind === "cat") sb.add("coat2", sphere(s.bodyW * 0.7, s.bodyH * 0.35, s.len * 0.42, 12, 8), torsoW, T(0, H - s.bodyH * 0.55, 0));
  const parts = sb.build();
  let tris = 0;
  for (const p of parts) tris += p.geometry.attributes.position.count / 3;
  return { kind, parts, joints, parent: Q_PARENT, legLen: H, bodyLen: s.len, tris };
}

// ------------------------------------------------------------------------------------------------ ibis

export const IB = { root: 0, body: 1, neck1: 2, neck2: 3, head: 4, legLU: 5, legLL: 6, legRU: 7, legRL: 8 } as const;
export const IBIS_PARENT = [-1, 0, 1, 2, 3, 1, 5, 1, 7];

function ibis(): AnimalModel {
  const sb = new SkinBuilder<AnimalSlot>(ANIMAL_SLOTS);
  const joints: V3[] = [
    [0, 0, 0],
    [0, 0.5, 0],
    [0, 0.56, 0.12],
    [0, 0.72, 0.16],
    [0, 0.84, 0.19],
    [0.045, 0.47, 0.0],
    [0.045, 0.24, -0.03],
    [-0.045, 0.47, 0.0],
    [-0.045, 0.24, -0.03],
  ];
  // white body with black wingtip plumes over the tail
  sb.add("white", loftGeometry([
    { c: [0, 0.54, -0.22], w: 0.02, h: 0.02, n: 2 },
    { c: [0, 0.53, -0.15], w: 0.075, h: 0.06, n: 2.2 },
    { c: [0, 0.52, 0.0], w: 0.095, h: 0.085, n: 2.3 },
    { c: [0, 0.54, 0.1], w: 0.07, h: 0.07, n: 2.2 },
    { c: [0, 0.57, 0.15], w: 0.035, h: 0.04, n: 2 },
  ], { radial: 14, subdivide: 2, capStart: true, capEnd: true }), IB.body);
  sb.add("dark", loftGeometry([
    { c: [0, 0.56, -0.08], w: 0.07, h: 0.03, n: 2 },
    { c: [0, 0.53, -0.2], w: 0.06, h: 0.035, n: 2 },
    { c: [0, 0.5, -0.27], w: 0.025, h: 0.02, n: 2 },
  ], { radial: 10, subdivide: 2, capEnd: true }), IB.body);
  // bare black neck and head, the long down-curved bill
  const neckW: Weigh = (_x, y) => (y < 0.64 ? [IB.body, IB.neck1, sm((y - 0.55) / 0.08)] : y < 0.78 ? [IB.neck1, IB.neck2, sm((y - 0.66) / 0.1)] : [IB.neck2, IB.head, sm((y - 0.78) / 0.06)]);
  sb.add("dark", new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.55, 0.11), new THREE.Vector3(0, 0.66, 0.15), new THREE.Vector3(0, 0.76, 0.16), new THREE.Vector3(0, 0.84, 0.19)]), 12, 0.02, 8), neckW);
  sb.add("dark", sphere(0.027, 0.028, 0.035, 10, 8), IB.head, T(0, 0.85, 0.2));
  sb.add("dark", new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.845, 0.23), new THREE.Vector3(0, 0.83, 0.31), new THREE.Vector3(0, 0.79, 0.37), new THREE.Vector3(0, 0.74, 0.39)]), 10, 0.008, 5), IB.head);
  // legs: thigh hidden in the body, the bare shank, backward ankle, the tarsus and toes
  for (const sx of [-1, 1]) {
    const u = sx > 0 ? IB.legLU : IB.legRU;
    const l = sx > 0 ? IB.legLL : IB.legRL;
    const a = joints[u];
    const b = joints[l];
    const foot: V3 = [a[0], 0.015, 0.02];
    sb.add("dark", new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(...a), new THREE.Vector3(...b)]), 2, 0.009, 5), limb(IB.body, u, l, a, b, 0.02, 0.015));
    sb.add("dark", new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(...b), new THREE.Vector3(...foot)]), 2, 0.008, 5), l);
    for (const ta of [-0.5, 0, 0.5]) sb.add("dark", new THREE.CylinderGeometry(0.004, 0.004, 0.07, 4).rotateX(Math.PI / 2), l, T(foot[0] + Math.sin(ta) * 0.03, 0.01, foot[2] + Math.cos(ta) * 0.03, ta));
  }
  const parts = sb.build();
  let tris = 0;
  for (const p of parts) tris += p.geometry.attributes.position.count / 3;
  return { kind: "ibis", parts, joints, parent: IBIS_PARENT, legLen: 0.47, bodyLen: 0.3, tris };
}

// ------------------------------------------------------------------------------------------------ instanced small things

const small = new Map<string, THREE.BufferGeometry>();

/** A flock bird body (a kite-like silhouette), 0.5 m long. */
export function birdBodyGeometry(): THREE.BufferGeometry {
  const hit = small.get("bird");
  if (hit) return hit;
  const g = loftGeometry([
    { c: [0, 0, -0.26], w: 0.005, h: 0.005, n: 2 },
    { c: [0, 0, -0.18], w: 0.06, h: 0.012, n: 2 },
    { c: [0, 0, -0.05], w: 0.05, h: 0.04, n: 2 },
    { c: [0, 0.005, 0.1], w: 0.04, h: 0.04, n: 2 },
    { c: [0, 0.01, 0.18], w: 0.022, h: 0.022, n: 2 },
    { c: [0, 0.0, 0.24], w: 0.004, h: 0.004, n: 2 },
  ], { radial: 8, capStart: true, capEnd: true });
  small.set("bird", g);
  return g;
}

/** One wing (left: +x), hinged at x = 0; double-sided. */
export function birdWingGeometry(): THREE.BufferGeometry {
  const hit = small.get("wing");
  if (hit) return hit;
  const shape = new THREE.Shape([new THREE.Vector2(0, 0.08), new THREE.Vector2(0.3, 0.05), new THREE.Vector2(0.55, -0.04), new THREE.Vector2(0.5, -0.08), new THREE.Vector2(0.28, -0.07), new THREE.Vector2(0, -0.06)]);
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  const back = g.clone();
  const idx = back.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, a);
  }
  const merged = new THREE.BufferGeometry();
  const pos = [...(g.attributes.position.array as Float32Array), ...(back.attributes.position.array as Float32Array)];
  const n = g.attributes.position.count;
  const ind = [...Array.from(g.index!.array), ...Array.from(idx.array).map((v) => v + n)];
  merged.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  merged.setIndex(ind);
  merged.computeVertexNormals();
  g.dispose();
  back.dispose();
  small.set("wing", merged);
  return merged;
}

/** A butterfly wing pair half (left: +x), fore and hind wing lobes, double-sided, ~7 cm span per wing. */
export function butterflyWingGeometry(): THREE.BufferGeometry {
  const hit = small.get("bwing");
  if (hit) return hit;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.005);
  shape.bezierCurveTo(0.02, 0.06, 0.07, 0.07, 0.065, 0.02);
  shape.bezierCurveTo(0.07, -0.01, 0.05, -0.05, 0.02, -0.045);
  shape.bezierCurveTo(0.01, -0.03, 0.004, -0.01, 0, -0.005);
  const g = new THREE.ShapeGeometry(shape, 6);
  g.rotateX(-Math.PI / 2);
  const idx = g.index!;
  const n = g.attributes.position.count;
  const pos = Array.from(g.attributes.position.array as Float32Array);
  const ind = Array.from(idx.array);
  const back: number[] = [];
  for (let i = 0; i < ind.length; i += 3) back.push(ind[i] + n, ind[i + 2] + n, ind[i + 1] + n);
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute([...pos, ...pos], 3));
  out.setIndex([...ind, ...back]);
  out.computeVertexNormals();
  g.dispose();
  small.set("bwing", out);
  return out;
}

/** A fish, 0.4 m long, nose toward +z, with a forked tail and a dorsal fin. */
export function fishGeometry(): THREE.BufferGeometry {
  const hit = small.get("fish");
  if (hit) return hit;
  const body = loftGeometry([
    { c: [0, 0, -0.2], w: 0.008, h: 0.03, n: 2 },
    { c: [0, 0, -0.12], w: 0.025, h: 0.05, n: 2 },
    { c: [0, 0.005, 0.02], w: 0.04, h: 0.075, n: 2 },
    { c: [0, 0.0, 0.13], w: 0.03, h: 0.05, n: 2 },
    { c: [0, -0.005, 0.2], w: 0.008, h: 0.012, n: 2 },
  ], { radial: 10, subdivide: 2, capStart: true, capEnd: true });
  const tail = new THREE.BufferGeometry();
  tail.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -0.19, 0, 0.07, -0.29, 0, 0, -0.24, 0, 0, -0.19, 0, 0, -0.24, 0, -0.07, -0.29, 0, 0.07, 0.0, 0, 0.12, -0.08, 0, 0.06, -0.12], 3));
  const tb = tail.clone();
  const p = tb.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i += 3) {
    const x = p.getX(i + 1);
    const y = p.getY(i + 1);
    const z = p.getZ(i + 1);
    p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
    p.setXYZ(i + 2, x, y, z);
  }
  const parts = [body.toNonIndexed(), tail, tb];
  for (const q of parts) {
    for (const name of Object.keys(q.attributes)) if (name !== "position") q.deleteAttribute(name);
    q.computeVertexNormals();
  }
  const pos: number[] = [];
  const nor: number[] = [];
  for (const q of parts) {
    pos.push(...(q.attributes.position.array as Float32Array));
    nor.push(...(q.attributes.normal.array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  small.set("fish", out);
  return out;
}
