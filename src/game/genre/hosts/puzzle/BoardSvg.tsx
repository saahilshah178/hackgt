"use client";

import type { CSSProperties, ReactNode } from "react";
import { SocketGlyph, hexPoints } from "./glyphs";
import { DX, DY, dirsOf, type Board, type SealState, type Tile } from "./puzzle.logic";

/*
 * The circuit board, drawn as one SVG (tiles are 100 user units; PAD units of brass frame around them). Purely
 * presentational: PuzzleHost computes power, states and highlights and lays transparent buttons over the tiles for
 * input and focus.
 */

export const CELL = 100;
export const PAD = 44;

export interface BoardColors {
  power: string;
  powerSoft: string;
  plate: string;
  plateEdge: string;
  boardTop: string;
  boardBottom: string;
  grid: string;
  text: string;
}

export interface SealView {
  state: SealState;
  /** 1-based position in the spec's encounter order (a badge that tells same-concept seals apart) */
  number: number;
  label: string;
  socket: string;
}

export interface BoardSvgProps {
  board: Board;
  turns: readonly number[];
  powered: readonly boolean[];
  /** tiles of fused (solved) segments, drawn in gold */
  fused: ReadonlySet<number>;
  charged: boolean;
  /** route tiles lit so far per route (litPrefix) */
  lit: readonly number[];
  seals: Record<string, SealView>;
  core: { state: SealState; label: string };
  /** conduits to highlight as mis-rotated ("Reveal route") */
  reveal: ReadonlySet<number>;
  /** a brief flash on these tiles (the player poked an unpowered seal); keyed by pingSeq */
  ping: ReadonlySet<number>;
  pingSeq: number;
  /** the latest graded answer, for the shatter / flicker */
  fx: { tile: number; correct: boolean; seq: number } | null;
  finished: boolean;
  colors: BoardColors;
  title: string;
}

const GOLD_STOPS = ["#fff1b8", "#f3c969", "#b8862b"];
const BRASS_STOPS = ["#e2c088", "#b48a52", "#6f5230"];

