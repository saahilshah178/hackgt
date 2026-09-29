"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Weather as WeatherKind } from "../../../contracts/world3d";
import { mulberry32 } from "../../core/prng";
import { useWorldKit } from "../context";
import { qualitySettings } from "../quality";
import { useEnv } from "../sky/env";

/*
 * Weather particles: one GPU particle field per active effect, living in a box that follows the camera (positions wrap
 * in the vertex shader, so the field is endless and costs nothing on the CPU):
 *   dust / haze   warm motes drifting on the wind, glinting when back-lit by a low sun
 *   mist          big soft banks hugging the ground
 *   light_rain    1-px streaks (line segments) falling slightly slanted with the wind
 *   snow          flakes that flutter and swirl down
 *   ash           grey flakes with a few glowing embers
 *   fireflies     at night, blinking green-gold points near the ground (not on the Moon or ice)
 * Reduced motion: fewer particles, slower, no swirl.
 */

interface FieldSpec {
  count: number;
  /** box half-extent (m) around the camera, and its height */
  radius: number;
  height: number;
  /** below the camera's ground (m) to above it: where the field sits */
  base: number;
  color: string;
  /** px at 10 m */
  size: number;
  fall: number;
  drift: number;
  swirl: number;
  opacity: number;
  additive: boolean;
  /** 0 motes, 1 soft bank, 2 flake, 3 firefly, 4 ember */
  shape: number;
}

const SPECS: Partial<Record<WeatherKind | "fireflies" | "embers", FieldSpec>> = {
  dust: { count: 2600, radius: 38, height: 18, base: -1, color: "#d9b07a", size: 3.2, fall: 0.05, drift: 1.6, swirl: 0.6, opacity: 0.4, additive: false, shape: 0 },
  haze: { count: 700, radius: 32, height: 14, base: -1, color: "#ecd3ad", size: 2.4, fall: 0.02, drift: 0.8, swirl: 0.4, opacity: 0.22, additive: false, shape: 0 },
  mist: { count: 260, radius: 70, height: 7, base: -1.5, color: "#dfe6ea", size: 1100, fall: 0, drift: 0.5, swirl: 0.15, opacity: 0.09, additive: false, shape: 1 },
  snow: { count: 3200, radius: 34, height: 26, base: -2, color: "#ffffff", size: 7, fall: 1.1, drift: 0.9, swirl: 1.2, opacity: 0.85, additive: false, shape: 2 },
  ash: { count: 2000, radius: 34, height: 22, base: -2, color: "#8a837c", size: 6, fall: 0.5, drift: 1.0, swirl: 0.9, opacity: 0.7, additive: false, shape: 2 },
  embers: { count: 160, radius: 30, height: 16, base: -1, color: "#ff8a3a", size: 5, fall: -0.4, drift: 0.8, swirl: 1.2, opacity: 1, additive: true, shape: 4 },
  fireflies: { count: 260, radius: 34, height: 4, base: 0.2, color: "#d8ff7a", size: 6, fall: 0, drift: 0.15, swirl: 0.8, opacity: 1, additive: true, shape: 3 },
};

