import { describe, expect, it } from "vitest";
import { inputToward, linkForKey, NO_INPUT, spawn, stepCharacter, RUN_SPEED, WALK_SPEED, type CharCtx, type CharState } from "./character";
import { buildSurfaces } from "./surfaces";
import { blockers, sheerEdges } from "./terrain";
import { reqCtxOf, requirementMet } from "./requirements";
import { TEST_ZONE } from "./test-zone";

function ctx(over: Partial<CharCtx> = {}, solved: string[] = []): CharCtx {
  const rc = reqCtxOf(solved, null);
  const model = buildSurfaces(TEST_ZONE, rc, []);
  return {
    model,
    edges: sheerEdges(model.ground.points, model.maxStepUp),
    blockers: [],
    links: TEST_ZONE.links,
    reqOk: (r) => requirementMet(r, rc),
    tSec: 0,
    runEnabled: true,
    speedScale: 1,
    frozen: false,
    ...over,
  };
}
function run(s: CharState, input: typeof NO_INPUT, c: CharCtx, seconds: number, dt = 1 / 60) {
  const events: string[] = [];
  for (let t = 0; t < seconds; t += dt) {
    const r = stepCharacter(s, input, c, dt);
    s = r.state;
    for (const e of r.events) events.push(e.type === "link_used" ? `link_used:${e.linkId}:${e.landed}` : e.type);
  }
  return { s, events };
}

