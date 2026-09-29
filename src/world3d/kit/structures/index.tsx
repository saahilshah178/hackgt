"use client";

import { useFrame } from "@react-three/fiber";
import { memo, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { ArchStyle, Material } from "../../../contracts/world3d";
import type { Placed, Special } from "../../core/compose";
import { WorldKitContext } from "../context";
import { getWorldMaterial } from "../materials";
import { capstoneGlowMaterial, Flame, rimMaterial, tickFx } from "./fx";
import type { ModelPart, Slot } from "./geom";
import { scaleBucket, structureModel, type Mover } from "./model";
import { slotMaterial, type SlotContext } from "./palette";
import { cropLayout, cropPlantGeometry, fieldsGeometry, quarryGeometry } from "./specials";

/*
 * Structure rendering. API (stable): <Structure placed opened highlight />, <Structures list opened />,
 * <SpecialPiece special />.
 *
 * A structure is its cached StructureModel (./model.ts, one builder per kind in ./kinds) drawn as one mesh per material
 * slot (a few draw calls), plus its movers and fires:
 *   - swing / slide / lower movers (gate doors, the tomb seal, a drawbridge leaf) ease between closed and open. A
 *     structure that some moment `opens` (a seal target) stays closed until `opened`; others show their default state.
 *   - spin (windmill sails) and sway (pennants) run continuously, slowed right down under reduced motion.
 *   - glow movers (the pyramidion) switch to a pulsing gilded glow when the structure is the goal or has been opened.
 *   - fires flicker (ambient ones are lit unless the structure is a seal target, which lights when opened); landmark
 *     fires also get a point light, pieces only a fake ground glow.
 * `highlight` adds a soft additive fresnel rim so the structure reads as interactive. Boats rock on the water.
 * Geometry and materials are shared (cached), so meshes opt out of R3F's auto-dispose.
 */

export interface StructureProps {
  placed: Placed;
  /** its seal/gate/bridge has been opened by a solved moment */
  opened?: boolean;
  /** the player is in reach of it (subtle rim light / outline) */
  highlight?: boolean;
}

const ease = (t: number) => t * t * (3 - 2 * t);
const RIM_SLOTS: ReadonlySet<Slot> = new Set(["main", "main2", "trim", "roof", "wood", "thatch", "metal", "paint"]);

function Parts({ parts, ctx, glow = false }: { parts: readonly ModelPart[]; ctx: SlotContext; glow?: boolean }) {
  return (
    <>
      {parts.map((p) => (
        <mesh key={p.slot} geometry={p.geometry} material={glow ? capstoneGlowMaterial() : slotMaterial(p.slot, ctx)} castShadow={p.slot !== "glow" && p.slot !== "dark"} receiveShadow dispose={null} />
      ))}
    </>
  );
}

function MoverView({ mover, open, calm, glow, ctx }: { mover: Mover; open: boolean; calm: boolean; glow: boolean; ctx: SlotContext }) {
  const ref = useRef<THREE.Group>(null);
  const progress = useRef(open ? 1 : 0);
  const phase = mover.pivot[0] * 1.7 + mover.pivot[2] * 0.9;
  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    switch (mover.kind) {
      case "swing":
      case "slide":
      case "lower": {
        const target = open ? 1 : 0;
        const speed = calm ? 4 : 0.55;
        const d = target - progress.current;
        progress.current += Math.sign(d) * Math.min(Math.abs(d), dt * speed);
        const e = ease(progress.current);
        if (mover.kind === "swing") g.rotation.y = mover.amount[1] * e;
        else if (mover.kind === "lower") g.rotation.x = mover.amount[0] * (1 - e);
        else g.position.set(mover.pivot[0] + mover.amount[0] * e, mover.pivot[1] + mover.amount[1] * e, mover.pivot[2] + mover.amount[2] * e);
        break;
      }
      case "spin":
        g.rotation.z -= dt * (mover.speed ?? 0.5) * (calm ? 0.2 : 1);
        break;
      case "sway":
        g.rotation.y = mover.amount[1] * (calm ? 0.2 : 1) * Math.sin(t * 1.6 + phase);
        g.rotation.z = 0.04 * (calm ? 0.2 : 1) * Math.sin(t * 2.3 + phase);
        break;
      case "glow":
        if (glow) tickFx(t, calm);
        break;
    }
  });
  return (
    <group ref={ref} position={mover.pivot}>
      <Parts parts={mover.parts} ctx={ctx} glow={mover.kind === "glow" && glow} />
    </group>
  );
}

function Bob({ calm, seed, children }: { calm: boolean; seed: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const phase = (seed % 97) * 0.37;
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime + phase;
    const k = calm ? 0.25 : 1;
    g.position.y = Math.sin(t * 0.9) * 0.07 * k;
    g.rotation.z = Math.sin(t * 0.63) * 0.035 * k;
    g.rotation.x = Math.sin(t * 0.77 + 1.1) * 0.018 * k;
  });
  return <group ref={ref}>{children}</group>;
}

function FxTicker({ calm }: { calm: boolean }) {
  useFrame((state) => tickFx(state.clock.elapsedTime, calm));
  return null;
}