export function BoardSvg(props: BoardSvgProps) {
  const { board, colors } = props;
  const vbW = board.width * CELL + PAD * 2;
  const vbH = board.height * CELL + PAD * 2;
  const pos = (t: Tile) => `translate(${PAD + t.x * CELL} ${PAD + t.y * CELL})`;
  const center = (i: number) => {
    const t = board.tiles[i];
    return [PAD + t.x * CELL + CELL / 2, PAD + t.y * CELL + CELL / 2] as const;
  };

  const plates: ReactNode[] = [];
  const pipes: ReactNode[] = [];
  const nodes: ReactNode[] = [];
  for (const t of board.tiles) {
    plates.push(<Plate key={t.index} tile={t} at={pos(t)} colors={colors} />);
    if (t.kind === "straight" || t.kind === "corner" || t.kind === "tee")
      pipes.push(
        <g key={t.index} transform={pos(t)}>
          <Conduit tile={t} turn={props.turns[t.index]} powered={props.powered[t.index]} fused={props.fused.has(t.index)} power={colors.power} />
        </g>,
      );
    else if (t.kind === "seal" && t.encounterId) {
      const view = props.seals[t.encounterId];
      nodes.push(
        <g key={t.index} transform={pos(t)} data-seal={t.encounterId}>
          <Seal tile={t} view={view} board={board} powered={props.powered} colors={colors} />
        </g>,
      );
    } else if (t.kind === "source")
      nodes.push(
        <g key={t.index} transform={pos(t)}>
          <Source tile={t} colors={colors} />
        </g>,
      );
    else if (t.kind === "core")
      nodes.push(
        <g key={t.index} transform={pos(t)}>
          <Core tile={t} state={props.core.state} label={props.core.label} charged={props.charged} finished={props.finished} colors={colors} />
        </g>,
      );
  }

  // the travelling pulse: one polyline per route, from the source through every lit route tile
  const pulses = board.routes.map((route) => {
    const n = props.lit[route.index] ?? 0;
    if (n === 0) return null;
    const cells = route.cells.slice(0, n);
    const pts = [center(board.source), ...cells.map(center)];
    if (n === route.cells.length && props.charged) pts.push(center(board.core));
    const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
    return (
      <g key={route.index}>
        <path d={d} className="pz-anim pz-pulse" stroke={colors.power} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#pz-glow)" />
        <path d={d} className="pz-anim pz-pulse pz-pulse-core" stroke="#ffffff" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  });

  const reveal = [...props.reveal].map((i) => {
    const t = board.tiles[i];
    return (
      <g key={i} transform={pos(t)} className="pz-anim pz-reveal">
        <rect x={6} y={6} width={88} height={88} rx={12} fill="none" stroke="#ffb454" strokeWidth={4} strokeDasharray="10 7" />
        <g transform="translate(82 18)">
          <circle r={13} fill="#ffb454" />
          <path d="M-5 -3 A6 6 0 1 1 -3 5" fill="none" stroke="#1a1206" strokeWidth={2.6} strokeLinecap="round" />
          <path d="M-9 -5 L-5 -3 L-3 -8" fill="none" stroke="#1a1206" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    );
  });

  const ping = [...props.ping].map((i) => {
    const t = board.tiles[i];
    return <rect key={`${props.pingSeq}-${i}`} x={PAD + t.x * CELL + 5} y={PAD + t.y * CELL + 5} width={90} height={90} rx={12} className="pz-anim pz-ping" fill="none" stroke="#ffb454" strokeWidth={5} />;
  });

  let fx: ReactNode = null;
  if (props.fx) {
    const [cx, cy] = center(props.fx.tile);
    const isCore = props.fx.tile === board.core;
    fx = props.fx.correct ? <Shatter key={props.fx.seq} cx={cx} cy={cy} color={colors.power} big={isCore} /> : <Flicker key={props.fx.seq} cx={cx} cy={cy} round={isCore} />;
  }

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" height="100%" role="img" aria-label={`${props.title}: circuit board`} className={props.finished ? "pz-resonate" : undefined} style={{ display: "block" }}>
      <defs>
        <linearGradient id="pz-board" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={colors.boardTop} />
          <stop offset="1" stopColor={colors.boardBottom} />
        </linearGradient>
        <linearGradient id="pz-frame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9b67c" />
          <stop offset="0.5" stopColor="#8d6a3b" />
          <stop offset="1" stopColor="#c69c5c" />
        </linearGradient>
        <linearGradient id="pz-brass" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">
          {BRASS_STOPS.map((c, i) => (
            <stop key={i} offset={i / 2} stopColor={c} />
          ))}
        </linearGradient>
        <linearGradient id="pz-gold" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">
          {GOLD_STOPS.map((c, i) => (
            <stop key={i} offset={i / 2} stopColor={c} />
          ))}
        </linearGradient>
        <radialGradient id="pz-medal" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#34414a" />
          <stop offset="1" stopColor="#10171c" />
        </radialGradient>
        <radialGradient id="pz-coreface" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor={colors.powerSoft} />
          <stop offset="1" stopColor="#0b1116" />
        </radialGradient>
        <radialGradient id="pz-crystal" cx="0.4" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor={colors.power} />
          <stop offset="1" stopColor={colors.powerSoft} />
        </radialGradient>
        <filter id="pz-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="pz-bigglow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* frame and board */}
      <rect x={2} y={2} width={vbW - 4} height={vbH - 4} rx={26} fill="url(#pz-frame)" />
      <rect x={10} y={10} width={vbW - 20} height={vbH - 20} rx={20} fill="#0a0d10" />
      <rect x={PAD - 8} y={PAD - 8} width={board.width * CELL + 16} height={board.height * CELL + 16} rx={14} fill="url(#pz-board)" stroke={colors.grid} strokeWidth={2} />
      {[
        [22, 22],
        [vbW - 22, 22],
        [22, vbH - 22],
        [vbW - 22, vbH - 22],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={7} fill="#caa468" stroke="#5b4222" strokeWidth={2} />
          <path d={`M${x - 4} ${y} H${x + 4}`} stroke="#5b4222" strokeWidth={2} />
        </g>
      ))}
      <text x={vbW / 2} y={PAD / 2 + 5} textAnchor="middle" fontSize={17} fontWeight={700} letterSpacing={4} fill="#e8d3a6" style={{ textTransform: "uppercase" }}>
        {props.title}
      </text>

      {/* grid lines */}
      <g stroke={colors.grid} strokeWidth={1} opacity={0.55}>
        {Array.from({ length: board.width + 1 }, (_, x) => (
          <line key={`v${x}`} x1={PAD + x * CELL} y1={PAD} x2={PAD + x * CELL} y2={PAD + board.height * CELL} />
        ))}
        {Array.from({ length: board.height + 1 }, (_, y) => (
          <line key={`h${y}`} x1={PAD} y1={PAD + y * CELL} x2={PAD + board.width * CELL} y2={PAD + y * CELL} />
        ))}
      </g>

      <g>{plates}</g>
      <g>{pipes}</g>
      <g>{pulses}</g>
      <g>{nodes}</g>
      <g>{reveal}</g>
      <g>{ping}</g>
      {fx}
    </svg>
  );
}

