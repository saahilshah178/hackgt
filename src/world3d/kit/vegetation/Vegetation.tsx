"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { ScatterKind } from "../../../contracts/world3d";
import { BIOMES } from "../../core/biomes";
import { useWorldKit } from "../context";
import { albedoTint, loadTextureSet } from "../materials/textures";
import { qualitySettings, type QualitySettings } from "../quality";
import { ENV_PARS, linkEnv, patchSunShadow, useEnv, type EnvUniforms } from "../sky/env";
import { createFoliageAtlas, type FoliageAtlas } from "./atlas";
import { CHUNK_SIZE, chunkBatch, instanceTint, positionHash, thinning } from "./chunks";
import { buildSpecies, VARIANTS, type Species } from "./geometry";
import { patchVegetationFragment, patchVegetationVertex } from "./shader";

/*
 * <Vegetation>: every composed scatter batch as instanced meshes, split into spatial chunks (frustum culling per chunk,
 * distance culling for small kinds) with a few geometry variants per kind. All foliage shares one atlas material
 * (./atlas.ts), grass a vertex-coloured one, rocks the photo rock texture; wind, distance fade, leaf translucency and
 * the baked + realtime sun shadow come from shader patches (./shader.ts, ../sky/env.ts). Trees and boulders cast
 * shadows inside the sun's shadow box (with wind in their shadow too).
 */

type MatKey = "foliageTree" | "foliageSmall" | "foliageTiny" | "grass" | "rockSmall" | "rockBig" | "crystal" | "ice";

const KIND_MAT: Record<ScatterKind, MatKey> = {
  palm: "foliageTree",
  conifer: "foliageTree",
  broadleaf: "foliageTree",
  birch: "foliageTree",
  dead_tree: "foliageTree",
  cactus: "foliageTree",
  bush: "foliageSmall",
  reeds: "foliageSmall",
  coral: "foliageSmall",
  flowers: "foliageTiny",
  mushroom: "foliageTiny",
  crop: "foliageTiny",
  tall_grass: "grass",
  rock: "rockSmall",
  boulder: "rockBig",
  crystal: "crystal",
  ice_shard: "ice",
};

const CASTS: ReadonlySet<ScatterKind> = new Set<ScatterKind>(["palm", "conifer", "broadleaf", "birch", "dead_tree", "cactus", "boulder", "crystal", "ice_shard"]);
const THINNED: ReadonlySet<ScatterKind> = new Set<ScatterKind>(["tall_grass", "flowers", "crop", "mushroom"]);
/** colour jitter per kind (0..0.3) */
const JITTER: Partial<Record<ScatterKind, number>> = { palm: 0.12, conifer: 0.1, broadleaf: 0.14, birch: 0.12, bush: 0.16, reeds: 0.12, tall_grass: 0.16, flowers: 0.1, crop: 0.1, rock: 0.12, boulder: 0.1 };

interface Materials {
  mats: Record<MatKey, THREE.MeshStandardMaterial>;
  depth: THREE.MeshDepthMaterial;
  dispose(): void;
}

function fadeFor(key: MatKey, q: QualitySettings): [number, number] {
  if (key === "foliageTiny" || key === "grass") return [q.smallDistance * 0.7, Math.max(1, q.smallDistance)];
  if (key === "foliageSmall" || key === "rockSmall") return [q.mediumDistance * 0.75, q.mediumDistance];
  return [1e6, 2e6];
}

