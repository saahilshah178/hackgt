import * as THREE from "three";
import type { ComposedWorld, Placed } from "../../../world3d/core/compose";

/*
 * Camera direction for a world3d game. The rig (CameraRig.tsx) owns the THREE camera; everything else asks for a shot
 * by setting `director.mode`:
 *   follow  third person behind the player (mouse/keys orbit it)
 *   frame   a fixed shot (a dialogue two-shot, a landmark while its challenge is open)
 *   path    the opening flyover along the flyover landmarks, ending behind the player
 *   orbit   the finale: a slow circle around the goal
 * Transitions are exponential smoothing on position and look target, so every cut is a glide.
 */

export type CameraMode =
  | { kind: "follow" }
  | {
      kind: "frame";
      position: THREE.Vector3;
      look: THREE.Vector3;
      /** shift the subject left of centre (0..1 of the view width) when a side panel covers the right */
      shiftLeft?: number;
      /** shift the subject up (0..1 of the view height) when the dialogue box covers the bottom */
      shiftUp?: number;
    }
  | { kind: "path"; curve: THREE.CatmullRomCurve3; looks: THREE.CatmullRomCurve3; duration: number; started: number; onDone?: () => void }
  | { kind: "orbit"; center: THREE.Vector3; radius: number; height: number; speed: number };

export interface Orbit {
  /** direction from the player to the camera, radians (0 = camera south of the player) */
  yaw: number;
  /** elevation of the camera above the horizon, radians */
  pitch: number;
  distance: number;
  /** last time (ms) the player moved the camera by hand; auto-follow waits after it */
  touched: number;
}

export interface Director {
  mode: CameraMode;
  orbit: Orbit;
  /** smoothed state the rig writes each frame */
  position: THREE.Vector3;
  look: THREE.Vector3;
  /** mouse sensitivity multiplier and invert-Y from settings */
  sensitivity: number;
  invertY: boolean;
}

export function createDirector(spawnYaw: number): Director {
  return {
    mode: { kind: "follow" },
    orbit: { yaw: spawnYaw + Math.PI, pitch: 0.2, distance: 6.2, touched: 0 },
    position: new THREE.Vector3(),
    look: new THREE.Vector3(),
    sensitivity: 1,
    invertY: false,
  };
}

/** A two-shot for talking to an npc: over the player's shoulder, the npc's face a little left of centre. */
export function dialogueShot(player: { x: number; y: number; z: number }, npc: { x: number; y: number; z: number }, heightScale = 1): Extract<CameraMode, { kind: "frame" }> {
  const dx = npc.x - player.x;
  const dz = npc.z - player.z;
  const d = Math.hypot(dx, dz) || 1;
  if (d > 5) return speakerCloseUp(player, npc, heightScale);
  const fx = dx / d;
  const fz = dz / d;
  // right of the line player → npc
  const rx = -fz;
  const rz = fx;
  const head = npc.y + 1.58 * heightScale;
  // over the player's right shoulder, far enough to the side that the player frames the left edge and the npc reads
  const position = new THREE.Vector3(player.x - fx * 1.5 + rx * 1.9, player.y + 1.8, player.z - fz * 1.5 + rz * 1.9);
  const look = new THREE.Vector3(npc.x - rx * 0.35, head - 0.12, npc.z - rz * 0.35);
  return { kind: "frame", position, look, shiftLeft: 0, shiftUp: 0.16 };
}

/** A speaker further than a conversation's distance: a medium close-up from the player's side, the speaker facing us. */
export function speakerCloseUp(player: { x: number; z: number }, npc: { x: number; y: number; z: number }, heightScale = 1): Extract<CameraMode, { kind: "frame" }> {
  const dx = player.x - npc.x;
  const dz = player.z - npc.z;
  const d = Math.hypot(dx, dz) || 1;
  const fx = dx / d;
  const fz = dz / d;
  const head = npc.y + 1.58 * heightScale;
  const position = new THREE.Vector3(npc.x + fx * 3.4 - fz * 1.1, head + 0.15, npc.z + fz * 3.4 + fx * 1.1);
  const look = new THREE.Vector3(npc.x, head - 0.25, npc.z);
  return { kind: "frame", position, look, shiftLeft: 0, shiftUp: 0.16 };
}

