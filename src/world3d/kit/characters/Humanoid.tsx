"use client";

import { useFrame } from "@react-three/fiber";
import { forwardRef, useContext, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { NpcLook } from "../../../contracts/world3d";
import { WorldKitContext } from "../context";
import { accentMaterial, clothMaterial, getWorldMaterial, skinMaterial } from "../materials";
import { crossQuadGeometry, flameMaterial, tickFx } from "../structures/fx";
import { bodyKeyFor, humanoidModel, type CharSlot } from "./body";
import { blendPose, copyPose, gaitCadence, newPose, samplePose, type HumanoidAnim, type Pose } from "./poses";
import { B, BONE_COUNT, JOINT, PARENT } from "./skeleton";

/*
 * The procedural humanoid used for every npc and for the player. API (stable):
 *   <Humanoid look anim speed lookAt talking seed ref />
 * The origin is between the feet; the model faces local +z; 1.75 m tall at look.height 1 (the whole rig scales).
 *
 * Geometry comes from ./body (cached per outfit/headwear/held/build/hair, merged per material slot, skinned), so a
 * character is ~6-9 draw calls on its own skeleton. Every frame the current clip (./poses) is sampled, crossfaded from
 * the previous one over 0.3 s, and written to the bones:
 *   - walk/run cadence follows the character's MEASURED ground speed (its world position change), falling back to the
 *     `speed` prop when it stands still (galleries), so feet plant without sliding at any speed;
 *   - `talking` layers hand gestures and nods on idle/sit; `anim="talk"` is the full conversational clip;
 *   - `lookAt` is read every frame (a live object is fine) and treated as a standing person's position: the head, neck
 *     and a little of the chest turn toward a point ~1.5 m above it, clamped, fading out when it is behind;
 *   - "sit" sits on a stone block, or cross-legged like the seated scribe when holding a scroll, book or tablet;
 *   - a torch carries a flickering flame; reduced motion calms the idle life and flames.
 * Casts shadows. Egyptian worlds (setting.style) get wigs, kohl, sandals and the broad collar.
 */

export type { HumanoidAnim };

export interface HumanoidProps {
  look: NpcLook;
  anim?: HumanoidAnim;
  speed?: number;
  lookAt?: { x: number; y: number; z: number } | null;
  talking?: boolean;
  /** stable per-character seed for idle timing and small variations */
  seed?: number;
}

interface Rig {
  root: THREE.Group;
  bones: THREE.Bone[];
  skeleton: THREE.Skeleton;
  seat: THREE.Mesh;
  meshes: THREE.SkinnedMesh[];
}

interface State {
  current: HumanoidAnim;
  since: number;
  from: Pose;
  a: Pose;
  out: Pose;
  phase: number;
  last: THREE.Vector3;
  measured: number;
  yaw: number;
  pitch: number;
  lookW: number;
}

function materialsFor(look: NpcLook): Record<CharSlot, THREE.Material> {
  return {
    skin: skinMaterial(look.skin),
    cloth: clothMaterial(look.color),
    accent: clothMaterial(look.accent),
    linen: clothMaterial("linen"),
    hair: accentMaterial("hair"),
    dark: accentMaterial("shadow"),
    leather: clothMaterial("brown", 2),
    metal: getWorldMaterial("metal"),
    gold: getWorldMaterial("gold"),
    wood: getWorldMaterial("wood"),
    glow: accentMaterial("glow"),
    foliage: accentMaterial("foliage"),
    straw: getWorldMaterial("thatch"),
    hardhat: clothMaterial("gold"),
  };
}

let seatGeo: THREE.BufferGeometry | null = null;

function createRig(look: NpcLook, seed: number, egypt: boolean): { rig: Rig; flame: THREE.Mesh | null } {
  const model = humanoidModel(bodyKeyFor(look, seed, egypt));
  const mats = materialsFor(look);
  const root = new THREE.Group();
  const bones: THREE.Bone[] = [];
  for (let b = 0; b < BONE_COUNT; b++) {
    const bone = new THREE.Bone();
    const p = PARENT[b];
    const j = JOINT[b];
    if (p < 0) {
      bone.position.set(j[0], j[1], j[2]);
      root.add(bone);
    } else {
      bone.position.set(j[0] - JOINT[p][0], j[1] - JOINT[p][1], j[2] - JOINT[p][2]);
      bones[p].add(bone);
    }
    bones.push(bone);
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const meshes: THREE.SkinnedMesh[] = [];
  for (const part of model.parts) {
    const m = new THREE.SkinnedMesh(part.geometry, mats[part.slot]);
    m.castShadow = part.slot !== "glow" && part.slot !== "dark";
    m.receiveShadow = true;
    m.frustumCulled = false;
    root.add(m);
    m.bind(skeleton, new THREE.Matrix4());
    meshes.push(m);
  }
  seatGeo ??= new THREE.BoxGeometry(0.5, 0.45, 0.42).translate(0, 0.225, -0.06);
  const seat = new THREE.Mesh(seatGeo, getWorldMaterial(egypt ? "limestone" : "granite", { variant: seed % 4 }));
  seat.castShadow = true;
  seat.receiveShadow = true;
  seat.visible = false;
  root.add(seat);
  let flame: THREE.Mesh | null = null;
  if (model.flame && !model.flame.lamp) {
    flame = new THREE.Mesh(crossQuadGeometry(), flameMaterial());
    const j = JOINT[model.flame.bone];
    flame.position.set(model.flame.at[0] - j[0], model.flame.at[1] - j[1], model.flame.at[2] - j[2]);
    // the torch head points along the grip axis (+z in the bind pose); the flame stands on it
    flame.rotation.x = Math.PI / 2;
    flame.scale.setScalar(model.flame.size);
    flame.renderOrder = 5;
    bones[model.flame.bone].add(flame);
  }
  return { rig: { root, bones, skeleton, seat, meshes }, flame };
}

const tmp = new THREE.Vector3();
const sm = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

export const Humanoid = forwardRef<THREE.Group, HumanoidProps>(function Humanoid({ look, anim = "idle", speed = 0, lookAt = null, talking = false, seed = 0 }, ref) {
  const kit = useContext(WorldKitContext);
  const egypt = kit ? kit.composed.world.setting.style === "ancient_egypt" : false;
  const calm = kit?.reducedMotion ?? false;
  const holder = useRef<THREE.Group>(null);
  const rigRef = useRef<Rig | null>(null);
  const flameRef = useRef<THREE.Mesh | null>(null);
  const stRef = useRef<State | null>(null);

  const { skin, outfit, color, accent, headwear, held } = look;
  useLayoutEffect(() => {
    const host = holder.current;
    if (!host) return;
    const built = createRig({ skin, outfit, color, accent, headwear, held, height: 1 }, seed, egypt);
    host.add(built.rig.root);
    rigRef.current = built.rig;
    flameRef.current = built.flame;
    return () => {
      host.remove(built.rig.root);
      built.rig.skeleton.dispose();
      rigRef.current = null;
      flameRef.current = null;
    };
  }, [skin, outfit, color, accent, headwear, held, seed, egypt]);

  useFrame((state, dt0) => {
    const rig = rigRef.current;
    const host = holder.current;
    if (!rig || !host) return;
    const dt = Math.min(0.1, Math.max(0, dt0));
    const time = state.clock.elapsedTime;
    const s: State = (stRef.current ??= {
      current: anim,
      since: 1,
      from: newPose(),
      a: newPose(),
      out: newPose(),
      phase: (seed % 100) / 100,
      last: new THREE.Vector3(Number.NaN, 0, 0),
      measured: 0,
      yaw: 0,
      pitch: 0,
      lookW: 0,
    });
    const h = Math.max(0.5, look.height);

    // measured ground speed (normalised to a 1.75 m body)
    host.getWorldPosition(tmp);
    if (!Number.isNaN(s.last.x) && dt > 1e-4) {
      const v = Math.hypot(tmp.x - s.last.x, tmp.z - s.last.z) / dt;
      if (v < 25) s.measured += (v - s.measured) * Math.min(1, dt * 8);
    }
    s.last.copy(tmp);
    const moving = anim === "walk" || anim === "run";
    let gspeed = s.measured > 0.25 ? s.measured : moving ? Math.max(speed, anim === "run" ? 4.5 : 1.3) : 0;
    gspeed /= h;
    if (anim === "run") gspeed = Math.max(gspeed, 3.4);

    if (anim !== s.current) {
      copyPose(s.out, s.from);
      s.current = anim;
      s.since = 0;
    }
    s.since += dt;
    if (moving) s.phase += dt * gaitCadence(gspeed);
    const scribe = held === "scroll" || held === "book" || held === "tablet";
    samplePose({ anim: s.current, t: s.since, time: calm ? time * 0.6 : time, speed: gspeed, phase: s.phase, seed, talking, held, sitOnBlock: !scribe, calm }, s.a);
    const fade = anim === "jump" ? 0.12 : 0.3;
    const w = Math.min(1, s.since / fade);
    if (w < 1) blendPose(s.from, s.a, sm(w), s.out);
    else copyPose(s.a, s.out);
    const out = s.out;

    // look at a point ~1.5 m above the target (a standing person's face)
    let wantW = 0;
    let wantYaw = 0;
    let wantPitch = 0;
    if (lookAt) {
      tmp.set(lookAt.x, lookAt.y + 1.5, lookAt.z);
      host.worldToLocal(tmp);
      const dx = tmp.x;
      const dz = tmp.z - 0.05;
      const dy = tmp.y - 1.6 - out.y;
      const yaw = Math.atan2(dx, dz);
      if (Math.abs(yaw) < 2.1 && Math.hypot(dx, dz) > 0.3) {
        wantW = 1;
        wantYaw = Math.max(-1.25, Math.min(1.25, yaw));
        wantPitch = Math.max(-0.45, Math.min(0.5, Math.atan2(-dy, Math.hypot(dx, dz))));
      }
    }
    const k = Math.min(1, dt * 4);
    s.lookW += (wantW - s.lookW) * Math.min(1, dt * 3);
    s.yaw += (wantYaw - s.yaw) * k;
    s.pitch += (wantPitch - s.pitch) * k;
    if (s.lookW > 0.001) {
      const lw = s.lookW;
      out.r[B.head * 3 + 1] += s.yaw * 0.58 * lw;
      out.r[B.neck * 3 + 1] += s.yaw * 0.22 * lw;
      out.r[B.chest * 3 + 1] += s.yaw * 0.2 * lw;
      out.r[B.head * 3] += s.pitch * 0.65 * lw;
      out.r[B.neck * 3] += s.pitch * 0.3 * lw;
    }

    // write the pose
    const bones = rig.bones;
    for (let b = 0; b < BONE_COUNT; b++) bones[b].rotation.set(out.r[b * 3], out.r[b * 3 + 1], out.r[b * 3 + 2]);
    bones[B.root].position.set(JOINT[0][0] + out.x, JOINT[0][1] + out.y, JOINT[0][2] + out.z);
    rig.seat.visible = s.current === "sit" && !scribe && w > 0.5;
    if (flameRef.current) tickFx(time, calm);
  });

  return (
    <group ref={ref}>
      <group ref={holder} scale={look.height} />
    </group>
  );
});
