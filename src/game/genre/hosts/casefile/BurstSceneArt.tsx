"use client";

import type { ReactNode } from "react";
import type { Palette } from "../../../engine/palettes";
import { mixHex, SCENE_H, SCENE_W, SLOTS, type Box, type CaseLocation, type PropKind, type SceneStyle } from "./burst-casefile.logic";

/*
 * The casefile's illustrated rooms: pure SVG, composed from a small kit of noir props that sit in fixed slots
 * (./casefile.logic.ts SLOTS). Colours come from the palette pushed toward night blues; the desk lamp throws the one
 * warm light. Animated parts carry `cf-anim` so prefers-reduced-motion can stop them.
 */

export interface Ink {
  wallTop: string;
  wallBottom: string;
  wallLine: string;
  floorTop: string;
  floorBottom: string;
  wood: string;
  woodDark: string;
  woodLight: string;
  metal: string;
  metalDark: string;
  paper: string;
  glassTop: string;
  glassBottom: string;
  lamp: string;
  accent: string;
  string: string;
  shadow: string;
}

export const LAMP = "#ffcf7a";
export const RED_STRING = "#d4333f";
/** The one light in each room: the study's warm banker's lamp, the bench's cold gooseneck, the archive's amber pendant. */
const LAMP_FOR: Record<SceneStyle, string> = { study: LAMP, bench: "#d9ecff", archive: "#ffb547" };

export function inkFor(palette: Palette, shade: number): Ink {
  // three night moods: blue, sea-green, plum (shade 0 → 0.5 → 1)
  const night = shade <= 0.5 ? mixHex("#18204a", "#0f3a46", shade * 2) : mixHex("#0f3a46", "#3a1846", (shade - 0.5) * 2);
  const wall = mixHex(palette.css.wall, night, 0.55);
  const floor = mixHex(palette.css.floor, "#120e1c", 0.45);
  return {
    wallTop: mixHex(wall, "#05060c", 0.35),
    wallBottom: mixHex(wall, "#3a3560", 0.18),
    wallLine: mixHex(wall, "#ffffff", 0.06),
    floorTop: mixHex(floor, "#2a2238", 0.25),
    floorBottom: mixHex(floor, "#040308", 0.55),
    wood: "#5b3a2a",
    woodDark: "#3a2419",
    woodLight: "#7c5238",
    metal: mixHex("#5d6b82", night, 0.3),
    metalDark: mixHex("#343d52", night, 0.3),
    paper: "#efe6cf",
    glassTop: mixHex("#0b1330", night, 0.3),
    glassBottom: mixHex("#23305e", palette.css.accent, 0.18),
    lamp: LAMP,
    accent: palette.css.accent,
    string: RED_STRING,
    shadow: "rgba(0,0,0,0.45)",
  };
}

