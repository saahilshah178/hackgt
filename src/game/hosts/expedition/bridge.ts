/**
 * src/game/hosts/expedition/bridge.ts (W0, main-owned) — the typed scene ↔ React bridge (docs/design/20 §2.2).
 * Replaces the legacy hosts' duck-typed `setFrozen` lookup.
 *   - SceneApi: what React (ExpeditionHost's effects and HostHandle) calls on the running scene. H1 implements it.
 *   - SceneEvents: what the scene emits back to React. ExpeditionHost adapts it to HostProps callbacks.
 *   - CutsceneStage: the verbs the cutscene runner (S1, cutscene/runner.ts) drives; H1 implements them in the scene,
 *     so the runner and the scene are written independently against this file.
 * Types only (plus nothing at runtime): safe to import from anywhere in the host.
 */
import type { GameSpec } from "../../../contracts/gamespec";
import type { CameraShot, CutsceneStep, InteractRef, MusicCue, Point, StateTarget } from "../../../contracts/world";
import type { AidTier, Diagnosis, Draft, HintRung, HintsUsed, ResolvedWorld, SandboxDraft, WorldState } from "../../../world/types";
import type { SayRequest } from "../../expedition/dialogue/types";
import type { ExpeditionHostDebug, ExpeditionProgress, HostEvent, InteractTarget, LayoutState } from "../types";

export type EmoteGlyph = Extract<CutsceneStep, { do: "emote" }>["glyph"];
export type StationAnim = Extract<CutsceneStep, { do: "station" }>["anim"];
export type HubState = Extract<CutsceneStep, { do: "hub" }>["state"];
export type CameraEase = Extract<CutsceneStep, { do: "camera" }>["ease"];

/** The final world state a cutscene leaves behind (cutscene/timeline.ts `endState`); `skip()` applies it at once. */
export interface CutsceneEndState {
  zone: { zoneId: string; x: number; surface: string } | null; // where the player stands (null: unchanged)
  actors: Readonly<Record<string, number>>; // actor id ("companion", npc ids) → final x
  camera: { x: number | null; y: number | null; zoom: number | null } | null;
  stationAnims: Readonly<Record<string, StationAnim>>; // encounterId → last anim
  hubs: Readonly<Record<string, HubState>>; // zoneId → state
  flags: Readonly<Record<string, boolean>>; // set_state {kind: "flag"}
  states: readonly { target: StateTarget; state: string }[]; // other set_state targets, in order
  music: MusicCue | null | undefined; // undefined: unchanged
}

/** The verbs of CutsceneStep (§1.3, §2.8) as scene operations. Promises resolve when the step is complete. */
export interface CutsceneStage {
  fade(to: "black" | "clear" | "white", ms: number): Promise<void>;
  /** the title card renders in React (SceneEvents.onTitle); resolves after ms */
  title(text: string, sub: string | null, ms: number): Promise<void>;
  enterZone(zoneId: string, x: number, surface: string): Promise<void>;
  pan(x: number, y: number | null, zoom: number, ms: number): Promise<void>;
  camera(x: number | null, y: number | null, zoom: number | null, ms: number, ease: CameraEase): Promise<void>;
  walk(actor: string, toX: number): Promise<void>; // "player" | "companion" | an npc id
  emote(actor: string, glyph: EmoteGlyph): void;
  station(encounterId: string, anim: StationAnim): Promise<void>;
  hub(zoneId: string, state: HubState): Promise<void>; // plays Hub.anims[state] when set
  ride(step: { vehicle: string; toZoneId: string; toX: number; toSurface: string; ms: number; path: readonly Point[] }): Promise<void>;
  sfx(cue: string): void;
  music(cue: MusicCue | null): void;
  awaitInteract(target: InteractRef, prompt: string, timeoutMs: number | null): Promise<void>;
  controlUntil(x: number, surface: string, prompt: string | null, timeoutMs: number): Promise<void>;
  vista(asset: string, from: CameraShot, to: CameraShot, ms: number, holdMs: number): Promise<void>;
  setState(target: StateTarget, state: string): void;
  /** skip(): jump straight to a cutscene's end state (and cancel any running step) */
  applyEndState(end: CutsceneEndState): void;
}

/** What React calls on the running scene. ExpeditionHost pushes props through the setters (never a remount). */
export interface SceneApi {
  // ---- prop pushes (effects in ExpeditionHost)
  setFrozen(frozen: boolean): void;
  setProgress(progress: ExpeditionProgress): void;
  setLayout(layout: LayoutState): void;
  setWorldState(state: WorldState): void;
  setMeterValue(value: number | null): void;
  setExpress(on: boolean): void;
  // ---- HostHandle (§2.10)
  warpTo(encounterId: string | null): void;
  bindDraft(encounterId: string, draft: Draft | null): void;
  setAidTier(encounterId: string, tier: AidTier, hintsUsed: HintsUsed): void;
  onHint(encounterId: string, rung: HintRung): void;
  resolveEncounter(encounterId: string, diagnosis: Diagnosis): Promise<void>;
  openSandbox(sandboxId: string): void;
  bindSandboxDraft(sandboxId: string, draft: SandboxDraft | null): void;
  closeSandbox(): void;
  playCutscene(id: string): Promise<void>;
  skipCutscene(): void;
  walkTo(x: number, surface?: string): Promise<void>;
  useLink(linkId: string): Promise<void>;
  debug(): ExpeditionHostDebug;
  // ---- cutscene verbs, for the runner
  stage: CutsceneStage;
  destroy(): void;
}

/** What the scene emits. `say` returns the dialogue engine's promise so cutscene `say` steps can wait for it. */
export interface SceneEvents {
  onEvent(e: HostEvent): void;
  onInteract(target: InteractTarget): void;
  say(req: SayRequest): Promise<void> | void;
  onTitle(title: { text: string; sub: string | null; ms: number } | null): void;
}

/** Scene init data (ExpeditionScene `init`). */
export interface ExpeditionSceneData {
  spec: GameSpec;
  world: ResolvedWorld;
  progress: ExpeditionProgress;
  layout: LayoutState;
  worldState: WorldState;
  meterValue: number | null;
  express: boolean;
  reducedMotion: boolean;
  events: SceneEvents;
  onReady(api: SceneApi): void;
}
