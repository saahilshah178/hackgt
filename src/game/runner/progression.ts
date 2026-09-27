import type { Encounter, GameSpec } from "../../contracts/gamespec";

/**
 * Non-linear progression for the board genres (mystery, puzzle, strategy, explorer, story). The spec's encounter
 * order is the Director's teaching order; this derives, in code, a braided graph of which encounters must be solved
 * before each one unlocks, so a few encounters are open at once and the player chooses the route:
 *
 * - **tracks**: the non-boss encounters are split into 2–3 parallel tracks (one per unit when the spec has several
 *   units, otherwise alternating), and inside a track each encounter waits for the previous one. Hosts draw tracks
 *   as maze wings, story branches, villager households or board regions;
 * - **teach before practice**: a non-review encounter also waits for the most recent earlier `teach` encounter of
 *   each of its concepts, which may sit on another track (the braid's cross-links);
 * - **review** waits for the two nearest earlier non-boss encounters;
 * - the **boss** waits for everything else.
 *
 * Pure and deterministic: hosts lay out their maps, boards, days and chapters from `nodes`, `tiers` and `tracks`.
 */

export interface ProgressNode {
  id: string;
  /** position in spec.encounters (the Director's order) */
  index: number;
  encounter: Encounter;
  /** encounter ids that must be solved before this one unlocks */
  requires: string[];
  /** longest chain of requirements below this node (roots are 0); hosts use it for rings, days and chapters */
  depth: number;
  /** the track (0-based) this node belongs to; the boss is on its own track, -1 */
  track: number;
  isBoss: boolean;
}

export interface Progression {
  nodes: ProgressNode[];
  byId: ReadonlyMap<string, ProgressNode>;
  /** node ids grouped by depth, in spec order inside each tier */
  tiers: string[][];
  /** node ids per track, in spec order (the boss is in none) */
  tracks: string[][];
  bossId: string | null;
}

export const MAX_TRACKS = 3;

export function buildProgression(spec: Pick<GameSpec, "encounters"> & { concepts?: GameSpec["concepts"] }): Progression {
  const encounters = spec.encounters;
  const bossIndex = findBossIndex(encounters);
  const trackOf = assignTracks(encounters, bossIndex, spec.concepts ?? []);
  const nodes: ProgressNode[] = encounters.map((encounter, index) => ({
    id: encounter.id,
    index,
    encounter,
    requires: requirementsFor(encounters, index, bossIndex, trackOf),
    depth: 0,
    track: trackOf[index],
    isBoss: index === bossIndex,
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // requirements always point at earlier encounters, so one pass in spec order settles every depth
  for (const n of nodes) n.depth = n.requires.length === 0 ? 0 : 1 + Math.max(...n.requires.map((r) => byId.get(r)!.depth));
  const maxDepth = Math.max(0, ...nodes.map((n) => n.depth));
  const tiers: string[][] = Array.from({ length: maxDepth + 1 }, () => []);
  for (const n of nodes) tiers[n.depth].push(n.id);
  const trackCount = Math.max(0, ...trackOf) + 1;
  const tracks: string[][] = Array.from({ length: trackCount }, () => []);
  for (const n of nodes) if (n.track >= 0) tracks[n.track].push(n.id);
  return {
    nodes,
    byId,
    tiers: tiers.filter((t) => t.length > 0),
    tracks: tracks.filter((t) => t.length > 0),
    bossId: bossIndex === -1 ? null : encounters[bossIndex].id,
  };
}

/** The last encounter with role "boss", or -1. */
function findBossIndex(encounters: readonly Encounter[]): number {
  for (let i = encounters.length - 1; i >= 0; i--) if (encounters[i].role === "boss") return i;
  return -1;
}

/**
 * Track per encounter index (-1 for the boss). Several units → one track per unit (by first appearance), folded
 * into MAX_TRACKS. One unit → alternate between two tracks (three when there are nine or more encounters).
 */
function assignTracks(encounters: readonly Encounter[], bossIndex: number, concepts: GameSpec["concepts"]): number[] {
  const unitOfConcept = new Map(concepts.map((c) => [c.id, c.unitId]));
  const regular = encounters.map((_, i) => i).filter((i) => i !== bossIndex);
  const unitOrder: string[] = [];
  const unitOf = new Map<number, string>();
  for (const i of regular) {
    const u = unitOfConcept.get(encounters[i].conceptIds[0]) ?? "";
    unitOf.set(i, u);
    if (!unitOrder.includes(u)) unitOrder.push(u);
  }
  const out = encounters.map(() => -1);
  if (regular.length <= 2) {
    for (const i of regular) out[i] = 0;
    return out;
  }
  if (unitOrder.length >= 2) {
    const k = Math.min(MAX_TRACKS, unitOrder.length);
    for (const i of regular) out[i] = unitOrder.indexOf(unitOf.get(i)!) % k;
    return out;
  }
  const k = regular.length >= 9 ? 3 : 2;
  regular.forEach((i, n) => (out[i] = n % k));
  return out;
}

function requirementsFor(encounters: readonly Encounter[], index: number, bossIndex: number, trackOf: readonly number[]): string[] {
  const e = encounters[index];
  if (index === bossIndex) return encounters.filter((_, i) => i !== index).map((x) => x.id);
  const req = new Set<string>();
  // the previous encounter on the same track
  for (let i = index - 1; i >= 0; i--) {
    if (i !== bossIndex && trackOf[i] === trackOf[index]) {
      req.add(encounters[i].id);
      break;
    }
  }
  if (e.role === "review") {
    let found = 0;
    for (let i = index - 1; i >= 0 && found < 2; i--) {
      if (i === bossIndex) continue;
      req.add(encounters[i].id);
      found++;
    }
  } else {
    for (const c of e.conceptIds) {
      for (let i = index - 1; i >= 0; i--) {
        const prev = encounters[i];
        if (i !== bossIndex && prev.role === "teach" && prev.conceptIds.includes(c)) {
          req.add(prev.id);
          break;
        }
      }
    }
  }
  return encounters.filter((x) => req.has(x.id)).map((x) => x.id);
}

/** Unsolved encounters whose requirements are all solved, in spec order. */
export function unlockedIds(p: Progression, solved: ReadonlySet<string>): string[] {
  return p.nodes.filter((n) => !solved.has(n.id) && n.requires.every((r) => solved.has(r))).map((n) => n.id);
}

/** Every requirement of `id`, transitively (not including `id`), in spec order. */
export function prerequisitesOf(p: Progression, id: string): string[] {
  const out = new Set<string>();
  const stack = [...(p.byId.get(id)?.requires ?? [])];
  while (stack.length > 0) {
    const r = stack.pop()!;
    if (out.has(r)) continue;
    out.add(r);
    stack.push(...(p.byId.get(r)?.requires ?? []));
  }
  return p.nodes.filter((n) => out.has(n.id)).map((n) => n.id);
}
