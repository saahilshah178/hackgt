"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import type { Npc } from "../../../contracts/world3d";
import { Humanoid, type HumanoidAnim } from "../../../world3d/kit/characters/Humanoid";
import { hashString } from "../../../world3d/core/prng";
import type { Pose } from "../store";
import { useSceneRefs } from "./refs";

/*
 * The world's characters. Each npc lives around its home spot: wanderers stroll a small loop, workers work, scholars
 * read. When the player comes near they turn to face them; while talking they gesture. Passing by, a character may say
 * one of its barks. Their name tags and barks are plain DOM in the HUD (ui/NpcLabels.tsx); this component projects each
 * npc's head to the screen every frame and moves its label, so no React root lives inside the canvas.
 */

const BEHAVIOR_ANIM: Record<Npc["behavior"], HumanoidAnim> = {
  idle: "idle",
  work: "work",
  wander: "walk",
  sit: "sit",
  guard: "guard",
  wave: "idle",
  study: "study",
};

const projected = new THREE.Vector3();

function NpcActor({ npc, home }: { npc: Npc; home: { x: number; y: number; z: number; facing: number } }) {
  const refs = useSceneRefs();
  const group = useRef<THREE.Group>(null);
  const seed = hashString(npc.id);
  const [anim, setAnim] = useState<HumanoidAnim>(BEHAVIOR_ANIM[npc.behavior]);
  const [lookAt, setLookAt] = useState<{ x: number; y: number; z: number } | null>(null);
  const st = useRef({ yaw: home.facing, x: home.x, z: home.z, lastBark: -30, barkUntil: 0, bark: null as string | null, pub: 0, anim: BEHAVIOR_ANIM[npc.behavior] as HumanoidAnim, waved: false, near: false, look: false });

  useFrame((state, dt) => {
    const s = st.current;
    const t = state.clock.elapsedTime;
    const p = refs.player;
    const dToPlayer = Math.hypot(p.x - s.x, p.z - s.z);
    const talking = refs.talkingTo.id === npc.id;
    let wantAnim: HumanoidAnim = BEHAVIOR_ANIM[npc.behavior];
    let wantYaw = s.yaw;
    if (npc.behavior === "wander" && !talking && dToPlayer > 5) {
      // a slow figure-eight around home, deterministic per npc
      const a = t * 0.12 + (seed % 100);
      const nx = home.x + Math.sin(a) * 5;
      const nz = home.z + Math.sin(a * 2) * 2.5;
      wantYaw = Math.atan2(nx - s.x, nz - s.z);
      s.x = nx;
      s.z = nz;
    } else if (npc.behavior === "wander") wantAnim = "idle";
    if (talking) {
      wantAnim = "talk";
      wantYaw = Math.atan2(p.x - s.x, p.z - s.z);
    } else if (dToPlayer < 7 && npc.behavior !== "sit") {
      wantYaw = Math.atan2(p.x - s.x, p.z - s.z);
      if (npc.behavior === "wave" && !s.waved && dToPlayer < 6) {
        s.waved = true;
        wantAnim = "wave";
      } else if (npc.behavior !== "work") wantAnim = "idle";
    } else if (dToPlayer > 12) s.waved = false;
    const diff = Math.atan2(Math.sin(wantYaw - s.yaw), Math.cos(wantYaw - s.yaw));
    s.yaw += diff * Math.min(1, dt * 4);
    const y = refs.physics.ground(s.x, s.z);
    if (group.current) {
      group.current.position.set(s.x, y, s.z);
      group.current.rotation.y = s.yaw;
    }
    if (wantAnim !== s.anim) {
      s.anim = wantAnim;
      setAnim(wantAnim);
    }
    const wantLook = talking || dToPlayer < 7;
    if (wantLook !== s.look) {
      s.look = wantLook;
      setLookAt(wantLook ? p : null);
    }

    // barks: in passing, not while talking, at most every 25 s
    let uiChanged = false;
    if (!talking && npc.barks.length > 0 && dToPlayer < 9 && dToPlayer > 3.5 && t - s.lastBark > 25) {
      s.lastBark = t;
      s.barkUntil = t + 4.5;
      s.bark = npc.barks[Math.floor(t) % npc.barks.length];
      uiChanged = true;
    } else if (s.bark && (t > s.barkUntil || talking)) {
      s.bark = null;
      uiChanged = true;
    }
    const near = dToPlayer < 16;
    if (near !== s.near) {
      s.near = near;
      uiChanged = true;
    }
    if (uiChanged) refs.live.set((l) => ({ npcUi: { ...l.npcUi, [npc.id]: { near: s.near, bark: s.bark } } }));

    // move the DOM label over the head
    const label = refs.labels.get(npc.id);
    if (label) {
      const camDist = Math.hypot(state.camera.position.x - s.x, state.camera.position.y - y - 2, state.camera.position.z - s.z);
      projected.set(s.x, y + 2.15 * npc.look.height, s.z).project(state.camera);
      const visible = projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2 && camDist < 70;
      if (!visible) label.style.visibility = "hidden";
      else {
        const w = state.size.width;
        const h = state.size.height;
        const sx = (projected.x * 0.5 + 0.5) * w;
        const sy = (-projected.y * 0.5 + 0.5) * h;
        const scale = THREE.MathUtils.clamp(9 / Math.max(camDist, 1), 0.55, 1.1);
        label.style.visibility = "visible";
        label.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
      }
    }

    if (t - s.pub > 0.25) {
      s.pub = t;
      const pose: Pose = { x: s.x, y, z: s.z, yaw: s.yaw };
      refs.live.set((l) => ({ npcs: { ...l.npcs, [npc.id]: pose } }));
    }
  });

  return (
    <group ref={group} name={`npc:${npc.id}`}>
      <Humanoid look={npc.look} anim={anim} speed={npc.behavior === "wander" ? 1.1 : 0} lookAt={lookAt} talking={anim === "talk"} seed={seed} />
    </group>
  );
}

export function Npcs() {
  const refs = useSceneRefs();
  return (
    <>
      {refs.world.npcs.map((npc) => {
        const home = refs.composed.npcs.find((n) => n.id === npc.id);
        if (!home) return null;
        return <NpcActor key={npc.id} npc={npc} home={home} />;
      })}
    </>
  );
}
