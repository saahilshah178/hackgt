import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { GameSpec } from "../../../../contracts/gamespec";
import { buildProgression, unlockedIds, type Progression } from "../../../runner/progression";
import { seededRandom } from "../../types";
import {
  ALCOVE,
  CROSSING,
  FLOOR,
  HALL,
  ROCK,
  buildExplorerMap,
  caughtBy,
  finalePaths,
  gateOpen,
  isWalkable,
  LABEL_ROWS,
  LABEL_W,
  labelRows,
  labelSlots,
  shouldWait,
  sentryIndex,
  luminance,
  mixHex,
  needsFor,
  neighbours4,
  pathToStation,
  pathToTile,
  placeName,
  roomTrail,
  sentryAt,
  sentryPeriod,
  splitName,
  stationsNear,
  tileKind,
  visibleRooms,
  type ExplorerMap,
} from "./explorer.logic";

const FIXTURE_DIR = new URL("../../../../../fixtures/", import.meta.url);
const FIXTURES: GameSpec[] = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => GameSpec.safeParse(JSON.parse(readFileSync(new URL(f, FIXTURE_DIR), "utf8"))))
  .filter((r) => r.success)
  .map((r) => r.data!);
const SHOWCASE = FIXTURES.find((s) => s.id === "history_explorer_001")!;

function world(spec: GameSpec) {
  const p = buildProgression(spec);
  return { p, map: buildExplorerMap(spec, p) };
}

/** a spec with `n` encounters cloned from the showcase; `units` spreads the concepts over that many units */
function sized(n: number, opts: { boss?: boolean; units?: number } = {}): GameSpec {
  const boss = opts.boss ?? true;
  const units = opts.units ?? 1;
  const concepts = Array.from({ length: n }, (_, i) => ({ ...SHOWCASE.concepts[i % SHOWCASE.concepts.length], id: `k${i}`, name: `Concept ${i}`, unitId: `u${i % units}` }));
  const src = SHOWCASE.encounters;
  const encounters = Array.from({ length: n }, (_, i) => {
    const e = src[i % (src.length - 1)];
    return { ...e, id: `x${i + 1}`, conceptIds: [`k${i}`], role: boss && i === n - 1 ? ("boss" as const) : ("practice" as const) };
  });
  return { ...SHOWCASE, concepts, encounters, narrative: { ...SHOWCASE.narrative, beats: [] } };
}

const EDGE_SPECS: [string, GameSpec][] = [
  ["1 boss-only", sized(1)],
  ["1 no boss", sized(1, { boss: false })],
  ["2", sized(2)],
  ["5 no boss", sized(5, { boss: false })],
  ["20 one unit", sized(20)],
  ["20 three units", sized(20, { units: 3 })],
  ["20 lopsided units", { ...sized(20, { units: 2 }), concepts: sized(20).concepts.map((c, i) => ({ ...c, unitId: i < 17 ? "u0" : "u1" })) }],
];
const ALL: [string, GameSpec][] = [...FIXTURES.map((s) => [s.id, s] as [string, GameSpec]), ...EDGE_SPECS];

/** solve everything in a seeded topological order, asserting each available station is reachable by walking from the plaza */
function playThrough(map: ExplorerMap, p: Progression, seed: number): string[] {
  const rand = seededRandom(seed);
  const solved = new Set<string>();
  const order: string[] = [];
  let guard = 0;
  while (solved.size < p.nodes.length && guard++ < 200) {
    const open = unlockedIds(p, solved);
    expect(open.length).toBeGreaterThan(0);
    for (const id of open) expect(pathToStation(map, map.start, id, solved), `${id} reachable`).not.toBeNull();
    const pick = open[Math.floor(rand() * open.length)];
    solved.add(pick);
    order.push(pick);
  }
  return order;
}