/** A deterministic scatter of rain streaks for a window of the given size. */
function rainLines(w: number, h: number, seed: number): { x: number; y: number; len: number }[] {
  const out: { x: number; y: number; len: number }[] = [];
  let a = (seed * 9301 + 49297) % 233280;
  const next = () => {
    a = (a * 9301 + 49297) % 233280;
    return a / 233280;
  };
  const n = Math.round((w * h) / 900);
  for (let i = 0; i < n; i++) out.push({ x: next() * w, y: next() * h, len: 10 + next() * 18 });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// the room

export function SceneRoom({ location, ink: ink0, uid, lampOn = true }: { location: CaseLocation; ink: Ink; uid: string; lampOn?: boolean }) {
  const id = (s: string) => `${uid}-${s}`;
  const floorY = 332;
  const style = location.style;
  const ink: Ink = { ...ink0, lamp: LAMP_FOR[style] };
  return (
    <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="cf-scene-svg" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={id("wall")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ink.wallTop} />
          <stop offset="1" stopColor={ink.wallBottom} />
        </linearGradient>
        <linearGradient id={id("floor")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ink.floorTop} />
          <stop offset="1" stopColor={ink.floorBottom} />
        </linearGradient>
        <linearGradient id={id("glass")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ink.glassTop} />
          <stop offset="1" stopColor={ink.glassBottom} />
        </linearGradient>
        <linearGradient id={id("cone")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ink.lamp} stopOpacity="0.7" />
          <stop offset="1" stopColor={ink.lamp} stopOpacity="0.08" />
        </linearGradient>
        <radialGradient id={id("pool")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={ink.lamp} stopOpacity="0.5" />
          <stop offset="1" stopColor={ink.lamp} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("vignette")} cx="0.55" cy="0.55" r="0.75">
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.72" />
        </radialGradient>
        <linearGradient id={id("wood")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ink.woodLight} />
          <stop offset="1" stopColor={ink.wood} />
        </linearGradient>
        <linearGradient id={id("metal")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={ink.metal} />
          <stop offset="1" stopColor={ink.metalDark} />
        </linearGradient>
        <pattern id={id("stripes")} width="36" height="40" patternUnits="userSpaceOnUse">
          <rect width="36" height="40" fill="none" />
          <rect x="0" width="2" height="40" fill={ink.wallLine} />
          <rect x="18" width="1" height="40" fill={ink.wallLine} opacity="0.5" />
        </pattern>
      </defs>

      <Shell style={style} ink={ink} id={id} floorY={floorY} />

      {/* moonlight through the window falls across the floor (the archive's barred slit is too small to matter) */}
      {style !== "archive" && location.props.some((p) => p.kind === "window") && (
        <polygon
          points={windowShaft(location.props.find((p) => p.kind === "window")!.box, floorY)}
          fill={ink.glassBottom}
          opacity="0.18"
        />
      )}

      {location.props.map((p) => (
        <g key={p.slot} data-prop={p.kind}>
          <Prop kind={p.kind} box={p.box} ink={ink} id={id} seed={location.index + 1} style={style} />
        </g>
      ))}

      <Lamp style={style} ink={ink} id={id} on={lampOn} />
      <rect width={SCENE_W} height={SCENE_H} fill={`url(#${id("vignette")})`} pointerEvents="none" />
    </svg>
  );
}

/** The room shell per style (wall, fittings, floor), drawn under the props. */
function Shell({ style, ink, id, floorY }: { style: SceneStyle; ink: Ink; id: (s: string) => string; floorY: number }) {
  if (style === "bench") {
    // a tiled lab: glazed tiles, a teal dado band, a fluorescent tube, checkered floor
    const tile = mixHex(ink.wallBottom, "#dfe9ec", 0.5);
    const grout = mixHex(tile, "#000000", 0.18);
    const check = mixHex(ink.floorTop, "#ffffff", 0.16);
    return (
      <g>
        <defs>
          <pattern id={id("tiles")} width="50" height="50" patternUnits="userSpaceOnUse">
            <rect width="50" height="50" fill={tile} />
            <rect width="50" height="50" fill="none" stroke={grout} strokeWidth="3" />
          </pattern>
          <pattern id={id("checks")} width="112" height="112" patternUnits="userSpaceOnUse">
            <rect width="112" height="112" fill={ink.floorTop} />
            <rect width="56" height="56" fill={check} />
            <rect x="56" y="56" width="56" height="56" fill={check} />
          </pattern>
        </defs>
        <rect width={SCENE_W} height={floorY} fill={`url(#${id("tiles")})`} />
        <rect width={SCENE_W} height={floorY} fill={`url(#${id("wall")})`} opacity="0.55" />
        <rect y={floorY - 98} width={SCENE_W} height={26} fill={mixHex(ink.accent, "#1f6f7a", 0.5)} />
        <rect y={floorY - 72} width={SCENE_W} height={4} fill="#000" opacity="0.3" />
        <rect x={300} y={12} width={400} height={9} rx={4} fill="#e9f6ff" opacity="0.9" />
        <ellipse cx={500} cy={40} rx={260} ry={50} fill="#dff1ff" opacity="0.16" style={{ mixBlendMode: "screen" }} />
        <rect y={floorY - 6} width={SCENE_W} height={8} fill={ink.metalDark} />
        <rect y={floorY} width={SCENE_W} height={SCENE_H - floorY} fill={`url(#${id("checks")})`} />
        <rect y={floorY} width={SCENE_W} height={SCENE_H - floorY} fill={`url(#${id("floor")})`} opacity="0.45" />
      </g>
    );
  }
  if (style === "archive") {
    // a brick basement: a steam pipe along the ceiling, stone slabs, a worn rug under the table
    const brick = mixHex(ink.wallBottom, "#6b3a2a", 0.5);
    const mortar = mixHex(brick, "#000000", 0.3);
    const slab = mixHex(ink.floorTop, "#4a4452", 0.35);
    return (
      <g>
        <defs>
          <pattern id={id("bricks")} width="64" height="32" patternUnits="userSpaceOnUse">
            <rect width="64" height="32" fill={mortar} />
            <rect x="1" y="1" width="30" height="14" rx="1" fill={brick} />
            <rect x="33" y="1" width="30" height="14" rx="1" fill={brick} />
            <rect x="-15" y="17" width="30" height="14" rx="1" fill={brick} />
            <rect x="17" y="17" width="30" height="14" rx="1" fill={brick} />
            <rect x="49" y="17" width="30" height="14" rx="1" fill={brick} />
          </pattern>
          <pattern id={id("slabs")} width="120" height="64" patternUnits="userSpaceOnUse">
            <rect width="120" height="64" fill={slab} />
            <rect width="120" height="64" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="3" />
            <rect x="60" y="32" width="60" height="32" fill="none" stroke="#000" strokeOpacity="0.2" strokeWidth="2" />
          </pattern>
        </defs>
        <rect width={SCENE_W} height={floorY} fill={`url(#${id("bricks")})`} />
        <rect width={SCENE_W} height={floorY} fill={`url(#${id("wall")})`} opacity="0.5" />
        <rect y={22} width={SCENE_W} height={12} rx={6} fill={ink.metalDark} />
        <rect y={26} width={SCENE_W} height={3} fill="#fff" opacity="0.12" />
        {[120, 500, 880].map((x) => (
          <rect key={x} x={x - 8} y={16} width={16} height={24} rx={3} fill={ink.metal} />
        ))}
        <rect y={floorY - 6} width={SCENE_W} height={8} fill="#1a1418" />
        <rect y={floorY} width={SCENE_W} height={SCENE_H - floorY} fill={`url(#${id("slabs")})`} />
        <rect y={floorY} width={SCENE_W} height={SCENE_H - floorY} fill={`url(#${id("floor")})`} opacity="0.4" />
        <rect x={250} y={392} width={540} height={84} rx={6} fill="#5a1f24" opacity="0.9" />
        <rect x={262} y={402} width={516} height={64} rx={4} fill="none" stroke="#c98b4a" strokeOpacity="0.7" strokeWidth="4" />
        <rect x={286} y={422} width={468} height={24} fill="none" stroke="#c98b4a" strokeOpacity="0.35" strokeWidth="2" />
      </g>
    );
  }
  // the study: wallpaper stripes over a wainscot, wooden floorboards in perspective
  return (
    <g>
      <rect width={SCENE_W} height={floorY} fill={`url(#${id("wall")})`} />
      <rect width={SCENE_W} height={floorY} fill={`url(#${id("stripes")})`} opacity="0.7" />
      <rect y={floorY - 70} width={SCENE_W} height={70} fill="#000" opacity="0.18" />
      <rect y={floorY - 72} width={SCENE_W} height={4} fill={ink.wallLine} opacity="0.9" />
      <rect y={floorY - 6} width={SCENE_W} height={8} fill={ink.woodDark} />
      <rect y={floorY} width={SCENE_W} height={SCENE_H - floorY} fill={`url(#${id("floor")})`} />
      {Array.from({ length: 13 }, (_, i) => {
        const x0 = -200 + i * 115;
        return <line key={i} x1={500 + (x0 - 500) * 0.35} y1={floorY} x2={x0} y2={SCENE_H} stroke="#000" strokeOpacity="0.28" strokeWidth="2" />;
      })}
      {[372, 420, 478].map((y) => (
        <line key={y} x1={0} y1={y} x2={SCENE_W} y2={y} stroke="#000" strokeOpacity="0.16" strokeWidth="2" />
      ))}
    </g>
  );
}

function Lamp({ style, ink, id, on }: { style: SceneStyle; ink: Ink; id: (s: string) => string; on: boolean }) {
  if (style === "bench") return <BenchLamp ink={ink} id={id} on={on} />;
  if (style === "archive") return <PendantLamp ink={ink} id={id} on={on} />;
  return <DeskLamp ink={ink} id={id} on={on} />;
}

function windowShaft(b: Box, floorY: number): string {
  const x0 = b.x + 20;
  const x1 = b.x + b.w - 20;
  return `${x0},${b.y + b.h - 20} ${x1},${b.y + b.h - 20} ${x1 + 120},${floorY + 150} ${x0 + 60},${floorY + 150}`;
}

function DeskLamp({ ink, id, on }: { ink: Ink; id: (s: string) => string; on: boolean }) {
  // base on the desk's right, arm up and over, shade pointing down-left at the desk
  const bx = 672;
  const by = 300;
  return (
    <g>
      {on && (
        <g className="cf-anim cf-lamp-flicker">
          <ellipse cx={640} cy={220} rx={150} ry={110} fill={`url(#${id("pool")})`} opacity="0.55" style={{ mixBlendMode: "screen" }} />
          <polygon points="618,212 670,208 800,302 470,302" fill={`url(#${id("cone")})`} style={{ mixBlendMode: "screen" }} />
          <ellipse cx={640} cy={302} rx={170} ry={28} fill={`url(#${id("pool")})`} style={{ mixBlendMode: "screen" }} />
          <ellipse cx={640} cy={380} rx={260} ry={60} fill={`url(#${id("pool")})`} opacity="0.35" style={{ mixBlendMode: "screen" }} />
        </g>
      )}
      <ellipse cx={bx} cy={by} rx={26} ry={6} fill="#1a1a1a" />
      <rect x={bx - 22} y={by - 8} width={44} height={8} rx={3} fill="#2f3a2f" />
      <path d={`M${bx} ${by - 8} L${bx + 14} ${by - 70} L${bx - 16} ${by - 96}`} stroke="#2f3a2f" strokeWidth={6} fill="none" strokeLinecap="round" />
      <circle cx={bx + 14} cy={by - 70} r={5} fill="#556255" />
      <path d={`M${bx - 58} ${by - 84} Q${bx - 34} ${by - 118} ${bx - 4} ${by - 98} L${bx - 22} ${by - 82} Z`} fill="#2e5a3a" stroke="#1b3524" strokeWidth={2} transform={`rotate(-8 ${bx - 30} ${by - 90})`} />
      {on && <ellipse cx={bx - 38} cy={by - 84} rx={16} ry={4} fill={ink.lamp} opacity="0.95" />}
    </g>
  );
}

function BenchLamp({ ink, id, on }: { ink: Ink; id: (s: string) => string; on: boolean }) {
  // a grey gooseneck clamped to the bench's right end, its head turned down-left over the glassware
  const bx = 672;
  const by = 300;
  return (
    <g>
      {on && (
        <g className="cf-anim cf-lamp-flicker">
          <ellipse cx={600} cy={230} rx={150} ry={100} fill={`url(#${id("pool")})`} opacity="0.5" style={{ mixBlendMode: "screen" }} />
          <polygon points="592,196 640,190 790,302 430,302" fill={`url(#${id("cone")})`} style={{ mixBlendMode: "screen" }} />
          <ellipse cx={610} cy={302} rx={180} ry={26} fill={`url(#${id("pool")})`} style={{ mixBlendMode: "screen" }} />
        </g>
      )}
      <ellipse cx={bx} cy={by} rx={28} ry={6} fill="#1a1a1a" />
      <rect x={bx - 26} y={by - 10} width={52} height={10} rx={3} fill="#3d4650" />
      <path d={`M${bx} ${by - 10} C ${bx + 30} ${by - 70}, ${bx + 10} ${by - 120}, ${bx - 40} ${by - 112}`} stroke="#6f7a86" strokeWidth={7} fill="none" strokeLinecap="round" />
      <polygon points={`${bx - 76},${by - 96} ${bx - 34},${by - 126} ${bx - 18},${by - 100} ${bx - 60},${by - 74}`} fill="#8b97a4" stroke="#3d4650" strokeWidth={2} />
      {on && <ellipse cx={bx - 62} cy={by - 88} rx={14} ry={5} fill={ink.lamp} opacity="0.95" transform={`rotate(-35 ${bx - 62} ${by - 88})`} />}
    </g>
  );
}

function PendantLamp({ ink, id, on }: { ink: Ink; id: (s: string) => string; on: boolean }) {
  // a bulb on a cord over the right half of the table (clear of the wall pieces), its shade throwing amber straight down
  const cx = 660;
  const y = 150;
  return (
    <g>
      {on && (
        <g className="cf-anim cf-lamp-flicker">
          <polygon points={`${cx - 46},${y + 12} ${cx + 46},${y + 12} ${cx + 150},302 ${cx - 330},302`} fill={`url(#${id("cone")})`} style={{ mixBlendMode: "screen" }} />
          <ellipse cx={cx - 90} cy={302} rx={240} ry={30} fill={`url(#${id("pool")})`} style={{ mixBlendMode: "screen" }} />
          <ellipse cx={cx - 100} cy={390} rx={280} ry={64} fill={`url(#${id("pool")})`} opacity="0.35" style={{ mixBlendMode: "screen" }} />
        </g>
      )}
      <line x1={cx} y1={34} x2={cx} y2={y - 26} stroke="#1a1418" strokeWidth={3} />
      <polygon points={`${cx - 14},${y - 26} ${cx + 14},${y - 26} ${cx + 52},${y + 12} ${cx - 52},${y + 12}`} fill="#3b2a1c" stroke="#1a1418" strokeWidth={2} />
      <rect x={cx - 52} y={y + 10} width={104} height={5} fill="#c98b4a" opacity="0.8" />
      <circle cx={cx} cy={y + 20} r={9} fill={on ? ink.lamp : "#6b6552"} />
      {on && <circle cx={cx} cy={y + 20} r={22} fill={ink.lamp} opacity="0.25" style={{ mixBlendMode: "screen" }} />}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// the prop kit

function Prop({ kind, box, ink, id, seed, style }: { kind: PropKind; box: Box; ink: Ink; id: (s: string) => string; seed: number; style: SceneStyle }): ReactNode {
  switch (kind) {
    case "window":
      return <WindowProp b={box} ink={ink} id={id} seed={seed} style={style} />;
    case "corkboard":
      return <Corkboard b={box} ink={ink} />;
    case "shelves":
      return <Shelves b={box} ink={ink} />;
    case "clock":
      return <ClockProp b={box} ink={ink} />;
    case "cabinet":
      return <Cabinet b={box} ink={ink} id={id} />;
    case "bookcase":
      return <Bookcase b={box} ink={ink} />;
    case "coatrack":
      return <CoatRack b={box} ink={ink} />;
    case "fridge":
      return <Fridge b={box} ink={ink} />;
    case "drip":
      return <DripStand b={box} ink={ink} />;
    case "safe":
      return <Safe b={box} ink={ink} id={id} />;
    case "plant":
      return <Plant b={box} />;
    case "bin":
      return <Bin b={box} ink={ink} />;
    case "desk":
      return <Desk b={box} ink={ink} id={id} style={style} />;
    case "microscope":
      return <Microscope b={box} ink={ink} />;
    case "typewriter":
      return <Typewriter b={box} ink={ink} />;
    case "phone":
      return <Phone b={box} />;
    case "filebox":
      return <FileBox b={box} ink={ink} />;
    case "mug":
      return <Mug b={box} ink={ink} />;
    case "beakers":
      return <Beakers b={box} ink={ink} />;
    case "books":
      return <Books b={box} />;
  }
}

function FloorShadow({ cx, y, w }: { cx: number; y: number; w: number }) {
  return <ellipse cx={cx} cy={y} rx={w / 2} ry={Math.max(5, w / 12)} fill="#000" opacity="0.38" />;
}

function WindowProp({ b, ink, id, seed, style }: { b: Box; ink: Ink; id: (s: string) => string; seed: number; style: SceneStyle }) {
  if (style === "archive") return <BarredWindow b={b} ink={ink} id={id} seed={seed} />;
  const blinds = style === "bench";
  const gx = b.x + 14;
  const gy = b.y + 14;
  const gw = b.w - 28;
  const gh = b.h - 38;
  const rain = rainLines(gw, gh, seed * 17 + Math.round(b.x));
  const clip = id(`win-${b.x}`);
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={gx} y={gy} width={gw} height={gh} />
        </clipPath>
      </defs>
      <rect x={b.x} y={b.y} width={b.w} height={b.h - 18} rx={4} fill={ink.woodDark} />
      <rect x={gx} y={gy} width={gw} height={gh} fill={`url(#${id("glass")})`} />
      <g clipPath={`url(#${clip})`}>
        <circle cx={gx + gw * 0.72} cy={gy + gh * 0.25} r={Math.min(gw, gh) * 0.12} fill="#e8e4ff" opacity="0.8" />
        <circle cx={gx + gw * 0.72} cy={gy + gh * 0.25} r={Math.min(gw, gh) * 0.3} fill="#c7c2ff" opacity="0.12" />
        {/* city silhouettes with a few lit windows */}
        {[0, 0.12, 0.26, 0.4, 0.55, 0.68, 0.82].map((t, i) => {
          const h = gh * (0.25 + ((i * 37) % 23) / 60);
          return <rect key={i} x={gx + gw * t} y={gy + gh - h} width={gw * 0.13} height={h} fill="#070a18" />;
        })}
        {[0.05, 0.3, 0.46, 0.6, 0.86].map((t, i) => (
          <rect key={`l${i}`} x={gx + gw * t} y={gy + gh * (0.72 + (i % 3) * 0.06)} width={4} height={5} fill={ink.lamp} opacity="0.75" />
        ))}
        <g className="cf-anim cf-rain" stroke="#b9c6ff" strokeOpacity="0.55" strokeWidth={1.4} strokeLinecap="round">
          {rain.map((r, i) => (
            <line key={i} x1={gx + r.x} y1={gy + r.y} x2={gx + r.x - 3} y2={gy + r.y + r.len} />
          ))}
          {rain.map((r, i) => (
            <line key={`b${i}`} x1={gx + r.x} y1={gy + r.y - gh} x2={gx + r.x - 3} y2={gy + r.y - gh + r.len} />
          ))}
        </g>
        <rect className="cf-anim cf-lightning" x={gx} y={gy} width={gw} height={gh} fill="#dfe6ff" opacity="0" />
      </g>
      {blinds && (
        <g>
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x={gx} y={gy + 4 + i * ((gh - 8) / 8)} width={gw} height={Math.max(4, (gh - 8) / 8 - 8)} fill={mixHex(ink.paper, "#8a8f9a", 0.55)} opacity="0.92" />
          ))}
          <line x1={gx + gw - 10} y1={gy} x2={gx + gw - 10} y2={gy + gh + 22} stroke="#d9d2bd" strokeWidth={2} />
          <circle cx={gx + gw - 10} cy={gy + gh + 26} r={4} fill="#d9d2bd" />
        </g>
      )}
      {/* mullions and sill */}
      <rect x={gx + gw / 2 - 3} y={gy} width={6} height={gh} fill={ink.woodDark} />
      <rect x={gx} y={gy + gh * 0.45 - 3} width={gw} height={6} fill={ink.woodDark} />
      <rect x={b.x - 10} y={b.y + b.h - 24} width={b.w + 20} height={12} rx={2} fill={ink.woodLight} />
      <rect x={b.x - 10} y={b.y + b.h - 12} width={b.w + 20} height={4} fill="#000" opacity="0.4" />
    </g>
  );
}

