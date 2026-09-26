/**
 * src/game/hosts/expedition/contraptions/types.ts (W0, main) — the Phaser half of a contraption (docs/design/20 §2.5.5).
 * A prefab author writes `create(scene, phaser, props) → PoseView`; the host's ContraptionController (H1) wraps it in a
 * ContraptionInstance and drives it with the meta's pure functions. Phaser is imported as a TYPE only: the runtime
 * module arrives as the `phaser` argument (client-only, dynamically imported by the host).
 */
import type Phaser from "phaser";
import type { Encounter } from "../../../../contracts/gamespec";
import type {
  AidTier,
  AnyContraptionMeta,
  AnySandboxMeta,
  ContraptionMeta,
  Diagnosis,
  Draft,
  FailurePlan,
  HintRung,
  HintsUsed,
  HintTarget,
  ResolvedSandbox,
  ResolvedStation,
  SandboxDraft,
  SandboxMeta,
  SuccessPlan,
} from "../../../../world/types";

export type { ResolvedSandbox, ResolvedStation } from "../../../../world/types";

export interface XY {
  x: number;
  y: number;
}

/**
 * Palette tokens for Phaser drawing: token path ("stone.lit", "fn.f", "glow.cyan") → "#rrggbb". A1's
 * BIOME_PALETTES[ns] (src/game/art/palette.ts) is assignable to this; prefabs convert with `hex(...)`.
 */
export type BiomePalette = Readonly<Record<string, string>>;

/** A beam = three stacked lines (core 2, inner 6, outer 18) plus an end-cap glow and ±8 % shimmer (§2.2 fx/beam.ts). */
export interface BeamHandle {
  set(from: XY, to: XY): void;
  setAlpha(alpha: number): void;
  setColor(color: number): void;
  destroy(): void;
}
/** A window of pooled sprites along a strip (cell lipid heads, §2.11). */
export interface PooledStripHandle {
  update(cameraCenterX: number): void;
  destroy(): void;
}
/** Shared effects every prefab may use (implemented by H1 in fx/*.ts). */
export interface FxKit {
  /** baked radial glow sprite, ADD blend */
  glow(parent: Phaser.GameObjects.Container, at: XY, radius: number, color: number, alpha?: number): Phaser.GameObjects.Image;
  beam(parent: Phaser.GameObjects.Container, from: XY, to: XY, color: number): BeamHandle;
  /** one-shot particle burst preset ("sparks", "dust", "motes", "confetti_soft"); no-op when sensitiveSafe forbids it */
  burst(parent: Phaser.GameObjects.Container, at: XY, preset: string): void;
  /** desaturate (dormant) / re-saturate (awake) tween via ColorMatrix */
  dormancy(target: Phaser.GameObjects.GameObject, dormant: boolean, ms?: number): void;
  pooledStrip(parent: Phaser.GameObjects.Container, textureKey: string, spacing: number, y: number, count: number): PooledStripHandle;
}

export interface PrefabProps<Config> {
  station: ResolvedStation; // consoleX, anchor, skin, parsedConfig as Config, payoff, objectNoun
  config: Config; // = station.parsedConfig, typed
  encounter: Encounter;
  view: unknown;
  groundY: number; // heightAt(consoleSurface, consoleX)
  palette: BiomePalette; // src/game/art/palette.ts
  fx: FxKit; // glow(), beam(), burst(), dormancy(), pooledStrip()
  tex: (assetKey: string) => string; // asset key -> loaded texture key (throws in dev if missing)
  anchorsOf: (assetKey: string) => Readonly<Record<string, XY>>;
  seed: number; // spec.seed ^ hash32(encounterId): cosmetic randomness only
  reducedMotion: boolean;
}

export type ContraptionState = "dormant" | "awake" | "active" | "solved";