describe("explorer map", () => {
  it("loads the showcase and the other fixtures", () => {
    expect(SHOWCASE).toBeDefined();
    expect(FIXTURES.length).toBeGreaterThanOrEqual(5);
  });

  it("is deterministic for a spec", () => {
    for (const [, spec] of ALL) {
      const a = world(spec).map;
      const b = world(spec).map;
      expect(JSON.stringify({ ...a, roomById: 0, stationByEncounter: 0, tiles: [...a.tiles] })).toBe(
        JSON.stringify({ ...b, roomById: 0, stationByEncounter: 0, tiles: [...b.tiles] }),
      );
    }
  });

  it("gives every encounter exactly one station room, named after its concept", () => {
    for (const [name, spec] of ALL) {
      const { map, p } = world(spec);
      expect(map.stations.map((s) => s.encounterId).sort(), name).toEqual(spec.encounters.map((e) => e.id).sort());
      for (const s of map.stations) {
        const room = map.roomById.get(s.roomId)!;
        const e = spec.encounters.find((x) => x.id === s.encounterId)!;
        const concept = spec.concepts.find((c) => c.id === e.conceptIds[0]);
        if (concept) expect(room.name).toBe(concept.name);
        expect(s.approach.length, `${name}/${s.encounterId} approach`).toBeGreaterThan(0);
        for (const b of s.block) expect(tileKind(map, b)).toBe(FLOOR);
      }
      if (p.bossId) expect(map.stationByEncounter.get(p.bossId)!.roomId).toBe(map.heartId);
      else expect(map.heartId).toBeNull();
    }
  });

  it("uses one wing per track, rooms in track order", () => {
    for (const [name, spec] of ALL) {
      const { map, p } = world(spec);
      p.tracks.forEach((track, t) => {
        track.forEach((id, order) => {
          const room = map.roomById.get(map.stationByEncounter.get(id)!.roomId)!;
          expect(room.track, name).toBe(t);
          expect(room.order).toBe(order);
          const parent = map.roomById.get(room.parent!)!;
          if (order === 0) expect(parent.id).toBe(map.plazaId);
          else expect(parent.track).toBe(t);
        });
      });
    }
  });

  it("starts on walkable plaza floor with the heart in view", () => {
    for (const [name, spec] of ALL) {
      const { map } = world(spec);
      expect(isWalkable(map, map.start, new Set()), name).toBe(true);
      expect(placeName(map, map.start).name).toBe("The crossroads");
      const vis = visibleRooms(map, new Set(), new Set());
      expect(vis.has(map.plazaId)).toBe(true);
      if (map.heartId) expect(vis.has(map.heartId)).toBe(true);
    }
  });

  it("makes every station reachable once its requirements are solved, in several topological orders", () => {
    for (const [, spec] of ALL) {
      const { map, p } = world(spec);
      for (const seed of [1, 2, 3]) expect(playThrough(map, p, seed)).toHaveLength(p.nodes.length);
    }
  });

  it("keeps deeper rooms behind closed gates until the previous station on the wing is solved", () => {
    for (const [name, spec] of ALL) {
      const { map, p } = world(spec);
      for (const track of p.tracks)
        for (let i = 1; i < track.length; i++) {
          // everything solved except the previous station on this wing
          const solved = new Set(p.nodes.map((n) => n.id).filter((id) => id !== track[i - 1]));
          expect(pathToStation(map, map.start, track[i], solved), `${name}/${track[i]}`).toBeNull();
        }
      if (p.bossId && p.byId.get(p.bossId)!.requires.length > 0) {
        expect(pathToStation(map, map.start, p.bossId, new Set()), `${name} heart sealed`).toBeNull();
        const all = new Set(p.nodes.map((n) => n.id));
        expect(map.gates.find((g) => g.kind === "door")!.tiles).toHaveLength(2);
        expect(gateOpen(map.gates.find((g) => g.kind === "door")!, all)).toBe(true);
      }
    }
  });

  it("never connects rooms except through carved corridors (no leaks between neighbouring cells)", () => {
    for (const [name, spec] of ALL) {
      const { map } = world(spec);
      for (let y = 0; y < map.rows; y++)
        for (let x = 0; x < map.cols; x++) {
          const k = tileKind(map, { x, y });
          if (k === ROCK) continue;
          for (const n of neighbours4({ x, y })) {
            const nk = tileKind(map, n);
            if (nk === ROCK) continue;
            // two different rooms never touch
            if (k === FLOOR && nk === FLOOR) expect(map.roomAt[y * map.cols + x], name).toBe(map.roomAt[n.y * map.cols + n.x]);
            // a patrol lane only touches its own corridor
            if (k === ALCOVE) {
              expect(nk, `${name} lane at ${x},${y}`).not.toBe(FLOOR);
              expect(map.corridorAt[n.y * map.cols + n.x]).toBe(map.corridorAt[y * map.cols + x]);
            }
          }
        }
    }
  });
});

