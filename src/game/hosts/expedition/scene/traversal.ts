/**
 * scene/traversal.ts (pure, H1) — authored traversal (docs/design/20 §2.4.2, amendment 2). No physics engine and no
 * randomness: a link is chosen by key from the links in range (70 units of an end on the player's surface), and moves
 * the player along a scripted arc. `useLink(id)` runs exactly the same path as the key press.
 */
import type { LinkEnd, Requirement, TraversalLink } from "../../../../contracts/world";
import type { LinkVerb } from "../../types";
import type { SurfaceModel } from "./surfaces";
import { heightAt, lineOf, yOnLine } from "./surfaces";

export const LINK_RANGE = 70;
export const CLIMB_SPEED = 220; // units / s
export const DROP_GRAVITY = 1800; // units / s²
export const DROP_DRIFT = 40;
export const COSMETIC_APEX = 51;
export const COSMETIC_SEC = 0.36;
export const TIMED_DRIVER_LEAD_SEC = 0.35;

export type LinkKey = "space" | "up" | "down" | "interact";
export type ArcFrame = "jump" | "fall" | "climb" | "idle" | "ride";
export interface ArcSample {
  x: number;
  y: number;
  frame: ArcFrame;
}
export interface TraversalPath {
  kind: LinkVerb | "cosmetic" | "edge_drop";
  linkId: string | null;
  duration: number; // seconds
  at(u: number): ArcSample; // u ∈ [0, 1]
  endSurface: string;
  endX: number;
  landed: "to" | "missTo" | null;
}
export interface LinkChoice {
  link: TraversalLink;
  dir: "forward" | "reverse";
  start: { surface: string; x: number };
  end: { surface: string; x: number };
  distance: number;
  verb: LinkVerb;
  key: LinkKey;
}
export interface LinkCtx {
  model: SurfaceModel;
  reqOk: (req: Requirement | null) => boolean;
}

const surf = (e: LinkEnd) => e.surface ?? "ground";
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));

export function isTwoWay(link: TraversalLink): boolean {
  return "twoWay" in link ? link.twoWay : false;
}

/** The key that runs a link in a direction: Space hops, W goes up (or boards), S goes down (§2.4.2, §3.5). */
export function keyForLink(link: TraversalLink, startY: number, endY: number): LinkKey {
  switch (link.kind) {
    case "hop":
    case "timed_hop":
      return "space";
    case "drop":
      return "down";
    case "ride":
      return "up";
    case "climb":
    case "ladder":
      return endY < startY ? "up" : "down";
  }
}

/** Links whose start (from, or to for two-way links) is within `range` on the player's surface, nearest first. */
export function linksInRange(
  links: readonly TraversalLink[],
  pos: { x: number; surface: string },
  ctx: LinkCtx,
  range = LINK_RANGE,
): LinkChoice[] {
  const out: LinkChoice[] = [];
  for (const link of links) {
    if (!ctx.reqOk(link.requires)) continue;
    const ends: ("forward" | "reverse")[] = isTwoWay(link) ? ["forward", "reverse"] : ["forward"];
    for (const dir of ends) {
      const s = dir === "forward" ? link.from : link.to;
      const e = dir === "forward" ? link.to : link.from;
      if (surf(s) !== pos.surface) continue;
      const d = Math.abs(s.x - pos.x);
      if (d > range) continue;
      const sy = heightAt(ctx.model, surf(s), s.x);
      const ey = heightAt(ctx.model, surf(e), e.x);
      if (sy === null || ey === null) continue; // an end on an inactive platform
      // the same surface id can hold both levels of a sheer edge ("ground" above and below a cliff): the start must be
      // on the player's level, not across the edge
      const py = heightAt(ctx.model, pos.surface, pos.x);
      if (py !== null && Math.abs(py - sy) > ctx.model.maxStepUp) continue;
      out.push({
        link,
        dir,
        start: { surface: surf(s), x: s.x },
        end: { surface: surf(e), x: e.x },
        distance: d,
        verb: link.kind,
        key: keyForLink(link, sy, ey),
      });
    }
  }
  return out.sort((a, b) => a.distance - b.distance);
}

/** The nearest link a key runs ("interact" boards rides). */
export function pickLink(choices: readonly LinkChoice[], key: LinkKey): LinkChoice | null {
  return choices.find((c) => c.key === key || (key === "interact" && c.verb === "ride")) ?? null;
}

