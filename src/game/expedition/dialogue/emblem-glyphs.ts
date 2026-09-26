/**
 * src/game/expedition/dialogue/emblem-glyphs.ts (S1) — the dialogue-bar emblem geometry (bible §3.9, 20 §2.7).
 * One ≤ 12-line SVG path per `EmblemGlyph`, drawn in a 24 × 24 box centred on (12, 12) with round strokes (no fill),
 * plus the concentric BROKEN rings (a labyrinth look). Pure: strings only.
 */
import type { EmblemGlyph } from "../../../contracts/world";

export const GLYPH_BOX = 24;

/** Stroke-only paths (stroke-width ≈ 1.6 in the 24-unit box). */
export const EMBLEM_GLYPHS: Readonly<Record<EmblemGlyph, string>> = {
  labyrinth: "M12 4a8 8 0 1 0 8 8 M12 8a4 4 0 1 1 -4 4 M12 12h4",
  orrery: "M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M3 12a9 4 0 1 0 18 0a9 4 0 1 0 -18 0 M19 9.5a1.2 1.2 0 1 0 0.01 0",
  gear: "M12 8a4 4 0 1 0 0.01 0 M12 2v4 M12 18v4 M2 12h4 M18 12h4 M4.9 4.9l2.8 2.8 M16.3 16.3l2.8 2.8 M4.9 19.1l2.8-2.8 M16.3 7.7l2.8-2.8",
  owl: "M6 8l-1-4 4 2 M18 8l1-4-4 2 M5 8c0 8 3 12 7 12s7-4 7-12c-2-2-12-2-14 0 M9.5 11a1.5 1.5 0 1 0 0.01 0 M14.5 11a1.5 1.5 0 1 0 0.01 0 M11 15l1 1.5 1-1.5",
  cell: "M12 3c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9 M12 9a3 3 0 1 0 0.01 0 M6 15h2 M16 7h1",
  wave: "M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 3.5-4 5-2",
  quill: "M20 3c-8 2-13 8-15 17 M20 3c-2 6-6 10-12 12 M5 20l3-3",
  lantern: "M9 4h6 M12 2v2 M8 6h8l-1 12H9z M10 20h4 M12 10v4",
  star: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z",
  leaf: "M5 19C5 10 11 5 20 4c-1 9-6 15-15 15 M5 19l9-9",
  flame: "M12 21c-4 0-6-3-6-6 0-4 4-6 4-11 3 2 7 6 7 11 0 3-2 6-5 6 M12 21c-1.5 0-2.5-1-2.5-2.5S12 15 12 15s2.5 2 2.5 3.5S13.5 21 12 21",
  nib: "M12 3l6 7-6 11-6-11z M12 10v5 M12 10a1 1 0 1 0 0.01 0",
  slit: "M3 12c4-6 14-6 18 0-4 6-14 6-18 0 M12 8v8",
  crab: "M6 12a6 4 0 1 0 12 0a6 4 0 1 0 -12 0 M6 11l-3-4 3-1 M18 11l3-4-3-1 M8 16l-2 3 M16 16l2 3 M10 9V7 M14 9V7",
  reel: "M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0 M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M12 4v6 M5 16l5-3 M19 16l-5-3",
  slug: "M3 17c0-3 3-5 7-5h6c3 0 5 2 5 5z M16 12l1-5 M19 12l2-4",
  maws: "M3 8l3 4 3-4 3 4 3-4 3 4 3-4 M3 16l3-4 3 4 3-4 3 4 3-4 3 4",
  triskelion: "M12 12c0-4 3-6 6-5 M12 12c-3.5 2-7 1-8-2 M12 12c3.5 2 4 6 2 8 M12 12a1 1 0 1 0 0.01 0",
  hexagon: "M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z M12 8l3.5 2v4L12 16l-3.5-2v-4z",
  hourglass: "M6 3h12 M6 21h12 M7 3c0 6 10 6 10 9s-10 3-10 9 M17 3c0 6-10 6-10 9s10 3 10 9",
  plus: "M12 4v16 M4 12h16 M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
  headset: "M4 14v-2a8 8 0 0 1 16 0v2 M4 14h3v5H4z M17 14h3v5h-3z M20 19c0 2-3 3-6 3",
  eyeshade: "M3 10c3-4 15-4 18 0l-3 2H6z M9 16a2 2 0 1 0 0.01 0 M15 16a2 2 0 1 0 0.01 0 M11 16h2",
  flashlight: "M8 3h8l-1 5H9z M9 8h6v12H9z M12 12v3 M4 3l3 2 M20 3l-3 2",
};

/** The glyph for an emblem, or the labyrinth (the game's title emblem) when unknown. */
export function glyphPath(glyph: EmblemGlyph | string): string {
  return (EMBLEM_GLYPHS as Record<string, string>)[glyph] ?? EMBLEM_GLYPHS.labyrinth;
}

/** A point on a circle; 0° is 12 o'clock, clockwise. */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

/** An SVG arc path from `a0`° to `a1`° (clockwise, 0° = top). */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const sweep = Math.max(0, a1 - a0);
  if (sweep >= 359.99) {
    // a full circle as two half arcs
    const [x0, y0] = polar(cx, cy, r, a0);
    const [x1, y1] = polar(cx, cy, r, a0 + 180);
    return `M${fmt(x0)} ${fmt(y0)}A${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(x1)} ${fmt(y1)}A${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(x0)} ${fmt(y0)}`;
  }
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M${fmt(x0)} ${fmt(y0)}A${fmt(r)} ${fmt(r)} 0 ${sweep > 180 ? 1 : 0} 1 ${fmt(x1)} ${fmt(y1)}`;
}

/**
 * One broken ring: `gaps` openings of `gapDeg` each, evenly spaced from `rotation`. gaps = 0 is a whole ring.
 * Returns one path per arc.
 */
export function brokenRing(cx: number, cy: number, r: number, gaps: number, rotation = 0, gapDeg = 26): string[] {
  if (gaps <= 0) return [arcPath(cx, cy, r, rotation, rotation + 360)];
  const step = 360 / gaps;
  const out: string[] = [];
  for (let i = 0; i < gaps; i++) {
    const a0 = rotation + i * step + gapDeg / 2;
    const a1 = rotation + (i + 1) * step - gapDeg / 2;
    out.push(arcPath(cx, cy, r, a0, a1));
  }
  return out;
}

/**
 * The three concentric rings of a 64 px emblem (bible §3.9): the outer ring whole, the inner two broken like a
 * labyrinth (`gaps` from the speaker's Emblem, the innermost offset so the openings never line up).
 */
export function emblemRings(size: number, gaps: number): { r: number; arcs: string[]; role: "outer" | "middle" | "inner" }[] {
  const c = size / 2;
  return [
    { role: "outer", r: size * 0.46, arcs: brokenRing(c, c, size * 0.46, 0) },
    { role: "middle", r: size * 0.37, arcs: brokenRing(c, c, size * 0.37, Math.max(1, gaps), 20) },
    { role: "inner", r: size * 0.28, arcs: brokenRing(c, c, size * 0.28, Math.max(1, gaps), 20 + 180 / Math.max(1, gaps)) },
  ];
}
