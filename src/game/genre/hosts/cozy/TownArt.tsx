"use client";

import type { ReactNode } from "react";
import type { Palette } from "../../../engine/palettes";
import { mix, type BuildingId, type HouseSpot, type VillagerLook } from "./cozy.logic";

/*
 * SVG art for the cozy town: every shape is drawn in local coordinates with its base at (0, 0) and placed by the
 * scene with translate/scale. Animated parts carry `cz-anim` so prefers-reduced-motion can stop them (see COZY_CSS).
 */

export interface CozyTokens {
  cream: string;
  card: string;
  ink: string;
  inkSoft: string;
  lamp: string;
  grass: string;
  grassDeep: string;
  hillNear: string;
  hillFar: string;
  path: string;
  stone: string;
  stoneDark: string;
  sea: string;
  seaDeep: string;
  accent: string;
  accentInk: string;
  wood: string;
  desk: string;
}

export function cozyTokens(p: Palette): CozyTokens {
  const cream = "#fff6e3";
  const accent = p.css.accent;
  return {
    cream,
    card: "#fff9ee",
    ink: "#2b2920",
    inkSoft: "#4d4838",
    lamp: "#ffd36b",
    grass: mix(mix(accent, p.css.floor, 0.18), cream, 0.4),
    grassDeep: mix(mix(accent, p.css.floor, 0.35), cream, 0.18),
    hillNear: mix(mix(accent, p.css.floor, 0.3), cream, 0.3),
    hillFar: mix(mix(accent, "#9bb7c9", 0.45), cream, 0.45),
    path: mix(cream, "#e9d6b0", 0.55),
    stone: "#e6dac2",
    stoneDark: "#c9b99a",
    sea: mix("#8fd0dc", accent, 0.12),
    seaDeep: mix("#5aa3bd", p.css.floor, 0.15),
    accent,
    accentInk: mix(accent, "#1d2a12", 0.62),
    wood: "#8a5a3b",
    desk: mix(p.css.background, "#3b2a1c", 0.55),
  };
}

/** sky gradient stops [top, bottom] by time of day: 0 morning, 1 midday, 2 afternoon, 3 evening, 4 festival night */
export const SKIES: [string, string][] = [
  ["#bfe2ea", "#fff0d6"],
  ["#a8d8ee", "#eef8e6"],
  ["#f4c89f", "#fde6c0"],
  ["#6c5a96", "#f2a27f"],
  ["#141a38", "#3b3466"],
];

const FLOWER_COLORS = ["#f28ba8", "#ffd36b", "#b7a0f0", "#ff9f6e", "#ffffff", "#8fd3f4"];

// ---------------------------------------------------------------------------------------------------------------
// villagers

