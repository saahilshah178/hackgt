"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BIOMES } from "../../core/biomes";
import { useWorldKit } from "../context";
import { loadWaterNormals } from "../materials/textures";
import { qualitySettings } from "../quality";
import { linkEnv, patchSunShadow, useEnv } from "../sky/env";
import { farDepthGrid, horizonField, relativeDepthGrid, riverFlow } from "../terrain/bake";
import { sharedNoiseTexture } from "../terrain/Terrain";
import { usePlanarReflection } from "./reflection";

/*
 * <Water>: one plane at the water level (map + horizon ring), shaded as MeshStandardMaterial so it gets the sun glint,
 * sky reflections (IBL) and fog for free, with onBeforeCompile adding:
 *   - depth under the surface from the heightfield (a half-float grid, no depth-buffer read): shallow → deep colour and
 *     opacity by optical depth, so the banks show through and the channel turns dark;
 *   - two scrolling normal layers, flow-mapped along the river's course (two-phase flow, no stretching) and drifting
 *     with the wind on lakes and the sea;
 *   - soft animated foam where the water is only a few centimetres deep;
 *   - Fresnel-driven opacity: at grazing angles the surface is a mirror of the sky, looking down it is clear.
 * Only drawn where the terrain is below the level (the terrain's depth hides the rest).
 */

const WATER_PARS = /* glsl */ `
uniform sampler2D tDepth;
uniform sampler2D tFarDepth;
uniform float uFarExtent;
uniform sampler2D tFlow;
uniform sampler2D tWaterNormal;
uniform sampler2D tWNoise;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform float uClarity;
uniform float uIsRiver;
uniform float uChop;
uniform sampler2D tReflect;
uniform mat4 uReflectMatrix;
uniform float uReflectOn;
varying vec3 vWWPos;
float waterDepth;
float waterFoam;
`;

const WATER_MAP = /* glsl */ `
{
  vec2 xz = vWWPos.xz;
  vec2 guv = envGridUv( xz );
  float inMap = step( 0.0, guv.x ) * step( guv.x, 1.0 ) * step( 0.0, guv.y ) * step( guv.y, 1.0 );
  float rel = inMap > 0.5 ? texture2D( tDepth, guv ).r : texture2D( tFarDepth, ( xz + uFarExtent ) / ( 2.0 * uFarExtent ) ).r;
  waterDepth = max( 0.0, -rel );
  vec3 V = normalize( cameraPosition - vWWPos );
  // light travels down to the bed and back: a steeper view sees through more water
  float optical = waterDepth * ( 1.0 + 1.0 / max( V.y, 0.15 ) ) * 0.5;
  vec3 body = mix( uShallow, uDeep, 1.0 - exp( -waterDepth * 0.38 ) );
  float alpha = 1.0 - exp( -optical * uClarity );
  // foam: a thin band at the waterline, broken up and slowly crawling
  vec4 n1 = texture2D( tWNoise, xz * 0.11 + vec2( uTime * 0.012, -uTime * 0.008 ) );
  vec4 n2 = texture2D( tWNoise, xz * 0.37 - vec2( uTime * 0.02, uTime * 0.015 ) );
  float edge = 1.0 - smoothstep( 0.0, 0.25 + 0.3 * n1.r, waterDepth );
  float pattern = smoothstep( 0.45, 0.8, n2.g * 0.7 + n1.b * 0.5 );
  waterFoam = edge * pattern * 0.8;
  diffuseColor.rgb = mix( body, uFoam, waterFoam * 0.7 );
  diffuseColor.a = clamp( max( alpha, waterFoam * 0.9 ), 0.0, 1.0 );
}
`;

const WATER_NORMAL = /* glsl */ `
{
  vec2 xz = vWWPos.xz;
  vec2 flow = ( texture2D( tFlow, envGridUv( xz ) ).rg * 2.0 - 1.0 );
  float speed = length( flow );
  vec2 drift = uWindDir * ( 0.35 + 0.8 * uWind );
  vec2 f = mix( drift, flow * 2.2, uIsRiver * smoothstep( 0.05, 0.3, speed ) );
  float t = uTime * 0.09;
  float p0 = fract( t );
  float p1 = fract( t + 0.5 );
  float blend = abs( 1.0 - 2.0 * p0 );
  vec2 uvA = xz * 0.037;
  vec2 uvB = mat2( 0.8, 0.6, -0.6, 0.8 ) * xz * 0.11 + 0.31;
  vec3 a0 = texture2D( tWaterNormal, uvA - f * p0 * 0.35 ).xyz * 2.0 - 1.0;
  vec3 a1 = texture2D( tWaterNormal, uvA - f * p1 * 0.35 + 0.5 ).xyz * 2.0 - 1.0;
  vec3 b0 = texture2D( tWaterNormal, uvB - f * p0 * 0.6 ).xyz * 2.0 - 1.0;
  vec3 b1 = texture2D( tWaterNormal, uvB - f * p1 * 0.6 + 0.5 ).xyz * 2.0 - 1.0;
  vec3 na = mix( a0, a1, blend );
  vec3 nb = mix( b0, b1, blend );
  // three.js's water normals are stored with z up in tangent space; our plane's tangent frame is (x, -z) → world (x, y, z)
  vec3 tn = normalize( vec3( na.xy * 0.9 + nb.xy * 0.6, na.z * nb.z ) );
  // calm rivers and lakes, choppier sea; flatter far away so the horizon reflects as a clean line
  float far = smoothstep( 60.0, 400.0, length( cameraPosition - vWWPos ) );
  float strength = uChop * mix( 0.6, 1.0, uWind ) * ( 1.0 - waterFoam * 0.6 ) * ( 1.0 - 0.6 * far );
  vec3 wn = normalize( vec3( tn.x * strength, 1.0, tn.y * strength ) );
  normal = normalize( ( viewMatrix * vec4( wn, 0.0 ) ).xyz );
}
`;

