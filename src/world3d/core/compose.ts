import type {
  ArchStyle,
  LandmarkRole,
  Material,
  PathStyle,
  ScatterKind,
  StructureKind,
  WildlifeKind,
  World3D,
} from "../../contracts/world3d";
import { BIOMES } from "./biomes";
import { BIOME_SCATTER, CLUSTERS, LANDMARK_GAP, SCATTER, SCATTER_CAP, STRUCTURES, WILDLIFE } from "./catalog";
import { buildHeightfield, distanceToPolyline, smoothPolyline, type Heightfield, type Pad, type PathRoute } from "./heightfield";
import { buildNavGrid, findRoute, floodFrom, type Circle, type Deck, type NavGrid } from "./navgrid";
import { clamp, smoothstep } from "./noise";
import { hashString, range, subRng, type Rng } from "./prng";

/*
 * The composer: World3D (what the Architect wrote) → ComposedWorld (what the renderer draws and the checks reason
 * about). It snaps every placement to sensible ground, expands clusters into pieces, routes paths (adding a bridge when
 * a river is in the way), flattens pads, and scatters vegetation, all deterministically from the seed.
 *
 * Every automatic correction is recorded in `fixes` (and applied to the returned copy of the world), so the pipeline can
 * store the corrected world and tell the Architect what it changed. Rotation: radians of yaw, 0 = facing +z (south),
 * matching three.js `rotation.y` (local +z maps to (sin θ, 0, cos θ)).
 */

export type Quality = "low" | "medium" | "high";

export interface Placed {
  /** landmark id, or `<clusterId>_<n>` for a cluster piece */
  id: string;
  kind: StructureKind;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  /** footprint radius and rough height at this scale */
  radius: number;
  height: number;
  material: Material;
  style: ArchStyle;
  role: LandmarkRole | "piece";
  name: string | null;
  clusterId: string | null;
  /** per-piece variation seed for the builder */
  seed: number;
}

export interface Special {
  kind: "fields" | "quarry";
  id: string;
  x: number;
  y: number;
  z: number;
  /** fields: half extents of the patch; quarry: radius in both */
  halfW: number;
  halfD: number;
  rotation: number;
  seed: number;
}

export interface ScatterBatch {
  kind: ScatterKind;
  count: number;
  /** stride 5: x, y, z, yaw, scale */
  data: Float32Array;
}

export interface ComposedPath {
  from: string;
  to: string;
  style: PathStyle;
  width: number;
  points: { x: number; y: number; z: number }[];
}

export interface ComposedActor {
  id: string;
  x: number;
  y: number;
  z: number;
  /** yaw in radians */
  facing: number;
}

export interface ComposedWildlife {
  kind: WildlifeKind;
  count: number;
  x: number;
  z: number;
  radius: number;
}

export interface ComposedWorld {
  /** the world with every fix applied (snapped positions, added bridges) */
  world: World3D;
  hf: Heightfield;
  landmarks: Placed[];
  pieces: Placed[];
  specials: Special[];
  decks: Deck[];
  paths: ComposedPath[];
  scatter: ScatterBatch[];
  npcs: ComposedActor[];
  collectibles: ComposedActor[];
  wildlife: ComposedWildlife[];
  spawn: ComposedActor;
  goal: Placed | null;
  /** res × res coverage masks (0..255) for the terrain splat */
  pathMask: Uint8Array;
  fieldMask: Uint8Array;
  nav: NavGrid;
  /** nav cells reachable on foot from the spawn */
  reachable: Uint8Array;
  fixes: string[];
}

export const PATH_WIDTH: Record<PathStyle, number> = { dirt: 3.2, stone: 4, sand: 3.6, grass: 2.6, boardwalk: 2.4 };
const WALK_THROUGH: ReadonlySet<ScatterKind> = new Set(["tall_grass", "flowers", "reeds", "crop", "mushroom", "coral", "bush", "rock"]);
const QUALITY_SCALE: Record<Quality, number> = { low: 0.35, medium: 0.7, high: 1 };

const deg = (r: number) => ((((r * 180) / Math.PI) % 360) + 360) % 360;
const rad = (d: number) => (d * Math.PI) / 180;
const yawToward = (fx: number, fz: number, tx: number, tz: number) => Math.atan2(tx - fx, tz - fz);

/** The point just outside a structure's front door (its local +z), where paths start and npcs gather. */
export function entrancePoint(p: Pick<Placed, "x" | "z" | "rotation" | "radius">, extra = 3): { x: number; z: number } {
  return { x: p.x + Math.sin(p.rotation) * (p.radius + extra), z: p.z + Math.cos(p.rotation) * (p.radius + extra) };
}

