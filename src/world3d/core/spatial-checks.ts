import type { Issue } from "../../contracts/common";
import type { GameSpec } from "../../contracts/gamespec";
import { INTERACT_MARGIN, LANDMARK_GAP, NPC_REACH, STRUCTURES } from "./catalog";
import type { ComposedWorld, Placed } from "./compose";
import { reachableNear } from "./navgrid";

/*
 * Spatial rules for a composed world (docs/design/60 §2.1): everything the player must visit is reachable on foot from
 * the spawn, the goal is visible from the spawn, nothing important stands in water or on a cliff, landmarks keep their
 * spacing, and the walking the story asks for fits the game's length. Issues are owned by the World Architect and become
 * repair notes; warnings are reported to the critics but never block.
 */

/** Jogging pace (m/s) used for the travel budget; the controller jogs at 5.5 and sprints at 9. */
export const JOG_SPEED = 5.5;

export interface SpatialReport {
  issues: Issue[];
  warnings: Issue[];
  stats: {
    goalVisibleFromSpawn: boolean;
    /** straight-line metres from the spawn to every anchor, in act order */
    anchorDistances: { encounterId: string; anchor: string; metres: number; reachable: boolean }[];
    /** a greedy walk spawn → every anchor in act order → goal, in metres and minutes at jogging pace */
    tourMetres: number;
    tourMinutes: number;
    reachablePercent: number;
    minLandmarkGap: number;
  };
}

/** Line of sight from an eye point to a target point over the heightfield (terrain only; structures don't occlude). */
export function lineOfSight(c: ComposedWorld, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): boolean {
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(8, Math.ceil(d / (c.hf.cell * 0.75)));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    const y = from.y + (to.y - from.y) * t;
    if (c.hf.height(x, z) > y + 0.25) return false;
  }
  return true;
}

export function anchorPoint(c: ComposedWorld, anchor: { npcId: string | null; landmarkId: string | null }): { x: number; z: number; reach: number; label: string } | null {
  if (anchor.npcId) {
    const n = c.npcs.find((a) => a.id === anchor.npcId);
    return n ? { x: n.x, z: n.z, reach: NPC_REACH + 1, label: `npc ${n.id}` } : null;
  }
  if (anchor.landmarkId) {
    const l = c.landmarks.find((p) => p.id === anchor.landmarkId);
    return l ? { x: l.x, z: l.z, reach: l.radius + INTERACT_MARGIN, label: `landmark ${l.id}` } : null;
  }
  return null;
}

