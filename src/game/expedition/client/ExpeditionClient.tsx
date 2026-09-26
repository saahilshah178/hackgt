"use client";
/**
 * src/game/expedition/client/ExpeditionClient.tsx (H2) — the Expedition game client (docs/design/20 §2.1, §2.9, §3.4).
 *
 *   useRunner(spec)          EncounterRunner + a view memoized per encounter (D5)
 *   reduce (machine.ts)      the pure phase machine (D1, D2, D3, D9)
 *   world state              flags / collected / touched / talked / fired / sandbox goals (src/world/state)
 *   DialogueEngine           S1's engine (external store) + StationSlotFlow for the station slots
 *   AudioBus                 S1's procedural cue bank (EXPEDITION_SFX, ?mute=1, N)
 *   <ExpeditionLayout>       PlayHost (→ ExpeditionHost | ExpeditionDomHost) + Hud + InstrumentPanel + DialogueBar
 *   express.ts               ?express=1: walk → interact, trimmed cutscenes, auto-advancing lines
 *
 * Drafts flow control → onDraft → a ref (no re-render) → host.bindDraft. World state always follows runner progress
 * (the host's `progress` prop), so skipTo/autoSolve (DEBUG_SYNC) stay consistent without animating (D3). The progress
 * the HOST sees lags the runner by exactly the success animation, so the world restores after the contraption
 * celebrates, not before. Callbacks handed to the host are stable and read the latest state through refs.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type Ref } from "react";
import type { GameSpec } from "../../../contracts/gamespec";
import type { Cutscene } from "../../../contracts/world";
import { aidTierOf, toHintsUsed } from "../../../world/aid-tier";
import { diagnose } from "../../../world/diagnose";
import { fromSubmitInput } from "../../../world/draft-inputs";
import { failLines } from "../../../world/fail-line";
import { mirrorBonus, type KeyValueStore } from "../../../world/state/bonus";
import { settleQuests } from "../../../world/state/quests";
import { emptyWorldState, reduceAll as reduceWorldEvents, worldStateDebug } from "../../../world/state/world-state";
import type { Diagnosis, Draft, HintRung, ModeKey, ResolvedStation, ResolvedWorld, SandboxDraft, WorldState, WorldStateEvent } from "../../../world/types";
import { installGameDebug, type ExpeditionDebugApi, type GameDebugHandle } from "../../debug";
import { getPalette } from "../../engine/palettes";
import type { ExpeditionHostHandle } from "../../hosts/expedition/ExpeditionHost";
import { triggerEffects } from "../../hosts/expedition/scene/triggers";
import { PlayHost } from "../../hosts/PlayHost";
import type { HostEvent, HostHandle, InteractTarget, LayoutState, RoomPlacement } from "../../hosts/types";
import { EndScreen } from "../../systems/EndScreen";
import { AudioBus, sfxEnabled } from "../audio/bus";
import { useAudioUnlock } from "../audio/useAudioBus";
import { DialogueBar } from "../dialogue/DialogueBar";
import { DialogueEngine } from "../dialogue/engine";
import { sayRequest } from "../dialogue/lines";
import { arenaSay, bossPhaseSay, StationSlotFlow } from "../dialogue/station-dialogue";
import type { SayRequest } from "../dialogue/types";
import { Hud } from "../hud/Hud";
import { meterValue as meterValueOf } from "../hud/objective";
import { Journal, type JournalItem } from "../journal/Journal";
import { BriefSheet } from "../panel/BriefSheet";
import { fromDraftInput as binsFromDraft } from "../panel/controls/bins.logic";
import { resolveControlKind } from "../panel/controls/kinds";
import { InstrumentPanel, type InstrumentPanelHandle } from "../panel/InstrumentPanel";
import { panelStationOf, type PanelDraft } from "../panel/types";
import { atConsole, expressAdvanceDelay, expressAllows, expressTrims, nextExpressAction, type PlayerSpot } from "./express";
import { ExpeditionLayout, layoutStyles } from "./ExpeditionLayout";
import { planInteract } from "./interactions";
import { cutsceneOf, encounterOf, hostFrozen, INITIAL_PHASE, panelVisible, reduce, type CutscenePurpose, type Phase } from "./machine";
import { SandboxPanel } from "./SandboxPanel";
import {
  barLayoutOf,
  bossBatchToSay,
  briefOf,
  expressWorldOf,
  hintLabelOf,
  hudModeOf,
  layoutModeOf,
  outroFor,
  panelContextOf,
  progressOf,
  safeRectFor,
  startZoneOf,
  zoneNameOf,
} from "./session";
import { useRunner } from "./useRunner";

export interface ExpeditionClientProps {
  spec: GameSpec;
  world: ResolvedWorld;
  /** EXPEDITION_SFX ≠ off (the play page passes it); `?mute=1` and the N toggle silence it too */
  sfx?: boolean;
}

const NO_ROOMS: RoomPlacement[] = [];
/** Minimum spacing between host warps (a zone swap is a 280 ms wipe + load + reveal). */
const WARP_SPACING_MS = 700;
/** The payoff badge shows 1.6 s; if the panel never reports it (unmounted, reduced motion), move on anyway. */
const PAYOFF_FALLBACK_MS = 2600;

interface PendingCutscene {
  id: string;
  purpose: CutscenePurpose;
  encounterId?: string;
  before?: SayRequest | null;
}

/** Host events the host sends before HostEvent carries them (TODO(w1): outside diff for src/game/hosts/types.ts). */
type ExtraHostEvent =
  | { type: "flag"; id: string; on: boolean }
  | { type: "sandbox_goal"; sandboxId: string; goal: string }
  | { type: "cue"; cue: string }
  | { type: "music"; cue: string | null };
