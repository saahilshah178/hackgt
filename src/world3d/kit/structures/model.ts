import * as THREE from "three";
import type { ArchStyle, Material, StructureKind } from "../../../contracts/world3d";
import { STRUCTURES } from "../../core/catalog";
import { hashString, mulberry32, type Rng } from "../../core/prng";
import { GeoBuilder, triCount, type ModelPart, type V3 } from "./geom";
import { BUILDERS } from "./kinds";

/*
 * StructureModel: what one structure builder produces, pure data for the React side (./index.tsx) to render.
 *   parts   static geometry merged per material slot (a few draw calls per building)
 *   movers  sub-assemblies that animate: doors that swing open, a tomb seal that slides, a drawbridge leaf that lowers,
 *           windmill sails that spin, flags that sway, the pyramid's capstone that glows
 *   fires   flames (campfire, beacon, braziers, lighthouse lamp) with an optional point light
 * Models are cached per (kind, style, material class, scale bucket, seed % 4): a village of twelve houses shares four
 * geometries. The builder runs at the BUCKETED scale (so metre UVs stay true); the residual scale (within ±5 %) is applied
 * to the group by the renderer.
 */

export type MoverKind = "swing" | "slide" | "lower" | "spin" | "sway" | "glow";

export interface Mover {
  kind: MoverKind;
  /** pivot in model space (the parts are relative to it) */
  pivot: V3;
  parts: ModelPart[];
  /** swing: yaw when open; lower: pitch when CLOSED (raised); slide: offset when open; spin/sway: axis speed */
  amount: V3;
  /** state the mover shows when the structure is neither opened nor sealed (a plain gate stands open) */
  defaultOpen: boolean;
  /** spin: radians per second; sway: amplitude */
  speed?: number;
}

export interface FireSpot {
  x: number;
  y: number;
  z: number;
  /** flame height in metres */
  size: number;
  /** also cast a real point light (landmarks only, the renderer caps the count) */
  light: boolean;
  /** lit when the structure is not a seal target (ambient fires); seal targets light when opened */
  defaultLit: boolean;
  /** a steady lamp (lighthouse, lantern) rather than a flickering flame */
  lamp?: boolean;
}

export interface StructureModel {
  key: string;
  parts: ModelPart[];
  movers: Mover[];
  fires: FireSpot[];
  /** gently rocks on the water */
  bob: boolean;
  tris: number;
  bounds: THREE.Box3;
}

export interface BuildInput {
  kind: StructureKind;
  style: ArchStyle;
  material: Material;
  scale: number;
  seed: number;
}

/** What a kind builder sees: the builder, its unit size (catalog radius/height at this scale) and helpers. */
export interface Ctx {
  b: GeoBuilder;
  kind: StructureKind;
  style: ArchStyle;
  material: Material;
  /** the bucketed scale the geometry is built at */
  s: number;
  /** catalog footprint radius and height at scale s */
  r: number;
  h: number;
  variant: number;
  rng: Rng;
  /** material family: stone-like, timber, metal/glass or precious */
  matClass: MatClass;
  movers: Mover[];
  fires: FireSpot[];
  bob: boolean;
  /** build an animated sub-assembly around `pivot` (the parts are authored in model space) */
  mover(kind: MoverKind, pivot: V3, amount: V3, defaultOpen: boolean, fn: (b: GeoBuilder) => void, speed?: number): void;
  fire(x: number, y: number, z: number, size: number, opts?: Partial<Pick<FireSpot, "light" | "defaultLit" | "lamp">>): void;
}

export type MatClass = "stone" | "timber" | "metal" | "precious";

export function matClassOf(m: Material): MatClass {
  if (m === "wood" || m === "thatch") return "timber";
  if (m === "metal" || m === "glass" || m === "ice" || m === "crystal") return "metal";
  if (m === "gold") return "precious";
  return "stone";
}

/** Log-spaced scale buckets (≈9 % apart): the residual scale stays within ±4.5 %. */
export function scaleBucket(scale: number): number {
  const s = Math.max(0.05, scale);
  return Math.pow(2, Math.round(Math.log2(s) * 8) / 8);
}

export type KindBuilder = (c: Ctx) => void;

const cache = new Map<string, StructureModel>();

export function modelKey(i: BuildInput): string {
  const variant = (i.seed >>> 0) % 4;
  return `${i.kind}|${i.style}|${i.material}|${scaleBucket(i.scale).toFixed(4)}|${variant}`;
}

/** Build (or fetch from the cache) the model for one placed structure. */
export function structureModel(i: BuildInput): StructureModel {
  const key = modelKey(i);
  const hit = cache.get(key);
  if (hit) return hit;
  const m = buildModel(i, key);
  cache.set(key, m);
  return m;
}

export function clearModelCache() {
  for (const m of cache.values()) disposeModel(m);
  cache.clear();
}

export function disposeModel(m: StructureModel) {
  for (const p of m.parts) p.geometry.dispose();
  for (const mv of m.movers) for (const p of mv.parts) p.geometry.dispose();
}

function buildModel(i: BuildInput, key: string): StructureModel {
  const s = scaleBucket(i.scale);
  const info = STRUCTURES[i.kind];
  const variant = (i.seed >>> 0) % 4;
  const b = new GeoBuilder();
  const movers: Mover[] = [];
  const fires: FireSpot[] = [];
  const ctx: Ctx = {
    b,
    kind: i.kind,
    style: i.style,
    material: i.material,
    s,
    r: info.radius * s,
    h: info.height * s,
    variant,
    rng: mulberry32(hashString(`${i.kind}:${i.style}:${variant}`)),
    matClass: matClassOf(i.material),
    movers,
    fires,
    bob: false,
    mover(kind, pivot, amount, defaultOpen, fn, speed) {
      const sub = new GeoBuilder();
      sub.with(new THREE.Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]), () => fn(sub));
      movers.push({ kind, pivot, amount, defaultOpen, parts: sub.build(), speed });
    },
    fire(x, y, z, size, opts = {}) {
      fires.push({ x, y, z, size, light: opts.light ?? true, defaultLit: opts.defaultLit ?? true, lamp: opts.lamp });
    },
  };
  BUILDERS[i.kind](ctx);
  const parts = b.build();
  const bounds = new THREE.Box3();
  for (const p of parts) if (p.geometry.boundingBox) bounds.union(p.geometry.boundingBox);
  for (const mv of movers) {
    for (const p of mv.parts) {
      if (!p.geometry.boundingBox) continue;
      const bb = p.geometry.boundingBox.clone().translate(new THREE.Vector3(...mv.pivot));
      bounds.union(bb);
    }
  }
  return { key, parts, movers, fires, bob: ctx.bob, tris: triCount(parts) + movers.reduce((n, mv) => n + triCount(mv.parts), 0), bounds };
}
