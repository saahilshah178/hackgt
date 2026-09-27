/**
 * step_bridge prefab kit + floating_steps (KA3): arc flights, the flight tracker, the plan readers, the chasm from the
 * payoff terrain, the relief mapping, and a smoke run of floating_steps (trig e4) on a Phaser-free mock scene: every
 * required anchor exists, the stones fly and seat, the failure plans (order, decoy, incomplete) and the success plan
 * play to the end, and no drawing call ever receives NaN.
 */
import { describe, expect, it } from "vitest";
import trigFixture from "../../../../../../../fixtures/trig-dungeon.json";
import trigWorld from "../../../../../../../fixtures/worlds/trig.world.json";
import { GameSpec } from "@/contracts/gamespec";
import { getMode } from "@/mechanics/registry";
import { expandAnchors } from "@/world/contraptions/skin-kit";
import { StepBridgeConfig, stepBridgeMeta as meta, type StepBridgePose } from "@/world/contraptions/step-bridge.meta";
import type { Diagnosis, Draft, PoseInput } from "@/world/types";
import type { PrefabProps } from "../../types";
import { SKINS } from "./skins";
import { arcPoint, chasmOf, crumbledSlot, FlightTracker, prefixSlots, reliefLocal, stoneGlyphOf, tippedSlot } from "./shared";

const PI = Math.PI;

function mockScene() {
  const errors: string[] = [];
  const queue: { at: number; fn: () => void; done: boolean }[] = [];
  let now = 0;
  const chain = (name: string): unknown => {
    const p: unknown = new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === "then"
            ? undefined
            : (...args: unknown[]) => {
                for (const a of args) if (typeof a === "number" && !Number.isFinite(a)) errors.push(`${name}.${String(prop)}: ${a}`);
                return p;
              },
      },
    );
    return p;
  };
  const scene = {
    add: { container: () => chain("container"), graphics: () => chain("graphics"), image: () => chain("image") },
    time: {
      delayedCall: (ms: number, fn: () => void) => {
        queue.push({ at: now + ms, fn, done: false });
        return { remove: () => undefined };
      },
    },
  };
  const bursts: string[] = [];
  const fx = {
    glow: () => chain("glow"),
    beam: () => ({ set: () => undefined, setAlpha: () => undefined, setColor: () => undefined, destroy: () => undefined }),
    burst: (_p: unknown, at: { x: number; y: number }, preset: string) => {
      if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) errors.push(`burst ${preset}`);
      bursts.push(preset);
    },
    dormancy: () => undefined,
    pooledStrip: () => ({ update: () => undefined, destroy: () => undefined }),
  };
  const flush = (ms: number, step: (dt: number) => void) => {
    for (let t = 0; t < ms; t += 16) {
      now += 16;
      for (const e of queue) {
        if (e.done || e.at > now) continue;
        e.done = true;
        e.fn();
      }
      step(16);
    }
  };
  return { scene: scene as never, fx: fx as never, errors, bursts, flush };
}

const spec = GameSpec.parse(trigFixture);
const E4 = spec.encounters.findIndex((e) => e.id === "e4_solve");
const enc = spec.encounters[E4];
const VIEW = getMode(enc.familyId, enc.mode)!.present(enc.params, spec.seed + E4) as { slots: number; planks: { key: string; text: string }[] };
type SideStation = { encounterId: string; anchor: { x: number; y: number }; consoleX: number; config: unknown; payoff: { terrain: { points: [number, number][] }[] }; pins: { anchor: string }[]; hintTargets: { anchor: string }[][] | null };
const ST = (trigWorld.world.stations as unknown as SideStation[]).find((s) => s.encounterId === "e4_solve")!;
const CONFIG = StepBridgeConfig.parse(ST.config);