function Plate({ tile, at, colors }: { tile: Tile; at: string; colors: BoardColors }) {
  if (tile.kind === "rivet")
    return (
      <g transform={at}>
        <rect x={6} y={6} width={88} height={88} rx={10} fill="#0b0f12" stroke={colors.plateEdge} strokeWidth={1.5} />
        <path d="M22 78 L78 22 M36 86 L86 36 M14 64 L64 14" stroke={colors.plateEdge} strokeWidth={2} opacity={0.5} />
        {[
          [18, 18],
          [82, 18],
          [18, 82],
          [82, 82],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4.5} fill="#3b3326" stroke="#7a6645" strokeWidth={1.2} />
        ))}
      </g>
    );
  return (
    <g transform={at}>
      <rect x={4} y={4} width={92} height={92} rx={12} fill={colors.plate} stroke={colors.plateEdge} strokeWidth={1.5} />
      <rect x={8} y={8} width={84} height={84} rx={9} fill="none" stroke="#ffffff" strokeOpacity={0.04} strokeWidth={2} />
    </g>
  );
}

const PIPE_D = {
  straight: "M50 0 V100",
  corner: "M50 0 A50 50 0 0 0 100 50",
  tee: "M50 0 V100 M50 50 H100",
} as const;

function Flanges({ mask, fill }: { mask: number; fill: string }) {
  return (
    <>
      {dirsOf(mask).map((d) => (
        <rect key={d} x={33} y={1} width={34} height={9} rx={2.5} fill={fill} transform={`rotate(${d * 90} 50 50)`} />
      ))}
    </>
  );
}

function Conduit({ tile, turn, powered, fused, power }: { tile: Tile; turn: number; powered: boolean; fused: boolean; power: string }) {
  const kind = tile.kind as keyof typeof PIPE_D;
  const d = PIPE_D[kind];
  const tube = fused ? "url(#pz-gold)" : "url(#pz-brass)";
  const style: CSSProperties = { transform: `rotate(${turn * 90}deg)` };
  return (
    <g className="pz-rot" style={style}>
      <rect width={100} height={100} fill="none" />
      <path d={d} stroke="#070504" strokeWidth={30} fill="none" opacity={0.85} />
      <path d={d} stroke={tube} strokeWidth={21} fill="none" />
      <Flanges mask={tile.base} fill={fused ? "#b8862b" : "#5e4526"} />
      {kind === "tee" && <circle cx={50} cy={50} r={16} fill={tube} stroke="#070504" strokeWidth={2} />}
      <path d={d} stroke={powered ? power : "#17110b"} strokeWidth={powered ? 8 : 7} fill="none" className={powered ? "pz-channel" : undefined} filter={powered ? "url(#pz-glow)" : undefined} />
    </g>
  );
}

/** Fixed conduit stubs from the tile centre to each opening (seals, source, core). */
function Stubs({ mask, lit, gold, power }: { mask: number; lit: (d: number) => boolean; gold: boolean; power: string }) {
  return (
    <>
      {dirsOf(mask).map((d) => (
        <g key={d} transform={`rotate(${d * 90} 50 50)`}>
          <path d="M50 50 V0" stroke="#070504" strokeWidth={30} opacity={0.85} />
          <path d="M50 50 V0" stroke={gold ? "url(#pz-gold)" : "url(#pz-brass)"} strokeWidth={21} />
          <rect x={33} y={1} width={34} height={9} rx={2.5} fill={gold ? "#b8862b" : "#5e4526"} />
          <path d="M50 50 V0" stroke={lit(d) ? power : "#17110b"} strokeWidth={8} className={lit(d) ? "pz-channel" : undefined} filter={lit(d) ? "url(#pz-glow)" : undefined} />
        </g>
      ))}
    </>
  );
}