/** Frames a landmark from where the player stands, subject left of centre so a right-side panel doesn't cover it. */
export function landmarkShot(player: { x: number; y: number; z: number }, l: Pick<Placed, "x" | "y" | "z" | "radius" | "height">, shiftLeft = 0.22): Extract<CameraMode, { kind: "frame" }> {
  const dx = l.x - player.x;
  const dz = l.z - player.z;
  const d = Math.hypot(dx, dz) || 1;
  const fx = dx / d;
  const fz = dz / d;
  const back = Math.min(18, 5 + l.height * 0.35);
  const position = new THREE.Vector3(player.x - fx * back - fz * 2, player.y + 2.4 + Math.min(10, l.height * 0.25), player.z - fz * back + fx * 2);
  const look = new THREE.Vector3(l.x, l.y + Math.min(l.height * 0.45, 20), l.z);
  return { kind: "frame", position, look, shiftLeft };
}

/** The opening flyover: high over the map, past each flyover landmark, down to over the player's shoulder. */
export function flyoverPath(c: ComposedWorld, ids: readonly string[], spawn: { x: number; y: number; z: number; facing: number }, secondsPerStop = 3.6): Extract<CameraMode, { kind: "path" }> {
  const stops = ids.map((id) => c.landmarks.find((p) => p.id === id)).filter((p): p is Placed => !!p);
  const half = c.hf.size / 2;
  const pts: THREE.Vector3[] = [];
  const looks: THREE.Vector3[] = [];
  const first = stops[0] ?? c.goal;
  // start high on the far side of the first stop, looking at it
  const startDir = first ? new THREE.Vector2(first.x - spawn.x, first.z - spawn.z).normalize() : new THREE.Vector2(0, 1);
  const startAt = first ?? { x: 0, y: 0, z: 0, height: 20, radius: 20 };
  pts.push(new THREE.Vector3(THREE.MathUtils.clamp(startAt.x + startDir.x * half * 0.55, -half, half), startAt.y + Math.max(70, startAt.height * 1.3), THREE.MathUtils.clamp(startAt.z + startDir.y * half * 0.55, -half, half)));
  looks.push(new THREE.Vector3(startAt.x, startAt.y + startAt.height * 0.3, startAt.z));
  let prev = pts[0];
  for (const s of stops) {
    const away = new THREE.Vector2(prev.x - s.x, prev.z - s.z);
    if (away.lengthSq() < 1) away.set(1, 0);
    away.normalize();
    // swing around the landmark: approach from the previous point, pass at ~1.7 radii, a bit above its middle
    const side = new THREE.Vector2(-away.y, away.x);
    const r = Math.max(34, s.radius * 2.3 + 22);
    const p = new THREE.Vector3(s.x + (away.x * 0.6 + side.x * 0.8) * r, s.y + s.height * 0.75 + 20, s.z + (away.y * 0.6 + side.y * 0.8) * r);
    pts.push(p);
    looks.push(new THREE.Vector3(s.x, s.y + s.height * 0.4, s.z));
    prev = p;
  }
  // end behind the player, looking where they face
  const fx = Math.sin(spawn.facing);
  const fz = Math.cos(spawn.facing);
  pts.push(new THREE.Vector3(spawn.x - fx * 6.5, spawn.y + 2.6, spawn.z - fz * 6.5));
  looks.push(new THREE.Vector3(spawn.x + fx * 20, spawn.y + 3, spawn.z + fz * 20));
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const lookCurve = new THREE.CatmullRomCurve3(looks, false, "centripetal");
  return { kind: "path", curve, looks: lookCurve, duration: Math.max(6, (stops.length + 1) * secondsPerStop), started: -1 };
}

export function orbitGoal(goal: Pick<Placed, "x" | "y" | "z" | "radius" | "height">): Extract<CameraMode, { kind: "orbit" }> {
  // low and wide: the goal stands against the sky with its beacon, the land around it in view
  return { kind: "orbit", center: new THREE.Vector3(goal.x, goal.y + goal.height * 0.42, goal.z), radius: Math.max(40, goal.radius * 2.8), height: -goal.height * 0.12 + 6, speed: 0.05 };
}

/** Ease in-out for the flyover so it starts and lands softly. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