const POINTS_VERTEX = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform vec3 uCam;
uniform float uGround;
uniform float uRadius;
uniform float uHeight;
uniform float uBase;
uniform float uFall;
uniform float uDrift;
uniform float uSwirl;
uniform vec2 uWindDir;
uniform float uSize;
uniform float uCalm;
varying float vLife;
varying float vSeed;
void main() {
  float calm = 1.0 - 0.6 * uCalm;
  float t = uTime * calm;
  vec3 p = aSeed.xyz * vec3( 2.0 * uRadius, uHeight, 2.0 * uRadius );
  p.xz += uWindDir * uDrift * t * ( 0.6 + 0.8 * aSeed.w );
  p.y -= uFall * t * ( 0.7 + 0.6 * aSeed.w );
  p.x += sin( t * 0.7 + aSeed.w * 40.0 ) * uSwirl * ( 1.0 - uCalm );
  p.z += cos( t * 0.53 + aSeed.w * 23.0 ) * uSwirl * ( 1.0 - uCalm );
  // wrap into the box around the camera
  vec3 box = vec3( 2.0 * uRadius, uHeight, 2.0 * uRadius );
  vec3 origin = vec3( uCam.x - uRadius, uGround + uBase, uCam.z - uRadius );
  p = origin + mod( p - origin, box );
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  float d = max( 0.5, -mv.z );
  gl_PointSize = clamp( uSize * 10.0 / d, 1.0, 256.0 );
  // fade near the box walls and right at the camera so the wrap never pops
  vec3 rel = ( p - origin ) / box;
  float edge = smoothstep( 0.0, 0.12, rel.x ) * smoothstep( 1.0, 0.88, rel.x ) * smoothstep( 0.0, 0.12, rel.z ) * smoothstep( 1.0, 0.88, rel.z ) * smoothstep( 0.0, 0.08, rel.y ) * smoothstep( 1.0, 0.85, rel.y );
  vLife = edge * smoothstep( 0.6, 2.5, d );
  vSeed = aSeed.w;
}
`;

const POINTS_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uShape;
uniform float uTime;
uniform vec3 uSunDirV;
uniform float uBacklit;
varying float vLife;
varying float vSeed;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot( q, q );
  if ( r2 > 1.0 ) discard;
  float a;
  vec3 col = uColor;
  if ( uShape < 0.5 ) {
    a = exp( -r2 * 3.0 );
    col *= 1.0 + uBacklit * 2.5;
  } else if ( uShape < 1.5 ) {
    a = pow( 1.0 - r2, 2.0 );
  } else if ( uShape < 2.5 ) {
    a = smoothstep( 1.0, 0.45, r2 );
  } else if ( uShape < 3.5 ) {
    float blink = pow( 0.5 + 0.5 * sin( uTime * ( 1.1 + vSeed * 1.7 ) + vSeed * 60.0 ), 6.0 );
    a = exp( -r2 * 4.0 ) * blink;
    col *= 3.0;
  } else {
    a = exp( -r2 * 3.0 ) * ( 0.6 + 0.4 * sin( uTime * 6.0 + vSeed * 50.0 ) );
    col *= 4.0;
  }
  gl_FragColor = vec4( col, a * uOpacity * vLife );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const RAIN_VERTEX = /* glsl */ `