export function spatialChecks(spec: Pick<GameSpec, "encounters" | "targetMinutes">, c: ComposedWorld): SpatialReport {
  const issues: Issue[] = [];
  const warnings: Issue[] = [];
  const add = (path: (string | number)[], message: string, encounterId?: string) =>
    issues.push({ path: ["world3d", ...path], message, owner: "world_architect", ...(encounterId ? { encounterId } : {}) });
  const warn = (path: (string | number)[], message: string) => warnings.push({ path: ["world3d", ...path], message, owner: "world_architect" });
  const w = c.world;
  const reachable = (x: number, z: number, reach: number) => reachableNear(c.nav, c.reachable, x, z, reach);

  // ---- the spawn itself must be open ground
  const spawnCells = c.reachable.reduce((a, b) => a + b, 0);
  const walkCells = c.nav.walk.reduce((a, b) => a + b, 0);
  if (spawnCells < 50) add(["spawn"], "the spawn point is boxed in: almost nothing is reachable from it; move it to open ground near the hub");

  // ---- moments: anchors reachable
  const byId = new Map(spec.encounters.map((e, i) => [e.id, i] as const));
  const order = w.quest.acts.flatMap((a) => a.encounterIds).filter((id) => byId.has(id));
  const anchorDistances: SpatialReport["stats"]["anchorDistances"] = [];
  w.moments.forEach((m, i) => {
    const a = anchorPoint(c, m.anchor);
    if (!a) return; // referential validation reports unknown anchors
    const ok = reachable(a.x, a.z, a.reach);
    anchorDistances.push({ encounterId: m.encounterId, anchor: a.label, metres: Math.round(Math.hypot(a.x - c.spawn.x, a.z - c.spawn.z)), reachable: ok });
    if (!ok) add(["moments", i, "anchor"], `the player cannot walk to ${a.label} (water, cliffs or buildings cut it off); move it or add a bridge or path`, m.encounterId);
  });
  anchorDistances.sort((a, b) => order.indexOf(a.encounterId) - order.indexOf(b.encounterId));

  // ---- npcs and collectibles reachable (npcs are story; unreachable collectibles are only annoying)
  c.npcs.forEach((n, i) => reachable(n.x, n.z, NPC_REACH + 1) || add(["npcs", i, "at"], `npc "${n.id}" stands where the player cannot reach`));
  c.collectibles.forEach((col, i) => reachable(col.x, col.z, 2.5) || warn(["collectibles", "items", i, "at"], `collectible "${col.id}" cannot be reached on foot`));

  // ---- the goal: reachable and visible from the spawn
  let goalVisible = false;
  if (c.goal) {
    const g = c.goal;
    if (!reachable(g.x, g.z, g.radius + INTERACT_MARGIN)) add(["quest", "goal"], `the goal "${g.id}" cannot be reached on foot from the spawn`);
    const eye = { x: c.spawn.x, y: c.spawn.y + 1.7, z: c.spawn.z };
    const targets = [0.95, 0.75, 0.5].map((f) => ({ x: g.x, y: g.y + g.height * f, z: g.z }));
    goalVisible = targets.some((t) => lineOfSight(c, eye, t));
    if (!goalVisible)
      add(["spawn", "at"], `the goal "${g.id}" is hidden behind terrain from the spawn; move the spawn (or the goal) so the player sees where they are headed, or raise the goal's scale`);
    const dist = Math.hypot(g.x - c.spawn.x, g.z - c.spawn.z);
    if (dist < w.terrain.size * 0.18) warn(["spawn", "at"], `the goal is only ${Math.round(dist)} m from the spawn; the journey will feel short`);
  }

  // ---- things standing in water or on cliffs
  const checkPlaced = (p: Placed, path: (string | number)[]) => {
    const placement = STRUCTURES[p.kind].placement;
    if (placement === "land") {
      const depth = c.hf.waterDepth(p.x, p.z);
      if (depth > 0.3) add(path, `landmark "${p.id}" stands in ${depth.toFixed(1)} m of water; move it onto dry land`);
    }
  };
  c.landmarks.forEach((p) => {
    const i = w.landmarks.findIndex((l) => l.id === p.id);
    if (i >= 0) checkPlaced(p, ["landmarks", i, "at"]);
  });

  // ---- landmark spacing (the composer nudges; what's left is a real crowding problem)
  let minGap = Infinity;
  const land = c.landmarks.filter((p) => STRUCTURES[p.kind].placement === "land");
  for (let a = 0; a < land.length; a++) {
    for (let b = a + 1; b < land.length; b++) {
      const gap = Math.hypot(land[a].x - land[b].x, land[a].z - land[b].z) - land[a].radius - land[b].radius;
      minGap = Math.min(minGap, gap);
      if (gap < 0) {
        const i = w.landmarks.findIndex((l) => l.id === land[b].id);
        add(["landmarks", Math.max(0, i), "at"], `landmarks "${land[a].id}" and "${land[b].id}" overlap by ${Math.round(-gap)} m`);
      } else if (gap < LANDMARK_GAP / 2) warn(["landmarks"], `"${land[a].id}" and "${land[b].id}" are crowded (${gap.toFixed(1)} m apart)`);
    }
  }

  // ---- travel budget: the walk the story asks for vs. the game's length
  let tour = 0;
  let at = { x: c.spawn.x, z: c.spawn.z };
  for (const d of anchorDistances) {
    const m = w.moments.find((x) => x.encounterId === d.encounterId);
    const a = m ? anchorPoint(c, m.anchor) : null;
    if (!a) continue;
    tour += Math.hypot(a.x - at.x, a.z - at.z) * 1.25; // paths wind
    at = { x: a.x, z: a.z };
  }
  const tourMinutes = tour / JOG_SPEED / 60;
  const budget = spec.targetMinutes * 0.4;
  if (tourMinutes > budget)
    add(["moments"], `walking between the moments takes about ${tourMinutes.toFixed(1)} min, more than 40% of a ${spec.targetMinutes}-minute game; cluster the moments closer or reorder the acts so the route doesn't zig-zag`);
  else if (tourMinutes < spec.targetMinutes * 0.06 && w.moments.length > 3) warn(["moments"], `the moments are packed within ${Math.round(tour)} m; spread them out so the world gets explored`);

  // ---- clusters and scatter sanity
  if (c.paths.length === 0 && w.paths.length > 0) warn(["paths"], "none of the paths could be routed over the terrain");
  const dropped = c.fixes.filter((f) => f.includes("no walkable route"));
  dropped.forEach((f) => warn(["paths"], f));

  return {
    issues,
    warnings,
    stats: {
      goalVisibleFromSpawn: goalVisible,
      anchorDistances,
      tourMetres: Math.round(tour),
      tourMinutes: Math.round(tourMinutes * 10) / 10,
      reachablePercent: walkCells > 0 ? Math.round((100 * spawnCells) / walkCells) : 0,
      minLandmarkGap: Number.isFinite(minGap) ? Math.round(minGap * 10) / 10 : 0,
    },
  };
}
