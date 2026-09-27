/**
 * pendulum_sync prefab kit + wardens_shield (KA3): the free run that keeps both swings going while a plan plays, the
 * sagging and snapped thread, the thread style from B, the span tiles, and a smoke run of the Warden's Shield (trig e6)
 * on a Phaser-free mock scene: every required anchor exists, poses from the real sim apply, the failure plans (reach,
 * half) and the success plan play to the end, and no drawing call ever receives NaN.
 */
import { describe, expect, it } from "vitest";
import trigFixture from "../../../../../../../fixtures/trig-dungeon.json";
import trigWorld from "../../../../../../../fixtures/worlds/trig.world.json";
import { GameSpec } from "@/contracts/gamespec";
import { getMode } from "@/mechanics/registry";
import { PendulumSyncConfig, pendulumSyncMeta as meta, shieldAngleFor } from "@/world/contraptions/pendulum-sync.meta";
import { expandAnchors } from "@/world/contraptions/skin-kit";
import { pendulumBeat, type PendulumBeatState } from "@/world/sims/pendulum-beat";
import type { Diagnosis, Draft, PoseInput } from "@/world/types";
import type { PrefabProps } from "../../types";
import { SKINS } from "./skins";
import { freeRun, snappedHalves, spanTileXs, threadPoints, threadStyle } from "./shared";

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
const E6 = spec.encounters.findIndex((e) => e.id === "e6_boss");
const enc = spec.encounters[E6];
const VIEW = getMode(enc.familyId, enc.mode)!.present(enc.params, spec.seed + E6);
type SideStation = { encounterId: string; anchor: { x: number; y: number }; consoleX: number; config: unknown; payoff: unknown; pins: { anchor: string }[]; hintTargets: { anchor: string }[][] | null };
const ST = (trigWorld.world.stations as unknown as SideStation[]).find((s) => s.encounterId === "e6_boss")!;
const CONFIG = PendulumSyncConfig.parse(ST.config);

function propsOf(reducedMotion = false): PrefabProps<PendulumSyncConfig> {
  return {
    station: { ...ST, skin: "wardens_shield", contraption: "pendulum_sync", parsedConfig: CONFIG } as unknown as PrefabProps<PendulumSyncConfig>["station"],
    config: CONFIG,
    encounter: enc as never,
    view: VIEW,
    groundY: ST.anchor.y,
    palette: {},
    fx: undefined as never,
    tex: () => {
      throw new Error("no art yet");
    },
    anchorsOf: () => ({}),
    seed: 3,
    reducedMotion,
  };
}
function draftOf(value: number): Draft {
  return { encounterId: "e6_boss", modeKey: "tuner.oscillator", input: { value }, complete: true, focus: null, hover: null, probe: null, settled: false, wave: null, marks: null, seq: 1 };
}
function simAt(value: number, tau: number): PendulumBeatState {
  const ctx = { draft: draftOf(value), probe: null, t: 0, aidTier: 0 as const };
  let s = pendulumBeat.init(1, CONFIG, VIEW, ctx);
  for (let i = 0; i < Math.round(tau * 30); i++) s = pendulumBeat.step(s, 1 / 30, ctx);
  return s;
}
function input(value: number | null, tau: number, over: Partial<PoseInput<PendulumSyncConfig, PendulumBeatState>> = {}): PoseInput<PendulumSyncConfig, PendulumBeatState> {
  return { view: VIEW, draft: value === null ? null : draftOf(value), config: CONFIG, probe: null, t: tau, aidTier: 0, hintsUsed: 0, sim: value === null ? null : simAt(value, tau), solved: false, reducedMotion: false, ...over };
}
const diag = (over: Partial<Diagnosis>): Diagnosis => ({ correct: false, feedback: "", displayFeedback: "", failKey: "over", wrongKeys: [], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [], ...over });

describe("pendulum_sync kit · free run", () => {
  it("continues the shield's wave from the last pose's clock and the pendulum's phase at T", () => {
    const pose = meta.pose(input(3, 0.5));
    const start = { pose };
    const at = freeRun(VIEW, CONFIG, start, { ms: 500, decay: 1, kneel: 0, lower: 0, door: 0, B: null });
    expect(at.shieldSpan).toBeCloseTo(3 * Math.sin((Math.PI / 2) * 1), 9); // τ 0.5 + 0.5 s = 1 → the peak
    expect(at.shieldAngle).toBeCloseTo(shieldAngleFor(3, CONFIG), 9);
    const later = meta.pose(input(3, 1));
    expect(at.pendAngle).toBeCloseTo(later.pendAngle, 2); // the same phase the sim would have reached
  });

  it("success decay brings both swings to rest; the kneel, lower and door ride along", () => {
    const pose = meta.pose(input(4, 2.3));
    const end = freeRun(VIEW, CONFIG, { pose }, { ms: 1000, decay: 0, kneel: 1, lower: 1, door: 0.5, B: 1 });
    expect(end.shieldSpan).toBeCloseTo(0, 12);
    expect(end.pendAngle).toBeCloseTo(0, 12);
    expect(end).toMatchObject({ kneel: 1, lower: 1, door: 0.5, B: 1 });
    // untouched: the pendulum rests and the thread is dark
    expect(freeRun(VIEW, CONFIG, { pose: meta.pose(input(null, 1)) }, { ms: 300, decay: 1, kneel: 0, lower: 0, door: 0, B: null })).toMatchObject({ pendAngle: 0, B: 0 });
  });
});

