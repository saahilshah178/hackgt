"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/*
 * Small shared special effects for structures (the only materials this folder constructs, each created once):
 *   flameMaterial   additive teardrop flame with noise flicker, on two crossed quads (campfires, braziers, beacons)
 *   glowDiscMaterial additive radial pool of warm light on the ground under a fire (cheap fake bounce light)
 *   rimMaterial     additive fresnel rim for the "in reach" highlight
 *   capstoneGlow    the pyramid capstone's pulsing gilded glow
 * The time uniforms are advanced from any component's useFrame (they read the clock, so updates are idempotent).
 */

let flame: THREE.ShaderMaterial | null = null;
let disc: THREE.ShaderMaterial | null = null;
let rim: THREE.ShaderMaterial | null = null;
let capstone: THREE.MeshStandardMaterial | null = null;
let lamp: THREE.MeshBasicMaterial | null = null;

export function flameMaterial(): THREE.ShaderMaterial {
  flame ??= new THREE.ShaderMaterial({
    name: "fx:flame",
    uniforms: { uTime: { value: 0 }, uCalm: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uCalm;
      void main() {
        vUv = uv;
        vec3 p = position;
        float sway = (1.0 - uCalm * 0.8) * 0.08 * uv.y * uv.y;
        p.x += sin(uTime * 7.0 + p.y * 4.0) * sway;
        p.z += cos(uTime * 6.0 + p.y * 5.0) * sway;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uCalm;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        float a = hash(i); float b = hash(i + vec2(1.0, 0.0)); float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      void main() {
        vec2 uv = vUv;
        float speed = mix(2.6, 0.8, uCalm);
        float n = noise(vec2(uv.x * 5.0, uv.y * 3.0 - uTime * speed)) * 0.6 + noise(vec2(uv.x * 11.0, uv.y * 7.0 - uTime * speed * 1.7)) * 0.4;
        // teardrop: wide at the base, a tongue toward the top
        float x = (uv.x - 0.5) * 2.0;
        float width = mix(0.85, 0.05, pow(uv.y, 0.8)) * (0.75 + 0.5 * n);
        float body = smoothstep(width, width * 0.35, abs(x)) * smoothstep(1.0, 0.55, uv.y + n * 0.25) * smoothstep(0.0, 0.08, uv.y);
        float core = smoothstep(width * 0.55, 0.0, abs(x)) * smoothstep(0.7, 0.1, uv.y);
        vec3 col = mix(vec3(1.0, 0.32, 0.05), vec3(1.0, 0.72, 0.25), core);
        col = mix(col, vec3(1.0, 0.95, 0.8), core * core * 0.7);
        float a = body * (0.85 + 0.15 * n);
        if (a < 0.01) discard;
        gl_FragColor = vec4(col * a * 2.2, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  return flame;
}

export function glowDiscMaterial(): THREE.ShaderMaterial {
  disc ??= new THREE.ShaderMaterial({
    name: "fx:glowdisc",
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color("#ff9a3c") } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uColor;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float flick = 0.85 + 0.15 * sin(uTime * 9.0) * sin(uTime * 5.3 + 1.3);
        float a = pow(max(0.0, 1.0 - d), 2.2) * 0.55 * flick;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  return disc;
}

export function rimMaterial(): THREE.ShaderMaterial {
  rim ??= new THREE.ShaderMaterial({
    name: "fx:rim",
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color("#ffe2a0") } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      uniform float uTime;
      uniform vec3 uColor;
      void main() {
        float f = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 2.2);
        float pulse = 0.75 + 0.25 * sin(uTime * 2.4);
        float a = (f * 0.85 + 0.06) * pulse;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    blending: THREE.AdditiveBlending,
  });
  return rim;
}

export function capstoneGlowMaterial(): THREE.MeshStandardMaterial {
  capstone ??= new THREE.MeshStandardMaterial({ name: "fx:capstone", color: "#f2c55a", metalness: 0.85, roughness: 0.25, emissive: new THREE.Color("#ffb64a"), emissiveIntensity: 1.6 });
  return capstone;
}

/** A steady lamp (lighthouse lantern, station light): an unlit bright sphere. */
export function lampMaterial(): THREE.MeshBasicMaterial {
  lamp ??= new THREE.MeshBasicMaterial({ name: "fx:lamp", color: new THREE.Color(4, 3.2, 2.0), toneMapped: true });
  return lamp;
}

/** Advance the shared fx clocks (call from a useFrame). */
export function tickFx(time: number, calm: boolean) {
  if (flame) {
    flame.uniforms.uTime.value = time;
    flame.uniforms.uCalm.value = calm ? 1 : 0;
  }
  if (disc) disc.uniforms.uTime.value = calm ? 0 : time;
  if (rim) rim.uniforms.uTime.value = calm ? 0 : time;
  if (capstone) capstone.emissiveIntensity = calm ? 1.7 : 1.45 + 0.35 * Math.sin(time * 1.6);
}

let crossQuad: THREE.BufferGeometry | null = null;
/** Two crossed unit quads (x/y and z/y planes), base at y = 0, 1 m tall and wide. */
export function crossQuadGeometry(): THREE.BufferGeometry {
  if (crossQuad) return crossQuad;
  const a = new THREE.PlaneGeometry(1, 1);
  a.translate(0, 0.5, 0);
  const b = a.clone();
  b.rotateY(Math.PI / 2);
  const c = a.clone();
  c.rotateY(Math.PI / 4);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const g of [a, b, c]) {
    const p = g.attributes.position as THREE.BufferAttribute;
    const u = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      uv.push(u.getX(i), u.getY(i));
    }
    const ix = g.index!;
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    base += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  crossQuad = out;
  return out;
}

let discGeo: THREE.BufferGeometry | null = null;
export function discGeometry(): THREE.BufferGeometry {
  if (discGeo) return discGeo;
  discGeo = new THREE.PlaneGeometry(1, 1);
  discGeo.rotateX(-Math.PI / 2);
  return discGeo;
}

/** A flickering flame with a ground glow and (optionally) a point light. */
export function Flame({ size, lit, light, lamp: isLamp, calm, groundY = null }: { size: number; lit: boolean; light: boolean; lamp?: boolean; calm: boolean; groundY?: number | null }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const groupRef = useRef<THREE.Group>(null);
  const level = useRef(lit ? 1 : 0);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    tickFx(t, calm);
    const target = lit ? 1 : 0;
    level.current += (target - level.current) * Math.min(1, dt * (calm ? 6 : 1.8));
    const k = level.current;
    if (groupRef.current) {
      groupRef.current.visible = k > 0.02;
      const flick = isLamp || calm ? 1 : 0.9 + 0.1 * Math.sin(t * 13.1) * Math.sin(t * 7.7 + 0.5);
      groupRef.current.scale.setScalar(Math.max(0.001, k) * flick);
    }
    if (lightRef.current) {
      const flick = isLamp || calm ? 1 : 0.82 + 0.18 * Math.sin(t * 11.3) * Math.sin(t * 6.1 + 1.1);
      lightRef.current.intensity = k * flick * size * (isLamp ? 60 : 40);
    }
  });
  return (
    <>
      <group ref={groupRef}>
        {isLamp ? (
          <mesh material={lampMaterial()} position={[0, size * 0.5, 0]}>
            <sphereGeometry args={[size * 0.45, 16, 12]} />
          </mesh>
        ) : (
          <mesh geometry={crossQuadGeometry()} material={flameMaterial()} scale={[size * 0.7, size, size * 0.7]} renderOrder={5} />
        )}
        {groundY !== null && <mesh geometry={discGeometry()} material={glowDiscMaterial()} position={[0, groundY + 0.03, 0]} scale={[size * 5, 1, size * 5]} renderOrder={4} />}
      </group>
      {light && <pointLight ref={lightRef} position={[0, size * 0.6, 0]} color={isLamp ? "#ffe0a8" : "#ff9a48"} intensity={0} distance={size * 18} decay={2} />}
    </>
  );
}