/** Prompt text for the interact glyph (§2.4.2). */
export function linkPrompt(c: Pick<LinkChoice, "verb" | "key">): string {
  switch (c.verb) {
    case "hop":
    case "timed_hop":
      return "Space · Hop";
    case "drop":
      return "S · Drop";
    case "ride":
      return "E · Board";
    case "climb":
      return c.key === "up" ? "W · Climb" : "S · Climb down";
    case "ladder":
      return c.key === "up" ? "W · Ladder up" : "S · Ladder down";
  }
}

// ---------------------------------------------------------------- arcs

export function hopDuration(dx: number): number {
  return Math.min(0.9, Math.max(0.38, 0.38 + 0.0004 * Math.abs(dx)));
}

/** x(u) = x0 + Δx·u; y(u) = (1−u)·y0 + u·y1 − h·4u(1−u), h = apex + |y0 − y1| / 2. */
export function hopArc(p0: { x: number; y: number }, p1: { x: number; y: number }, apex: number): Omit<TraversalPath, "kind" | "linkId" | "endSurface" | "endX" | "landed"> {
  const h = apex + Math.abs(p0.y - p1.y) / 2;
  const dx = p1.x - p0.x;
  return {
    duration: hopDuration(dx),
    at(u) {
      const t = clamp01(u);
      const y = (1 - t) * p0.y + t * p1.y - h * 4 * t * (1 - t);
      // descending once past the apex of the parabola
      const dy = p1.y - p0.y - h * 4 * (1 - 2 * t);
      return { x: p0.x + dx * t, y, frame: dy > 0 ? "fall" : "jump" };
    },
  };
}

/** y(u) = y0 + (y1 − y0)·u², x eases toward x1; duration sqrt(2·Δy / 1800). */
export function dropArc(p0: { x: number; y: number }, p1: { x: number; y: number }): Omit<TraversalPath, "kind" | "linkId" | "endSurface" | "endX" | "landed"> {
  const dy = Math.max(1, p1.y - p0.y);
  return {
    duration: Math.max(0.18, Math.sqrt((2 * dy) / DROP_GRAVITY)),
    at(u) {
      const t = clamp01(u);
      return { x: p0.x + (p1.x - p0.x) * (1 - (1 - t) * (1 - t)), y: p0.y + (p1.y - p0.y) * t * t, frame: "fall" };
    },
  };
}

/** Straight segment at 220 units/s (climb and ladder). */
export function climbPath(p0: { x: number; y: number }, p1: { x: number; y: number }, speed = CLIMB_SPEED): Omit<TraversalPath, "kind" | "linkId" | "endSurface" | "endX" | "landed"> {
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  return {
    duration: Math.max(0.2, len / speed),
    at(u) {
      const t = clamp01(u);
      return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t, frame: t >= 1 ? "idle" : "climb" };
    },
  };
}

/** Cycle fraction c(t) = frac(t / periodSec + phase). */
export function cycleFraction(periodSec: number, phase: number, tSec: number): number {
  const c = tSec / periodSec + phase;
  return c - Math.floor(c);
}
/** True when a press now would land (open[0] ≤ c < open[1]). */
export function timedHopOpen(link: Extract<TraversalLink, { kind: "timed_hop" }>, tSec: number): boolean {
  const c = cycleFraction(link.periodSec, link.phase, tSec);
  const [a, b] = link.open;
  return a <= b ? c >= a && c < b : c >= a || c < b;
}
/** The driver prop's x offset: amplitude · sin(2π(t / periodSec + phase)). */
export function driverOffset(link: Extract<TraversalLink, { kind: "timed_hop" }>, tSec: number): number {
  return link.amplitude * Math.sin(2 * Math.PI * (tSec / link.periodSec + link.phase));
}

/** Point at arc-length fraction u along a polyline. */
export function polyAt(path: readonly (readonly [number, number])[], u: number): { x: number; y: number } {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return { x: path[0][0], y: path[0][1] };
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    lens.push(l);
    total += l;
  }
  let d = clamp01(u) * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] === 0 ? 1 : Math.min(1, d / lens[i]);
      return { x: path[i][0] + (path[i + 1][0] - path[i][0]) * f, y: path[i][1] + (path[i + 1][1] - path[i][1]) * f };
    }
    d -= lens[i];
  }
  const last = path[path.length - 1];
  return { x: last[0], y: last[1] };
}
const easeInOutSine = (u: number) => -(Math.cos(Math.PI * clamp01(u)) - 1) / 2;

