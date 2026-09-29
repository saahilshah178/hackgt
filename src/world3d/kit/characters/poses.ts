import * as THREE from "three";
import type { HeldProp } from "../../../contracts/world3d";
import { hashString } from "../../core/prng";
import { B, BONE_COUNT, JOINT, LEG_LENGTH, PARENT } from "./skeleton";

/*
 * Procedural animation for the humanoid (pure: no React, no three scene). A clip is a function of time (and, for
 * gaits, a phase the caller advances at the cadence `gaitCadence(speed)` gives) that writes Euler rotations for every
 * bone plus a root offset into a Pose. Gaits are one continuous family: walk blends into run with speed, the stride
 * lengthens with speed and leg length, and the thigh sweep is sized so the stance foot moves back exactly as fast as the
 * body moves forward (no foot sliding). Clips layer small, deterministic life on top (breathing, weight shifts, glances
 * seeded per character); held props adjust the grip arm (a staff stays upright, a book is carried at the waist).
 *
 * Conventions: see ./skeleton.ts (limbs: -x swings forward, knees bend with +x; spine and head: +x leans forward).
 */

export type HumanoidAnim = "idle" | "walk" | "run" | "talk" | "wave" | "work" | "sit" | "study" | "jump" | "guard" | "celebrate";

export interface Pose {
  /** Euler XYZ per bone (BONE_COUNT × 3) */
  r: Float32Array;
  /** root offset in metres (at height 1) */
  x: number;
  y: number;
  z: number;
}

export interface PoseInput {
  anim: HumanoidAnim;
  /** seconds since this clip started */
  t: number;
  /** global clock, seconds */
  time: number;
  /** ground speed m/s (already scaled to a 1.75 m body) */
  speed: number;
  /** gait phase, cycles (the fractional part is used) */
  phase: number;
  seed: number;
  talking: boolean;
  held: HeldProp;
  /** sitting on a block (true) or cross-legged on the ground (false) */
  sitOnBlock: boolean;
  calm: boolean;
}

export function newPose(): Pose {
  return { r: new Float32Array(BONE_COUNT * 3), x: 0, y: 0, z: 0 };
}

export function copyPose(src: Pose, out: Pose) {
  out.r.set(src.r);
  out.x = src.x;
  out.y = src.y;
  out.z = src.z;
}

/** out = a·(1-w) + b·w (component-wise on Euler angles: fine for the small, same-branch angles clips produce). */
export function blendPose(a: Pose, b: Pose, w: number, out: Pose) {
  for (let i = 0; i < a.r.length; i++) out.r[i] = a.r[i] + (b.r[i] - a.r[i]) * w;
  out.x = a.x + (b.x - a.x) * w;
  out.y = a.y + (b.y - a.y) * w;
  out.z = a.z + (b.z - a.z) * w;
}

const set = (p: Pose, bone: number, x: number, y = 0, z = 0) => {
  p.r[bone * 3] = x;
  p.r[bone * 3 + 1] = y;
  p.r[bone * 3 + 2] = z;
};
const add = (p: Pose, bone: number, x: number, y = 0, z = 0) => {
  p.r[bone * 3] += x;
  p.r[bone * 3 + 1] += y;
  p.r[bone * 3 + 2] += z;
};
const sm = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
const TAU = Math.PI * 2;

// ------------------------------------------------------------------------------------------------ gait

/** Stride (metres per full cycle, two steps) for a ground speed. */
export function strideLength(speed: number): number {
  return LEG_LENGTH * (1.0 + 0.55 * Math.max(0, speed));
}

/** Gait cycles per second for a ground speed (so the feet plant without sliding). */
export function gaitCadence(speed: number): number {
  const s = Math.max(0.05, speed);
  return s / strideLength(s);
}

/** How much of the run gait to use at this speed (walk below ~2.8 m/s, run above ~4.2). */
export const runBlend = (speed: number) => sm((speed - 2.8) / 1.4);