export const Structure = memo(function Structure({ placed, opened = false, highlight = false }: StructureProps) {
  const kit = useContext(WorldKitContext);
  const model = useMemo(
    () => structureModel({ kind: placed.kind, style: placed.style, material: placed.material, scale: placed.scale, seed: placed.seed }),
    [placed.kind, placed.style, placed.material, placed.scale, placed.seed],
  );
  const moments = kit?.composed.world.moments;
  const sealed = useMemo(() => (moments ?? []).some((m) => m.opens === placed.id), [moments, placed.id]);
  const calm = kit?.reducedMotion ?? false;
  const lights = (kit?.quality ?? "high") !== "low" && placed.role !== "piece";
  const ctx = useMemo<SlotContext>(() => ({ material: placed.material, style: placed.style, seed: placed.seed }), [placed.material, placed.style, placed.seed]);
  const residual = placed.scale / scaleBucket(placed.scale);
  const glow = placed.role === "goal" || opened;
  const content = (
    <>
      <Parts parts={model.parts} ctx={ctx} />
      {model.movers.map((mv, i) => (
        <MoverView key={i} mover={mv} open={opened || (!sealed && mv.defaultOpen)} calm={calm} glow={glow} ctx={ctx} />
      ))}
      {model.fires.map((f, i) => (
        <group key={`fire${i}`} position={[f.x, f.y, f.z]}>
          <Flame size={f.size} lit={f.defaultLit ? opened || !sealed : opened} light={lights && f.light} lamp={f.lamp} calm={calm} groundY={f.y < 1.5 ? -f.y : null} />
        </group>
      ))}
      {highlight && (
        <>
          <FxTicker calm={calm} />
          {model.parts
            .filter((p) => RIM_SLOTS.has(p.slot))
            .map((p) => (
              <mesh key={`rim-${p.slot}`} geometry={p.geometry} material={rimMaterial()} renderOrder={3} dispose={null} />
            ))}
        </>
      )}
    </>
  );
  return (
    <group position={[placed.x, placed.y, placed.z]} rotation={[0, placed.rotation, 0]} name={`structure:${placed.id}`}>
      <group scale={residual}>{model.bob ? <Bob calm={calm} seed={placed.seed}>{content}</Bob> : content}</group>
    </group>
  );
});

export function Structures({ list, opened }: { list: readonly Placed[]; opened?: ReadonlySet<string> }) {
  return (
    <>
      {list.map((p) => (
        <Structure key={p.id} placed={p} opened={opened?.has(p.id) ?? false} />
      ))}
    </>
  );
}

// ------------------------------------------------------------------------------------------------ special pieces

const CROP_DENSITY = { low: 0.3, medium: 0.6, high: 1 } as const;

function Crops({ special, density }: { special: Special; density: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const layout = useMemo(() => cropLayout(special.halfW, special.halfD, special.seed, density), [special.halfW, special.halfD, special.seed, density]);
  const count = layout.length / 4;
  const geometry = cropPlantGeometry();
  // a pale, double-sided base: the per-plant instance colour carries the green-to-ripe hue
  const material = getWorldMaterial("plaster", { side: THREE.DoubleSide, tint: "#f4f7ee" });
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const green = new THREE.Color("#5f9a3a");
    const ripe = new THREE.Color("#cdb86a");
    const c = new THREE.Color();
    const ripeness = (special.seed % 5) / 8;
    for (let i = 0; i < count; i++) {
      const x = layout[i * 4];
      const z = layout[i * 4 + 1];
      const yaw = layout[i * 4 + 2];
      const s = layout[i * 4 + 3];
      p.set(x, 0.08, z);
      q.setFromAxisAngle(up, yaw);
      sc.set(s, s * (0.8 + ripeness * 0.4), s);
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
      const k = Math.min(1, Math.max(0, ripeness + Math.sin(x * 0.4 + z * 0.3) * 0.2 + ((i * 7919) % 100) / 500));
      c.copy(green).lerp(ripe, k);
      mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [layout, count, special.seed]);
  if (count === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, count]} castShadow={false} receiveShadow frustumCulled dispose={null} />;
}

export function SpecialPiece({ special }: { special: Special }) {
  const kit = useContext(WorldKitContext);
  const quality = kit?.quality ?? "high";
  const style: ArchStyle = kit?.composed.world.setting.style ?? "ancient_egypt";
  const parts = useMemo(
    () => (special.kind === "fields" ? fieldsGeometry(special.halfW, special.halfD, special.seed) : quarryGeometry(Math.min(special.halfW, special.halfD), special.seed)),
    [special.kind, special.halfW, special.halfD, special.seed],
  );
  const material: Material = special.kind === "quarry" ? "limestone" : "adobe";
  const ctx = useMemo<SlotContext>(() => ({ material, style, seed: special.seed }), [material, style, special.seed]);
  return (
    <group position={[special.x, special.y, special.z]} rotation={[0, special.rotation, 0]} name={`special:${special.id}`}>
      <Parts parts={parts} ctx={ctx} />
      {special.kind === "fields" && <Crops special={special} density={CROP_DENSITY[quality]} />}
    </group>
  );
}
