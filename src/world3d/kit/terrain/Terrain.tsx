"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { BIOMES } from "../../core/biomes";
import type { ComposedWorld } from "../../core/compose";
import { useWorldKit } from "../context";
import { albedoTint } from "../materials/textures";
import { qualitySettings } from "../quality";
import { linkEnv, patchSunShadow, useEnv, type EnvUniforms } from "../sky/env";
import { bakeSunVisibility, horizonRing, occludersOf, terrainMasks, tileableNoise } from "./bake";
import {
  TERRAIN_AO_FRAGMENT,
  TERRAIN_FRAGMENT_PARS,
  TERRAIN_MAP_FRAGMENT,
  TERRAIN_NORMAL_FRAGMENT,
  TERRAIN_ROUGHNESS_FRAGMENT,
  TERRAIN_VERTEX_MAIN,
  TERRAIN_VERTEX_PARS,
} from "./shader";
import { splatLayers } from "./splat";
import { loadTerrainArrays, type TerrainArrays } from "./textureArray";

/*
 * <Terrain>: the heightfield as ONE mesh (res × res, smooth central-difference normals) with the splat material
 * (./shader.ts), plus the horizon ring that carries the land from the map edge into the fog with the same material.
 * The ground textures arrive asynchronously as texture arrays; until then (and on the Low tier) the same splat rules
 * blend the biome's flat colours, so the first frame already looks like the right place.
 *
 * Also exports the shared bakes other kit parts use: the tileable noise texture and the baked sun visibility.
 */