export function VillagerFace({ look, size = 56, mood = "calm", festival = false }: { look: VillagerLook; size?: number; mood?: "calm" | "happy" | "kind"; festival?: boolean }) {
  if (festival) return <LanternEmblem size={size} />;
  const eyes = mood === "happy" ? "happy" : look.eyes;
  return (
    <svg width={size} height={size} viewBox="-32 -34 64 66" aria-hidden="true" focusable="false" className="shrink-0">
      <ellipse cx="0" cy="29" rx="20" ry="3.5" fill="#000" opacity="0.12" />
      <path d="M-26 6 C -26 -20, 26 -20, 26 6 C 26 24, -26 24, -26 6 Z" fill={look.body} stroke="#3b3528" strokeWidth="2" />
      {accessory(look)}
      {eyes === "dot" && (
        <g fill="#2b2920">
          <circle cx="-9" cy="2" r="3.2" />
          <circle cx="9" cy="2" r="3.2" />
          <circle cx="-8" cy="1" r="1" fill="#fff" />
          <circle cx="10" cy="1" r="1" fill="#fff" />
        </g>
      )}
      {eyes === "happy" && (
        <g fill="none" stroke="#2b2920" strokeWidth="2.4" strokeLinecap="round">
          <path d="M-13 3 Q -9 -2 -5 3" />
          <path d="M5 3 Q 9 -2 13 3" />
        </g>
      )}
      {eyes === "wide" && (
        <g>
          <circle cx="-9" cy="2" r="4.4" fill="#fff" stroke="#2b2920" strokeWidth="1.6" />
          <circle cx="9" cy="2" r="4.4" fill="#fff" stroke="#2b2920" strokeWidth="1.6" />
          <circle cx="-8.4" cy="2.6" r="2.2" fill="#2b2920" />
          <circle cx="9.6" cy="2.6" r="2.2" fill="#2b2920" />
        </g>
      )}
      <circle cx="-16" cy="10" r="4" fill="#f59a9a" opacity="0.6" />
      <circle cx="16" cy="10" r="4" fill="#f59a9a" opacity="0.6" />
      {mood === "kind" ? (
        <path d="M-5 12 Q 0 10 5 12" fill="none" stroke="#2b2920" strokeWidth="2.2" strokeLinecap="round" />
      ) : (
        <path d="M-6 10 Q 0 16 6 10" fill="none" stroke="#2b2920" strokeWidth="2.2" strokeLinecap="round" />
      )}
    </svg>
  );
}

function accessory(look: VillagerLook): ReactNode {
  const a = look.accent;
  switch (look.accessory) {
    case "sprout":
      return (
        <g>
          <path d="M0 -14 L0 -24" stroke="#5d8a3a" strokeWidth="2.4" />
          <path d="M0 -22 C -10 -30, -14 -20, -2 -20 Z" fill="#8cc25a" stroke="#4f7a30" strokeWidth="1.4" />
          <path d="M0 -24 C 10 -32, 14 -22, 2 -22 Z" fill="#a5d46e" stroke="#4f7a30" strokeWidth="1.4" />
        </g>
      );
    case "beret":
      return (
        <g>
          <path d="M-20 -10 C -18 -24, 18 -24, 20 -10 C 10 -14, -10 -14, -20 -10 Z" fill={a} stroke="#3b3528" strokeWidth="1.8" />
          <circle cx="2" cy="-21" r="2.4" fill={a} stroke="#3b3528" strokeWidth="1.4" />
        </g>
      );
    case "bow":
      return (
        <g transform="translate(13 -13) rotate(18)">
          <path d="M0 0 L-9 -6 L-9 6 Z M0 0 L9 -6 L9 6 Z" fill={a} stroke="#3b3528" strokeWidth="1.6" strokeLinejoin="round" />
          <circle r="2.6" fill={a} stroke="#3b3528" strokeWidth="1.4" />
        </g>
      );
    case "scarf":
      return (
        <g>
          <path d="M-22 14 Q 0 24 22 14 L 22 19 Q 0 29 -22 19 Z" fill={a} stroke="#3b3528" strokeWidth="1.6" />
          <path d="M12 20 L16 30 L10 30 Z" fill={a} stroke="#3b3528" strokeWidth="1.4" />
        </g>
      );
    case "flower":
      return (
        <g transform="translate(-14 -14)">
          {[0, 72, 144, 216, 288].map((r) => (
            <circle key={r} cx={Math.cos((r * Math.PI) / 180) * 4} cy={Math.sin((r * Math.PI) / 180) * 4} r="3.4" fill={a} stroke="#3b3528" strokeWidth="1" />
          ))}
          <circle r="2.6" fill="#ffd36b" stroke="#3b3528" strokeWidth="1" />
        </g>
      );
    case "cap":
      return (
        <g>
          <path d="M-19 -9 C -17 -22, 17 -22, 19 -9 Z" fill={a} stroke="#3b3528" strokeWidth="1.8" />
          <path d="M8 -10 L28 -8 Q 28 -5 19 -6 Z" fill={a} stroke="#3b3528" strokeWidth="1.6" />
        </g>
      );
    default:
      return null;
  }
}

