/**
 * scene/surfaces.ts (pure, H1) — the surface model (docs/design/20 §2.4.1). The player stands on exactly one surface:
 * "ground" (the zone heightfield, merged with solved payoff terrain) or an active platform. y = heightAt(surface, x).
 * Coordinates are per zone: x from the zone's left edge, y DOWN from the zone top.
 */
import type { Payoff, Station, Zone } from "../../../../contracts/world";
import type { ReqCtx } from "../../../../world/types";
import { requirementMet } from "./requirements";

export type Pt = readonly [number, number];

export interface SurfaceLine {
  id: string; // "ground" or a platform id
  kind: "ground" | "platform";
  points: readonly Pt[]; // x strictly ascending
  asset: string | null;
  /** the encounter whose payoff terrain created or reshaped this line (null: authored) */
  payoffOf: string | null;
}
export interface SurfaceModel {
  zoneId: string;
  width: number;
  height: number;
  maxStepUp: number;
  ground: SurfaceLine;
  platforms: ReadonlyMap<string, SurfaceLine>;
  /** encounter ids whose payoff terrain is merged in (for draw tweens and tests) */
  merged: readonly string[];
}

type StationLike = Pick<Station, "encounterId" | "zoneId"> & { payoff: Pick<Payoff, "terrain"> };

/** Linear interpolation on an x-ascending polyline; null outside its span. */
export function yOnLine(points: readonly Pt[], x: number): number | null {
  if (points.length === 0) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (x < first[0] || x > last[0]) return null;
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      if (x1 === x0) return y1;
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

/**
 * Replaces the base heightfield over the patch's x span with the patch polyline (a bridge across a chasm, stairs
 * rising up a cliff). Base points strictly inside the patch span are dropped; the rest are kept in order.
 */
export function mergeHeightfield(base: readonly Pt[], patch: readonly Pt[]): Pt[] {
  if (patch.length < 2) return [...base];
  const sorted = [...patch].sort((a, b) => a[0] - b[0]);
  const a = sorted[0][0];
  const b = sorted[sorted.length - 1][0];
  const out: Pt[] = [];
  for (const p of base) if (p[0] < a) out.push(p);
  for (const p of sorted) {
    const prev = out[out.length - 1];
    if (prev && p[0] <= prev[0]) continue; // keep x strictly ascending
    out.push(p);
  }
  for (const p of base) if (p[0] > b) out.push(p);
  return out;
}

/**
 * Builds the surfaces of one zone for the current progress: platforms whose `requires` hold, the ground heightfield,
 * and every solved station's payoff terrain in this zone (merged into the ground, or activating / reshaping a platform).
 */
export function buildSurfaces(zone: Zone, ctx: ReqCtx, stations: readonly StationLike[]): SurfaceModel {
  let ground: Pt[] = zone.ground.points.map((p) => [p[0], p[1]] as const);
  const platforms = new Map<string, SurfaceLine>();
  for (const p of zone.platforms) {
    if (!requirementMet(p.requires, ctx)) continue;
    platforms.set(p.id, { id: p.id, kind: "platform", points: p.points.map((q) => [q[0], q[1]] as const), asset: p.asset, payoffOf: null });
  }
  const merged: string[] = [];
  for (const st of stations) {
    if (st.zoneId !== zone.id || !ctx.solvedIds.has(st.encounterId)) continue;
    const terrain = st.payoff.terrain ?? [];
    if (terrain.length === 0) continue;
    merged.push(st.encounterId);
    for (const t of terrain) {
      const pts = t.points.map((q) => [q[0], q[1]] as const);
      if (t.surface === "ground") {
        ground = mergeHeightfield(ground, pts);
      } else {
        const authored = zone.platforms.find((p) => p.id === t.surface);
        platforms.set(t.surface, {
          id: t.surface,
          kind: "platform",
          points: [...pts].sort((a, b) => a[0] - b[0]),
          asset: authored?.asset ?? null,
          payoffOf: st.encounterId,
        });
      }
    }
  }
  return {
    zoneId: zone.id,
    width: zone.width,
    height: zone.height,
    maxStepUp: zone.ground.maxStepUp,
    ground: { id: "ground", kind: "ground", points: ground, asset: zone.ground.surface, payoffOf: null },
    platforms,
    merged,
  };
}

export function lineOf(model: SurfaceModel, surface: string): SurfaceLine | null {
  if (surface === "ground") return model.ground;
  return model.platforms.get(surface) ?? null;
}

/** y of a surface at x (null when the surface is inactive or x is outside its span). */
export function heightAt(model: SurfaceModel, surface: string, x: number): number | null {
  const line = lineOf(model, surface);
  return line ? yOnLine(line.points, x) : null;
}

/** [first x, last x] of a surface, or null when inactive. */
export function spanOf(model: SurfaceModel, surface: string): readonly [number, number] | null {
  const line = lineOf(model, surface);
  if (!line || line.points.length === 0) return null;
  return [line.points[0][0], line.points[line.points.length - 1][0]];
}

/**
 * The highest surface at or below the point (x, y) (y grows downward): what the player lands on after walking off a
 * platform end. Falls back to the ground (clamped into its span) so the player always lands somewhere.
 */
export function surfaceBelow(model: SurfaceModel, x: number, y: number): { surface: string; y: number } {
  let best: { surface: string; y: number } | null = null;
  const consider = (id: string, yy: number | null) => {
    if (yy === null || yy < y - 0.5) return;
    if (!best || yy < best.y) best = { surface: id, y: yy };
  };
  for (const [id, line] of model.platforms) consider(id, yOnLine(line.points, x));
  consider("ground", yOnLine(model.ground.points, x));
  if (best) return best;
  const span = spanOf(model, "ground") ?? [0, model.width];
  const cx = Math.min(span[1], Math.max(span[0], x));
  return { surface: "ground", y: yOnLine(model.ground.points, cx) ?? model.height };
}

/** Every active surface id ("ground" first). */
export function surfaceIds(model: SurfaceModel): string[] {
  return ["ground", ...model.platforms.keys()];
}
