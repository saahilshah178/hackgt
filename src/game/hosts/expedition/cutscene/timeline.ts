/**
 * src/game/hosts/expedition/cutscene/timeline.ts (S1, pure) — cutscene compile, end state and express trim
 * (docs/design/20 §2.8). The runner (runner.ts) executes steps against the scene's `CutsceneStage` (bridge.ts);
 * `skip()` applies `endState` at once, which must equal the state a full play leaves behind (tested per verb).
 *
 * Camera convention: a null camera field means "follow the player" (cutscenes start from explore, where the camera
 * follows); `enter_zone` and `ride` reset the camera to follow. `CutsceneEndState.camera === null` means no step
 * touched the camera. The player's position lives in `zone` once a zone is known (from `start`, `enter_zone` or
 * `ride`); otherwise a player walk is recorded as `actors.player`.
 */
import type { Cutscene, CutsceneStep } from "../../../../contracts/world";
import { DEFAULT_CPS, DEFAULT_MIN_TOAST_MS } from "../../../expedition/dialogue/types";
import { toastDurationMs, typingMs } from "../../../expedition/dialogue/engine";
import type { CutsceneEndState } from "../bridge";

export const WALK_SPEED = 300; // units/s (§2.4.1)
export const STATION_ANIM_MS: Readonly<Record<"wake" | "succeed" | "settle", number>> = { wake: 1200, succeed: 1800, settle: 600 };
export const HUB_MS = 800;
export const EMOTE_MS = 600;
export const ENTER_ZONE_MS = 900; // the transition wipe
export const DEFAULT_WALK_MS = 1000; // a walk whose start x is unknown

export interface PlayerStart {
  zoneId: string;
  x: number;
  surface: string;
}

export interface TimedStep {
  index: number;
  step: CutsceneStep;
  /** estimated start (ms from the cutscene start) */
  startMs: number;
  /** fixed duration, or null: until resolved (say, await_interact, control_until) */
  durationMs: number | null;
  /** estimate used for startMs and progress bars (say: typing + read time; interactive: the timeout) */
  estMs: number;
  interactive: boolean;
}

export interface CompileCtx {
  /** actor → x at the start ("player", "companion", npc ids); unknown actors walk for DEFAULT_WALK_MS */
  positions?: Readonly<Record<string, number>>;
  cps?: number;
}

function sayEstimate(lines: readonly { text: string }[], cps: number): number {
  return lines.reduce((ms, l) => ms + typingMs(l.text, cps) + toastDurationMs(l.text, DEFAULT_MIN_TOAST_MS), 0);
}

/** Steps with estimated times. Walk time = distance ÷ walk speed; say and interactive steps last until resolved. */
export function compile(c: Cutscene, ctx: CompileCtx = {}): TimedStep[] {
  const cps = ctx.cps ?? DEFAULT_CPS;
  const pos = new Map<string, number>(Object.entries(ctx.positions ?? {}));
  const out: TimedStep[] = [];
  let t = 0;
  c.steps.forEach((step, index) => {
    let durationMs: number | null;
    let interactive = false;
    switch (step.do) {
      case "fade":
      case "title":
      case "pan":
      case "camera":
      case "wait":
      case "ride":
        durationMs = step.ms;
        break;
      case "vista":
        durationMs = step.ms + step.holdMs;
        break;
      case "enter_zone":
        durationMs = ENTER_ZONE_MS;
        pos.set("player", step.x);
        break;
      case "walk": {
        const from = pos.get(step.actor);
        durationMs = from === undefined ? DEFAULT_WALK_MS : Math.round((Math.abs(step.toX - from) / WALK_SPEED) * 1000);
        pos.set(step.actor, step.toX);
        break;
      }
      case "emote":
        durationMs = EMOTE_MS;
        break;
      case "station":
        durationMs = STATION_ANIM_MS[step.anim];
        break;
      case "hub":
        durationMs = HUB_MS;
        break;
      case "sfx":
      case "music":
      case "set_state":
        durationMs = 0;
        break;
      case "say":
        durationMs = null;
        break;
      case "await_interact":
        durationMs = null;
        interactive = true;
        break;
      case "control_until":
        durationMs = null;
        interactive = true;
        pos.set("player", step.x);
        break;
    }
    if (step.do === "ride") pos.set("player", step.toX);
    const estMs =
      durationMs ??
      (step.do === "say"
        ? sayEstimate(step.lines, cps)
        : step.do === "await_interact"
          ? (step.timeoutMs ?? 0)
          : step.do === "control_until"
            ? step.timeoutMs
            : 0);
    out.push({ index, step, startMs: t, durationMs, estMs, interactive });
    t += estMs;
  });
  return out;
}

