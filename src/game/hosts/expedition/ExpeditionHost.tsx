"use client";
/**
 * ExpeditionHost.tsx (H1) — boots Phaser ONCE (deps []) with `type: WEBGL`, `scale: {mode: RESIZE, parent}`,
 * `input: {keyboard: {capture: []}}` and the entry segment's sky as background (docs/design/20 §2.2). Prop changes are
 * pushed into the scene through effects (frozen, progress, layout, worldState, meterValue, express) — never a remount.
 * Exposes HostHandle (§2.10), attaches `__GAME_DEBUG__.host.playerX` and `.expedition`, and falls back to the reduced
 * DOM host on ANY boot failure with console.warn (never console.error). `?expeditionFail=1` forces that fallback (e2e).
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { HostHandle, HostProps, LayoutState } from "../types";
import type { ExpeditionSceneApi, HostSceneData, StationLive } from "./ExpeditionScene";
import { installHostDebug, makeHostDebugApi } from "./debug-api";
import { ExpeditionDomHost } from "./dom/ExpeditionDomHost";
import { LabelStore } from "./labels/label-store";
import { WorldLabelLayer } from "./labels/WorldLabelLayer";
import { EMPTY_WORLD_STATE } from "./scene/requirements";

export const DEFAULT_LAYOUT: LayoutState = { mode: "explore", safeRect: { x: 0, y: 0, w: 0, h: 0 }, focus: null };

export type { StationLive } from "./ExpeditionScene";

/**
 * H2: what the Expedition client needs beyond HostHandle (which is main-owned): pressing E, freezing the host's
 * clocks and effects for screenshots, a station controller's live state (the panel's getLive, diagnose's near-miss,
 * audio loops) and the contraption's throttled screen-reader text (the panel's live region). PlayHost forwards its
 * ref straight to ExpeditionHost, so the client reads these off the same handle.
 */