function makeMaterials(atlas: FoliageAtlas | null, env: EnvUniforms, q: QualitySettings): Materials {
  const disposables: THREE.Material[] = [];
  const setup = (m: THREE.MeshStandardMaterial, key: MatKey, frag: { alphaMip: boolean; translucency: number; noFlip: boolean } | null) => {
    const [fs, fe] = fadeFor(key, q);
    const local = { uFadeStart: { value: fs }, uFadeEnd: { value: fe }, uTranslucency: { value: frag?.translucency ?? 0 } };
    m.onBeforeCompile = (shader) => {
      linkEnv(shader, env);
      Object.assign(shader.uniforms, local);
      patchSunShadow(shader);
      patchVegetationVertex(shader);
      if (frag) patchVegetationFragment(shader, { alphaMip: frag.alphaMip, translucency: frag.translucency > 0, noFlip: frag.noFlip });
    };
    m.customProgramCacheKey = () => `world3d-veg-${frag ? `${frag.alphaMip}-${frag.translucency > 0}-${frag.noFlip}` : "plain"}`;
    m.name = `world3d:veg:${key}`;
    disposables.push(m);
    return m;
  };
  const foliage = (key: MatKey) =>
    setup(
      new THREE.MeshStandardMaterial({ map: atlas?.texture ?? null, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.78, metalness: 0 }),
      key,
      { alphaMip: true, translucency: 1, noFlip: true },
    );
  const mats: Record<MatKey, THREE.MeshStandardMaterial> = {
    foliageTree: foliage("foliageTree"),
    foliageSmall: foliage("foliageSmall"),
    foliageTiny: foliage("foliageTiny"),
    grass: setup(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, vertexColors: true, roughness: 0.82, metalness: 0 }), "grass", { alphaMip: false, translucency: 0.8, noFlip: true }),
    rockSmall: setup(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }), "rockSmall", null),
    rockBig: setup(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }), "rockBig", null),
    crystal: setup(new THREE.MeshStandardMaterial({ color: "#b495f0", emissive: new THREE.Color("#6b3fd1"), emissiveIntensity: 0.55, roughness: 0.12, metalness: 0.1, vertexColors: true }), "crystal", null),
    ice: setup(new THREE.MeshStandardMaterial({ color: "#d8f0fb", roughness: 0.08, metalness: 0.05, vertexColors: true }), "ice", null),
  };
  mats.crystal.envMapIntensity = 2;
  mats.ice.envMapIntensity = 1.8;
  // shadows from swaying, alpha-tested trees
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas?.texture ?? null, alphaTest: 0.5, side: THREE.DoubleSide });
  const depthLocal = { uFadeStart: { value: 1e6 }, uFadeEnd: { value: 2e6 } };
  depth.onBeforeCompile = (shader) => {
    linkEnv(shader, env);
    Object.assign(shader.uniforms, depthLocal);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${ENV_PARS}`);
    patchVegetationVertex(shader);
  };
  depth.customProgramCacheKey = () => "world3d-veg-depth";
  disposables.push(depth);
  return {
    mats,
    depth,
    dispose() {
      for (const m of disposables) m.dispose();
    },
  };
}

export function Vegetation() {
  const { composed, quality } = useWorldKit();
  const env = useEnv();
  const q = qualitySettings(quality);
  const biome = composed.world.biome;

  const atlas = useMemo(() => createFoliageAtlas(), []);
  useEffect(() => () => atlas?.dispose(), [atlas]);
  const materials = useMemo(() => makeMaterials(atlas, env, q), [atlas, env, q]);
  useEffect(() => () => materials.dispose(), [materials]);

  // photo rock texture on rocks and boulders, tinted to the biome's rock colour
  useEffect(() => {
    if (!q.textures) return;
    let alive = true;
    void loadTextureSet("rock").then((set) => {
      if (!alive || !set) return;
      const tintTarget = BIOMES[biome].ground.cliff.color;
      const [r, g, b] = albedoTint(tintTarget, set.info.avg, 0.85);
      for (const m of [materials.mats.rockSmall, materials.mats.rockBig]) {
        const clone = (t: THREE.Texture) => {
          const c = t.clone();
          c.repeat.set(1 / set.info.metres, 1 / set.info.metres);
          c.needsUpdate = true;
          return c;
        };
        m.map = clone(set.diff);
        m.normalMap = clone(set.nor);
        m.roughnessMap = clone(set.arm);
        m.aoMap = m.roughnessMap;
        m.color.setRGB(r, g, b);
        m.needsUpdate = true;
      }
    });
    return () => {
      alive = false;
    };
  }, [materials, q.textures, biome]);
  useEffect(() => {
    // before (or without) textures: the biome's flat rock colour
    const c = new THREE.Color(BIOMES[biome].ground.cliff.color);
    materials.mats.rockSmall.color.copy(c);
    materials.mats.rockBig.color.copy(c);
  }, [materials, biome]);

  const built = useMemo(() => {
    const species = new Map<string, Species>();
    const getSpecies = (kind: ScatterKind, variant: number) => {
      const key = `${kind}:${variant}`;
      let s = species.get(key);
      if (!s) {
        s = buildSpecies(kind, variant, { biome, grassBlades: q.grassBlades });
        species.set(key, s);
      }
      return s;
    };
    const meshes: THREE.InstancedMesh[] = [];
    const m4 = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    for (const batch of composed.scatter) {
      const kind = batch.kind;
      const matKey = KIND_MAT[kind];
      if ((matKey === "grass" || matKey === "foliageTiny") && q.grassDensity <= 0) continue;
      const keep = THINNED.has(kind) ? thinning(batch.data, q.grassDensity) : undefined;
      const groups = chunkBatch(batch.data, batch.count, CHUNK_SIZE[kind], VARIANTS[kind], keep);
      const [, fadeEnd] = fadeFor(matKey, q);
      for (const g of groups) {
        const sp = getSpecies(kind, g.variant);
        const mesh = new THREE.InstancedMesh(sp.geometry, materials.mats[matKey], g.items.length);
        mesh.name = `veg:${kind}:${g.key}`;
        g.items.forEach((i, k) => {
          const d = batch.data;
          const x = d[i * 5];
          const y = d[i * 5 + 1];
          const z = d[i * 5 + 2];
          const yaw = d[i * 5 + 3];
          const s = Math.max(0.05, d[i * 5 + 4]);
          const tiltAmt = matKey === "rockSmall" || matKey === "rockBig" ? 0.35 : matKey === "foliageTree" ? 0.06 : 0.02;
          euler.set((positionHash(x, z, 21) - 0.5) * tiltAmt, yaw, (positionHash(x, z, 23) - 0.5) * tiltAmt);
          quat.setFromEuler(euler);
          pos.set(x, y - sp.sink * s, z);
          scl.set(s, s, s);
          m4.compose(pos, quat, scl);
          mesh.setMatrixAt(k, m4);
          const [r, gg, b] = instanceTint(x, z, JITTER[kind] ?? 0.06);
          mesh.setColorAt(k, col.setRGB(r, gg, b));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.castShadow = CASTS.has(kind) && q.treeShadows;
        mesh.receiveShadow = true;
        if (matKey.startsWith("foliage") && mesh.castShadow) mesh.customDepthMaterial = materials.depth;
        mesh.userData.maxDistance = fadeEnd;
        meshes.push(mesh);
      }
    }
    return { meshes, species };
  }, [composed, materials, q, biome]);
  useEffect(
    () => () => {
      for (const m of built.meshes) m.dispose();
      for (const s of built.species.values()) s.geometry.dispose();
    },
    [built],
  );

  // distance culling per chunk (the shader fades the last stretch, this skips the draw entirely)
  useFrame((state) => {
    const cam = state.camera.position;
    for (const m of built.meshes) {
      const sphere = m.boundingSphere;
      const max = m.userData.maxDistance as number;
      if (!sphere || max > 1e5) continue;
      m.visible = cam.distanceTo(sphere.center) - sphere.radius < max;
    }
  });

  return (
    <group name="vegetation">
      {built.meshes.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
    </group>
  );
}
