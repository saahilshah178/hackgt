"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { speakerName, type BoardHostHandle, type BoardHostProps } from "../../types";
import { BoardSvg, CELL, PAD, type BoardColors, type SealView } from "./BoardSvg";
import { SocketGlyph, socketName } from "./glyphs";
import {
  canRotate,
  coreCharged,
  effectiveTurns,
  floodPower,
  frontierSegments,
  generateBoard,
  isFused,
  litPrefix,
  misrotated,
  listText,
  luminanceOf,
  missingRequirements,
  mixHex,
  mod4,
  powerColor,
  sealState,
  shortLabel,
  shortPremise,
  type SealState,
} from "./puzzle.logic";

/*
 * PuzzleHost: the "logic board". A square-tile circuit board with no avatar: power flows from the SOURCE crystal to
 * the CORE (the boss). Every other encounter is a hexagonal SEAL on one of the routes (one per progression track).
 * The player rotates conduit tiles (click, or arrows + Space/Enter; Shift or right-click turns back) until power
 * reaches a seal; a powered seal the runner lists as available opens its challenge in the right-hand column. A
 * broken seal becomes a golden conduit and the power surges on. All board logic lives in ./puzzle.logic.ts.
 */

type Props = BoardHostProps & { hostRef?: (h: BoardHostHandle | null) => void };

const IDLE_TIP_MS = 20_000;
const STUCK_REVEAL_MS = 120_000;