export interface ExpeditionHostExtras {
  interact(): void;
  freezeFx(on: boolean): void;
  stationLive(encounterId: string): StationLive | null;
  srText(key: string): string | null;
  onSr(fn: (key: string, text: string) => void): () => void;
  renderer(): "booting" | "webgl" | "dom";
}
export type ExpeditionHostHandle = HostHandle & Partial<ExpeditionHostExtras>;

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
function domRequested(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("renderer") === "dom";
  } catch {
    return false;
  }
}
function forcedFailure(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("expeditionFail") === "1";
  } catch {
    return false;
  }
}
function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export const ExpeditionHost = forwardRef<HostHandle, HostProps>(function ExpeditionHost(props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ExpeditionSceneApi | null>(null);
  const domRef = useRef<HostHandle | null>(null);
  const pending = useRef<((api: ExpeditionSceneApi) => void)[]>([]);
  const propsRef = useRef(props);
  const [mode, setMode] = useState<"booting" | "webgl" | "dom">("booting");
  const [loadFrac, setLoadFrac] = useState(0);
  const [title, setTitle] = useState<{ text: string; sub: string | null } | null>(null);
  const labels = useMemo(() => new LabelStore(), []);

  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    let cancelled = false;
    let game: import("phaser").Game | null = null;
    const fail = (why: string, err?: unknown) => {
      console.warn(`Expedition: ${why}; using the DOM host.`, err ?? "");
      game?.destroy(true);
      game = null;
      if (!cancelled) setMode("dom");
    };
    const p = propsRef.current;
    if (!p.world || domRequested()) {
      setMode("dom"); // ?renderer=dom is a deliberate choice (decision 12): no warning
      return;
    }
    if (forcedFailure()) {
      fail("forced boot failure (?expeditionFail=1)");
      return;
    }
    if (!webglAvailable()) {
      fail("WebGL is unavailable");
      return;
    }
    (async () => {
      try {
        const [{ default: Phaser }, sceneMod, loaderMod] = await Promise.all([import("phaser"), import("./ExpeditionScene"), import("./art/select-loader")]);
        const world = propsRef.current.world;
        if (cancelled || !containerRef.current || !world) return;
        const { loader, palette } = await loaderMod.selectLoader(world.overlay);
        const SceneClass = sceneMod.createExpeditionScene(Phaser);
        const entry = world.zones[0]?.segments[0]?.sky.stops[0]?.color ?? "#20303a";
        game = new Phaser.Game({
          type: Phaser.WEBGL,
          parent: containerRef.current,
          backgroundColor: entry,
          scale: { mode: Phaser.Scale.RESIZE, width: containerRef.current.clientWidth || 1280, height: containerRef.current.clientHeight || 720 },
          input: { keyboard: { capture: [] } },
          // real-time clock: tweens, timers and plans keep their durations when frames drop (swiftshader, projectors)
          fps: { smoothStep: false, min: 10 },
          banner: false,
          scene: [],
        });
        const canvas = game.canvas;
        if (!canvas || !(canvas.getContext("webgl2") ?? canvas.getContext("webgl"))) {
          fail("the WebGL context could not be created");
          return;
        }
        const first = propsRef.current;
        const data: HostSceneData = {
          spec: first.spec,
          world,
          progress: first.progress ?? { solvedIds: [], currentId: first.spec.encounters[0]?.id ?? null },
          layout: first.layout ?? DEFAULT_LAYOUT,
          worldState: first.worldState ?? EMPTY_WORLD_STATE,
          meterValue: first.meterValue ?? null,
          express: !!first.express,
          reducedMotion: prefersReducedMotion(),
          loader,
          labels,
          palette,
          warn: (msg, err) => console.warn(`Expedition: ${msg}`, err ?? ""),
          onBootError: (err) => fail("the scene failed to boot", err),
          // TODO(w1): forward cutscene flags and sandbox goals to the client once HostEvent carries them
          // (outside diff for src/game/hosts/types.ts: `{ type: "flag"; id; on }` and `{ type: "sandbox_goal"; sandboxId; goal }`).
          onFlag: (id, on) => (propsRef.current.onHostEvent as ((e: unknown) => void) | undefined)?.({ type: "flag", id, on }),
          onSandboxGoal: (sandboxId, goal) => (propsRef.current.onHostEvent as ((e: unknown) => void) | undefined)?.({ type: "sandbox_goal", sandboxId, goal }),
          // TODO(w1): typed once HostEvent carries `{ type: "cue"; cue }` and `{ type: "music"; cue }` (outside diff, types.ts)
          onCue: (cue) => (propsRef.current.onHostEvent as ((e: unknown) => void) | undefined)?.({ type: "cue", cue }),
          onMusic: (cue) => (propsRef.current.onHostEvent as ((e: unknown) => void) | undefined)?.({ type: "music", cue }),
          events: {
            onEvent: (e) => {
              if (e.type === "load_progress") setLoadFrac(e.fraction);
              propsRef.current.onHostEvent?.(e);
            },
            onInteract: (t) => propsRef.current.onInteract?.(t),
            say: (req) => propsRef.current.onSay?.(req),
            onTitle: (t) => setTitle(t ? { text: t.text, sub: t.sub } : null),
          },
          onReady: (api) => {
            if (cancelled) return;
            const a = api as ExpeditionSceneApi;
            apiRef.current = a;
            const cur = propsRef.current;
            a.setFrozen(cur.frozen);
            if (cur.layout) a.setLayout(cur.layout);
            for (const fn of pending.current) fn(a);
            pending.current = [];
            setMode("webgl");
          },
        };
        game.scene.add(sceneMod.SCENE_KEY, SceneClass, true, data);
      } catch (err) {
        fail("Phaser failed to boot", err);
      }
    })();
    return () => {
      cancelled = true;
      apiRef.current = null;
      game?.destroy(true);
      game = null;
    };
    // Boots once per mount (§2.2): props flow in through the effects below, never through a remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- prop pushes
  useEffect(() => apiRef.current?.setFrozen(props.frozen), [props.frozen, mode]);
  useEffect(() => {
    if (props.progress) apiRef.current?.setProgress(props.progress);
  }, [props.progress, mode]);
  useEffect(() => {
    if (props.layout) apiRef.current?.setLayout(props.layout);
  }, [props.layout, mode]);
  useEffect(() => {
    if (props.worldState) apiRef.current?.setWorldState(props.worldState);
  }, [props.worldState, mode]);
  useEffect(() => apiRef.current?.setMeterValue(props.meterValue ?? null), [props.meterValue, mode]);
  useEffect(() => apiRef.current?.setExpress(!!props.express), [props.express, mode]);

  const call = <T,>(fn: (a: ExpeditionSceneApi) => T, dom: (h: HostHandle) => T, fallback: T): T => {
    if (mode === "dom") return domRef.current ? dom(domRef.current) : fallback;
    const a = apiRef.current;
    if (a) return fn(a);
    return fallback;
  };

  const handle: ExpeditionHostHandle = {
    warpTo: (id) => {
      if (mode === "dom") return domRef.current?.warpTo(id);
      if (apiRef.current) apiRef.current.warpTo(id);
      else pending.current.push((a) => a.warpTo(id));
    },
    bindDraft: (id, d) => call((a) => a.bindDraft(id, d), (h) => h.bindDraft?.(id, d), undefined),
    setAidTier: (id, t, h) => call((a) => a.setAidTier(id, t, h), (x) => x.setAidTier?.(id, t, h), undefined),
    onHint: (id, r) => call((a) => a.onHint(id, r), (h) => h.onHint?.(id, r), undefined),
    resolveEncounter: (id, d) => call((a) => a.resolveEncounter(id, d), (h) => h.resolveEncounter?.(id, d) ?? Promise.resolve(), Promise.resolve()),
    openSandbox: (id) => call((a) => a.openSandbox(id), (h) => h.openSandbox?.(id), undefined),
    bindSandboxDraft: (id, d) => call((a) => a.bindSandboxDraft(id, d), (h) => h.bindSandboxDraft?.(id, d), undefined),
    closeSandbox: () => call((a) => a.closeSandbox(), (h) => h.closeSandbox?.(), undefined),
    playCutscene: (id) => call((a) => a.playCutscene(id), (h) => h.playCutscene?.(id) ?? Promise.resolve(), Promise.resolve()),
    skipCutscene: () => call((a) => a.skipCutscene(), (h) => h.skipCutscene?.(), undefined),
    walkTo: (x, s) => call((a) => a.walkTo(x, s), (h) => h.walkTo?.(x, s) ?? Promise.resolve(), Promise.resolve()),
    useLink: (id) => call((a) => a.useLink(id), (h) => h.useLink?.(id) ?? Promise.resolve(), Promise.resolve()),
    debug: () =>
      call(
        (a) => a.debug(),
        (h) => h.debug?.() ?? notReady(),
        notReady(),
      ),
    interact: () => call((a) => a.interact(), (h) => (h as ExpeditionHostHandle).interact?.(), undefined),
    freezeFx: (on) => call((a) => a.freezeFx(on), (h) => (h as ExpeditionHostHandle).freezeFx?.(on), undefined),
    stationLive: (id) => call((a) => a.stationLive(id), () => null, null),
    srText: (key) => labels.sr(key),
    onSr: (fn) => labels.onSr(fn),
    renderer: () => mode,
  };
  const handleRef = useRef(handle);
  useEffect(() => {
    handleRef.current = handle;
  });
  useImperativeHandle(ref, () => handle);

  // ---- __GAME_DEBUG__ (the WebGL path; the DOM host installs its own)
  useEffect(() => {
    if (mode !== "webgl") return;
    const api = makeHostDebugApi(
      {
        warpTo: (id) => handleRef.current.warpTo(id),
        walkTo: (x, s) => handleRef.current.walkTo?.(x, s) ?? Promise.resolve(),
        useLink: (id) => handleRef.current.useLink?.(id) ?? Promise.resolve(),
        skipCutscene: () => handleRef.current.skipCutscene?.(),
        debug: () => handleRef.current.debug?.() ?? notReady(),
      },
      {
        renderer: "webgl",
        interact: () => apiRef.current?.interact(),
        freeze: (on) => {
          apiRef.current?.freezeFx(on);
          labels.hidden = false;
        },
        layers: () => apiRef.current?.layers() ?? [],
        facadeAlpha: (id) => apiRef.current?.facadeAlpha(id) ?? null,
        capturing: () => apiRef.current?.capturing() ?? false,
      },
    );
    return installHostDebug(api);
  }, [mode, labels]);

  if (mode === "dom") return <ExpeditionDomHost ref={domRef} {...props} />;
  return (
    <div data-testid="expedition-host" data-renderer="webgl" style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <div ref={containerRef} data-testid="phaser-host" style={{ position: "absolute", inset: 0 }} />
      <WorldLabelLayer store={labels} />
      {mode === "booting" && (
        <div role="status" aria-live="polite" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", color: "#FFFFFF", fontSize: 22, textAlign: "center" }}>
          Loading the expedition…
          <div style={{ marginTop: 12, width: 320, height: 8, background: "rgba(255,255,255,0.25)", borderRadius: 4 }}>
            <div style={{ width: `${Math.round(loadFrac * 100)}%`, height: "100%", background: "#E2892C", borderRadius: 4 }} />
          </div>
        </div>
      )}
      {title && (
        <div data-testid="title-card" role="status" style={{ position: "absolute", left: "50%", top: "38%", transform: "translate(-50%, -50%)", textAlign: "center", color: "#FFFFFF", textShadow: "0 2px 8px rgba(0,0,0,0.6)", pointerEvents: "none", zIndex: 3 }}>
          <div style={{ fontFamily: "Georgia, 'Cinzel', serif", fontSize: 56, letterSpacing: "0.08em" }}>{title.text}</div>
          {title.sub && <div style={{ fontSize: 24, marginTop: 8, opacity: 0.85 }}>{title.sub}</div>}
        </div>
      )}
    </div>
  );
});

function notReady() {
  return {
    ready: false,
    zoneId: "",
    segmentId: "",
    playerX: 0,
    playerY: 0,
    surface: "ground",
    cameraX: 0,
    cameraY: 0,
    zoom: 1,
    textures: 0,
    near: null,
    links: [],
    contraption: () => null,
    cutscene: null,
    fps: 0,
    drawObjects: 0,
  };
}