export function composeWorld(input: World3D, opts: { res?: number; quality?: Quality; skipScatter?: boolean } = {}): ComposedWorld {
  const world: World3D = JSON.parse(JSON.stringify(input)) as World3D;
  const fixes: string[] = [];
  const size = world.terrain.size;
  const half = size / 2;
  const water = world.terrain.water;
  const level = water.kind === "none" ? null : water.level;
  const quality = opts.quality ?? "high";
  const hf0 = buildHeightfield(world, { res: opts.res });
  const river = hf0.river;

  const inside = (x: number, z: number, margin: number) => ({ x: clamp(x, -half + margin, half - margin), z: clamp(z, -half + margin, half - margin) });
  const dry = (hf: Heightfield, x: number, z: number, margin = 0.2) => hf.waterDepth(x, z) <= 0 && (level === null || hf.height(x, z) >= level + margin);

  // ------------------------------------------------------------ landmarks
  const occupied: Circle[] = [];
  const overlaps = (x: number, z: number, r: number, gap: number) => occupied.some((o) => Math.hypot(x - o.x, z - o.z) < r + o.r + gap);

  /** Spiral search for the nearest spot satisfying `ok`, up to `maxR` metres away. */
  const searchNear = (x: number, z: number, maxR: number, step: number, margin: number, ok: (x: number, z: number) => boolean) => {
    if (ok(x, z)) return { x, z };
    for (let r = step; r <= maxR; r += step) {
      const n = Math.max(8, Math.round((2 * Math.PI * r) / step));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const p = inside(x + Math.cos(a) * r, z + Math.sin(a) * r, margin);
        if (ok(p.x, p.z)) return p;
      }
    }
    return null;
  };

  /** A land footprint is good when its centre and 8 rim points are dry and it clears everything placed so far. */
  const goodLand = (x: number, z: number, r: number, gap: number) => {
    if (!dry(hf0, x, z, 0.4) || overlaps(x, z, r, gap)) return false;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const rx = x + Math.cos(a) * r * 0.8;
      const rz = z + Math.sin(a) * r * 0.8;
      if (hf0.waterDepth(rx, rz) > 0.6) return false;
    }
    return true;
  };

  /** Nearest shoreline point (land→water transition) and the direction out to the water. */
  const shoreNear = (x: number, z: number, maxR: number) => {
    let best: { x: number; z: number; dx: number; dz: number; d: number } | null = null;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      let wasDry = dry(hf0, x, z);
      for (let s = 2; s <= maxR; s += 2) {
        const px = x + dx * s;
        const pz = z + dz * s;
        if (Math.abs(px) > half - 4 || Math.abs(pz) > half - 4) break;
        const isDry = dry(hf0, px, pz);
        if (wasDry && !isDry) {
          if (!best || s < best.d) best = { x: px, z: pz, dx, dz, d: s };
          break;
        }
        if (!wasDry && isDry) {
          // started in water: the shore is behind us, water points back the way we came
          if (!best || s < best.d) best = { x: px, z: pz, dx: -dx, dz: -dz, d: s };
          break;
        }
        wasDry = isDry;
      }
    }
    return best;
  };

  const landmarks: Placed[] = [];
  const decks: Deck[] = [];
  const addDeck = (p: Placed) => {
    const lengthAtScale1 = p.kind === "bridge" ? 36 : 20;
    decks.push({ x: p.x, z: p.z, halfLength: (lengthAtScale1 * p.scale) / 2, halfWidth: (p.kind === "bridge" ? 2.6 : 1.8) * Math.max(1, p.scale * 0.8), heading: p.rotation });
  };

  const placeBridgeOnRiver = (p: Placed, why: string): boolean => {
    if (river.length < 2) return false;
    let best = { i: 0, d: Infinity };
    river.forEach((q, i) => {
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < best.d) best = { i, d };
    });
    const a = river[Math.max(0, best.i - 2)];
    const b = river[Math.min(river.length - 1, best.i + 2)];
    const tangent = Math.atan2(b.x - a.x, b.z - a.z);
    const moved = best.d > 3;
    p.x = river[best.i].x;
    p.z = river[best.i].z;
    p.rotation = tangent + Math.PI / 2;
    const need = (water.width + 12) / 36;
    if (p.scale < need) {
      p.scale = Math.min(4, need);
      p.radius = STRUCTURES.bridge.radius * p.scale;
    }
    if (moved) fixes.push(`${why}: moved bridge "${p.id}" ${Math.round(best.d)} m onto the river`);
    return true;
  };

  for (const l of world.landmarks) {
    const info = STRUCTURES[l.kind];
    const p: Placed = {
      id: l.id,
      kind: l.kind,
      x: l.at.x,
      y: 0,
      z: l.at.z,
      rotation: rad(l.rotation),
      scale: l.scale,
      radius: info.radius * l.scale,
      height: info.height * l.scale,
      material: l.material,
      style: l.style,
      role: l.role,
      name: l.name,
      clusterId: null,
      seed: hashString(`${world.seed}:${l.id}`),
    };
    const margin = Math.min(p.radius + 6, half * 0.45);
    const clamped = inside(p.x, p.z, margin);
    if (clamped.x !== p.x || clamped.z !== p.z) {
      fixes.push(`landmark "${l.id}" pulled inside the map edge`);
      p.x = clamped.x;
      p.z = clamped.z;
    }
    if (info.placement === "span") {
      if (!placeBridgeOnRiver(p, `landmark "${l.id}"`) && level !== null) fixes.push(`bridge "${l.id}" has no river to span; it stands on land`);
      addDeck(p);
    } else if (info.placement === "shore" && level !== null) {
      const s = shoreNear(p.x, p.z, 140);
      if (s) {
        const reach = p.radius * 0.45;
        const nx = s.x + s.dx * reach;
        const nz = s.z + s.dz * reach;
        if (Math.hypot(nx - p.x, nz - p.z) > 4) fixes.push(`dock "${l.id}" moved ${Math.round(Math.hypot(nx - p.x, nz - p.z))} m to the shoreline`);
        p.x = nx;
        p.z = nz;
        p.rotation = Math.atan2(s.dx, s.dz);
        addDeck(p);
      } else fixes.push(`dock "${l.id}" found no shoreline within 140 m`);
    } else if (info.placement === "water" && level !== null) {
      const spot = searchNear(p.x, p.z, 200, 4, 8, (x, z) => hf0.waterDepth(x, z) >= 1.4 && !overlaps(x, z, p.radius, 1));
      if (spot) {
        if (Math.hypot(spot.x - p.x, spot.z - p.z) > 3) fixes.push(`boat "${l.id}" moved ${Math.round(Math.hypot(spot.x - p.x, spot.z - p.z))} m onto deep water`);
        p.x = spot.x;
        p.z = spot.z;
      } else fixes.push(`boat "${l.id}" found no deep water; it is beached`);
    } else {
      const spot = searchNear(p.x, p.z, Math.max(80, p.radius * 2.5), Math.max(4, p.radius * 0.25), margin, (x, z) => goodLand(x, z, p.radius, LANDMARK_GAP));
      if (!spot) fixes.push(`landmark "${l.id}" found no clear dry ground nearby; kept where written`);
      else if (Math.hypot(spot.x - p.x, spot.z - p.z) > 1) {
        fixes.push(`landmark "${l.id}" moved ${Math.round(Math.hypot(spot.x - p.x, spot.z - p.z))} m to clear dry ground`);
        p.x = spot.x;
        p.z = spot.z;
      }
    }
    if (info.placement !== "span" && info.placement !== "water") occupied.push({ x: p.x, z: p.z, r: p.radius });
    landmarks.push(p);
  }

  // ------------------------------------------------------------ clusters → pieces and specials
  const pieces: Placed[] = [];
  const specials: Special[] = [];
  const groveTrees: { kind: ScatterKind; x: number; z: number; scale: number }[] = [];
  const treeKind = BIOME_SCATTER[world.biome].find((k) => ["palm", "conifer", "broadleaf", "birch", "dead_tree", "cactus"].includes(k)) ?? "broadleaf";
  for (const c of world.clusters) {
    const info = CLUSTERS[c.kind];
    const rng = subRng(world.seed, `cluster:${c.id}`);
    const center = inside(c.at.x, c.at.z, c.radius * 0.5 + 8);
    const sample = (r: number, attempts: number, ok: (x: number, z: number) => boolean) => {
      for (let t = 0; t < attempts; t++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * c.radius;
        const p = inside(center.x + Math.cos(a) * d, center.z + Math.sin(a) * d, r + 4);
        if (ok(p.x, p.z)) return p;
      }
      return null;
    };
    if (info.pieces === "fields") {
      for (let n = 0; n < c.count; n++) {
        const halfW = range(rng, 8, 14);
        const halfD = range(rng, 6, 10);
        const r = Math.hypot(halfW, halfD);
        const p = sample(r, 40, (x, z) => goodLand(x, z, r, 1) && hf0.slope(x, z) < 8);
        if (!p) continue;
        specials.push({ kind: "fields", id: `${c.id}_${n}`, x: p.x, y: 0, z: p.z, halfW, halfD, rotation: range(rng, -0.3, 0.3) + (n % 2) * 0.1, seed: hashString(`${c.id}:${n}`) });
        occupied.push({ x: p.x, z: p.z, r: r * 0.9 });
      }
      continue;
    }
    if (info.pieces === "stones") {
      const r = Math.min(c.radius, 30);
      specials.push({ kind: "quarry", id: `${c.id}_0`, x: center.x, y: 0, z: center.z, halfW: r, halfD: r, rotation: range(rng, 0, Math.PI * 2), seed: hashString(c.id) });
      occupied.push({ x: center.x, z: center.z, r: r * 0.8 });
      continue;
    }
    if (info.pieces === "trees") {
      for (let n = 0; n < c.count * 3; n++) {
        const p = sample(2, 10, (x, z) => dry(hf0, x, z, 0.3) && !overlaps(x, z, 2, 0.5));
        if (p) groveTrees.push({ kind: treeKind, x: p.x, z: p.z, scale: range(rng, 0.8, 1.2) });
      }
      continue;
    }
    for (let n = 0; n < c.count; n++) {
      const kind = info.pieces[n % info.pieces.length];
      const sInfo = STRUCTURES[kind];
      const scale = range(rng, 0.85, 1.15);
      const r = sInfo.radius * scale;
      let spot: { x: number; z: number } | null = null;
      let rotation = 0;
      if (sInfo.placement === "water" && level !== null) {
        spot = sample(r, 60, (x, z) => hf0.waterDepth(x, z) >= 1.4 && !overlaps(x, z, r, 1));
        rotation = range(rng, 0, Math.PI * 2);
      } else if (sInfo.placement === "shore" && level !== null) {
        const s = shoreNear(center.x + range(rng, -c.radius, c.radius) * 0.5, center.z + range(rng, -c.radius, c.radius) * 0.5, c.radius + 60);
        if (s && !overlaps(s.x, s.z, r * 0.5, 1)) {
          spot = { x: s.x + s.dx * r * 0.45, z: s.z + s.dz * r * 0.45 };
          rotation = Math.atan2(s.dx, s.dz);
        }
      } else {
        spot = sample(r, 40, (x, z) => goodLand(x, z, r, 1.5) && hf0.slope(x, z) < 22);
        if (spot) rotation = yawToward(spot.x, spot.z, center.x, center.z) + range(rng, -0.35, 0.35);
      }
      if (!spot) continue;
      const piece: Placed = {
        id: `${c.id}_${n}`,
        kind,
        x: spot.x,
        y: 0,
        z: spot.z,
        rotation,
        scale,
        radius: r,
        height: sInfo.height * scale,
        material: c.material,
        style: c.style,
        role: "piece",
        name: null,
        clusterId: c.id,
        seed: hashString(`${world.seed}:${c.id}:${n}`),
      };
      pieces.push(piece);
      if (kind === "dock") addDeck(piece);
      if (sInfo.placement !== "water") occupied.push({ x: spot.x, z: spot.z, r });
    }
  }

  // ------------------------------------------------------------ actors: npcs, spawn, collectibles
  const structures = () => [...landmarks, ...pieces].filter((p) => p.kind !== "bridge" && p.kind !== "dock" && STRUCTURES[p.kind].placement !== "water");
  const standable = (x: number, z: number, clearance: number) => {
    if (!dry(hf0, x, z, 0.3) || hf0.slope(x, z) > 28) return false;
    for (const s of structures()) if (!STRUCTURES[s.kind].walkable && Math.hypot(x - s.x, z - s.z) < s.radius + clearance) return false;
    return Math.abs(x) < half - 6 && Math.abs(z) < half - 6;
  };
  const snapActor = (what: string, id: string, at: { x: number; z: number }, clearance: number) => {
    if (standable(at.x, at.z, clearance)) return { ...at };
    const spot = searchNear(at.x, at.z, 80, 2, 8, (x, z) => standable(x, z, clearance));
    if (spot) {
      fixes.push(`${what} "${id}" moved ${Math.round(Math.hypot(spot.x - at.x, spot.z - at.z))} m to stand on open, dry ground`);
      at.x = spot.x;
      at.z = spot.z;
    } else fixes.push(`${what} "${id}" has no open dry ground within 80 m`);
    return { ...at };
  };
  for (const n of world.npcs) n.at = snapActor("npc", n.id, n.at, 1.5);
  world.spawn.at = snapActor("spawn", "spawn", world.spawn.at, 3);
  for (const c of world.collectibles.items) c.at = snapActor("collectible", c.id, c.at, 1);

  // ------------------------------------------------------------ paths (with auto-bridges)
  const solidsFor = (list: Placed[]): Circle[] =>
    list.filter((p) => !STRUCTURES[p.kind].walkable && STRUCTURES[p.kind].placement !== "water").map((p) => ({ x: p.x, z: p.z, r: p.radius * 0.92 }));
  let nav0 = buildNavGrid(hf0, { solids: solidsFor([...landmarks, ...pieces]), decks });
  const endpoint = (id: string): { x: number; z: number } | null => {
    if (id === "spawn") return world.spawn.at;
    const l = landmarks.find((p) => p.id === id);
    if (!l) return null;
    return STRUCTURES[l.kind].walkable ? { x: l.x, z: l.z } : entrancePoint(l);
  };
  const slopeCost = (x: number, z: number) => hf0.slope(x, z) / 12;
  let autoBridges = 0;
  const routes: (PathRoute & { from: string; to: string; style: PathStyle })[] = [];
  for (const path of world.paths) {
    const a = endpoint(path.from);
    const b = endpoint(path.to);
    if (!a || !b) continue;
    let route = findRoute(nav0, a, b, slopeCost);
    if (!route && river.length >= 2) {
      // a river is in the way: bridge it where the straight line between the two ends crosses it
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const bridge: Placed = {
        id: `bridge_auto_${++autoBridges}`,
        kind: "bridge",
        x: mid.x,
        y: 0,
        z: mid.z,
        rotation: 0,
        scale: 1,
        radius: STRUCTURES.bridge.radius,
        height: STRUCTURES.bridge.height,
        material: world.setting.style === "ancient_egypt" || world.setting.style === "mesoamerican" ? "limestone" : "wood",
        style: world.setting.style,
        role: "decor",
        name: "Footbridge",
        clusterId: null,
        seed: hashString(`${world.seed}:bridge_auto_${autoBridges}`),
      };
      placeBridgeOnRiver(bridge, "auto bridge");
      landmarks.push(bridge);
      addDeck(bridge);
      world.landmarks.push({
        id: bridge.id,
        kind: "bridge",
        name: "Footbridge",
        at: { x: bridge.x, z: bridge.z },
        rotation: deg(bridge.rotation),
        scale: bridge.scale,
        material: bridge.material,
        style: bridge.style,
        role: "decor",
        description: "A footbridge the villagers built across the river.",
      });
      fixes.push(`added "${bridge.id}" so the path ${path.from} → ${path.to} can cross the river`);
      nav0 = buildNavGrid(hf0, { solids: solidsFor([...landmarks, ...pieces]), decks });
      route = findRoute(nav0, a, b, slopeCost);
    }
    if (!route) {
      fixes.push(`path ${path.from} → ${path.to} has no walkable route; dropped`);
      continue;
    }
    routes.push({ points: route, width: PATH_WIDTH[path.style], from: path.from, to: path.to, style: path.style });
  }

  // ------------------------------------------------------------ final heightfield: pads + paths
  const minPad = level === null ? -Infinity : level + 0.8;
  const pads: Pad[] = [];
  for (const p of [...landmarks, ...pieces]) {
    const placement = STRUCTURES[p.kind].placement;
    if (placement !== "land") continue;
    pads.push({ x: p.x, z: p.z, radius: p.radius * (p.kind === "pyramid" || p.kind === "step_pyramid" ? 1.02 : 0.95), blend: 5 + p.radius * 0.3, minHeight: minPad });
  }
  for (const s of specials) pads.push({ x: s.x, z: s.z, radius: Math.hypot(s.halfW, s.halfD) * 0.85, blend: 5, minHeight: minPad });
  const hf = buildHeightfield(world, { res: hf0.res, pads, paths: routes });

  // ------------------------------------------------------------ heights for everything
  for (const p of [...landmarks, ...pieces]) {
    const placement = STRUCTURES[p.kind].placement;
    if (placement === "water") p.y = level ?? hf.height(p.x, p.z);
    else if (p.kind === "dock") p.y = (level ?? hf.height(p.x, p.z)) + 0.55;
    else if (p.kind === "bridge") {
      const len = 18 * p.scale;
      const ya = hf.height(p.x - Math.sin(p.rotation) * len, p.z - Math.cos(p.rotation) * len);
      const yb = hf.height(p.x + Math.sin(p.rotation) * len, p.z + Math.cos(p.rotation) * len);
      p.y = Math.max(ya, yb, (level ?? -Infinity) + 1.2);
    } else p.y = hf.height(p.x, p.z);
  }
  for (const s of specials) s.y = hf.height(s.x, s.z);
  const actor = (id: string, at: { x: number; z: number }, facingDeg: number): ComposedActor => ({ id, x: at.x, y: hf.height(at.x, at.z), z: at.z, facing: rad(facingDeg) });
  const npcs = world.npcs.map((n) => actor(n.id, n.at, n.facing));
  const collectibles = world.collectibles.items.map((c) => actor(c.id, c.at, 0));
  const spawn = actor("spawn", world.spawn.at, world.spawn.facing);
  const paths: ComposedPath[] = routes.map((r) => ({
    from: r.from,
    to: r.to,
    style: r.style,
    width: r.width,
    points: smoothPolyline(r.points, 3).map((p) => ({ x: p.x, y: hf.height(p.x, p.z), z: p.z })),
  }));

  // write the snapped placements back into the stored world
  for (const p of landmarks) {
    const l = world.landmarks.find((w) => w.id === p.id);
    if (!l) continue;
    l.at = { x: round1(p.x), z: round1(p.z) };
    l.rotation = round1(deg(p.rotation));
    l.scale = Math.round(p.scale * 100) / 100;
  }

  // ------------------------------------------------------------ masks
  const res = hf.res;
  const cell = hf.cell;
  const pathMask = new Uint8Array(res * res);
  for (const p of paths) {
    const line = p.points;
    const reach = p.width / 2 + 1.6;
    stampPolyline(pathMask, res, cell, half, line, reach, (d) => 255 * smoothstep(reach, p.width / 2 - 0.6, d));
  }
  const fieldMask = new Uint8Array(res * res);
  for (const s of specials.filter((q) => q.kind === "fields")) {
    const r = Math.hypot(s.halfW, s.halfD) + 2;
    forCells(res, cell, half, s.x, s.z, r, (i, x, z) => {
      const dx = x - s.x;
      const dz = z - s.z;
      const along = dx * Math.cos(s.rotation) - dz * Math.sin(s.rotation);
      const across = dx * Math.sin(s.rotation) + dz * Math.cos(s.rotation);
      const inside = smoothstep(s.halfW + 1.5, s.halfW - 0.5, Math.abs(along)) * smoothstep(s.halfD + 1.5, s.halfD - 0.5, Math.abs(across));
      fieldMask[i] = Math.max(fieldMask[i], Math.round(255 * inside));
    });
  }

  // ------------------------------------------------------------ navigation on the final ground
  const nav = buildNavGrid(hf, { solids: solidsFor([...landmarks, ...pieces]), decks });
  const reachable = floodFrom(nav, spawn.x, spawn.z);

  // ------------------------------------------------------------ scatter
  const scatter = opts.skipScatter
    ? []
    : scatterAll(world, hf, { landmarks, pieces, specials, paths, pathMask, npcs, collectibles, spawn, decks, groveTrees, quality });

  // ------------------------------------------------------------ wildlife homes
  const wildlife: ComposedWildlife[] = world.wildlife.map((w, i) => {
    const rng = subRng(world.seed, `wildlife:${w.kind}:${i}`);
    const info = WILDLIFE[w.kind];
    const radius = info.motion === "fly" ? 90 : info.motion === "swarm" ? 18 : 28;
    let home = { x: spawn.x, z: spawn.z };
    if (w.zone === "around_landmark" && w.landmarkId) {
      const l = landmarks.find((p) => p.id === w.landmarkId);
      if (l) home = { x: l.x + (l.radius + 10) * Math.sin(l.rotation), z: l.z + (l.radius + 10) * Math.cos(l.rotation) };
    } else {
      for (let t = 0; t < 60; t++) {
        const x = range(rng, -half * 0.8, half * 0.8);
        const z = range(rng, -half * 0.8, half * 0.8);
        const depth = hf.waterDepth(x, z);
        const wantWater = info.motion === "swim";
        if (wantWater ? depth < 1 : depth > 0) continue;
        if (w.zone === "near_water" && level !== null && !wantWater && hf.height(x, z) > level + 4) continue;
        if (w.zone === "highlands" && hf.height(x, z) < (level ?? 0) + BIOMES[world.biome].highLine) continue;
        home = { x, z };
        break;
      }
    }
    return { kind: w.kind, count: w.count, x: home.x, z: home.z, radius };
  });

  return {
    world,
    hf,
    landmarks,
    pieces,
    specials,
    decks,
    paths,
    scatter,
    npcs,
    collectibles,
    wildlife,
    spawn,
    goal: landmarks.find((p) => p.role === "goal") ?? null,
    pathMask,
    fieldMask,
    nav,
    reachable,
    fixes,
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function forCells(res: number, cell: number, half: number, cx: number, cz: number, r: number, fn: (i: number, x: number, z: number) => void) {
  const ix0 = clamp(Math.floor((cx - r + half) / cell), 0, res - 1);
  const ix1 = clamp(Math.ceil((cx + r + half) / cell), 0, res - 1);
  const iz0 = clamp(Math.floor((cz - r + half) / cell), 0, res - 1);
  const iz1 = clamp(Math.ceil((cz + r + half) / cell), 0, res - 1);
  for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) fn(iz * res + ix, -half + ix * cell, -half + iz * cell);
}

