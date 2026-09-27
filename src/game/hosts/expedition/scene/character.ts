/**
 * scene/character.ts (pure, H1) — the character controller both render paths share (docs/design/20 §2.4.1–§2.4.2):
 * walk at 300 units/s, Shift runs at 460 (unless the segment disables running), 90 ms acceleration; walls, sheer
 * edges and blockers stop the walk; walking off a platform end drops to the surface below; Space / W / S run the
 * nearest matching link in range (or a cosmetic hop); an active path (arc) owns the position until it lands.
 */
import type { Requirement, TraversalLink } from "../../../../contracts/world";
import type { Motion } from "../actors/pose-animator";
import { locomotion } from "../actors/pose-animator";
import type { SurfaceModel } from "./surfaces";
import { heightAt } from "./surfaces";
import type { Blocker, SheerEdge } from "./terrain";
import { clampX } from "./terrain";
import type { LinkChoice, LinkKey, TraversalPath } from "./traversal";
import { cosmeticHop, edgeDrop, linksInRange, pickLink, planLink } from "./traversal";

export const WALK_SPEED = 300;
export const RUN_SPEED = 460;
export const ACCEL_SEC = 0.09;
export const LAND_SQUASH_SEC = 0.1;

export interface CharState {
  x: number;
  y: number;
  surface: string;
  facing: 1 | -1;
  vx: number;
  path: TraversalPath | null;
  pathT: number; // seconds into the path
  motion: Motion;
  squash: number; // seconds of landing squash left
}
export interface CharInput {
  left: boolean;
  right: boolean;
  run: boolean;
  /** edge-triggered this frame */
  hop: boolean;
  up: boolean;
  down: boolean;
  interact: boolean;
  /** synthetic walks (walkTo): never pass this x; arriving zeroes the velocity */
  stopAt?: number;
}
export const NO_INPUT: CharInput = { left: false, right: false, run: false, hop: false, up: false, down: false, interact: false };

export interface CharCtx {
  model: SurfaceModel;
  edges: readonly SheerEdge[];
  blockers: readonly Blocker[];
  links: readonly TraversalLink[];
  reqOk: (r: Requirement | null) => boolean;
  tSec: number; // zone clock (timed hops)
  runEnabled: boolean;
  speedScale: number; // 2 in express walkTo
  /** a timed hop's driver prop top 0.35 s after the press, if it has one */
  driverTop?: (linkId: string) => { x: number; y: number } | null;
  /** movement keys are ignored (frozen) — active paths still complete */
  frozen: boolean;
  /** Clockwork Crypt: the hop key tries a hop, then a climb, then a cosmetic hop. Other games keep Space as hop only. */
  cryptControls?: boolean;
}
export type CharEvent =
  | { type: "link_used"; linkId: string; landed: "to" | "missTo" }
  | { type: "landed"; surface: string }
  | { type: "blocked"; reason: "edge" | "blocker" | "bounds" }
  | { type: "hop"; cosmetic: boolean }
  | { type: "path_start"; kind: TraversalPath["kind"]; linkId: string | null };

export function spawn(model: SurfaceModel, x: number, surface: string): CharState {
  const y = heightAt(model, surface, x) ?? heightAt(model, "ground", x) ?? model.height;
  const s = heightAt(model, surface, x) === null ? "ground" : surface;
  return { x, y, surface: s, facing: 1, vx: 0, path: null, pathT: 0, motion: "idle", squash: 0 };
}

/** Starts a path (link, cosmetic hop, edge drop) from the current state. */
export function startPath(s: CharState, path: TraversalPath): CharState {
  const end = path.at(1);
  const facing: 1 | -1 = end.x > s.x + 0.5 ? 1 : end.x < s.x - 0.5 ? -1 : s.facing;
  return { ...s, path, pathT: 0, vx: 0, facing };
}

/** The link a key would run now (null: none in range). */
export function linkForKey(s: CharState, key: LinkKey, ctx: CharCtx): LinkChoice | null {
  return pickLink(linksInRange(ctx.links, { x: s.x, surface: s.surface }, { model: ctx.model, reqOk: ctx.reqOk }), key);
}

export function planChoice(choice: LinkChoice, ctx: CharCtx): TraversalPath {
  return planLink(choice, ctx.model, { tSec: ctx.tSec, driverTop: ctx.driverTop?.(choice.link.id) ?? null });
}

function pathMotion(frame: ReturnType<TraversalPath["at"]>["frame"]): Motion {
  return frame === "ride" ? "ride" : frame;
}