/** Express (§0.1.5): keep the steps up to and including the first `say`; `skip()` then applies the end state. */
export function expressTrim(steps: readonly TimedStep[]): TimedStep[] {
  const i = steps.findIndex((s) => s.step.do === "say");
  return i < 0 ? [...steps] : steps.slice(0, i + 1);
}

// ---------------------------------------------------------------- end state

/** A mutable accumulator for folding steps (readonly on the way out). */
interface EndAcc {
  zone: { zoneId: string; x: number; surface: string } | null;
  actors: Record<string, number>;
  camera: { x: number | null; y: number | null; zoom: number | null } | null;
  stationAnims: Record<string, CutsceneEndState["stationAnims"][string]>;
  hubs: Record<string, CutsceneEndState["hubs"][string]>;
  flags: Record<string, boolean>;
  states: CutsceneEndState["states"][number][];
  music: CutsceneEndState["music"];
}

export function emptyEndState(start?: PlayerStart | null): CutsceneEndState {
  return {
    zone: start ? { ...start } : null,
    actors: {},
    camera: null,
    stationAnims: {},
    hubs: {},
    flags: {},
    states: [],
    music: undefined,
  };
}

function movePlayer(acc: EndAcc, x: number, surface: string | null): void {
  if (acc.zone) acc.zone = { ...acc.zone, x, surface: surface ?? acc.zone.surface };
  else acc.actors.player = x;
}

/** One step's effect on the end state (the same semantics the runner's stage calls produce). */
export function reduceEndState(prev: CutsceneEndState, step: CutsceneStep): CutsceneEndState {
  const acc: EndAcc = {
    zone: prev.zone,
    actors: { ...prev.actors },
    camera: prev.camera,
    stationAnims: { ...prev.stationAnims },
    hubs: { ...prev.hubs },
    flags: { ...prev.flags },
    states: [...prev.states],
    music: prev.music,
  };
  switch (step.do) {
    case "enter_zone":
      acc.zone = { zoneId: step.zoneId, x: step.x, surface: step.surface };
      delete acc.actors.player;
      acc.camera = { x: null, y: null, zoom: null };
      break;
    case "ride":
      acc.zone = { zoneId: step.toZoneId, x: step.toX, surface: step.toSurface };
      delete acc.actors.player;
      acc.camera = { x: null, y: null, zoom: null };
      break;
    case "walk":
      if (step.actor === "player") movePlayer(acc, step.toX, null);
      else acc.actors[step.actor] = step.toX;
      break;
    case "control_until":
      movePlayer(acc, step.x, step.surface);
      break;
    case "pan":
      acc.camera = { x: step.x, y: step.y ?? acc.camera?.y ?? null, zoom: step.zoom };
      break;
    case "camera":
      acc.camera = {
        x: step.x ?? acc.camera?.x ?? null,
        y: step.y ?? acc.camera?.y ?? null,
        zoom: step.zoom ?? acc.camera?.zoom ?? null,
      };
      break;
    case "station":
      acc.stationAnims[step.encounterId] = step.anim;
      break;
    case "hub":
      acc.hubs[step.zoneId] = step.state;
      break;
    case "set_state":
      if (step.target.kind === "flag") acc.flags[step.target.id] = step.state === "on";
      else acc.states.push({ target: step.target, state: step.state });
      break;
    case "music":
      acc.music = step.cue;
      break;
    case "fade":
    case "title":
    case "say":
    case "emote":
    case "wait":
    case "sfx":
    case "await_interact":
    case "vista":
      break;
  }
  return acc;
}

/** The final world state of a cutscene: zone, positions, station anims, hubs, flags, prop states, camera, music. */
export function endState(c: Cutscene, start?: PlayerStart | null): CutsceneEndState {
  return c.steps.reduce(reduceEndState, emptyEndState(start));
}

/** The end state of the steps from `fromIndex` on, folded over an already-reached state (skip mid-way). */
export function remainingEndState(c: Cutscene, fromIndex: number, reached: CutsceneEndState): CutsceneEndState {
  return c.steps.slice(fromIndex).reduce(reduceEndState, reached);
}