function LabelPill({ text, y, fill, color, border }: { text: string; y: number; fill: string; color: string; border: string }) {
  const w = Math.min(132, Math.max(44, text.length * 10.4 + 18));
  return (
    <g>
      <rect x={50 - w / 2} y={y} width={w} height={25} rx={12.5} fill={fill} stroke={border} strokeWidth={2} />
      <text x={50} y={y + 18.5} textAnchor="middle" fontSize={17.5} fontWeight={700} fill={color}>
        {text}
      </text>
    </g>
  );
}

function Seal({ tile, view, board, powered, colors }: { tile: Tile; view: SealView; board: Board; powered: readonly boolean[]; colors: BoardColors }) {
  const solved = view.state === "solved";
  const lit = (d: number) => {
    if (!powered[tile.index]) return false;
    if (solved) return true;
    const t = board.tiles[tile.index];
    const nx = t.x + DX[d];
    const ny = t.y + DY[d];
    const n = ny * board.width + nx;
    return nx >= 0 && ny >= 0 && nx < board.width && ny < board.height && powered[n] && (board.tiles[n].kind === "source" || board.tiles[n].rotatable || board.tiles[n].kind === "seal");
  };
  if (solved)
    return (
      <g>
        <Stubs mask={tile.base} lit={lit} gold power={colors.power} />
        <polygon points={hexPoints(50, 50, 21)} fill="url(#pz-gold)" stroke="#6b4b14" strokeWidth={2.5} />
        <circle cx={50} cy={50} r={8} fill={colors.power} filter="url(#pz-glow)" />
        <LabelPill text={view.label} y={74} fill="#2b2008" color="#ffe7a3" border="#b8862b" />
      </g>
    );
  const ring =
    view.state === "ready" ? colors.power : view.state === "blocked" ? "#9aa3ab" : view.state === "unpowered" ? "#b48a52" : "#4d565e";
  const glyphColor = view.state === "ready" ? "#ffffff" : view.state === "dormant" ? "#77828b" : "#d8dde1";
  return (
    <g opacity={view.state === "dormant" ? 0.8 : 1}>
      <Stubs mask={tile.base} lit={lit} gold={false} power={colors.power} />
      {view.state === "ready" && <polygon points={hexPoints(50, 46, 44)} fill="none" stroke={colors.power} strokeWidth={5} className="pz-anim pz-breathe" filter="url(#pz-bigglow)" />}
      <polygon points={hexPoints(50, 46, 38)} fill="url(#pz-medal)" stroke={ring} strokeWidth={view.state === "ready" ? 5 : 4} />
      <polygon points={hexPoints(50, 46, 30)} fill="none" stroke={ring} strokeOpacity={0.45} strokeWidth={1.5} />
      <g transform="translate(50 46)">
        <SocketGlyph socket={view.socket} color={glyphColor} size={0.95} />
      </g>
      {view.state === "blocked" && (
        <g transform="translate(84 14)">
          <circle r={14} fill="#1b2227" stroke="#d8dde1" strokeWidth={2} />
          <path d="M-5 -1 V-5 A5 5 0 0 1 5 -5 V-1" fill="none" stroke="#d8dde1" strokeWidth={2.4} />
          <rect x={-7} y={-1} width={14} height={10} rx={2} fill="#d8dde1" />
        </g>
      )}
      <g transform="translate(15 13)">
        <circle r={13} fill="#0d1317" stroke={ring} strokeWidth={2.5} />
        <text y={6} textAnchor="middle" fontSize={17} fontWeight={800} fill={glyphColor}>
          {view.number}
        </text>
      </g>
      {view.state === "unpowered" && <circle cx={50} cy={46} r={44} fill="none" stroke="#b48a52" strokeWidth={2.5} strokeDasharray="6 8" className="pz-anim pz-spin-slow" />}
      <LabelPill text={view.label} y={74} fill="#0d1317" color={view.state === "dormant" ? "#aab4bc" : "#f5f3ee"} border={ring} />
    </g>
  );
}

function Source({ tile, colors }: { tile: Tile; colors: BoardColors }) {
  return (
    <g>
      <Stubs mask={tile.base} lit={() => true} gold={false} power={colors.power} />
      <circle cx={50} cy={50} r={34} fill="#0b1116" stroke="url(#pz-frame)" strokeWidth={5} />
      <polygon points="50,20 70,50 50,80 30,50" fill="url(#pz-crystal)" className="pz-anim pz-breathe" filter="url(#pz-bigglow)" />
      <path d="M50 20 L44 50 L50 80 M30 50 H70" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.5} fill="none" />
    </g>
  );
}

