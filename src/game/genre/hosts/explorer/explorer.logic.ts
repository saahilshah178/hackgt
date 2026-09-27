import type { GameSpec } from "../../../../contracts/gamespec";
import type { Progression } from "../../../runner/progression";
import { seededRandom } from "../../types";

/*
 * The explorer host's pure logic: a bird's-eye maze generated from the braided progression graph.
 *
 * The map is a grid of macro CELLS (CELL tiles square, sharing their boundary rows and columns). The START plaza sits in
 * a central cell; the HEART (boss) chamber is the plaza's neighbour behind a big sealed door; each progression track is
 * a WING that grows cell by cell from its own side of the plaza, one room per station in track order. Rooms are
 * connected by straight 1-tile corridors along a cell's middle rows/columns, so rooms never touch each other and the only
 * ways between them are the corridors carved here. A corridor into a wing's 2nd, 3rd, ... room is closed by a GATE that
 * opens once the previous station on that wing is solved, and a SENTRY paces a short patrol lane that crosses it.
 *
 * Nothing here reads the clock or Math.random: everything derives from spec.seed, the progression and `solved`.
 */

export const CELL = 7;
/** ms per avatar step (8 tiles/s) and per sentry tick */
export const STEP_MS = 125;
export const SENTRY_MS = 450;
/** the map area a 1600x900 viewport leaves beside a 600px side column; only used to rank grid shapes */
const TARGET_W = 960;
const TARGET_H = 800;

export const ROCK = 0;
export const FLOOR = 1;
export const HALL = 2;
export const ALCOVE = 3;

export type Dir = "up" | "down" | "left" | "right";
export interface Pt {
  x: number;
  y: number;
}
export const DIRS: Record<Dir, Pt> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

export type RoomKind = "plaza" | "station" | "heart";

export interface ExplorerRoom {
  id: string;
  kind: RoomKind;
  /** macro cell */
  cell: Pt;
  /** interior bounds in tiles (inclusive x..x+w-1); round rooms omit their four corner tiles */
  x: number;
  y: number;
  w: number;
  h: number;
  round: boolean;
  encounterId: string | null;
  /** wing (progression track); -1 for the plaza and the heart */
  track: number;
  /** position inside its wing (0 = first room off the plaza) */
  order: number;
  /** display name: the encounter's first concept, e.g. "Montgomery bus boycott (1955–1956)" */
  name: string;
  /** room this one was reached from (null for the plaza) */
  parent: string | null;
}

export interface ExplorerStation {
  encounterId: string;
  roomId: string;
  socket: string;
  /** tiles the pedestal occupies (not walkable) */
  block: Pt[];
  /** the pedestal's centre in tile units (tile x covers [x, x+1)) */
  center: Pt;
  /** walkable tiles orthogonally next to the pedestal: where a click-walk ends */
  approach: Pt[];
}

export interface ExplorerCorridor {
  id: string;
  from: string;
  to: string;
  track: number;
  /** carved tiles, parent side first */
  tiles: Pt[];
}

export interface ExplorerGate {
  id: string;
  corridorId: string;
  /** the room this gate leads into */
  roomId: string;
  kind: "gate" | "door";
  tiles: Pt[];
  /** encounter ids that must all be solved for the gate to stand open */
  opensAfter: string[];
  /** true when the passage runs left-right (the gate's bars run up-down) */
  horizontal: boolean;
}

export interface SentryRoute {
  id: string;
  corridorId: string;
  track: number;
  /** patrol lane tiles in walking order; tiles[CROSSING] is the corridor tile it guards */
  tiles: Pt[];
  phase: number;
}
export const CROSSING = 2;
const LANE = 5;

export interface ExplorerMap {
  cols: number;
  rows: number;
  gridW: number;
  gridH: number;
  /** tile kinds (ROCK/FLOOR/HALL/ALCOVE), row-major */
  tiles: Uint8Array;
  /** room index per FLOOR tile, -1 elsewhere */
  roomAt: Int16Array;
  /** corridor index per HALL/ALCOVE tile, -1 elsewhere */
  corridorAt: Int16Array;
  /** station index per pedestal tile, -1 elsewhere */
  blockAt: Int16Array;
  /** gate index per gate tile, -1 elsewhere */
  gateAt: Int16Array;
  rooms: ExplorerRoom[];
  roomById: ReadonlyMap<string, ExplorerRoom>;
  stations: ExplorerStation[];
  stationByEncounter: ReadonlyMap<string, ExplorerStation>;
  corridors: ExplorerCorridor[];
  gates: ExplorerGate[];
  sentries: SentryRoute[];
  plazaId: string;
  heartId: string | null;
  /** seeded scenery on solid rock (never next to a walkable tile) */
  decor: { x: number; y: number; kind: "boulder" | "tuft" | "tree"; r: number }[];
  start: Pt;
  /** per track: the plaza tile at the mouth of that wing (where a spotted avatar is sent back to) */
  wingEntrances: Pt[];
}