function gait(p: Pose, i: PoseInput) {
  const speed = Math.max(0, i.speed);
  const k = runBlend(speed);
  const stride = strideLength(speed);
  const L = LEG_LENGTH;
  // thigh sweep: stance covers half the cycle when walking (2LA = stride/2), ~35 % when running (flight phase)
  const Awalk = Math.min(0.55, stride / (4 * L));
  const Arun = Math.min(0.78, (stride * 0.36) / (2 * L));
  const A = Awalk + (Arun - Awalk) * k;
  const Kswing = 0.95 + 0.85 * k;
  const Kstance = 0.12 + 0.25 * k;
  const ph = i.phase - Math.floor(i.phase);
  const leg = (thigh: number, shin: number, foot: number, pl: number) => {
    const q = pl - Math.floor(pl);
    const th = -A * Math.cos(TAU * q);
    let kn: number;
    if (q < 0.5) kn = Kstance * Math.sin(TAU * q);
    else kn = Kswing * Math.sin(Math.PI * Math.pow((q - 0.5) / 0.5, 0.78));
    // keep the sole level, push off at the end of stance, lift the toes at heel strike
    const toeOff = 0.45 * Math.exp(-Math.pow((q - 0.45) / 0.07, 2)) * (1 - 0.3 * k);
    const heel = -0.15 * Math.exp(-Math.pow((q < 0.5 ? q : q - 1) / 0.06, 2));
    set(p, thigh, th, 0, 0);
    set(p, shin, kn, 0, 0);
    set(p, foot, -(th + kn) * 0.92 + toeOff + heel, 0, 0);
    return th;
  };
  const thL = leg(B.thighL, B.shinL, B.footL, ph);
  const thR = leg(B.thighR, B.shinR, B.footR, ph + 0.5);
  // pelvis: height follows the stance leg (lowest at heel strike), yaw with the forward leg, a small roll
  const stanceTh = ph < 0.5 ? thL : thR;
  const walkBob = -L * (1 - Math.cos(stanceTh)) * 0.85;
  const runBob = 0.045 * Math.abs(Math.sin(TAU * ph)) - 0.07;
  p.y = walkBob + (runBob - walkBob) * k;
  const c = Math.cos(TAU * ph);
  set(p, B.hips, 0, -0.1 * c * (0.6 + 0.4 * k), 0.035 * Math.sin(TAU * ph * 2) * (1 - k));
  const lean = 0.04 + 0.2 * k + 0.02 * speed * k;
  set(p, B.spine, lean * 0.4, 0.04 * c, 0);
  set(p, B.chest, lean * 0.6, 0.06 * c, 0);
  set(p, B.neck, -lean * 0.4, -0.03 * c, 0);
  set(p, B.head, -lean * 0.35 + 0.03 * Math.sin(TAU * ph * 2) * k, -0.04 * c, 0);
  // arms swing against the legs; elbows bend more when running
  const Aarm = 0.3 + 0.35 * k + 0.05 * speed * (1 - k);
  const elbow = -0.28 - 1.2 * k;
  set(p, B.upperArmL, Aarm * c, 0, 0.09 + 0.05 * k);
  set(p, B.upperArmR, -Aarm * c, 0, -0.09 - 0.05 * k);
  set(p, B.forearmL, elbow - 0.25 * Math.max(0, -c) * (1 - k) - 0.3 * k * Math.max(0, -c), 0, 0);
  set(p, B.forearmR, elbow - 0.25 * Math.max(0, c) * (1 - k) - 0.3 * k * Math.max(0, c), 0, 0);
  set(p, B.handL, -0.1, 0, 0);
  set(p, B.handR, -0.1, 0, 0);
}

// ------------------------------------------------------------------------------------------------ life: breathing, weight shift, glances

function hash01(a: number, b: number): number {
  return (hashString(`${a}:${b}`) % 10000) / 10000;
}

/** A smooth, seeded glance: holds a target for a few seconds, then eases to the next (often back to centre). */
function glance(time: number, seed: number): [number, number] {
  const period = 4.2 + (seed % 5) * 0.6;
  const u = time / period + (seed % 97) * 0.13;
  const i = Math.floor(u);
  const f = u - i;
  const target = (n: number): [number, number] => {
    const r = hash01(seed, n);
    if (r < 0.45) return [0, 0];
    return [(hash01(seed + 7, n) - 0.5) * 1.1, (hash01(seed + 13, n) - 0.5) * 0.25];
  };
  const a = target(i);
  const b = target(i + 1);
  const w = sm((f - 0.8) / 0.2);
  return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
}

