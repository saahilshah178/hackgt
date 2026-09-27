"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import type { GameSpec } from "../../../../contracts/gamespec";
import type { Palette } from "../../../engine/palettes";
import { speakerName, type BoardHostHandle, type BoardHostProps } from "../../types";
import {
  ALCOVE,
  DIRS,
  SENTRY_MS,
  STEP_MS,
  buildExplorerMap,
  caughtBy,
  finalePaths,
  gateOpen,
  isWalkable,
  LABEL_MARGIN,
  LABEL_W,
  labelSlots,
  luminance,
  mixHex,
  needsFor,
  pathToStation,
  pathToTile,
  placeName,
  roomOf,
  roomTrail,
  sentryAt,
  sentryFacing,
  shouldWait,
  socketLabel,
  splitName,
  stationsNear,
  tileKind,
  visibleRooms,
  type Dir,
  type ExplorerMap,
  type ExplorerStation,
  type Pt,
} from "./explorer.logic";
import { CheckGlyph, PadlockGlyph, SocketGlyph } from "./glyphs";
import { GUIDE_TIP } from "../../teach/lessons";

/*
 * Explorer: a bird's-eye maze. The player walks an avatar token from the central crossroads out along one wing per
 * progression track; each room holds a station (an encounter), each deeper room sits behind a gate that swings open
 * when the previous station on its wing is solved, and sentries pace lanes across the corridors. All layout and rules
 * live in explorer.logic.ts; this file draws the map (SVG terrain + an HTML layer for tokens and labels) and runs the
 * movement and sentry clocks.
 */

type Props = BoardHostProps & { hostRef?: (h: BoardHostHandle | null) => void };
type StationState = "locked" | "available" | "solved";

const SIDE_W = 600;
const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  W: "up",
  s: "down",
  S: "down",
  a: "left",
  A: "left",
  d: "right",
  D: "right",
};
const SENTRY_RED = "#ff6b5b";

interface Colors {
  ground: string;
  speck: string;
  wallHi: string;
  wallLo: string;
  floor: string;
  floorLine: string;
  hall: string;
  lane: string;
  fog: string;
  fogLine: string;
  accent: string;
  player: string;
  text: string;
  gate: string;
  tree: string;
  treeHi: string;
}

function colorsFor(p: Palette): Colors {
  const dark = luminance(p.css.background) < 0.3;
  const ground = dark ? mixHex(p.css.background, p.css.floor, 0.5) : mixHex(p.css.floor, p.css.wall, 0.35);
  const floor = dark ? mixHex(p.css.floor, "#ffffff", 0.1) : mixHex(p.css.background, "#ffffff", 0.2);
  return {
    ground,
    speck: mixHex(ground, dark ? "#ffffff" : "#000000", 0.08),
    wallHi: mixHex(p.css.floor, "#ffffff", dark ? 0.32 : 0.1),
    wallLo: mixHex(p.css.wall, "#000000", 0.25),
    floor,
    floorLine: mixHex(floor, "#000000", dark ? 0.35 : 0.18),
    hall: mixHex(floor, ground, 0.35),
    lane: mixHex(ground, "#000000", 0.3),
    fog: mixHex(ground, "#000000", 0.18),
    fogLine: mixHex(ground, "#ffffff", 0.28),
    accent: p.css.accent,
    player: p.css.player,
    text: "#f5f3ee",
    gate: mixHex(p.css.wall, "#8a8a8a", 0.35),
    tree: mixHex(ground, "#4f6b2c", 0.45),
    treeHi: mixHex(ground, "#8aa04a", 0.4),
  };
}

const same = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;

interface Game {
  pos: Pt;
  dir: Dir;
  path: Pt[];
  pendingOpen: string | null;
  held: Dir | null;
  lastStep: number;
  t: number;
  visited: Set<string>;
  warp: number;
}

interface View {
  pos: Pt;
  dir: Dir;
  t: number;
  visited: string[];
  warp: number;
  walking: boolean;
}

function snapshot(g: Game): View {
  return { pos: g.pos, dir: g.dir, t: g.t, visited: [...g.visited], warp: g.warp, walking: g.path.length > 0 };
}