export function heightfieldGeometry(composed: ComposedWorld): THREE.BufferGeometry {
  const { hf } = composed;
  const { res, cell, heights } = hf;
  const half = hf.size / 2;
  const pos = new Float32Array(res * res * 3);
  const nrm = new Float32Array(res * res * 3);
  const h = (ix: number, iz: number) => heights[Math.min(res - 1, Math.max(0, iz)) * res + Math.min(res - 1, Math.max(0, ix))];
  for (let iz = 0; iz < res; iz++) {
    for (let ix = 0; ix < res; ix++) {
      const i = iz * res + ix;
      pos[i * 3] = -half + ix * cell;
      pos[i * 3 + 1] = heights[i];
      pos[i * 3 + 2] = -half + iz * cell;
      const nx = h(ix - 1, iz) - h(ix + 1, iz);
      const nz = h(ix, iz - 1) - h(ix, iz + 1);
      const ny = 2 * cell;
      const len = Math.hypot(nx, ny, nz);
      nrm[i * 3] = nx / len;
      nrm[i * 3 + 1] = ny / len;
      nrm[i * 3 + 2] = nz / len;
    }
  }
  const idx = new Uint32Array((res - 1) * (res - 1) * 6);
  let q = 0;
  for (let iz = 0; iz < res - 1; iz++) {
    for (let ix = 0; ix < res - 1; ix++) {
      const a = iz * res + ix;
      const b = a + 1;
      const c = a + res;
      const d = c + 1;
      idx[q++] = a;
      idx[q++] = c;
      idx[q++] = b;
      idx[q++] = b;
      idx[q++] = c;
      idx[q++] = d;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

function ringGeometry(composed: ComposedWorld, terrain: THREE.BufferGeometry): THREE.BufferGeometry {
  const ring = horizonRing(composed.hf, composed.world.biome, composed.world.seed);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(ring.positions, 3));
  g.setIndex(new THREE.BufferAttribute(ring.indices, 1));
  g.computeVertexNormals();
  // the inner ring shares the terrain's edge vertices: copy their normals so the seam doesn't show in the light
  const { res } = composed.hf;
  const tn = terrain.getAttribute("normal") as THREE.BufferAttribute;
  const rn = g.getAttribute("normal") as THREE.BufferAttribute;
  let j = 0;
  const copy = (ix: number, iz: number) => {
    const i = iz * res + ix;
    rn.setXYZ(j++, tn.getX(i), tn.getY(i), tn.getZ(i));
  };
  for (let ix = 0; ix < res - 1; ix++) copy(ix, 0);
  for (let iz = 0; iz < res - 1; iz++) copy(res - 1, iz);
  for (let ix = res - 1; ix > 0; ix--) copy(ix, res - 1);
  for (let iz = res - 1; iz > 0; iz--) copy(0, iz);
  g.computeBoundingSphere();
  return g;
}

let noiseTexture: THREE.DataTexture | null = null;
/** The shared 256² tileable RGBA noise (deterministic, built once per page). */
export function sharedNoiseTexture(): THREE.DataTexture {
  if (!noiseTexture) {
    const t = new THREE.DataTexture(tileableNoise(256, 7), 256, 256, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    noiseTexture = t;
  }
  return noiseTexture;
}

/** Bakes the long-range sun visibility for the composed world + sun and feeds it to the shared env uniforms. */
export function useSunVisibility(composed: ComposedWorld, sun: THREE.Vector3, enabled: boolean, env: EnvUniforms) {
  const texture = useMemo(() => {
    if (!enabled) return null;
    const { res } = composed.hf;
    const data = bakeSunVisibility(composed.hf, { x: sun.x, y: sun.y, z: sun.z }, occludersOf(composed));
    const t = new THREE.DataTexture(data, res, res, THREE.RedFormat, THREE.UnsignedByteType);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [composed, sun, enabled]);
  useEffect(() => {
    env.tSunVis.value = texture;
    env.uSunVisOn.value = texture ? 1 : 0;
    return () => {
      texture?.dispose();
      if (env.tSunVis.value === texture) {
        env.tSunVis.value = null;
        env.uSunVisOn.value = 0;
      }
    };
  }, [texture, env]);
}

export function Terrain() {
  const { composed, quality } = useWorldKit();
  const env = useEnv();
  const q = qualitySettings(quality);
  const biome = composed.world.biome;
  const preset = BIOMES[biome];
  const layers = useMemo(() => splatLayers(biome), [biome]);

  const geometry = useMemo(() => heightfieldGeometry(composed), [composed]);
  const ring = useMemo(() => (q.horizon ? ringGeometry(composed, geometry) : null), [composed, geometry, q.horizon]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => ring?.dispose(), [ring]);

  const maskTexture = useMemo(() => {
    const { res } = composed.hf;
    const t = new THREE.DataTexture(terrainMasks(composed), res, res, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [composed]);
  useEffect(() => () => maskTexture.dispose(), [maskTexture]);

  const uniforms = useMemo(
    () => ({
      tDiff: { value: null as THREE.DataArrayTexture | null },
      tNor: { value: null as THREE.DataArrayTexture | null },
      tArm: { value: null as THREE.DataArrayTexture | null },
      tMask: { value: maskTexture as THREE.Texture },
      tNoise: { value: sharedNoiseTexture() as THREE.Texture },
      uTextured: { value: 0 },
      uTriplanar: { value: q.triplanar ? 1 : 0 },
      uLevel: { value: composed.hf.waterLevel ?? 0 },
      uHasWater: { value: composed.hf.waterLevel === null ? 0 : 1 },
      uHighLine: { value: preset.highLine },
      uPeakLine: { value: preset.peakLine },
      uLayer: { value: layers.layerOf.slice() },
      uTint: { value: layers.colors.map(() => new THREE.Vector3(1, 1, 1)) },
      uFlat: { value: layers.colors.map((c) => new THREE.Color(c)) },
      uScale: { value: layers.layerOf.map(() => 0.5) },
      uRough: { value: layers.roughness.slice() },
      uNormalStrength: { value: 1.0 },
      uWetness: { value: composed.world.atmosphere.weather === "light_rain" ? 0.8 : composed.world.atmosphere.mood === "storm" ? 0.55 : composed.world.atmosphere.weather === "mist" ? 0.25 : 0 },
    }),
    [maskTexture, q.triplanar, composed, preset, layers],
  );

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
    m.name = "world3d:terrain";
    m.onBeforeCompile = (shader) => {
      linkEnv(shader, env);
      Object.assign(shader.uniforms, uniforms);
      patchSunShadow(shader);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${TERRAIN_VERTEX_PARS}`)
        .replace("#include <fog_vertex>", `#include <fog_vertex>\n${TERRAIN_VERTEX_MAIN}`);
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", `${TERRAIN_FRAGMENT_PARS}\nvoid main() {`)
        .replace("#include <map_fragment>", TERRAIN_MAP_FRAGMENT)
        .replace("#include <roughnessmap_fragment>", TERRAIN_ROUGHNESS_FRAGMENT)
        .replace("#include <normal_fragment_maps>", TERRAIN_NORMAL_FRAGMENT)
        .replace("#include <aomap_fragment>", TERRAIN_AO_FRAGMENT);
    };
    m.customProgramCacheKey = () => "world3d-terrain-1";
    return m;
  }, [env, uniforms]);
  useEffect(() => () => material.dispose(), [material]);

  // ground texture arrays (Medium/High)
  const [arrays, setArrays] = useState<TerrainArrays | null>(null);
  useEffect(() => {
    if (!q.textures) return;
    let alive = true;
    let loaded: TerrainArrays | null = null;
    void loadTerrainArrays(layers.textures, q.terrainTextureSize).then((a) => {
      if (!alive) {
        a?.dispose();
        return;
      }
      loaded = a;
      setArrays(a);
    });
    return () => {
      alive = false;
      loaded?.dispose();
      setArrays(null);
    };
  }, [layers, q.textures, q.terrainTextureSize]);

  useEffect(() => {
    const u = uniforms;
    if (!arrays) {
      u.uTextured.value = 0;
      u.tDiff.value = null;
      u.tNor.value = null;
      u.tArm.value = null;
      return;
    }
    u.tDiff.value = arrays.diff;
    u.tNor.value = arrays.nor;
    u.tArm.value = arrays.arm;
    layers.layerOf.forEach((layer, slot) => {
      const [r, g, b] = albedoTint(layers.colors[slot], arrays.avg[layer], 0.85);
      u.uTint.value[slot].set(r, g, b);
      // paving reads as a causeway of big slabs, not a cobbled street
      const metres = Math.min(40, Math.max(1, arrays.metres[layer] * (layers.textureOf[slot] === "cobble" ? 2.2 : 1)));
      u.uScale.value[slot] = 1 / metres;
    });
    u.uTextured.value = 1;
  }, [arrays, uniforms, layers]);

  return (
    <>
      <mesh geometry={geometry} material={material} receiveShadow castShadow name="terrain" />
      {ring && <mesh geometry={ring} material={material} name="terrain-horizon" />}
    </>
  );
}
