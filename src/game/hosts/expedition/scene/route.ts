/**
 * scene/route.ts (pure, H1) — the planner behind `walkTo(x, surface?)` (docs/design/20 §2.10, §0.1.5 express). A
 * surface splits into walkable components at sheer edges (ground) and unsolved blockers; links and platform ends
 * join components. A breadth-first search returns the fewest-link route as walk / link / walk-off steps, which the
 * scene executes through the same controller a player uses (never a teleport).
 */
import type { Requirement, TraversalLink } from "../../../../contracts/world";
import type { SurfaceModel } from "./surfaces";
import { heightAt, spanOf, surfaceIds, yOnLine } from "./surfaces";
import type { Blocker, SheerEdge } from "./terrain";
import { BLOCKER_MARGIN } from "./terrain";
import { isTwoWay, DROP_DRIFT } from "./traversal";

export type RouteStep =
  | { kind: "walk"; surface: string; x: number }
  | { kind: "link"; linkId: string; dir: "forward" | "reverse"; startX: number; surface: string }
  | { kind: "walk_off"; surface: string; x: number; facing: 1 | -1 };

export interface RouteCtx {
  model: SurfaceModel;
  links: readonly TraversalLink[];
  edges: readonly SheerEdge[];
  blockers: readonly Blocker[];
  reqOk: (r: Requirement | null) => boolean;
}

function barriers(ctx: RouteCtx, surface: string): number[] {
  const xs = ctx.blockers.filter((b) => b.surface === surface).map((b) => b.x);
  if (surface === "ground") for (const e of ctx.edges) xs.push((e.x0 + e.x1) / 2);
  return xs.sort((a, b) => a - b);
}
export function componentOf(ctx: RouteCtx, surface: string, x: number): number {
  return barriers(ctx, surface).filter((b) => b < x).length;
}
const nodeKey = (s: string, c: number) => `${s}#${c}`;

interface Edge {
  to: string;
  step: RouteStep;
}

/** A safe x to walk to inside a component, clear of blockers. */
function safeX(ctx: RouteCtx, surface: string, x: number): number {
  for (const b of ctx.blockers) {
    if (b.surface !== surface) continue;
    if (x > b.x - BLOCKER_MARGIN && x <= b.x) return b.x - BLOCKER_MARGIN - 1;
    if (x < b.x + BLOCKER_MARGIN && x > b.x) return b.x + BLOCKER_MARGIN + 1;
  }
  return x;
}

function edgesFrom(ctx: RouteCtx): Map<string, Edge[]> {
  const out = new Map<string, Edge[]>();
  const add = (from: string, e: Edge) => out.set(from, [...(out.get(from) ?? []), e]);
  for (const link of ctx.links) {
    if (!ctx.reqOk(link.requires)) continue;
    const dirs: ("forward" | "reverse")[] = isTwoWay(link) ? ["forward", "reverse"] : ["forward"];
    for (const dir of dirs) {
      const s = dir === "forward" ? link.from : link.to;
      const e = dir === "forward" ? link.to : link.from;
      const ss = s.surface ?? "ground";
      const es = e.surface ?? "ground";
      if (heightAt(ctx.model, ss, s.x) === null || heightAt(ctx.model, es, e.x) === null) continue;
      add(nodeKey(ss, componentOf(ctx, ss, s.x)), {
        to: nodeKey(es, componentOf(ctx, es, e.x)),
        step: { kind: "link", linkId: link.id, dir, startX: s.x, surface: ss },
      });
    }
  }
  // walking off either end of a platform lands on the surface below
  for (const id of surfaceIds(ctx.model)) {
    if (id === "ground") continue;
    const span = spanOf(ctx.model, id);
    if (!span) continue;
    for (const [endX, facing] of [
      [span[0], -1],
      [span[1], 1],
    ] as const) {
      const y = heightAt(ctx.model, id, endX) ?? 0;
      const lx = endX + DROP_DRIFT * facing;
      let best: { s: string; y: number } | null = null;
      for (const other of surfaceIds(ctx.model)) {
        if (other === id) continue;
        const line = other === "ground" ? ctx.model.ground : ctx.model.platforms.get(other);
        const yy = line ? yOnLine(line.points, lx) : null;
        if (yy !== null && yy > y && (!best || yy < best.y)) best = { s: other, y: yy };
      }
      if (!best) continue;
      add(nodeKey(id, componentOf(ctx, id, endX)), {
        to: nodeKey(best.s, componentOf(ctx, best.s, lx)),
        step: { kind: "walk_off", surface: id, x: endX, facing },
      });
    }
  }
  return out;
}

/**
 * The fewest-link route from `from` to x (on `toSurface`, or any active surface spanning x). null when unreachable.
 * The last step always walks to the target x.
 */
export function planRoute(ctx: RouteCtx, from: { surface: string; x: number }, to: { x: number; surface?: string }): RouteStep[] | null {
  const goals = new Map<string, string>(); // node -> surface
  const cands = to.surface ? [to.surface] : surfaceIds(ctx.model);
  for (const s of cands) {
    const span = spanOf(ctx.model, s);
    if (!span || to.x < span[0] || to.x > span[1]) continue;
    goals.set(nodeKey(s, componentOf(ctx, s, to.x)), s);
  }
  if (goals.size === 0) return null;
  const start = nodeKey(from.surface, componentOf(ctx, from.surface, from.x));
  const graph = edgesFrom(ctx);
  const prev = new Map<string, { node: string; step: RouteStep } | null>([[start, null]]);
  const queue = [start];
  let found: string | null = goals.has(start) ? start : null;
  while (queue.length && !found) {
    const n = queue.shift() as string;
    for (const e of graph.get(n) ?? []) {
      if (prev.has(e.to)) continue;
      prev.set(e.to, { node: n, step: e.step });
      if (goals.has(e.to)) {
        found = e.to;
        break;
      }
      queue.push(e.to);
    }
  }
  if (!found) return null;
  const hops: Exclude<RouteStep, { kind: "walk" }>[] = [];
  for (let n: string | undefined = found; n && prev.get(n); n = prev.get(n)?.node) {
    const p = prev.get(n);
    if (p && p.step.kind !== "walk") hops.unshift(p.step);
  }
  const steps: RouteStep[] = [];
  for (const h of hops) {
    if (h.kind === "link") steps.push({ kind: "walk", surface: h.surface, x: safeX(ctx, h.surface, h.startX) });
    else steps.push({ kind: "walk", surface: h.surface, x: h.x + 6 * h.facing });
    steps.push(h);
  }
  const goalSurface = goals.get(found) as string;
  steps.push({ kind: "walk", surface: goalSurface, x: safeX(ctx, goalSurface, to.x) });
  return steps;
}