function propsOf(reducedMotion = false): PrefabProps<StepBridgeConfig> {
  return {
    station: { ...ST, skin: "floating_steps", contraption: "step_bridge", parsedConfig: CONFIG } as unknown as PrefabProps<StepBridgeConfig>["station"],
    config: CONFIG,
    encounter: enc as never,
    view: VIEW,
    groundY: ST.anchor.y,
    palette: { "gold.base": "#D9A441" },
    fx: undefined as never,
    tex: () => {
      throw new Error("no art yet");
    },
    anchorsOf: () => ({}),
    seed: 5,
    reducedMotion,
  };
}
function draftOf(slots: (string | null)[], extra: Partial<Draft> = {}): Draft {
  return { encounterId: "e4_solve", modeKey: "sequencer.linear", input: { slots }, complete: slots.every((s) => s !== null), focus: null, hover: null, probe: null, settled: true, wave: null, marks: null, seq: 1, ...extra };
}
function input(draft: Draft | null, over: Partial<PoseInput<StepBridgeConfig, null>> = {}): PoseInput<StepBridgeConfig, null> {
  return { view: VIEW, draft, config: CONFIG, probe: null, t: 0, aidTier: 0, hintsUsed: 0, sim: null, solved: false, reducedMotion: false, ...over };
}
const diag = (over: Partial<Diagnosis>): Diagnosis => ({ correct: false, feedback: "", displayFeedback: "", failKey: "order", wrongKeys: [], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [], ...over });

describe("step_bridge kit · flights", () => {
  it("arcPoint starts and ends on its endpoints and rises above both in between", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 400, y: 100 };
    expect(arcPoint(a, b, 120, 0)).toEqual(a);
    expect(arcPoint(a, b, 120, 1)).toEqual(b);
    expect(arcPoint(a, b, 120, 0.5).y).toBeLessThan(0);
  });

  it("the tracker flies a stone to its new target over 450 ms, retargets mid-flight, and snaps under reduced motion", () => {
    const f = new FlightTracker(450, 120, false);
    f.aim(new Map([["s0", { id: "cradle:0", pos: { x: 0, y: 0 } }]]));
    f.step(16);
    expect(f.pos("s0")).toEqual({ x: 0, y: 0 });
    f.aim(new Map([["s0", { id: "bay:2", pos: { x: 500, y: -50 } }]]));
    expect(f.flying("s0")).toBe(true);
    f.step(225);
    const mid = f.pos("s0")!;
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(500);
    f.aim(new Map([["s0", { id: "cradle:0", pos: { x: 0, y: 0 } }]])); // taken back mid-flight: flies home from here
    f.step(450);
    expect(f.pos("s0")).toEqual({ x: 0, y: 0 });
    expect(f.busy).toBe(false);
    const r = new FlightTracker(450, 120, true);
    r.aim(new Map([["d0", { id: "cradle:4", pos: { x: 0, y: 0 } }]]));
    r.aim(new Map([["d0", { id: "bay:0", pos: { x: 90, y: 9 } }]]));
    r.step(16);
    expect(r.pos("d0")).toEqual({ x: 90, y: 9 });
  });

  it("a bobbing target keeps the same flight (no restart every frame)", () => {
    const f = new FlightTracker(450, 120, false);
    f.aim(new Map([["s1", { id: "bay:1", pos: { x: 10, y: 0 } }]]));
    f.step(500);
    f.aim(new Map([["s1", { id: "bay:1", pos: { x: 10, y: 4 } }]]));
    f.step(16);
    expect(f.pos("s1")).toEqual({ x: 10, y: 4 });
    expect(f.flying("s1")).toBe(false);
  });
});

describe("step_bridge kit · plans, chasm, relief", () => {
  const order = ["s0", "s1", "s3", "s2"];
  it("reads the order failure: prefix 2 locks, slot 2 tips; a decoy crumbles in its socket", () => {
    const plan = meta.failurePlan(diag({ failKey: "order", prefix: 2, wrongKeys: ["s3"] }), input(draftOf(order)));
    expect(prefixSlots(plan)).toEqual([0, 1]);
    expect(tippedSlot(plan)).toBe(2);
    expect(crumbledSlot(plan)).toBeNull();
    const decoy = meta.failurePlan(diag({ failKey: "decoy", wrongKeys: ["d0"] }), input(draftOf(["s0", "d0", "s2", "s3"])));
    expect(crumbledSlot(decoy)).toBe(1);
    expect(tippedSlot(decoy)).toBeNull();
  });

  it("the chasm comes from the payoff terrain (x 4198 … 5102 → ±452); the relief maps π/6 and 5π/6 onto the band", () => {
    expect(chasmOf({ anchor: ST.anchor, payoff: ST.payoff as never })).toEqual({ left: -452, right: 452 });
    expect(chasmOf({ anchor: { x: 0, y: 0 }, payoff: { terrain: [] } as never })).toEqual({ left: -450, right: 450 });
    expect(reliefLocal(PI / 6, 1)).toEqual({ x: expect.closeTo(-200, 9), y: -40 });
    expect(reliefLocal((5 * PI) / 6, 1).x).toBeCloseTo(-40, 9);
    expect(reliefLocal(PI / 2, 2).y).toBe(-80);
  });

  it("stone glyphs follow the item's glyph (what the step SAYS); unknown glyphs draw a rune", () => {
    expect(stoneGlyphOf(CONFIG, "s0")).toBe("balance_div2");
    expect(stoneGlyphOf(CONFIG, "d0")).toBe("arcsin_arrow");
    expect(stoneGlyphOf(CONFIG, "zz")).toBe("rune");
  });
});