function stand(p: Pose, i: PoseInput, amount = 1) {
  const t = i.time;
  const breath = Math.sin((TAU * t) / 4.2 + (i.seed % 10));
  const shift = Math.sin((TAU * t) / 11 + (i.seed % 23)) * (i.calm ? 0.5 : 1);
  add(p, B.spine, 0.012 + 0.006 * breath, 0, -0.018 * shift);
  add(p, B.chest, 0.01 * breath, 0, -0.012 * shift);
  add(p, B.hips, 0, 0, 0.035 * shift);
  p.x += 0.014 * shift;
  // the unweighted leg relaxes
  const rel = (thigh: number, shin: number, foot: number, w: number) => {
    add(p, thigh, -0.06 * w, 0, 0);
    add(p, shin, 0.13 * w, 0, 0);
    add(p, foot, -0.07 * w, 0, 0);
  };
  rel(B.thighR, B.shinR, B.footR, Math.max(0, shift));
  rel(B.thighL, B.shinL, B.footL, Math.max(0, -shift));
  add(p, B.thighL, 0, 0, -0.035 * shift + 0.02);
  add(p, B.thighR, 0, 0, -0.035 * shift - 0.02);
  add(p, B.footL, 0, 0, 0.035 * shift - 0.02);
  add(p, B.footR, 0, 0, 0.035 * shift + 0.02);
  // relaxed arms, slightly bent, slightly out
  add(p, B.upperArmL, 0.03, 0, 0.07 + 0.01 * breath);
  add(p, B.upperArmR, 0.03, 0, -0.07 - 0.01 * breath);
  add(p, B.forearmL, -0.16, 0.1, 0);
  add(p, B.forearmR, -0.16, -0.1, 0);
  add(p, B.handL, -0.08, 0, 0.05);
  add(p, B.handR, -0.08, 0, -0.05);
  add(p, B.clavL, 0, 0, 0.012 * breath);
  add(p, B.clavR, 0, 0, -0.012 * breath);
  if (amount > 0) {
    const [gy, gx] = glance(t, i.seed);
    add(p, B.head, gx * amount + 0.02 * Math.sin(t * 0.37), gy * 0.7 * amount, 0);
    add(p, B.neck, 0, gy * 0.3 * amount, 0);
  }
}

// ------------------------------------------------------------------------------------------------ clips

function talkGestures(p: Pose, i: PoseInput, amount: number) {
  const g = i.time + (i.seed % 13);
  const beat = 0.5 + 0.5 * Math.sin(g * 0.7);
  add(p, B.upperArmR, (-0.32 - 0.18 * Math.sin(g * 1.3)) * amount, 0, (-0.12 - 0.1 * Math.sin(g * 0.9)) * amount);
  add(p, B.forearmR, (-0.95 - 0.32 * Math.sin(g * 2.3) * beat) * amount, (0.35 * Math.sin(g * 1.7)) * amount, 0);
  add(p, B.handR, -0.25 * Math.sin(g * 3.1) * amount, 0, 0.2 * amount);
  const l = 0.5 + 0.5 * Math.sin(g * 0.45 + 1.2);
  add(p, B.upperArmL, (-0.2 - 0.15 * Math.sin(g * 1.1 + 2)) * amount * l, 0, 0.1 * amount * l);
  add(p, B.forearmL, (-0.7 - 0.25 * Math.sin(g * 1.9 + 1)) * amount * l, -0.3 * amount * l, 0);
  add(p, B.head, 0.07 * Math.sin(g * 3.3) * beat * amount, 0.08 * Math.sin(g * 0.8) * amount, 0.04 * Math.sin(g * 0.6) * amount);
  add(p, B.chest, 0.02 * Math.sin(g * 1.4) * amount, 0.05 * Math.sin(g * 0.9) * amount, 0);
}