function BarredWindow({ b, ink, id, seed }: { b: Box; ink: Ink; id: (s: string) => string; seed: number }) {
  // a small barred basement window high on the wall: a sliver of sky, the rain, three bars, notices pinned below
  const fx = b.x + 34;
  const fy = b.y + 8;
  const fw = b.w - 68;
  const fh = Math.round(b.h * 0.42);
  const gx = fx + 10;
  const gy = fy + 10;
  const gw = fw - 20;
  const gh = fh - 20;
  const rain = rainLines(gw, gh, seed * 23 + Math.round(b.x));
  const clip = id(`barred-${b.x}`);
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={gx} y={gy} width={gw} height={gh} />
        </clipPath>
      </defs>
      <rect x={fx} y={fy} width={fw} height={fh} rx={3} fill="#2a2430" />
      <rect x={gx} y={gy} width={gw} height={gh} fill={`url(#${id("glass")})`} />
      <g clipPath={`url(#${clip})`}>
        <circle cx={gx + gw * 0.7} cy={gy + gh * 0.35} r={gh * 0.22} fill="#e8e4ff" opacity="0.8" />
        <g className="cf-anim cf-rain" stroke="#b9c6ff" strokeOpacity="0.5" strokeWidth={1.4} strokeLinecap="round">
          {rain.map((r, i) => (
            <line key={i} x1={gx + r.x} y1={gy + r.y} x2={gx + r.x - 3} y2={gy + r.y + r.len} />
          ))}
          {rain.map((r, i) => (
            <line key={`b${i}`} x1={gx + r.x} y1={gy + r.y - gh} x2={gx + r.x - 3} y2={gy + r.y - gh + r.len} />
          ))}
        </g>
      </g>
      {[0.25, 0.5, 0.75].map((t) => (
        <rect key={t} x={gx + gw * t - 3} y={gy - 4} width={6} height={gh + 8} rx={2} fill={ink.metalDark} />
      ))}
      <rect x={fx - 8} y={fy + fh - 4} width={fw + 16} height={10} rx={2} fill="#4a4452" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={b.x + 24 + i * 66} y={fy + fh + 26 + (i % 2) * 6} width={52} height={40} fill={i === 1 ? "#f3e2b8" : ink.paper} transform={`rotate(${i * 3 - 3} ${b.x + 50 + i * 66} ${fy + fh + 46})`} />
          <circle cx={b.x + 50 + i * 66} cy={fy + fh + 30 + (i % 2) * 6} r={3} fill={RED_STRING} />
        </g>
      ))}
    </g>
  );
}

