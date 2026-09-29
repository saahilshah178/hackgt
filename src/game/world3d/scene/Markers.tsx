"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { entrancePoint } from "../../../world3d/core/compose";
import type { MomentInfo } from "../model";
import { useSceneRefs } from "./refs";

/*
 * Wayfinding in the world itself: every open lead gets a soft light beam you can spot across the map (it fades as you
 * arrive) and a pulsing ring on the ground where you press E; the goal's tall beacon comes from the kit (<WorldScene>)
 * so the destination is never in doubt. Collectibles bob and glint. All additive, unlit and cheap.
 */

function beamMaterial(color: string, opacity: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
      varying vec2 vUv;
      void main() {
        float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float fade = pow(1.0 - vUv.y, 1.2) * smoothstep(0.0, 0.03, vUv.y);
        float shimmer = 0.85 + 0.15 * sin(uTime * 2.0 + vUv.y * 18.0);
        // a bright core inside a soft halo, over-bright so bloom and tone mapping keep it gold in daylight
        float core = smoothstep(0.55, 1.0, edge);
        gl_FragColor = vec4(uColor * (1.4 + 1.6 * core), uOpacity * (edge * edge + core) * fade * shimmer);
      }
    `,
  });
}

function Beam({ x, y, z, height, width, color, opacity, fadeNear }: { x: number; y: number; z: number; height: number; width: number; color: string; opacity: number; fadeNear: number }) {
  const refs = useSceneRefs();
  const mat = useMemo(() => beamMaterial(color, opacity), [color, opacity]);
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    const d = Math.hypot(refs.player.x - x, refs.player.z - z);
    mat.uniforms.uOpacity.value = opacity * THREE.MathUtils.smoothstep(d, fadeNear * 0.5, fadeNear * 2.5);
    // billboard around y: always show the broad face to the camera
    if (group.current) group.current.rotation.y = Math.atan2(state.camera.position.x - x, state.camera.position.z - z);
  });
  return (
    <group ref={group} position={[x, y, z]}>
      <mesh position={[0, height / 2, 0]} material={mat} renderOrder={5}>
        <planeGeometry args={[width, height, 1, 1]} />
      </mesh>
    </group>
  );
}

function Ring({ x, y, z, radius, color }: { x: number; y: number; z: number; radius: number; color: string }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }), [color]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const m = mesh.current;
    if (!m) return;
    const s = 1 + 0.06 * Math.sin(t * 2.4);
    m.scale.set(s, s, 1);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.12 * Math.sin(t * 2.4);
  });
  return (
    <mesh ref={mesh} position={[x, y + 0.08, z]} rotation={[-Math.PI / 2, 0, 0]} material={mat} renderOrder={4}>
      <ringGeometry args={[radius * 0.82, radius, 48]} />
    </mesh>
  );
}

function Relic({ x, y, z, accent }: { x: number; y: number; z: number; accent: string }) {
  const group = useRef<THREE.Group>(null);
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: accent, metalness: 1, roughness: 0.25, emissive: new THREE.Color(accent), emissiveIntensity: 0.55 }), [accent]);
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }), [accent]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!group.current) return;
    group.current.position.y = y + 0.9 + Math.sin(t * 2 + x) * 0.12;
    group.current.rotation.y = t * 1.2;
  });
  return (
    <group ref={group} position={[x, y + 0.9, z]} name="relic">
      {/* a small scarab-like jewel: domed body, head, and a glow sprite */}
      <mesh material={body} scale={[0.22, 0.12, 0.3]} castShadow>
        <sphereGeometry args={[1, 20, 14]} />
      </mesh>
      <mesh material={body} position={[0, 0, 0.3]} scale={[0.11, 0.08, 0.1]}>
        <sphereGeometry args={[1, 14, 10]} />
      </mesh>
      <mesh material={glow} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.85, 0]}>
        <circleGeometry args={[0.7, 24]} />
      </mesh>
    </group>
  );
}

export function Markers({ leads, collected, accent }: { leads: readonly MomentInfo[]; collected: ReadonlySet<string>; accent: string }) {
  const refs = useSceneRefs();
  const goal = refs.composed.goal;
  return (
    <>
      {leads.map((m) => {
        if (m.anchor.kind === "npc") {
          const home = refs.composed.npcs.find((n) => n.id === m.anchor.id);
          if (!home) return null;
          return (
            <group key={m.encounterId}>
              <Beam x={home.x} y={home.y} z={home.z} height={38} width={3} color={accent} opacity={0.8} fadeNear={10} />
              <Ring x={home.x} y={home.y} z={home.z} radius={1.25} color={accent} />
            </group>
          );
        }
        const l = refs.composed.landmarks.find((p) => p.id === m.anchor.id);
        if (!l) return null;
        const door = entrancePoint(l, 1.5);
        const y = refs.physics.ground(door.x, door.z);
        const isGoal = goal?.id === l.id;
        return (
          <group key={m.encounterId}>
            {!isGoal && <Beam x={door.x} y={y} z={door.z} height={46} width={3.4} color={accent} opacity={0.8} fadeNear={14} />}
            <Ring x={door.x} y={y} z={door.z} radius={2.2} color={accent} />
          </group>
        );
      })}
      {refs.composed.collectibles
        .filter((c) => !collected.has(c.id))
        .map((c) => (
          <Relic key={c.id} x={c.x} y={c.y} z={c.z} accent={accent} />
        ))}
    </>
  );
}