function clip(p: Pose, i: PoseInput) {
  p.r.fill(0);
  p.x = 0;
  p.y = 0;
  p.z = 0;
  const t = i.time;
  switch (i.anim) {
    case "walk":
    case "run":
      gait(p, i);
      break;
    case "idle":
      stand(p, i);
      if (i.talking) talkGestures(p, i, 1);
      break;
    case "talk":
      stand(p, i, 0.3);
      talkGestures(p, i, 1);
      break;
    case "wave": {
      stand(p, i, 0);
      const up = sm(i.t / 0.35);
      set(p, B.upperArmR, -0.25 * up, 0, -2.5 * up);
      set(p, B.forearmR, -0.45 * up, 0, 0.45 * Math.sin(t * 7.5) * up);
      set(p, B.handR, 0, 0, 0.25 * Math.sin(t * 7.5 + 0.6) * up);
      add(p, B.clavR, 0, 0, -0.15 * up);
      add(p, B.head, -0.05, -0.08, 0.06);
      break;
    }
    case "work": {
      // hammering a chisel: crouched over the work, a slow lift and a quick strike
      const c = (t * 1.25 + (i.seed % 7) * 0.13) % 1;
      const lift = c < 0.68 ? sm(c / 0.68) : c < 0.78 ? 1 - (c - 0.68) / 0.1 : 0;
      const hit = c >= 0.76 && c < 0.84 ? 1 - Math.abs(c - 0.8) / 0.04 : 0;
      set(p, B.hips, 0.1, 0, 0);
      set(p, B.spine, 0.18, 0, 0);
      set(p, B.chest, 0.22 + 0.04 * lift, -0.1, 0);
      set(p, B.neck, 0.1, 0, 0);
      set(p, B.head, 0.25, 0.05, 0);
      for (const [th, sh, ft, z] of [
        [B.thighL, B.shinL, B.footL, 0.08],
        [B.thighR, B.shinR, B.footR, -0.08],
      ] as [number, number, number, number][]) {
        set(p, th, -0.42, 0, z);
        set(p, sh, 0.62, 0, 0);
        set(p, ft, -0.2, 0, -z);
      }
      p.y = -0.075;
      set(p, B.upperArmR, -0.45 - 1.25 * lift, 0, -0.18 - 0.1 * lift);
      set(p, B.forearmR, -0.55 - 0.9 * lift, 0, 0);
      set(p, B.handR, 0.2 - 0.5 * lift, 0, 0);
      set(p, B.upperArmL, -0.62, 0, 0.12);
      set(p, B.forearmL, -1.2 + 0.05 * hit, 0.35, 0);
      p.y -= 0.01 * hit;
      break;
    }
    case "sit": {
      if (i.sitOnBlock) {
        p.y = -0.4;
        set(p, B.thighL, -1.52, 0, 0.1);
        set(p, B.thighR, -1.52, 0, -0.1);
        set(p, B.shinL, 1.45, 0, -0.08);
        set(p, B.shinR, 1.45, 0, 0.08);
        set(p, B.footL, 0.02, 0, 0);
        set(p, B.footR, 0.02, 0, 0);
        set(p, B.spine, 0.06, 0, 0);
        set(p, B.chest, 0.05, 0, 0);
        set(p, B.upperArmL, -0.42, 0, 0.12);
        set(p, B.upperArmR, -0.42, 0, -0.12);
        set(p, B.forearmL, -0.8, 0.3, 0);
        set(p, B.forearmR, -0.8, -0.3, 0);
      } else {
        // cross-legged, like the seated scribe
        p.y = -0.81;
        set(p, B.thighL, -1.36, 0, 0.8);
        set(p, B.thighR, -1.36, 0, -0.8);
        set(p, B.shinL, 0, 0, -2.19);
        set(p, B.shinR, 0, 0, 2.19);
        set(p, B.footL, 0.4, 0, 0);
        set(p, B.footR, 0.4, 0, 0);
        set(p, B.spine, 0.04, 0, 0);
        set(p, B.chest, 0.08, 0, 0);
        set(p, B.upperArmL, -0.5, 0, -0.1);
        set(p, B.upperArmR, -0.5, 0, 0.1);
        set(p, B.forearmL, -1.05, 0.2, 0);
        set(p, B.forearmR, -1.05, -0.2, 0);
        set(p, B.head, 0.3, 0, 0);
      }
      const breath = Math.sin((TAU * t) / 4.5 + (i.seed % 10));
      add(p, B.chest, 0.012 * breath, 0, 0);
      const [gy, gx] = glance(t, i.seed);
      add(p, B.head, gx * 0.6, gy * 0.6, 0);
      if (i.talking) talkGestures(p, i, 0.7);
      break;
    }
    case "study": {
      stand(p, i, 0);
      const look = Math.sin(t * 0.23 + (i.seed % 11)) > 0.85 ? 1 : 0;
      set(p, B.upperArmL, -0.42, 0, -0.14);
      set(p, B.upperArmR, -0.42, 0, 0.14);
      set(p, B.forearmL, -1.3, -0.25, 0);
      set(p, B.forearmR, -1.3, 0.25, 0);
      set(p, B.handL, 0.2, 0, -0.3);
      set(p, B.handR, 0.2, 0, 0.3);
      add(p, B.neck, 0.15 * (1 - look), 0, 0);
      add(p, B.head, 0.32 * (1 - look) + 0.04 * Math.sin(t * 1.9), 0.06 * Math.sin(t * 0.5), 0);
      break;
    }
    case "jump": {
      const tuck = sm(i.t / 0.25);
      set(p, B.thighL, -0.85 * tuck, 0, 0.05);
      set(p, B.shinL, 1.15 * tuck, 0, 0);
      set(p, B.footL, 0.3 * tuck, 0, 0);
      set(p, B.thighR, -0.15 * tuck, 0, -0.05);
      set(p, B.shinR, 0.75 * tuck, 0, 0);
      set(p, B.footR, 0.35 * tuck, 0, 0);
      set(p, B.upperArmL, -0.7 * tuck, 0, 0.55 * tuck);
      set(p, B.upperArmR, 0.35 * tuck, 0, -0.45 * tuck);
      set(p, B.forearmL, -0.5, 0, 0);
      set(p, B.forearmR, -0.4, 0, 0);
      set(p, B.chest, 0.12 * tuck, 0, 0);
      set(p, B.head, -0.1 * tuck, 0, 0);
      break;
    }
    case "guard": {
      stand(p, i, 0);
      add(p, B.thighL, 0, 0, 0.06);
      add(p, B.thighR, 0, 0, -0.06);
      add(p, B.footL, 0, 0, -0.06);
      add(p, B.footR, 0, 0, 0.06);
      add(p, B.chest, -0.04, 0, 0);
      add(p, B.head, 0.02, 0.45 * Math.sin(t * 0.33 + (i.seed % 17)), 0);
      set(p, B.upperArmL, 0.12, 0, 0.42);
      set(p, B.forearmL, -1.15, -0.55, 0);
      break;
    }
    case "celebrate": {
      const hop = Math.abs(Math.sin(t * 5.2));
      p.y = 0.07 * hop;
      set(p, B.upperArmL, -0.3, 0, 2.45);
      set(p, B.upperArmR, -0.3, 0, -2.45);
      set(p, B.forearmL, -0.35 - 0.45 * Math.max(0, Math.sin(t * 7.8)), 0, 0);
      set(p, B.forearmR, -0.35 - 0.45 * Math.max(0, Math.sin(t * 7.8 + 1.2)), 0, 0);
      set(p, B.head, -0.2, 0.1 * Math.sin(t * 2), 0);
      set(p, B.chest, -0.06, 0, 0);
      for (const [th, sh, ft] of [
        [B.thighL, B.shinL, B.footL],
        [B.thighR, B.shinR, B.footR],
      ] as [number, number, number][]) {
        set(p, th, -0.25 * (1 - hop), 0, 0);
        set(p, sh, 0.45 * (1 - hop), 0, 0);
        set(p, ft, -0.2 * (1 - hop) + 0.3 * hop, 0, 0);
      }
      break;
    }
  }
  grip(p, i);
}