function Corkboard({ b, ink }: { b: Box; ink: Ink }) {
  const papers = [
    { x: 0.08, y: 0.12, w: 0.26, h: 0.34, r: -4 },
    { x: 0.42, y: 0.1, w: 0.22, h: 0.28, r: 3 },
    { x: 0.7, y: 0.18, w: 0.22, h: 0.3, r: -2 },
    { x: 0.2, y: 0.56, w: 0.3, h: 0.3, r: 2 },
    { x: 0.6, y: 0.58, w: 0.26, h: 0.28, r: -5 },
  ];
  return (
    <g>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill={ink.woodDark} />
      <rect x={b.x + 8} y={b.y + 8} width={b.w - 16} height={b.h - 16} fill="#8a5d34" />
      <rect x={b.x + 8} y={b.y + 8} width={b.w - 16} height={b.h - 16} fill="#000" opacity="0.18" />
      {papers.map((p, i) => {
        const x = b.x + 8 + p.x * (b.w - 16);
        const y = b.y + 8 + p.y * (b.h - 16);
        const w = p.w * (b.w - 16);
        const h = p.h * (b.h - 16);
        return (
          <g key={i} transform={`rotate(${p.r} ${x + w / 2} ${y + h / 2})`}>
            <rect x={x} y={y} width={w} height={h} fill={i === 2 ? "#d9d2bd" : ink.paper} opacity="0.92" />
            {[0.3, 0.5, 0.7].map((t) => (
              <line key={t} x1={x + w * 0.15} y1={y + h * t} x2={x + w * 0.85} y2={y + h * t} stroke="#6b6250" strokeWidth={1.5} opacity="0.6" />
            ))}
            <circle cx={x + w / 2} cy={y + 5} r={4} fill={RED_STRING} />
          </g>
        );
      })}
      <path
        d={`M${b.x + 8 + 0.21 * (b.w - 16)} ${b.y + 20} Q${b.x + b.w * 0.45} ${b.y + b.h * 0.5} ${b.x + 8 + 0.35 * (b.w - 16)} ${b.y + 8 + 0.56 * (b.h - 16) + 5}`}
        stroke={RED_STRING}
        strokeWidth={2}
        fill="none"
      />
    </g>
  );
}

function Shelves({ b, ink }: { b: Box; ink: Ink }) {
  const plank = (y: number) => (
    <g>
      <rect x={b.x} y={y} width={b.w} height={9} fill={ink.woodLight} />
      <rect x={b.x} y={y + 9} width={b.w} height={4} fill="#000" opacity="0.35" />
      <path d={`M${b.x + 18} ${y + 9} l0 22 l14 -22 Z M${b.x + b.w - 18} ${y + 9} l0 22 l-14 -22 Z`} fill={ink.woodDark} />
    </g>
  );
  const y1 = b.y + b.h * 0.45;
  const y2 = b.y + b.h - 14;
  const jar = (x: number, y: number, w: number, h: number, c: string) => (
    <g>
      <rect x={x} y={y - h} width={w} height={h} rx={5} fill={c} opacity="0.45" stroke="#cfd8ff" strokeOpacity="0.5" />
      <rect x={x + 3} y={y - h - 6} width={w - 6} height={7} rx={2} fill="#2b2b35" />
      <rect x={x + 4} y={y - h + 4} width={3} height={h - 10} rx={1.5} fill="#fff" opacity="0.35" />
    </g>
  );
  const books = (x: number, y: number) =>
    ["#7b2d2d", "#2d4a7b", "#6f6a2c", "#3f2d5e", "#2d6b55"].map((c, i) => <rect key={i} x={x + i * 13} y={y - 38 - (i % 2) * 5} width={12} height={38 + (i % 2) * 5} fill={c} stroke="#000" strokeOpacity="0.4" />);
  return (
    <g>
      {jar(b.x + 20, y1, 30, 44, ink.accent)}
      {jar(b.x + 58, y1, 26, 32, "#7fd1b9")}
      <g>{books(b.x + b.w - 90, y1)}</g>
      {plank(y1)}
      <g>{books(b.x + 22, y2)}</g>
      {jar(b.x + b.w * 0.55, y2, 34, 40, "#e2b76b")}
      <rect x={b.x + b.w - 70} y={y2 - 26} width={46} height={26} fill="#6d5337" stroke="#000" strokeOpacity="0.3" />
      {plank(y2)}
    </g>
  );
}

function ClockProp({ b, ink }: { b: Box; ink: Ink }) {
  const cx = b.x + 62;
  const cy = b.y + b.h / 2;
  const r = Math.min(56, b.h / 2 - 6);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 7} fill={ink.woodDark} />
      <circle cx={cx} cy={cy} r={r} fill="#e9e1c8" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <line key={i} x1={cx + Math.sin(a) * (r - 4)} y1={cy - Math.cos(a) * (r - 4)} x2={cx + Math.sin(a) * (r - 11)} y2={cy - Math.cos(a) * (r - 11)} stroke="#2a2a2a" strokeWidth={i % 3 === 0 ? 3 : 1.5} />;
      })}
      <line x1={cx} y1={cy} x2={cx + r * 0.3} y2={cy - r * 0.45} stroke="#1a1a1a" strokeWidth={4} strokeLinecap="round" />
      <g className="cf-anim cf-tick" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <line x1={cx} y1={cy} x2={cx + r * 0.72} y2={cy + r * 0.12} stroke="#1a1a1a" strokeWidth={2.5} strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r={4} fill={RED_STRING} />
      {/* a framed certificate beside it */}
      <rect x={b.x + 140} y={b.y + 26} width={110} height={82} fill={ink.woodDark} />
      <rect x={b.x + 147} y={b.y + 33} width={96} height={68} fill="#e6dcc0" />
      {[0.3, 0.48, 0.62].map((t) => (
        <line key={t} x1={b.x + 160} y1={b.y + 33 + 68 * t} x2={b.x + 230} y2={b.y + 33 + 68 * t} stroke="#8a7a58" strokeWidth={2} />
      ))}
      <circle cx={b.x + 225} cy={b.y + 88} r={7} fill="#b8322f" opacity="0.8" />
    </g>
  );
}

