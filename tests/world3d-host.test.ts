import { describe, expect, it } from "vitest";
import egyptJson from "../fixtures/ancient-egypt-world3d.json";
import { GameSpec } from "../src/contracts/gamespec";
import { buildMoments, currentAct, leads, momentForNpc, nearestTarget, targetCandidates, withArticle } from "../src/game/world3d/model";
import { buildPhysics, step } from "../src/game/world3d/physics";
import { EncounterRunner } from "../src/game/runner/encounter-runner";
import { composeWorld } from "../src/world3d/core/compose";
import { spatialChecks } from "../src/world3d/core/spatial-checks";

/*
 * The world3d host's pure logic on the Egypt showcase: moments resolve to places, leads follow the unlock graph,
 * E picks the right target, the player can't walk into the river or through the pyramid, and the whole game is
 * winnable through the free-order runner.
 */

const spec = GameSpec.parse(egyptJson);
const world = spec.world3d!;
const composed = composeWorld(world, { res: 201, quality: "low" });

describe("world3d host model (Egypt showcase)", () => {
  it("anchors every encounter to a place in the world", () => {
    const moments = buildMoments(spec, composed);
    expect([...moments.keys()].sort()).toEqual(spec.encounters.map((e) => e.id).sort());
    expect(moments.get("e3_signs")?.label).toBe("Talk to Nebet");
    expect(moments.get("e1_flood")?.label).toBe("Read the Nilometer");
    expect(moments.get("e10_capstone")?.anchor).toEqual({ kind: "landmark", id: "great_pyramid" });
  });

  it("is spatially sound and the goal is visible from the spawn", () => {
    const report = spatialChecks(spec, composed);
    expect(report.issues).toEqual([]);
    expect(report.stats.goalVisibleFromSpawn).toBe(true);
    expect(report.stats.tourMinutes).toBeLessThanOrEqual(spec.targetMinutes * 0.4);
  });

  it("offers leads from the unlock graph, current act first", () => {
    const moments = buildMoments(spec, composed);
    const runner = new EncounterRunner(spec, { order: "free" });
    const act = currentAct(world, runner.solved());
    expect(act).toBe(0);
    const list = leads(moments, runner.available(), composed.spawn, act);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((m) => runner.available().includes(m.encounterId))).toBe(true);
    expect(list[0].actIndex).toBe(0);
    expect(list.some((m) => m.encounterId === "e10_capstone")).toBe(false);
  });

  it("targets the npc the player walks up to, and relics before buildings", () => {
    const moments = buildMoments(spec, composed);
    const nebet = composed.npcs.find((n) => n.id === "nebet")!;
    const pose = { x: nebet.x, y: nebet.y, z: nebet.z + 2, yaw: Math.PI }; // facing north, toward her
    const t = nearestTarget(pose, targetCandidates({ world, composed, moments, npcPoses: {}, collected: new Set(), animals: [] }));
    expect(t).toMatchObject({ kind: "npc", id: "nebet" });
    const far = nearestTarget({ x: 0, y: 0, z: 270, yaw: 0 }, targetCandidates({ world, composed, moments, npcPoses: {}, collected: new Set(), animals: [] }));
    expect(far).toBeNull();
    expect(momentForNpc(moments, "meryt", new Set())?.encounterId).toBe("e8_gods");
    expect(withArticle("South Obelisk")).toBe("the South Obelisk");
    expect(withArticle("The Great Pyramid")).toBe("the Great Pyramid");
  });

  it("the whole game is winnable in free order", () => {
    const runner = new EncounterRunner(spec, { order: "free" });
    let guard = 0;
    while (!runner.finished && guard++ < 50) {
      const [next] = runner.available();
      runner.focus(next);
      runner.autoSolve();
    }
    expect(runner.finished).toBe(true);
  });
});

describe("world3d physics", () => {
  const ph = buildPhysics(composed);

  it("keeps the player out of the deep river", () => {
    const river = composed.hf.river[Math.floor(composed.hf.river.length / 2)];
    expect(ph.standable(river.x, river.z, 0)).toBe(false);
  });

  it("does not let the player walk through the pyramid", () => {
    const g = composed.goal!;
    let body = { x: g.x, y: 0, z: g.z + g.radius + 3, vy: 0, grounded: true };
    body.y = ph.ground(body.x, body.z);
    for (let i = 0; i < 120; i++) body = step(ph, body, { dx: 0, dz: -0.2 }, false, 1 / 60);
    expect(body.z).toBeGreaterThan(g.z + g.radius * 0.9);
  });

  it("jumps from the ground and lands again", () => {
    const s = composed.spawn;
    let body = { x: s.x, y: ph.ground(s.x, s.z), z: s.z, vy: 0, grounded: true };
    body = step(ph, body, { dx: 0, dz: 0 }, true, 1 / 60);
    expect(body.grounded).toBe(false);
    for (let i = 0; i < 90; i++) body = step(ph, body, { dx: 0, dz: 0 }, false, 1 / 60);
    expect(body.grounded).toBe(true);
    expect(body.y).toBeCloseTo(ph.ground(body.x, body.z), 3);
  });
});