export function LanternEmblem({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-32 -34 64 66" aria-hidden="true" focusable="false" className="shrink-0">
      <circle cx="0" cy="0" r="30" fill="#ffd36b" opacity="0.28" />
      <path d="M0 -30 L0 -20" stroke="#6b4a2b" strokeWidth="2.4" />
      <rect x="-9" y="-22" width="18" height="5" rx="2" fill="#6b4a2b" />
      <path d="M-15 -16 C -22 0, -22 10, -10 20 L 10 20 C 22 10, 22 0, 15 -16 Z" fill="#f28b5b" stroke="#6b3a1f" strokeWidth="2" />
      <path d="M-5 -16 C -9 0, -9 10, -4 20 M5 -16 C 9 0, 9 10, 4 20" stroke="#c9602f" strokeWidth="1.6" fill="none" />
      <ellipse cx="0" cy="3" rx="6" ry="9" fill="#ffe7a0" opacity="0.9" />
      <rect x="-8" y="19" width="16" height="5" rx="2" fill="#6b4a2b" />
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// houses and buildings

export interface HouseProps {
  spot: HouseSpot;
  state: "locked" | "available" | "solved";
  waiting: boolean;
  look: VillagerLook;
  encounterId: string;
  label: string;
  celebrateKey: number | null;
  bloom: number;
}

const WINDOW_DIM = "#8ea6b3";

function Window({ x, y, w = 10, h = 11, lit }: { x: number; y: number; w?: number; h?: number; lit: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="1.5" fill={lit ? "#ffc93c" : WINDOW_DIM} stroke="#5a4a36" strokeWidth="1.4" />
      <path d={`M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}`} stroke="#5a4a36" strokeWidth="1" />
    </g>
  );
}

function darker(c: string, t = 0.22) {
  return mix(c, "#3b2a1c", t);
}

export function House({ spot, state, waiting, look, encounterId, label, celebrateKey, bloom }: HouseProps) {
  const lit = state === "solved";
  const wall = state === "locked" ? mix(spot.wall, "#c9c2b0", 0.35) : spot.wall;
  const roof = state === "locked" ? mix(spot.roof, "#a9a39a", 0.45) : spot.roof;
  const s = spot.scale * 1.08;
  const f = spot.flip ? -1 : 1;
  const chimney = spot.variant === 1 ? { x: 14, y: -86 } : spot.variant === 2 ? { x: 18, y: -68 } : { x: 16, y: -76 };
  return (
    <g transform={`translate(${spot.x} ${spot.y}) scale(${s})`} data-encounter={encounterId} data-state={state}>
      <title>{label}</title>
      <ellipse cx="2" cy="1" rx="38" ry="7" fill="#000" opacity="0.12" />
      <g className={celebrateKey !== null ? "cz-anim cz-celebrate" : undefined} key={celebrateKey ?? "still"}>
        <g transform={`scale(${f} 1)`}>
          {spot.variant === 0 && <GableHouse wall={wall} roof={roof} lit={lit} />}
          {spot.variant === 1 && <TallHouse wall={wall} roof={roof} lit={lit} />}
          {spot.variant === 2 && <WideHouse wall={wall} roof={roof} lit={lit} />}
          {lit && bloom >= 1 && (
            <g>
              <rect x="-25" y="-17" width="16" height="4" rx="2" fill="#8a5a3b" />
              {[-22, -17, -12].map((x, i) => (
                <circle key={x} cx={x} cy="-18" r="2.6" fill={FLOWER_COLORS[(i + spot.col) % FLOWER_COLORS.length]} />
              ))}
            </g>
          )}
        </g>
      </g>
      {lit && <Smoke x={chimney.x * f} y={chimney.y} />}
      {lit && (
        <g transform={`translate(${-f * 22} ${spot.variant === 1 ? -58 : spot.variant === 2 ? -50 : -49})`}>
          <path d="M0 0 V-26" stroke="#5a4a36" strokeWidth="2" />
          <path d="M0 -26 L16 -21 L0 -15 Z" fill="#ffcf4d" stroke="#8a5a00" strokeWidth="1.2" />
        </g>
      )}
      {waiting && (
        <g>
          <g transform={`translate(${f * 36} -8) scale(0.52)`}>
            <VillagerInScene look={look} />
          </g>
          <g className="cz-anim cz-bubble">
            <path d="M-2 -100 h36 a8 8 0 0 1 8 8 v12 a8 8 0 0 1 -8 8 h-20 l-8 8 l1 -8 h-9 a8 8 0 0 1 -8 -8 v-12 a8 8 0 0 1 8 -8 Z" fill="#fff9ee" stroke="#3b3528" strokeWidth="2" />
            <circle cx="6" cy="-86" r="2.8" fill="#3b3528" />
            <circle cx="16" cy="-86" r="2.8" fill="#3b3528" />
            <circle cx="26" cy="-86" r="2.8" fill="#3b3528" />
          </g>
        </g>
      )}
      {celebrateKey !== null && (
        <g key={`h${celebrateKey}`}>
          {[-14, 4, 20].map((x, i) => (
            <path
              key={x}
              className="cz-anim cz-heart"
              style={{ animationDelay: `${i * 0.25}s` }}
              d={`M${x} -84 c -4 -6 -12 -2 -8 4 l 8 8 l 8 -8 c 4 -6 -4 -10 -8 -4 Z`}
              fill="#f27a93"
              stroke="#8c2f45"
              strokeWidth="1.2"
            />
          ))}
        </g>
      )}
    </g>
  );
}

function VillagerInScene({ look }: { look: VillagerLook }) {
  return (
    <g>
      <ellipse cx="0" cy="30" rx="20" ry="4" fill="#000" opacity="0.15" />
      <path d="M-26 6 C -26 -20, 26 -20, 26 6 C 26 24, -26 24, -26 6 Z" fill={look.body} stroke="#3b3528" strokeWidth="3" />
      {accessory(look)}
      <circle cx="-9" cy="2" r="3.6" fill="#2b2920" />
      <circle cx="9" cy="2" r="3.6" fill="#2b2920" />
      <path d="M-6 10 Q 0 16 6 10" fill="none" stroke="#2b2920" strokeWidth="2.6" strokeLinecap="round" />
    </g>
  );
}

function GableHouse({ wall, roof, lit }: { wall: string; roof: string; lit: boolean }) {
  return (
    <g stroke="#5a4a36" strokeWidth="1.6" strokeLinejoin="round">
      <polygon points="24,-40 36,-47 36,-7 24,0" fill={darker(wall, 0.18)} />
      <rect x="-28" y="-40" width="52" height="40" rx="2" fill={wall} />
      <rect x="12" y="-72" width="8" height="16" fill="#b56a4c" />
      <polygon points="-2,-68 10,-75 40,-46 28,-39" fill={darker(roof, 0.2)} />
      <polygon points="-33,-38 -2,-68 28,-39" fill={roof} />
      <path d="M-8 0 V-14 a6 6 0 0 1 12 0 V0 Z" fill={darker(roof, 0.35)} />
      <Window x={-23} y={-31} lit={lit} />
      <Window x={10} y={-31} lit={lit} />
    </g>
  );
}

function TallHouse({ wall, roof, lit }: { wall: string; roof: string; lit: boolean }) {
  return (
    <g stroke="#5a4a36" strokeWidth="1.6" strokeLinejoin="round">
      <polygon points="22,-54 32,-60 32,-6 22,0" fill={darker(wall, 0.18)} />
      <rect x="-22" y="-54" width="44" height="54" rx="2" fill={wall} />
      <rect x="10" y="-82" width="8" height="14" fill="#b56a4c" />
      <polygon points="-26,-52 -14,-72 26,-72 36,-58 26,-52" fill={darker(roof, 0.2)} />
      <polygon points="-26,-52 -14,-72 14,-72 26,-52" fill={roof} />
      <circle cx="0" cy="-62" r="4.5" fill={lit ? "#ffd36b" : WINDOW_DIM} />
      <Window x={-16} y={-44} lit={lit} />
      <Window x={6} y={-44} lit={lit} />
      <path d="M-6 0 V-14 a6 6 0 0 1 12 0 V0 Z" fill={darker(roof, 0.35)} />
      <Window x={-17} y={-24} w={8} h={9} lit={lit} />
    </g>
  );
}

function WideHouse({ wall, roof, lit }: { wall: string; roof: string; lit: boolean }) {
  return (
    <g stroke="#5a4a36" strokeWidth="1.6" strokeLinejoin="round">
      <polygon points="30,-32 40,-38 40,-6 30,0" fill={darker(wall, 0.18)} />
      <rect x="-32" y="-32" width="62" height="32" rx="3" fill={wall} />
      <rect x="14" y="-64" width="8" height="14" fill="#b56a4c" />
      <path d="M-38 -30 C -34 -52, -20 -60, 0 -60 C 20 -60, 34 -52, 38 -30 Z" fill={roof} />
      <path d="M0 -60 C 20 -60, 34 -52, 38 -30 L 44 -36 C 40 -54, 26 -64, 8 -64 Z" fill={darker(roof, 0.2)} />
      <path d="M-26 -38 Q 0 -44 26 -38" fill="none" stroke={darker(roof, 0.3)} strokeWidth="1.4" />
      <path d="M-6 0 V-12 a6 6 0 0 1 12 0 V0 Z" fill={darker(roof, 0.35)} />
      <Window x={-26} y={-24} w={12} h={10} lit={lit} />
      <Window x={13} y={-24} w={12} h={10} lit={lit} />
    </g>
  );
}

export function Smoke({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 1, 2].map((i) => (
        <circle key={i} className="cz-anim cz-smoke" style={{ animationDelay: `${i * 1.2}s` }} cx="0" cy="0" r="5" fill="#ffffff" opacity="0.7" />
      ))}
    </g>
  );
}

