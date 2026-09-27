import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import type { Encounter } from "../../../../contracts/gamespec";
import { buildProgression } from "../../../runner/progression";
import {
  BIT,
  MAX_GAP,
  MIN_GAP,
  alignTurn,
  canRotate,
  connects,
  coreCharged,
  effectiveTurns,
  fixSegment,
  floodPower,
  frontierSegments,
  generateBoard,
  isAligned,
  isSegmentSolved,
  listText,
  litPrefix,
  luminanceOf,
  misrotated,
  missingRequirements,
  mixHex,
  neighbour,
  opposite,
  powerColor,
  rotateMask,
  sealState,
  shortLabel,
  shortPremise,
  type Board,
} from "./puzzle.logic";

interface FixtureLike {
  id: string;
  seed: number;
  encounters: Encounter[];
  concepts: { id: string; unitId: string; name: string }[];
}

const FIXTURE_DIR = new URL("../../../../../fixtures/", import.meta.url);
const FIXTURES: FixtureLike[] = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(new URL(f, FIXTURE_DIR), "utf8")) as FixtureLike);

function boardFor(spec: Pick<FixtureLike, "seed" | "encounters"> & { concepts?: FixtureLike["concepts"] }) {
  const progression = buildProgression(spec as Parameters<typeof buildProgression>[0]);
  return { progression, board: generateBoard({ seed: spec.seed, encounters: spec.encounters, progression }) };
}

/** A synthetic spec: n encounters over `units` units, the last a boss when `boss`. */
function synthetic(n: number, opts: { boss?: boolean; units?: number; seed?: number } = {}) {
  const units = opts.units ?? 1;
  const concepts = Array.from({ length: Math.max(1, units) }, (_, u) => ({ id: `c${u}`, unitId: `u${u}`, name: `Concept number ${u}` }));
  const encounters = Array.from({ length: n }, (_, i) => ({
    id: `e${i + 1}`,
    conceptIds: [concepts[i % concepts.length].id],
    role: opts.boss !== false && i === n - 1 ? "boss" : i % 4 === 3 ? "review" : "teach",
  })) as unknown as Encounter[];
  return { id: `syn_${n}`, seed: opts.seed ?? 1234 + n, encounters, concepts };
}

const allSolved = (b: Board) => new Set(Object.keys(b.tileOf));

/** Every structural property a board must have, for any spec. */
function checkBoard(name: string, board: Board, progression: ReturnType<typeof buildProgression>) {
  const { tiles } = board;
  // routes are disjoint, contiguous, and match the progression's tracks in order
  const seen = new Set<number>();
  const tracks = progression.tracks.length === 0 ? [[]] : progression.tracks;
  expect(board.routes.map((r) => r.encounterIds), name).toEqual(tracks);
  for (const route of board.routes) {
    let prev = board.source;
    for (const c of route.cells) {
      expect(seen.has(c), `${name}: routes cross at ${c}`).toBe(false);
      seen.add(c);
      const d = [0, 1, 2, 3].find((dd) => neighbour(board, prev, dd) === c);
      expect(d, `${name}: route not contiguous`).toBeDefined();
      prev = c;
    }
    expect([0, 1, 2, 3].some((d) => neighbour(board, prev, d) === board.core), `${name}: route ends away from the core`).toBe(true);
    // seals appear along the route in track order
    const sealsAlong = route.cells.filter((c) => tiles[c].kind === "seal").map((c) => tiles[c].encounterId);
    expect(sealsAlong, name).toEqual(route.encounterIds);
  }
  // every non-boss encounter is a seal, the boss is the core
  for (const n of progression.nodes) {
    if (n.isBoss) expect(board.tileOf[n.id], name).toBe(board.core);
    else expect(tiles[board.tileOf[n.id]].kind, name).toBe("seal");
  }
  // 2..6 conduits between consecutive nodes
  for (const seg of board.segments) {
    expect(seg.cells.length, `${name}: segment ${seg.index}`).toBeGreaterThanOrEqual(MIN_GAP);
    expect(seg.cells.length, `${name}: segment ${seg.index}`).toBeLessThanOrEqual(MAX_GAP);
  }

  // solution: with every seal solved, power flows source → every seal → core along each route, in order
  const solved = allSolved(board);
  const powered = floodPower(board, board.solution, solved);
  for (const route of board.routes) {
    let prev = board.source;
    for (const c of [...route.cells, board.core]) {
      const d = [0, 1, 2, 3].find((dd) => neighbour(board, prev, dd) === c)!;
      expect(connects(board, board.solution, prev, d), `${name}: solution breaks at ${c}`).toBe(true);
      expect(powered[c], name).toBe(true);
      prev = c;
    }
  }
  expect(coreCharged(board, board.solution, powered), name).toBe(true);
  expect(litPrefix(board, board.solution, powered, solved), name).toEqual(board.routes.map((r) => r.cells.length));
  for (const seg of board.segments) expect(isSegmentSolved(board, seg, board.solution), name).toBe(true);

  // the solution never leaks: with nothing solved, power stops exactly at each route's first seal (or the core)
  const cold = floodPower(board, board.solution, new Set());
  for (const route of board.routes) {
    const firstSeal = route.cells.findIndex((c) => tiles[c].kind === "seal");
    const stop = firstSeal === -1 ? route.cells.length : firstSeal;
    route.cells.forEach((c, i) => expect(cold[c], `${name}: flood past an unsolved seal at ${i}`).toBe(i <= stop));
  }

  // scrambled start: no segment solved, no seal and no core powered
  for (const seg of board.segments) expect(isSegmentSolved(board, seg, board.start), `${name}: segment ${seg.index} starts solved`).toBe(false);
  const start = floodPower(board, board.start, new Set());
  for (const t of tiles) if (t.kind === "seal" || t.kind === "core") expect(start[t.index], `${name}: ${t.kind} starts powered`).toBe(false);
  expect(coreCharged(board, board.start, start), name).toBe(false);
}