/** Held props shape the carrying arm (the gait and gestures still show through the other bones). */
function grip(p: Pose, i: PoseInput) {
  const moving = i.anim === "walk" || i.anim === "run";
  const busy = i.anim === "wave" || i.anim === "work" || i.anim === "celebrate" || i.anim === "jump" || i.anim === "sit" || i.anim === "study";
  if (busy) return;
  const talkR = i.anim === "talk" || i.talking;
  switch (i.held) {
    case "staff":
    case "spear":
    case "torch": {
      if (talkR) break;
      const swing = moving ? p.r[B.upperArmR * 3] * 0.35 : 0;
      set(p, B.upperArmR, -0.12 + swing, 0, -0.12);
      set(p, B.forearmR, i.held === "torch" ? -1.75 : -1.42, i.held === "torch" ? -0.2 : 0.1, 0);
      set(p, B.handR, i.held === "torch" ? 0.25 : -0.05, 0, 0);
      break;
    }
    case "lantern":
      if (talkR) break;
      add(p, B.upperArmR, -0.15, 0, 0);
      set(p, B.forearmR, -0.55, 0, 0);
      set(p, B.handR, 0.55, 0, 0);
      break;
    case "book":
    case "tablet":
      set(p, B.upperArmL, -0.18 + (moving ? p.r[B.upperArmL * 3] * 0.2 : 0), 0, 0.02);
      set(p, B.forearmL, -1.35, -0.55, 0);
      set(p, B.handL, 0.15, 0, -0.1);
      break;
    case "scroll":
      if (talkR) break;
      set(p, B.forearmR, -1.1 + (moving ? 0.2 : 0), 0.4, 0);
      set(p, B.handR, 0.1, 0, 0);
      break;
    case "basket":
      set(p, B.upperArmL, 0.02 + (moving ? p.r[B.upperArmL * 3] * 0.3 : 0), 0, 0.17);
      set(p, B.forearmL, -0.25, 0, 0);
      break;
    case "tool":
      if (talkR) break;
      set(p, B.forearmR, -0.5, 0, 0);
      break;
    case "none":
      break;
  }
}

