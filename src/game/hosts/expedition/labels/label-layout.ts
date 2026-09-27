/**
 * labels/label-layout.ts (pure, H3) — collision avoidance for the DOM world text (w1a fix 8). WorldLabelLayer measures
 * each label once per text change and asks this module where to draw it: labels are placed in priority order (the
 * interact prompt first, then live chips, then pins and names), and a label that would overlap one already placed is
 * nudged vertically to the nearest free slot ABOVE it (world labels float over their anchors), or below when there is
 * no room above within `maxShift` px or under the stage top, or hidden when neither fits. A label that was nudged keeps
 * its previous slot while that slot is still free, so two labels at a boundary do not flicker.
 *
 * Boxes are in CSS px relative to the stage. The anchor (sx, sy) is the label's bottom centre, as drawn by the layer
 * (`translate(-50%, -100%)`).
 */
import type { LabelKind } from "./label-store";

/** Higher wins: a lower-priority label moves out of a higher one's way. */
export const LABEL_PRIORITY: Readonly<Record<LabelKind, number>> = {
  prompt: 100,
  interact: 90,
  emote: 80,
  chip: 70,
  flap: 60,
  label_swap: 55,
  plaque_title: 50,
  pin: 40,
  npc_name: 30,
};

export interface LabelBox {
  id: string;
  kind: LabelKind;
  /** anchor = bottom centre (CSS px) */
  sx: number;
  sy: number;
  w: number;
  h: number;
}
export interface LabelPlacement {
  /** vertical nudge (CSS px, negative = up) */
  dy: number;
  hidden: boolean;
}
export interface LayoutOptions {
  /** clearance between labels (px) */
  pad?: number;
  /** the largest nudge before a label is hidden (px) */
  maxShift?: number;
  /** last frame's placements: a nudged label keeps its slot while it is still free */
  previous?: ReadonlyMap<string, LabelPlacement>;
  /** the stage's top edge (px): an upward nudge never pushes a label above it */
  top?: number;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function rectOf(b: LabelBox, dy: number): Rect {
  return { x0: b.sx - b.w / 2, x1: b.sx + b.w / 2, y0: b.sy - b.h + dy, y1: b.sy + dy };
}
function overlaps(a: Rect, b: Rect, pad: number): boolean {
  return a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;
}
function firstHit(r: Rect, placed: readonly Rect[], pad: number): Rect | null {
  for (const p of placed) if (overlaps(r, p, pad)) return p;
  return null;
}

/** Walks up (dir −1) or down (dir +1) past each blocker until the box is free; null past maxShift or the stage top. */
function search(b: LabelBox, placed: readonly Rect[], pad: number, maxShift: number, dir: -1 | 1, top: number): number | null {
  let dy = 0;
  for (let i = 0; i <= placed.length; i++) {
    const hit = firstHit(rectOf(b, dy), placed, pad);
    if (!hit) return Math.abs(dy) <= maxShift ? dy : null;
    dy = dir < 0 ? hit.y0 - pad - b.sy : hit.y1 + pad - (b.sy - b.h);
    if (Math.abs(dy) > maxShift || (dir < 0 && b.sy - b.h + dy < top)) return null;
  }
  return null;
}

/**
 * Places every box: priority order (ties keep the input order, so a chip stack stays in its order), then the first
 * free slot among: no nudge, last frame's nudge, the nearest slot above, the nearest slot below.
 */
export function layoutLabels(boxes: readonly LabelBox[], opts: LayoutOptions = {}): Map<string, LabelPlacement> {
  const pad = opts.pad ?? 4;
  const maxShift = opts.maxShift ?? 96;
  const top = opts.top ?? 0;
  const order = boxes.map((b, i) => ({ b, i })).sort((p, q) => LABEL_PRIORITY[q.b.kind] - LABEL_PRIORITY[p.b.kind] || p.i - q.i);
  const placed: Rect[] = [];
  const out = new Map<string, LabelPlacement>();
  for (const { b } of order) {
    let dy: number | null = null;
    if (!firstHit(rectOf(b, 0), placed, pad)) dy = 0;
    const prev = opts.previous?.get(b.id);
    if (dy === null && prev && !prev.hidden && prev.dy !== 0 && Math.abs(prev.dy) <= maxShift && !firstHit(rectOf(b, prev.dy), placed, pad)) dy = prev.dy;
    if (dy === null) dy = search(b, placed, pad, maxShift, -1, top) ?? search(b, placed, pad, maxShift, 1, top);
    if (dy === null) {
      out.set(b.id, { dy: 0, hidden: true });
      continue;
    }
    placed.push(rectOf(b, dy));
    out.set(b.id, { dy, hidden: false });
  }
  return out;
}