describe("generateBoard: every fixture (all genres)", () => {
  for (const spec of FIXTURES) {
    it(`${spec.id} (${spec.encounters.length} encounters) is a solvable, scrambled, non-crossing board`, () => {
      const { board, progression } = boardFor(spec);
      checkBoard(spec.id, board, progression);
      expect(board.width).toBeGreaterThanOrEqual(5);
      expect(board.width).toBeLessThanOrEqual(13);
    });
  }

  it("is deterministic per seed and varies with the seed", () => {
    for (const spec of FIXTURES) {
      const a = boardFor(spec).board;
      const b = boardFor(spec).board;
      expect(a).toEqual(b);
      const c = boardFor({ ...spec, seed: spec.seed + 1 }).board;
      expect(c.start).not.toEqual(a.start);
    }
  });

  it("the trig puzzle showcase: 5 seals on 3 routes, core = boss, a compact board", () => {
    const spec = FIXTURES.find((s) => s.id.startsWith("trig") && (s as unknown as { genre: string }).genre === "puzzle")!;
    const { board } = boardFor(spec);
    expect(board.routes).toHaveLength(3);
    expect(board.bossId).toBe("e6_boss");
    expect(Object.keys(board.tileOf)).toHaveLength(6);
    expect(board.width * board.height).toBeLessThanOrEqual(80);
  });
});

describe("generateBoard: edge cases", () => {
  it("a single boss encounter: a sealless route straight from source to core", () => {
    const spec = synthetic(1, { boss: true });
    const { board, progression } = boardFor(spec);
    expect(progression.tracks).toEqual([]);
    expect(board.routes).toHaveLength(1);
    expect(board.routes[0].encounterIds).toEqual([]);
    checkBoard("boss-only", board, progression);
  });

  it("a single non-boss encounter (no boss): one seal, a plain core", () => {
    const spec = synthetic(1, { boss: false });
    const { board, progression } = boardFor(spec);
    expect(board.bossId).toBeNull();
    expect(board.tiles[board.core].encounterId).toBeNull();
    checkBoard("one-seal", board, progression);
  });

  it("20 encounters over 1, 2 and 3 units", () => {
    for (const units of [1, 2, 3, 5]) {
      const spec = synthetic(20, { units });
      const { board, progression } = boardFor(spec);
      checkBoard(`twenty/${units}`, board, progression);
      expect(board.width).toBeLessThanOrEqual(13);
      expect(board.height).toBeLessThanOrEqual(12);
    }
  });

  it("every size from 1 to 20, with and without a boss, over many seeds", () => {
    for (let n = 1; n <= 20; n++)
      for (const boss of [true, false])
        for (const seed of [1, 99, 4242]) {
          const spec = synthetic(n, { boss, units: 1 + (n % 3), seed: seed + n });
          const { board, progression } = boardFor(spec);
          checkBoard(`n${n}/${boss}/${seed}`, board, progression);
        }
  });
});

describe("rotation and openings", () => {
  it("rotates masks clockwise, any integer turn", () => {
    expect(rotateMask(BIT[0], 1)).toBe(BIT[1]);
    expect(rotateMask(BIT[0] | BIT[1], 1)).toBe(BIT[1] | BIT[2]);
    expect(rotateMask(BIT[3], 1)).toBe(BIT[0]);
    expect(rotateMask(BIT[0] | BIT[2], -1)).toBe(BIT[1] | BIT[3]);
    expect(rotateMask(BIT[0] | BIT[1] | BIT[2], 6)).toBe(rotateMask(BIT[0] | BIT[1] | BIT[2], 2));
    expect(opposite(0)).toBe(2);
    expect(opposite(3)).toBe(1);
  });

  it("alignTurn only turns forward and lands on an aligned rotation", () => {
    const { board } = boardFor(FIXTURES[0]);
    for (const t of board.tiles.filter((x) => x.need && x.rotatable))
      for (let turn = 0; turn < 8; turn++) {
        const a = alignTurn(t, turn);
        expect(a).toBeGreaterThanOrEqual(turn);
        expect(a - turn).toBeLessThan(4);
        expect(isAligned(t, a)).toBe(true);
      }
  });
});