export function samplePose(i: PoseInput, out: Pose) {
  clip(out, i);
}

// ------------------------------------------------------------------------------------------------ forward kinematics

const tmpE = new THREE.Euler();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);

/** Model-space bone matrices for a pose (root offset applied), index-aligned with BONES. */
export function boneMatrices(pose: Pose): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = [];
  for (let b = 0; b < BONE_COUNT; b++) {
    const p = PARENT[b];
    const j = JOINT[b];
    tmpE.set(pose.r[b * 3], pose.r[b * 3 + 1], pose.r[b * 3 + 2], "XYZ");
    tmpQ.setFromEuler(tmpE);
    if (p < 0) tmpV.set(j[0] + pose.x, j[1] + pose.y, j[2] + pose.z);
    else tmpV.set(j[0] - JOINT[p][0], j[1] - JOINT[p][1], j[2] - JOINT[p][2]);
    const local = new THREE.Matrix4().compose(tmpV, tmpQ, ONE);
    out.push(p < 0 ? local : out[p].clone().multiply(local));
  }
  return out;
}

/**
 * CPU skinning: bake a skinned body geometry into a static one in a given pose (statues, tests). Returns a new
 * non-indexed geometry with position + normal.
 */
export function bakeGeometry(g: THREE.BufferGeometry, pose: Pose): THREE.BufferGeometry {
  const mats = boneMatrices(pose);
  const skin = mats.map((m, b) => m.clone().multiply(new THREE.Matrix4().makeTranslation(-JOINT[b][0], -JOINT[b][1], -JOINT[b][2])));
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const si = g.attributes.skinIndex as THREE.BufferAttribute;
  const sw = g.attributes.skinWeight as THREE.BufferAttribute;
  const P = new Float32Array(pos.count * 3);
  const N = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const acc = new THREE.Vector3();
  const accN = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  for (let k = 0; k < pos.count; k++) {
    acc.set(0, 0, 0);
    accN.set(0, 0, 0);
    for (let c = 0; c < 2; c++) {
      const w = c === 0 ? sw.getX(k) : sw.getY(k);
      if (w <= 0) continue;
      const bi = c === 0 ? si.getX(k) : si.getY(k);
      v.fromBufferAttribute(pos, k).applyMatrix4(skin[bi]);
      acc.addScaledVector(v, w);
      nm.getNormalMatrix(skin[bi]);
      n.fromBufferAttribute(nor, k).applyMatrix3(nm);
      accN.addScaledVector(n, w);
    }
    accN.normalize();
    P.set([acc.x, acc.y, acc.z], k * 3);
    N.set([accN.x, accN.y, accN.z], k * 3);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(P, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(N, 3));
  return out;
}