export function PuzzleHost(props: Props) {
  const { spec, palette, progression, solved, available, activeId, lastResult, finished } = props;
  const board = useMemo(() => generateBoard({ seed: spec.seed, encounters: spec.encounters, progression }), [spec.seed, spec.encounters, progression]);

  const [playerTurns, setPlayerTurns] = useState<number[]>(() => [...board.start]);
  const turnsBase = playerTurns.length === board.tiles.length ? playerTurns : board.start;
  const [cursor, setCursor] = useState(board.source);
  const [hover, setHover] = useState<number | null>(null);
  const [boardFocused, setBoardFocused] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [ping, setPing] = useState<{ cells: number[]; seq: number }>({ cells: [], seq: 0 });
  const [manualReveal, setManualReveal] = useState(false);
  const [interactions, setInteractions] = useState(0);
  const [idleMark, setIdleMark] = useState(-1);
  const [stuckMark, setStuckMark] = useState(-1);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const columnRef = useRef<HTMLDivElement>(null);
  const prevActive = useRef<string | null>(null);

  // ---- derived board state (runner.solved() is a live Set, so nothing here is memoized on it)
  const turns = effectiveTurns(board, turnsBase, solved, finished);
  const powered = floodPower(board, turns, solved);
  const charged = coreCharged(board, turns, powered);
  const lit = litPrefix(board, turns, powered, solved);
  const availableSet = new Set(available);
  const conceptName = (id: string) => spec.concepts.find((c) => c.id === id)?.name ?? id;
  const encounterById = new Map(spec.encounters.map((e) => [e.id, e]));
  const nameOf = (encounterId: string) => {
    const e = encounterById.get(encounterId);
    return e ? e.conceptIds.map(conceptName).join(" + ") : encounterId;
  };

  const sealIds = board.routes.flatMap((r) => r.encounterIds);
  const stateOf = (id: string): SealState => {
    const tile = board.tileOf[id];
    const isCore = tile === board.core;
    return sealState({ solved: solved.has(id), powered: isCore ? charged : powered[tile], available: availableSet.has(id) });
  };
  const seals: Record<string, SealView> = {};
  for (const id of sealIds) {
    const e = encounterById.get(id);
    seals[id] = { state: stateOf(id), number: (progression.byId.get(id)?.index ?? 0) + 1, label: shortLabel(conceptName(e?.conceptIds[0] ?? id), 11), socket: e?.socket ?? "" };
  }
  const coreState: SealState = board.bossId ? stateOf(board.bossId) : finished ? "solved" : "dormant";
  const fused = new Set<number>();
  for (const seg of board.segments) if (isFused(seg, solved, finished)) for (const c of seg.cells) fused.add(c);

  const openable = [...sealIds, ...(board.bossId ? [board.bossId] : [])].filter((id) => stateOf(id) === "ready");
  const routingStuck = !finished && activeId === null && openable.length === 0;
  const frontier = frontierSegments(board, powered, solved);
  const autoReveal = routingStuck && stuckMark === solved.size;
  const revealOn = !finished && (manualReveal || autoReveal);
  const reveal = new Set(revealOn ? misrotated(board, turns, frontier) : []);
  const showIdleTip = routingStuck && idleMark === interactions;
  const brokenCount = sealIds.filter((id) => solved.has(id)).length;

  // ---- colours
  const colors: BoardColors = useMemo(() => {
    const power = powerColor(palette.css.accent);
    // the board stays a dark instrument panel on every palette; light palettes (parchment) are pushed further down
    const floorDark = luminanceOf(palette.css.floor) > 0.25 ? 0.85 : 0.55;
    const wallDark = luminanceOf(palette.css.wall) > 0.2 ? 0.8 : 0.35;
    return {
      power,
      powerSoft: mixHex(power, "#000000", 0.55),
      plate: mixHex(palette.css.floor, "#0b1014", floorDark),
      plateEdge: mixHex(mixHex(palette.css.floor, "#0b1014", floorDark), "#ffffff", 0.12),
      boardTop: mixHex(palette.css.wall, "#05080a", wallDark),
      boardBottom: mixHex(palette.css.wall, "#000000", Math.max(0.7, wallDark + 0.1)),
      grid: mixHex(mixHex(palette.css.floor, "#0b1014", floorDark), "#ffffff", 0.08),
      text: palette.css.text,
    };
  }, [palette]);

  // ---- timers: an idle tip after 20 s without a turn, and "Reveal route" after 2 minutes stuck on routing
  useEffect(() => {
    if (!routingStuck) return;
    const id = window.setTimeout(() => setIdleMark(interactions), IDLE_TIP_MS);
    return () => window.clearTimeout(id);
  }, [routingStuck, interactions]);
  const solvedCount = solved.size;
  useEffect(() => {
    if (!routingStuck) return;
    const id = window.setTimeout(() => setStuckMark(solvedCount), STUCK_REVEAL_MS);
    return () => window.clearTimeout(id);
  }, [routingStuck, solvedCount]);

  // ---- debug warp (skipTo / autoSolve): move the board cursor to that seal
  const hostRef = props.hostRef;
  useEffect(() => {
    hostRef?.({
      warpTo: (id) => {
        if (id && board.tileOf[id] !== undefined) setCursor(board.tileOf[id]);
      },
    });
    return () => hostRef?.(null);
  }, [hostRef, board]);

  // ---- focus: into the challenge when it opens, back to its seal when it closes
  useEffect(() => {
    const prev = prevActive.current;
    prevActive.current = activeId;
    if (activeId && activeId !== prev) {
      const col = columnRef.current;
      const widget = col?.querySelector('[data-testid="widget-root"]');
      const target =
        widget?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])') ??
        col?.querySelector<HTMLElement>('[data-testid="challenge-panel"] button');
      target?.focus({ preventScroll: true });
    } else if (!activeId && prev) {
      if (finished) columnRef.current?.querySelector<HTMLElement>('[data-testid="host-finale-continue"]')?.focus({ preventScroll: true });
      else if (board.tileOf[prev] !== undefined) cellRefs.current[board.tileOf[prev]]?.focus({ preventScroll: true });
    }
  }, [activeId, board, finished]);

  // ---- actions
  const incomingCells = (tileIndex: number) => board.segments.filter((s) => s.to === tileIndex).flatMap((s) => misrotated(board, turns, [s]));

  const rotate = (i: number, dir: 1 | -1) => {
    if (!canRotate(board, i, solved, finished)) {
      if (board.tiles[i].rotatable) setStatus("That conduit is fused in gold: its seal is already broken.");
      return;
    }
    setPlayerTurns((prev) => {
      const next = [...(prev.length === board.tiles.length ? prev : board.start)];
      next[i] = next[i] + dir;
      return next;
    });
    setInteractions((n) => n + 1);
    setStatus("");
  };

  const activate = (i: number, back: boolean) => {
    const tile = board.tiles[i];
    setCursor(i);
    if (tile.rotatable) return rotate(i, back ? -1 : 1);
    if (tile.kind === "source") return setStatus("The source crystal. Power flows out from here along every route.");
    if (tile.kind === "rivet") return setStatus("A riveted plate: nothing to turn here.");
    const id = tile.encounterId;
    if (!id) return setStatus(finished ? "The core resonates. The circuit is complete." : "The core wakes when every route carries power to it.");
    const state = stateOf(id);
    if (state === "ready") return props.open(id);
    if (state === "solved") return setStatus(`${nameOf(id)}: broken. Power flows through it.`);
    if (state === "blocked") return setStatus(`${nameOf(id)}: needs ${listText(missingRequirements(progression, id, solved).map(nameOf))} first.`);
    if (state === "unpowered") {
      setPing((p) => ({ cells: incomingCells(i), seq: p.seq + 1 }));
      return setStatus(`Route power here: turn the flashing conduits leading to ${nameOf(id)}.`);
    }
    const missing = missingRequirements(progression, id, solved).map(nameOf);
    return setStatus(`${nameOf(id)} is sealed. Break ${listText(missing) || "the seals before it"} and route power here.`);
  };

  const moveCursor = (i: number) => {
    setCursor(i);
    cellRefs.current[i]?.focus();
  };

  const onBoardKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const tile = board.tiles[cursor];
    let next = -1;
    if (e.key === "ArrowUp" && tile.y > 0) next = cursor - board.width;
    else if (e.key === "ArrowDown" && tile.y < board.height - 1) next = cursor + board.width;
    else if (e.key === "ArrowLeft" && tile.x > 0) next = cursor - 1;
    else if (e.key === "ArrowRight" && tile.x < board.width - 1) next = cursor + 1;
    else if (e.key === "Home") next = board.source;
    else if (e.key === "End") next = board.core;
    if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      if (next >= 0) moveCursor(next);
      return;
    }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!e.repeat || board.tiles[cursor].rotatable) activate(cursor, e.shiftKey);
    }
  };

  // ---- tooltip for the hovered / focused seal, core or source
  const tipIndex = hover ?? (boardFocused ? cursor : null);
  const tip = tipIndex === null ? null : tooltipFor(tipIndex);
  function tooltipFor(i: number): { title: string; line: string } | null {
    const t = board.tiles[i];
    if (t.kind === "source") return { title: "Power source", line: "Power flows out from here." };
    if (t.kind === "rivet" || t.rotatable) return null;
    if (t.kind === "core" && !t.encounterId) return { title: "The Core", line: finished ? "Resonating." : "Wakes when every seal is broken and every route reaches it." };
    const id = t.encounterId!;
    const state = stateOf(id);
    const title = t.kind === "core" ? `The Core: ${nameOf(id)}` : nameOf(id);
    const line =
      state === "ready"
        ? "Powered. Press Enter to break the seal."
        : state === "solved"
          ? "Broken: power flows through."
          : state === "blocked"
            ? `Needs: ${listText(missingRequirements(progression, id, solved).map(nameOf))}`
            : state === "unpowered"
              ? "Route power here"
              : t.kind === "core"
                ? "Opens when every seal is broken and every route reaches it."
                : "Sealed: break the seals before it first.";
    return { title, line };
  }

  // ---- layout numbers
  const vbW = board.width * CELL + PAD * 2;
  const vbH = board.height * CELL + PAD * 2;
  const pct = (units: number, of: number) => `${(units / of) * 100}%`;
  const fx = lastResult && board.tileOf[lastResult.encounterId] !== undefined ? { tile: board.tileOf[lastResult.encounterId], correct: lastResult.correct, seq: lastResult.seq } : null;

  const unitName = (encounterIds: string[]) => {
    const e = encounterById.get(encounterIds[0] ?? "");
    const concept = spec.concepts.find((c) => c.id === e?.conceptIds[0]);
    return spec.units.find((u) => u.id === concept?.unitId)?.name ?? null;
  };

  const activeEncounter = activeId ? encounterById.get(activeId) : undefined;
  const cssVars = { "--pz-power": colors.power } as CSSProperties;

  return (
    <div data-testid="puzzle-host" className="pz-host" style={cssVars} data-finished={finished ? "true" : "false"}>
      <style>{HOST_CSS}</style>
      <div className="pz-board-col">
        <div className="pz-board-wrap" style={{ aspectRatio: `${vbW} / ${vbH}`, width: `min(100%, calc((100vh - 190px) * ${vbW / vbH}))` }}>
          <BoardSvg
            board={board}
            turns={turns}
            powered={powered}
            fused={fused}
            charged={charged}
            lit={lit}
            seals={seals}
            core={{ state: coreState, label: "Core" }}
            reveal={reveal}
            ping={new Set(ping.cells)}
            pingSeq={ping.seq}
            fx={fx}
            finished={finished}
            colors={colors}
            title={spec.title}
          />
          <div
            role="group"
            aria-label="Circuit board. Arrow keys move, Space or Enter turns a conduit or opens a powered seal, Shift turns back."
            className="pz-grid"
            onKeyDown={onBoardKey}
            onKeyUp={(e) => {
              if (e.key === " ") e.preventDefault();
            }}
            onFocus={() => setBoardFocused(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setBoardFocused(false);
            }}
            onMouseLeave={() => setHover(null)}
          >
            {board.tiles.map((t) => {
              const id = t.encounterId;
              const isNode = (t.kind === "seal" || t.kind === "core") && id !== null;
              const runnerState = id ? (solved.has(id) ? "solved" : availableSet.has(id) ? "available" : "locked") : undefined;
              const sealSt = id ? stateOf(id) : undefined;
              return (
                <button
                  key={t.index}
                  ref={(el) => {
                    cellRefs.current[t.index] = el;
                  }}
                  type="button"
                  className={`pz-cell${t.rotatable ? " pz-cell-turn" : ""}${sealSt === "ready" ? " pz-cell-ready" : ""}`}
                  style={{ left: pct(PAD + t.x * CELL, vbW), top: pct(PAD + t.y * CELL, vbH), width: pct(CELL, vbW), height: pct(CELL, vbH) }}
                  tabIndex={t.index === cursor ? 0 : -1}
                  data-testid={isNode ? `node-${id}` : `pz-cell-${t.x}-${t.y}`}
                  data-state={runnerState}
                  data-seal-state={sealSt}
                  data-powered={powered[t.index] ? "true" : "false"}
                  data-kind={t.kind}
                  data-turn={t.rotatable ? mod4(turns[t.index]) : undefined}
                  aria-label={ariaFor(t.index)}
                  onClick={(e) => activate(t.index, e.shiftKey)}
                  onContextMenu={(e) => {
                    if (!t.rotatable) return;
                    e.preventDefault();
                    setCursor(t.index);
                    rotate(t.index, -1);
                  }}
                  onFocus={() => setCursor(t.index)}
                  onMouseEnter={() => setHover(t.index)}
                />
              );
            })}
          </div>
          {tip && tipIndex !== null && <Tooltip board={board} index={tipIndex} vbW={vbW} vbH={vbH} title={tip.title} line={tip.line} />}
          {finished && (
            <div className="pz-banner" role="status" data-testid="puzzle-complete-banner">
              <span className="pz-banner-kicker">Circuit complete</span>
              <span className="pz-banner-title">{spec.title}</span>
            </div>
          )}
        </div>
      </div>

      <aside ref={columnRef} className="pz-side" aria-label={activeId ? "Seal challenge" : "Circuit notes"}>
        {activeId ? (
          <div className="pz-stack">
            <div className="pz-challenge-head">
              <svg viewBox="-26 -26 52 52" width={44} height={44} aria-hidden>
                <SocketGlyph socket={activeEncounter?.socket ?? ""} color={colors.power} />
              </svg>
              <div>
                <p className="pz-kicker">{activeId === board.bossId ? "The Core" : `Breaking a ${socketName(activeEncounter?.socket ?? "")}`}</p>
                <p className="pz-challenge-name">{nameOf(activeId)}</p>
              </div>
            </div>
            {props.challenge}
          </div>
        ) : finished ? (
          <div className="pz-card pz-finale" data-testid="puzzle-finale">
            <p className="pz-kicker">Circuit complete</p>
            <h2 className="pz-finale-title">{spec.title}</h2>
            {spec.narrative.outro.map((line, i) => (
              <p key={i} className="pz-line">
                <strong>{speakerName(spec, line.speakerId)}:</strong> &ldquo;{line.text}&rdquo;
              </p>
            ))}
            <p className="pz-body">Every seal is broken and the whole board hums in resonance.</p>
            <button type="button" className="pz-primary" data-testid="host-finale-continue" onClick={props.complete} autoFocus>
              See how you did
            </button>
          </div>
        ) : (
          <div className="pz-stack">
            <div className="pz-card">
              <p className="pz-body">{shortPremise(spec.premise, 220)}</p>
              <p className="pz-count" data-testid="puzzle-seal-count">
                Seals broken: <strong>{brokenCount}</strong> / {sealIds.length}
              </p>
            </div>
            <p className="pz-status" role="status" aria-live="polite" data-testid="puzzle-status">
              {status ||
                (openable.length > 0
                  ? `Power reaches ${listText(openable.map(nameOf))}. Select the glowing ${openable.length > 1 ? "seals" : "seal"} to break ${openable.length > 1 ? "them" : "it"}.`
                  : "Turn the conduits so power flows from the source to a seal.")}
            </p>
            {showIdleTip && <p className="pz-tip">Hint: rotate the dim tiles next to the glow.</p>}
            <div className="pz-row">
              <button type="button" className="pz-secondary" aria-pressed={revealOn} onClick={() => setManualReveal((v) => !v)} data-testid="puzzle-reveal">
                {revealOn ? "Hide route help" : "Reveal route"}
              </button>
              {revealOn && <span className="pz-small">{reveal.size > 0 ? `${reveal.size} conduit${reveal.size === 1 ? "" : "s"} marked to turn.` : "Every powered route is connected."}</span>}
            </div>
            <div className="pz-card pz-seals">
              {board.routes.map((route) =>
                route.encounterIds.length === 0 ? null : (
                  <div key={route.index} className="pz-route">
                    <p className="pz-kicker">{unitName(route.encounterIds) ?? `Route ${route.index + 1}`}</p>
                    <ul>
                      {route.encounterIds.map((id) => (
                        <li key={id}>
                          <button type="button" className="pz-seal-row" data-seal-state={seals[id].state} onClick={() => moveCursor(board.tileOf[id])} aria-label={`Find ${nameOf(id)} on the board: ${stateText(seals[id].state)}`}>
                            <span className={`pz-chip pz-chip-${seals[id].state}`} aria-hidden>
                              {seals[id].number}
                            </span>
                            <span className="pz-seal-name">{nameOf(id)}</span>
                            <span className="pz-seal-state">{stateText(seals[id].state)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
              {board.bossId && (
                <div className="pz-route">
                  <p className="pz-kicker">Core</p>
                  <button type="button" className="pz-seal-row" data-seal-state={coreState} onClick={() => moveCursor(board.core)} aria-label={`Find the core on the board: ${stateText(coreState)}`}>
                    <span className={`pz-chip pz-chip-${coreState}`} aria-hidden>
                      {(progression.byId.get(board.bossId)?.index ?? 0) + 1}
                    </span>
                    <span className="pz-seal-name">{nameOf(board.bossId)}</span>
                    <span className="pz-seal-state">{stateText(coreState)}</span>
                  </button>
                </div>
              )}
            </div>
            <Legend colors={colors} />
            <p className="pz-small pz-keys">
              <kbd>Arrows</kbd> move · <kbd>Space</kbd> or <kbd>Enter</kbd> turn / open · <kbd>Shift</kbd> or right-click turns back
            </p>
          </div>
        )}
      </aside>
    </div>
  );

  function ariaFor(i: number): string {
    const t = board.tiles[i];
    const where = `row ${t.y + 1}, column ${t.x + 1}`;
    if (t.kind === "source") return `Power source, ${where}`;
    if (t.kind === "rivet") return `Riveted plate, ${where}`;
    if (t.rotatable) {
      const fusedNote = fused.has(i) ? ", fused in gold" : "";
      const flag = reveal.has(i) ? ", needs turning" : "";
      return `${t.kind} conduit, ${powered[i] ? "powered" : "dark"}${fusedNote}${flag}, ${where}`;
    }
    const tipText = tooltipFor(i);
    return `${t.kind === "core" ? "Core" : "Seal"}: ${tipText?.title ?? ""}. ${tipText?.line ?? ""} (${where})`;
  }
}

function stateText(state: SealState): string {
  switch (state) {
    case "solved":
      return "Broken";
    case "ready":
      return "Ready";
    case "blocked":
      return "Locked";
    case "unpowered":
      return "Route power";
    default:
      return "Sealed";
  }
}

function Tooltip({ board, index, vbW, vbH, title, line }: { board: ReturnType<typeof generateBoard>; index: number; vbW: number; vbH: number; title: string; line: string }) {
  const t = board.tiles[index];
  const below = t.y === 0;
  const cx = ((PAD + t.x * CELL + CELL / 2) / vbW) * 100;
  const y = ((PAD + (below ? t.y + 1 : t.y) * CELL) / vbH) * 100;
  const align = t.x <= 1 ? "0%" : t.x >= board.width - 2 ? "-100%" : "-50%";
  const leftPct = t.x <= 1 ? ((PAD + t.x * CELL) / vbW) * 100 : t.x >= board.width - 2 ? ((PAD + (t.x + 1) * CELL) / vbW) * 100 : cx;
  return (
    <div className="pz-tooltip" role="tooltip" data-testid="puzzle-tooltip" style={{ left: `${leftPct}%`, top: `${y}%`, transform: `translate(${align}, ${below ? "8px" : "calc(-100% - 8px)"})` }}>
      <strong>{title}</strong>
      <span>{line}</span>
    </div>
  );
}

function Legend({ colors }: { colors: BoardColors }) {
  const item = (label: string, art: ReactNode) => (
    <li>
      <svg viewBox="0 0 40 40" width={28} height={28} aria-hidden>
        {art}
      </svg>
      <span>{label}</span>
    </li>
  );
  return (
    <ul className="pz-legend" aria-label="Legend">
      {item(
        "Source",
        <polygon points="20,4 32,20 20,36 8,20" fill={colors.power} />,
      )}
      {item(
        "Conduit (turn it)",
        <>
          <path d="M20 0 A20 20 0 0 0 40 20" stroke="#b48a52" strokeWidth={10} fill="none" />
          <path d="M20 0 A20 20 0 0 0 40 20" stroke={colors.power} strokeWidth={3.5} fill="none" />
        </>,
      )}
      {item(
        "Seal (a challenge)",
        <polygon points="20,3 35,11.5 35,28.5 20,37 5,28.5 5,11.5" fill="#1c262d" stroke={colors.power} strokeWidth={3} />,
      )}
      {item(
        "Core",
        <>
          <circle cx={20} cy={20} r={16} fill="none" stroke={colors.power} strokeWidth={2.5} />
          <circle cx={20} cy={20} r={7} fill={colors.power} />
        </>,
      )}
    </ul>
  );
}

const HOST_CSS = `
.pz-host { display: grid; grid-template-columns: minmax(0, 1fr) clamp(400px, 40vw, 660px); gap: 16px; align-items: start; color: #f5f3ee; }
@media (max-width: 1000px) { .pz-host { grid-template-columns: minmax(0, 1fr); } }
.pz-board-col { min-width: 0; display: flex; justify-content: center; }
.pz-board-wrap { position: relative; }
.pz-grid { position: absolute; inset: 0; }
.pz-cell { position: absolute; background: transparent; border: 0; padding: 0; margin: 0; border-radius: 10%; cursor: default; }
.pz-cell-turn, .pz-cell-ready { cursor: pointer; }
.pz-cell:hover { background: rgba(255,255,255,0.06); }
.pz-cell:focus { outline: none; }
.pz-cell:focus-visible { outline: 4px solid #ffffff; outline-offset: -3px; box-shadow: inset 0 0 0 8px color-mix(in oklab, var(--pz-power) 55%, transparent); }
.pz-tooltip { position: absolute; z-index: 5; pointer-events: none; display: flex; flex-direction: column; gap: 2px; width: max-content; max-width: 340px; padding: 10px 14px; border-radius: 10px; background: #0d1317; border: 2px solid var(--pz-power); font-size: 18px; line-height: 1.3; box-shadow: 0 8px 24px rgba(0,0,0,0.5); white-space: normal; }
.pz-tooltip strong { font-size: 18px; }
.pz-banner { position: absolute; left: 50%; bottom: 6%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; padding: 14px 34px; border-radius: 16px; background: rgba(8,12,15,0.88); border: 3px solid #f3c969; box-shadow: 0 0 40px color-mix(in oklab, var(--pz-power) 60%, transparent); pointer-events: none; animation: pz-banner-in 700ms ease-out both; }
.pz-banner-kicker { font-size: 18px; letter-spacing: 0.2em; text-transform: uppercase; color: #f3c969; font-weight: 700; }
.pz-banner-title { font-size: 30px; font-weight: 800; }
.pz-side { min-width: 0; max-height: calc(100vh - 150px); overflow-y: auto; padding: 12px; border-radius: 16px; background: #080d10; color: #f5f3ee; }
.pz-stack { display: flex; flex-direction: column; gap: 12px; }
.pz-card { border-radius: 14px; padding: 14px 16px; background: #0d1418; border: 1px solid #2a3942; }
.pz-body { font-size: 18px; line-height: 1.45; }
.pz-count { margin-top: 8px; font-size: 22px; }
.pz-count strong { color: var(--pz-power); font-size: 26px; }
.pz-status { font-size: 18px; line-height: 1.4; padding: 10px 14px; border-left: 4px solid var(--pz-power); background: rgba(255,255,255,0.04); border-radius: 6px; min-height: 3.2em; }
.pz-tip { font-size: 18px; color: #ffd28a; }
.pz-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.pz-small { font-size: 16px; color: #c9d1d6; }
.pz-kicker { font-size: 16px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--pz-power); }
.pz-secondary { font-size: 17px; padding: 8px 16px; border-radius: 10px; border: 2px solid #ffb454; color: #ffd28a; background: transparent; }
.pz-secondary[aria-pressed="true"] { background: rgba(255,180,84,0.15); }
.pz-secondary:hover { background: rgba(255,180,84,0.12); }
.pz-secondary:focus-visible, .pz-primary:focus-visible, .pz-seal-row:focus-visible { outline: 3px solid #ffffff; outline-offset: 2px; }
.pz-primary { align-self: flex-start; font-size: 20px; font-weight: 700; padding: 12px 22px; border-radius: 12px; background: var(--pz-power); color: #061014; }
.pz-primary:hover { filter: brightness(1.08); }
.pz-seals { display: flex; flex-direction: column; gap: 10px; }
.pz-route ul { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
.pz-seal-row { width: 100%; display: flex; align-items: center; gap: 10px; padding: 5px 8px; border-radius: 8px; text-align: left; font-size: 17px; background: transparent; }
.pz-seal-row:hover { background: rgba(255,255,255,0.06); }
.pz-seal-name { flex: 1; min-width: 0; }
.pz-seal-state { font-size: 16px; color: #c9d1d6; }
.pz-seal-row[data-seal-state="ready"] .pz-seal-state { color: var(--pz-power); font-weight: 700; }
.pz-seal-row[data-seal-state="solved"] .pz-seal-state { color: #f3c969; }
.pz-chip { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: 50%; font-size: 16px; font-weight: 800; background: #1b2329; border: 2px solid #4d565e; color: #aab4bc; }
.pz-chip-ready { border-color: var(--pz-power); color: #fff; box-shadow: 0 0 10px var(--pz-power); }
.pz-chip-solved { background: #f3c969; border-color: #f3c969; color: #2b2008; }
.pz-chip-blocked { border-color: #9aa3ab; color: #e6eaed; }
.pz-chip-unpowered { border-color: #b48a52; color: #f0d7b0; }
.pz-legend { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 16px; }
.pz-legend li { display: flex; align-items: center; gap: 8px; }
.pz-keys kbd { font-family: inherit; font-size: 15px; padding: 1px 6px; border-radius: 5px; border: 1px solid #56646d; background: #141d22; }
/* ChallengePanel puts its hint ladder beside the widget from the lg viewport breakpoint; in this column that squeezes
   the widget, so stack them (layout only; TODO: a ChallengePanel "stacked" prop would make this unnecessary) */
.pz-side .lg\\:flex-row { flex-direction: column; }
.pz-side .lg\\:w-64 { width: auto; }
.pz-challenge-head { display: flex; align-items: center; gap: 12px; }
.pz-challenge-name { font-size: 22px; font-weight: 700; }
.pz-finale { display: flex; flex-direction: column; gap: 12px; border: 2px solid #f3c969; }
.pz-finale-title { font-size: 30px; font-weight: 800; }
.pz-line { font-size: 18px; font-style: italic; }
.pz-line strong { font-style: normal; }

.pz-rot { transform-box: fill-box; transform-origin: center; transition: transform 170ms cubic-bezier(.3,1.4,.5,1); }
.pz-pulse { stroke-dasharray: 10 40; animation: pz-flow 0.9s linear infinite; }
.pz-pulse-core { stroke-dasharray: 4 46; }
.pz-breathe { animation: pz-breathe 1.6s ease-in-out infinite; }
.pz-spin, .pz-spin-rev, .pz-spin-slow { transform-box: fill-box; transform-origin: center; }
.pz-spin { animation: pz-spin 9s linear infinite; }
.pz-spin-rev { animation: pz-spin 6s linear infinite reverse; }
.pz-spin-slow { animation: pz-spin 40s linear infinite; }
.pz-reveal { animation: pz-breathe 1.2s ease-in-out infinite; }
.pz-ping { animation: pz-ping 1.8s ease-out both; }
.pz-shard { transform-box: fill-box; transform-origin: center; animation: pz-shard 900ms cubic-bezier(.2,.7,.3,1) both; }
.pz-ringburst { transform-box: fill-box; transform-origin: center; animation: pz-ringburst 800ms ease-out both; }
.pz-flash { animation: pz-flash 500ms ease-out both; }
.pz-flicker { animation: pz-flicker 900ms linear both; }
.pz-resonate .pz-channel { animation: pz-reso 1.4s ease-in-out infinite; }
@keyframes pz-flow { to { stroke-dashoffset: -50; } }
@keyframes pz-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
@keyframes pz-spin { to { transform: rotate(360deg); } }
@keyframes pz-ping { 0% { opacity: 0; } 15% { opacity: 1; } 35% { opacity: 0.2; } 55% { opacity: 1; } 100% { opacity: 0; } }
@keyframes pz-shard { from { transform: translate(0, 0) rotate(0deg); opacity: 1; } to { transform: translate(var(--tx), var(--ty)) rotate(var(--rot)); opacity: 0; } }
@keyframes pz-ringburst { from { transform: scale(0.6); opacity: 1; } to { transform: scale(3.2); opacity: 0; } }
@keyframes pz-flash { from { opacity: 0.9; } to { opacity: 0; } }
@keyframes pz-flicker { 0% { opacity: 0; } 10% { opacity: 1; } 22% { opacity: 0.15; } 34% { opacity: 1; } 50% { opacity: 0.25; } 66% { opacity: 0.9; } 100% { opacity: 0; } }
@keyframes pz-reso { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes pz-banner-in { from { opacity: 0; transform: translate(-50%, -12px); } to { opacity: 1; transform: translate(-50%, 0); } }
@media (prefers-reduced-motion: reduce) {
  .pz-anim, .pz-banner, .pz-resonate .pz-channel { animation: none !important; }
  .pz-rot { transition: none; }
  .pz-shard, .pz-ringburst, .pz-flash, .pz-flicker, .pz-ping { opacity: 0; }
}
`;
