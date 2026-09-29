"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import type { NpcLook } from "../../../contracts/world3d";
import { Humanoid, type HumanoidAnim } from "../../../world3d/kit/characters/Humanoid";
import { step } from "../physics";
import type { Pose, Target } from "../store";
import { useSceneRefs } from "./refs";

/*
 * The player: reads WASD/arrows relative to the camera, jogs (5.5 m/s) or sprints (Shift, 9 m/s), jumps (Space),
 * turns smoothly toward where it moves, and steps the physics (ground, slopes, water, colliders). About 12 times a
 * second it publishes its pose, the camera heading, the nearest interaction target and the frame rate to the live
 * store the HUD reads.
 */

export const JOG = 5.5;
export const SPRINT = 9;

export function Player({ look, findTarget }: { look: NpcLook; findTarget: (pose: Pose) => Target | null }) {
  const refs = useSceneRefs();
  const group = useRef<THREE.Group>(null);
  const [anim, setAnim] = useState<HumanoidAnim>("idle");
  const animRef = useRef<HumanoidAnim>("idle");
  const velocity = useRef({ x: 0, z: 0 });
  const publish = useRef({ t: 0, frames: 0, fpsT: 0, fps: 0 });

  useEffect(() => refs.input.attach(), [refs.input]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const p = refs.player;
    const input = refs.control.enabled ? refs.input.read() : { forward: 0, right: 0, sprint: false, jump: false, turn: 0 };
    // camera-relative wish direction: forward is away from the camera
    const camYaw = Math.atan2(refs.director.look.x - refs.director.position.x, refs.director.look.z - refs.director.position.z);
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    // right of the forward vector (fx, fz) is (-fz, fx) in three.js space (x east, z south)
    const wx = fx * input.forward - fz * input.right;
    const wz = fz * input.forward + fx * input.right;
    const len = Math.hypot(wx, wz);
    // analog input (the touch stick) walks when pushed gently; keys are always full tilt
    const speed = len > 0.05 ? (input.sprint ? SPRINT : JOG) * Math.min(1, len) : 0;
    const tx = len > 0.05 ? (wx / len) * speed : 0;
    const tz = len > 0.05 ? (wz / len) * speed : 0;
    const accel = p.grounded ? 10 : 2.5;
    const k = 1 - Math.exp(-accel * dt);
    velocity.current.x += (tx - velocity.current.x) * k;
    velocity.current.z += (tz - velocity.current.z) * k;
    const v = velocity.current;
    const next = step(refs.physics, p, { dx: v.x * dt, dz: v.z * dt }, input.jump, dt);
    const moved = Math.hypot(next.x - p.x, next.z - p.z) / Math.max(dt, 1e-4);
    Object.assign(p, next);
    p.speed = moved;
    if (len > 0.05) {
      const want = Math.atan2(wx, wz);
      const diff = Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw));
      p.yaw += diff * Math.min(1, dt * 12);
    }
    if (group.current) {
      group.current.position.set(p.x, p.y, p.z);
      group.current.rotation.y = p.yaw;
    }
    const nextAnim: HumanoidAnim = !p.grounded ? "jump" : p.speed > 6.5 ? "run" : p.speed > 0.6 ? "walk" : "idle";
    if (nextAnim !== animRef.current) {
      animRef.current = nextAnim;
      setAnim(nextAnim);
    }

    // ~12 Hz publish to the HUD
    const pub = publish.current;
    pub.frames++;
    if (state.clock.elapsedTime - pub.fpsT >= 1) {
      pub.fps = Math.round(pub.frames / (state.clock.elapsedTime - pub.fpsT));
      pub.frames = 0;
      pub.fpsT = state.clock.elapsedTime;
    }
    if (state.clock.elapsedTime - pub.t >= 0.083) {
      pub.t = state.clock.elapsedTime;
      const pose: Pose = { x: p.x, y: p.y, z: p.z, yaw: p.yaw };
      refs.live.set({ player: pose, cameraYaw: camYaw, target: refs.control.enabled ? findTarget(pose) : null, fps: pub.fps });
    }
  });

  return (
    <group ref={group} name="player">
      <Humanoid look={look} anim={anim} speed={refs.player.speed} seed={7} />
    </group>
  );
}