function Cabinet({ b, ink, id }: { b: Box; ink: Ink; id: (s: string) => string }) {
  const n = 4;
  const dh = (b.h - 20) / n;
  return (
    <g>
      <FloorShadow cx={b.x + b.w / 2} y={b.y + b.h} w={b.w + 20} />
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill={`url(#${id("metal")})`} />
      {Array.from({ length: n }, (_, i) => {
        const y = b.y + 10 + i * dh;
        return (
          <g key={i}>
            <rect x={b.x + 8} y={y + 4} width={b.w - 16} height={dh - 8} rx={3} fill={ink.metal} stroke="#000" strokeOpacity="0.35" />
            <rect x={b.x + b.w / 2 - 20} y={y + 16} width={40} height={16} rx={2} fill={ink.paper} opacity="0.85" />
            <rect x={b.x + b.w / 2 - 26} y={y + 40} width={52} height={8} rx={4} fill="#c9ced8" />
          </g>
        );
      })}
      {/* a stack of files left on top */}
      <rect x={b.x + 14} y={b.y - 14} width={70} height={14} fill="#c79a56" transform={`rotate(-3 ${b.x + 49} ${b.y - 7})`} />
      <rect x={b.x + 20} y={b.y - 24} width={64} height={11} fill="#d8b36c" transform={`rotate(4 ${b.x + 52} ${b.y - 18})`} />
    </g>
  );
}

function Bookcase({ b, ink }: { b: Box; ink: Ink }) {
  const rows = 4;
  const rh = (b.h - 16) / rows;
  const colors = ["#7b2d2d", "#2d4a7b", "#6f6a2c", "#3f2d5e", "#2d6b55", "#8a5a2b", "#4c4c64"];
  return (
    <g>
      <FloorShadow cx={b.x + b.w / 2} y={b.y + b.h} w={b.w + 20} />
      <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={ink.woodDark} />
      {Array.from({ length: rows }, (_, r) => {
        const y = b.y + 8 + r * rh;
        let x = b.x + 10;
        const books: ReactNode[] = [];
        for (let i = 0; x < b.x + b.w - 22; i++) {
          const w = 10 + ((i * 7 + r * 3) % 9);
          const h = rh - 14 - ((i * 5 + r) % 4) * 4;
          books.push(<rect key={i} x={x} y={y + rh - 6 - h} width={w} height={h} fill={colors[(i + r * 2) % colors.length]} stroke="#000" strokeOpacity="0.35" />);
          x += w + 1;
        }
        return (
          <g key={r}>
            <rect x={b.x + 6} y={y} width={b.w - 12} height={rh - 6} fill="#1c120c" />
            {books}
            <rect x={b.x + 4} y={y + rh - 6} width={b.w - 8} height={6} fill={ink.woodLight} />
          </g>
        );
      })}
    </g>
  );
}

function CoatRack({ b, ink }: { b: Box; ink: Ink }) {
  const cx = b.x + b.w / 2;
  return (
    <g>
      <FloorShadow cx={cx} y={b.y + b.h} w={90} />
      <rect x={cx - 4} y={b.y + 10} width={8} height={b.h - 14} fill={ink.woodDark} />
      <path d={`M${cx - 36} ${b.y + b.h} L${cx} ${b.y + b.h - 26} L${cx + 36} ${b.y + b.h}`} stroke={ink.woodDark} strokeWidth={7} fill="none" />
      <path d={`M${cx - 26} ${b.y + 24} L${cx} ${b.y + 36} L${cx + 26} ${b.y + 24}`} stroke={ink.woodDark} strokeWidth={5} fill="none" strokeLinecap="round" />
      {/* trench coat */}
      <path d={`M${cx - 4} ${b.y + 40} C${cx - 40} ${b.y + 60} ${cx - 50} ${b.y + 150} ${cx - 44} ${b.y + 210} L${cx + 30} ${b.y + 214} C${cx + 36} ${b.y + 150} ${cx + 24} ${b.y + 70} ${cx + 4} ${b.y + 40} Z`} fill="#8c7350" />
      <path d={`M${cx - 4} ${b.y + 42} L${cx - 14} ${b.y + 120} M${cx + 4} ${b.y + 42} L${cx + 10} ${b.y + 120}`} stroke="#5d4a31" strokeWidth={3} />
      <rect x={cx - 42} y={b.y + 118} width={70} height={7} fill="#5d4a31" />
      {/* fedora */}
      <ellipse cx={cx} cy={b.y + 14} rx={34} ry={7} fill="#26222e" />
      <path d={`M${cx - 20} ${b.y + 14} Q${cx - 18} ${b.y - 14} ${cx} ${b.y - 10} Q${cx + 18} ${b.y - 14} ${cx + 20} ${b.y + 14} Z`} fill="#2f2a38" />
      <rect x={cx - 20} y={b.y + 6} width={40} height={5} fill={RED_STRING} opacity="0.8" />
      {/* umbrella leaning */}
      <path d={`M${cx + 40} ${b.y + b.h - 4} L${cx + 58} ${b.y + 170}`} stroke="#1e1e24" strokeWidth={4} />
      <path d={`M${cx + 48} ${b.y + b.h - 40} Q${cx + 70} ${b.y + 200} ${cx + 58} ${b.y + 160} Q${cx + 44} ${b.y + 210} ${cx + 48} ${b.y + b.h - 40} Z`} fill="#23232e" />
    </g>
  );
}

function Fridge({ b, ink }: { b: Box; ink: Ink }) {
  return (
    <g>
      <FloorShadow cx={b.x + b.w / 2} y={b.y + b.h} w={b.w + 20} />
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill="#c9d0dc" />
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill="#1a2140" opacity="0.35" />
      <rect x={b.x + 12} y={b.y + 14} width={b.w - 24} height={b.h * 0.62} rx={4} fill="#0e1a2e" />
      {[0.22, 0.42, 0.62].map((t, r) => (
        <g key={t}>
          <rect x={b.x + 16} y={b.y + 14 + b.h * 0.62 * t + 22} width={b.w - 32} height={3} fill="#9fb3c8" opacity="0.6" />
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={b.x + 22 + i * ((b.w - 48) / 6)} y={b.y + 14 + b.h * 0.62 * t} width={8} height={22} rx={3} fill={i % 2 === r % 2 ? ink.accent : "#e25a5a"} opacity="0.85" />
          ))}
        </g>
      ))}
      <rect x={b.x + 12} y={b.y + 14} width={b.w - 24} height={b.h * 0.62} rx={4} fill="#9fd0ff" opacity="0.08" />
      <rect x={b.x + b.w - 26} y={b.y + b.h * 0.3} width={8} height={70} rx={4} fill="#eef2f6" />
      <rect x={b.x + 20} y={b.y + b.h * 0.72} width={60} height={34} rx={3} fill={ink.paper} opacity="0.9" />
      <circle cx={b.x + 50} cy={b.y + b.h * 0.72 + 17} r={10} fill="none" stroke="#b8322f" strokeWidth={3} />
      <circle cx={b.x + b.w - 20} cy={b.y + b.h - 22} r={4} fill="#57e389" className="cf-anim cf-blink" />
    </g>
  );
}

function DripStand({ b, ink }: { b: Box; ink: Ink }) {
  const cx = b.x + b.w / 2;
  const top = b.y;
  return (
    <g>
      <FloorShadow cx={cx} y={b.y + b.h} w={90} />
      <rect x={cx - 3} y={top + 10} width={6} height={b.h - 14} fill="#aeb6c4" />
      <path d={`M${cx - 38} ${b.y + b.h} L${cx} ${b.y + b.h - 16} L${cx + 38} ${b.y + b.h}`} stroke="#aeb6c4" strokeWidth={5} fill="none" />
      {[-38, 38].map((dx) => (
        <circle key={dx} cx={cx + dx} cy={b.y + b.h} r={5} fill="#333" />
      ))}
      <path d={`M${cx - 30} ${top + 12} L${cx + 30} ${top + 12}`} stroke="#aeb6c4" strokeWidth={4} />
      {/* the bag */}
      <path d={`M${cx - 44} ${top + 16} h40 v58 q0 14 -20 14 q-20 0 -20 -14 Z`} fill="#dfe8ff" opacity="0.35" stroke="#dfe8ff" strokeOpacity="0.7" />
      <path d={`M${cx - 44} ${top + 46} h40 v28 q0 14 -20 14 q-20 0 -20 -14 Z`} fill={ink.accent} opacity="0.55" />
      <rect x={cx - 34} y={top + 24} width={20} height={12} fill={ink.paper} opacity="0.9" />
      <rect x={cx - 27} y={top + 88} width={6} height={16} rx={2} fill="#dfe8ff" opacity="0.6" />
      <circle className="cf-anim cf-drip" cx={cx - 24} cy={top + 100} r={2.4} fill={ink.accent} />
      <path d={`M${cx - 24} ${top + 104} C${cx - 24} ${top + 150} ${cx + 30} ${top + 130} ${cx + 44} ${top + 170}`} stroke="#dfe8ff" strokeOpacity="0.55" strokeWidth={2} fill="none" />
    </g>
  );
}

