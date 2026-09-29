"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mulberry32 } from "../../core/prng";
import { useWorldKit } from "../context";
import { useEnv } from "../sky/env";

/*
 * Wayfinding and reward effects the game places in the world:
 *   <GoalBeacon>     a tall, soft pillar of light rising from the goal landmark (visible across the map, through haze),
 *                    with a glow where it leaves the structure; the game toggles it with `visible`.
 *   <InteractRing>   a subtle animated ring hugging the terrain around something the player can use.
 *   <RewardBurst>    a short celebratory burst of sparks, fired whenever `trigger` changes.
 * All additive, depth-tested, no shadows; reduced motion calms the pulses and shortens the burst.
 */

// ---------------------------------------------------------------- goal beacon

const BEACON_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4( position, 1.0 );
  vN = normalize( mat3( modelMatrix ) * normal );
  vV = normalize( cameraPosition - wp.xyz );
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const BEACON_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uIntensity;
uniform float uCalm;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  // soft core: brightest where the pillar faces the viewer, feathered at its silhouette
  float facing = abs( dot( normalize( vN.xz ), normalize( vV.xz ) ) );
  float core = pow( facing, 2.5 );
  float up = vUv.y;
  float fade = ( 1.0 - smoothstep( 0.0, 1.0, up ) ) * smoothstep( 0.0, 0.02, up );
  float bands = 0.85 + 0.15 * sin( up * 60.0 - uTime * mix( 2.0, 0.6, uCalm ) );
  float pulse = 0.85 + 0.15 * sin( uTime * mix( 1.6, 0.5, uCalm ) );
  float a = core * fade * bands * pulse * uIntensity;
  gl_FragColor = vec4( uColor * a, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const GLOW_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float r = length( q );
  float a = exp( -r * r * 5.0 ) * ( 0.9 + 0.1 * sin( uTime * 1.4 ) ) * uIntensity;
  gl_FragColor = vec4( uColor * a, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface GoalBeaconProps {
  visible?: boolean;
  /** sRGB hex; default warm gold */
  color?: string;
  /** override the anchor (default: the goal landmark's top) */
  position?: [number, number, number];
  /** pillar height (m) */
  height?: number;
  radius?: number;
}

export function GoalBeacon({ visible = true, color = "#ffc977", position, height = 420, radius }: GoalBeaconProps) {
  const { composed, reducedMotion } = useWorldKit();
  const env = useEnv();
  const g = composed.goal;
  const anchor: [number, number, number] | null = position ?? (g ? [g.x, g.y + g.height * 0.96, g.z] : null);
  const r = radius ?? Math.max(1.6, (g?.radius ?? 10) * 0.04);
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(color).multiplyScalar(2.2) }, uTime: env.uTime, uIntensity: { value: 1 }, uCalm: { value: reducedMotion ? 1 : 0 } }), [color, env, reducedMotion]);
  const pillar = useMemo(() => {
    const geo = new THREE.CylinderGeometry(r, r * 2.2, height, 24, 1, true);
    geo.translate(0, height / 2, 0);
    const mat = new THREE.ShaderMaterial({ vertexShader: BEACON_VERTEX, fragmentShader: BEACON_FRAGMENT, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    return { geo, mat };
  }, [r, height, uniforms]);
  const glow = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.ShaderMaterial({ vertexShader: BEACON_VERTEX, fragmentShader: GLOW_FRAGMENT, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    return { geo, mat };
  }, [uniforms]);
  useEffect(
    () => () => {
      pillar.geo.dispose();
      pillar.mat.dispose();
      glow.geo.dispose();
      glow.mat.dispose();
    },
    [pillar, glow],
  );
  const glowRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    // the glow is a camera-facing sprite, sized to stay readable from afar
    const m = glowRef.current;
    if (!m || !anchor) return;
    m.quaternion.copy(state.camera.quaternion);
    const d = state.camera.position.distanceTo(m.position);
    m.scale.setScalar(Math.max(r * 8, d * 0.06));
  });
  if (!anchor || !visible) return null;
  return (
    <group name="goal-beacon">
      <mesh geometry={pillar.geo} material={pillar.mat} position={anchor} renderOrder={20} frustumCulled={false} />
      <mesh ref={glowRef} geometry={glow.geo} material={glow.mat} position={anchor} renderOrder={21} />
    </group>
  );
}

// ---------------------------------------------------------------- interact ring