const WATER_REFLECT = /* glsl */ `
#include <lights_fragment_maps>
if ( uReflectOn > 0.5 ) {
  // planar reflection: the mirrored scene, nudged by the surface normal; the BRDF applies the Fresnel term
  vec3 wn = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
  vec4 rc = uReflectMatrix * vec4( vWWPos, 1.0 );
  vec2 ruv = rc.xy / rc.w + wn.xz * 0.085;
  float inside = smoothstep( 0.0, 0.03, ruv.x ) * smoothstep( 1.0, 0.97, ruv.x ) * smoothstep( 0.0, 0.03, ruv.y ) * smoothstep( 1.0, 0.97, ruv.y );
  vec3 mirror = texture2D( tReflect, clamp( ruv, 0.001, 0.999 ) ).rgb;
  radiance = mix( radiance, mirror, 0.92 * inside );
}
`;

const WATER_OPAQUE = /* glsl */ `
{
  float wF = 0.02 + 0.98 * pow( 1.0 - saturate( dot( normal, geometryViewDir ) ), 5.0 );
  diffuseColor.a = 1.0 - ( 1.0 - diffuseColor.a ) * ( 1.0 - wF );
}
#include <opaque_fragment>
`;

export function Water() {
  const { composed, quality } = useWorldKit();
  const env = useEnv();
  const q = qualitySettings(quality);
  const meshRef = useRef<THREE.Mesh>(null);
  const hideSelf = useCallback(() => (meshRef.current ? [meshRef.current] : []), []);
  const reflection = usePlanarReflection(composed.hf.waterLevel, q.reflections, hideSelf);
  const { hf } = composed;
  const level = hf.waterLevel;
  const biome = BIOMES[composed.world.biome];

  const depthTexture = useMemo(() => {
    const src = relativeDepthGrid(hf);
    const half = new Uint16Array(src.length);
    for (let i = 0; i < src.length; i++) half[i] = THREE.DataUtils.toHalfFloat(src[i]);
    const t = new THREE.DataTexture(half, hf.res, hf.res, THREE.RedFormat, THREE.HalfFloatType);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [hf]);
  const farTexture = useMemo(() => {
    const size = 256;
    const src = farDepthGrid(horizonField(hf, composed.world.biome, composed.world.seed), hf.waterLevel ?? 0, size);
    const half = new Uint16Array(src.length);
    for (let i = 0; i < src.length; i++) half[i] = THREE.DataUtils.toHalfFloat(src[i]);
    const t = new THREE.DataTexture(half, size, size, THREE.RedFormat, THREE.HalfFloatType);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [hf, composed.world.biome, composed.world.seed]);
  const flowTexture = useMemo(() => {
    const t = new THREE.DataTexture(riverFlow(hf), hf.res, hf.res, THREE.RGFormat, THREE.UnsignedByteType);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [hf]);
  useEffect(
    () => () => {
      depthTexture.dispose();
      farTexture.dispose();
      flowTexture.dispose();
    },
    [depthTexture, farTexture, flowTexture],
  );

  const uniforms = useMemo(
    () => ({
      tDepth: { value: depthTexture as THREE.Texture },
      tFarDepth: { value: farTexture as THREE.Texture },
      uFarExtent: { value: 2600 },
      tFlow: { value: flowTexture as THREE.Texture },
      tWaterNormal: { value: null as THREE.Texture | null },
      tWNoise: { value: sharedNoiseTexture() as THREE.Texture },
      uShallow: { value: new THREE.Color(biome.water.shallow) },
      uDeep: { value: new THREE.Color(biome.water.deep) },
      uFoam: { value: new THREE.Color(biome.water.foam) },
      uClarity: { value: 0.8 },
      uIsRiver: { value: composed.world.terrain.water.kind === "river" ? 1 : 0 },
      tReflect: { value: reflection.texture },
      uReflectMatrix: reflection.matrix,
      uReflectOn: reflection.on,
      uChop: { value: composed.world.terrain.water.kind === "ocean" ? 0.9 : composed.world.terrain.water.kind === "lake" ? 0.4 : 0.32 },
    }),
    [depthTexture, farTexture, flowTexture, biome, composed, reflection],
  );

  const [normals, setNormals] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    void loadWaterNormals().then((t) => alive && setNormals(t));
    return () => {
      alive = false;
    };
  }, []);

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.035, metalness: 0, transparent: true, depthWrite: false });
    m.name = "world3d:water";
    m.envMapIntensity = 1.0;
    m.onBeforeCompile = (shader) => {
      linkEnv(shader, env);
      Object.assign(shader.uniforms, uniforms);
      patchSunShadow(shader);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWWPos;")
        .replace("#include <fog_vertex>", "#include <fog_vertex>\nvWWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;");
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", `${WATER_PARS}\nvoid main() {`)
        .replace("#include <map_fragment>", WATER_MAP)
        .replace("#include <normal_fragment_maps>", WATER_NORMAL)
        .replace("#include <lights_fragment_maps>", WATER_REFLECT)
        .replace("#include <opaque_fragment>", WATER_OPAQUE);
    };
    m.customProgramCacheKey = () => "world3d-water-1";
    return m;
  }, [env, uniforms]);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    uniforms.tWaterNormal.value = normals;
    const t = normals;
    if (t) {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
    }
  }, [normals, uniforms]);

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(5600, 5600, 1, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  if (level === null || !normals) return null;
  return <mesh ref={meshRef} geometry={geometry} material={material} position={[0, level, 0]} renderOrder={2} receiveShadow name="water" />;
}