function Safe({ b, ink, id }: { b: Box; ink: Ink; id: (s: string) => string }) {
  const y = b.y + 70;
  const h = b.h - 70;
  return (
    <g>
      <FloorShadow cx={b.x + b.w / 2} y={b.y + b.h} w={b.w + 16} />
      <rect x={b.x} y={y} width={b.w} height={h} rx={8} fill={`url(#${id("metal")})`} />
      <rect x={b.x + 10} y={y + 10} width={b.w - 20} height={h - 20} rx={5} fill={ink.metalDark} stroke="#000" strokeOpacity="0.4" />
      <circle cx={b.x + b.w * 0.42} cy={y + h / 2} r={22} fill="#c8ccd6" />
      <circle cx={b.x + b.w * 0.42} cy={y + h / 2} r={15} fill="#8a909e" />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        const cx = b.x + b.w * 0.42;
        const cy = y + h / 2;
        return <line key={i} x1={cx + Math.sin(a) * 18} y1={cy - Math.cos(a) * 18} x2={cx + Math.sin(a) * 22} y2={cy - Math.cos(a) * 22} stroke="#2a2a2a" strokeWidth={2} />;
      })}
      <rect x={b.x + b.w * 0.72} y={y + h / 2 - 22} width={10} height={44} rx={5} fill="#c8ccd6" />
    </g>
  );
}

function Plant({ b }: { b: Box }) {
  const cx = b.x + b.w / 2;
  const potTop = b.y + b.h - 58;
  const leaves = [-60, -35, -12, 10, 32, 55, -80, 78];
  return (
    <g>
      <FloorShadow cx={cx} y={b.y + b.h} w={80} />
      {leaves.map((a, i) => (
        <ellipse key={i} cx={cx} cy={potTop - 44 - (i % 3) * 8} rx={12} ry={44 - (i % 3) * 6} fill={i % 2 ? "#2f6b43" : "#3d8052"} transform={`rotate(${a} ${cx} ${potTop})`} />
      ))}
      <path d={`M${cx - 34} ${potTop} h68 l-8 58 h-52 Z`} fill="#9a4f32" />
      <rect x={cx - 38} y={potTop - 6} width={76} height={12} rx={3} fill="#b25d3c" />
    </g>
  );
}

function Bin({ b, ink }: { b: Box; ink: Ink }) {
  const top = b.y + 20;
  return (
    <g>
      <FloorShadow cx={b.x + b.w / 2} y={b.y + b.h} w={b.w} />
      <circle cx={b.x + 22} cy={top + 2} r={13} fill={ink.paper} opacity="0.9" />
      <circle cx={b.x + 44} cy={top - 4} r={12} fill="#d9d2bd" />
      <path d={`M${b.x + 2} ${top} h${b.w - 4} l-8 ${b.h - 20} h-${b.w - 20} Z`} fill={ink.metalDark} stroke="#000" strokeOpacity="0.4" />
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={b.x + 4 + t * (b.w - 8)} y1={top + 4} x2={b.x + 8 + t * (b.w - 16)} y2={b.y + b.h - 4} stroke="#000" strokeOpacity="0.3" strokeWidth={2} />
      ))}
    </g>
  );
}

function Desk({ b, ink, id, style }: { b: Box; ink: Ink; id: (s: string) => string; style: SceneStyle }) {
  if (style === "bench") return <Bench b={b} ink={ink} id={id} />;
  if (style === "archive") return <ArchiveTable b={b} ink={ink} id={id} />;
  const top = b.y;
  return (
    <g>
      <ellipse cx={b.x + b.w / 2} cy={b.y + b.h} rx={b.w / 2 + 30} ry={16} fill="#000" opacity="0.45" />
      {/* legs */}
      <rect x={b.x + 14} y={top + 20} width={16} height={b.h - 20} fill={ink.woodDark} />
      <rect x={b.x + b.w - 30} y={top + 20} width={16} height={b.h - 20} fill={ink.woodDark} />
      {/* pedestal with drawers */}
      <rect x={b.x + 18} y={top + 18} width={b.w - 36} height={112} fill={`url(#${id("wood")})`} />
      {[0, 1].map((i) => (
        <g key={i}>
          <rect x={b.x + 34 + i * ((b.w - 68) / 2 + 6)} y={top + 34} width={(b.w - 80) / 2} height={78} rx={3} fill={ink.wood} stroke="#000" strokeOpacity="0.35" />
          <rect x={b.x + 34 + i * ((b.w - 68) / 2 + 6) + (b.w - 80) / 4 - 22} y={top + 66} width={44} height={9} rx={4} fill="#c7a15a" />
        </g>
      ))}
      {/* top slab */}
      <rect x={b.x} y={top} width={b.w} height={20} rx={3} fill={ink.woodLight} />
      <rect x={b.x} y={top + 16} width={b.w} height={5} fill="#000" opacity="0.35" />
      {/* papers on the desk */}
      <rect x={b.x + 170} y={top - 4} width={70} height={8} fill={ink.paper} transform={`rotate(-4 ${b.x + 205} ${top})`} />
      <rect x={b.x + 176} y={top - 8} width={64} height={7} fill="#d9d2bd" transform={`rotate(3 ${b.x + 208} ${top - 4})`} />
      <rect x={b.x + 260} y={top - 3} width={30} height={4} fill={RED_STRING} opacity="0.8" />
    </g>
  );
}

function Bench({ b, ink, id }: { b: Box; ink: Ink; id: (s: string) => string }) {
  // a steel lab bench: two cupboard doors with bar handles, a kick plate, a pale worktop with a back lip, a clipboard
  const top = b.y;
  const doorW = (b.w - 60) / 2;
  return (
    <g>
      <ellipse cx={b.x + b.w / 2} cy={b.y + b.h} rx={b.w / 2 + 30} ry={16} fill="#000" opacity="0.45" />
      <rect x={b.x + 10} y={top + 16} width={b.w - 20} height={b.h - 26} fill={`url(#${id("metal")})`} />
      {[0, 1].map((i) => (
        <g key={i}>
          <rect x={b.x + 26 + i * (doorW + 8)} y={top + 30} width={doorW} height={100} rx={3} fill={ink.metalDark} stroke="#000" strokeOpacity="0.35" />
          <rect x={b.x + 26 + i * (doorW + 8) + (i === 0 ? doorW - 22 : 14)} y={top + 56} width={8} height={40} rx={4} fill="#e6edf2" />
        </g>
      ))}
      <rect x={b.x + 10} y={b.y + b.h - 14} width={b.w - 20} height={6} fill="#0f1216" />
      <rect x={b.x - 6} y={top - 8} width={b.w + 12} height={8} fill="#9aa5b1" />
      <rect x={b.x - 6} y={top} width={b.w + 12} height={18} rx={2} fill="#b8c2cc" />
      <rect x={b.x - 6} y={top + 14} width={b.w + 12} height={4} fill="#000" opacity="0.35" />
      <rect x={b.x + b.w / 2 - 22} y={top + 40} width={44} height={58} rx={3} fill="#6b4a2f" />
      <rect x={b.x + b.w / 2 - 17} y={top + 48} width={34} height={44} fill={ink.paper} />
      <rect x={b.x + b.w / 2 - 10} y={top + 36} width={20} height={8} rx={2} fill="#c7cdd4" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={b.x + b.w / 2 - 12} y={top + 56 + i * 9} width={24 - i * 5} height={3} fill="#8a8f9a" />
      ))}
    </g>
  );
}