const RING_VERTEX = /* glsl */ `
attribute float aAngle;
attribute float aEdge;
varying float vAngle;
varying float vEdge;
void main() {
  vAngle = aAngle;
  vEdge = aEdge;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

const RING_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uActive;
uniform float uCalm;
varying float vAngle;
varying float vEdge;
void main() {
  float speed = mix( mix( 0.35, 1.1, uActive ), 0.1, uCalm );
  float dashes = smoothstep( 0.25, 0.55, 0.5 + 0.5 * sin( vAngle * 18.0 - uTime * speed * 6.0 ) );
  float band = smoothstep( 0.0, 0.35, vEdge ) * smoothstep( 1.0, 0.65, vEdge );
  float pulse = 0.75 + 0.25 * sin( uTime * mix( 1.5, 3.0, uActive ) );
  float a = band * mix( 0.35, 1.0, dashes ) * mix( 0.35, 1.0, uActive ) * pulse;
  gl_FragColor = vec4( uColor * a * 1.6, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface InteractRingProps {
  position: [number, number, number] | { x: number; y: number; z: number };
  radius?: number;
  active?: boolean;
  /** sRGB hex */
  color?: string;
}

export function InteractRing({ position, radius = 1.6, active = false, color = "#ffd27a" }: InteractRingProps) {
  const { composed, reducedMotion } = useWorldKit();
  const env = useEnv();
  const [px, pz] = Array.isArray(position) ? [position[0], position[2]] : [position.x, position.z];
  const geometry = useMemo(() => {
    // a band that hugs the ground (re-sampled from the heightfield) so it never cuts into a slope
    const seg = 72;
    const width = Math.max(0.12, radius * 0.1);
    const pos: number[] = [];
    const ang: number[] = [];
    const edge: number[] = [];
    const idx: number[] = [];
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      for (const [rr, e] of [
        [radius - width, 0],
        [radius + width, 1],
      ] as const) {
        const x = px + Math.cos(a) * rr;
        const z = pz + Math.sin(a) * rr;
        pos.push(x, composed.hf.height(x, z) + 0.06, z);
        ang.push(a);
        edge.push(e);
      }
      if (k < seg) {
        const i = k * 2;
        idx.push(i, i + 1, i + 3, i, i + 3, i + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aAngle", new THREE.Float32BufferAttribute(ang, 1));
    g.setAttribute("aEdge", new THREE.Float32BufferAttribute(edge, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }, [composed, px, pz, radius]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: RING_VERTEX,
        fragmentShader: RING_FRAGMENT,
        uniforms: { uColor: { value: new THREE.Color(color) }, uTime: env.uTime, uActive: { value: active ? 1 : 0 }, uCalm: { value: reducedMotion ? 1 : 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [color, env, active, reducedMotion],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geometry} material={material} renderOrder={10} name="interact-ring" />;
}

// ---------------------------------------------------------------- reward burst

const BURST_VERTEX = /* glsl */ `
attribute vec4 aSeed;
uniform float uAge;
uniform float uLife;
uniform float uSpread;
varying float vA;
varying float vHue;
void main() {
  float t = uAge;
  float a = aSeed.x * 6.2831853;
  float up = mix( 0.35, 1.0, aSeed.y );
  vec3 v = vec3( cos( a ) * ( 1.0 - up * 0.5 ), up * 1.6, sin( a ) * ( 1.0 - up * 0.5 ) ) * uSpread * mix( 0.6, 1.2, aSeed.z );
  vec3 p = position + v * t + vec3( 0.0, -4.5, 0.0 ) * t * t * 0.5;
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  float life = clamp( t / uLife, 0.0, 1.0 );
  vA = ( 1.0 - life ) * smoothstep( 0.0, 0.05, t ) * step( t, uLife );
  gl_PointSize = clamp( ( 7.0 + 6.0 * aSeed.w ) * 10.0 / max( 0.5, -mv.z ) * ( 1.0 - life * 0.6 ), 1.0, 64.0 );
  vHue = aSeed.w;
}
`;

const BURST_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying float vA;
varying float vHue;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot( q, q );
  if ( r2 > 1.0 || vA <= 0.0 ) discard;
  float star = exp( -r2 * 4.0 ) + 0.6 * exp( -abs( q.x * q.y ) * 40.0 ) * ( 1.0 - r2 );
  float twinkle = 0.7 + 0.3 * sin( uTime * 20.0 + vHue * 90.0 );
  vec3 col = mix( uColor, vec3( 1.0, 0.97, 0.9 ), vHue * 0.6 ) * 3.0;
  gl_FragColor = vec4( col * star * twinkle * vA, star * vA );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface RewardBurstProps {
  position: [number, number, number] | { x: number; y: number; z: number };
  /** any value; each change fires a new burst (e.g. a counter or the reward's id) */
  trigger: unknown;
  color?: string;
}

export function RewardBurst({ position, trigger, color = "#ffd36b" }: RewardBurstProps) {
  const { reducedMotion } = useWorldKit();
  const env = useEnv();
  const count = reducedMotion ? 36 : 110;
  const geometry = useMemo(() => {
    const rng = mulberry32(0xb125 + count);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < seed.length; i++) seed[i] = rng();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
    return g;
  }, [count]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BURST_VERTEX,
        fragmentShader: BURST_FRAGMENT,
        uniforms: { uAge: { value: 1e3 }, uLife: { value: reducedMotion ? 0.9 : 1.6 }, uSpread: { value: reducedMotion ? 1.4 : 3.4 }, uColor: { value: new THREE.Color(color) }, uTime: env.uTime },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [color, env, reducedMotion],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const first = useRef(true);
  const started = useRef<number | null>(null);
  useEffect(() => {
    // the first render only arms the burst; every later change of `trigger` fires it
    if (first.current) {
      first.current = false;
      return;
    }
    started.current = -1;
  }, [trigger]);
  useFrame((state) => {
    const u = material.uniforms;
    if (started.current === -1) started.current = state.clock.elapsedTime;
    u.uAge.value = started.current === null ? 1e3 : state.clock.elapsedTime - started.current;
  });
  const p: [number, number, number] = Array.isArray(position) ? position : [position.x, position.y, position.z];
  return <points geometry={geometry} material={material} position={p} renderOrder={22} frustumCulled={false} name="reward-burst" />;
}