type AnyHostEvent = HostEvent | ExtraHostEvent;

function searchFlag(name: string): boolean {
  try {
    const v = new URLSearchParams(window.location.search).get(name);
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}
function sessionStore(): KeyValueStore | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
const noop = () => {};

function subscribeReducedMotion(fn: () => void): () => void {
  try {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  } catch {
    return noop;
  }
}
function reducedMotionNow(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** The fallback diagnosis when `diagnose` has no mirror for a mode (the grade still decides; nothing reacts per item). */
function plainDiagnosis(correct: boolean, feedback: string): Diagnosis {
  return { correct, feedback, displayFeedback: feedback, failKey: null, wrongKeys: [], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [] };
}

export function ExpeditionClient({ spec, world, sfx = true }: ExpeditionClientProps) {
  const overlay = world.overlay;
  const guideId = overlay.cast.guide.characterId;
  const hasCutscene = (id: string | null | undefined): id is string => !!id && overlay.cutscenes.some((c: Cutscene) => c.id === id);
  const introId = hasCutscene(overlay.story.introCutsceneId) ? overlay.story.introCutsceneId : null;
  const finaleId = hasCutscene(overlay.story.finaleCutsceneId) ? overlay.story.finaleCutsceneId : null;
  const expressWorld = useMemo(() => expressWorldOf(world), [world]);
  const palette = useMemo(() => getPalette(spec.theme.paletteId), [spec.theme.paletteId]);

  // ------------------------------------------------------------------ state
  const { runner, snap, sync } = useRunner(spec);
  const [phase, dispatch] = useReducer(reduce, INITIAL_PHASE);
  const [ws, setWs] = useState<WorldState>(() => emptyWorldState());
  /** the runner index the HOST shows (null: finished); lags the runner during the success animation */
  const [shownIndex, setShownIndex] = useState<number | null>(0);
  const progress = useMemo(() => progressOf(spec, shownIndex), [spec, shownIndex]);
  const [engine] = useState(() => new DialogueEngine({ now: () => performance.now() }));
  const [bus] = useState(() => new AudioBus({ enabled: sfxEnabled(sfx, typeof window === "undefined" ? null : window.location.search) }));
  const [flow] = useState(() => new StationSlotFlow(guideId));
  const [express, setExpress] = useState(() => searchFlag("express"));
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => false);
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth || 1280, h: window.innerHeight || 720 }));
  const [zoneId, setZoneId] = useState<string | null>(() => startZoneOf(world, progressOf(spec, 0)));
  const [failed, setFailed] = useState<Readonly<Record<string, number>>>({});
  const [hints, setHints] = useState<Readonly<Record<string, number>>>({});
  const [announce, setAnnounce] = useState<string | null>(null);
  const [srText, setSrText] = useState<string | null>(null);
  /** the open station's cached draft and view, captured at open (the runner advances before the payoff ends: D1) */
  const [open, setOpen] = useState<{ encounterId: string; draft: Draft | null; view: unknown; modeKey: ModeKey } | null>(null);
  const [carrying, setCarrying] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [expressTick, setExpressTick] = useState(0);
  const subscribeEngine = useCallback((fn: () => void) => engine.subscribe(fn), [engine]);
  const blocking = useSyncExternalStore(
    subscribeEngine,
    () => engine.snapshot().blocking,
    () => false,
  );
  useAudioUnlock(bus);

  // ------------------------------------------------------------------ refs (read in callbacks and effects only)
  const hostRef = useRef<ExpeditionHostHandle | null>(null);
  const panelRef = useRef<InstrumentPanelHandle | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<Phase>(phase);
  const progressRef = useRef(progress);
  const expressRef = useRef(express);
  const failedRef = useRef(failed);
  const hintsRef = useRef(hints);
  const openRef = useRef(open);
  const wsLive = useRef<WorldState>(ws);
  const drafts = useRef(new Map<string, Draft>());
  const seq = useRef(0);
  const clientCutscenes = useRef(new Set<string>());
  const hostCutscenes = useRef(new Set<string>());
  const running = useRef<string | null>(null);
  const pending = useRef<PendingCutscene[]>([]);
  const zoneEntryPlayed = useRef(new Set<string>());
  const bossSpoken = useRef(new Map<string, number>());
  const ridden = useRef(new Set<string>());
  const payoffDone = useRef(new Set<string>());
  const token = useRef(0);
  const attempts = useRef(0);
  const expressBusy = useRef(false);
  const warp = useRef<{ target: string | null; timer: number | null; last: number }>({ target: null, timer: null, last: -Infinity });
  const phaseStarted = useRef<Phase | null>(null);
  useLayoutEffect(() => {
    phaseRef.current = phase;
    progressRef.current = progress;
    expressRef.current = express;
    failedRef.current = failed;
    hintsRef.current = hints;
    openRef.current = open;
  });

  // ------------------------------------------------------------------ world state + quests
  const applyWorld = (events: readonly WorldStateEvent[]) => {
    if (events.length === 0) return;
    wsLive.current = reduceWorldEvents(wsLive.current, events);
    setWs(wsLive.current);
  };
  const settle = (solvedIds: readonly string[] = progressRef.current.solvedIds) => {
    if (overlay.quests.length === 0) return;
    const res = settleQuests(overlay.quests, { solvedIds: new Set(solvedIds), state: wsLive.current });
    applyWorld(res.events);
    if (res.say.length > 0) {
      const req = sayRequest(`quest:${[...wsLive.current.flags].length}`, res.say, "line", guideId, { channel: "bar", priority: "story" });
      if (req) void engine.say(req);
    }
    if (res.debrief.length > 0) mirrorBonus(sessionStore(), spec.id, { debrief: res.debrief });
  };

  // ------------------------------------------------------------------ cutscenes
  /** Plays a cutscene on the host. `phase` = the phase already names it (intro, finale); `carry` = inside payoff. */
  const runCutscene = async (id: string, mode: CutscenePurpose | "phase" | "carry", before?: SayRequest | null) => {
    if (mode !== "phase" && mode !== "carry") dispatch({ type: "CUTSCENE_START", cutsceneId: id, purpose: mode });
    running.current = id;
    clientCutscenes.current.add(id);
    try {
      if (before) await engine.say(before);
      await (hostRef.current?.playCutscene?.(id) ?? Promise.resolve());
    } catch (err) {
      console.warn(`Expedition: cutscene ${id} failed`, err);
    } finally {
      clientCutscenes.current.delete(id);
      if (running.current === id) running.current = null;
    }
    if (mode !== "carry") dispatch({ type: "CUTSCENE_DONE", cutsceneId: id });
  };
  const enqueue = (c: PendingCutscene) => {
    if (pending.current.some((p) => p.id === c.id)) return;
    pending.current.push(c);
    drain();
  };
  const drain = () => {
    if (phaseRef.current.kind !== "explore" || running.current) return;
    const solved = new Set(progressRef.current.solvedIds);
    let next = pending.current.shift();
    while (next && next.purpose === "arena" && next.encounterId && solved.has(next.encounterId)) next = pending.current.shift();
    if (next) void runCutscene(next.id, next.purpose, next.before);
  };

  // ------------------------------------------------------------------ warps (coalesced: autoSolve loops, express)
  const requestWarp = (encounterId: string | null) => {
    const w = warp.current;
    w.target = encounterId;
    if (w.timer !== null) return;
    const wait = Math.max(0, w.last + WARP_SPACING_MS - performance.now());
    w.timer = window.setTimeout(() => {
      w.timer = null;
      w.last = performance.now();
      if (runner.finished || !w.target) return;
      const st = world.stationByEncounter.get(w.target);
      if (st) zoneEntryPlayed.current.add(st.zoneId); // a debug warp never plays zone-entry cutscenes (D3)
      hostRef.current?.warpTo(w.target);
    }, wait);
  };

  /** skipTo / autoSolve: cancel cutscenes and dialogue, sync the world to the runner, land at the current console. */
  const debugSync = () => {
    token.current += 1;
    pending.current = [];
    engine.skipAll();
    engine.clearPins();
    setBriefOpen(false);
    setCarrying(null);
    setAnnounce(null);
    const s = sync();
    setShownIndex(s.index);
    dispatch({ type: "DEBUG_SYNC", runnerFinished: s.finished });
    if (!s.finished && s.encounter) requestWarp(s.encounter.id);
    settle(progressOf(spec, s.index).solvedIds);
  };

  // ------------------------------------------------------------------ stations
  const stationOf = (id: string): ResolvedStation | undefined => world.stationByEncounter.get(id);
  const hintsOf = (id: string) => toHintsUsed(hintsRef.current[id] ?? 0);

  const openStation = (id: string, force = false) => {
    const st = stationOf(id);
    const cur = runner.finished ? null : runner.current();
    if (!st || !cur || cur.encounter.id !== id) return;
    if (!force && phaseRef.current.kind !== "explore") return;
    pending.current = pending.current.filter((p) => !(p.purpose === "arena" && p.encounterId === id));
    dispatch({ type: "INTERACT_STATION", encounterId: id, isCurrent: true });
    const s = sync();
    setOpen({ encounterId: id, draft: drafts.current.get(id) ?? null, view: s.view, modeKey: s.modeKey ?? st.modeKey });
    setAnnounce(null);
    setSrText(hostRef.current?.srText?.(id) ?? null);
    engine.pin(flow.open(st));
    if (st.boss && st.boss.phases.length > 0 && !bossSpoken.current.has(id)) {
      bossSpoken.current.set(id, 0);
      const req = bossPhaseSay(st, 0, guideId);
      if (req) void engine.say(req);
    }
    const used = hintsOf(id);
    hostRef.current?.setAidTier?.(id, aidTierOf(used, failedRef.current[id] ?? 0), used);
    bus.play("ui_panel_in");
  };

  const back = () => {
    const p = phaseRef.current;
    if (p.kind === "panel") {
      dispatch({ type: "BACK" });
      engine.clearPins();
      setBriefOpen(false);
      bus.play("ui_panel_out");
      requestAnimationFrame(() => stageRef.current?.focus());
    } else if (p.kind === "sandbox") {
      dispatch({ type: "BACK" });
      hostRef.current?.closeSandbox?.();
      requestAnimationFrame(() => stageRef.current?.focus());
    }
  };

  const onDraft = (d: PanelDraft) => {
    const o = openRef.current;
    if (!o) return;
    seq.current += 1;
    const draft: Draft = { ...d, encounterId: o.encounterId, modeKey: o.modeKey, seq: seq.current };
    drafts.current.set(o.encounterId, draft);
    hostRef.current?.bindDraft?.(o.encounterId, draft);
    const st = stationOf(o.encounterId);
    if (st?.boss && st.boss.phases.length > 0) {
      const placed = new Set(binsFromDraft(d.input, o.view).assignments.map((a) => a.itemKey));
      const i = bossBatchToSay(placed, st.boss.phases, bossSpoken.current.get(o.encounterId) ?? 0);
      if (i !== null) {
        bossSpoken.current.set(o.encounterId, i);
        const req = bossPhaseSay(st, i, guideId);
        if (req) void engine.say(req);
      }
    }
  };

  const verify = async (input: unknown) => {
    const p = phaseRef.current;
    if (p.kind !== "panel") return;
    const cur = runner.finished ? null : runner.current();
    const st = stationOf(p.encounterId);
    if (!cur || !st || cur.encounter.id !== p.encounterId) return;
    const id = p.encounterId;
    const my = token.current;
    const params = cur.encounter.params;
    const modeKey = openRef.current?.modeKey ?? st.modeKey;
    bus.play("ui_verify");
    const g = runner.submit(input);
    let solution: unknown = null;
    try {
      solution = cur.mode.resolve(params);
    } catch {
      solution = null;
    }
    let d: Diagnosis;
    try {
      d = diagnose({
        modeKey,
        params,
        view: openRef.current?.view ?? cur.view,
        solution,
        input,
        grade: { correct: g.correct, feedback: g.feedback },
        probes: st.probes,
        nearMiss: hostRef.current?.stationLive?.(id)?.nearMiss ?? null,
        feedbackNouns: world.feedbackNouns(id),
      });
    } catch {
      d = plainDiagnosis(g.correct, g.feedback);
    }
    dispatch({ type: "VERIFIED", encounterId: id, correct: g.correct });
    const s = sync();
    if (!g.correct) {
      const n = (failedRef.current[id] ?? 0) + 1;
      failedRef.current = { ...failedRef.current, [id]: n };
      setFailed(failedRef.current);
      const used = hintsOf(id);
      hostRef.current?.setAidTier?.(id, aidTierOf(used, n), used);
      const f = flow.fail(st, d, { failLines: (x, dd, a) => failLines(x, dd, a, guideId) });
      engine.pin(f.pin);
      if (f.say) void engine.say(f.say);
      setAnnounce(d.displayFeedback);
      await (hostRef.current?.resolveEncounter?.(id, d) ?? Promise.resolve());
      if (token.current === my) dispatch({ type: "RESOLVE_DONE" });
      return;
    }
    setAnnounce(null);
    await (hostRef.current?.resolveEncounter?.(id, d) ?? Promise.resolve());
    if (token.current !== my) return;
    dispatch({ type: "RESOLVE_DONE" });
    setShownIndex(s.index); // the world restores now: blocker lifts, terrain merges, the hub socket lights
    const ok = flow.success(st);
    engine.pin(ok.pin);
    if (ok.payoff) void engine.say(ok.payoff);
    bus.play("ui_badge");
    settle(progressOf(spec, s.index).solvedIds);
  };

  const finishPayoff = async (id: string) => {
    const p = phaseRef.current;
    if (p.kind !== "payoff" || p.encounterId !== id || payoffDone.current.has(id)) return;
    payoffDone.current.add(id);
    const my = token.current;
    const st = stationOf(id);
    engine.clearPins();
    setBriefOpen(false);
    if (st?.payoff.kind === "carry" && st.payoff.rideCutsceneId) {
      ridden.current.add(id);
      setCarrying(id);
      await runCutscene(st.payoff.rideCutsceneId, "carry");
      setCarrying(null);
      if (token.current !== my) return;
    }
    const finished = runner.finished;
    if (!finished && st) {
      const after = flow.success(st).after;
      if (after) void engine.say(after);
    }
    attempts.current = 0;
    dispatch({ type: "PAYOFF_DONE", runnerFinished: finished, finaleId });
    const ms = st?.payoff.kind === "ride" && st.payoff.rideCutsceneId ? st.payoff.autoBoardMs : null;
    if (!finished && st && ms !== null && ms !== undefined) {
      window.setTimeout(() => {
        if (token.current !== my || ridden.current.has(id) || phaseRef.current.kind !== "explore") return;
        rideVehicle(id);
      }, ms);
    }
  };

  const rideVehicle = (encounterId: string) => {
    const st = stationOf(encounterId);
    const cut = st?.payoff.rideCutsceneId;
    if (!st || !cut || phaseRef.current.kind !== "explore" || running.current) return Promise.resolve();
    ridden.current.add(encounterId);
    return runCutscene(cut, "ride");
  };

  const hint = () => {
    const p = phaseRef.current;
    if (p.kind !== "panel") return;
    const cur = runner.finished ? null : runner.current();
    const st = stationOf(p.encounterId);
    if (!cur || !st || cur.encounter.id !== p.encounterId) return;
    const text = runner.hint();
    sync();
    if (text === null) return;
    const used = toHintsUsed(runner.hintsUsedOnCurrent);
    hintsRef.current = { ...hintsRef.current, [p.encounterId]: used };
    setHints(hintsRef.current);
    const rung = Math.max(1, Math.min(3, used)) as HintRung;
    const req = flow.hint(st, rung, cur.encounter.hints);
    if (req) void engine.say(req);
    hostRef.current?.onHint?.(p.encounterId, rung);
    hostRef.current?.setAidTier?.(p.encounterId, aidTierOf(used, failedRef.current[p.encounterId] ?? 0), used);
    bus.play("ui_select");
  };

  const openSandbox = (id: string) => {
    if (phaseRef.current.kind !== "explore") return;
    const sb = world.sandboxes.find((s) => s.id === id);
    if (!sb) return;
    dispatch({ type: "INTERACT_SANDBOX", sandboxId: id });
    hostRef.current?.openSandbox?.(id);
    const req = sayRequest(`sandbox:${id}:open`, sb.lines.open, "line", guideId, { channel: "toast", priority: "story" });
    if (req) void engine.say(req);
    bus.play("ui_panel_in");
  };

  // ------------------------------------------------------------------ host → client
  const onHostEvent = (e: AnyHostEvent) => {
    switch (e.type) {
      case "ready":
        if (introId) {
          const z = startZoneOf(world, progressRef.current);
          if (z) zoneEntryPlayed.current.add(z); // the intro covers the first zone
        }
        dispatch({ type: "ASSETS_READY", introId });
        return;
      case "zone_entered": {
        setZoneId(e.zoneId);
        const z = world.zones.find((x) => x.id === e.zoneId);
        const id = z?.entryCutsceneId ?? null;
        if (z && id && !zoneEntryPlayed.current.has(z.id)) {
          zoneEntryPlayed.current.add(z.id);
          if (hasCutscene(id)) enqueue({ id, purpose: "zone" });
        } else if (z) zoneEntryPlayed.current.add(z.id);
        return;
      }
      case "approach": {
        if (!expressAllows("approach_line", expressRef.current) || phaseRef.current.kind !== "explore") return;
        const st = stationOf(e.encounterId);
        const req = st ? flow.approach(st) : null;
        if (req) void engine.say(req);
        return;
      }
      case "arena": {
        const st = stationOf(e.encounterId);
        if (!st?.boss || progressRef.current.solvedIds.includes(e.encounterId)) return;
        const id = st.boss.arenaCutsceneId;
        const before = arenaSay(st, guideId);
        if (hasCutscene(id)) enqueue({ id, purpose: "arena", encounterId: st.encounterId, before });
        else if (before) void engine.say(before);
        return;
      }
      case "trigger": {
        const t = overlay.triggers.find((x) => x.id === e.triggerId);
        if (!t) return;
        const fx = triggerEffects(t, guideId);
        applyWorld(fx.events);
        settle();
        if (fx.say) void engine.say(fx.say);
        if (fx.cue) bus.play(fx.cue);
        if (fx.cutsceneId && hasCutscene(fx.cutsceneId)) enqueue({ id: fx.cutsceneId, purpose: "trigger" });
        return;
      }
      case "cutscene": {
        if (clientCutscenes.current.has(e.id)) return; // one the client started (it tracks the phase itself)
        if (e.state === "start") {
          // the host started it on its own: a zone exit's cutscene
          if (phaseRef.current.kind === "explore") {
            hostCutscenes.current.add(e.id);
            dispatch({ type: "CUTSCENE_START", cutsceneId: e.id, purpose: "exit" });
          }
        } else if (hostCutscenes.current.delete(e.id)) {
          dispatch({ type: "CUTSCENE_DONE", cutsceneId: e.id });
        }
        return;
      }
      case "back":
        back();
        return;
      case "flag":
        applyWorld([{ type: "flag", id: e.id, on: e.on }]);
        settle();
        return;
      case "sandbox_goal": {
        const sb = world.sandboxes.find((s) => s.id === e.sandboxId);
        const reward = sb?.reward ?? null;
        const events: WorldStateEvent[] = [{ type: "sandbox_goal", sandboxId: e.sandboxId, goal: e.goal }];
        if (reward?.flag) events.push({ type: "flag", id: reward.flag, on: true });
        if (reward?.cosmetic) events.push({ type: "cosmetic", asset: reward.cosmetic });
        applyWorld(events);
        if (sb && reward && reward.lines.length > 0) {
          const req = sayRequest(`sandbox:${sb.id}:${e.goal}`, reward.lines, "line", guideId, { channel: "toast", priority: "story" });
          if (req) void engine.say(req);
        }
        if (reward?.debriefLine) mirrorBonus(sessionStore(), spec.id, { debrief: [reward.debriefLine] });
        settle();
        return;
      }
      case "cue":
        bus.play(e.cue);
        return;
      case "music":
        bus.music(e.cue);
        return;
      default:
        return; // near, load_progress, link_used: nothing for the client to do
    }
  };

  const onInteract = (t: InteractTarget) => {
    const plan = planInteract(t, {
      world,
      solvedIds: progressRef.current.solvedIds,
      currentId: progressRef.current.currentId,
      state: wsLive.current,
      guideId,
      express: expressRef.current,
    });
    switch (plan.kind) {
      case "open_panel":
        openStation(plan.encounterId);
        return;
      case "replay":
        if (plan.say) void engine.say(plan.say);
        return;
      case "sandbox":
        openSandbox(plan.sandboxId);
        return;
      case "npc":
        if (plan.say) void engine.say(plan.say).then(() => {
          applyWorld(plan.after);
          settle();
        });
        else {
          applyWorld(plan.after);
          settle();
        }
        return;
      case "plaque":
        void engine.say(plan.say);
        return;
      case "collect":
        void engine.say(plan.say);
        applyWorld(plan.events);
        mirrorBonus(sessionStore(), spec.id, { collected: [plan.collectibleId] });
        settle();
        return;
      case "touch":
        if (plan.say) void engine.say(plan.say);
        if (plan.cue) bus.play(plan.cue);
        applyWorld(plan.events);
        settle();
        return;
      case "ride":
        void rideVehicle(plan.encounterId);
        return;
      case "none":
        return;
    }
  };

  /** Cutscene `say` steps: the host awaits the engine's promise. Express trims a cutscene that began before express. */
  const onSay = (req: SayRequest): Promise<void> => {
    const done = engine.say(req);
    if (expressRef.current && req.source.startsWith("cutscene:")) {
      const id = req.source.slice("cutscene:".length);
      if (expressTrims(id, finaleId)) {
        void done.then(() => {
          if (cutsceneOf(phaseRef.current) === id) hostRef.current?.skipCutscene?.();
        });
      }
    }
    return done;
  };

  // ------------------------------------------------------------------ express driver
  const playerSpot = (): PlayerSpot | null => {
    const dbg = hostRef.current?.debug?.();
    return dbg?.ready ? { zoneId: dbg.zoneId, x: dbg.playerX, surface: dbg.surface } : null;
  };
  const waitForZoneChange = async (from: string, ms: number) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      await new Promise((r) => setTimeout(r, 150));
      const now = playerSpot();
      if (now && now.zoneId !== from) {
        await new Promise((r) => setTimeout(r, 400)); // the reveal half of the wipe
        return;
      }
    }
  };
  const expressStep = () => {
    if (!expressRef.current || expressBusy.current) return;
    const player = playerSpot();
    const a = nextExpressAction(phaseRef.current, progressRef.current, expressWorld, player, { attempts: attempts.current, ridden: ridden.current });
    const rerun = (ms: number) => window.setTimeout(() => setExpressTick((t) => t + 1), ms);
    if (!a) {
      if (!player && phaseRef.current.kind === "explore" && progressRef.current.currentId) rerun(400);
      return;
    }
    switch (a.kind) {
      case "trimCutscene":
        return; // the host trims cutscenes that start in express; onSay trims one that began before
      case "interact":
        attempts.current = 0;
        openStation(a.encounterId);
        return;
      case "walkTo": {
        expressBusy.current = true;
        const from = player;
        void (hostRef.current?.walkTo?.(a.x, a.surface) ?? Promise.resolve()).then(async () => {
          if (a.reason === "exit" && from) await waitForZoneChange(from.zoneId, 6000);
          const now = playerSpot();
          const st = stationOf(a.encounterId);
          const arrived = a.reason === "exit" ? !!now && !!from && now.zoneId !== from.zoneId : !!now && !!st && atConsole(now, st);
          attempts.current = arrived ? 0 : attempts.current + 1;
          expressBusy.current = false;
          rerun(arrived ? 0 : 250);
        });
        return;
      }
      case "ride": {
        expressBusy.current = true;
        void rideVehicle(a.encounterId).then(() => {
          expressBusy.current = false;
          rerun(0);
        });
        return;
      }
      case "warp": {
        expressBusy.current = true;
        attempts.current = 0;
        requestWarp(a.encounterId);
        window.setTimeout(() => {
          expressBusy.current = false;
          rerun(0);
        }, WARP_SPACING_MS + 900);
        return;
      }
    }
  };

  // ------------------------------------------------------------------ the latest handlers, for stable callbacks
  const H = useRef({ onHostEvent, onInteract, onSay, onDraft, verify, back, hint, finishPayoff, openStation, openSandbox, debugSync, expressStep, runCutscene, drain, requestWarp });
  useLayoutEffect(() => {
    H.current = { onHostEvent, onInteract, onSay, onDraft, verify, back, hint, finishPayoff, openStation, openSandbox, debugSync, expressStep, runCutscene, drain, requestWarp };
  });
  const stable = useMemo(
    () => ({
      onHostEvent: (e: HostEvent) => H.current.onHostEvent(e as AnyHostEvent),
      onInteract: (t: InteractTarget) => H.current.onInteract(t),
      onSay: (req: SayRequest) => H.current.onSay(req),
      onDraft: (d: PanelDraft) => H.current.onDraft(d),
      onVerify: (input: unknown) => void H.current.verify(input),
      onBack: () => H.current.back(),
      onHint: () => H.current.hint(),
      onBadgeDone: () => {
        const id = encounterOf(phaseRef.current);
        if (id) void H.current.finishPayoff(id);
      },
      onBrief: () => setBriefOpen(true),
      onSandboxDraft: (d: SandboxDraft) => {
        const p = phaseRef.current;
        if (p.kind === "sandbox") hostRef.current?.bindSandboxDraft?.(p.sandboxId, d);
      },
      getLive: () => {
        const id = openRef.current?.encounterId;
        const live = id ? hostRef.current?.stationLive?.(id) : null;
        return { t: live?.t ?? 0, sim: live?.sim ?? null };
      },
      skip: () => hostRef.current?.skipCutscene?.(),
    }),
    [],
  );

  // ------------------------------------------------------------------ effects
  // phase entry: intro and finale play here; explore drains queued cutscenes; payoff arms its fallback
  useEffect(() => {
    if (phaseStarted.current === phase) return; // StrictMode re-runs effects: start each phase once
    phaseStarted.current = phase;
    if (phase.kind === "intro" || phase.kind === "finale") void H.current.runCutscene(phase.cutsceneId, "phase");
    if (phase.kind === "explore") H.current.drain();
    if (phase.kind === "payoff") {
      const id = phase.encounterId;
      const t = window.setTimeout(() => void H.current.finishPayoff(id), PAYOFF_FALLBACK_MS);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  // express: walk → interact after ASSETS_READY and every PAYOFF_DONE (§0.1.5)
  useEffect(() => {
    if (!express) return;
    const t = window.setTimeout(() => H.current.expressStep(), 0);
    return () => window.clearTimeout(t);
  }, [express, phase, progress, zoneId, expressTick]);

  // express: blocking lines advance on their own after a short read
  useEffect(() => {
    if (!express) return;
    let timer: number | null = null;
    let lineId: string | null = null;
    const check = () => {
      const a = engine.snapshot().active;
      const id = a?.line.id ?? null;
      if (id !== lineId) {
        if (timer !== null) window.clearTimeout(timer);
        timer = null;
        lineId = id;
      }
      const delay = expressAdvanceDelay(true, a ? { typing: a.typing, blocking: a.request.blocking } : null);
      if (delay !== null && timer === null) {
        timer = window.setTimeout(() => {
          timer = null;
          if (engine.snapshot().active?.line.id === lineId) engine.advance();
        }, delay);
      }
    };
    check();
    const unsub = engine.subscribe(check);
    return () => {
      unsub();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [express, engine]);

  // the open station's screen-reader text (the contraption's describe(), throttled by the controller)
  const openId = open?.encounterId ?? null;
  const panelShown = panelVisible(phase) && carrying === null && openId !== null && encounterOf(phase) === openId;
  useEffect(() => {
    if (!openId || !panelShown) return;
    const h = hostRef.current;
    if (!h?.onSr) return;
    return h.onSr((key, text) => {
      if (key === openId) setSrText(text);
    });
  }, [openId, panelShown]);

  // continuous loops of the open station (bell hum ∝ |f(x)|, sync hum ∝ B), when sound is on at all
  useEffect(() => {
    if (!openId || !panelShown || !bus.snapshot().enabled) return;
    let raf = 0;
    const loop = () => {
      bus.setLoops(openId, hostRef.current?.stationLive?.(openId)?.audio ?? []);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      bus.clearLoops(openId);
    };
  }, [openId, panelShown, bus]);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth || 1280, h: window.innerHeight || 720 });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => () => bus.dispose(), [bus]);

  // window.__GAME_DEBUG__ (legacy core + the expedition object, §2.10)
  useEffect(() => {
    const expedition: ExpeditionDebugApi = {
      host: () => hostRef.current?.debug?.() ?? null,
      phase: () => phaseRef.current.kind,
      dialogue: () => engine.current(),
      worldState: () => worldStateDebug(wsLive.current),
      interact: () => hostRef.current?.interact?.(),
      walkTo: (x, surface) => hostRef.current?.walkTo?.(x, surface) ?? Promise.resolve(),
      useLink: (id) => hostRef.current?.useLink?.(id) ?? Promise.resolve(),
      openPanel: () => {
        if (runner.finished) return;
        const cur = runner.current();
        if (!cur) return;
        const st = world.stationByEncounter.get(cur.encounter.id);
        if (!st) return;
        pending.current = [];
        engine.skipAll();
        zoneEntryPlayed.current.add(st.zoneId);
        hostRef.current?.warpTo(cur.encounter.id);
        if (phaseRef.current.kind !== "explore") dispatch({ type: "DEBUG_SYNC", runnerFinished: false });
        H.current.openStation(cur.encounter.id, true);
      },
      applySolutionDraft: () => {
        const p = phaseRef.current;
        const o = openRef.current;
        if (p.kind !== "panel" || !o || o.encounterId !== p.encounterId || runner.finished) return;
        const cur = runner.current();
        const st = world.stationByEncounter.get(p.encounterId);
        if (!cur || !st || cur.encounter.id !== p.encounterId) return;
        const input = cur.mode.solutionInput(cur.encounter.params, cur.mode.resolve(cur.encounter.params));
        if (resolveControlKind(st.meta.control, o.modeKey, o.view) === "widget") {
          // a wrapped widget has no restore API: its solution goes straight to Verify (documented for E2/E3)
          void H.current.verify(input);
          return;
        }
        panelRef.current?.applyDraftInput(fromSubmitInput(o.modeKey, input, o.view));
      },
      setProbe: (v) => panelRef.current?.setProbe(v),
      hint: () => H.current.hint(),
      openSandbox: (id) => H.current.openSandbox(id),
      express: (on) => setExpress(on),
      skipCutscene: () => hostRef.current?.skipCutscene?.(),
      freeze: (on) => {
        hostRef.current?.freezeFx?.(on);
        engine.setPaused(on);
      },
      freezeClient: (on) => engine.setPaused(on),
    };
    const handle: GameDebugHandle = {
      state: () => ({
        finished: runner.finished,
        index: runner.finished ? spec.encounters.length : (runner.current()?.index ?? spec.encounters.length),
        encounterId: runner.finished ? null : (runner.current()?.encounter.id ?? null),
        mastery: runner.mastery(),
      }),
      skipTo: (encounterId) => {
        runner.skipTo(encounterId);
        H.current.debugSync();
      },
      autoSolve: () => {
        if (runner.finished) return;
        runner.autoSolve(); // always answers correctly and advances the runner; the world follows without animating (D3)
        H.current.debugSync();
      },
      events: () => runner.telemetry(),
      mastery: () => runner.mastery(),
      expedition,
    };
    return installGameDebug(handle) ?? undefined;
  }, [runner, engine, spec, world]);

  // ------------------------------------------------------------------ derived view
  const lmode = carrying ? "explore" : layoutModeOf(phase, world);
  const focusKind: "station" | "sandbox" | null = phase.kind === "sandbox" ? "sandbox" : lmode !== "explore" && encounterOf(phase) ? "station" : null;
  const focusId = phase.kind === "sandbox" ? phase.sandboxId : focusKind === "station" ? encounterOf(phase) : null;
  const layout = useMemo<LayoutState>(
    () => ({
      mode: lmode,
      safeRect: safeRectFor(lmode, { w: viewport.w, h: viewport.h }),
      focus: focusKind === "station" && focusId ? { kind: "station", encounterId: focusId } : focusKind === "sandbox" && focusId ? { kind: "sandbox", sandboxId: focusId } : null,
    }),
    [lmode, focusKind, focusId, viewport.w, viewport.h],
  );
  const openSt = openId ? (world.stationByEncounter.get(openId) ?? null) : null;
  const panelStation = useMemo(() => (openSt ? panelStationOf(openSt) : null), [openSt]);
  const panelContext = useMemo(() => panelContextOf(world, progress.solvedIds, openSt), [world, progress.solvedIds, openSt]);
  const meter = useMemo(() => meterValueOf(overlay.story.meter, progress.solvedIds), [overlay.story.meter, progress.solvedIds]);
  const frozen = hostFrozen(phase, blocking, journalOpen || briefOpen);

  if (phase.kind === "finished") {
    const { mastery, lines } = runner.debrief();
    return <EndScreen gameId={spec.id} title={spec.title} outro={outroFor(spec, world)} mastery={mastery} lines={lines} telemetry={runner.telemetry()} />;
  }

  const openEnc = openId ? spec.encounters.find((e) => e.id === openId) : undefined;
  const hintsUsed = openId ? toHintsUsed(hints[openId] ?? 0) : 0;
  const aidTier = openId ? aidTierOf(hintsUsed, failed[openId] ?? 0) : 0;
  const hintsAvailable = openEnc?.hints.length ?? 0;
  const canHint = phase.kind === "panel" && !!openEnc && snap.encounter?.id === openId && hintsUsed < hintsAvailable;
  const brief = openSt && openEnc ? briefOf(openEnc.prompt, openSt, hintsUsed, openEnc.hints, guideId) : null;
  const sandbox = phase.kind === "sandbox" ? world.sandboxes.find((s) => s.id === phase.sandboxId) : undefined;
  const cutsceneId = cutsceneOf(phase) ?? carrying;
  const skippable = !!cutsceneId && (overlay.cutscenes.find((c) => c.id === cutsceneId)?.skippable ?? true);
  const collectedItems: JournalItem[] = overlay.collectibles.filter((c) => ws.collected.has(c.id)).map((c) => ({ id: c.id, title: c.title, kind: c.kind, text: c.text }));
  const zone = zoneNameOf(world, zoneId);
  const mastery = runner.mastery();
  const masteryConcepts = spec.concepts.map((c) => ({ id: c.id, name: c.name, score: mastery[c.id]?.score ?? 0 }));

  return (
    <ExpeditionLayout
      phase={phase.kind}
      label={zone?.name ?? overlay.title}
      stageRef={stageRef}
      stage={
        <PlayHost
          ref={hostRef as Ref<HostHandle>}
          spec={spec}
          rooms={NO_ROOMS}
          palette={palette}
          frozen={frozen}
          onReachSocket={noop}
          world={world}
          progress={progress}
          layout={layout}
          worldState={ws}
          meterValue={meter}
          express={express}
          onInteract={stable.onInteract}
          onSay={stable.onSay}
          onHostEvent={stable.onHostEvent}
        />
      }
      hud={
        <Hud
          story={overlay.story}
          zone={zone}
          stations={world.stations}
          solvedIds={progress.solvedIds}
          bus={bus}
          collectibles={overlay.collectibles}
          collected={ws.collected}
          meterValue={meter}
          mode={hudModeOf(phase)}
          onToggleJournal={() => setJournalOpen((o) => !o)}
        />
      }
      panel={
        panelShown && openSt && panelStation && open ? (
          <InstrumentPanel
            key={openSt.encounterId}
            station={panelStation}
            meta={openSt.meta}
            view={open.view}
            context={panelContext}
            aidTier={aidTier}
            hintsUsed={hintsUsed}
            instruction={openSt.dialogue.instruction.text}
            initialDraft={open.draft}
            attempt={failed[openSt.encounterId] ?? 0}
            result={phase.kind === "payoff" ? "success" : null}
            busy={phase.kind === "resolving"}
            srText={srText}
            announce={announce}
            reducedMotion={reducedMotion}
            brief={brief}
            getLive={openSt.meta.sim ? stable.getLive : undefined}
            onDraft={stable.onDraft}
            onVerify={stable.onVerify}
            onBack={stable.onBack}
            onBadgeDone={stable.onBadgeDone}
            handleRef={panelRef}
          />
        ) : sandbox ? (
          <SandboxPanel key={sandbox.id} sandbox={sandbox} onDraft={stable.onSandboxDraft} onDone={stable.onBack} />
        ) : null
      }
      dialogue={
        <DialogueBar
          engine={engine}
          speakers={world.speakers}
          guideId={guideId}
          titleEmblem={overlay.cast.guide.emblem}
          layout={carrying ? "cutscene" : barLayoutOf(phase, world)}
          onHint={phase.kind === "panel" ? stable.onHint : undefined}
          onBrief={phase.kind === "panel" && brief ? stable.onBrief : undefined}
          hintDisabled={!canHint}
          hintLabel={hintLabelOf(hintsUsed, hintsAvailable)}
          reducedMotion={reducedMotion}
        />
      }
      overlays={
        <>
          {express ? (
            <div className={layoutStyles.express} aria-hidden="true" data-testid="express-badge">
              Express
            </div>
          ) : null}
          {cutsceneId && skippable ? (
            <button type="button" className={layoutStyles.skip} data-testid="cutscene-skip" onClick={stable.skip} aria-keyshortcuts="Escape">
              Skip
            </button>
          ) : null}
          {briefOpen && brief && phase.kind === "panel" ? (
            <div
              className={`${layoutStyles.briefOverlay} xp-scope`}
              data-panel=""
              role="dialog"
              aria-modal="true"
              aria-label="Brief"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setBriefOpen(false);
                }
              }}
            >
              <div className={layoutStyles.briefCard}>
                <button type="button" className={layoutStyles.briefClose} onClick={() => setBriefOpen(false)} aria-label="Close the brief" autoFocus>
                  ✕
                </button>
                <BriefSheet brief={brief} initialTab={hintsUsed > 0 ? "hints" : "brief"} />
              </div>
            </div>
          ) : null}
          <Journal open={journalOpen} onClose={() => setJournalOpen(false)} spec={overlay.story.journal} concepts={masteryConcepts} items={collectedItems} />
        </>
      }
    />
  );
}