/** The vehicle tweens along `path` over ms (ease in-out sine); the player stands on its top. */
export function ridePath(path: readonly (readonly [number, number])[], ms: number): Omit<TraversalPath, "kind" | "linkId" | "endSurface" | "endX" | "landed"> {
  return {
    duration: Math.max(0.3, ms / 1000),
    at(u) {
      const p = polyAt(path, easeInOutSine(u));
      return { x: p.x, y: p.y, frame: "ride" };
    },
  };
}

/** Space with no link in range: apex 51, 0.36 s, never changes surface. */
export function cosmeticHop(p0: { x: number; y: number }, surface: string): TraversalPath {
  return {
    kind: "cosmetic",
    linkId: null,
    duration: COSMETIC_SEC,
    at(u) {
      const t = clamp01(u);
      return { x: p0.x, y: p0.y - COSMETIC_APEX * 4 * t * (1 - t), frame: t < 0.5 ? "jump" : "fall" };
    },
    endSurface: surface,
    endX: p0.x,
    landed: null,
  };
}

/** Walking off a platform end: the drop arc with a 40-unit drift in the facing direction. */
export function edgeDrop(p0: { x: number; y: number }, facing: 1 | -1, model: SurfaceModel): TraversalPath {
  const tx = p0.x + DROP_DRIFT * facing;
  const below = landingBelow(model, tx, p0.y);
  const arc = dropArc(p0, { x: tx, y: below.y });
  return { kind: "edge_drop", linkId: null, ...arc, endSurface: below.surface, endX: tx, landed: null };
}

function landingBelow(model: SurfaceModel, x: number, y: number): { surface: string; y: number } {
  let best: { surface: string; y: number } | null = null;
  for (const [id, line] of model.platforms) {
    const yy = yOnLine(line.points, x);
    if (yy !== null && yy >= y + 1 && (!best || yy < best.y)) best = { surface: id, y: yy };
  }
  const gy = yOnLine(lineOf(model, "ground")?.points ?? [], x);
  if (gy !== null && (!best || gy < best.y)) best = { surface: "ground", y: gy };
  return best ?? { surface: "ground", y: model.height };
}

export interface PlanOpts {
  tSec: number; // the zone clock (timed hops)
  /** the driver prop's top (world units) 0.35 s after the press, when the link has a driver */
  driverTop?: { x: number; y: number } | null;
}
/** The path a chosen link produces (timed hops evaluate their window at the press). */
export function planLink(choice: LinkChoice, model: SurfaceModel, opts: PlanOpts): TraversalPath {
  const { link, start, end } = choice;
  const y0 = heightAt(model, start.surface, start.x) ?? 0;
  const y1 = heightAt(model, end.surface, end.x) ?? 0;
  const p0 = { x: start.x, y: y0 };
  const p1 = { x: end.x, y: y1 };
  const base = { linkId: link.id, endSurface: end.surface, endX: end.x, landed: "to" as const };
  switch (link.kind) {
    case "hop":
      return { kind: "hop", ...base, ...hopArc(p0, p1, link.apex) };
    case "climb":
      return { kind: "climb", ...base, ...climbPath(p0, p1) };
    case "ladder":
      return { kind: "ladder", ...base, ...climbPath(p0, p1) };
    case "drop":
      return { kind: "drop", ...base, ...dropArc(p0, p1) };
    case "ride": {
      const pts = choice.dir === "forward" ? link.path : [...link.path].reverse();
      const full: (readonly [number, number])[] = [[p0.x, p0.y], ...pts, [p1.x, p1.y]];
      return { kind: "ride", ...base, ...ridePath(full, link.ms) };
    }
    case "timed_hop": {
      if (!timedHopOpen(link, opts.tSec)) {
        const m = { surface: surf(link.missTo), x: link.missTo.x };
        const ym = heightAt(model, m.surface, m.x) ?? y0;
        return { kind: "timed_hop", linkId: link.id, endSurface: m.surface, endX: m.x, landed: "missTo", ...hopArc(p0, { x: m.x, y: ym }, 80) };
      }
      const mid = opts.driverTop ?? null;
      if (!mid) return { kind: "timed_hop", ...base, ...hopArc(p0, p1, 90) };
      const a = hopArc(p0, mid, 70);
      const b = hopArc(mid, p1, 70);
      const total = a.duration + b.duration;
      const split = a.duration / total;
      return {
        kind: "timed_hop",
        ...base,
        duration: total,
        at(u) {
          const t = clamp01(u);
          return t < split ? a.at(t / split) : b.at((t - split) / (1 - split));
        },
      };
    }
  }
}