/** One frame of the character controller. */
export function stepCharacter(s0: CharState, input: CharInput, ctx: CharCtx, dtSec: number): { state: CharState; events: CharEvent[] } {
  const events: CharEvent[] = [];
  let s: CharState = { ...s0, squash: Math.max(0, s0.squash - dtSec) };
  const dt = Math.max(0, Math.min(0.1, dtSec));

  // ---- an active arc owns the position
  if (s.path) {
    const path = s.path;
    const t = s.pathT + dt;
    const u = path.duration > 0 ? Math.min(1, t / path.duration) : 1;
    const p = path.at(u);
    if (u < 1) return { state: { ...s, x: p.x, y: p.y, pathT: t, motion: pathMotion(p.frame) }, events };
    const y = heightAt(ctx.model, path.endSurface, path.endX) ?? p.y;
    s = { ...s, x: path.endX, y, surface: path.endSurface, path: null, pathT: 0, motion: "idle", squash: path.kind === "ride" ? 0 : LAND_SQUASH_SEC };
    events.push({ type: "landed", surface: path.endSurface });
    if (path.linkId) events.push({ type: "link_used", linkId: path.linkId, landed: path.landed ?? "to" });
    return { state: s, events };
  }

  // ---- traversal keys
  if (!ctx.frozen) {
    if (ctx.cryptControls && input.hop) {
      const start = (key: LinkKey) => {
        const choice = linkForKey(s, key, ctx);
        if (!choice) return null;
        const path = planChoice(choice, ctx);
        events.push({ type: "path_start", kind: path.kind, linkId: path.linkId });
        if (path.kind === "hop" || path.kind === "timed_hop") events.push({ type: "hop", cosmetic: false });
        return { state: startPath(s, path), events };
      };
      const taken = start("space") ?? start("up");
      if (taken) return taken;
      events.push({ type: "hop", cosmetic: true });
      return { state: startPath(s, cosmeticHop({ x: s.x, y: s.y }, s.surface)), events };
    }
    for (const key of ["hop", "up", "down", "interact"] as const) {
      if (!input[key]) continue;
      const lk: LinkKey = key === "hop" ? "space" : key;
      const choice = linkForKey(s, lk, ctx);
      if (choice) {
        const path = planChoice(choice, ctx);
        events.push({ type: "path_start", kind: path.kind, linkId: path.linkId });
        if (path.kind === "hop" || path.kind === "timed_hop") events.push({ type: "hop", cosmetic: false });
        return { state: startPath(s, path), events };
      }
      if (key === "hop") {
        events.push({ type: "hop", cosmetic: true });
        return { state: startPath(s, cosmeticHop({ x: s.x, y: s.y }, s.surface)), events };
      }
    }
  }

  // ---- walking
  const dir = ctx.frozen ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const speed = (input.run && ctx.runEnabled ? RUN_SPEED : WALK_SPEED) * ctx.speedScale;
  const target = dir * speed;
  const vx = s.vx + (target - s.vx) * Math.min(1, dt / ACCEL_SEC);
  const facing: 1 | -1 = dir !== 0 ? (dir > 0 ? 1 : -1) : s.facing;
  let want = s.x + vx * dt;
  let arrived = false;
  if (input.stopAt !== undefined && ((vx > 0 && want >= input.stopAt) || (vx < 0 && want <= input.stopAt))) {
    want = input.stopAt;
    arrived = true;
  }
  const r = clampX({ x0: s.x, x1: want, surface: s.surface, model: ctx.model, edges: ctx.edges, blockers: ctx.blockers });
  let x = r.x;
  let v = arrived ? 0 : vx;
  if (r.reason) {
    v = 0;
    if (dir !== 0) events.push({ type: "blocked", reason: r.reason });
  }
  const y = heightAt(ctx.model, s.surface, x);
  if (y === null) {
    // walked off a platform end: drop to the surface below
    const drop = edgeDrop({ x: s.x, y: s.y }, facing, ctx.model);
    events.push({ type: "path_start", kind: drop.kind, linkId: null });
    return { state: startPath({ ...s, facing }, drop), events };
  }
  if (Math.abs(v) < 1 && dir === 0) {
    v = 0;
    x = s.x;
  }
  return { state: { ...s, x, y, vx: v, facing, motion: locomotion(v) }, events };
}

/** Synthetic input that walks toward x (walkTo): full speed, then eases in so it never overshoots. */
export function inputToward(s: CharState, x: number, tol = 4): CharInput | null {
  const d = x - s.x;
  if (Math.abs(d) <= tol) return null;
  return { ...NO_INPUT, left: d < 0, right: d > 0, stopAt: x };
}
