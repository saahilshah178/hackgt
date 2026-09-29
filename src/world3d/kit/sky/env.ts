"use client";

import { createContext, useContext } from "react";
import * as THREE from "three";

/*
 * Shared per-scene shader state for the kit's own materials (terrain, water, vegetation, fx): time, wind, the sun, the
 * baked long-range sun visibility and the realtime shadow box. <WorldScene> creates one EnvUniforms and updates the
 * `.value`s every frame; materials link the SAME uniform objects in onBeforeCompile, so one write reaches every shader.
 *
 * `patchSunShadow(shader)` makes a MeshStandardMaterial-derived shader use the realtime shadow map inside the box that
 * follows the player and the baked sun visibility (terrain + landmark shadows, bake.ts) outside it, so a pyramid's
 * 500 m evening shadow still lies across the far dunes.
 */

export interface EnvUniforms {
  uTime: THREE.IUniform<number>;
  /** 0 still .. 1 gale */
  uWind: THREE.IUniform<number>;
  /** unit wind direction on the ground plane (x, z) */
  uWindDir: THREE.IUniform<THREE.Vector2>;
  /** unit direction toward the sun (or the moon at night) */
  uSunDir: THREE.IUniform<THREE.Vector3>;
  /** linear sun colour × intensity */
  uSunColor: THREE.IUniform<THREE.Color>;
  tSunVis: THREE.IUniform<THREE.Texture | null>;
  uSunVisOn: THREE.IUniform<number>;
  /** heightfield grid: x = size/2, y = 1/cell, z = res, w = water level (or -1e4) */
  uGrid: THREE.IUniform<THREE.Vector4>;
  uShadowFocus: THREE.IUniform<THREE.Vector3>;
  uShadowExtent: THREE.IUniform<number>;
  /** 1 when a realtime shadow map exists */
  uShadowOn: THREE.IUniform<number>;
  /** night: 0 day .. 1 night (fireflies, window glow, star reflections) */
  uNight: THREE.IUniform<number>;
  /** reduced motion: 0 normal .. 1 calm (halves sway, stops particles swirling) */
  uCalm: THREE.IUniform<number>;
}

export function createEnvUniforms(): EnvUniforms {
  return {
    uTime: { value: 0 },
    uWind: { value: 0.3 },
    uWindDir: { value: new THREE.Vector2(0.8, 0.6).normalize() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    tSunVis: { value: null },
    uSunVisOn: { value: 0 },
    uGrid: { value: new THREE.Vector4(1, 1, 2, -1e4) },
    uShadowFocus: { value: new THREE.Vector3() },
    uShadowExtent: { value: 60 },
    uShadowOn: { value: 1 },
    uNight: { value: 0 },
    uCalm: { value: 0 },
  };
}

export const EnvContext = createContext<EnvUniforms | null>(null);

export function useEnv(): EnvUniforms {
  const env = useContext(EnvContext);
  if (!env) throw new Error("useEnv() must be used inside <WorldScene>");
  return env;
}

/** GLSL declarations + helpers (fragment and vertex safe). */
export const ENV_PARS = /* glsl */ `
uniform float uTime;
uniform float uWind;
uniform vec2 uWindDir;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform sampler2D tSunVis;
uniform float uSunVisOn;
uniform vec4 uGrid;
uniform vec3 uShadowFocus;
uniform float uShadowExtent;
uniform float uShadowOn;
uniform float uNight;
uniform float uCalm;
vec2 envGridUv(vec2 xz) { return ((xz + uGrid.x) * uGrid.y + 0.5) / uGrid.z; }
`;

export const ENV_FRAG_FUNCS = /* glsl */ `
float envSunVis(vec3 wp) {
  if (uSunVisOn < 0.5) return 1.0;
  vec2 uv = envGridUv(wp.xz);
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  return mix(1.0, texture2D(tSunVis, uv).r, inside);
}
float envShadowBlend(vec3 wp) {
  vec2 d = abs(wp.xz - uShadowFocus.xz) / max(1.0, uShadowExtent);
  return uShadowOn * (1.0 - smoothstep(0.72, 0.94, max(d.x, d.y)));
}
`;

const SHADOW_LINE =
  "directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;";

type Shader = THREE.WebGLProgramParametersWithUniforms;

/** Links the shared uniforms into a compiled shader (by reference). */
export function linkEnv(shader: Shader, env: EnvUniforms) {
  Object.assign(shader.uniforms, env);
}

/**
 * Adds the world position varying (`vEnvWPos`, instancing aware) and the baked + realtime sun shadow blend to a
 * MeshStandardMaterial-derived shader. Call from onBeforeCompile after linkEnv. Idempotent per shader string.
 */
export function patchSunShadow(shader: Shader) {
  if (shader.vertexShader.includes("vEnvWPos")) return;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${ENV_PARS}\nvarying vec3 vEnvWPos;`)
    .replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
      {
        vec4 envWp = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
        envWp = instanceMatrix * envWp;
        #endif
        vEnvWPos = ( modelMatrix * envWp ).xyz;
      }`,
    );
  let frag = shader.fragmentShader.replace("#include <common>", `#include <common>\n${ENV_PARS}\n${ENV_FRAG_FUNCS}\nvarying vec3 vEnvWPos;`);
  frag = frag.replace(
    "#include <lights_fragment_begin>",
    THREE.ShaderChunk.lights_fragment_begin
      .replace("vec3 geometryPosition = - vViewPosition;", "vec3 geometryPosition = - vViewPosition;\nfloat envBaked = envSunVis( vEnvWPos );\nfloat envInBox = envShadowBlend( vEnvWPos );\nfloat envDirShadow = envBaked;")
      .replace(
        SHADOW_LINE,
        `{ float envRt = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
          envDirShadow = mix( envBaked, envRt, envInBox );
          directLight.color *= envDirShadow; }`,
      )
      .replace(
        "getDirectionalLightInfo( directionalLight, directLight );",
        `getDirectionalLightInfo( directionalLight, directLight );
        #if !defined( USE_SHADOWMAP )
        directLight.color *= envBaked;
        #endif`,
      ),
  );
  shader.fragmentShader = frag;
}
