import { describe, expect, it } from "vitest";
import trigWorld from "../../../../fixtures/worlds/trig.world.json";
import {
  atConsole,
  consoleSpot,
  EXPRESS_MAX_WALKS,
  EXPRESS_READ_MS,
  EXPRESS_TOAST_MS,
  expressAdvanceDelay,
  expressAllows,
  expressTrims,
  nextExpressAction,
  nextZoneToward,
  pendingRide,
  routeOut,
  type ExpressWorld,
} from "./express";
import type { Phase } from "./machine";

const EXPLORE: Phase = { kind: "explore" };

/** A three-zone world shaped like the trig side-car: z1 → z2 (exit), a lift inside z2, z2 → z3 (exit). */
const WORLD: ExpressWorld = {
  finaleCutsceneId: "finale",
  zones: [
    { id: "z1", exits: [{ x: 7990, surface: "ground", toZoneId: "z2" }] },
    { id: "z2", exits: [{ x: 9590, surface: "ground", toZoneId: "z3" }] },
    { id: "z3", exits: [] },
  ],
  stations: [
    { encounterId: "e1", zoneId: "z1", consoleX: 4300, consoleSurface: "ground", payoff: { kind: "terrain", rideCutsceneId: null } },
    { encounterId: "e2", zoneId: "z1", consoleX: 6900, consoleSurface: "ground", payoff: { kind: "remove_blocker", rideCutsceneId: null } },
    { encounterId: "e3", zoneId: "z2", consoleX: 1500, consoleSurface: "ground", payoff: { kind: "ride", rideCutsceneId: "e3_lift_up" } },
    { encounterId: "e4", zoneId: "z2", consoleX: 3900, consoleSurface: "ground", payoff: { kind: "terrain", rideCutsceneId: null } },
    { encounterId: "e6", zoneId: "z3", consoleX: 3550, consoleSurface: "ground", payoff: { kind: "remove_blocker", rideCutsceneId: null } },
  ],
};