describe("sentries", () => {
  it("patrol only in corridors after each wing's first room, off gates and pedestals", () => {
    for (const [name, spec] of ALL) {
      const { map } = world(spec);
      for (const s of map.sentries) {
        const corridor = map.corridors.find((c) => c.id === s.corridorId)!;
        expect(map.roomById.get(corridor.to)!.order, name).toBeGreaterThan(0);
        s.tiles.forEach((t, i) => {
          expect(tileKind(map, t)).toBe(i === CROSSING ? HALL : ALCOVE);
          expect(map.gateAt[t.y * map.cols + t.x]).toBe(-1);
          expect(map.blockAt[t.y * map.cols + t.x]).toBe(-1);
        });
        expect(corridor.tiles.some((c) => c.x === s.tiles[CROSSING].x && c.y === s.tiles[CROSSING].y)).toBe(true);
      }
      // every gated wing corridor gets a sentry
      for (const g of map.gates.filter((x) => x.kind === "gate")) expect(map.sentries.some((s) => s.corridorId === g.corridorId), `${name}/${g.id}`).toBe(true);
    }
    expect(world(SHOWCASE).map.sentries.length).toBeGreaterThanOrEqual(3);
  });

  it("never block a tile permanently: the crossing is free for at least two ticks in a row every period", () => {
    for (const [, spec] of ALL) {
      const { map } = world(spec);
      for (const s of map.sentries) {
        const period = sentryPeriod(s);
        const cross = s.tiles[CROSSING];
        const busy = Array.from({ length: period * 2 }, (_, t) => map.sentries.some((o) => sentryAt(o, t).x === cross.x && sentryAt(o, t).y === cross.y));
        let best = 0;
        let run = 0;
        for (const b of busy) {
          run = b ? 0 : run + 1;
          best = Math.max(best, run);
        }
        expect(best).toBeGreaterThanOrEqual(2);
        for (const tile of s.tiles) expect(Array.from({ length: period }, (_, t) => sentryAt(s, t)).some((q) => q.x !== tile.x || q.y !== tile.y)).toBe(true);
      }
    }
  });

  it("moves one tile per tick and catches an avatar standing where it steps", () => {
    const { map } = world(SHOWCASE);
    const s = map.sentries[0];
    for (let t = 0; t < 20; t++) {
      const a = sentryAt(s, t);
      const b = sentryAt(s, t + 1);
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
      expect(caughtBy(map, a, t)?.id).toBe(s.id);
    }
    expect(caughtBy(map, map.start, 0)).toBeNull();
  });
});

describe("fog, labels and helpers", () => {
  it("reveals a room once its gate opens next to a visited or solved room", () => {
    const { map, p } = world(SHOWCASE);
    const track = p.tracks.find((t) => t.length >= 2)!;
    const second = map.stationByEncounter.get(track[1])!.roomId;
    const first = map.stationByEncounter.get(track[0])!.roomId;
    expect(visibleRooms(map, new Set(), new Set()).has(first)).toBe(true);
    expect(visibleRooms(map, new Set([first]), new Set()).has(second)).toBe(false);
    expect(visibleRooms(map, new Set([first]), new Set([track[0]])).has(second)).toBe(true);
  });

  it("names places, trails and requirements", () => {
    const { map, p } = world(SHOWCASE);
    expect(splitName("Montgomery bus boycott (1955–1956)")).toEqual({ title: "Montgomery bus boycott", detail: "1955–1956" });
    expect(splitName("Primary vs. secondary sources")).toEqual({ title: "Primary vs. secondary sources", detail: null });
    const deep = p.tracks[0][2];
    const trail = roomTrail(map, map.stationByEncounter.get(deep)!.roomId);
    expect(trail[0]).toBe(map.plazaId);
    expect(trail).toHaveLength(4);
    expect(needsFor(SHOWCASE, p, p.bossId!, new Set()).length).toBeGreaterThan(3);
    expect(needsFor(SHOWCASE, p, p.tracks[0][0], new Set())).toEqual([]);
  });

  it("finds adjacent stations and walks to tiles", () => {
    const { map } = world(SHOWCASE);
    const s = map.stations[0];
    expect(stationsNear(map, s.approach[0]).map((x) => x.encounterId)).toContain(s.encounterId);
    expect(pathToTile(map, map.start, map.start, new Set())).toEqual([]);
    expect(pathToTile(map, map.start, { x: 0, y: 0 }, new Set())).toBeNull();
  });

  it("lights a finale path from every station to the heart", () => {
    const { map, p } = world(SHOWCASE);
    const all = new Set(p.nodes.map((n) => n.id));
    expect(finalePaths(map, all)).toHaveLength(map.stations.length - 1);
  });

  it("places labels in clear rock bands and makes click-walk wait for sentries", () => {
    for (const [, spec] of ALL) {
      const { map } = world(spec);
      const slots = labelSlots(map);
      expect(slots.size).toBe(map.rooms.length);
      const boxes = map.rooms
        .filter((r) => slots.get(r.id)!.slot !== "inside")
        .map((r) => {
          const { rows, slot } = slots.get(r.id)!;
          expect(rows).toBeLessThanOrEqual(LABEL_ROWS);
          expect(rows).toBeGreaterThanOrEqual(labelRows({ ...r, kind: "station" }));
          const y0 = slot === "above" ? r.y - rows : r.y + r.h;
          return { x0: r.x + r.w / 2 - LABEL_W / 2, x1: r.x + r.w / 2 + LABEL_W / 2, y0, y1: y0 + rows };
        });
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          expect(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1).toBe(false);
        }
      for (const s of map.sentries)
        for (let t = 0; t < sentryPeriod(s); t++) {
          const cross = s.tiles[CROSSING];
          expect(shouldWait(map, cross, t)).toBe(Math.abs(sentryIndex(s, t) - CROSSING) <= 1);
        }
    }
  });

  it("mixes palette colours", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(luminance("#ffffff")).toBeCloseTo(1);
    expect(luminance("#000000")).toBe(0);
  });
});