function stampPolyline(mask: Uint8Array, res: number, cell: number, half: number, line: readonly { x: number; z: number }[], reach: number, value: (d: number) => number) {
  if (line.length < 2) return;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of line) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const ix0 = clamp(Math.floor((minX - reach + half) / cell), 0, res - 1);
  const ix1 = clamp(Math.ceil((maxX + reach + half) / cell), 0, res - 1);
  const iz0 = clamp(Math.floor((minZ - reach + half) / cell), 0, res - 1);
  const iz1 = clamp(Math.ceil((maxZ + reach + half) / cell), 0, res - 1);
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const { d } = distanceToPolyline(-half + ix * cell, -half + iz * cell, line);
      if (d > reach) continue;
      const i = iz * res + ix;
      mask[i] = Math.max(mask[i], Math.round(value(d)));
    }
  }
}

/** Distance (metres) from every heightfield cell to the nearest water cell, by a two-pass chamfer transform. */
function waterDistance(hf: Heightfield): Float32Array {
  const { res, cell } = hf;
  const d = new Float32Array(res * res).fill(1e9);
  for (let iz = 0; iz < res; iz++) {
    for (let ix = 0; ix < res; ix++) {
      const { x, z } = hf.toWorld(ix, iz);
      if (hf.waterDepth(x, z) > 0) d[iz * res + ix] = 0;
    }
  }
  const a = cell;
  const b = cell * Math.SQRT2;
  for (let iz = 0; iz < res; iz++) {
    for (let ix = 0; ix < res; ix++) {
      const i = iz * res + ix;
      if (ix > 0) d[i] = Math.min(d[i], d[i - 1] + a);
      if (iz > 0) d[i] = Math.min(d[i], d[i - res] + a);
      if (ix > 0 && iz > 0) d[i] = Math.min(d[i], d[i - res - 1] + b);
      if (ix < res - 1 && iz > 0) d[i] = Math.min(d[i], d[i - res + 1] + b);
    }
  }
  for (let iz = res - 1; iz >= 0; iz--) {
    for (let ix = res - 1; ix >= 0; ix--) {
      const i = iz * res + ix;
      if (ix < res - 1) d[i] = Math.min(d[i], d[i + 1] + a);
      if (iz < res - 1) d[i] = Math.min(d[i], d[i + res] + a);
      if (ix < res - 1 && iz < res - 1) d[i] = Math.min(d[i], d[i + res + 1] + b);
      if (ix > 0 && iz < res - 1) d[i] = Math.min(d[i], d[i + res - 1] + b);
    }
  }
  return d;
}