function ArchiveTable({ b, ink, id }: { b: Box; ink: Ink; id: (s: string) => string }) {
  // a long oak table on turned legs with a card-index chest at its left end and a green blotter
  const top = b.y;
  const leg = (x: number) => (
    <g key={x}>
      <rect x={x} y={top + 18} width={18} height={b.h - 18} fill={ink.woodDark} />
      <rect x={x - 4} y={top + 40} width={26} height={12} rx={5} fill={ink.wood} />
      <rect x={x - 4} y={top + 96} width={26} height={12} rx={5} fill={ink.wood} />
    </g>
  );
  return (
    <g>
      <ellipse cx={b.x + b.w / 2} cy={b.y + b.h} rx={b.w / 2 + 30} ry={16} fill="#000" opacity="0.45" />
      {leg(b.x + 22)}
      {leg(b.x + b.w - 40)}
      <rect x={b.x + 12} y={top + 18} width={b.w - 24} height={22} fill={`url(#${id("wood")})`} />
      <rect x={b.x + 44} y={top + 40} width={112} height={100} fill={ink.wood} stroke="#000" strokeOpacity="0.35" />
      {[0, 1, 2].map((r) =>
        [0, 1].map((c) => (
          <g key={`${r}${c}`}>
            <rect x={b.x + 50 + c * 52} y={top + 46 + r * 31} width={48} height={26} rx={2} fill={ink.woodLight} stroke="#000" strokeOpacity="0.3" />
            <rect x={b.x + 64 + c * 52} y={top + 55 + r * 31} width={20} height={7} rx={1} fill="#c7a15a" />
          </g>
        )),
      )}
      <rect x={b.x - 14} y={top} width={b.w + 28} height={18} rx={3} fill="#6b4a2f" />
      <rect x={b.x - 14} y={top + 14} width={b.w + 28} height={5} fill="#000" opacity="0.35" />
      <rect x={b.x + 150} y={top - 5} width={170} height={7} rx={1} fill="#2f5a3a" />
      <rect x={b.x + 170} y={top - 4} width={70} height={8} fill={ink.paper} transform={`rotate(-4 ${b.x + 205} ${top})`} />
      <rect x={b.x + 250} y={top - 3} width={30} height={4} fill={RED_STRING} opacity="0.8" />
    </g>
  );
}

function Microscope({ b, ink }: { b: Box; ink: Ink }) {
  const x = b.x + b.w / 2 - 20;
  const base = b.y + b.h;
  return (
    <g>
      <ellipse cx={x + 20} cy={base} rx={42} ry={6} fill="#000" opacity="0.4" />
      <rect x={x - 18} y={base - 12} width={70} height={12} rx={4} fill="#20252f" />
      <path d={`M${x + 34} ${base - 12} C${x + 60} ${base - 50} ${x + 50} ${base - 80} ${x + 26} ${base - 92}`} stroke="#20252f" strokeWidth={14} fill="none" strokeLinecap="round" />
      <rect x={x - 12} y={base - 42} width={58} height={8} rx={2} fill="#2c3340" />
      <rect x={x + 2} y={base - 44} width={30} height={3} fill="#bfe6ff" opacity="0.8" />
      <rect x={x + 6} y={base - 64} width={12} height={20} fill="#aab2c0" />
      <rect x={x + 2} y={base - 100} width={20} height={40} rx={4} fill="#e6e9ef" transform={`rotate(-18 ${x + 12} ${base - 80})`} />
      <rect x={x - 6} y={base - 112} width={16} height={16} rx={3} fill="#20252f" transform={`rotate(-18 ${x + 2} ${base - 104})`} />
      <circle cx={x + 44} cy={base - 44} r={7} fill="#aab2c0" />
      <rect x={x + 8} y={base - 46} width={8} height={4} fill={ink.accent} opacity="0.9" />
    </g>
  );
}

function Typewriter({ b, ink }: { b: Box; ink: Ink }) {
  const base = b.y + b.h;
  const x = b.x + 6;
  const w = b.w - 12;
  return (
    <g>
      <ellipse cx={x + w / 2} cy={base} rx={w / 2 + 6} ry={6} fill="#000" opacity="0.4" />
      {/* the paper */}
      <rect x={x + w * 0.22} y={base - 104} width={w * 0.56} height={62} fill={ink.paper} />
      {[0.25, 0.42, 0.58].map((t) => (
        <line key={t} x1={x + w * 0.27} y1={base - 104 + 62 * t} x2={x + w * (t === 0.58 ? 0.5 : 0.72)} y2={base - 104 + 62 * t} stroke="#3a3a3a" strokeWidth={2} />
      ))}
      <rect x={x + 4} y={base - 50} width={w - 8} height={14} rx={7} fill="#1b1d22" />
      <path d={`M${x} ${base} L${x + 12} ${base - 38} H${x + w - 12} L${x + w} ${base} Z`} fill="#2d2f36" />
      {[0, 1, 2].map((r) =>
        Array.from({ length: 8 - r }, (_, i) => <circle key={`${r}-${i}`} cx={x + 20 + r * 6 + i * ((w - 40) / 8)} cy={base - 28 + r * 9} r={3.2} fill="#d9d4c5" />),
      )}
    </g>
  );
}

function Phone({ b }: { b: Box }) {
  const base = b.y + b.h;
  const cx = b.x + b.w / 2;
  return (
    <g>
      <ellipse cx={cx} cy={base} rx={50} ry={6} fill="#000" opacity="0.4" />
      <path d={`M${cx - 44} ${base} Q${cx - 40} ${base - 44} ${cx} ${base - 46} Q${cx + 40} ${base - 44} ${cx + 44} ${base} Z`} fill="#15161b" />
      <circle cx={cx} cy={base - 22} r={16} fill="#d9d4c5" />
      <circle cx={cx} cy={base - 22} r={6} fill="#15161b" />
      <path d={`M${cx - 52} ${base - 50} Q${cx} ${base - 70} ${cx + 52} ${base - 50} l6 10 q-12 6 -18 -2 q-40 -8 -76 0 q-6 8 -18 2 Z`} fill="#1f2026" />
      <path d={`M${cx + 44} ${base - 10} C${cx + 70} ${base} ${cx + 60} ${base + 4} ${cx + 70} ${base}`} stroke="#15161b" strokeWidth={3} fill="none" />
    </g>
  );
}

function FileBox({ b, ink }: { b: Box; ink: Ink }) {
  const base = b.y + b.h;
  const w = Math.min(b.w - 8, 100);
  const h = Math.min(b.h - 10, 56);
  const x = b.x + (b.w - w) / 2;
  const tabs = ["#e2b76b", "#9fc3e6", "#e89a9a", "#bde0a8"];
  return (
    <g>
      <ellipse cx={x + w / 2} cy={base} rx={w / 2 + 8} ry={6} fill="#000" opacity="0.4" />
      {tabs.map((c, i) => (
        <rect key={i} x={x + 8 + i * ((w - 30) / 4)} y={base - h - 12 + (i % 2) * 4} width={26} height={18} rx={2} fill={c} />
      ))}
      <rect x={x} y={base - h} width={w} height={h} fill="#a57a45" />
      <rect x={x} y={base - h} width={w} height={8} fill="#8c6538" />
      <rect x={x + w / 2 - 22} y={base - h / 2 - 6} width={44} height={16} fill={ink.paper} />
      <line x1={x + w / 2 - 16} y1={base - h / 2 + 2} x2={x + w / 2 + 16} y2={base - h / 2 + 2} stroke="#333" strokeWidth={2} />
    </g>
  );
}

function Mug({ b, ink }: { b: Box; ink: Ink }) {
  const base = b.y + b.h;
  const x = b.x + b.w / 2 - 10;
  return (
    <g>
      <rect x={b.x + 4} y={base - 6} width={70} height={6} fill={ink.paper} transform={`rotate(-6 ${b.x + 40} ${base - 3})`} />
      <ellipse cx={x + 18} cy={base} rx={30} ry={5} fill="#000" opacity="0.45" />
      <path d={`M${x} ${base - 40} h36 v32 q0 8 -8 8 h-20 q-8 0 -8 -8 Z`} fill="#e8e2d2" />
      <ellipse cx={x + 18} cy={base - 40} rx={18} ry={4} fill="#3a2418" />
      <path d={`M${x + 36} ${base - 32} q14 0 14 10 q0 10 -14 10`} stroke="#e8e2d2" strokeWidth={5} fill="none" />
      <rect x={x + 6} y={base - 30} width={24} height={4} fill={RED_STRING} opacity="0.7" />
      <ellipse cx={x - 30} cy={base - 3} rx={14} ry={3.5} fill="none" stroke="#5a3a24" strokeWidth={2} opacity="0.7" />
    </g>
  );
}