/** A bought building on its plot (base at 0,0). */
export function BuildingArt({ id, lit, night }: { id: BuildingId; lit: boolean; night?: boolean }) {
  const glow = lit ? "#ffd36b" : WINDOW_DIM;
  switch (id) {
    case "cottage":
      return (
        <g stroke="#5a4a36" strokeWidth="1.6" strokeLinejoin="round">
          <rect x="-24" y="-30" width="48" height="30" rx="4" fill="#fdf0d8" />
          <path d="M-32 -26 C -28 -56, 28 -56, 32 -26 Z" fill="#e6c16d" />
          <path d="M-24 -38 Q 0 -44 24 -38 M-28 -31 Q 0 -37 28 -31" fill="none" stroke="#b98f3e" strokeWidth="1.2" />
          <path d="M-6 0 V-12 a6 6 0 0 1 12 0 V0 Z" fill="#8a5a3b" />
          <circle cx="-15" cy="-16" r="5" fill={glow} />
          <circle cx="15" cy="-16" r="5" fill={glow} />
        </g>
      );
    case "garden":
      return (
        <g stroke="#5a4a36" strokeWidth="1.4" strokeLinejoin="round">
          <ellipse cx="0" cy="-8" rx="40" ry="14" fill="#7aa35a" />
          {[-28, -18, -8, 2, 12, 22].map((x, i) => (
            <g key={x}>
              <circle cx={x + 3} cy={-12 + (i % 2) * 6} r="4" fill={FLOWER_COLORS[i % FLOWER_COLORS.length]} />
              <circle cx={x + 3} cy={-12 + (i % 2) * 6} r="1.4" fill="#ffd36b" stroke="none" />
            </g>
          ))}
          <path d="M-14 -8 V-40 Q 0 -54 14 -40 V-8" fill="none" stroke="#8a5a3b" strokeWidth="3" />
          <circle cx="-12" cy="-38" r="4" fill="#f28ba8" />
          <circle cx="10" cy="-44" r="4" fill="#f28ba8" />
          <circle cx="0" cy="-49" r="3.5" fill="#fff" />
          <path d="M-40 -6 H40" stroke="#8a5a3b" strokeWidth="2" />
          {[-38, -26, -14, 14, 26, 38].map((x) => (
            <path key={x} d={`M${x} -1 V-12`} stroke="#8a5a3b" strokeWidth="2" />
          ))}
        </g>
      );
    case "stall":
      return (
        <g stroke="#5a4a36" strokeWidth="1.6" strokeLinejoin="round">
          <rect x="-28" y="-22" width="56" height="22" rx="2" fill="#c98b5a" />
          <path d="M-26 -22 V-46 M26 -22 V-46" stroke="#8a5a3b" strokeWidth="3" />
          <path d="M-32 -46 H32 L28 -34 H-28 Z" fill="#fff6e3" />
          {[-32, -16, 0, 16].map((x) => (
            <path key={x} d={`M${x} -46 H${x + 8} L${x + 7} -34 H${x - 1} Z`} fill="#e07a5f" stroke="none" />
          ))}
          {[-18, -6, 6, 18].map((x, i) => (
            <circle key={x} cx={x} cy="-26" r="5" fill={["#e05b5b", "#ffb347", "#8cc25a", "#ffd36b"][i]} />
          ))}
        </g>
      );
    case "bakery":
      return (
        <g stroke="#5a4a36" strokeWidth="1.6" strokeLinejoin="round">
          <polygon points="26,-44 36,-50 36,-6 26,0" fill="#e8c9a8" />
          <rect x="-28" y="-44" width="54" height="44" rx="2" fill="#fbe3c8" />
          <rect x="10" y="-74" width="9" height="16" fill="#b56a4c" />
          <polygon points="-32,-42 -4,-66 30,-42" fill="#c8745a" />
          <polygon points="-4,-66 8,-72 40,-48 30,-42" fill="#a65e48" />
          <path d="M-30 -26 H28 L24 -18 H-26 Z" fill="#f2cc8f" />
          <path d="M-22 -26 L-24 -18 M-10 -26 L-11 -18 M2 -26 L2 -18 M14 -26 L15 -18" stroke="#c98b5a" />
          <path d="M-6 0 V-10 a6 6 0 0 1 12 0 V0 Z" fill="#8a5a3b" />
          <ellipse cx="-2" cy="-34" rx="10" ry="5" fill="#d99a4e" />
          <path d="M-8 -35 l3 -3 M-2 -36 l3 -3 M4 -35 l3 -3" stroke="#8a5a3b" />
          <Smoke x={14} y={-80} />
        </g>
      );
    case "library":
      return (
        <g stroke="#5a4a36" strokeWidth="1.6" strokeLinejoin="round">
          <rect x="-34" y="-8" width="68" height="8" fill="#e6dac2" />
          <rect x="-30" y="-44" width="60" height="36" fill="#f4efe2" />
          {[-24, -10, 4, 18].map((x) => (
            <rect key={x} x={x} y="-42" width="6" height="34" fill="#fffaf0" />
          ))}
          <polygon points="-36,-44 0,-66 36,-44" fill="#8fb0c8" />
          <circle cx="0" cy="-51" r="5" fill={glow} />
          <rect x="-5" y="-26" width="10" height="18" rx="4" fill="#6f4a2e" />
        </g>
      );
    case "lighthouse":
      return (
        <g stroke="#5a4a36" strokeWidth="1.6" strokeLinejoin="round">
          <ellipse cx="0" cy="-2" rx="20" ry="5" fill="#c9b99a" />
          <path d="M-14 0 L-9 -80 H9 L14 0 Z" fill="#fffaf0" />
          <path d="M-13 -18 L-12 -30 H12 L13 -18 Z M-11.4 -48 L-10.6 -60 H10.6 L11.4 -48 Z" fill="#e07a5f" />
          <rect x="-11" y="-96" width="22" height="16" rx="3" fill={lit || night ? "#ffe39a" : "#dfeef2"} />
          <path d="M-14 -96 L0 -110 L14 -96 Z" fill="#e07a5f" />
          <path d="M-12 -80 H12" strokeWidth="3" />
          {(lit || night) && <path d="M11 -90 L90 -112 L90 -70 Z" fill="#ffe39a" opacity="0.28" stroke="none" className="cz-anim cz-beam" />}
        </g>
      );
    default:
      return null;
  }
}