describe("step_bridge · floating_steps (e4) on a mock scene", () => {
  it("exposes every required anchor plus the pins' and hint targets' anchors", () => {
    const m = mockScene();
    const v = SKINS.floating_steps.create(m.scene, {} as never, { ...propsOf(), fx: m.fx });
    for (const a of expandAnchors(meta.skins.find((s) => s.id === "floating_steps")!.anchors)) expect(v.anchors, a).toHaveProperty(a);
    for (const p of ST.pins) expect(v.anchors).toHaveProperty(p.anchor);
    for (const rung of ST.hintTargets ?? []) for (const t of rung) expect(v.anchors).toHaveProperty(t.anchor);
    expect(v.anchors.lip_relief).toEqual({ x: -700, y: 100 });
    expect(v.anchors.pylon_a.x).toBeCloseTo(512, 9); // on the far lip (chasm right 452 + 60)
    v.destroy();
  });

  it("stones fly to their sockets and back, the relief marker rides the probe, the guide shows when complete", () => {
    const m = mockScene();
    const v = SKINS.floating_steps.create(m.scene, {} as never, { ...propsOf(), fx: m.fx });
    v.setState("active");
    const drafts: (Draft | null)[] = [null, draftOf(["s0", null, null, null]), draftOf(["s0", "s1", "s2", "s3"], { focus: "s2" }), draftOf([null, "s1", "d0", null], { hover: "d0" })];
    for (const d of drafts) {
      const pose: StepBridgePose = meta.pose(input(d, { probe: PI / 6, aidTier: 1 }));
      v.applyPose(pose);
      for (let k = 0; k < 40; k++) v.update?.(16);
    }
    expect(m.errors).toEqual([]);
    v.destroy();
  });

  it("plays order, decoy and incomplete failures (≤ 1.6 s) and the success plan", async () => {
    const m = mockScene();
    const v = SKINS.floating_steps.create(m.scene, {} as never, { ...propsOf(), fx: m.fx });
    v.setState("active");
    const cases: [Draft, Diagnosis][] = [
      [draftOf(["s0", "s1", "s3", "s2"]), diag({ failKey: "order", prefix: 2, wrongKeys: ["s3"] })],
      [draftOf(["s0", "d0", "s2", "s3"]), diag({ failKey: "decoy", wrongKeys: ["d0"] })],
      [draftOf(["s0", null, "s2", "s3"]), diag({ failKey: "incomplete" })],
    ];
    for (const [d, dg] of cases) {
      const pose = meta.pose(input(d));
      v.applyPose(pose);
      const plan = meta.failurePlan(dg, input(d));
      expect(plan.durationMs).toBeLessThanOrEqual(1600);
      const p = v.playFail(plan, pose);
      m.flush(1700, (dt) => v.update?.(dt));
      await p;
    }
    const solvedIn = { ...input(draftOf(["s0", "s1", "s2", "s3"])), solved: true };
    const plan = meta.successPlan(solvedIn, "bridge_forms");
    const p = v.playSucceed(plan, meta.solvedPose(solvedIn));
    m.flush(plan.durationMs + 100, (dt) => v.update?.(dt));
    await p;
    v.setState("solved");
    v.update?.(16);
    expect(m.bursts).toContain("dust");
    expect(m.errors).toEqual([]);
    v.destroy();
  });
});