// ---------------------------------------------------------------------------------------------------------------------
// generation

const STEPS: Record<Dir, Pt> = DIRS;

export function buildExplorerMap(spec: Pick<GameSpec, "seed" | "encounters" | "concepts">, progression: Progression): ExplorerMap {
  const regular = progression.tracks.reduce((n, t) => n + t.length, 0);
  const cellsNeeded = 1 + regular + (progression.bossId ? 1 : 0);
  const candidates: { w: number; h: number; tile: number }[] = [];
  for (let w = 2; w <= 10; w++)
    for (let h = 2; h <= 8; h++) {
      if (w * h < cellsNeeded + Math.ceil(regular * 0.25)) continue;
      candidates.push({ w, h, tile: Math.min(TARGET_W / (w * CELL + 1), TARGET_H / (h * CELL + 1)) });
    }
  candidates.sort((a, b) => b.tile - a.tile || a.w * a.h - b.w * b.h || a.w - b.w);
  for (const c of candidates) {
    const map = attempt(spec, progression, c.w, c.h);
    if (map) return map;
  }
  throw new Error(`explorer: no maze layout for ${spec.encounters.length} encounters`);
}

function attempt(spec: Pick<GameSpec, "seed" | "encounters" | "concepts">, p: Progression, W: number, H: number): ExplorerMap | null {
  const rand = seededRandom((spec.seed ^ 0x5eed7) + W * 131 + H * 7);
  const inGrid = (c: Pt) => c.x >= 0 && c.y >= 0 && c.x < W && c.y < H;
  const key = (c: Pt) => c.y * W + c.x;
  const owner = new Map<number, string>(); // cell -> room id
  const plazaCell = { x: Math.floor((W - 1) / 2), y: Math.floor((H - 1) / 2) };
  owner.set(key(plazaCell), "plaza");

  const add = (a: Pt, d: Dir): Pt => ({ x: a.x + STEPS[d].x, y: a.y + STEPS[d].y });
  let heartDir: Dir | null = null;
  if (p.bossId) {
    heartDir = (["down", "up", "right", "left"] as Dir[]).find((d) => inGrid(add(plazaCell, d))) ?? null;
    if (!heartDir) return null;
    owner.set(key(add(plazaCell, heartDir)), "heart");
  }
  const wingDirs = (["left", "right", "up", "down"] as Dir[]).filter((d) => d !== heartDir && inGrid(add(plazaCell, d)));
  if (wingDirs.length < p.tracks.length) return null;

  // wing growth: cells per track, in station order, with the parent cell each was reached from
  const wingCells: { cell: Pt; parent: Pt }[][] = p.tracks.map(() => []);
  p.tracks.forEach((_, t) => {
    const c = add(plazaCell, wingDirs[t]);
    owner.set(key(c), `r_${p.tracks[t][0]}`);
    wingCells[t].push({ cell: c, parent: plazaCell });
  });
  const freeAround = (c: Pt) => (Object.keys(STEPS) as Dir[]).map((d) => add(c, d)).filter((n) => inGrid(n) && !owner.has(key(n)));
  const longest = Math.max(0, ...p.tracks.map((t) => t.length));
  for (let s = 1; s < longest; s++) {
    for (let t = 0; t < p.tracks.length; t++) {
      if (s >= p.tracks[t].length) continue;
      const cells = wingCells[t];
      let parent = cells[s - 1].cell;
      let cand = freeAround(parent);
      for (let k = cells.length - 1; cand.length === 0 && k >= 0; k--) {
        parent = cells[k].cell;
        cand = freeAround(parent);
      }
      if (cand.length === 0) return null;
      const dir = STEPS[wingDirs[t]];
      let best = cand[0];
      let bestScore = -Infinity;
      for (const c of cand) {
        const straight = c.x - parent.x === dir.x && c.y - parent.y === dir.y ? 2 : 0;
        const score = straight + freeAround(c).length + rand() * 0.9;
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      owner.set(key(best), `r_${p.tracks[t][s]}`);
      cells.push({ cell: best, parent });
    }
  }

  // ---- tiles
  const cols = W * CELL + 1;
  const rows = H * CELL + 1;
  const tiles = new Uint8Array(cols * rows);
  const roomAt = new Int16Array(cols * rows).fill(-1);
  const corridorAt = new Int16Array(cols * rows).fill(-1);
  const blockAt = new Int16Array(cols * rows).fill(-1);
  const gateAt = new Int16Array(cols * rows).fill(-1);
  const idx = (x: number, y: number) => y * cols + x;

  const conceptName = new Map(spec.concepts.map((c) => [c.id, c.name]));
  const nameOf = (encounterId: string) => {
    const e = spec.encounters.find((x) => x.id === encounterId)!;
    return conceptName.get(e.conceptIds[0]) ?? humanize(e.id);
  };

  const rooms: ExplorerRoom[] = [];
  const stations: ExplorerStation[] = [];
  const addRoom = (room: ExplorerRoom) => {
    const i = rooms.length;
    rooms.push(room);
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++) {
        if (room.round && (x === room.x || x === room.x + room.w - 1) && (y === room.y || y === room.y + room.h - 1)) continue;
        tiles[idx(x, y)] = FLOOR;
        roomAt[idx(x, y)] = i;
      }
    return room;
  };
  const addStation = (room: ExplorerRoom, block: Pt[]) => {
    const e = spec.encounters.find((x) => x.id === room.encounterId)!;
    const si = stations.length;
    for (const b of block) blockAt[idx(b.x, b.y)] = si;
    const xs = block.map((b) => b.x);
    const ys = block.map((b) => b.y);
    stations.push({
      encounterId: e.id,
      roomId: room.id,
      socket: e.socket,
      block,
      center: { x: (Math.min(...xs) + Math.max(...xs) + 1) / 2, y: (Math.min(...ys) + Math.max(...ys) + 1) / 2 },
      approach: [],
    });
  };

  const fullRoom = (id: string, kind: RoomKind, cell: Pt, encounterId: string | null, name: string): ExplorerRoom =>
    addRoom({ id, kind, cell, x: cell.x * CELL + 1, y: cell.y * CELL + 1, w: CELL - 1, h: CELL - 1, round: true, encounterId, track: -1, order: 0, name, parent: null });

  const plaza = fullRoom("plaza", "plaza", plazaCell, null, "The crossroads");
  let heart: ExplorerRoom | null = null;
  if (p.bossId && heartDir) {
    heart = fullRoom("heart", "heart", add(plazaCell, heartDir), p.bossId, nameOf(p.bossId));
    heart.parent = "plaza";
    const c = { x: heart.x + 2, y: heart.y + 2 };
    addStation(heart, [c, { x: c.x + 1, y: c.y }, { x: c.x, y: c.y + 1 }, { x: c.x + 1, y: c.y + 1 }]);
  }

  const roomIdOfCell = (c: Pt) => owner.get(key(c))!;
  p.tracks.forEach((track, t) => {
    track.forEach((encounterId, order) => {
      const { cell, parent } = wingCells[t][order];
      const w = rand() < 0.5 ? 3 : 4;
      const h = rand() < 0.5 ? 3 : 4;
      const ox = w === 3 ? (rand() < 0.5 ? 1 : 2) : 1;
      const oy = h === 3 ? (rand() < 0.5 ? 1 : 2) : 1;
      const room = addRoom({
        id: `r_${encounterId}`,
        kind: "station",
        cell,
        x: cell.x * CELL + 1 + ox,
        y: cell.y * CELL + 1 + oy,
        w,
        h,
        round: false,
        encounterId,
        track: t,
        order,
        name: nameOf(encounterId),
        parent: roomIdOfCell(parent),
      });
      const sx = room.x + (w === 3 ? 1 : rand() < 0.5 ? 1 : 2);
      const sy = room.y + (h === 3 ? 1 : rand() < 0.5 ? 1 : 2);
      addStation(room, [{ x: sx, y: sy }]);
    });
  });

  // ---- corridors, gates, sentries
  const corridors: ExplorerCorridor[] = [];
  const gates: ExplorerGate[] = [];
  const sentries: SentryRoute[] = [];
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const roomIndex = new Map(rooms.map((r, i) => [r.id, i]));

  /** carve a straight line through the boundary between two adjacent cells; returns tiles ordered from `a` to `b` */
  const carveLine = (a: ExplorerRoom, b: ExplorerRoom, rel: number, ci: number): Pt[] | null => {
    const horizontal = a.cell.y === b.cell.y;
    const boundary = horizontal ? Math.max(a.cell.x, b.cell.x) * CELL : Math.max(a.cell.y, b.cell.y) * CELL;
    const line = horizontal ? a.cell.y * CELL + rel : a.cell.x * CELL + rel;
    const at = (s: number): Pt => (horizontal ? { x: s, y: line } : { x: line, y: s });
    const towardB = horizontal ? Math.sign(b.cell.x - a.cell.x) : Math.sign(b.cell.y - a.cell.y);
    const ai = roomIndex.get(a.id)!;
    const bi = roomIndex.get(b.id)!;
    const out: Pt[] = [];
    // from the boundary back toward a, then from the boundary forward toward b
    const back: Pt[] = [];
    for (let s = boundary; ; s -= towardB) {
      const pt = at(s);
      const r = roomAt[idx(pt.x, pt.y)];
      if (r === ai) break;
      if (r !== -1 || Math.abs(s - boundary) > CELL) return null;
      back.push(pt);
    }
    const fwd: Pt[] = [];
    for (let s = boundary + towardB; ; s += towardB) {
      const pt = at(s);
      const r = roomAt[idx(pt.x, pt.y)];
      if (r === bi) break;
      if (r !== -1 || Math.abs(s - boundary) > CELL) return null;
      fwd.push(pt);
    }
    out.push(...back.reverse(), ...fwd);
    for (const pt of out) {
      tiles[idx(pt.x, pt.y)] = HALL;
      corridorAt[idx(pt.x, pt.y)] = ci;
    }
    return out;
  };

  const wingRooms = rooms.filter((r) => r.kind === "station");
  // corridors in wing order (parents always come earlier in their wing)
  for (let t = 0; t < p.tracks.length; t++) {
    for (const r of wingRooms.filter((x) => x.track === t).sort((a, b) => a.order - b.order)) {
      const parent = roomById.get(r.parent!)!;
      const ci = corridors.length;
      const rel = rand() < 0.5 ? 3 : 4;
      const line = carveLine(parent, r, rel, ci);
      if (!line || line.length === 0) return null;
      const corridor: ExplorerCorridor = { id: `c_${r.id}`, from: parent.id, to: r.id, track: t, tiles: line };
      corridors.push(corridor);
      const horizontal = parent.cell.y === r.cell.y;
      if (r.order > 0) {
        const prev = p.tracks[t][r.order - 1];
        const gateTile = line[line.length - 1];
        gateAt[idx(gateTile.x, gateTile.y)] = gates.length;
        gates.push({ id: `g_${r.id}`, corridorId: corridor.id, roomId: r.id, kind: "gate", tiles: [gateTile], opensAfter: [prev], horizontal });
        // the sentry lane crosses the corridor at the cell boundary, perpendicular to it
        const boundary = horizontal ? Math.max(parent.cell.x, r.cell.x) * CELL : Math.max(parent.cell.y, r.cell.y) * CELL;
        const crossing = line.find((pt) => (horizontal ? pt.x === boundary : pt.y === boundary));
        if (crossing && !(crossing.x === gateTile.x && crossing.y === gateTile.y)) {
          const lane: Pt[] = [];
          for (let k = -CROSSING; k < LANE - CROSSING; k++) lane.push(horizontal ? { x: crossing.x, y: crossing.y + k } : { x: crossing.x + k, y: crossing.y });
          const clear = lane.every((pt, k) => k === CROSSING || (tiles[idx(pt.x, pt.y)] === ROCK && neighbours4(pt).every((n) => !inBounds(n, cols, rows) || tiles[idx(n.x, n.y)] === ROCK || (n.x === crossing.x && n.y === crossing.y) || lane.some((l) => l.x === n.x && l.y === n.y))));
          if (clear) {
            for (const [k, pt] of lane.entries()) {
              if (k === CROSSING) continue;
              tiles[idx(pt.x, pt.y)] = ALCOVE;
              corridorAt[idx(pt.x, pt.y)] = ci;
            }
            sentries.push({ id: `s_${r.id}`, corridorId: corridor.id, track: t, tiles: lane, phase: Math.floor(rand() * (LANE - 1) * 2) });
          }
        }
      }
    }
  }

  // the big sealed door between the plaza and the heart: two tiles wide
  if (heart) {
    const ci = corridors.length;
    const a = carveLine(plaza, heart, 3, ci);
    const b = carveLine(plaza, heart, 4, ci);
    if (!a || !b) return null;
    const tilesAB = [...a, ...b];
    corridors.push({ id: "c_heart", from: plaza.id, to: heart.id, track: -1, tiles: tilesAB });
    const boss = p.byId.get(p.bossId!)!;
    if (boss.requires.length > 0) {
      const door = [a[a.length - 1], b[b.length - 1]];
      for (const d of door) gateAt[idx(d.x, d.y)] = gates.length;
      gates.push({ id: "g_heart", corridorId: "c_heart", roomId: heart.id, kind: "door", tiles: door, opensAfter: [...boss.requires], horizontal: plaza.cell.y === heart.cell.y });
    }
  }

  // approach tiles: walkable floor orthogonally next to each pedestal
  for (const s of stations)
    s.approach = uniq(s.block.flatMap(neighbours4)).filter(
      (pt) => inBounds(pt, cols, rows) && tiles[idx(pt.x, pt.y)] === FLOOR && blockAt[idx(pt.x, pt.y)] === -1,
    );

  const wingEntrances = p.tracks.map((_, t) => {
    const first = corridors.find((c) => c.track === t && roomById.get(c.to)!.order === 0)!;
    const mouth = first.tiles[0];
    return neighbours4(mouth).find((n) => roomAt[idx(n.x, n.y)] === roomIndex.get(plaza.id))!;
  });

  const decor: ExplorerMap["decor"] = [];
  for (let y = 1; y < rows - 1; y++)
    for (let x = 1; x < cols - 1; x++) {
      let clear = true;
      for (let dy = -1; dy <= 1 && clear; dy++) for (let dx = -1; dx <= 1; dx++) if (tiles[idx(x + dx, y + dy)] !== ROCK) clear = false;
      if (!clear) continue;
      const roll = rand();
      if (roll < 0.07) decor.push({ x, y, kind: "tree", r: 0.3 + rand() * 0.2 });
      else if (roll < 0.12) decor.push({ x, y, kind: "boulder", r: 0.18 + rand() * 0.14 });
      else if (roll < 0.2) decor.push({ x, y, kind: "tuft", r: 0.2 + rand() * 0.1 });
    }

  return {
    decor,
    cols,
    rows,
    gridW: W,
    gridH: H,
    tiles,
    roomAt,
    corridorAt,
    blockAt,
    gateAt,
    rooms,
    roomById,
    stations,
    stationByEncounter: new Map(stations.map((s) => [s.encounterId, s])),
    corridors,
    gates,
    sentries,
    plazaId: plaza.id,
    heartId: heart?.id ?? null,
    start: { x: plaza.x + 2, y: plaza.y + 3 },
    wingEntrances,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// queries

export function inBounds(p: Pt, cols: number, rows: number): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < cols && p.y < rows;
}

export function neighbours4(p: Pt): Pt[] {
  return [
    { x: p.x, y: p.y - 1 },
    { x: p.x + 1, y: p.y },
    { x: p.x, y: p.y + 1 },
    { x: p.x - 1, y: p.y },
  ];
}

function uniq(pts: Pt[]): Pt[] {
  const seen = new Set<string>();
  return pts.filter((p) => {
    const k = `${p.x},${p.y}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function tileKind(map: ExplorerMap, p: Pt): number {
  return inBounds(p, map.cols, map.rows) ? map.tiles[p.y * map.cols + p.x] : ROCK;
}

/** a gate stands open once every encounter it waits for is solved (derived from `solved`, never stored) */
export function gateOpen(gate: ExplorerGate, solved: ReadonlySet<string>): boolean {
  return gate.opensAfter.every((id) => solved.has(id));
}

export function gateAtTile(map: ExplorerMap, p: Pt): ExplorerGate | null {
  if (!inBounds(p, map.cols, map.rows)) return null;
  const g = map.gateAt[p.y * map.cols + p.x];
  return g === -1 ? null : map.gates[g];
}

/** floor, corridor or patrol lane; not a pedestal; not a closed gate */
export function isWalkable(map: ExplorerMap, p: Pt, solved: ReadonlySet<string>): boolean {
  if (!inBounds(p, map.cols, map.rows)) return false;
  const i = p.y * map.cols + p.x;
  if (map.tiles[i] === ROCK || map.blockAt[i] !== -1) return false;
  const g = map.gateAt[i];
  return g === -1 || gateOpen(map.gates[g], solved);
}

/**
 * Breadth-first path over walkable tiles (4-neighbour) from `from` to the nearest tile satisfying `goal`. Returns the
 * steps after `from` (empty when `from` already satisfies it) or null when no tile is reachable. Sentries are ignored:
 * dodging them is the player's timing.
 */
export function findPath(map: ExplorerMap, from: Pt, goal: (p: Pt) => boolean, solved: ReadonlySet<string>): Pt[] | null {
  if (goal(from)) return [];
  const n = map.cols * map.rows;
  const prev = new Int32Array(n).fill(-1);
  const start = from.y * map.cols + from.x;
  prev[start] = start;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cp = { x: cur % map.cols, y: Math.floor(cur / map.cols) };
    for (const nb of neighbours4(cp)) {
      if (!isWalkable(map, nb, solved)) continue;
      const ni = nb.y * map.cols + nb.x;
      if (prev[ni] !== -1) continue;
      prev[ni] = cur;
      if (goal(nb)) {
        const path: Pt[] = [];
        for (let k = ni; k !== start; k = prev[k]) path.push({ x: k % map.cols, y: Math.floor(k / map.cols) });
        return path.reverse();
      }
      queue.push(ni);
    }
  }
  return null;
}

export function pathToTile(map: ExplorerMap, from: Pt, to: Pt, solved: ReadonlySet<string>): Pt[] | null {
  if (!isWalkable(map, to, solved)) return null;
  return findPath(map, from, (p) => p.x === to.x && p.y === to.y, solved);
}

export function pathToStation(map: ExplorerMap, from: Pt, encounterId: string, solved: ReadonlySet<string>): Pt[] | null {
  const s = map.stationByEncounter.get(encounterId);
  if (!s) return null;
  const goals = new Set(s.approach.map((a) => `${a.x},${a.y}`));
  return findPath(map, from, (p) => goals.has(`${p.x},${p.y}`), solved);
}

/** stations whose pedestal is within one tile (diagonals included) of `p` */
export function stationsNear(map: ExplorerMap, p: Pt): ExplorerStation[] {
  return map.stations.filter((s) => s.block.some((b) => Math.abs(b.x - p.x) <= 1 && Math.abs(b.y - p.y) <= 1));
}

export function roomOf(map: ExplorerMap, p: Pt): ExplorerRoom | null {
  if (!inBounds(p, map.cols, map.rows)) return null;
  const r = map.roomAt[p.y * map.cols + p.x];
  return r === -1 ? null : map.rooms[r];
}

export function corridorOf(map: ExplorerMap, p: Pt): ExplorerCorridor | null {
  if (!inBounds(p, map.cols, map.rows)) return null;
  const c = map.corridorAt[p.y * map.cols + p.x];
  return c === -1 ? null : map.corridors[c];
}

/** where the avatar is, in words, for the side column */
export function placeName(map: ExplorerMap, p: Pt): { name: string; kind: "room" | "passage" | "lane" } {
  const room = roomOf(map, p);
  if (room) return { name: room.name, kind: "room" };
  const c = corridorOf(map, p);
  if (c) {
    const to = map.roomById.get(c.to)!;
    return { name: to.name, kind: tileKind(map, p) === ALCOVE ? "lane" : "passage" };
  }
  return { name: map.roomById.get(map.plazaId)!.name, kind: "room" };
}

/** the room ids from the plaza to `roomId`, plaza first */
export function roomTrail(map: ExplorerMap, roomId: string): string[] {
  const out: string[] = [];
  for (let r: ExplorerRoom | undefined = map.roomById.get(roomId); r; r = r.parent ? map.roomById.get(r.parent) : undefined) out.push(r.id);
  return out.reverse();
}

// ---------------------------------------------------------------------------------------------------------------------
// sentries

export function sentryPeriod(route: SentryRoute): number {
  return (route.tiles.length - 1) * 2;
}

/** index along the lane at tick t (ping-pong) */
export function sentryIndex(route: SentryRoute, t: number): number {
  const period = sentryPeriod(route);
  const k = (((t + route.phase) % period) + period) % period;
  return k < route.tiles.length ? k : period - k;
}

export function sentryAt(route: SentryRoute, t: number): Pt {
  return route.tiles[sentryIndex(route, t)];
}

/** the way the sentry is facing at tick t (toward its next tile) */
export function sentryFacing(route: SentryRoute, t: number): Dir {
  const a = sentryAt(route, t);
  const b = sentryAt(route, t + 1);
  if (b.x > a.x) return "right";
  if (b.x < a.x) return "left";
  if (b.y > a.y) return "down";
  return "up";
}

/** the sentry standing on `p` at tick t, if any */
export function caughtBy(map: ExplorerMap, p: Pt, t: number): SentryRoute | null {
  return map.sentries.find((s) => {
    const at = sentryAt(s, t);
    return at.x === p.x && at.y === p.y;
  }) ?? null;
}

// ---------------------------------------------------------------------------------------------------------------------
// fog of war

/**
 * Rooms drawn in full: the plaza and heart, rooms the avatar has visited or whose station is solved, and any room one
 * OPEN passage away from those. Everything else is fog (an outline only), so a gate swinging open reveals what lies past it.
 */
export function visibleRooms(map: ExplorerMap, visited: ReadonlySet<string>, solved: ReadonlySet<string>): Set<string> {
  const seen = new Set<string>([map.plazaId]);
  if (map.heartId) seen.add(map.heartId);
  for (const r of map.rooms) if (visited.has(r.id) || (r.encounterId && r.kind === "station" && solved.has(r.encounterId))) seen.add(r.id);
  const out = new Set(seen);
  for (const c of map.corridors) {
    const gate = map.gates.find((g) => g.corridorId === c.id);
    if (gate && !gateOpen(gate, solved)) continue;
    if (seen.has(c.from)) out.add(c.to);
    if (seen.has(c.to)) out.add(c.from);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// labels and requirements

/** "Montgomery bus boycott (1955–1956)" → { title: "Montgomery bus boycott", detail: "1955–1956" } */
export function splitName(name: string): { title: string; detail: string | null } {
  const m = /^(.*\S)\s*\(([^()]+)\)\s*$/.exec(name);
  return m ? { title: m[1], detail: m[2] } : { title: name, detail: null };
}

export const SOCKET_LABEL: Record<string, string> = {
  locked_gate: "Sealed gate",
  terminal: "Terminal",
  shrine: "Shrine",
  bridge: "Bridge",
  sentry: "Watchtower",
  cache: "Cache",
  heart: "Heart chamber",
};

export function socketLabel(socket: string): string {
  return SOCKET_LABEL[socket] ?? "Station";
}

/** concept names of the unsolved requirements of an encounter (deduplicated, spec order) */
export function needsFor(spec: Pick<GameSpec, "encounters" | "concepts">, p: Progression, encounterId: string, solved: ReadonlySet<string>): string[] {
  const node = p.byId.get(encounterId);
  if (!node) return [];
  const names = new Map(spec.concepts.map((c) => [c.id, c.name]));
  const out: string[] = [];
  for (const r of node.requires) {
    if (solved.has(r)) continue;
    const e = spec.encounters.find((x) => x.id === r);
    const n = e ? (names.get(e.conceptIds[0]) ?? humanize(e.id)) : humanize(r);
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

export function humanize(id: string): string {
  const s = id.replace(/^[a-z]\d+_/, "").replace(/_/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : id;
}

/** the tile paths the finale lights: from every station's pedestal to the heart (or the plaza when there is no boss) */
export function finalePaths(map: ExplorerMap, solved: ReadonlySet<string>): Pt[][] {
  const target = map.heartId ? map.stations.find((s) => s.roomId === map.heartId)! : null;
  const goalTiles = target ? new Set(target.approach.map((a) => `${a.x},${a.y}`)) : new Set([`${map.start.x},${map.start.y}`]);
  const out: Pt[][] = [];
  for (const s of map.stations) {
    if (s.roomId === map.heartId || s.approach.length === 0) continue;
    const from = s.approach[0];
    const path = findPath(map, from, (q) => goalTiles.has(`${q.x},${q.y}`), solved);
    if (path) out.push([from, ...path]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// colour helpers (palette-derived map colours)

function parseHex(h: string): [number, number, number] {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

/** linear mix of two #rrggbb colours: t=0 → a, t=1 → b */
export function mixHex(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** relative luminance 0..1 */
export function luminance(h: string): number {
  const [r, g, b] = parseHex(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Click-to-walk is polite: it waits a beat before stepping onto a patrol lane tile a sentry is on or one step from.
 * (Arrow-key walking never waits; dodging is then the player's timing.)
 */
export function shouldWait(map: ExplorerMap, next: Pt, t: number): boolean {
  return map.sentries.some((s) => {
    const k = s.tiles.findIndex((q) => q.x === next.x && q.y === next.y);
    return k !== -1 && Math.abs(sentryIndex(s, t) - k) <= 1;
  });
}

export type LabelSlot = "above" | "below" | "inside";
export interface LabelPlacement {
  slot: LabelSlot;
  /** rows the label may use (2 or LABEL_ROWS) */
  rows: number;
  /** the heart's "Heart chamber" heading fits */
  heading: boolean;
}
/** a label's footprint in tiles: LABEL_W wide centred on its room, LABEL_ROWS tall */
export const LABEL_W = 6.6;
export const LABEL_ROWS = 3;
/** labels may hang this many rows past the map's top and bottom edges (the host pads the map by as much) */
export const LABEL_MARGIN = 1;

/**
 * Where each room's name label goes, allocated jointly so labels never overlap each other or a corridor: the rock band
 * above the room, else below it, else "inside" (a single line across the room's top wall). The plaza's label is always
 * inside. The heart is placed first so the biggest label gets the best spot.
 */
export function labelSlots(map: ExplorerMap): Map<string, LabelPlacement> {
  const out = new Map<string, LabelPlacement>();
  const taken: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const order = [...map.rooms].sort((a, b) => rank(a) - rank(b));
  for (const room of order) {
    if (room.kind === "plaza") {
      out.set(room.id, { slot: "inside", rows: 1, heading: false });
      continue;
    }
    const cx = room.x + room.w / 2;
    const tryBand = (y0: number, rowsNeeded: number, overLanes: boolean) => {
      const b = { x0: cx - LABEL_W / 2, x1: cx + LABEL_W / 2, y0, y1: y0 + rowsNeeded };
      if (b.y0 < -LABEL_MARGIN || b.y1 > map.rows + LABEL_MARGIN) return null;
      // a label may cover rock or a plain corridor (and, second choice, a sentry lane), never a room or a gate
      for (let y = Math.max(0, y0); y < Math.min(map.rows, y0 + rowsNeeded); y++)
        for (let x = Math.floor(b.x0); x < Math.ceil(b.x1); x++) {
          const k = tileKind(map, { x, y });
          if (k === FLOOR || (k === ALCOVE && !overLanes) || (inBounds({ x, y }, map.cols, map.rows) && map.gateAt[y * map.cols + x] !== -1)) return null;
        }
      if (taken.some((t) => t.x0 < b.x1 && b.x0 < t.x1 && t.y0 < b.y1 && b.y0 < t.y1)) return null;
      return b;
    };
    const full = labelRows(room);
    // the heart may drop its heading line to fit a two-row band
    const tries = room.kind === "heart" && full > 2 ? [full, labelRows({ ...room, kind: "station" })] : [full];
    let placed: LabelPlacement = { slot: "inside", rows: 1, heading: false };
    search: for (const overLanes of [false, true])
      for (const rows of tries) {
        const above = tryBand(room.y - rows, rows, overLanes);
        const below = above ? null : tryBand(room.y + room.h, rows, overLanes);
        const pick = above ?? below;
        if (pick) {
          taken.push(pick);
          placed = { slot: above ? "above" : "below", rows, heading: room.kind === "heart" && rows === full };
          break search;
        }
      }
    out.set(room.id, placed);
  }
  return out;
}

/** rows a label needs: roughly 20 characters per line at 16px in LABEL_W tiles, plus the "(detail)" line and a heading for the heart */
export function labelRows(room: Pick<ExplorerRoom, "name" | "kind">): number {
  const { title, detail } = splitName(room.name);
  const lines = Math.ceil(title.length / 20) + (detail ? 1 : 0) + (room.kind === "heart" ? 1 : 0);
  return lines <= 2 ? 2 : LABEL_ROWS;
}

function rank(r: ExplorerRoom): number {
  return r.kind === "heart" ? -1 : r.kind === "plaza" ? -2 : r.order * 10 + r.track;
}