/** Festival lanterns strung across the square (drawn in scene coordinates around the plaza). */
export function FestivalLanterns({ cx, cy, rx, glow }: { cx: number; cy: number; rx: number; glow: boolean }) {
  const left = cx - rx + 8;
  const right = cx + rx - 8;
  const top = cy - 64;
  const strings = [0, 1].map((k) => {
    const y0 = top + k * 14;
    const pts = Array.from({ length: 9 }, (_, i) => {
      const t = (i + 1) / 10;
      return { x: left + (right - left) * t, y: y0 + Math.sin(Math.PI * t) * 20 };
    });
    return { y0, pts };
  });
  const colors = ["#f28b5b", "#ffd36b", "#f27a93", "#b7a0f0", "#8fd3f4"];
  return (
    <g>
      <path d={`M${left} ${cy + 4} V${top - 6} M${right} ${cy + 4} V${top - 6}`} stroke="#6b4a2b" strokeWidth="4" strokeLinecap="round" />
      {strings.map((s, k) => (
        <g key={k}>
          <path d={`M${left} ${s.y0} Q ${cx} ${s.y0 + 40} ${right} ${s.y0}`} fill="none" stroke="#6b4a2b" strokeWidth="1.4" />
          {s.pts.map((p, i) => (
            <g key={i}>
              {glow && <circle cx={p.x} cy={p.y + 6} r="10" fill="#ffd36b" opacity="0.35" className="cz-anim cz-twinkle" style={{ animationDelay: `${(i * 0.37 + k) % 2}s` }} />}
              <path d={`M${p.x} ${p.y} v2`} stroke="#6b4a2b" />
              <ellipse cx={p.x} cy={p.y + 7} rx="4.5" ry="6" fill={colors[(i + k) % colors.length]} stroke="#6b3a1f" strokeWidth="1" />
            </g>
          ))}
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// scenery

export function Tree({ kind, hue }: { kind: "tree" | "pine" | "bush"; hue: number }) {
  const greens = ["#7fb069", "#6aa35a", "#8cc27a", "#5f9a57"];
  const g = greens[Math.floor(hue * greens.length) % greens.length];
  if (kind === "pine")
    return (
      <g stroke="#3f5a33" strokeWidth="1.4" strokeLinejoin="round">
        <rect x="-3" y="-10" width="6" height="10" fill="#8a5a3b" />
        <polygon points="-16,-10 0,-34 16,-10" fill={g} />
        <polygon points="-12,-24 0,-48 12,-24" fill={mix(g, "#ffffff", 0.12)} />
      </g>
    );
  if (kind === "bush")
    return (
      <g stroke="#3f5a33" strokeWidth="1.2">
        <circle cx="-6" cy="-6" r="7" fill={g} />
        <circle cx="5" cy="-7" r="8" fill={mix(g, "#fff", 0.1)} />
      </g>
    );
  return (
    <g stroke="#3f5a33" strokeWidth="1.4">
      <rect x="-3" y="-14" width="6" height="14" fill="#8a5a3b" />
      <circle cx="-8" cy="-22" r="11" fill={g} />
      <circle cx="8" cy="-24" r="12" fill={mix(g, "#fff", 0.08)} />
      <circle cx="0" cy="-34" r="12" fill={mix(g, "#fff", 0.16)} />
    </g>
  );
}

export function Lamp({ lit }: { lit: boolean }) {
  return (
    <g>
      {lit && <circle cx="0" cy="-34" r="16" fill="#ffd36b" opacity="0.35" />}
      <path d="M0 0 V-30" stroke="#4a3f33" strokeWidth="2.6" />
      <path d="M-5 -30 H5 L3 -40 H-3 Z" fill={lit ? "#ffe39a" : "#e9e2cf"} stroke="#4a3f33" strokeWidth="1.4" />
      <path d="M-6 -40 H6 L0 -45 Z" fill="#4a3f33" />
    </g>
  );
}

export function Flower({ hue }: { hue: number }) {
  const c = FLOWER_COLORS[Math.floor(hue * FLOWER_COLORS.length) % FLOWER_COLORS.length];
  return (
    <g>
      <path d="M0 0 V-6" stroke="#4f7a30" strokeWidth="1.4" />
      {[0, 90, 180, 270].map((r) => (
        <circle key={r} cx={Math.cos((r * Math.PI) / 180) * 2.4} cy={-7 + Math.sin((r * Math.PI) / 180) * 2.4} r="2" fill={c} />
      ))}
      <circle cx="0" cy="-7" r="1.3" fill="#ffd36b" />
    </g>
  );
}

export function Boat({ color, sail }: { color: string; sail: string }) {
  return (
    <g stroke="#3b3528" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M-20 0 H20 L14 9 H-14 Z" fill={color} />
      <path d="M0 0 V-28" strokeWidth="1.8" />
      <path d="M2 -26 L18 -4 H2 Z" fill={sail} />
      <path d="M-2 -22 L-14 -4 H-2 Z" fill={mix(sail, "#000", 0.08)} />
    </g>
  );
}

export function Cloud() {
  return (
    <g fill="#ffffff" opacity="0.85">
      <ellipse cx="0" cy="0" rx="34" ry="12" />
      <ellipse cx="-14" cy="-8" rx="16" ry="12" />
      <ellipse cx="10" cy="-10" rx="18" ry="14" />
    </g>
  );
}

/** Bunting between two points with a sag. */
export function Bunting({ x1, y1, x2, y2, sag = 16 }: { x1: number; y1: number; x2: number; y2: number; sag?: number }) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + sag;
  const flags = Array.from({ length: 11 }, (_, i) => {
    const t = (i + 0.5) / 11;
    const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2;
    const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2;
    return { x, y };
  });
  const colors = ["#f28b5b", "#ffd36b", "#8fd3f4", "#f27a93", "#b7a0f0"];
  return (
    <g>
      <path d={`M${x1} ${y1} Q ${mx} ${my + sag * 0.0} ${x2} ${y2}`} fill="none" stroke="#6b4a2b" strokeWidth="1.2" />
      {flags.map((f, i) => (
        <path key={i} d={`M${f.x - 5} ${f.y} L${f.x + 5} ${f.y} L${f.x} ${f.y + 9} Z`} fill={colors[i % colors.length]} stroke="#6b4a2b" strokeWidth="0.8" />
      ))}
    </g>
  );
}

export function Firework({ x, y, color, delay, r = 46 }: { x: number; y: number; color: string; delay: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="cz-anim cz-firework" style={{ animationDelay: `${delay}s` }}>
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          return (
            <g key={i}>
              <path d={`M${Math.cos(a) * r * 0.35} ${Math.sin(a) * r * 0.35} L${Math.cos(a) * r} ${Math.sin(a) * r}`} stroke={color} strokeWidth="3" strokeLinecap="round" />
              <circle cx={Math.cos(a) * r * 1.12} cy={Math.sin(a) * r * 1.12} r="2.6" fill={color} />
            </g>
          );
        })}
        <circle r="5" fill="#fff6e3" />
      </g>
    </g>
  );
}