function Core({ tile, state, label, charged, finished, colors }: { tile: Tile; state: SealState; label: string; charged: boolean; finished: boolean; colors: BoardColors }) {
  const hot = charged || state === "solved";
  const ring = state === "solved" ? "#f3c969" : state === "ready" ? colors.power : hot ? colors.power : "#5d6a73";
  return (
    <g>
      <Stubs mask={tile.base} lit={() => hot} gold={state === "solved"} power={colors.power} />
      {state === "ready" && <circle cx={50} cy={50} r={60} fill="none" stroke={colors.power} strokeWidth={5} className="pz-anim pz-breathe" filter="url(#pz-bigglow)" />}
      <circle cx={50} cy={50} r={54} fill="#0a0f13" stroke={ring} strokeWidth={3} />
      <g className={`pz-anim ${hot ? "pz-spin" : "pz-spin-slow"}`}>
        <circle cx={50} cy={50} r={46} fill="none" stroke={ring} strokeWidth={1.5} strokeDasharray="3 7" />
        <circle cx={50} cy={4} r={5} fill={ring} />
      </g>
      <g className={`pz-anim ${hot ? "pz-spin-rev" : "pz-spin-slow"}`}>
        <ellipse cx={50} cy={50} rx={36} ry={14} fill="none" stroke={ring} strokeWidth={2} transform="rotate(-28 50 50)" />
        <circle cx={82} cy={42} r={4} fill={ring} />
      </g>
      <circle cx={50} cy={50} r={24} fill={hot ? "url(#pz-coreface)" : "#141c22"} stroke={ring} strokeWidth={3} filter={hot ? "url(#pz-glow)" : undefined} />
      <circle cx={50} cy={50} r={9} fill={hot ? "#ffffff" : "#2c363d"} className={hot ? "pz-anim pz-breathe" : undefined} />
      {state === "blocked" && (
        <g transform="translate(92 8)">
          <circle r={14} fill="#1b2227" stroke="#d8dde1" strokeWidth={2} />
          <path d="M-5 -1 V-5 A5 5 0 0 1 5 -5 V-1" fill="none" stroke="#d8dde1" strokeWidth={2.4} />
          <rect x={-7} y={-1} width={14} height={10} rx={2} fill="#d8dde1" />
        </g>
      )}
      {!finished && <LabelPill text={label} y={84} fill="#0d1317" color="#f5f3ee" border={ring} />}
    </g>
  );
}

function Shatter({ cx, cy, color, big }: { cx: number; cy: number; color: string; big?: boolean }) {
  const shards = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const b = a + Math.PI / 3;
    const mid = (a + b) / 2;
    const r = big ? 50 : 38;
    const pts = `${cx},${cy} ${cx + r * Math.cos(a)},${cy + r * Math.sin(a)} ${cx + r * Math.cos(b)},${cy + r * Math.sin(b)}`;
    const style = { "--tx": `${Math.cos(mid) * 70}px`, "--ty": `${Math.sin(mid) * 70}px`, "--rot": `${i % 2 ? 80 : -80}deg` } as CSSProperties;
    return <polygon key={i} points={pts} fill="#2a363f" stroke={color} strokeWidth={3} className="pz-anim pz-shard" style={style} />;
  });
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={20} fill="none" stroke={color} strokeWidth={8} className="pz-anim pz-ringburst" />
      <circle cx={cx} cy={cy} r={30} fill="#fff6d6" className="pz-anim pz-flash" />
      {shards}
    </g>
  );
}

function Flicker({ cx, cy, round }: { cx: number; cy: number; round?: boolean }) {
  return (
    <g pointerEvents="none" className="pz-anim pz-flicker">
      {round ? (
        <circle cx={cx} cy={cy} r={58} fill="#ff4b3e" fillOpacity={0.3} stroke="#ff5a4d" strokeWidth={7} />
      ) : (
        <polygon points={hexPoints(cx, cy - 4, 42)} fill="#ff4b3e" fillOpacity={0.3} stroke="#ff5a4d" strokeWidth={6} />
      )}
    </g>
  );
}
