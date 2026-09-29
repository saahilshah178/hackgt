"use client";

import { forwardRef } from "react";
import type * as THREE from "three";
import type { NpcLook } from "../../../contracts/world3d";
import { clothMaterial, skinMaterial } from "../materials";

/*
 * The procedural humanoid used for every npc and for the player. API (stable):
 *   <Humanoid look anim speed facing? lookAt? talking? ref />
 * `anim` picks the clip; `speed` (m/s) drives the walk/run cycle so feet don't slide; `lookAt` turns the head toward a
 * world point (the player during dialogue). The origin is between the feet; the model faces local +z; ~1.75 m tall at
 * look.height 1. This file starts as a stub (a capsule body and a head).
 */

export type HumanoidAnim = "idle" | "walk" | "run" | "talk" | "wave" | "work" | "sit" | "study" | "jump" | "guard" | "celebrate";

export interface HumanoidProps {
  look: NpcLook;
  anim?: HumanoidAnim;
  speed?: number;
  lookAt?: { x: number; y: number; z: number } | null;
  talking?: boolean;
  /** stable per-character seed for idle timing and small variations */
  seed?: number;
}

export const Humanoid = forwardRef<THREE.Group, HumanoidProps>(function Humanoid({ look }, ref) {
  const h = 1.75 * look.height;
  return (
    <group ref={ref}>
      <mesh position={[0, h * 0.42, 0]} material={clothMaterial(look.color)} castShadow>
        <capsuleGeometry args={[0.22, h * 0.5, 4, 10]} />
      </mesh>
      <mesh position={[0, h * 0.9, 0]} material={skinMaterial(look.skin)} castShadow>
        <sphereGeometry args={[0.13, 16, 12]} />
      </mesh>
    </group>
  );
});