describe("pendulum_sync kit · the thread", () => {
  it("sags at its middle by the sag, straight at B ≥ 0.3", () => {
    const a = { x: -1000, y: -210 };
    const b = { x: 0, y: -272 };
    const straight = threadPoints(a, b, 0);
    const sagged = threadPoints(a, b, 60);
    expect(straight[0]).toEqual(a);
    expect(straight[straight.length - 1]).toEqual(b);
    expect(sagged[12].y - straight[12].y).toBeCloseTo(60, 9);
  });

  it("a snap splits it into two halves that recoil toward their ends", () => {
    const pts = threadPoints({ x: 0, y: 0 }, { x: 1000, y: 0 }, 0);
    const [l0, r0] = snappedHalves(pts, 0);
    const [l1, r1] = snappedHalves(pts, 1);
    expect(l0[0]).toEqual(pts[0]);
    expect(r0[r0.length - 1]).toEqual(pts[pts.length - 1]);
    expect(l1.length).toBeLessThan(l0.length);
    expect(r1.length).toBeLessThan(r0.length);
    expect(l1[l1.length - 1].y).toBeGreaterThan(0); // the loose end droops
  });

  it("width 2 + 4B and alpha 0.25 + 0.75B; gold locks it at width 8, full alpha", () => {
    expect(threadStyle(1, 0)).toEqual({ width: 6, alpha: 1 });
    expect(threadStyle(0, 0)).toEqual({ width: 2, alpha: 0.25 });
    expect(threadStyle(0.2, 1)).toEqual({ width: 8, alpha: 1 });
  });

  it("seven span tiles at k·94 under the door", () => {
    expect(spanTileXs(CONFIG).map((t) => t.x)).toEqual([-282, -188, -94, 0, 94, 188, 282]);
    expect(spanTileXs({ spanTiles: 0, spanUnitPx: 94 })).toEqual([]);
  });
});

describe("pendulum_sync · wardens_shield (e6) on a mock scene", () => {
  it("exposes every required anchor plus the pin's, hints' and plans' anchors", () => {
    const m = mockScene();
    const v = SKINS.wardens_shield.create(m.scene, {} as never, { ...propsOf(), fx: m.fx });
    for (const a of expandAnchors(meta.skins[0].anchors)) expect(v.anchors, a).toHaveProperty(a);
    for (const p of ST.pins) expect(v.anchors).toHaveProperty(p.anchor);
    for (const rung of ST.hintTargets ?? []) for (const t of rung) expect(v.anchors).toHaveProperty(t.anchor);
    for (const a of ["thread", "shield_rim", "span_0", "span_m3", "span_p3"]) expect(v.anchors).toHaveProperty(a);
    expect(v.anchors.console).toEqual({ x: ST.consoleX - ST.anchor.x, y: 0 });
    v.destroy();
  });

  it("the shield swings and the pendulum follows its period through live poses; dormant holds still; no NaN", () => {
    const m = mockScene();
    const v = SKINS.wardens_shield.create(m.scene, {} as never, { ...propsOf(), fx: m.fx });
    v.applyPose(meta.pose(input(null, 1)));
    v.setState("awake");
    for (const [T, tau] of [[null, 0.4], [2, 1.3], [4, 2.2], [0.1, 3], [7.5, 5]] as const) {
      v.applyPose(meta.pose(input(T, tau, { aidTier: 2 })));
      v.update?.(16);
    }
    // a dim thread (T = 2 at τ = 2: B ≈ 0) sags and sparks
    v.applyPose(meta.pose(input(2, 2)));
    v.update?.(16);
    expect(m.bursts).toContain("sparks");
    expect(m.errors).toEqual([]);
    v.destroy();
  });

  it("plays the reach and half failures (≤ 1.6 s) while the swings keep time, then the success to the kneeling Warden", async () => {
    const m = mockScene();
    const v = SKINS.wardens_shield.create(m.scene, {} as never, { ...propsOf(), fx: m.fx });
    v.setState("active");
    for (const [T, keys, failKey] of [[3, ["reach"], "under"], [2, ["half"], "under"], [6.5, [], "over"]] as const) {
      const pose = meta.pose(input(T, 1.1));
      v.applyPose(pose);
      const plan = meta.failurePlan(diag({ failKey, probeKeys: [...keys] }), input(T, 1.1));
      const p = v.playFail(plan, pose);
      m.flush(1700, (dt) => v.update?.(dt));
      await p;
    }
    const solvedIn = { ...input(4, 3), solved: true };
    const plan = meta.successPlan(solvedIn, "door_opens");
    let done = false;
    const p = v.playSucceed(plan, meta.solvedPose(solvedIn)).then(() => (done = true));
    m.flush(plan.durationMs + 100, (dt) => v.update?.(dt));
    await p;
    expect(done).toBe(true);
    v.setState("solved");
    v.update?.(16);
    expect(m.bursts).toEqual(expect.arrayContaining(["sparks", "dust"]));
    expect(m.errors).toEqual([]);
    v.destroy();
  });
});