describe("power flow during play", () => {
  const spec = FIXTURES.find((s) => (s as unknown as { genre: string }).genre === "puzzle") ?? FIXTURES[0];
  const { board, progression } = boardFor(spec);

  it("fixing a route's first segment powers its first seal, and it stops there until the seal is solved", () => {
    for (const route of board.routes) {
      const first = board.segments[route.segments[0]];
      const turns = fixSegment(board, board.start, first);
      const powered = floodPower(board, turns, new Set());
      if (first.toEncounterId === null || board.tiles[first.to].kind !== "seal") continue;
      expect(powered[first.to]).toBe(true);
      const next = board.segments[route.segments[1]];
      // even with the next segment fixed, power does not pass an unsolved seal
      const both = fixSegment(board, turns, next);
      expect(floodPower(board, both, new Set())[next.to]).toBe(false);
      expect(floodPower(board, both, new Set([first.toEncounterId]))[next.to]).toBe(true);
    }
  });

  it("frontier and misrotated point at the broken conduits of the segments power has reached", () => {
    const powered = floodPower(board, board.start, new Set());
    const frontier = frontierSegments(board, powered, new Set());
    expect(frontier.map((s) => s.index).sort()).toEqual(board.routes.map((r) => r.segments[0]).sort());
    const wrong = misrotated(board, board.start, frontier);
    expect(wrong.length).toBeGreaterThan(0);
    for (const c of wrong) expect(isAligned(board.tiles[c], board.start[c])).toBe(false);
    // after fixing, nothing is misrotated
    let turns = board.start;
    for (const s of frontier) turns = fixSegment(board, turns, s);
    expect(misrotated(board, turns, frontier)).toEqual([]);
  });

  it("effectiveTurns snaps the incoming segment of a seal solved without power (the debug path)", () => {
    const route = board.routes.find((r) => r.encounterIds.length >= 2)!;
    const [a, b] = route.encounterIds;
    const solved = new Set([a, b]);
    const eff = effectiveTurns(board, board.start, solved, false);
    for (const segIdx of route.segments.slice(0, 2)) expect(isSegmentSolved(board, board.segments[segIdx], eff)).toBe(true);
    const powered = floodPower(board, eff, solved);
    expect(powered[board.tileOf[a]]).toBe(true);
    expect(powered[board.tileOf[b]]).toBe(true);
    // fused conduits stop rotating; decoys and unfused conduits still rotate
    const fusedCell = board.segments[route.segments[0]].cells[0];
    expect(canRotate(board, fusedCell, solved, false)).toBe(false);
    const decoy = board.tiles.find((t) => t.rotatable && t.segment === -1);
    if (decoy) expect(canRotate(board, decoy.index, solved, false)).toBe(true);
  });

  it("finishing lights the whole board and charges the core", () => {
    const solved = new Set(Object.keys(board.tileOf));
    const eff = effectiveTurns(board, board.start, solved, true);
    const powered = floodPower(board, eff, solved);
    expect(coreCharged(board, eff, powered)).toBe(true);
    for (const r of board.routes) for (const c of r.cells) expect(powered[c]).toBe(true);
  });

  it("seal states and missing requirements", () => {
    expect(sealState({ solved: true, powered: false, available: false })).toBe("solved");
    expect(sealState({ solved: false, powered: true, available: true })).toBe("ready");
    expect(sealState({ solved: false, powered: true, available: false })).toBe("blocked");
    expect(sealState({ solved: false, powered: false, available: true })).toBe("unpowered");
    expect(sealState({ solved: false, powered: false, available: false })).toBe("dormant");
    const boss = progression.bossId!;
    expect(missingRequirements(progression, boss, new Set()).length).toBe(spec.encounters.length - 1);
    expect(missingRequirements(progression, boss, new Set(spec.encounters.map((e) => e.id)))).toEqual([]);
  });
});

describe("presentation helpers", () => {
  it("shortLabel truncates on a word boundary", () => {
    expect(shortLabel("Amplitude")).toBe("Amplitude");
    expect(shortLabel("Period of sin(bx) and cos(bx)", 12)).toBe("Period of…");
    expect(shortLabel("Supercalifragilistic", 8)).toBe("Superca…");
  });

  it("shortPremise keeps the first sentence", () => {
    expect(shortPremise("The orrery is dark. Fix it.")).toBe("The orrery is dark.");
    expect(shortPremise("x".repeat(300), 50)).toHaveLength(50);
  });

  it("listText joins with commas and a final 'and'", () => {
    expect(listText([])).toBe("");
    expect(listText(["A"])).toBe("A");
    expect(listText(["A", "B"])).toBe("A and B");
    expect(listText(["A", "B", "C"])).toBe("A, B and C");
  });

  it("powerColor brightens dark accents and keeps bright ones", () => {
    expect(luminanceOf(powerColor("#8a5a2b"))).toBeGreaterThanOrEqual(0.3);
    expect(luminanceOf("#ffffff")).toBeCloseTo(1);
    expect(powerColor("#4dd0e1")).toBe("#4dd0e1");
    expect(powerColor("#8a5a2b")).not.toBe("#8a5a2b");
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});