describe("character controller", () => {
  it("walks at 300 units/s and runs at 460 (after the 90 ms ramp)", () => {
    const c = ctx();
    const w = run(spawn(c.model, 100, "ground"), { ...NO_INPUT, right: true }, c, 1);
    expect(w.s.x - 100).toBeGreaterThan(WALK_SPEED * 0.85);
    expect(w.s.x - 100).toBeLessThan(WALK_SPEED * 1.01);
    expect(w.s.motion).toBe("walk");
    const r = run(spawn(c.model, 100, "ground"), { ...NO_INPUT, right: true, run: true }, c, 1);
    expect(r.s.x - 100).toBeGreaterThan(RUN_SPEED * 0.85);
    expect(r.s.motion).toBe("run");
    const noRun = run(spawn(c.model, 100, "ground"), { ...NO_INPUT, right: true, run: true }, ctx({ runEnabled: false }), 1);
    expect(noRun.s.x - 100).toBeLessThan(WALK_SPEED * 1.01);
    const back = run(spawn(c.model, 600, "ground"), { ...NO_INPUT, left: true }, c, 0.5);
    expect(back.s.facing).toBe(-1);
    const idle = run(w.s, NO_INPUT, c, 1);
    expect(idle.s.motion).toBe("idle");
    expect(idle.s.vx).toBe(0);
  });

  it("a sheer rise stops the walk; the climb link crosses it; walking back off the top is blocked too", () => {
    const c = ctx();
    const w = run(spawn(c.model, 900, "ground"), { ...NO_INPUT, right: true }, c, 2);
    expect(w.s.x).toBeLessThan(1000);
    expect(w.events).toContain("blocked");
    const at = run(spawn(c.model, 985, "ground"), { ...NO_INPUT, up: true }, c, 1 / 60);
    const climbed = run(at.s, NO_INPUT, c, 2);
    expect(climbed.s.y).toBe(640);
    expect(climbed.events).toContain("link_used:climb_rise:to");
    const down = run(spawn(c.model, 1100, "ground"), { ...NO_INPUT, left: true }, c, 2);
    expect(down.s.x).toBeGreaterThan(1004);
  });

  it("a SHEER DESCENT blocks walking; the drop link crosses it, the reverse ladder climbs back", () => {
    const c = ctx();
    const w = run(spawn(c.model, 2300, "ground"), { ...NO_INPUT, right: true }, c, 2);
    expect(w.s.x).toBeLessThan(2400);
    expect(w.s.y).toBe(640);
    const d0 = run(spawn(c.model, 2380, "ground"), { ...NO_INPUT, down: true }, c, 1 / 60);
    const dropped = run(d0.s, NO_INPUT, c, 2);
    expect(dropped.s).toMatchObject({ x: 2440, y: 960 });
    expect(dropped.events).toContain("link_used:drop_edge:to");
    const up0 = run(spawn(c.model, 2450, "ground"), { ...NO_INPUT, up: true }, c, 1 / 60);
    const up = run(up0.s, NO_INPUT, c, 2);
    expect(up.s).toMatchObject({ x: 2370, y: 640 });
    const stuck = run(spawn(c.model, 2500, "ground"), { ...NO_INPUT, left: true }, c, 2);
    expect(stuck.s.x).toBeGreaterThan(2404);
  });

  it("Space hops onto a platform, cosmetic-hops with no link, and walking off the platform end drops", () => {
    const c = ctx();
    const h0 = run(spawn(c.model, 360, "ground"), { ...NO_INPUT, hop: true }, c, 1 / 60);
    expect(h0.s.path?.kind).toBe("hop");
    const h = run(h0.s, NO_INPUT, c, 1);
    expect(h.s.surface).toBe("ledge");
    const cos0 = stepCharacter(spawn(c.model, 200, "ground"), { ...NO_INPUT, hop: true }, c, 1 / 60);
    expect(cos0.state.path?.kind).toBe("cosmetic");
    const cos = run(cos0.state, NO_INPUT, c, 1);
    expect(cos.s).toMatchObject({ surface: "ground", x: 200, y: 800 });
    const off = run(spawn(c.model, 690, "ledge"), { ...NO_INPUT, right: true }, c, 1.5);
    expect(off.s.surface).toBe("ground");
    expect(off.s.y).toBe(800);
  });

  it("W / ↑ hops like Space when no climb, ladder or ride link is in range", () => {
    const c = ctx();
    const h0 = run(spawn(c.model, 360, "ground"), { ...NO_INPUT, up: true }, c, 1 / 60);
    expect(h0.s.path?.kind).toBe("hop");
    const cos0 = stepCharacter(spawn(c.model, 200, "ground"), { ...NO_INPUT, up: true }, c, 1 / 60);
    expect(cos0.state.path?.kind).toBe("cosmetic");
    expect(cos0.events).toContainEqual({ type: "hop", cosmetic: true });
  });

  it("rides and timed hops (both outcomes) run from their keys", () => {
    const c = ctx();
    const r0 = run(spawn(c.model, 1500, "ground"), { ...NO_INPUT, interact: true }, c, 1 / 60);
    expect(r0.s.path?.kind).toBe("ride");
    const r = run(r0.s, NO_INPUT, c, 2);
    expect(r.s.x).toBe(1800);
    const cHit = ctx({ tSec: 0.6 }, ["e2"]);
    const hit = run(stepCharacter(spawn(cHit.model, 3050, "ground"), { ...NO_INPUT, hop: true }, cHit, 1 / 60).state, NO_INPUT, cHit, 2);
    expect(hit.s.surface).toBe("gated");
    expect(hit.events).toContain("link_used:gear:to");
    const cMiss = ctx({ tSec: 0.05 }, ["e2"]);
    const miss = run(stepCharacter(spawn(cMiss.model, 3050, "ground"), { ...NO_INPUT, hop: true }, cMiss, 1 / 60).state, NO_INPUT, cMiss, 2);
    expect(miss.s).toMatchObject({ surface: "ground", x: 3200 });
    expect(miss.events).toContain("link_used:gear:missTo");
  });

  it("frozen ignores movement keys but lets an arc finish; blockers stop the walk", () => {
    const c = ctx({ frozen: true });
    const f = run(spawn(c.model, 100, "ground"), { ...NO_INPUT, right: true, hop: true }, c, 0.5);
    expect(f.s.x).toBe(100);
    const bl = blockers([{ encounterId: "e1", zoneId: "z_test", payoff: { blocker: { x: 300, surface: "ground", asset: null } } }], new Set());
    const b = run(spawn(c.model, 100, "ground"), { ...NO_INPUT, right: true }, ctx({ blockers: bl }), 2);
    expect(b.s.x).toBeLessThan(300);
    expect(linkForKey(spawn(c.model, 100, "ground"), "space", ctx())).toBeNull();
    expect(inputToward(spawn(c.model, 100, "ground"), 102)).toBeNull();
    expect(inputToward(spawn(c.model, 100, "ground"), 50)?.left).toBe(true);
    expect(spawn(c.model, 100, "nope").surface).toBe("ground");
  });
});