describe("express: walk to the console, then interact", () => {
  it("after ASSETS_READY the player walks to the first console (left of it, inside the interact radius)", () => {
    const a = nextExpressAction(EXPLORE, { solvedIds: [], currentId: "e1" }, WORLD, { zoneId: "z1", x: 360, surface: "ground" });
    expect(a).toEqual({ kind: "walkTo", x: 4260, surface: "ground", reason: "station", encounterId: "e1" });
  });
  it("at the console it dispatches INTERACT_STATION", () => {
    const a = nextExpressAction(EXPLORE, { solvedIds: [], currentId: "e1" }, WORLD, { zoneId: "z1", x: 4262, surface: "ground" });
    expect(a).toEqual({ kind: "interact", encounterId: "e1" });
  });
  it("after PAYOFF_DONE it walks on to the next console", () => {
    const a = nextExpressAction(EXPLORE, { solvedIds: ["e1"], currentId: "e2" }, WORLD, { zoneId: "z1", x: 4262, surface: "ground" });
    expect(a).toMatchObject({ kind: "walkTo", x: 6860, reason: "station" });
  });
  it("a station in the next zone is reached through the zone exit", () => {
    const a = nextExpressAction(EXPLORE, { solvedIds: ["e1", "e2"], currentId: "e3" }, WORLD, { zoneId: "z1", x: 6862, surface: "ground" });
    expect(a).toEqual({ kind: "walkTo", x: 7991, surface: "ground", reason: "exit", encounterId: "e3" });
  });
  it("the lift a ride payoff raised comes first, even inside the same zone; once ridden, walk on", () => {
    const progress = { solvedIds: ["e1", "e2", "e3"], currentId: "e4" };
    const player = { zoneId: "z2", x: 1460, surface: "ground" };
    expect(nextExpressAction(EXPLORE, progress, WORLD, player)).toEqual({ kind: "ride", encounterId: "e3", cutsceneId: "e3_lift_up" });
    expect(nextExpressAction(EXPLORE, progress, WORLD, player, { ridden: new Set(["e3"]) })).toMatchObject({ kind: "walkTo", x: 3860 });
  });
  it("repeated failed walks fall back to a warp (the rehearsal never stalls)", () => {
    const a = nextExpressAction(EXPLORE, { solvedIds: [], currentId: "e1" }, WORLD, { zoneId: "z1", x: 360, surface: "ground" }, { attempts: EXPRESS_MAX_WALKS });
    expect(a).toEqual({ kind: "warp", encounterId: "e1" });
  });
  it("an unreachable zone (no exit, no ride) warps", () => {
    const a = nextExpressAction(EXPLORE, { solvedIds: ["e1", "e2", "e3", "e4"], currentId: "e6" }, { ...WORLD, zones: WORLD.zones.map((z) => ({ ...z, exits: [] })) }, { zoneId: "z2", x: 4000, surface: "ground" });
    expect(a).toEqual({ kind: "warp", encounterId: "e6" });
  });
  it("does nothing until the host reports the player, with no current station, or outside explore", () => {
    expect(nextExpressAction(EXPLORE, { solvedIds: [], currentId: "e1" }, WORLD, null)).toBeNull();
    expect(nextExpressAction(EXPLORE, { solvedIds: ["e1", "e2", "e3", "e4", "e6"], currentId: null }, WORLD, { zoneId: "z3", x: 0, surface: "ground" })).toBeNull();
    const player = { zoneId: "z1", x: 360, surface: "ground" };
    const others: Phase[] = [
      { kind: "loading" },
      { kind: "panel", encounterId: "e1" },
      { kind: "resolving", encounterId: "e1", correct: true },
      { kind: "payoff", encounterId: "e1" },
      { kind: "sandbox", sandboxId: "box" },
      { kind: "finished" },
      { kind: "finale", cutsceneId: "finale", clearedId: "e6" },
    ];
    for (const p of others) expect(nextExpressAction(p, { solvedIds: [], currentId: "e1" }, WORLD, player)).toBeNull();
  });
  it("an unknown current station does nothing", () => {
    expect(nextExpressAction(EXPLORE, { solvedIds: [], currentId: "nope" }, WORLD, { zoneId: "z1", x: 0, surface: "ground" })).toBeNull();
  });
});

describe("express: cutscenes and lines", () => {
  it("every cutscene but the finale is trimmed", () => {
    expect(nextExpressAction({ kind: "intro", cutsceneId: "intro" }, { solvedIds: [], currentId: "e1" }, WORLD, null)).toEqual({ kind: "trimCutscene", cutsceneId: "intro" });
    expect(nextExpressAction({ kind: "cutscene", cutsceneId: "e6_arena", purpose: "arena" }, { solvedIds: [], currentId: "e6" }, WORLD, null)).toEqual({
      kind: "trimCutscene",
      cutsceneId: "e6_arena",
    });
    expect(expressTrims("finale", "finale")).toBe(false);
    expect(expressTrims("z2_entry", "finale")).toBe(true);
    expect(expressTrims("intro", null)).toBe(true);
  });
  it("completed lines advance after a short read (blocking ones sooner); typing lines and non-express never do", () => {
    expect(expressAdvanceDelay(true, { typing: false, blocking: true })).toBe(EXPRESS_READ_MS);
    expect(expressAdvanceDelay(true, { typing: false, blocking: false })).toBe(EXPRESS_TOAST_MS);
    expect(EXPRESS_TOAST_MS).toBeLessThan(2500); // shorter than the engine's minimum toast
    expect(expressAdvanceDelay(true, { typing: true, blocking: true })).toBeNull();
    expect(expressAdvanceDelay(false, { typing: false, blocking: true })).toBeNull();
    expect(expressAdvanceDelay(false, { typing: false, blocking: false })).toBeNull();
    expect(expressAdvanceDelay(true, null)).toBeNull();
  });
  it("side content is off in express", () => {
    expect(expressAllows("approach_line", true)).toBe(false);
    expect(expressAllows("sandbox", true)).toBe(false);
    expect(expressAllows("quest", true)).toBe(false);
    expect(expressAllows("approach_line", false)).toBe(true);
  });
});