function scatterAll(
  world: World3D,
  hf: Heightfield,
  ctx: {
    landmarks: Placed[];
    pieces: Placed[];
    specials: Special[];
    paths: ComposedPath[];
    pathMask: Uint8Array;
    npcs: ComposedActor[];
    collectibles: ComposedActor[];
    spawn: ComposedActor;
    decks: Deck[];
    groveTrees: { kind: ScatterKind; x: number; z: number; scale: number }[];
    quality: Quality;
  },
): ScatterBatch[] {
  const { res, cell } = hf;
  const half = hf.size / 2;
  const level = hf.waterLevel;
  const preset = BIOMES[world.biome];
  // blocked: footprints, spawn clearing, npcs, collectibles, decks (paths are read from pathMask directly)
  const blocked = new Uint8Array(res * res);
  const block = (x: number, z: number, r: number) => forCells(res, cell, half, x, z, r, (i, cx, cz) => Math.hypot(cx - x, cz - z) <= r && (blocked[i] = 1));
  for (const p of [...ctx.landmarks, ...ctx.pieces]) if (STRUCTURES[p.kind].placement !== "water") block(p.x, p.z, p.radius + 1.5);
  for (const s of ctx.specials) block(s.x, s.z, Math.hypot(s.halfW, s.halfD) + 1);
  block(ctx.spawn.x, ctx.spawn.z, 9);
  for (const n of ctx.npcs) block(n.x, n.z, 2.8);
  for (const c of ctx.collectibles) block(c.x, c.z, 1.4);
  let wd: Float32Array | null = null;
  const waterDist = (ix: number, iz: number) => {
    if (level === null) return Infinity;
    wd ??= waterDistance(hf);
    return wd[iz * res + ix];
  };
  const pathDistOk = (i: number, kind: ScatterKind) => ctx.pathMask[i] < (WALK_THROUGH.has(kind) ? 110 : 20);

  const batches = new Map<ScatterKind, number[]>();
  const push = (kind: ScatterKind, x: number, y: number, z: number, yaw: number, scale: number) => {
    const arr = batches.get(kind) ?? [];
    arr.push(x, y, z, yaw, scale);
    batches.set(kind, arr);
  };

  world.scatter.forEach((s, si) => {
    const info = SCATTER[s.kind];
    const rng: Rng = subRng(world.seed, `scatter:${s.kind}:${si}`);
    const qScale = WALK_THROUGH.has(s.kind) ? QUALITY_SCALE[ctx.quality] : 1;
    const areaHa = (hf.size * hf.size) / 10_000;
    let target = Math.round(s.density * info.perHectare * areaHa * qScale);
    let cx = 0;
    let cz = 0;
    let annulus: [number, number] | null = null;
    if (s.zone === "around_landmark") {
      const l = ctx.landmarks.find((p) => p.id === s.landmarkId);
      if (!l) return;
      cx = l.x;
      cz = l.z;
      annulus = [l.radius + 2, l.radius + 30];
      const annulusHa = (Math.PI * (annulus[1] ** 2 - annulus[0] ** 2)) / 10_000;
      target = Math.round(s.density * info.perHectare * annulusHa * qScale);
    }
    target = Math.min(target, Math.round(SCATTER_CAP[s.kind] * qScale));
    const attempts = target * 4 + 50;
    let placed = 0;
    for (let t = 0; t < attempts && placed < target; t++) {
      let x: number;
      let z: number;
      if (annulus) {
        const a = rng() * Math.PI * 2;
        const d = annulus[0] + Math.sqrt(rng()) * (annulus[1] - annulus[0]);
        x = cx + Math.cos(a) * d;
        z = cz + Math.sin(a) * d;
      } else {
        x = range(rng, -half + 3, half - 3);
        z = range(rng, -half + 3, half - 3);
      }
      if (Math.abs(x) > half - 2 || Math.abs(z) > half - 2) continue;
      const ix = Math.round((x + half) / cell);
      const iz = Math.round((z + half) / cell);
      const i = iz * res + ix;
      if (blocked[i] || !pathDistOk(i, s.kind)) continue;
      const h = hf.height(x, z);
      const depth = hf.waterDepth(x, z);
      const wet = s.kind === "reeds" || s.kind === "coral";
      if (wet ? depth > 0.5 : depth > 0) continue;
      if (level !== null && !wet && h < level + 0.35) continue;
      const slope = hf.slope(x, z) / 90;
      if (slope > info.maxSlope) continue;
      const rel = level === null ? h : h - level;
      if (s.zone === "near_water" && waterDist(ix, iz) > (wet ? 5 : 45)) continue;
      if (wet && waterDist(ix, iz) > 6) continue;
      if (s.zone === "lowlands" && rel > preset.highLine) continue;
      if (s.zone === "highlands" && rel < preset.highLine) continue;
      if (s.zone === "along_paths" && ctx.pathMask[i] === 0) {
        // near a path: sample a few cells around
        let near = false;
        for (let k = -4; k <= 4 && !near; k += 2) for (let m = -4; m <= 4 && !near; m += 2) near = (ctx.pathMask[clamp(iz + k, 0, res - 1) * res + clamp(ix + m, 0, res - 1)] ?? 0) > 0;
        if (!near) continue;
      }
      if (ctx.decks.some((d) => Math.hypot(x - d.x, z - d.z) < d.halfLength + 2)) continue;
      const [lo, hi] = info.size;
      const scale = (lo + (hi - lo) * rng()) / hi;
      push(s.kind, x, h, z, rng() * Math.PI * 2, scale);
      placed++;
    }
  });
  for (const g of ctx.groveTrees) push(g.kind, g.x, hf.height(g.x, g.z), g.z, hashString(`${g.x}:${g.z}`) % 628 / 100, g.scale);

  return [...batches].map(([kind, arr]) => ({ kind, count: arr.length / 5, data: new Float32Array(arr) }));
}
