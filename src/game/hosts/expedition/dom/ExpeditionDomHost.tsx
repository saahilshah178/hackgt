"use client";
/**
 * dom/ExpeditionDomHost.tsx (H1) — the REDUCED DOM fallback (docs/design/20 §2.2, amendment 31; `?renderer=dom`, no
 * WebGL, or any Phaser boot failure). The same zone drawn as layered images with CSS parallax, the protagonist as a CSS
 * sprite of the rig sheet, each station as a static snapshot (dormant or solved), and the SAME pure modules as the
 * Phaser host: surfaces, terrain, traversal (scripted arcs in rAF), proximity, framing, route and triggers. Same
 * HostHandle; testid `dom-host`. Cutscenes run through S1's CutsceneRunner against a small DOM stage.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Cutscene, InteractRef, Requirement, Zone } from "../../../../contracts/world";
import type { ReqCtx, WorldState } from "../../../../world/types";
import type { ExpeditionHostDebug, HostHandle, HostProps, InteractTarget, LayoutState } from "../../types";
import type { CutsceneStage } from "../bridge";
import { frameFor as poseFrame, locomotion } from "../actors/pose-animator";
import { fetchCatalog, flagsFrom } from "../../../art/manifest-loader";
import { paletteFor } from "../art/palette-shim";
import { CutsceneRunner } from "../cutscene/runner";
import { installHostDebug, makeHostDebugApi } from "../debug-api";
import { actionFor, isTypingTarget } from "../input/keymap";
import { LabelStore } from "../labels/label-store";
import { WorldLabelLayer } from "../labels/WorldLabelLayer";
import { inputToward, linkForKey, NO_INPUT, planChoice, spawn, startPath, stepCharacter, type CharInput, type CharState } from "../scene/character";
import { baseZoom, centredView, defaultSafeRect, followView, frameFor, lerpFactor, unionRect, type CameraView } from "../scene/framing";
import { interactLabel, nearest, targetKey, type Interactable } from "../scene/proximity";
import { EMPTY_WORLD_STATE, reqCtxOf, requirementMet } from "../scene/requirements";
import { planRoute, type RouteStep } from "../scene/route";
import { crossfadeWeights, interiorAt, layerSetWeights, resolveSegmentLook, stepFacadeAlpha } from "../scene/segments";
import { buildSurfaces, heightAt } from "../scene/surfaces";
import { blockers as blockersOf, sheerEdges } from "../scene/terrain";
import { linkPrompt, linksInRange, planLink, timedHopOpen } from "../scene/traversal";
import { emptyTriggerTracker, stepTriggers } from "../scene/triggers";
import { DomActor, setActor } from "./DomActor";
import { DomStage } from "./DomStage";
import { StubUrlCache } from "./stub-urls";

const DEFAULT_LAYOUT: LayoutState = { mode: "explore", safeRect: { x: 0, y: 0, w: 0, h: 0 }, focus: null };

interface Walk {
  steps: RouteStep[];
  i: number;
  resolve: () => void;
  stuckMs: number;
  lastX: number;
}

export const ExpeditionDomHost = forwardRef<HostHandle, HostProps>(function ExpeditionDomHost(props, ref) {
  const world = props.world;
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });
  const palette = useMemo(() => paletteFor(world?.overlay.biome ?? "orrery_terraces"), [world]);
  const art = useMemo(() => (world ? new StubUrlCache(world.overlay, palette) : null), [world, palette]);
  const [, setArtVersion] = useState(0);
  useEffect(() => {
    if (!art || !world) return;
    let live = true;
    fetchCatalog(["shared", world.overlay.biome], flagsFrom(window.location.search, window.devicePixelRatio || 1))
      .then((c) => {
        if (!live || c.entries.size === 0) return;
        art.setCatalog(c);
        setArtVersion((v) => v + 1);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [art, world]);
  const labels = useMemo(() => new LabelStore(), []);
  const colors = useMemo(() => ({ top: palette["sand.path"] ?? "#EBCFAE", body: palette["rock.shade"] ?? "#3F5857", plat: palette["stone.shade"] ?? "#D9C3A0" }), [palette]);

  const firstZone = world?.zones[0];
  const [zoneId, setZoneId] = useState(firstZone?.id ?? "");
  const zone: Zone | undefined = world?.zones.find((z) => z.id === zoneId) ?? firstZone;
  const solvedIds = props.progress?.solvedIds;
  const solved = useMemo(() => new Set(solvedIds ?? []), [solvedIds]);
  const worldState: WorldState = props.worldState ?? EMPTY_WORLD_STATE;
  const flagsLocal = useRef(new Map<string, boolean>());
  const reqCtx = useCallback((): ReqCtx => {
    const flags = new Set(worldState.flags);
    for (const [id, on] of flagsLocal.current) {
      if (on) flags.add(id);
      else flags.delete(id);
    }
    return reqCtxOf(solved, { ...worldState, flags });
  }, [solved, worldState]);
  const model = useMemo(() => (zone && world ? buildSurfaces(zone, reqCtx(), world.stations) : null), [zone, world, reqCtx]);
  const edges = useMemo(() => (model ? sheerEdges(model.ground.points, model.maxStepUp) : []), [model]);
  const blockerList = useMemo(() => (world && zone ? blockersOf(world.stations, solved, zone.id) : []), [world, zone, solved]);

  // ---- mutable per-frame state (refs, never React state per frame)
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);
  const companionRef = useRef<HTMLImageElement>(null);
  const layerEls = useRef(new Map<number, { el: HTMLDivElement; set: string; sf: number; sfy: number; alpha: number }>());
  const facadeEls = useRef(new Map<string, { el: HTMLImageElement; alpha: number }>());
  const charRef = useRef<CharState | null>(null);
  const viewRef = useRef<CameraView>({ viewX: 0, viewY: 0, zoom: 1 });
  const vpRef = useRef({ w: 1280, h: 720 });
  const held = useRef(new Set<string>());
  const edgesIn = useRef(new Set<"hop" | "up" | "down" | "interact">());
  const walkRef = useRef<Walk | null>(null);
  const nearRef = useRef<Interactable | null>(null);
  const clock = useRef({ ms: 0, tSec: 0, fps: 60, lastInput: 0 });
  const approached = useRef(new Set<string>());
  const arenaFired = useRef(new Set<string>());
  const firedLocal = useRef(new Set<string>());
  const tracker = useRef(emptyTriggerTracker());
  const awaiting = useRef<{ target: InteractRef; resolve: () => void } | null>(null);
  const control = useRef<{ x: number; surface: string; resolve: () => void; deadline: number } | null>(null);
  const linkWaiters = useRef<(() => void)[]>([]);
  const arena = useRef<{ x0: number; x1: number } | null>(null);
  const transitioning = useRef(false);
  const shot = useRef<CameraView | null>(null);
  const segmentRef = useRef("");
  const [title, setTitle] = useState<{ text: string; sub: string | null } | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const zoneRef = useRef(zone);
  const modelRef = useRef(model);
  const edgesRef = useRef(edges);
  const blockersRef = useRef(blockerList);
  const reqRef = useRef(reqCtx);
  useEffect(() => {
    zoneRef.current = zone;
    modelRef.current = model;
    edgesRef.current = edges;
    blockersRef.current = blockerList;
    reqRef.current = reqCtx;
    // keep the player on its surface when the model changes (a bridge merged, a platform appeared)
    const c = charRef.current;
    if (c && model && !c.path) {
      const y = heightAt(model, c.surface, c.x);
      charRef.current = y === null ? spawn(model, c.x, "ground") : { ...c, y };
    }
  }, [zone, model, edges, blockerList, reqCtx]);

  const reqOk = (r: Requirement | null) => requirementMet(r, reqRef.current());
  const groundAt = (x: number, s = "ground") => {
    const m = modelRef.current;
    return m ? (heightAt(m, s, x) ?? heightAt(m, "ground", x) ?? 0) : 0;
  };

  // ---- spawn in the first zone
  useEffect(() => {
    if (!model || charRef.current || !zone) return;
    charRef.current = spawn(model, zone.entry.x, zone.entry.surface);
    viewRef.current = centredView(charRef.current, vpRef.current, zone, baseZoom(vpRef.current));
    setReady(true);
    propsRef.current.onHostEvent?.({ type: "ready" });
    propsRef.current.onHostEvent?.({ type: "zone_entered", zoneId: zone.id });
  }, [model, zone]);

  // ---- zone swap
  const enterZone = useCallback(
    async (next: string, x: number, surface: string) => {
      const w = propsRef.current.world;
      const nz = w?.zones.find((z) => z.id === next);
      if (!w || !nz) return;
      const prev = zoneRef.current?.id ?? "";
      if (transitioning.current) return;
      transitioning.current = true;
      if (fadeRef.current) fadeRef.current.style.opacity = "1";
      await new Promise((r) => setTimeout(r, 120));
      const m = buildSurfaces(nz, reqRef.current(), w.stations);
      charRef.current = spawn(m, x, surface);
      viewRef.current = centredView(charRef.current, vpRef.current, nz, baseZoom(vpRef.current));
      arena.current = null;
      setZoneId(next);
      if (prev && prev !== next) art?.swap(prev, next);
      await new Promise((r) => setTimeout(r, 120));
      if (fadeRef.current) fadeRef.current.style.opacity = "0";
      transitioning.current = false;
      propsRef.current.onHostEvent?.({ type: "zone_entered", zoneId: next });
    },
    [art],
  );

  // ---- keyboard (the DOM host has no Phaser capture; typing targets and the panel own their keys)
  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      if (isTypingTarget(ev.target as Element | null) || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const frozen = propsRef.current.frozen;
      const a = actionFor(ev.code, { context: runner.running ? "cutscene" : frozen ? "panel" : "explore", shift: ev.shiftKey });
      clock.current.lastInput = clock.current.ms;
      held.current.add(ev.code);
      if (!frozen && !runner.running && (ev.code === "Space" || ev.code.startsWith("Arrow"))) ev.preventDefault();
      if (!a || ev.repeat) return;
      if (a === "hop" || a === "up" || a === "down" || a === "interact") edgesIn.current.add(a);
      if (a === "interact" && awaiting.current) {
        const w = awaiting.current;
        awaiting.current = null;
        w.resolve();
      }
      if (a === "back") propsRef.current.onHostEvent?.({ type: "back" });
      if (a === "skip") runner.skip();
    };
    const up = (ev: KeyboardEvent) => held.current.delete(ev.code);
    const blur = () => held.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
    // the runner is stable for the host's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- viewport
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      vpRef.current = { w: el.clientWidth || 1280, h: el.clientHeight || 720 };
    });
    ro.observe(el);
    vpRef.current = { w: el.clientWidth || 1280, h: el.clientHeight || 720 };
    return () => ro.disconnect();
  }, []);

  const interactables = (): Interactable[] => {
    const w = propsRef.current.world;
    const z = zoneRef.current;
    if (!w || !z) return [];
    const out: Interactable[] = [];
    const push = (target: InteractTarget, x: number, y: number, surface: string | null, label: string) => out.push({ key: targetKey(target), target, x, y, surface, label });
    for (const st of w.stations.filter((s) => s.zoneId === z.id)) push({ kind: "station", encounterId: st.encounterId }, st.consoleX, groundAt(st.consoleX, st.consoleSurface) - 190, st.consoleSurface, interactLabel("station", st.objectNoun));
    for (const sb of w.sandboxes.filter((s) => s.zoneId === z.id && reqOk(s.requires))) push({ kind: "sandbox", sandboxId: sb.id }, sb.consoleX, groundAt(sb.consoleX, sb.surface) - 190, sb.surface, interactLabel("sandbox", sb.objectNoun));
    const rc = reqRef.current();
    for (const npc of w.overlay.npcs) {
      const st = [...npc.states].reverse().find((s) => requirementMet(s.requires, rc));
      if (st && st.zoneId === z.id && st.pose !== "hidden") push({ kind: "npc", npcId: npc.id, stateId: st.id }, st.x, groundAt(st.x, st.surface) - 250, null, interactLabel("npc", npc.name));
    }
    for (const pq of w.overlay.plaques.filter((p) => p.zoneId === z.id && reqOk(p.requires))) push({ kind: "plaque", plaqueId: pq.id }, pq.x, groundAt(pq.x, pq.surface) - 170, pq.surface, interactLabel("plaque", pq.title));
    for (const c of w.overlay.collectibles.filter((q) => q.zoneId === z.id && !(propsRef.current.worldState ?? EMPTY_WORLD_STATE).collected.has(q.id) && reqOk(q.requires)))
      push({ kind: "collectible", collectibleId: c.id }, c.x, (c.y ?? groundAt(c.x, c.surface)) - 90, c.surface, interactLabel("collectible", c.title.toLowerCase()));
    return out;
  };

  // ---- the frame
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dtMs = Math.min(50, now - last);
      last = now;
      clock.current.ms += dtMs;
      clock.current.tSec += dtMs / 1000;
      if (dtMs > 0) clock.current.fps = clock.current.fps * 0.9 + (1000 / dtMs) * 0.1;
      const z = zoneRef.current;
      const m = modelRef.current;
      const w = propsRef.current.world;
      let c = charRef.current;
      if (!z || !m || !w || !c) return;
      const p = propsRef.current;
      const cutscene = runner.running !== null;
      const allowMove = !!control.current || (!p.frozen && !cutscene);
      const edgesNow = edgesIn.current;
      edgesIn.current = new Set();
      const h = held.current;
      let inp: CharInput = allowMove
        ? { left: h.has("KeyA") || h.has("ArrowLeft"), right: h.has("KeyD") || h.has("ArrowRight"), run: h.has("ShiftLeft") || h.has("ShiftRight"), hop: edgesNow.has("hop"), up: edgesNow.has("up"), down: edgesNow.has("down"), interact: false }
        : NO_INPUT;
      const seg = z.segments.find((s) => s.id === segmentRef.current) ?? z.segments[0];
      const ctx = { model: m, edges: edgesRef.current, blockers: blockersRef.current, links: z.links, reqOk, tSec: clock.current.tSec, runEnabled: seg.runEnabled, speedScale: p.express ? 2 : 1, frozen: !allowMove && !walkRef.current };
      const wk = walkRef.current;
      if (wk && !c.path) {
        const step = wk.steps[wk.i];
        if (!step) {
          walkRef.current = null;
          wk.resolve();
        } else if (step.kind === "walk") {
          const t = inputToward(c, step.x, 3);
          if (!t || c.surface !== step.surface) wk.i++;
          else {
            inp = t;
            wk.stuckMs = Math.abs(c.x - wk.lastX) < 0.25 ? wk.stuckMs + dtMs : 0;
            wk.lastX = c.x;
            if (wk.stuckMs > 500) {
              walkRef.current = null;
              wk.resolve();
            }
          }
        } else if (step.kind === "walk_off") {
          if (c.surface !== step.surface) wk.i++;
          else inp = inputToward(c, step.x + step.facing * 80) ?? NO_INPUT;
        } else {
          const choice = linksInRange(z.links, { x: c.x, surface: c.surface }, { model: m, reqOk }).find((q) => q.link.id === step.linkId && q.dir === step.dir);
          if (!choice) inp = inputToward(c, step.startX, 3) ?? NO_INPUT;
          else if (choice.link.kind !== "timed_hop" || timedHopOpen(choice.link, clock.current.tSec)) {
            c = startPath(c, planChoice(choice, ctx));
            wk.i++;
          }
        }
      }
      if (control.current && !walkRef.current && clock.current.ms > control.current.deadline) inp = inputToward(c, control.current.x) ?? NO_INPUT;
      const r = stepCharacter(c, inp, ctx, dtMs / 1000);
      c = r.state;
      for (const e of r.events) {
        if (e.type !== "link_used") continue;
        p.onHostEvent?.({ type: "link_used", linkId: e.linkId, landed: e.landed });
        const ws = linkWaiters.current;
        linkWaiters.current = [];
        ws.forEach((f) => f());
      }
      // E: proximity first, then rides
      const items = interactables();
      const prevKey = nearRef.current?.key ?? null;
      nearRef.current = c.path ? null : nearest(items, { x: c.x, surface: c.surface }, prevKey);
      if ((nearRef.current?.key ?? null) !== prevKey) p.onHostEvent?.({ type: "near", target: nearRef.current?.target ?? null });
      if (edgesNow.has("interact") && allowMove && !c.path && !awaiting.current) {
        if (nearRef.current) p.onInteract?.(nearRef.current.target);
        else {
          const ride = linkForKey(c, "interact", ctx);
          if (ride) c = startPath(c, planChoice(ride, ctx));
        }
      }
      charRef.current = c;
      // triggers, approach, arena, exits
      if (!cutscene) {
        const ws = propsRef.current.worldState ?? EMPTY_WORLD_STATE;
        const res = stepTriggers(tracker.current, w.overlay.triggers, { zoneId: z.id, x: c.x, surface: c.surface }, { ...ws, fired: new Set([...ws.fired, ...firedLocal.current]) }, new Set(p.progress?.solvedIds ?? []), { idleMs: clock.current.ms - clock.current.lastInput, express: !!p.express });
        tracker.current = res.tracker;
        for (const t of res.fire) {
          if (t.once) firedLocal.current.add(t.id);
          p.onHostEvent?.({ type: "trigger", triggerId: t.id });
        }
        for (const st of w.stations.filter((s) => s.zoneId === z.id)) {
          if (!approached.current.has(st.encounterId) && Math.abs(c.x - st.consoleX) <= st.approachRadius) {
            approached.current.add(st.encounterId);
            p.onHostEvent?.({ type: "approach", encounterId: st.encounterId });
          }
          if (st.boss && !arenaFired.current.has(st.encounterId) && c.x >= st.boss.arenaTriggerX && !(p.progress?.solvedIds ?? []).includes(st.encounterId)) {
            arenaFired.current.add(st.encounterId);
            arena.current = st.boss.arenaBounds;
            p.onHostEvent?.({ type: "arena", encounterId: st.encounterId });
          }
        }
        if (!c.path && !transitioning.current) {
          const ex = z.exits.find((e) => c && c.surface === e.surface && c.x >= e.x - 1 && reqOk(e.requires));
          if (ex) void enterZone(ex.toZoneId, ex.toX, ex.toSurface);
        }
      }
      if (control.current && c.surface === control.current.surface && Math.abs(c.x - control.current.x) <= 24) {
        const cu = control.current;
        control.current = null;
        cu.resolve();
      }
      // camera
      const vp = vpRef.current;
      const layout = p.layout ?? DEFAULT_LAYOUT;
      const zf = { width: z.width, height: z.height, camera: z.camera };
      let target: CameraView;
      if (shot.current) target = shot.current;
      else if (layout.mode !== "explore" && layout.focus?.kind === "station") {
        const st = w.stationByEncounter.get(layout.focus.encounterId);
        const fb = st ? st.meta.frameBounds(st.parsedConfig, null) : { x: -420, y: -560, w: 840, h: 640 };
        const rect = st ? unionRect({ x: st.anchor.x + fb.x, y: st.anchor.y + fb.y, w: fb.w, h: fb.h }, { x: c.x - 70, y: c.y - 240, w: 140, h: 240 }) : { x: c.x - 400, y: c.y - 500, w: 800, h: 600 };
        const safe = layout.safeRect.w > 0 ? layout.safeRect : defaultSafeRect(layout.mode, vp);
        target = frameFor(rect, safe, vp, zf, st?.frameZoom ?? null);
      } else target = followView({ ...viewRef.current, zoom: baseZoom(vp) }, c, vp, zf, arena.current);
      const k = lerpFactor(layout.mode === "explore" && !shot.current ? z.camera.lerp : 0.25, dtMs);
      const v = viewRef.current;
      viewRef.current = { viewX: v.viewX + (target.viewX - v.viewX) * k, viewY: v.viewY + (target.viewY - v.viewY) * k, zoom: v.zoom + (target.zoom - v.zoom) * k };
      const view = viewRef.current;
      if (worldRef.current) worldRef.current.style.transform = `translate(${(-view.viewX * view.zoom).toFixed(1)}px, ${(-view.viewY * view.zoom).toFixed(1)}px) scale(${view.zoom.toFixed(4)})`;
      // parallax + crossfade
      const setW = layerSetWeights(z, c.x);
      for (const L of layerEls.current.values()) {
        L.el.style.transform = `translate(${(view.viewX * (1 - L.sf)).toFixed(1)}px, ${(view.viewY * (1 - L.sfy)).toFixed(1)}px)`;
        L.el.style.opacity = String(L.alpha * (setW.get(L.set) ?? 0));
      }
      const segW = crossfadeWeights(z, c.x);
      let best = -1;
      for (const [id, wt] of segW) {
        if (wt > best) {
          best = wt;
          segmentRef.current = id;
        }
      }
      const look = resolveSegmentLook(z.segments.find((s) => s.id === segmentRef.current) ?? z.segments[0], reqOk);
      if (skyRef.current) skyRef.current.style.background = `linear-gradient(180deg, ${[...look.sky.stops].sort((a, b) => a.at - b.at).map((s) => `${s.color} ${Math.round(s.at * 100)}%`).join(", ")})`;
      const inside = interiorAt(z, c.x);
      for (const [id, f] of facadeEls.current) {
        f.alpha = stepFacadeAlpha(f.alpha, inside?.id === id, dtMs);
        f.el.style.opacity = String(f.alpha);
      }
      // actors
      const sheet = art?.rig(w.overlay.cast.protagonist.look.atlas);
      if (sheet) setActor(actorRef.current, sheet, c.x, c.y, poseFrame(c.path ? c.motion : locomotion(c.vx), clock.current.tSec, new Set(sheet.poses)), c.facing);
      if (companionRef.current) companionRef.current.style.transform = `translate(${(c.x - 40 * c.facing - 42).toFixed(1)}px, ${(c.y - 190 + Math.sin(clock.current.tSec * 5) * 4).toFixed(1)}px)`;
      // labels
      labels.beginFrame(view);
      if (awaiting.current) labels.set({ id: "interact", kind: "interact", x: c.x, y: c.y - 250, text: "E · Continue" });
      else if (nearRef.current && !cutscene && !p.frozen) labels.set({ id: "interact", kind: "interact", x: nearRef.current.x, y: nearRef.current.y, text: nearRef.current.label });
      else if (!cutscene && !p.frozen && !c.path) {
        const ch = linksInRange(z.links, { x: c.x, surface: c.surface }, { model: m, reqOk })[0];
        if (ch) labels.set({ id: "interact", kind: "interact", x: ch.start.x, y: groundAt(ch.start.x, ch.start.surface) - 200, text: linkPrompt(ch) });
      }
      labels.endFrame();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // one loop for the host's life; it reads everything through refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [art, labels, enterZone]);

  // ---- cutscenes: S1's runner against a small DOM stage
  const stage: CutsceneStage = useMemo(
    () => ({
      fade: async (to, ms) => {
        if (fadeRef.current) {
          fadeRef.current.style.transition = `opacity ${ms}ms`;
          fadeRef.current.style.background = to === "white" ? "#fff" : "#000";
          fadeRef.current.style.opacity = to === "clear" ? "0" : "1";
        }
        await new Promise((r) => setTimeout(r, ms));
      },
      title: async (text, sub, ms) => {
        setTitle({ text, sub });
        await new Promise((r) => setTimeout(r, ms));
        setTitle(null);
      },
      enterZone: (id, x, s) => enterZone(id, x, s),
      pan: async (x, y, zoom, ms) => {
        const vp = vpRef.current;
        const z = zoom * baseZoom(vp);
        shot.current = { viewX: x - vp.w / z / 2, viewY: (y ?? viewRef.current.viewY + vp.h / viewRef.current.zoom / 2) - vp.h / z / 2, zoom: z };
        await new Promise((r) => setTimeout(r, ms));
      },
      camera: async (x, y, zoom, ms) => {
        const vp = vpRef.current;
        const v = viewRef.current;
        const z = zoom === null ? v.zoom : zoom * baseZoom(vp);
        shot.current = { viewX: (x ?? v.viewX + vp.w / v.zoom / 2) - vp.w / z / 2, viewY: (y ?? v.viewY + vp.h / v.zoom / 2) - vp.h / z / 2, zoom: z };
        await new Promise((r) => setTimeout(r, ms));
      },
      walk: async (actor, toX) => {
        if (actor === "player") await handle.walkTo?.(toX);
      },
      emote: () => {},
      station: async () => {},
      hub: async () => {},
      ride: async ({ toZoneId, toX, toSurface, ms }) => {
        await new Promise((r) => setTimeout(r, Math.min(ms, 600)));
        await enterZone(toZoneId, toX, toSurface);
      },
      // cues and music play on the client's audio bus (TODO(w1): typed once HostEvent carries them, see ExpeditionHost)
      sfx: (cue) => (propsRef.current.onHostEvent as ((e: unknown) => void) | undefined)?.({ type: "cue", cue }),
      music: (cue) => (propsRef.current.onHostEvent as ((e: unknown) => void) | undefined)?.({ type: "music", cue }),
      awaitInteract: (target, _prompt, timeoutMs) =>
        new Promise<void>((resolve) => {
          awaiting.current = { target, resolve };
          if (timeoutMs !== null)
            setTimeout(() => {
              if (awaiting.current?.target === target) {
                awaiting.current = null;
                resolve();
              }
            }, timeoutMs);
        }),
      controlUntil: (x, surface, _prompt, timeoutMs) =>
        new Promise<void>((resolve) => {
          control.current = { x, surface, resolve, deadline: clock.current.ms + timeoutMs };
        }),
      vista: async (asset, _from, _to, ms, holdMs) => {
        setVista(art?.url(asset) ?? null);
        await new Promise((r) => setTimeout(r, ms + holdMs));
        setVista(null);
      },
      setState: (target, state) => {
        if (target.kind === "flag") flagsLocal.current.set(target.id, state === "on");
      },
      applyEndState: (end) => {
        awaiting.current = null;
        control.current = null;
        shot.current = null;
        if (end.zone) {
          if (end.zone.zoneId !== zoneRef.current?.id) void enterZone(end.zone.zoneId, end.zone.x, end.zone.surface);
          else if (modelRef.current) charRef.current = spawn(modelRef.current, end.zone.x, end.zone.surface);
        }
        for (const [id, on] of Object.entries(end.flags)) flagsLocal.current.set(id, on);
        setVista(null);
        setTitle(null);
        if (fadeRef.current) fadeRef.current.style.opacity = "0";
      },
    }),
    // the handle is stable enough through refs; the stage lives as long as the host
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [art, enterZone],
  );
  const runner = useMemo(
    () =>
      new CutsceneRunner({
        stage,
        say: (req) => propsRef.current.onSay?.(req),
        onFlag: (id, on) => {
          flagsLocal.current.set(id, on);
          // the client's world-state reducer owns flags (TODO(w1): typed once HostEvent carries `flag`)
          (propsRef.current.onHostEvent as ((e: unknown) => void) | undefined)?.({ type: "flag", id, on });
        },
        guideId: world?.overlay.cast.guide.characterId ?? "narrator",
      }),
    [stage, world],
  );

  const debug = (): ExpeditionHostDebug => {
    const c = charRef.current;
    const z = zoneRef.current;
    const m = modelRef.current;
    const v = viewRef.current;
    const inRange = c && z && m ? linksInRange(z.links, { x: c.x, surface: c.surface }, { model: m, reqOk }) : [];
    return {
      ready: ready && !!c,
      zoneId: z?.id ?? "",
      segmentId: segmentRef.current,
      playerX: c?.x ?? 0,
      playerY: c?.y ?? 0,
      surface: c?.surface ?? "ground",
      cameraX: v.viewX,
      cameraY: v.viewY,
      zoom: v.zoom,
      textures: art?.size ?? 0,
      near: nearRef.current?.target ?? null,
      links: (z?.links ?? []).map((l) => ({ id: l.id, kind: l.kind, inRange: inRange.some((q) => q.link.id === l.id), open: l.kind === "timed_hop" ? timedHopOpen(l, clock.current.tSec) : null })),
      contraption: () => null,
      cutscene: runner.running,
      fps: Math.round(clock.current.fps),
      drawObjects: stageRef.current?.querySelectorAll("img, [data-testid=dom-layer]").length ?? 0,
    };
  };

  const handle: HostHandle & { interact(): void; freezeFx(on: boolean): void } = {
    // H2: pressing E (the client's __GAME_DEBUG__.expedition.interact); the DOM host has no clocks to freeze
    interact: () => edgesIn.current.add("interact"),
    freezeFx: () => {},
    warpTo: (id) => {
      runner.cancel();
      walkRef.current?.resolve();
      walkRef.current = null;
      const w = propsRef.current.world;
      const st = id ? w?.stationByEncounter.get(id) : undefined;
      const z = st ? w?.zones.find((q) => q.id === st.zoneId) : w?.zones[0];
      if (!w || !z) return;
      const x = st ? Math.max(40, st.consoleX - 70) : z.entry.x;
      const s = st?.consoleSurface ?? z.entry.surface;
      if (z.id !== zoneRef.current?.id) void enterZone(z.id, x, s);
      else if (modelRef.current) charRef.current = spawn(modelRef.current, x, s);
    },
    bindDraft: () => {},
    setAidTier: () => {},
    onHint: () => {},
    resolveEncounter: () => new Promise((r) => setTimeout(r, 600)),
    openSandbox: () => {},
    bindSandboxDraft: () => {},
    closeSandbox: () => {},
    playCutscene: async (id) => {
      const c: Cutscene | undefined = propsRef.current.world?.overlay.cutscenes.find((q) => q.id === id);
      if (!c) return;
      propsRef.current.onHostEvent?.({ type: "cutscene", id, state: "start" });
      const ch = charRef.current;
      try {
        await runner.run(c, { start: ch ? { zoneId: zoneRef.current?.id ?? "", x: ch.x, surface: ch.surface } : null, trim: !!propsRef.current.express && id !== propsRef.current.world?.overlay.story.finaleCutsceneId });
      } finally {
        shot.current = null;
        awaiting.current = null;
        control.current = null;
        propsRef.current.onHostEvent?.({ type: "cutscene", id, state: "end" });
      }
    },
    skipCutscene: () => runner.skip(),
    walkTo: (x, surface) =>
      new Promise<void>((resolve) => {
        const c = charRef.current;
        const z = zoneRef.current;
        const m = modelRef.current;
        if (!c || !z || !m) return resolve();
        walkRef.current?.resolve();
        const route = planRoute({ model: m, links: z.links, edges: edgesRef.current, blockers: blockersRef.current, reqOk }, { surface: c.surface, x: c.x }, { x, surface }) ?? [{ kind: "walk", surface: c.surface, x }];
        walkRef.current = { steps: route, i: 0, resolve, stuckMs: 0, lastX: c.x };
      }),
    useLink: async (id) => {
      const z = zoneRef.current;
      const m = modelRef.current;
      const link = z?.links.find((l) => l.id === id);
      if (!z || !m || !link) return;
      const pick = () => {
        const c = charRef.current;
        return c ? linksInRange(z.links, { x: c.x, surface: c.surface }, { model: m, reqOk }, 1e6).filter((q) => q.link.id === id).sort((a, b) => a.distance - b.distance)[0] : undefined;
      };
      let choice = pick();
      if (!choice || choice.distance > 70) {
        const ends = [link.from, ...("twoWay" in link && link.twoWay ? [link.to] : [])];
        const c = charRef.current;
        const best = ends.map((e) => ({ e, d: Math.abs(e.x - (c?.x ?? 0)) })).sort((a, b) => a.d - b.d)[0];
        await handle.walkTo?.(best.e.x, best.e.surface ?? "ground");
        choice = pick();
      }
      const c = charRef.current;
      if (!choice || !c || choice.distance > 70 || c.path) return;
      const landed = new Promise<void>((r) => linkWaiters.current.push(r));
      charRef.current = startPath(c, planLink(choice, m, { tSec: clock.current.tSec }));
      await landed;
    },
    debug,
  };
  const handleRef = useRef(handle);
  useEffect(() => {
    handleRef.current = handle;
  });
  useImperativeHandle(ref, () => handle);

  useEffect(() => {
    if (!ready) return;
    return installHostDebug(
      makeHostDebugApi(
        {
          warpTo: (id) => handleRef.current.warpTo(id),
          walkTo: (x, s) => handleRef.current.walkTo?.(x, s) ?? Promise.resolve(),
          useLink: (id) => handleRef.current.useLink?.(id) ?? Promise.resolve(),
          skipCutscene: () => handleRef.current.skipCutscene?.(),
          debug: () => handleRef.current.debug?.() as ExpeditionHostDebug,
        },
        {
          renderer: "dom",
          interact: () => edgesIn.current.add("interact"),
          freeze: () => {},
          layers: () => [...layerEls.current.values()].map((l) => ({ set: l.set, alpha: Number(l.el.style.opacity || 0), scrollFactor: l.sf })),
          facadeAlpha: (id) => facadeEls.current.get(id)?.alpha ?? null,
          capturing: () => false,
        },
      ),
    );
  }, [ready]);

  const registerLayer = useCallback((i: number, el: HTMLDivElement | null, meta: { set: string; sf: number; sfy: number; alpha: number }) => {
    if (el) layerEls.current.set(i, { el, ...meta });
    else layerEls.current.delete(i);
  }, []);
  const registerFacade = useCallback((id: string, el: HTMLImageElement | null) => {
    if (el) facadeEls.current.set(id, { el, alpha: facadeEls.current.get(id)?.alpha ?? 1 });
    else facadeEls.current.delete(id);
  }, []);

  if (!world || !zone || !model || !art) {
    return <div data-testid="dom-host" role="status" style={{ padding: 24, fontSize: 20 }}>This expedition has no world to show.</div>;
  }
  const sheet = art.rig(world.overlay.cast.protagonist.look.atlas);
  const collected = (props.worldState ?? EMPTY_WORLD_STATE).collected;
  const rc = reqCtx();
  const npcs = world.overlay.npcs.flatMap((npc) => {
    const st = [...npc.states].reverse().find((q) => requirementMet(q.requires, rc));
    return st && st.zoneId === zone.id && st.pose !== "hidden" ? [{ npc, st, y: heightAt(model, st.surface, st.x) ?? 0 }] : [];
  });
  return (
    <div ref={stageRef} data-testid="dom-host" data-renderer="dom" style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#20303a" }}>
      <div ref={skyRef} aria-hidden="true" style={{ position: "absolute", inset: 0 }} />
      <div ref={worldRef} key={zone.id} style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", willChange: "transform" }}>
        <DomStage world={world} zone={zone} model={model} solved={solved} collected={collected} art={art} colors={colors} registerLayer={registerLayer} registerFacade={registerFacade} />
        {npcs.map(({ npc, st, y }) =>
          npc.look ? (
            <div key={npc.id} role="img" aria-label={npc.name} style={{ position: "absolute", left: st.x - 84, top: y - 224, width: 168, height: 224, backgroundImage: `url(${art.rig(npc.look.atlas).url})`, backgroundRepeat: "no-repeat", zIndex: 70 }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={npc.id} src={art.url(npc.asset ?? "")} alt={npc.name} style={{ position: "absolute", left: st.x - 65, top: y - 210, width: 130, height: 210, maxWidth: "none", zIndex: 70 }} />
          ),
        )}
        <DomActor ref={actorRef} sheet={sheet} label={world.overlay.cast.protagonist.name} testId="dom-player" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={companionRef} src={art.url(world.overlay.cast.guide.companion.asset)} alt="" style={{ position: "absolute", left: 0, top: 0, width: 84, height: 84, maxWidth: "none", zIndex: 72, pointerEvents: "none" }} />
      </div>
      <WorldLabelLayer store={labels} />
      <div ref={fadeRef} aria-hidden="true" style={{ position: "absolute", inset: 0, background: "#000", opacity: 0, pointerEvents: "none", zIndex: 5 }} />
      {vista && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vista} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 4 }} />
      )}
      {title && (
        <div data-testid="title-card" role="status" style={{ position: "absolute", left: "50%", top: "38%", transform: "translate(-50%, -50%)", textAlign: "center", color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.6)", zIndex: 6 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 56 }}>{title.text}</div>
          {title.sub && <div style={{ fontSize: 24 }}>{title.sub}</div>}
        </div>
      )}
    </div>
  );
});
