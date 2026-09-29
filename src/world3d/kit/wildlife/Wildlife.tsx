"use client";

import { useFrame } from "@react-three/fiber";
import { useContext, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { ClothColor, WildlifeKind } from "../../../contracts/world3d";
import { WILDLIFE } from "../../core/catalog";
import type { ComposedWildlife } from "../../core/compose";
import { WorldKitContext, type WorldKit } from "../context";
import { accentMaterial, clothMaterial } from "../materials";
import { animalModel, birdBodyGeometry, birdWingGeometry, butterflyWingGeometry, fishGeometry, IB, QB, type AnimalModel, type AnimalSlot } from "./animals";
import { butterfly, firefly, fishAt, fishPath, flockBird, spawnGround, stepGround, type FishPath, type FlyPose, type GroundAnimal, type GroundMode, type WorldQuery } from "./behavior";

/*
 * Ambient creatures. API (stable): <Wildlife list playerPosition? onPositions? />.
 *   - cats, dogs, goats, camels, horses and ibises: skinned procedural bodies (./animals) driven by a deterministic state
 *     machine (./behavior) on the heightfield: they wander their home, sit, groom, graze, lie down; ibises wade and
 *     probe the shallows; friendly cats come and sit by the player and look up. Gaits are procedural and speed-synced.
 *   - bird flocks circle high (instanced bodies and flapping wings), butterflies flutter low, fireflies glow at dusk and
 *     at night (additive points), fish swim loops under the water surface (instanced).
 * `onPositions` receives the interactive animals (WILDLIFE[kind].interactive) every ~250 ms (id `${kind}_${n}`), so the
 * host can offer "E · Pet the cat". Spawns derive from the composed homes and the world seed; everything is built
 * imperatively into one group and updated from a single useFrame. Reduced motion slows flutter and flapping.
 */

export interface WildlifeProps {
  list: readonly ComposedWildlife[];
  playerPosition?: () => { x: number; y: number; z: number } | null;
  /** called every ~250 ms with the interactive animals' positions (id = `${kind}_${index}`) */
  onPositions?: (animals: { id: string; kind: ComposedWildlife["kind"]; x: number; y: number; z: number }[]) => void;
}

// ------------------------------------------------------------------------------------------------ rigs

const COATS: Record<string, ClothColor[]> = {
  cat: ["ochre", "charcoal", "cream", "brown"],
  dog: ["ochre", "brown", "cream", "terracotta"],
  goat: ["cream", "brown", "charcoal", "linen"],
  camel: ["ochre", "cream", "ochre", "brown"],
  horse: ["brown", "charcoal", "cream", "terracotta"],
  ibis: ["linen", "linen", "linen", "linen"],
};

interface AnimalRig {
  root: THREE.Group;
  bones: THREE.Bone[];
  skeleton: THREE.Skeleton;
  model: AnimalModel;
}

function slotMat(kind: WildlifeKind, slot: AnimalSlot, coat: number): THREE.Material {
  switch (slot) {
    case "coat":
      return clothMaterial(COATS[kind]?.[coat % 4] ?? "brown", coat % 2);
    case "coat2":
      return clothMaterial(kind === "camel" ? "brown" : "cream", 1);
    case "dark":
      return accentMaterial(kind === "horse" || kind === "ibis" ? "hair" : "shadow");
    case "horn":
      return clothMaterial("linen", 2);
    case "white":
      return clothMaterial("linen");
  }
}

function createAnimalRig(kind: WildlifeKind, coat: number): AnimalRig | null {
  const model = animalModel(kind);
  if (!model) return null;
  const root = new THREE.Group();
  const bones: THREE.Bone[] = [];
  model.joints.forEach((j, b) => {
    const bone = new THREE.Bone();
    const p = model.parent[b];
    if (p < 0) {
      bone.position.set(j[0], j[1], j[2]);
      root.add(bone);
    } else {
      const pj = model.joints[p];
      bone.position.set(j[0] - pj[0], j[1] - pj[1], j[2] - pj[2]);
      bones[p].add(bone);
    }
    bones.push(bone);
  });
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  for (const part of model.parts) {
    const m = new THREE.SkinnedMesh(part.geometry, slotMat(kind, part.slot, coat));
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    root.add(m);
    m.bind(skeleton, new THREE.Matrix4());
  }
  return { root, bones, skeleton, model };
}

const TAU = Math.PI * 2;
const fr = (v: number) => v - Math.floor(v);

/** Pose a quadruped or ibis rig for its behaviour mode. */
function poseAnimal(rig: AnimalRig, kind: WildlifeKind, mode: GroundMode, phase: number, v: number, t: number, lookYaw: number, seed: number) {
  const b = rig.bones;
  for (const bone of b) bone.rotation.set(0, 0, 0);
  const root = b[0];
  root.position.set(0, 0, 0);
  const H = rig.model.legLen;
  if (kind === "ibis") {
    const walk = mode === "walk" ? Math.min(1, v / 0.25) : 0;
    for (const [u, l, off] of [
      [IB.legLU, IB.legLL, 0],
      [IB.legRU, IB.legRL, 0.5],
    ] as [number, number, number][]) {
      const q = fr(phase + off);
      b[u].rotation.x = -0.32 * Math.cos(TAU * q) * walk;
      b[l].rotation.x = -0.9 * (q > 0.5 ? Math.sin(Math.PI * (q - 0.5) * 2) : 0) * walk;
    }
    b[IB.body].rotation.x = 0.12 * walk;
    b[IB.neck2].rotation.x = 0.12 * Math.sin(TAU * phase * 2) * walk;
    if (mode === "feed") {
      b[IB.body].rotation.x = 0.55;
      b[IB.neck1].rotation.x = 0.75;
      b[IB.neck2].rotation.x = 0.35;
      b[IB.head].rotation.x = 0.35 + 0.18 * Math.max(0, Math.sin(t * 4.5 + seed));
      b[IB.head].rotation.y = 0.2 * Math.sin(t * 0.7 + seed);
      for (const u of [IB.legLU, IB.legRU]) b[u].rotation.x = -0.4;
      for (const l of [IB.legLL, IB.legRL]) b[l].rotation.x = 0.3;
      root.position.y = -0.03;
    } else if (mode === "idle") {
      b[IB.neck2].rotation.x = -0.1;
      b[IB.head].rotation.y = 0.5 * Math.sin(t * 0.4 + seed);
    }
    return;
  }
  const breath = Math.sin(t * 2.2 + seed);
  b[QB.chest].rotation.x = 0.01 * breath;
  b[QB.tail1].rotation.y = 0.25 * Math.sin(t * 1.3 + seed);
  b[QB.tail2].rotation.y = 0.35 * Math.sin(t * 1.3 + seed - 0.8);
  b[QB.tail2].rotation.x = kind === "cat" ? -0.3 + 0.15 * Math.sin(t * 0.9) : 0;
  const walk = mode === "walk" ? Math.min(1, v / 0.2) : 0;
  if (walk > 0) {
    const A = 0.36;
    const legs: [number, number, number, boolean][] = [
      [QB.hlU, QB.hlL, 0, false],
      [QB.flU, QB.flL, 0.25, true],
      [QB.hrU, QB.hrL, 0.5, false],
      [QB.frU, QB.frL, 0.75, true],
    ];
    for (const [u, l, off, front] of legs) {
      const q = fr(phase + off);
      const swing = q > 0.5 ? Math.sin(Math.PI * (q - 0.5) * 2) : 0;
      b[u].rotation.x = -A * Math.cos(TAU * q) * walk;
      b[l].rotation.x = (front ? 0.9 : -0.7) * swing * walk;
    }
    root.position.y = -0.02 * H * Math.abs(Math.sin(TAU * phase * 2)) * walk;
    b[QB.neck].rotation.x = 0.06 * Math.sin(TAU * phase * 2) * walk * (kind === "camel" || kind === "horse" ? 1.5 : 0.5);
    b[QB.hips].rotation.z = 0.03 * Math.sin(TAU * phase) * walk;
  }
  const sitBack = () => {
    b[QB.hips].rotation.x = -0.7;
    root.position.y = -(H * 0.55);
    for (const [u, l] of [
      [QB.hlU, QB.hlL],
      [QB.hrU, QB.hrL],
    ]) {
      b[u].rotation.x = -1.2;
      b[l].rotation.x = 2.25;
    }
    b[QB.tail1].rotation.x = 0.8;
  };
  switch (mode) {
    case "sit":
      sitBack();
      for (const u of [QB.flU, QB.frU]) b[u].rotation.x = 0.7;
      b[QB.neck].rotation.x = 0.3;
      b[QB.head].rotation.x = 0.4;
      break;
    case "groom":
      sitBack();
      b[QB.frU].rotation.x = 0.7;
      b[QB.flU].rotation.x = -0.55;
      b[QB.flL].rotation.x = 1.6;
      b[QB.neck].rotation.x = 0.55;
      b[QB.head].rotation.x = 0.85 + 0.14 * Math.sin(t * 8 + seed);
      b[QB.head].rotation.y = 0.35;
      break;
    case "graze":
      b[QB.neck].rotation.x = kind === "camel" ? 1.2 : 1.05;
      b[QB.head].rotation.x = 0.4 + 0.04 * Math.sin(t * 6 + seed);
      b[QB.head].rotation.y = 0.15 * Math.sin(t * 0.5 + seed);
      break;
    case "lie":
      // kneeling: legs folded flat under the body, the belly on the ground
      root.position.y = -(H * 0.78);
      for (const [u, l, front] of [
        [QB.flU, QB.flL, true],
        [QB.frU, QB.frL, true],
        [QB.hlU, QB.hlL, false],
        [QB.hrU, QB.hrL, false],
      ] as [number, number, boolean][]) {
        b[u].rotation.x = front ? -1.5 : -1.35;
        b[l].rotation.x = 2.95;
        b[u].rotation.z = (u === QB.flU || u === QB.hlU ? 1 : -1) * 0.12;
      }
      b[QB.neck].rotation.x = -0.15;
      b[QB.head].rotation.y = 0.4 * Math.sin(t * 0.3 + seed);
      break;
    case "idle":
      b[QB.head].rotation.y = 0.45 * Math.sin(t * 0.37 + seed) * Math.sin(t * 0.11 + seed * 2);
      b[QB.neck].rotation.x = 0.05 * breath;
      break;
    default:
      break;
  }
  if (lookYaw) {
    b[QB.head].rotation.y += lookYaw * 0.65;
    b[QB.neck].rotation.y += lookYaw * 0.35;
    b[QB.head].rotation.x -= 0.25 * Math.min(1, Math.abs(lookYaw) + 0.5);
  }
}

// ------------------------------------------------------------------------------------------------ fireflies

let fireflyMat: THREE.ShaderMaterial | null = null;
function fireflyMaterial(): THREE.ShaderMaterial {
  fireflyMat ??= new THREE.ShaderMaterial({
    name: "fx:fireflies",
    uniforms: { uScale: { value: 300 }, uBright: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float glow;
      varying float vGlow;
      uniform float uScale;
      void main() {
        vGlow = glow;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (0.08 + 0.18 * glow) * uScale / max(0.5, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vGlow;
      uniform float uBright;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(max(0.0, 1.0 - d), 2.0) * (0.25 + vGlow) * uBright;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(0.85, 1.0, 0.45) * a * 2.0, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return fireflyMat;
}

// ------------------------------------------------------------------------------------------------ the scene

interface Flock {
  home: ComposedWildlife;
  n: number;
  body: THREE.InstancedMesh;
  wingL: THREE.InstancedMesh;
  wingR: THREE.InstancedMesh;
  ground: number;
  kind: "bird_flock" | "butterflies";
}

interface Swarm {
  home: ComposedWildlife;
  n: number;
  points: THREE.Points;
}

interface School {
  paths: FishPath[];
  mesh: THREE.InstancedMesh;
  level: number;
}

interface Scene {
  animals: { a: GroundAnimal; rig: AnimalRig }[];
  flocks: Flock[];
  swarms: Swarm[];
  schools: School[];
  pub: number;
}

const DENSITY = { low: 0.5, medium: 0.75, high: 1 } as const;
const BUTTERFLY_COLORS = ["#f2a33a", "#f4f1e6", "#f7d64a", "#6fa3e8", "#e8743a"];

function worldQuery(kit: WorldKit): WorldQuery {
  const { hf, nav } = kit.composed;
  return { height: (x, z) => hf.height(x, z), walkable: (x, z) => nav.walkableAt(x, z), waterDepth: (x, z) => hf.waterDepth(x, z) };
}

function buildScene(kit: WorldKit, list: readonly ComposedWildlife[], holder: THREE.Group): Scene {
  const hf = kit.composed.hf;
  const q = worldQuery(kit);
  const seed = kit.composed.world.seed;
  const density = DENSITY[kit.quality];
  const animals: Scene["animals"] = [];
  for (const a of spawnGround(list, seed, q, kit.quality === "low" ? 0.6 : 1)) {
    const rig = createAnimalRig(a.kind, a.coat);
    if (!rig) continue;
    rig.root.scale.setScalar(a.size);
    holder.add(rig.root);
    animals.push({ a, rig });
  }
  const flocks: Flock[] = [];
  const swarms: Swarm[] = [];
  const schools: School[] = [];
  list.forEach((w, gi) => {
    if (w.kind === "bird_flock" || w.kind === "butterflies") {
      const isBird = w.kind === "bird_flock";
      const n = Math.max(1, Math.round(Math.min(w.count, isBird ? 30 : 20) * density));
      const mat = isBird ? accentMaterial("hair") : clothMaterial("linen");
      const body = new THREE.InstancedMesh(birdBodyGeometry(), mat, n);
      const wingGeo = isBird ? birdWingGeometry() : butterflyWingGeometry();
      const wingL = new THREE.InstancedMesh(wingGeo, mat, n);
      const wingR = new THREE.InstancedMesh(wingGeo, mat, n);
      for (const m of [body, wingL, wingR]) {
        m.frustumCulled = false;
        m.castShadow = isBird;
        holder.add(m);
      }
      if (!isBird) {
        body.visible = false;
        const c = new THREE.Color();
        for (let i = 0; i < n; i++) {
          c.set(BUTTERFLY_COLORS[(i + gi) % BUTTERFLY_COLORS.length]);
          wingL.setColorAt(i, c);
          wingR.setColorAt(i, c);
        }
      }
      flocks.push({ home: w, n, body, wingL, wingR, ground: hf.height(w.x, w.z), kind: w.kind });
    } else if (w.kind === "fireflies") {
      const n = Math.max(1, Math.round(Math.min(w.count * 2, 60) * density));
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute("glow", new THREE.BufferAttribute(new Float32Array(n), 1));
      const points = new THREE.Points(g, fireflyMaterial());
      points.frustumCulled = false;
      holder.add(points);
      swarms.push({ home: w, n, points });
    } else if (w.kind === "fish" && hf.waterLevel !== null) {
      const paths: FishPath[] = [];
      const want = Math.max(1, Math.round(Math.min(w.count, 30) * density));
      for (let i = 0; paths.length < want && i < want * 4; i++) {
        const p = fishPath(w, i, seed);
        let ok = true;
        for (let k = 0; k < 12 && ok; k++) {
          const s = fishAt(p, (k / 12) * (TAU / Math.abs(p.w)));
          ok = hf.waterDepth(s.x, s.z) > p.depth + 0.35;
        }
        if (ok) paths.push(p);
      }
      if (paths.length) {
        const mesh = new THREE.InstancedMesh(fishGeometry(), clothMaterial("olive", 3), paths.length);
        mesh.frustumCulled = false;
        holder.add(mesh);
        schools.push({ paths, mesh, level: hf.waterLevel });
      }
    }
  });
  return { animals, flocks, swarms, schools, pub: 0 };
}

const m4 = new THREE.Matrix4();
const m4b = new THREE.Matrix4();
const qv = new THREE.Quaternion();
const eu = new THREE.Euler();
const pv = new THREE.Vector3();
const sv = new THREE.Vector3();
const fly: FlyPose = { x: 0, y: 0, z: 0, yaw: 0, roll: 0, pitch: 0, flap: 0 };
const ff = { x: 0, y: 0, z: 0 };
const MIRROR = new THREE.Matrix4().makeScale(-1, 1, 1);

function WildlifeInner({ kit, list, playerPosition, onPositions }: WildlifeProps & { kit: WorldKit }) {
  const holder = useRef<THREE.Group>(null);
  const sceneRef = useRef<Scene | null>(null);
  useLayoutEffect(() => {
    const host = holder.current;
    if (!host) return;
    const scene = buildScene(kit, list, host);
    sceneRef.current = scene;
    return () => {
      for (const { rig } of scene.animals) {
        host.remove(rig.root);
        rig.skeleton.dispose();
      }
      for (const f of scene.flocks)
        for (const m of [f.body, f.wingL, f.wingR]) {
          host.remove(m);
          m.dispose();
        }
      for (const s of scene.swarms) {
        host.remove(s.points);
        s.points.geometry.dispose();
      }
      for (const s of scene.schools) {
        host.remove(s.mesh);
        s.mesh.dispose();
      }
      sceneRef.current = null;
    };
  }, [kit, list]);

  useFrame((state, dt0) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const dt = Math.min(0.1, dt0);
    const t = state.clock.elapsedTime;
    const calm = kit.reducedMotion;
    const hf = kit.composed.hf;
    const seed = kit.composed.world.seed;
    const q = worldQuery(kit);
    const player = playerPosition?.() ?? null;
    for (const { a, rig } of scene.animals) {
      stepGround(a, dt, q, player);
      a.phase += (dt * a.v) / Math.max(0.15, rig.model.legLen * 1.6 * (1 + 0.3 * a.v)) / a.size;
      let look = 0;
      if (player && a.kind !== "ibis") {
        const d = Math.hypot(player.x - a.x, player.z - a.z);
        if (d < 5) {
          const rel = Math.atan2(player.x - a.x, player.z - a.z) - a.yaw;
          look = Math.max(-0.9, Math.min(0.9, Math.atan2(Math.sin(rel), Math.cos(rel))));
        }
      }
      poseAnimal(rig, a.kind, a.mode, a.phase, a.v, calm ? t * 0.6 : t, look, a.coat * 1.7 + a.homeX * 0.01);
      rig.root.position.set(a.x, hf.height(a.x, a.z), a.z);
      rig.root.rotation.y = a.yaw;
    }
    for (const f of scene.flocks) {
      const isBird = f.kind === "bird_flock";
      for (let i = 0; i < f.n; i++) {
        if (isBird) flockBird(f.home, i, seed, t, fly);
        else butterfly(f.home, i, seed, t, fly);
        const baseY = isBird ? f.ground : hf.height(fly.x, fly.z);
        eu.set(fly.pitch, fly.yaw, fly.roll, "YXZ");
        qv.setFromEuler(eu);
        const sc = isBird ? 1.1 : 1;
        m4.compose(pv.set(fly.x, baseY + fly.y, fly.z), qv, sv.set(sc, sc, sc));
        f.body.setMatrixAt(i, m4);
        const flap = fly.flap * (calm ? 0.4 : 1) * (isBird ? 0.75 : 1.1);
        m4b.makeRotationZ(flap).premultiply(m4);
        f.wingL.setMatrixAt(i, m4b);
        m4b.makeRotationZ(flap).premultiply(MIRROR).premultiply(m4);
        f.wingR.setMatrixAt(i, m4b);
      }
      f.body.instanceMatrix.needsUpdate = true;
      f.wingL.instanceMatrix.needsUpdate = true;
      f.wingR.instanceMatrix.needsUpdate = true;
    }
    const glowLevel = kit.rig.night ? 1 : kit.rig.sun.elevation < 8 ? 0.55 : 0.08;
    for (const s of scene.swarms) {
      const pos = s.points.geometry.attributes.position as THREE.BufferAttribute;
      const glow = s.points.geometry.attributes.glow as THREE.BufferAttribute;
      for (let i = 0; i < s.n; i++) {
        const g = firefly(s.home, i, seed, calm ? t * 0.5 : t, ff);
        pos.setXYZ(i, ff.x, hf.height(ff.x, ff.z) + ff.y, ff.z);
        glow.setX(i, g);
      }
      pos.needsUpdate = true;
      glow.needsUpdate = true;
      const mat = s.points.material as THREE.ShaderMaterial;
      mat.uniforms.uBright.value = glowLevel;
      mat.uniforms.uScale.value = state.size.height * 0.55;
    }
    for (const s of scene.schools) {
      s.paths.forEach((p, i) => {
        const f = fishAt(p, t);
        eu.set(0, f.yaw + 0.18 * Math.sin(t * (calm ? 3 : 8) + p.ph), 0, "YXZ");
        qv.setFromEuler(eu);
        m4.compose(pv.set(f.x, s.level - p.depth, f.z), qv, sv.set(p.size, p.size, p.size));
        s.mesh.setMatrixAt(i, m4);
      });
      s.mesh.instanceMatrix.needsUpdate = true;
    }
    if (onPositions && t - scene.pub > 0.25) {
      scene.pub = t;
      const out: { id: string; kind: WildlifeKind; x: number; y: number; z: number }[] = [];
      for (const { a } of scene.animals) if (WILDLIFE[a.kind].interactive) out.push({ id: a.id, kind: a.kind, x: a.x, y: hf.height(a.x, a.z), z: a.z });
      onPositions(out);
    }
  });

  return <group ref={holder} name="wildlife" />;
}

export function Wildlife(props: WildlifeProps) {
  const kit = useContext(WorldKitContext);
  if (!kit || props.list.length === 0) return null;
  return <WildlifeInner kit={kit} {...props} />;
}

// ------------------------------------------------------------------------------------------------ QA line-up

const LINEUP: [WildlifeKind, GroundMode, number][] = [
  ["cat", "sit", 0],
  ["cat", "walk", 1],
  ["cat", "groom", 2],
  ["dog", "walk", 0],
  ["goat", "graze", 1],
  ["goat", "walk", 0],
  ["ibis", "feed", 0],
  ["ibis", "walk", 0],
  ["camel", "walk", 0],
  ["camel", "lie", 2],
  ["horse", "idle", 0],
  ["horse", "walk", 1],
];

interface LineupEntry {
  rig: AnimalRig;
  kind: WildlifeKind;
  mode: GroundMode;
  phase: number;
  speed: number;
}

/** Every animal and behaviour side by side, walking in place, for /dev/kit3d?view=characters&anim=wildlife. */
export function WildlifeGallery() {
  const kit = useContext(WorldKitContext);
  const holder = useRef<THREE.Group>(null);
  const rigs = useRef<LineupEntry[]>([]);
  useLayoutEffect(() => {
    const host = holder.current;
    if (!host) return;
    const hf = kit?.composed.hf;
    const list: LineupEntry[] = [];
    let x = -6.5;
    for (const [kind, mode, coat] of LINEUP) {
      const rig = createAnimalRig(kind, coat);
      if (!rig) continue;
      const w = kind === "camel" ? 2.6 : kind === "horse" ? 2.2 : kind === "goat" ? 1.1 : 0.8;
      x += w / 2;
      const z = kind === "camel" || kind === "horse" ? -2.5 : 0.5;
      rig.root.position.set(x, hf ? hf.height(x, z) : 0, z);
      rig.root.rotation.y = 0.7;
      x += w / 2;
      host.add(rig.root);
      list.push({ rig, kind, mode, phase: coat * 0.3, speed: kind === "camel" ? 1.1 : kind === "horse" ? 1.3 : kind === "ibis" ? 0.35 : 0.7 });
    }
    rigs.current = list;
    return () => {
      for (const r of list) {
        host.remove(r.rig.root);
        r.rig.skeleton.dispose();
      }
      rigs.current = [];
    };
  }, [kit]);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    for (const r of rigs.current) {
      const v = r.mode === "walk" ? r.speed : 0;
      r.phase += (Math.min(0.1, dt) * v) / Math.max(0.15, r.rig.model.legLen * 1.6 * (1 + 0.3 * v));
      poseAnimal(r.rig, r.kind, r.mode, r.phase, v, t, 0, r.phase * 3);
    }
  });
  return <group ref={holder} name="wildlife-gallery" />;
}