function Beakers({ b, ink }: { b: Box; ink: Ink }) {
  const base = b.y + b.h;
  const x = b.x + 6;
  return (
    <g>
      <ellipse cx={x + 56} cy={base} rx={60} ry={5} fill="#000" opacity="0.4" />
      <rect x={x} y={base - 26} width={62} height={6} fill={ink.woodLight} />
      <rect x={x} y={base - 8} width={62} height={6} fill={ink.woodLight} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={x + 8 + i * 18} y={base - 52} width={10} height={48} rx={5} fill="#dfe8ff" opacity="0.35" stroke="#dfe8ff" strokeOpacity="0.6" />
          <rect x={x + 8 + i * 18} y={base - 30 + i * 5} width={10} height={26 - i * 5} rx={5} fill={[ink.accent, "#e25a5a", "#7fd1b9"][i]} opacity="0.85" />
        </g>
      ))}
      <path d={`M${x + 84} ${base - 58} v18 l-18 36 q-2 6 6 6 h40 q8 0 6 -6 l-18 -36 v-18 Z`} fill="#dfe8ff" opacity="0.3" stroke="#dfe8ff" strokeOpacity="0.7" />
      <path d={`M${x + 72} ${base - 20} l-6 12 q-2 6 6 6 h40 q8 0 6 -6 l-6 -12 Z`} fill={ink.accent} opacity="0.75" />
      <circle className="cf-anim cf-bubble-rise" cx={x + 92} cy={base - 14} r={2.5} fill="#fff" opacity="0.7" />
    </g>
  );
}

function Books({ b }: { b: Box }) {
  const base = b.y + b.h;
  const x = b.x + 4;
  const stack = [
    { w: 110, c: "#7b2d2d" },
    { w: 100, c: "#2d4a7b" },
    { w: 104, c: "#6f6a2c" },
    { w: 92, c: "#3f2d5e" },
  ];
  return (
    <g>
      <ellipse cx={x + 58} cy={base} rx={64} ry={6} fill="#000" opacity="0.4" />
      {stack.map((s, i) => (
        <g key={i} transform={`rotate(${(i % 2 ? 1.5 : -1.5) * (i + 1) * 0.6} ${x + 55} ${base - 10 - i * 16})`}>
          <rect x={x + (i % 2) * 6} y={base - 16 - i * 16} width={s.w} height={16} rx={2} fill={s.c} />
          <rect x={x + (i % 2) * 6 + s.w - 12} y={base - 16 - i * 16 + 2} width={10} height={12} fill="#efe6cf" opacity="0.8" />
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// the accusation room

export function AccusationRoom({ ink, uid, unlocked, solved }: { ink: Ink; uid: string; unlocked: boolean; solved: boolean }) {
  const id = (s: string) => `${uid}-acc-${s}`;
  const cx = 500;
  return (
    <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="cf-scene-svg" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={id("wall")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#07070d" />
          <stop offset="1" stopColor={mixHex(ink.wallBottom, "#000000", 0.35)} />
        </linearGradient>
        <linearGradient id={id("spot")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ink.lamp} stopOpacity={unlocked ? 0.6 : 0.18} />
          <stop offset="1" stopColor={ink.lamp} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id("rim")} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor={ink.accent} stopOpacity="0.5" />
          <stop offset="1" stopColor={ink.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={SCENE_W} height={SCENE_H} fill={`url(#${id("wall")})`} />
      {/* one-way mirror */}
      <rect x={90} y={70} width={250} height={150} rx={4} fill="#0c1020" stroke="#262a3c" strokeWidth={8} />
      <path d="M110 90 L180 90 L120 200 Z" fill="#fff" opacity="0.05" />
      {/* evidence photos on the right wall */}
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`rotate(${[-4, 3, -2][i]} ${720 + i * 80} ${120})`}>
          <rect x={690 + i * 80} y={80} width={62} height={76} fill={ink.paper} />
          <rect x={696 + i * 80} y={86} width={50} height={46} fill="#1b1d2a" />
          <circle cx={721 + i * 80} cy={84} r={4} fill={RED_STRING} />
        </g>
      ))}
      <path d="M721 84 L801 84 L881 84" stroke={RED_STRING} strokeWidth={2} fill="none" opacity={solved ? 1 : 0.6} />
      <rect y={330} width={SCENE_W} height={170} fill="#06060a" />
      {/* the hanging bulb and its cone */}
      <line x1={cx} y1={0} x2={cx} y2={70} stroke="#222" strokeWidth={3} />
      <path d={`M${cx - 28} 92 L${cx - 18} 70 H${cx + 18} L${cx + 28} 92 Z`} fill="#2a2a30" />
      <polygon className="cf-anim cf-swing" points={`${cx - 24},92 ${cx + 24},92 ${cx + 260},470 ${cx - 260},470`} fill={`url(#${id("spot")})`} style={{ mixBlendMode: "screen", transformOrigin: `${cx}px 70px` }} />
      <circle cx={cx} cy={94} r={8} fill={unlocked ? ink.lamp : "#6b6552"} />
      {/* the suspect: a silhouette across the table, rim-lit in the palette's accent */}
      <g opacity={solved ? 0.45 : 1}>
        <ellipse cx={cx} cy={240} rx={140} ry={120} fill={`url(#${id("rim")})`} />
        <path d={`M${cx - 110} 340 C${cx - 100} 262 ${cx - 60} 246 ${cx} 244 C${cx + 60} 246 ${cx + 100} 262 ${cx + 110} 340 Z`} fill="#050508" stroke={ink.accent} strokeOpacity="0.7" strokeWidth={2} />
        <ellipse cx={cx} cy={206} rx={38} ry={44} fill="#050508" stroke={ink.accent} strokeOpacity="0.7" strokeWidth={2} />
        <ellipse cx={cx} cy={172} rx={70} ry={11} fill="#050508" stroke={ink.accent} strokeOpacity="0.6" strokeWidth={2} />
        <path d={`M${cx - 38} 172 Q${cx - 36} 128 ${cx} 132 Q${cx + 36} 128 ${cx + 38} 172 Z`} fill="#050508" />
        {!solved && (
          <g className="cf-anim cf-eyes">
            <ellipse cx={cx - 14} cy={206} rx={5} ry={2.4} fill={ink.accent} />
            <ellipse cx={cx + 14} cy={206} rx={5} ry={2.4} fill={ink.accent} />
          </g>
        )}
      </g>
      {/* the table */}
      <path d={`M${cx - 300} 330 H${cx + 300} L${cx + 360} 420 H${cx - 360} Z`} fill="#2c2a33" />
      <path d={`M${cx - 360} 420 H${cx + 360} V436 H${cx - 360} Z`} fill="#16151b" />
      <ellipse cx={cx} cy={372} rx={230} ry={34} fill={ink.lamp} opacity={unlocked ? 0.22 : 0.06} style={{ mixBlendMode: "screen" }} />
      {/* a case folder on the table */}
      <g transform={`rotate(-6 ${cx - 40} 370)`}>
        <rect x={cx - 110} y={350} width={130} height={46} rx={3} fill="#c79a56" />
        <rect x={cx - 110} y={344} width={50} height={10} rx={2} fill="#c79a56" />
        <rect x={cx - 90} y={362} width={80} height={12} fill={ink.paper} />
      </g>
      {solved && (
        <g transform={`rotate(-12 ${cx + 120} 370)`}>
          <rect x={cx + 40} y={346} width={170} height={48} rx={6} fill="none" stroke={RED_STRING} strokeWidth={5} />
          <text x={cx + 125} y={380} textAnchor="middle" fontSize={28} fontWeight={900} fill={RED_STRING} letterSpacing={4}>
            CLOSED
          </text>
        </g>
      )}
      <rect width={SCENE_W} height={SCENE_H} fill="#000" opacity={unlocked ? 0 : 0.35} />
    </svg>
  );
}

/** Where a slot's hotspot ring sits, as percentages of the scene (for the HTML buttons laid over the SVG). */
export function pctBox(b: Box): { left: string; top: string; width: string; height: string } {
  return {
    left: `${(b.x / SCENE_W) * 100}%`,
    top: `${(b.y / SCENE_H) * 100}%`,
    width: `${(b.w / SCENE_W) * 100}%`,
    height: `${(b.h / SCENE_H) * 100}%`,
  };
}

export { SLOTS };