/** What a prefab author writes. The host wraps it in a ContraptionInstance (below). */
export interface PoseView<Pose> {
  root: Phaser.GameObjects.Container; // positioned at station.anchor
  /** named world points (container-local) used for chips, pins, hint targets, the console and the camera */
  anchors: Readonly<Record<string, XY>> & { console: XY };
  applyPose(pose: Pose): void; // every frame, with the EASED pose
  setState(state: ContraptionState): void;
  playSucceed(plan: SuccessPlan, pose: Pose): Promise<void>; // 1.2–2.5 s, ends in the solved pose
  playFail(plan: FailurePlan, pose: Pose): Promise<void>; // ≤ 1.6 s, ends back in the draft pose
  update?(dtMs: number): void; // cosmetic idle motion (shimmer, particles, cords)
  destroy(): void;
}
export interface ContraptionPrefab<Config = unknown, Pose = unknown, Sim = null> {
  meta: ContraptionMeta<Config, Pose, Sim>;
  create(scene: Phaser.Scene, phaser: typeof Phaser, props: PrefabProps<Config>): PoseView<Pose>;
}
export function definePrefab<Config, Pose, Sim>(p: ContraptionPrefab<Config, Pose, Sim>): ContraptionPrefab<Config, Pose, Sim> {
  return p;
}
/** One file per skin (prefabs/<id>/skins/<skin>.ts): it draws that skin's parts and applies the archetype's Pose.
    prefab.ts is `definePrefab({ meta, create: (s, p, props) => SKINS[props.station.skin].create(s, p, props) })`,
    with SKINS from the W0-written static skins/index.ts. A skin file imports its archetype's meta (Pose type) and
    shared.ts read-only, so it can be owned by a different lane than its core (§7). */
export interface SkinPrefab<Config = unknown, Pose = unknown> {
  skinId: string;
  create(scene: Phaser.Scene, phaser: typeof Phaser, props: PrefabProps<Config>): PoseView<Pose>;
}
/** Registry-level prefab type (heterogeneous configs/poses). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyContraptionPrefab = ContraptionPrefab<any, any, any>;

/** What the host sees per station (built by ContraptionController around a PoseView). */
export interface ContraptionInstance {
  readonly encounterId: string;
  bind(draft: Draft | null): void; // live updates; eases toward meta.pose(...)
  setAidTier(tier: AidTier, hintsUsed: HintsUsed): void;
  hint(rung: HintRung): readonly HintTarget[]; // returns the companion's flight plan
  succeed(): Promise<void>;
  fail(diagnosis: Diagnosis): Promise<void>;
  settleSolved(): void; // instant solved state (warp, autoSolve, re-entry): D3
  setState(state: ContraptionState): void;
  frameBounds(): { x: number; y: number; w: number; h: number }; // world units, for framing
  update(dtMs: number): void;
  debugState(): Record<string, number | string | boolean>;
  destroy(): void;
}

// ---------------------------------------------------------------- sandboxes (§2.4b, §2.5.5)

export interface SandboxPrefabProps<Config> {
  sandbox: ResolvedSandbox;
  config: Config;
  groundY: number;
  palette: BiomePalette;
  fx: FxKit;
  tex: (assetKey: string) => string;
  anchorsOf: (assetKey: string) => Readonly<Record<string, XY>>;
  seed: number;
  reducedMotion: boolean;
}
/** Sandbox prefabs use the same PoseView; their meta is a SandboxMeta and they receive SandboxPrefabProps. */
export interface SandboxPrefab<Config = unknown, Pose = unknown, Sim = null> {
  meta: SandboxMeta<Config, Pose, Sim>;
  create(scene: Phaser.Scene, phaser: typeof Phaser, props: SandboxPrefabProps<Config>): PoseView<Pose>;
}
export function defineSandboxPrefab<Config, Pose, Sim>(p: SandboxPrefab<Config, Pose, Sim>): SandboxPrefab<Config, Pose, Sim> {
  return p;
}
/** A sandbox skin file (prefabs/<sandbox id>/skins/<skin>.ts), dispatched the same way as SkinPrefab. */
export interface SandboxSkinPrefab<Config = unknown, Pose = unknown> {
  skinId: string;
  create(scene: Phaser.Scene, phaser: typeof Phaser, props: SandboxPrefabProps<Config>): PoseView<Pose>;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySandboxPrefab = SandboxPrefab<any, any, any>;
export interface SandboxInstance {
  readonly sandboxId: string;
  bind(draft: SandboxDraft | null): void;
  update(dtMs: number): void;
  frameBounds(): { x: number; y: number; w: number; h: number };
  debugState(): Record<string, number | string | boolean>;
  destroy(): void;
}

/** DOM fallback (amendment 31): no per-prefab component. Snapshot.tsx draws skin.snapshot parts at the anchor:
    dormant parts with `filter: saturate(0.6)`, solved parts saturated with a glow drop-shadow. */
export interface SnapshotProps {
  station: ResolvedStation;
  solved: boolean;
  assetUrl: (key: string) => string;
  scale: number;
}

export type { AnyContraptionMeta, AnySandboxMeta };
