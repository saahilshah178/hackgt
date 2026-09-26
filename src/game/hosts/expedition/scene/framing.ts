/**
 * scene/framing.ts (pure, H1) — camera maths (docs/design/20 §2.2 framing + camera director, decision 5).
 * The canvas is always full-bleed; the panel overlays the right side, so a contraption is framed inside the visible
 * SAFE RECT (CSS px). The base zoom maps 1080 design units to the viewport height; a station's `frameZoom` overrides
 * the fit. Views are expressed as the world-space top-left (viewX, viewY) + zoom; `toScroll` converts to Phaser's
 * scroll convention (zoom about the camera centre).
 */
import type { LayoutKind, SafeRect } from "../../types";

export const DESIGN_HEIGHT = 1080;
/** Where the player's feet sit vertically in the explore view (fraction of view height). */
export const FOLLOW_FOCUS_Y = 0.64;

export interface Viewport {
  w: number;
  h: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface CameraView {
  viewX: number;
  viewY: number;
  zoom: number;
}
export interface ZoneFrame {
  width: number;
  height: number;
  camera: { minZoom: number; maxZoom: number; xDeadzone: number; yDeadzone: number; lerp: number };
}
export interface FrameResult extends CameraView {
  scrollX: number;
  scrollY: number;
}

export const baseZoom = (vp: Viewport) => Math.max(0.05, vp.h / DESIGN_HEIGHT);
export const viewSize = (vp: Viewport, zoom: number) => ({ w: vp.w / zoom, h: vp.h / zoom });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The visible world area per layout when the client did not measure one: scrub left 58 %, board left 45 %, vault centred. */
export function defaultSafeRect(mode: LayoutKind, vp: Viewport): SafeRect {
  switch (mode) {
    case "scrub":
    case "sandbox":
      return { x: 0, y: 0, w: Math.round(vp.w * 0.58), h: vp.h };
    case "board":
      return { x: 0, y: 0, w: Math.round(vp.w * 0.45), h: vp.h };
    case "vault":
    case "explore":
      return { x: 0, y: 0, w: vp.w, h: vp.h };
  }
}

/** Phaser scroll for a view (zoom is applied about the camera centre). */
export function toScroll(view: CameraView, vp: Viewport): { scrollX: number; scrollY: number } {
  return { scrollX: view.viewX - vp.w / 2 + vp.w / (2 * view.zoom), scrollY: view.viewY - vp.h / 2 + vp.h / (2 * view.zoom) };
}
export function fromScroll(scrollX: number, scrollY: number, zoom: number, vp: Viewport): CameraView {
  return { viewX: scrollX + vp.w / 2 - vp.w / (2 * zoom), viewY: scrollY + vp.h / 2 - vp.h / (2 * zoom), zoom };
}
export function worldToScreen(x: number, y: number, view: CameraView): { sx: number; sy: number } {
  return { sx: (x - view.viewX) * view.zoom, sy: (y - view.viewY) * view.zoom };
}

/** Range of a view origin that keeps the view inside [0, extent] (centred when the view is larger). */
function zoneRange(extent: number, size: number): [number, number] {
  return size >= extent ? [(extent - size) / 2, (extent - size) / 2] : [0, extent - size];
}

/** Clamp a view to the zone (and, while a boss arena is active, to the arena's x range). */
export function clampView(view: CameraView, vp: Viewport, zone: Pick<ZoneFrame, "width" | "height">, arena?: { x0: number; x1: number } | null): CameraView {
  const { w, h } = viewSize(vp, view.zoom);
  let [x0, x1] = zoneRange(zone.width, w);
  if (arena) {
    const [a0, a1] = zoneRange(arena.x1 - arena.x0, w);
    x0 = Math.max(x0, arena.x0 + a0);
    x1 = Math.min(x1, arena.x0 + a1);
    if (x0 > x1) x0 = x1 = arena.x0 + (arena.x1 - arena.x0 - w) / 2;
  }
  const [y0, y1] = zoneRange(zone.height, h);
  return { viewX: clamp(view.viewX, x0, x1), viewY: clamp(view.viewY, y0, y1), zoom: view.zoom };
}

/**
 * Frames `target` (world units: a contraption's frameBounds, usually unioned with the player) inside the safe rect.
 * zoom = (frameZoom ?? clamp(fit, minZoom, 1)) × viewportHeight / 1080. The view is clamped to the zone only as far as
 * the target stays inside the safe rect.
 */
export function frameFor(target: Rect, safe: SafeRect, vp: Viewport, zone: ZoneFrame, frameZoom: number | null): FrameResult {
  const base = baseZoom(vp);
  const fit = Math.min(safe.w / Math.max(1, target.w * base), safe.h / Math.max(1, target.h * base));
  const zf = frameZoom ?? clamp(fit, zone.camera.minZoom, 1);
  const zoom = zf * base;
  const { w, h } = viewSize(vp, zoom);
  const axis = (t0: number, tSize: number, s0: number, sSize: number, extent: number, size: number) => {
    const centred = t0 + tSize / 2 - (s0 + sSize / 2) / zoom;
    const cLo = t0 + tSize - (s0 + sSize) / zoom; // target's far edge at the safe rect's far edge
    const cHi = t0 - s0 / zoom; // target's near edge at the safe rect's near edge
    const [zLo, zHi] = zoneRange(extent, size);
    const lo = Math.max(Math.min(cLo, cHi), zLo);
    const hi = Math.min(Math.max(cLo, cHi), zHi);
    if (lo <= hi) return clamp(centred, lo, hi);
    return clamp(centred, Math.min(cLo, cHi), Math.max(cLo, cHi));
  };
  const viewX = axis(target.x, target.w, safe.x, safe.w, zone.width, w);
  const viewY = axis(target.y, target.h, safe.y, safe.h, zone.height, h);
  const view = { viewX, viewY, zoom };
  return { ...view, ...toScroll(view, vp) };
}

/** True when a world rect is inside the safe rect under a view (with a tolerance in CSS px). */
export function rectInSafe(r: Rect, safe: SafeRect, view: CameraView, tol = 0.5): boolean {
  const a = worldToScreen(r.x, r.y, view);
  const b = worldToScreen(r.x + r.w, r.y + r.h, view);
  return a.sx >= safe.x - tol && a.sy >= safe.y - tol && b.sx <= safe.x + safe.w + tol && b.sy <= safe.y + safe.h + tol;
}

/**
 * Explore follow with an x deadzone (a fraction of the view width) and a y deadzone (design units) around the focus
 * point; returns the TARGET view (the director eases toward it with zone.camera.lerp) clamped to the zone.
 */
export function followView(view: CameraView, player: { x: number; y: number }, vp: Viewport, zone: ZoneFrame, arena?: { x0: number; x1: number } | null): CameraView {
  const { w, h } = viewSize(vp, view.zoom);
  const dz = zone.camera.xDeadzone * w;
  const bx0 = view.viewX + w / 2 - dz / 2;
  const bx1 = view.viewX + w / 2 + dz / 2;
  let viewX = view.viewX;
  if (player.x < bx0) viewX = player.x - (w / 2 - dz / 2);
  else if (player.x > bx1) viewX = player.x - (w / 2 + dz / 2);
  const dzy = Math.min(zone.camera.yDeadzone, h * 0.8);
  const by0 = view.viewY + h * FOLLOW_FOCUS_Y - dzy / 2;
  const by1 = view.viewY + h * FOLLOW_FOCUS_Y + dzy / 2;
  let viewY = view.viewY;
  if (player.y < by0) viewY = player.y - (h * FOLLOW_FOCUS_Y - dzy / 2);
  else if (player.y > by1) viewY = player.y - (h * FOLLOW_FOCUS_Y + dzy / 2);
  return clampView({ viewX, viewY, zoom: view.zoom }, vp, zone, arena);
}

/** The explore view centred on the player (zone entry, warps). */
export function centredView(player: { x: number; y: number }, vp: Viewport, zone: ZoneFrame, zoom = baseZoom(vp)): CameraView {
  const { w, h } = viewSize(vp, zoom);
  return clampView({ viewX: player.x - w / 2, viewY: player.y - h * FOLLOW_FOCUS_Y, zoom }, vp, zone);
}

/** Frame-rate independent smoothing: fraction of the way to move this frame for a per-60-fps lerp. */
export function lerpFactor(lerp: number, dtMs: number): number {
  return 1 - Math.pow(1 - clamp(lerp, 0, 1), dtMs / (1000 / 60));
}

/** Union of two rects. */
export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