export function ExplorerHost(props: Props) {
  const { spec, palette, progression, solved, available, activeId, finished, lastResult } = props;
  const map = useMemo(() => buildExplorerMap(spec, progression), [spec, progression]);
  const slots = useMemo(() => labelSlots(map), [map]);
  const colors = useMemo(() => colorsFor(palette), [palette]);

  // ---- mutable game state (read by clocks and handlers) + a render snapshot
  const gameRef = useRef<Game>({
    pos: map.start,
    dir: "down",
    path: [],
    pendingOpen: null,
    held: null,
    lastStep: 0,
    t: 0,
    visited: new Set([map.plazaId]),
    warp: 0,
  });
  const [view, setView] = useState<View>(() => ({ pos: map.start, dir: "down", t: 0, visited: [map.plazaId], warp: 0, walking: false }));
  const sync = useCallback(() => setView(snapshot(gameRef.current)), []);

  // sentries default on, off under prefers-reduced-motion (this host only ever renders on the client)
  const [sentriesOn, setSentriesOn] = useState(() => typeof window === "undefined" || !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((text: string) => {
    setToast((t) => ({ text, n: (t?.n ?? 0) + 1 }));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  // latest props for the clocks and window listeners
  const live = useRef({ props, sentriesOn, map });
  useEffect(() => {
    live.current = { props, sentriesOn, map };
  });


  // ---- core moves
  const nameOf = useCallback((id: string) => map.roomById.get(map.stationByEncounter.get(id)?.roomId ?? "")?.name ?? id, [map]);

  const arriveAt = useCallback(
    (id: string) => {
      const { props: pr } = live.current;
      const s = map.stationByEncounter.get(id);
      if (!s) return;
      if (pr.available.includes(id)) pr.open(id);
      else if (pr.solved.has(id)) say(`Solved already: ${nameOf(id)}`);
      else say(`Locked. Needs: ${needsFor(pr.spec, pr.progression, id, pr.solved).join(", ")}`);
    },
    [map, nameOf, say],
  );

  const spotted = useCallback(
    (track: number) => {
      const g = gameRef.current;
      g.pos = map.wingEntrances[track] ?? map.start;
      g.path = [];
      g.pendingOpen = null;
      g.warp++;
      say("Spotted! Back to the crossroads.");
    },
    [map, say],
  );

  /** move one tile (arrow keys or a path step); returns false when blocked */
  const stepTo = useCallback(
    (next: Pt, dir: Dir): boolean => {
      const { props: pr, sentriesOn: on } = live.current;
      const g = gameRef.current;
      g.dir = dir;
      if (!isWalkable(map, next, pr.solved)) return false;
      g.pos = next;
      g.lastStep = performance.now();
      const room = roomOf(map, next);
      if (room) g.visited.add(room.id);
      if (on) {
        const s = caughtBy(map, next, g.t);
        if (s) spotted(s.track);
      }
      return true;
    },
    [map, spotted],
  );

  const stepDir = useCallback(
    (dir: Dir) => {
      const g = gameRef.current;
      g.path = [];
      g.pendingOpen = null;
      const d = DIRS[dir];
      const next = { x: g.pos.x + d.x, y: g.pos.y + d.y };
      const moved = stepTo(next, dir);
      if (!moved) {
        const gate = map.gates.find((x) => x.tiles.some((t) => same(t, next)));
        if (gate && !gateOpen(gate, live.current.props.solved)) {
          const room = map.roomById.get(gate.roomId)!;
          say(gate.kind === "door" ? "The heart's door is sealed until every other station is solved." : `Gate closed. Solve ${nameOf(gate.opensAfter[0])} to open the way to ${room.name}.`);
        }
      }
      sync();
    },
    [map, nameOf, say, stepTo, sync],
  );

  const interact = useCallback(() => {
    const { props: pr } = live.current;
    const near = stationsNear(map, gameRef.current.pos);
    if (near.length === 0) {
      say("No station here. Walk next to a pedestal, or click one.");
      return;
    }
    const pick = near.find((s) => pr.available.includes(s.encounterId)) ?? near[0];
    arriveAt(pick.encounterId);
  }, [map, arriveAt, say]);

  const walkToStation = useCallback(
    (id: string) => {
      const { props: pr } = live.current;
      if (pr.activeId || pr.finished) return;
      const g = gameRef.current;
      const path = pathToStation(map, g.pos, id, pr.solved);
      if (!path) {
        const room = map.roomById.get(map.stationByEncounter.get(id)!.roomId)!;
        const gate = map.gates.find((x) => x.roomId === room.id);
        say(gate?.kind === "door" ? "The heart's door is sealed until every other station is solved." : `No way in yet: the gate to ${room.name} is closed.`);
        return;
      }
      g.held = null;
      if (path.length === 0) {
        g.path = [];
        g.pendingOpen = null;
        arriveAt(id);
        return;
      }
      g.path = path;
      g.pendingOpen = id;
      sync();
    },
    [map, arriveAt, say, sync],
  );

  const walkToTile = useCallback(
    (to: Pt) => {
      const { props: pr } = live.current;
      if (pr.activeId || pr.finished) return;
      const g = gameRef.current;
      const path = pathToTile(map, g.pos, to, pr.solved);
      if (!path) {
        if (tileKind(map, to) !== 0) say("Can't get there yet: a gate is closed.");
        return;
      }
      g.held = null;
      g.path = path;
      g.pendingOpen = null;
      sync();
    },
    [map, say, sync],
  );

  // ---- clocks: movement (8 tiles/s) and sentries (one tile per SENTRY_MS)
  useEffect(() => {
    const id = setInterval(() => {
      const { props: pr, sentriesOn: on } = live.current;
      if (pr.activeId || pr.finished) return;
      const g = gameRef.current;
      if (g.path.length > 0) {
        const next = g.path[0];
        if (on && shouldWait(map, next, g.t)) return;
        const d = { x: next.x - g.pos.x, y: next.y - g.pos.y };
        const dir: Dir = d.x > 0 ? "right" : d.x < 0 ? "left" : d.y > 0 ? "down" : "up";
        const warpBefore = g.warp;
        if (!stepTo(next, dir)) {
          g.path = [];
          g.pendingOpen = null;
        } else if (g.warp === warpBefore) {
          g.path.shift();
          if (g.path.length === 0 && g.pendingOpen) {
            const target = g.pendingOpen;
            g.pendingOpen = null;
            arriveAt(target);
          }
        }
        sync();
      } else if (g.held && performance.now() - g.lastStep >= STEP_MS - 15) {
        const d = DIRS[g.held];
        stepTo({ x: g.pos.x + d.x, y: g.pos.y + d.y }, g.held);
        sync();
      }
    }, STEP_MS);
    return () => clearInterval(id);
  }, [map, stepTo, arriveAt, sync]);

  useEffect(() => {
    const id = setInterval(() => {
      const { props: pr, sentriesOn: on } = live.current;
      if (!on || pr.activeId || pr.finished || map.sentries.length === 0) return;
      const g = gameRef.current;
      g.t++;
      const s = caughtBy(map, g.pos, g.t);
      if (s) spotted(s.track);
      sync();
    }, SENTRY_MS);
    return () => clearInterval(id);
  }, [map, spotted, sync]);

  // ---- keyboard: only when focus is on the map or nowhere (never while typing in the challenge panel)
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const { props: pr } = live.current;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as Node | null;
      const onMap = target === document.body || target === document.documentElement || (target !== null && mapRef.current?.contains(target));
      if (!onMap) return;
      // Escape from the map leaves an open challenge (inside the panel, the panel handles Escape itself)
      if (e.key === "Escape" && pr.activeId) {
        pr.close();
        return;
      }
      if (pr.activeId || pr.finished) return;
      const dir = KEY_DIRS[e.key];
      if (dir) {
        e.preventDefault();
        if (e.repeat) return;
        gameRef.current.held = dir;
        stepDir(dir);
        return;
      }
      const onButton = target instanceof HTMLElement && target.tagName === "BUTTON";
      if (e.key === "e" || e.key === "E" || ((e.key === "Enter" || e.key === " ") && !onButton)) {
        e.preventDefault();
        interact();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const dir = KEY_DIRS[e.key];
      if (dir && gameRef.current.held === dir) gameRef.current.held = null;
    };
    const onBlur = () => (gameRef.current.held = null);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [stepDir, interact]);

  // ---- focus: into the challenge panel when one opens (the section itself, so a Space keyup can't pick an answer),
  // back to the map when it closes, so arrows and E keep working without a mouse
  const hadChallenge = useRef(false);
  useEffect(() => {
    if (!activeId) {
      const el = document.activeElement;
      if (hadChallenge.current && (!el || el === document.body || !el.isConnected)) mapRef.current?.focus({ preventScroll: true });
      hadChallenge.current = false;
      return;
    }
    hadChallenge.current = true;
    const t = setTimeout(() => {
      const panel = document.querySelector<HTMLElement>(`[data-testid="challenge-panel"][data-encounter="${activeId}"]`);
      if (!panel || panel.contains(document.activeElement)) return;
      if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
      panel.focus({ preventScroll: true });
    }, 30);
    return () => clearTimeout(t);
  }, [activeId]);

  // ---- warpTo for the debug hooks (skipTo / autoSolve)
  useEffect(() => {
    const hostRef = live.current.props.hostRef;
    const warpTo = (id: string | null) => {
      const g = gameRef.current;
      const s = id ? map.stationByEncounter.get(id) : undefined;
      g.pos = s?.approach[0] ?? map.start;
      g.path = [];
      g.pendingOpen = null;
      g.held = null;
      g.warp++;
      if (s) for (const r of roomTrail(map, s.roomId)) g.visited.add(r);
      sync();
    };
    hostRef?.({ warpTo });
    return () => hostRef?.(null);
  }, [map, sync]);

  // ---- measure the map area: tiles as large as fit (the side column is fixed, so nothing shifts)
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 960, h: 780 });
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setArea({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tile = Math.max(12, Math.min(44, Math.floor(Math.min((area.w - 8) / map.cols, (area.h - 8) / (map.rows + 2 * LABEL_MARGIN)))));

  // ---- derived state
  const solvedKey = [...solved].sort().join(",");
  const visible = useMemo(() => visibleRooms(map, new Set(view.visited), solved), [map, view.visited, solved]);
  const visibleKey = [...visible].sort().join(",");
  const stateOf = (id: string): StationState => (solved.has(id) ? "solved" : available.includes(id) ? "available" : "locked");
  const place = placeName(map, view.pos);
  const near = stationsNear(map, view.pos);
  const finale = finished && !activeId;
  const onMapClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    walkToTile({ x: Math.floor((e.clientX - r.left) / tile), y: Math.floor((e.clientY - r.top) / tile) });
  };

  const px = (v: number) => v * tile;

  return (
    <div
      data-testid="explorer-host"
      className="ex-root flex gap-3"
      style={{ height: "calc(100vh - 84px)", minHeight: 560, color: colors.text }}
    >
      <style>{STYLES}</style>
      {/* ------------------------------------------------------------------ map */}
      <div
        ref={areaRef}
        className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl"
        style={{ background: mixHex(colors.ground, "#000000", 0.35) }}
      >
        <div
          ref={mapRef}
          tabIndex={0}
          role="application"
          aria-label="Map. Arrow keys or W A S D walk; E, Enter or Space uses the station next to you; Tab moves between stations."
          aria-describedby="explorer-place"
          className="ex-map relative outline-none"
          style={{ width: px(map.cols), height: px(map.rows), margin: `${px(LABEL_MARGIN)}px 0` }}
          data-testid="explorer-map"
        >
          <div className="absolute inset-0" onClick={onMapClick}>
            <Terrain map={map} colors={colors} tile={tile} />
            <FogAndGates map={map} colors={colors} visibleKey={visibleKey} solvedKey={solvedKey} finale={finale} />
          </div>

          {/* room labels: in a clear band above/below the room, else one line along its free top row */}
          {map.rooms.map((room) => {
            if (!visible.has(room.id)) return null;
            const placement = slots.get(room.id) ?? { slot: "inside", rows: 1, heading: false };
            const slot = placement.slot;
            const { title, detail } = splitName(room.name);
            const cx = px(room.x + room.w / 2);
            const pill: CSSProperties = { fontSize: 16, background: "rgba(12,8,6,0.74)", boxShadow: "0 1px 0 rgba(255,255,255,0.08) inset", color: colors.text };
            if (slot === "inside" && room.kind === "heart") {
              // below the boss pedestal, inside the chamber
              const width = px(room.w - 0.6);
              return (
                <div key={room.id} className="ex-label pointer-events-none absolute flex justify-center" style={{ left: cx - width / 2, top: px(room.y + 4.25), width }} title={room.name}>
                  <span className="line-clamp-2 rounded-md px-2 text-center font-semibold leading-tight" style={pill}>
                    {title}
                  </span>
                </div>
              );
            }
            if (slot === "inside") {
              const width = room.kind === "plaza" ? px(room.w) : px(room.w + 1.6);
              return (
                <div key={room.id} className="ex-label pointer-events-none absolute flex justify-center" style={{ left: cx - width / 2, top: px(room.y) + (room.round ? tile * 0.12 : tile * 0.5 - 12), width }} title={room.name}>
                  <span className="max-w-full truncate rounded-md px-2 font-semibold leading-snug" style={pill}>
                    {room.kind === "plaza" ? room.name : title}
                  </span>
                </div>
              );
            }
            const width = px(LABEL_W) - 4;
            const style: CSSProperties =
              slot === "above" ? { left: cx - width / 2, bottom: px(map.rows - room.y) + tile * 0.4, width } : { left: cx - width / 2, top: px(room.y + room.h) + tile * 0.4, width };
            return (
              <div key={room.id} className="ex-label pointer-events-none absolute flex justify-center" style={style}>
                <span className="rounded-md px-2 py-0.5 text-center font-semibold leading-tight" style={pill}>
                  {placement.heading && (
                    <span className="block font-bold uppercase tracking-widest" style={{ color: colors.accent, fontSize: 13 }}>
                      Heart chamber
                    </span>
                  )}
                  {title}
                  {detail && (
                    <span className="block font-normal opacity-85" style={{ fontSize: 15 }}>
                      {detail}
                    </span>
                  )}
                </span>
              </div>
            );
          })}

          {/* stations */}
          {map.stations.map((s) => {
            const id = s.encounterId;
            const st = stateOf(id);
            const room = map.roomById.get(s.roomId)!;
            const fogged = !visible.has(room.id);
            const big = room.kind === "heart";
            const size = big ? tile * 2.4 : tile * 1.4;
            const flash = lastResult && lastResult.encounterId === id ? lastResult : null;
            const needs = st === "locked" ? needsFor(spec, progression, id, solved) : [];
            return (
              <div key={id} className="absolute" style={{ left: px(s.center.x) - size / 2, top: px(s.center.y) - size / 2, width: size, height: size }}>
                <button
                  type="button"
                  data-testid={`node-${id}`}
                  data-state={st}
                  aria-label={`${socketLabel(s.socket)}: ${room.name}. ${st === "available" ? "Open" : st === "solved" ? "Solved" : `Locked, needs ${needs.join(", ")}`}.`}
                  onClick={(e) => {
                    e.stopPropagation();
                    walkToStation(id);
                  }}
                  className="ex-station block h-full w-full rounded-full"
                  tabIndex={fogged && st !== "available" ? -1 : undefined}
                  style={{ opacity: fogged && st !== "available" ? 0 : 1 }}
                >
                  <Pedestal station={s} state={st} colors={colors} active={activeId === id} big={big} flashKey={flash ? `${flash.seq}-${flash.correct}` : null} flashCorrect={flash?.correct ?? false} finale={finale} />
                </button>
                {st === "locked" && !fogged && needs.length > 0 && !big && (
                  <div
                    className="pointer-events-none absolute left-1/2 whitespace-nowrap rounded px-1.5 font-semibold"
                    style={{ top: size + 2, transform: "translateX(-50%)", fontSize: 16, background: "rgba(12,8,6,0.8)", color: colors.text, maxWidth: px(6), overflow: "hidden", textOverflow: "ellipsis" }}
                    title={`Needs: ${needs.join(", ")}`}
                  >
                    Needs: {splitName(needs[0]).title}
                    {needs.length > 1 ? ` +${needs.length - 1}` : ""}
                  </div>
                )}
              </div>
            );
          })}

          {/* sentries */}
          {sentriesOn &&
            !finale &&
            map.sentries.map((s) => {
              const corridor = map.corridors.find((c) => c.id === s.corridorId)!;
              if (!visible.has(corridor.from)) return null;
              const at = sentryAt(s, view.t);
              const facing = sentryFacing(s, view.t);
              return (
                <div
                  key={s.id}
                  className="ex-token pointer-events-none absolute left-0 top-0"
                  data-testid="explorer-sentry"
                  style={{ width: tile * 1.15, height: tile * 1.15, transform: `translate(${px(at.x) - tile * 0.075}px, ${px(at.y) - tile * 0.075}px)`, transition: `transform ${SENTRY_MS - 40}ms linear` }}
                >
                  <SentryToken facing={facing} />
                </div>
              );
            })}

          {/* the avatar */}
          <div
            key={`avatar-${view.warp}`}
            className="ex-token ex-avatar pointer-events-none absolute left-0 top-0"
            data-testid="explorer-avatar"
            data-x={view.pos.x}
            data-y={view.pos.y}
            style={{ width: tile * 1.25, height: tile * 1.25, transform: `translate(${px(view.pos.x) - tile * 0.125}px, ${px(view.pos.y) - tile * 0.125}px)`, transition: `transform ${STEP_MS - 10}ms linear` }}
          >
            <AvatarToken dir={view.dir} color={colors.player} />
          </div>

          {toast && (
            <div
              key={toast.n}
              role="status"
              className="ex-toast pointer-events-none absolute left-1/2 top-3 z-20 rounded-lg px-4 py-2 font-semibold shadow-lg"
              style={{ transform: "translateX(-50%)", fontSize: 18, background: "rgba(12,8,6,0.88)", border: `2px solid ${colors.accent}`, color: colors.text, maxWidth: "90%" }}
            >
              {toast.text}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ side column */}
      <aside className="ex-side flex shrink-0 flex-col gap-3 overflow-y-auto pr-1" style={{ width: SIDE_W }} aria-label="Explorer status">
        {props.challenge ? (
          <>
            <p className="font-semibold uppercase tracking-wider" style={{ fontSize: 16, color: colors.accent }}>
              {activeId ? `${socketLabel(map.stationByEncounter.get(activeId)?.socket ?? "")} · ${nameOf(activeId)}` : ""}
            </p>
            {props.challenge}
          </>
        ) : finale ? (
          <Finale spec={spec} colors={colors} onContinue={props.complete} />
        ) : (
          <StatusColumn
            spec={spec}
            colors={colors}
            placeText={place}
            nearStations={near}
            stateOf={stateOf}
            nameOf={nameOf}
            solvedCount={solved.size}
            available={available}
            onOpen={(id) => arriveAt(id)}
            onWalk={walkToStation}
            sentriesOn={sentriesOn}
            hasSentries={map.sentries.length > 0}
            onToggleSentries={() => setSentriesOn((v) => !v)}
            peekDebrief={(id) => spec.encounters.find((e) => e.id === id)?.debriefLine ?? ""}
            needs={(id) => needsFor(spec, progression, id, solved)}
          />
        )}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// side column

function StatusColumn(p: {
  spec: GameSpec;
  colors: Colors;
  placeText: { name: string; kind: "room" | "passage" | "lane" };
  nearStations: ExplorerStation[];
  stateOf(id: string): StationState;
  nameOf(id: string): string;
  solvedCount: number;
  available: readonly string[];
  onOpen(id: string): void;
  onWalk(id: string): void;
  sentriesOn: boolean;
  hasSentries: boolean;
  onToggleSentries(): void;
  peekDebrief(id: string): string;
  needs(id: string): string[];
}) {
  const { spec, colors } = p;
  const total = spec.encounters.length;
  const { title, detail } = splitName(p.placeText.name);
  const near = p.nearStations[0] ?? null;
  const nearState = near ? p.stateOf(near.encounterId) : null;
  const card: CSSProperties = { background: "rgba(10,7,5,0.6)", border: `1px solid ${mixHex(colors.accent, "#000000", 0.55)}` };
  return (
    <>
      <section className="rounded-xl p-4" style={card} id="explorer-place" aria-live="polite">
        <p className="font-semibold uppercase tracking-wider" style={{ fontSize: 14, color: colors.accent }}>
          {p.placeText.kind === "room" ? "You are at" : p.placeText.kind === "lane" ? "Sentry lane, keep moving" : "On the road to"}
        </p>
        <h2 className="font-bold leading-tight" style={{ fontSize: 28 }} data-testid="explorer-place">
          {title}
        </h2>
        {detail && <p style={{ fontSize: 18 }} className="opacity-85">{detail}</p>}
        {near && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
            {nearState === "available" && (
              <>
                <p style={{ fontSize: 18 }} className="flex-1">
                  A {socketLabel(near.socket).toLowerCase()} stands here.
                </p>
                <button
                  type="button"
                  onClick={() => p.onOpen(near.encounterId)}
                  className="rounded-md px-4 py-2 font-bold text-black focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ background: colors.accent, fontSize: 18 }}
                >
                  Use it (E)
                </button>
              </>
            )}
            {nearState === "locked" && (
              <p style={{ fontSize: 18 }}>
                <strong>Locked.</strong> Needs: {p.needs(near.encounterId).join(", ")}
              </p>
            )}
            {nearState === "solved" && (
              <p style={{ fontSize: 18 }}>
                <strong style={{ color: colors.accent }}>Solved.</strong> {p.peekDebrief(near.encounterId)}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl p-4" style={card}>
        {p.solvedCount === 0 && spec.narrative.intro.length > 0 ? (
          spec.narrative.intro.map((l, i) => (
            <p key={i} style={{ fontSize: 18 }} className="italic">
              <strong className="not-italic" style={{ color: colors.accent }}>{speakerName(spec, l.speakerId)}:</strong> &ldquo;{l.text}&rdquo;
            </p>
          ))
        ) : null}
        <p style={{ fontSize: 18 }} className={p.solvedCount === 0 && spec.narrative.intro.length > 0 ? "mt-2 opacity-90" : "opacity-90"}>
          {spec.premise}
        </p>
        {p.solvedCount === 0 && (
          <p className="mt-2 font-semibold" style={{ fontSize: 18 }} data-testid="field-guide-tip">
            {GUIDE_TIP}
          </p>
        )}
      </section>

      <section className="rounded-xl p-4" style={card}>
        <div className="flex items-baseline justify-between">
          <h3 className="font-bold" style={{ fontSize: 20 }}>
            Stations: {p.solvedCount}/{total}
          </h3>
          <span style={{ fontSize: 16 }} className="opacity-80">
            {p.available.length} open now
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.12)" }}>
          <div className="h-full rounded-full" style={{ width: `${(p.solvedCount / Math.max(1, total)) * 100}%`, background: colors.accent, transition: "width 600ms ease" }} />
        </div>
        {p.available.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {p.available.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => p.onWalk(id)}
                  className="w-full rounded-md px-3 py-1.5 text-left hover:bg-white/10 focus-visible:outline-2"
                  style={{ fontSize: 17, border: "1px solid rgba(255,255,255,0.18)" }}
                >
                  <span aria-hidden style={{ color: colors.accent }}>&#10148; </span>
                  Walk to {splitName(p.nameOf(id)).title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl p-4" style={card}>
        <Legend colors={colors} />
        <p className="mt-3 leading-snug opacity-90" style={{ fontSize: 16 }}>
          <strong>Arrows / WASD</strong> walk (hold to keep going). <strong>Click</strong> a tile or station to walk there. <strong>E / Enter</strong> uses the
          station beside you. <strong>Esc</strong> leaves a challenge. <strong>G</strong> opens the Field guide.
        </p>
        {p.hasSentries && (
          <button
            type="button"
            role="switch"
            aria-checked={p.sentriesOn}
            onClick={p.onToggleSentries}
            data-testid="explorer-sentries-toggle"
            className="mt-3 flex items-center gap-3 rounded-md px-3 py-1.5 focus-visible:outline-2"
            style={{ fontSize: 16, border: "1px solid rgba(255,255,255,0.25)" }}
          >
            <span className="relative inline-block h-5 w-9 rounded-full" style={{ background: p.sentriesOn ? colors.accent : "rgba(255,255,255,0.25)" }}>
              <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: p.sentriesOn ? 18 : 2 }} />
            </span>
            Sentries: {p.sentriesOn ? "on" : "off"}
          </button>
        )}
      </section>
    </>
  );
}

function Legend({ colors }: { colors: Colors }) {
  const items: [string, ReactNode][] = [
    ["You", <AvatarToken key="a" dir="down" color={colors.player} />],
    [
      "Open station",
      <svg key="o" viewBox="0 0 24 24" width="26" height="26" aria-hidden>
        <circle cx="12" cy="12" r="10" fill={mixHex(colors.floor, "#000", 0.3)} stroke={colors.accent} strokeWidth="2.5" />
      </svg>,
    ],
    [
      "Solved beacon",
      <svg key="s" viewBox="0 0 24 24" width="26" height="26" aria-hidden>
        <circle cx="12" cy="12" r="11" fill={colors.player} opacity="0.35" />
        <circle cx="12" cy="12" r="7" fill={colors.player} />
      </svg>,
    ],
    [
      "Locked",
      <svg key="l" viewBox="0 0 24 24" width="26" height="26" aria-hidden>
        <PadlockGlyph color="#cfc8bd" />
      </svg>,
    ],
    [
      "Gate",
      <svg key="g" viewBox="0 0 24 24" width="26" height="26" aria-hidden>
        <rect x="3" y="10" width="18" height="4" rx="1" fill={colors.gate} stroke="#000" strokeOpacity="0.5" />
        <circle cx="12" cy="12" r="2.2" fill={colors.accent} />
      </svg>,
    ],
    ["Sentry", <SentryToken key="t" facing="right" />],
  ];
  return (
    <ul className="grid grid-cols-3 gap-x-3 gap-y-2" aria-label="Legend">
      {items.map(([label, icon]) => (
        <li key={label} className="flex items-center gap-2" style={{ fontSize: 16 }}>
          <span className="inline-block h-[26px] w-[26px] shrink-0">{icon}</span>
          {label}
        </li>
      ))}
    </ul>
  );
}

function Finale({ spec, colors, onContinue }: { spec: GameSpec; colors: Colors; onContinue(): void }) {
  return (
    <section className="ex-finale-card flex flex-col gap-4 rounded-xl p-5" style={{ background: "rgba(10,7,5,0.7)", border: `2px solid ${colors.accent}` }} data-testid="explorer-finale">
      <p className="font-semibold uppercase tracking-wider" style={{ fontSize: 16, color: colors.accent }}>
        Every station lit
      </p>
      <h2 className="font-bold leading-tight" style={{ fontSize: 30 }}>
        {spec.title}: the whole map is open
      </h2>
      {spec.narrative.outro.map((l, i) => (
        <p key={i} className="italic" style={{ fontSize: 20 }}>
          <strong className="not-italic" style={{ color: colors.accent }}>{speakerName(spec, l.speakerId)}:</strong> &ldquo;{l.text}&rdquo;
        </p>
      ))}
      <button
        type="button"
        autoFocus
        onClick={onContinue}
        data-testid="host-finale-continue"
        className="self-start rounded-lg px-6 py-3 font-bold text-black hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: colors.accent, fontSize: 20 }}
      >
        See how you did
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// tokens

function AvatarToken({ dir, color }: { dir: Dir; color: string }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg viewBox="-16 -16 32 32" width="100%" height="100%" aria-hidden style={{ overflow: "visible" }}>
      <ellipse cx="1.5" cy="5" rx="11" ry="7" fill="#000" opacity="0.4" />
      <g transform={`rotate(${rot})`}>
        <path d="M0 -15.5 L6 -8.5 L-6 -8.5 Z" fill={color} stroke="#1a1208" strokeWidth="1.4" strokeLinejoin="round" />
      </g>
      <circle r="9.5" fill={color} stroke="#1a1208" strokeWidth="2" />
      <circle r="9.5" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1" transform="scale(1.22)" />
      <circle cx="-3" cy="-3.5" r="3" fill="#fff" opacity="0.55" />
    </svg>
  );
}

function SentryToken({ facing }: { facing: Dir }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[facing];
  return (
    <svg viewBox="-16 -16 32 32" width="100%" height="100%" aria-hidden style={{ overflow: "visible" }}>
      <g transform={`rotate(${rot})`}>
        <path d="M0 -4 L-11 -24 A 22 22 0 0 1 11 -24 Z" fill={SENTRY_RED} opacity="0.28" />
      </g>
      <ellipse cx="1.5" cy="4.5" rx="10" ry="6" fill="#000" opacity="0.4" />
      <path d="M0 -10 L9 -2 L6.5 9 L-6.5 9 L-9 -2 Z" fill="#5a1712" stroke={SENTRY_RED} strokeWidth="2" strokeLinejoin="round" />
      <g transform={`rotate(${rot})`}>
        <circle cy="-3" r="2.6" fill="#ffd9a0" />
      </g>
    </svg>
  );
}

function Pedestal(p: { station: ExplorerStation; state: StationState; colors: Colors; active: boolean; big: boolean; flashKey: string | null; flashCorrect: boolean; finale: boolean }) {
  const { state, colors, big } = p;
  const socket = big ? "heart" : p.station.socket;
  const lit = state === "solved" || (big && p.finale);
  const glyphColor = lit ? "#1c140c" : state === "available" ? mixHex(colors.accent, "#ffffff", 0.35) : "#8d857a";
  const gid = `ped-${p.station.encounterId}`;
  return (
    <svg viewBox="-16 -16 32 32" width="100%" height="100%" aria-hidden style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id={`${gid}-top`} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor={lit ? mixHex(colors.player, "#ffffff", 0.45) : mixHex(colors.wallHi, "#ffffff", 0.08)} />
          <stop offset="1" stopColor={lit ? colors.player : mixHex(colors.wallLo, colors.floor, 0.3)} />
        </radialGradient>
        <radialGradient id={`${gid}-glow`}>
          <stop offset="0" stopColor={colors.player} stopOpacity="0.85" />
          <stop offset="1" stopColor={colors.player} stopOpacity="0" />
        </radialGradient>
      </defs>
      {lit && <circle r="17" fill={`url(#${gid}-glow)`} className="ex-anim ex-beacon" />}
      {state === "available" && <circle r="13.5" fill="none" stroke={colors.accent} strokeWidth="2" className="ex-anim ex-pulse" />}
      <ellipse cx="1.4" cy="3" rx="12.5" ry="11.5" fill="#000" opacity="0.45" />
      <circle r="12" fill={mixHex(colors.wallLo, "#000000", 0.2)} />
      <circle r="10.6" fill={`url(#${gid}-top)`} stroke={state === "available" ? colors.accent : lit ? mixHex(colors.player, "#ffffff", 0.3) : "rgba(0,0,0,0.5)"} strokeWidth={state === "available" ? 1.8 : 1} />
      {lit && (
        <g stroke={mixHex(colors.player, "#ffffff", 0.5)} strokeWidth="1.2" strokeLinecap="round" opacity="0.9" className="ex-anim ex-rays">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} x1="0" y1="-12.8" x2="0" y2="-15.5" transform={`rotate(${a})`} />
          ))}
        </g>
      )}
      <g transform="translate(-8.4 -8.4) scale(0.7)">
        <SocketGlyph socket={socket} color={glyphColor} stroke={2.3} />
      </g>
      {state === "locked" && (
        <g transform="translate(4 -14) scale(0.5)">
          <circle cx="12" cy="12" r="12" fill="#1a120c" />
          <g transform="translate(2.4 1.8) scale(0.8)">
            <PadlockGlyph color="#e8e0d4" />
          </g>
        </g>
      )}
      {state === "solved" && !big && (
        <g transform="translate(4.5 -14.5) scale(0.46)">
          <circle cx="12" cy="12" r="12" fill="#1f5f2a" stroke="#fff" strokeWidth="1.5" />
          <CheckGlyph color="#ffffff" />
        </g>
      )}
      {p.active && <circle r="14.5" fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="4 3" className="ex-anim ex-spin" />}
      {p.flashKey && (
        <circle
          key={p.flashKey}
          r="12"
          fill={p.flashCorrect ? colors.player : SENTRY_RED}
          className={p.flashCorrect ? "ex-anim ex-burst" : "ex-anim ex-flicker"}
          opacity="0"
        />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// terrain (static per map) and the dynamic fog + gates layer, both SVG in tile units

const Terrain = memo(function Terrain({ map, colors, tile }: { map: ExplorerMap; colors: Colors; tile: number }) {
  const halls: Pt[] = [];
  const lanes: Pt[] = [];
  for (let y = 0; y < map.rows; y++)
    for (let x = 0; x < map.cols; x++) {
      const k = map.tiles[y * map.cols + x];
      if (k === 2) halls.push({ x, y });
      else if (k === ALCOVE) lanes.push({ x, y });
    }
  const heart = map.heartId ? map.roomById.get(map.heartId)! : null;
  const plaza = map.roomById.get(map.plazaId)!;
  return (
    <svg className="absolute inset-0" width={map.cols * tile} height={map.rows * tile} viewBox={`0 0 ${map.cols} ${map.rows}`} aria-hidden>
      <defs>
        <pattern id="ex-rock" patternUnits="userSpaceOnUse" width="3" height="3">
          <rect width="3" height="3" fill={colors.ground} />
          <circle cx="0.5" cy="0.7" r="0.09" fill={colors.speck} />
          <circle cx="2.1" cy="0.4" r="0.06" fill={colors.speck} />
          <circle cx="1.6" cy="2.2" r="0.11" fill={colors.speck} />
          <circle cx="2.7" cy="1.6" r="0.05" fill={colors.speck} />
          <path d="M0.2 1.9 q0.3 -0.2 0.6 0 t0.5 0" stroke={colors.speck} strokeWidth="0.05" fill="none" />
        </pattern>
        <pattern id="ex-flag" patternUnits="userSpaceOnUse" width="2" height="2">
          <rect width="2" height="2" fill={colors.floor} />
          <path d="M0 0H2M0 1H2M0 0V1M1 1V2" stroke={colors.floorLine} strokeWidth="0.05" opacity="0.8" />
          <rect x="0.08" y="0.08" width="0.9" height="0.84" fill="#fff" opacity="0.035" />
          <rect x="1.08" y="1.08" width="0.84" height="0.84" fill="#000" opacity="0.05" />
        </pattern>
        <linearGradient id="ex-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colors.wallHi} />
          <stop offset="1" stopColor={colors.wallLo} />
        </linearGradient>
        <radialGradient id="ex-plaza" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={mixHex(colors.floor, colors.accent, 0.12)} />
          <stop offset="1" stopColor={colors.floor} />
        </radialGradient>
        <radialGradient id="ex-heart" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={mixHex(colors.floor, colors.accent, 0.3)} />
          <stop offset="0.75" stopColor={mixHex(colors.floor, "#000000", 0.1)} />
          <stop offset="1" stopColor={mixHex(colors.floor, "#000000", 0.3)} />
        </radialGradient>
      </defs>
      <rect width={map.cols} height={map.rows} fill="url(#ex-rock)" />

      {/* scenery on the solid ground between wings */}
      {map.decor.map((d, i) => {
        const cx = d.x + 0.5;
        const cy = d.y + 0.5;
        if (d.kind === "tree")
          return (
            <g key={i}>
              <ellipse cx={cx + 0.12} cy={cy + 0.18} rx={d.r * 1.05} ry={d.r * 0.9} fill="#000" opacity="0.35" />
              <circle cx={cx} cy={cy} r={d.r} fill={colors.tree} />
              <circle cx={cx - d.r * 0.35} cy={cy - d.r * 0.3} r={d.r * 0.55} fill={colors.treeHi} />
            </g>
          );
        if (d.kind === "boulder")
          return (
            <g key={i}>
              <ellipse cx={cx + 0.06} cy={cy + 0.08} rx={d.r * 1.2} ry={d.r * 0.95} fill="#000" opacity="0.3" />
              <ellipse cx={cx} cy={cy} rx={d.r * 1.15} ry={d.r * 0.9} fill={colors.wallLo} />
              <ellipse cx={cx - d.r * 0.3} cy={cy - d.r * 0.3} rx={d.r * 0.5} ry={d.r * 0.35} fill={colors.wallHi} opacity="0.5" />
            </g>
          );
        return (
          <path
            key={i}
            d={`M${cx - d.r} ${cy + 0.1} l${d.r * 0.4} ${-d.r} M${cx} ${cy + 0.1} l0 ${-d.r * 1.2} M${cx + d.r} ${cy + 0.1} l${-d.r * 0.4} ${-d.r}`}
            stroke={colors.treeHi}
            strokeWidth="0.06"
            strokeLinecap="round"
            opacity="0.6"
          />
        );
      })}

      {/* walls: a bevelled rim around every room and corridor */}
      <g fill="url(#ex-wall)">
        {map.rooms.map((r) =>
          r.round ? (
            <circle key={r.id} cx={r.x + r.w / 2} cy={r.y + r.h / 2} r={r.w / 2 + 0.38} />
          ) : (
            <rect key={r.id} x={r.x - 0.32} y={r.y - 0.32} width={r.w + 0.64} height={r.h + 0.64} rx="0.4" />
          ),
        )}
        {halls.map((t) => (
          <rect key={`h${t.x},${t.y}`} x={t.x - 0.2} y={t.y - 0.2} width="1.4" height="1.4" rx="0.2" />
        ))}
        {lanes.map((t) => (
          <rect key={`l${t.x},${t.y}`} x={t.x - 0.14} y={t.y - 0.14} width="1.28" height="1.28" rx="0.3" />
        ))}
      </g>
      <g stroke="#000" strokeOpacity="0.45" strokeWidth="0.06" fill="none">
        {map.rooms.map((r) =>
          r.round ? (
            <circle key={r.id} cx={r.x + r.w / 2} cy={r.y + r.h / 2} r={r.w / 2 + 0.38} />
          ) : (
            <rect key={r.id} x={r.x - 0.32} y={r.y - 0.32} width={r.w + 0.64} height={r.h + 0.64} rx="0.4" />
          ),
        )}
      </g>

      {/* floors */}
      {halls.map((t) => (
        <rect key={`hf${t.x},${t.y}`} x={t.x} y={t.y} width="1" height="1" fill={colors.hall} />
      ))}
      {lanes.map((t) => (
        <rect key={`lf${t.x},${t.y}`} x={t.x + 0.06} y={t.y + 0.06} width="0.88" height="0.88" rx="0.2" fill={colors.lane} />
      ))}
      {map.sentries.map((s) => {
        const a = s.tiles[0];
        const b = s.tiles[s.tiles.length - 1];
        return <line key={s.id} x1={a.x + 0.5} y1={a.y + 0.5} x2={b.x + 0.5} y2={b.y + 0.5} stroke={SENTRY_RED} strokeOpacity="0.45" strokeWidth="0.08" strokeDasharray="0.25 0.2" />;
      })}
      {map.rooms.map((r) =>
        r.round ? (
          <g key={r.id}>
            <circle cx={r.x + r.w / 2} cy={r.y + r.h / 2} r={r.w / 2} fill={`url(#${r.kind === "heart" ? "ex-heart" : "ex-plaza"})`} />
            <circle cx={r.x + r.w / 2} cy={r.y + r.h / 2} r={r.w / 2 - 0.08} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="0.16" />
          </g>
        ) : (
          <g key={r.id}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="0.15" fill="url(#ex-flag)" />
            <rect x={r.x + 0.06} y={r.y + 0.06} width={r.w - 0.12} height={r.h - 0.12} rx="0.12" fill="none" stroke="#000" strokeOpacity="0.3" strokeWidth="0.12" />
          </g>
        ),
      )}

      {/* plaza compass rose */}
      <g transform={`translate(${plaza.x + plaza.w / 2} ${plaza.y + plaza.h / 2})`} opacity="0.75">
        <circle r="2.1" fill="none" stroke={colors.floorLine} strokeWidth="0.07" />
        <circle r="1.55" fill="none" stroke={colors.accent} strokeOpacity="0.35" strokeWidth="0.05" strokeDasharray="0.12 0.12" />
        {[0, 90, 180, 270].map((a) => (
          <path key={a} d="M0 -1.9 L0.28 -0.28 L0 0 L-0.28 -0.28 Z" transform={`rotate(${a})`} fill={a === 0 ? colors.accent : colors.floorLine} opacity={a === 0 ? 0.8 : 0.9} />
        ))}
        {[45, 135, 225, 315].map((a) => (
          <path key={a} d="M0 -1.1 L0.16 -0.16 L0 0 L-0.16 -0.16 Z" transform={`rotate(${a})`} fill={colors.floorLine} />
        ))}
      </g>

      {/* heart rune rings */}
      {heart && (
        <g transform={`translate(${heart.x + heart.w / 2} ${heart.y + heart.h / 2})`}>
          <circle r="2.55" fill="none" stroke={colors.accent} strokeOpacity="0.4" strokeWidth="0.06" strokeDasharray="0.35 0.18" />
          <circle r="2.25" fill="none" stroke={colors.floorLine} strokeWidth="0.08" />
        </g>
      )}

    </svg>
  );
});

const FogAndGates = memo(function FogAndGates({ map, colors, visibleKey, solvedKey, finale }: { map: ExplorerMap; colors: Colors; visibleKey: string; solvedKey: string; finale: boolean }) {
  const visible = new Set(visibleKey.split(","));
  const solved = new Set(solvedKey ? solvedKey.split(",") : []);
  const paths = finale ? finalePaths(map, solved) : [];
  const heart = map.heartId ? map.roomById.get(map.heartId)! : map.roomById.get(map.plazaId)!;
  const gateHidden = (roomId: string) => {
    const into = map.corridors.find((c) => c.to === roomId);
    return !visible.has(roomId) && !!into && !visible.has(into.from);
  };
  return (
    <svg className="pointer-events-none absolute inset-0" width="100%" height="100%" viewBox={`0 0 ${map.cols} ${map.rows}`} aria-hidden>
      <defs>
        <pattern id="ex-rock-fog" patternUnits="userSpaceOnUse" width="3" height="3">
          <rect width="3" height="3" fill={colors.ground} />
          <circle cx="0.5" cy="0.7" r="0.09" fill={colors.speck} />
          <circle cx="2.1" cy="0.4" r="0.06" fill={colors.speck} />
          <circle cx="1.6" cy="2.2" r="0.11" fill={colors.speck} />
          <circle cx="2.7" cy="1.6" r="0.05" fill={colors.speck} />
          <path d="M0.2 1.9 q0.3 -0.2 0.6 0 t0.5 0" stroke={colors.speck} strokeWidth="0.05" fill="none" />
        </pattern>
        <radialGradient id="ex-vignette" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <filter id="ex-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.18" />
        </filter>
        <radialGradient id="ex-heartglow">
          <stop offset="0" stopColor={colors.player} stopOpacity="0.9" />
          <stop offset="0.6" stopColor={colors.accent} stopOpacity="0.35" />
          <stop offset="1" stopColor={colors.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* fog of war: unrevealed rooms are dark shapes with a dashed outline; the passage to them vanishes into the rock
          until the room it starts from is revealed */}
      {map.rooms.map((r) => {
        const into = map.corridors.find((c) => c.to === r.id);
        const pathHidden = !visible.has(r.id) && !!into && !visible.has(into.from);
        return (
          <g key={r.id} className="ex-fog" style={{ opacity: pathHidden ? 1 : 0 }}>
            {into?.tiles.map((t) => <rect key={`${t.x},${t.y}`} x={t.x - 0.25} y={t.y - 0.25} width="1.5" height="1.5" fill="url(#ex-rock-fog)" />)}
            {map.sentries
              .filter((s) => s.corridorId === into?.id)
              .flatMap((s) => s.tiles)
              .map((t) => (
                <rect key={`s${t.x},${t.y}`} x={t.x - 0.2} y={t.y - 0.2} width="1.4" height="1.4" fill="url(#ex-rock-fog)" />
              ))}
          </g>
        );
      })}
      {map.rooms.map((r) => (
        <g key={r.id} className="ex-fog" style={{ opacity: visible.has(r.id) ? 0 : 1 }}>
          <rect x={r.x - 0.45} y={r.y - 0.45} width={r.w + 0.9} height={r.h + 0.9} rx={r.round ? r.w / 2 : 0.4} fill={colors.fog} stroke={colors.fogLine} strokeWidth="0.07" strokeDasharray="0.25 0.18" />
          <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 0.35} textAnchor="middle" fontSize="1.1" fontWeight="700" fill={colors.fogLine}>
            ?
          </text>
        </g>
      ))}

      {/* gates: two leaves hinged at the corridor walls; they swing into the room once open */}
      {map.gates.map((g) => {
        const open = gateOpen(g, solved);
        const room = map.roomById.get(g.roomId)!;
        const t0 = g.tiles[0];
        const into = g.horizontal ? Math.sign(room.x + room.w / 2 - (t0.x + 0.5)) : Math.sign(room.y + room.h / 2 - (t0.y + 0.5));
        const xs = g.tiles.map((t) => t.x);
        const ys = g.tiles.map((t) => t.y);
        const x0 = Math.min(...xs);
        const y0 = Math.min(...ys);
        const x1 = Math.max(...xs) + 1;
        const y1 = Math.max(...ys) + 1;
        const door = g.kind === "door";
        // leaves run across the passage: along y when the passage is horizontal, along x when vertical
        const leaves = g.horizontal
          ? [
              { hx: (x0 + x1) / 2, hy: y0, len: (y1 - y0) / 2, axis: "y" as const, sign: 1 },
              { hx: (x0 + x1) / 2, hy: y1, len: (y1 - y0) / 2, axis: "y" as const, sign: -1 },
            ]
          : [
              { hx: x0, hy: (y0 + y1) / 2, len: (x1 - x0) / 2, axis: "x" as const, sign: 1 },
              { hx: x1, hy: (y0 + y1) / 2, len: (x1 - x0) / 2, axis: "x" as const, sign: -1 },
            ];
        const th = door ? 0.3 : 0.2;
        return (
          <g key={g.id} data-gate={g.id} data-open={open ? "true" : "false"} className="ex-fog" style={{ opacity: gateHidden(g.roomId) ? 0 : 1 }}>
            {leaves.map((l, i) => {
              // rotate each leaf toward the room it guards
              const angle = open ? (l.axis === "y" ? -into * l.sign * 84 : into * l.sign * 84) : 0;
              const rect = l.axis === "y" ? { x: l.hx - th / 2, y: l.sign > 0 ? l.hy : l.hy - l.len, width: th, height: l.len } : { x: l.sign > 0 ? l.hx : l.hx - l.len, y: l.hy - th / 2, width: l.len, height: th };
              return (
                <g key={i} className="ex-leaf" style={{ transformBox: "view-box", transformOrigin: `${l.hx}px ${l.hy}px`, transform: `rotate(${angle}deg)` }}>
                  <rect {...rect} rx="0.05" fill={door ? mixHex(colors.gate, colors.accent, 0.25) : colors.gate} stroke="#000" strokeOpacity="0.6" strokeWidth="0.04" />
                  {!open && <rect {...rect} fill="none" stroke={colors.accent} strokeOpacity="0.7" strokeWidth="0.035" strokeDasharray="0.08 0.12" />}
                </g>
              );
            })}
            {!open && (
              <circle cx={(x0 + x1) / 2} cy={(y0 + y1) / 2} r={door ? 0.34 : 0.17} fill={colors.accent} stroke="#000" strokeOpacity="0.6" strokeWidth="0.04" />
            )}
            {leaves.map((l, i) => (
              <rect key={`p${i}`} x={l.hx - 0.14} y={l.hy - 0.14} width="0.28" height="0.28" rx="0.05" fill={colors.wallLo} stroke={colors.wallHi} strokeWidth="0.03" />
            ))}
          </g>
        );
      })}

      {/* finale: the heart lights and paths glow from every station to it */}
      {finale && (
        <g>
          <circle cx={heart.x + heart.w / 2} cy={heart.y + heart.h / 2} r={heart.w / 2 + 1.2} fill="url(#ex-heartglow)" className="ex-anim ex-beacon" />
          {paths.map((pts, i) => (
            <polyline
              key={i}
              points={pts.map((q) => `${q.x + 0.5},${q.y + 0.5}`).join(" ")}
              fill="none"
              stroke={colors.player}
              strokeWidth="0.14"
              strokeOpacity="0.85"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#ex-blur)"
              className="ex-anim ex-trail"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </g>
      )}
      <rect width={map.cols} height={map.rows} fill="url(#ex-vignette)" />
    </svg>
  );
});

// ---------------------------------------------------------------------------------------------------------------------

const STYLES = `
.ex-root .ex-station { cursor: pointer; background: transparent; border: 0; padding: 0; transition: opacity 700ms ease; }
.ex-root .ex-station:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
.ex-root .ex-map:focus-visible { outline: 3px solid rgba(255,255,255,0.8); outline-offset: 4px; border-radius: 6px; }
.ex-root .ex-fog { transition: opacity 900ms ease; }
.ex-root .ex-leaf { transition: transform 900ms cubic-bezier(.3,1.4,.5,1); }
.ex-root .ex-pulse { transform-box: fill-box; transform-origin: center; animation: ex-pulse 1.6s ease-out infinite; }
.ex-root .ex-beacon { animation: ex-beacon 2.4s ease-in-out infinite; }
.ex-root .ex-rays { transform-box: view-box; animation: ex-spin 12s linear infinite; }
.ex-root .ex-spin { transform-box: fill-box; transform-origin: center; animation: ex-spin 6s linear infinite; }
.ex-root .ex-burst { transform-box: fill-box; transform-origin: center; animation: ex-burst 1.1s ease-out 1; }
.ex-root .ex-flicker { animation: ex-flicker 0.9s steps(1) 1; }
.ex-root .ex-trail { stroke-dasharray: 1.4 0.6; animation: ex-trail 1.4s linear infinite, ex-fadein 900ms ease-out both; }
.ex-root .ex-toast { animation: ex-fadein 200ms ease-out both; }
.ex-root .ex-label { animation: ex-fadein 700ms ease-out both; }
.ex-root .ex-finale-card { animation: ex-fadein 600ms ease-out both; }
@keyframes ex-pulse { 0% { transform: scale(0.9); opacity: 0.9; } 100% { transform: scale(1.3); opacity: 0; } }
@keyframes ex-beacon { 0%, 100% { opacity: 0.65; } 50% { opacity: 1; } }
@keyframes ex-spin { to { transform: rotate(360deg); } }
@keyframes ex-burst { 0% { transform: scale(0.6); opacity: 0.95; } 100% { transform: scale(2.4); opacity: 0; } }
@keyframes ex-flicker { 0% { opacity: 0.55; } 15% { opacity: 0; } 30% { opacity: 0.5; } 45% { opacity: 0; } 60% { opacity: 0.4; } 75%, 100% { opacity: 0; } }
@keyframes ex-trail { to { stroke-dashoffset: -2; } }
@keyframes ex-fadein { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .ex-root .ex-anim, .ex-root .ex-toast, .ex-root .ex-label, .ex-root .ex-finale-card { animation: none !important; }
  .ex-root .ex-token, .ex-root .ex-fog, .ex-root .ex-leaf { transition: none !important; }
  .ex-root .ex-burst, .ex-root .ex-flicker { opacity: 0; }
}
`;