attribute vec4 aSeed;
attribute float aEnd;
uniform float uTime;
uniform vec3 uCam;
uniform float uGround;
uniform vec2 uWindDir;
uniform float uCalm;
varying float vA;
void main() {
  float R = 26.0;
  float Hh = 22.0;
  float speed = mix( 16.0, 8.0, uCalm );
  vec3 vel = vec3( uWindDir.x * 2.5, -speed, uWindDir.y * 2.5 );
  vec3 p = aSeed.xyz * vec3( 2.0 * R, Hh, 2.0 * R ) + vel * uTime * ( 0.85 + 0.3 * aSeed.w );
  vec3 box = vec3( 2.0 * R, Hh, 2.0 * R );
  vec3 origin = vec3( uCam.x - R, uGround - 1.0, uCam.z - R );
  p = origin + mod( p - origin, box );
  p -= vel * 0.045 * aEnd;
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  vec3 rel = ( p - origin ) / box;
  vA = smoothstep( 0.0, 0.1, rel.x ) * smoothstep( 1.0, 0.9, rel.x ) * smoothstep( 0.0, 0.1, rel.z ) * smoothstep( 1.0, 0.9, rel.z ) * smoothstep( 1.5, 4.0, -mv.z ) * mix( 1.0, 0.25, aEnd );
}
`;

const RAIN_FRAGMENT = /* glsl */ `
varying float vA;
void main() {
  gl_FragColor = vec4( 0.78, 0.82, 0.88, 0.2 * vA );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function seeds(count: number, salt: number): Float32Array {
  const rng = mulberry32(0x3a7e + salt);
  const out = new Float32Array(count * 4);
  for (let i = 0; i < out.length; i++) out[i] = rng();
  return out;
}

function PointField({ spec, salt }: { spec: FieldSpec; salt: number }) {
  const { composed, quality, reducedMotion } = useWorldKit();
  const env = useEnv();
  const q = qualitySettings(quality);
  const count = Math.max(8, Math.round(spec.count * q.particles * (reducedMotion ? 0.5 : 1)));
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds(count, salt), 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
  }, [count, salt]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: POINTS_VERTEX,
        fragmentShader: POINTS_FRAGMENT,
        uniforms: {
          uTime: env.uTime,
          uWindDir: env.uWindDir,
          uCalm: env.uCalm,
          uCam: { value: new THREE.Vector3() },
          uGround: { value: 0 },
          uRadius: { value: spec.radius },
          uHeight: { value: spec.height },
          uBase: { value: spec.base },
          uFall: { value: spec.fall },
          uDrift: { value: spec.drift },
          uSwirl: { value: spec.swirl },
          uSize: { value: spec.size },
          uColor: { value: new THREE.Color(spec.color) },
          uOpacity: { value: spec.opacity },
          uShape: { value: spec.shape },
          uSunDirV: { value: new THREE.Vector3() },
          uBacklit: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: spec.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
    [env, spec],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const view = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const cam = state.camera.position;
    const u = material.uniforms;
    (u.uCam.value as THREE.Vector3).copy(cam);
    u.uGround.value = composed.hf.height(cam.x, cam.z);
    // motes glint when the camera looks toward a low sun
    state.camera.getWorldDirection(view);
    const s = env.uSunDir.value;
    u.uBacklit.value = Math.max(0, view.dot(s)) ** 4 * (s.y < 0.5 ? 1 : 0.3);
  });
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
}

function Rain() {
  const { quality, reducedMotion, composed } = useWorldKit();
  const env = useEnv();
  const q = qualitySettings(quality);
  const count = Math.round(4200 * q.particles * (reducedMotion ? 0.5 : 1));
  const geometry = useMemo(() => {
    const s = seeds(count, 91);
    const seed = new Float32Array(count * 8);
    const end = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 4; k++) {
        seed[i * 8 + k] = s[i * 4 + k];
        seed[i * 8 + 4 + k] = s[i * 4 + k];
      }
      end[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    g.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
  }, [count]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: RAIN_VERTEX,
        fragmentShader: RAIN_FRAGMENT,
        uniforms: { uTime: env.uTime, uWindDir: env.uWindDir, uCalm: env.uCalm, uCam: { value: new THREE.Vector3() }, uGround: { value: 0 } },
        transparent: true,
        depthWrite: false,
      }),
    [env],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame((state) => {
    const cam = state.camera.position;
    (material.uniforms.uCam.value as THREE.Vector3).copy(cam);
    material.uniforms.uGround.value = composed.hf.height(cam.x, cam.z);
  });
  return <lineSegments geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
}

/** All weather particles for the world's atmosphere (and fireflies on warm nights). */
export function WeatherFx() {
  const { composed, rig, quality } = useWorldKit();
  const q = qualitySettings(quality);
  const w = composed.world.atmosphere.weather;
  const biome = composed.world.biome;
  if (q.particles <= 0) return null;
  const fields: { spec: FieldSpec; key: string }[] = [];
  const add = (k: keyof typeof SPECS) => {
    const spec = SPECS[k];
    if (spec) fields.push({ spec, key: k });
  };
  if (w === "dust") add("dust");
  if (w === "haze") add("haze");
  if (w === "mist") add("mist");
  if (w === "snow") add("snow");
  if (w === "ash") {
    add("ash");
    add("embers");
  }
  if (rig.night && biome !== "lunar" && biome !== "arctic" && w !== "snow" && w !== "light_rain") add("fireflies");
  return (
    <group name="weather">
      {fields.map((f, i) => (
        <PointField key={f.key} spec={f.spec} salt={i * 131 + f.key.length} />
      ))}
      {w === "light_rain" && <Rain />}
    </group>
  );
}