describe("express helpers", () => {
  it("consoleSpot and atConsole agree", () => {
    const st = WORLD.stations[0];
    const spot = consoleSpot(st);
    expect(atConsole({ zoneId: "z1", ...spot }, st)).toBe(true);
    expect(atConsole({ zoneId: "z2", ...spot }, st)).toBe(false);
    expect(atConsole({ zoneId: "z1", x: spot.x, surface: "ledge" }, st)).toBe(false);
    expect(consoleSpot({ consoleX: 10, consoleSurface: "ground" }).x).toBe(0);
  });
  it("nextZoneToward follows zone order both ways", () => {
    expect(nextZoneToward(WORLD, "z1", "z3")).toBe("z2");
    expect(nextZoneToward(WORLD, "z3", "z1")).toBe("z2");
    expect(nextZoneToward(WORLD, "z2", "z2")).toBeNull();
    expect(nextZoneToward(WORLD, "zz", "z2")).toBeNull();
  });
  it("routeOut prefers the direct exit, then the next zone's", () => {
    expect(routeOut(WORLD, { solvedIds: ["e1", "e2"], currentId: "e3" }, "z1", "z3")).toEqual({ kind: "exit", x: 7991, surface: "ground" });
  });
  it("pendingRide only offers the LATEST solved station's vehicle", () => {
    expect(pendingRide(WORLD, { solvedIds: ["e1", "e2", "e3", "e4"], currentId: "e6" }, "z2")).toBeNull();
    expect(pendingRide(WORLD, { solvedIds: ["e1", "e2", "e3"], currentId: "e4" }, "z2")).toMatchObject({ encounterId: "e3" });
  });
});

describe("express on the real trig side-car", () => {
  const w = trigWorld.world;
  const world: ExpressWorld = {
    finaleCutsceneId: w.story.finaleCutsceneId,
    zones: w.zones.map((z) => ({ id: z.id, exits: z.exits.map((e) => ({ x: e.x, surface: e.surface, toZoneId: e.toZoneId })) })),
    stations: w.stations.map((s) => ({
      encounterId: s.encounterId,
      zoneId: s.zoneId,
      consoleX: s.consoleX,
      consoleSurface: (s as { consoleSurface?: string }).consoleSurface ?? "ground",
      payoff: { kind: s.payoff.kind as "terrain" | "ride" | "remove_blocker" | "carry", rideCutsceneId: s.payoff.rideCutsceneId },
    })),
  };
  it("walks every station in order, crossing both zone exits and riding the Echo Lift", () => {
    const solved: string[] = [];
    const ridden = new Set<string>();
    let player = { zoneId: w.zones[0].id, x: w.zones[0].entry.x, surface: "ground" };
    const log: string[] = [];
    for (let guard = 0; guard < 60; guard++) {
      const currentId = world.stations.find((s) => !solved.includes(s.encounterId))?.encounterId ?? null;
      const a = nextExpressAction(EXPLORE, { solvedIds: solved, currentId }, world, player, { ridden });
      if (!a) break;
      log.push(a.kind);
      if (a.kind === "walkTo" && a.reason === "station") player = { ...player, x: a.x, surface: a.surface };
      else if (a.kind === "walkTo") {
        const zone = w.zones.find((z) => z.id === player.zoneId)!;
        const exit = zone.exits[0];
        player = { zoneId: exit.toZoneId, x: exit.toX, surface: exit.toSurface };
      } else if (a.kind === "ride") ridden.add(a.encounterId);
      else if (a.kind === "interact") solved.push(a.encounterId);
      else throw new Error(`unexpected ${a.kind}`);
    }
    expect(solved).toEqual(world.stations.map((s) => s.encounterId));
    expect(log.filter((k) => k === "ride")).toHaveLength(1);
    expect(log).not.toContain("warp");
  });
});
