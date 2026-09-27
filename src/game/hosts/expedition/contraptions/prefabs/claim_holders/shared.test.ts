/**
 * claim_holders prefab kit + the trig skins (KA3): the aim mapping from the meta's standard rig to a skin's own row, the
 * slate trace projection, the plan readers, and a smoke run of resonance_pillars (e3) and treasury_pillars (e5) on a
 * Phaser-free mock scene: every required anchor exists, poses apply, the failure and success plans play to the end,
 * and no drawing call ever receives NaN.
 */
import { describe, expect, it } from "vitest";
import trigFixture from "../../../../../../../fixtures/trig-dungeon.json";
import trigWorld from "../../../../../../../fixtures/worlds/trig.world.json";
import { GameSpec } from "@/contracts/gamespec";
import { getMode } from "@/mechanics/registry";
import { AIM_RIGS, aimAngleFrom, ClaimHoldersConfig, claimHoldersMeta as meta, holderPos, type ClaimHoldersPose } from "@/world/contraptions/claim-holders.meta";
import { expandAnchors } from "@/world/contraptions/skin-kit";
import type { Diagnosis, Draft, PoseInput } from "@/world/types";
import type { PrefabProps } from "../../types";
import { SKINS } from "./skins";
import { capsFlashing, heldSlots, holderX, lensXFor, mimicSlotOf, payoffBeatOf, rowShiftFor, rowXFromAngle, SINGER, skinRowX, slateDomain, slateTraceOf, toSlate } from "./shared";

const PI = Math.PI;

// ---------------------------------------------------------------- a Phaser-free mock scene (every call chains; NaN arguments are recorded)

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
    textures: { exists: () => false },
  };
  const fx = {
    glow: () => chain("glow"),
    beam: () => ({ set: (a: { x: number; y: number }, b: { x: number; y: number }) => [a.x, a.y, b.x, b.y].forEach((v) => Number.isFinite(v) || errors.push(`beam.set: ${v}`)), setAlpha: () => undefined, setColor: () => undefined, destroy: () => undefined }),
    burst: () => undefined,
    dormancy: () => undefined,
    pooledStrip: () => ({ update: () => undefined, destroy: () => undefined }),
  };
  /** Advances the clock in 16 ms frames, firing timers and calling `step(16)` each frame. */
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
  return { scene: scene as never, fx: fx as never, errors, flush };
}

// ---------------------------------------------------------------- the trig stations (side-car + fixture views)

const spec = GameSpec.parse(trigFixture);
type SideStation = { encounterId: string; anchor: { x: number; y: number }; consoleX: number; skin: string; config: unknown; payoff: unknown; pins: { anchor: string }[]; hintTargets: { anchor: string }[][] | null };
const stationOf = (id: string) => (trigWorld.world.stations as unknown as SideStation[]).find((s) => s.encounterId === id)!;
function viewOf(id: string): unknown {
  const i = spec.encounters.findIndex((e) => e.id === id);
  const e = spec.encounters[i];
  return getMode(e.familyId, e.mode)!.present(e.params, spec.seed + i);
}
function propsOf(id: string, reducedMotion = false): PrefabProps<ClaimHoldersConfig> {
  const st = stationOf(id);
  const config = ClaimHoldersConfig.parse(st.config);
  return {
    station: { ...st, contraption: "claim_holders", parsedConfig: config } as unknown as PrefabProps<ClaimHoldersConfig>["station"],
    config,
    encounter: spec.encounters.find((e) => e.id === id)! as never,
    view: viewOf(id),
    groundY: st.anchor.y,
    palette: { "gold.base": "#D9A441", "stone.base": "#F2E3C6", bogus: "nope" },
    fx: undefined as never,
    tex: () => {
      throw new Error("no art yet");
    },
    anchorsOf: () => ({}),
    seed: 11,
    reducedMotion,
  };
}
function draftOf(id: string, statementIndex: number | null, extra: Partial<Draft> = {}): Draft {
  return { encounterId: id, modeKey: "truth_finder.mimic", input: { statementIndex }, complete: statementIndex !== null, focus: null, hover: null, probe: null, settled: true, wave: null, marks: null, seq: 1, ...extra };
}
function input(id: string, draft: Draft | null, over: Partial<PoseInput<ClaimHoldersConfig, null>> = {}): PoseInput<ClaimHoldersConfig, never> {
  const p = propsOf(id);
  return { view: p.view, draft, config: p.config, probe: null, t: 0.5, aidTier: 0, hintsUsed: 0, sim: null, solved: false, reducedMotion: false, ...over } as PoseInput<ClaimHoldersConfig, never>;
}
const diag = (over: Partial<Diagnosis>): Diagnosis => ({ correct: false, feedback: "", displayFeedback: "", failKey: "honest", wrongKeys: [], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [], ...over });

// ---------------------------------------------------------------- pure helpers

describe("claim_holders kit · aim mapping", () => {
  it("recovers the rig's holder x from the pose's aim angle, and rescales it to a skin's spacing", () => {
    const rig = AIM_RIGS.tuning_lens;
    for (let slot = 0; slot < 3; slot++) {
      const target = holderPos(rig, 3, slot);
      const a = aimAngleFrom(rig, target);
      expect(rowXFromAngle(rig, a)).toBeCloseTo(target.x, 9);
      expect(skinRowX(rig, a, 200)).toBeCloseTo(holderX(3, slot, 200), 9);
    }
    // a pendant lamp swings on its cord: x = cord · sin(angle)
    const pend = AIM_RIGS.pendant_lamp;
    expect(rowXFromAngle(pend, aimAngleFrom(pend, holderPos(pend, 3, 2)))).toBeCloseTo(holderPos(pend, 3, 2).x, 9);
    // a ray pointing away from the row clamps far out instead of flipping sign
    expect(Math.abs(rowXFromAngle(rig, PI / 2))).toBe(4000);
  });

  it("the lens stands in a gap (never right under a slate); the row clears the console by 60", () => {
    expect(lensXFor(3, 420)).toBe(-210);
    expect(lensXFor(4, 300)).toBe(0);
    for (const n of [3, 5]) for (let i = 0; i < n; i++) expect(Math.abs(lensXFor(n, 300) - holderX(n, i, 300))).toBeGreaterThanOrEqual(150);
    const shift = rowShiftFor(-500, 3, 420);
    expect(-420 + shift - SINGER.plinthW / 2).toBeGreaterThanOrEqual(-440);
    expect(rowShiftFor(-900, 3, 420)).toBe(0);
  });
});

describe("claim_holders kit · the slate trace (trace_slate)", () => {
  const e3 = propsOf("e3_amplitude").config;
  it("projects e3's claims literally: the mimic's 'amplitude 6' bracket spans trough to peak, the honest one midline to peak", () => {
    const box = { w: 132, h: 82 };
    const dom = slateDomain(e3);
    expect(dom).toMatchObject({ x0: 0, y0: -4, y1: 4 });
    expect(dom.x1).toBeCloseTo(2 * PI, 12);
    const honest = slateTraceOf(e3.holders[0].trace!, e3, box);
    const mimic = slateTraceOf(e3.holders[1].trace!, e3, box);
    const len = (t: typeof honest) => Math.abs(t.brackets[0].a.y - t.brackets[0].b.y);
    expect(len(mimic)).toBeCloseTo(2 * len(honest), 9); // 6 against 3 on the same scale
    expect(honest.fns.map((f) => f.style)).toEqual(["solid", "dashed"]);
    expect(mimic.fns.map((f) => f.style)).toEqual(["solid", "dashed"]); // no style tell
    expect(toSlate(0, 0, dom, box)).toEqual({ x: -66, y: 0 });
    for (const f of honest.fns) for (const seg of f.segments) for (const p of seg) expect(Math.abs(p.x) <= 66 + 1e-9 && Math.abs(p.y) <= 41 + 1e-9).toBe(true);
  });

  it("bracket caps flash as the playhead passes their x (within half a probe step)", () => {
    const t = slateTraceOf(e3.holders[1].trace!, e3, { w: 132, h: 82 });
    expect(capsFlashing(t, (3 * PI) / 2, 0.03)).toEqual([true]);
    expect(capsFlashing(t, PI, 0.03)).toEqual([false]);
    expect(capsFlashing(t, null, 0.03)).toEqual([false]);
  });

  it("reads the plans: the honest pick held bright, the exposed mimic's slot, the payoff beat", () => {
    const view = viewOf("e3_amplitude") as { chests: { statementIndex: number }[] };
    const mimicSlot = view.chests.findIndex((c) => c.statementIndex === 1);
    const fail = meta.failurePlan(diag({ wrongKeys: ["0"] }), input("e3_amplitude", draftOf("e3_amplitude", 0)));
    expect(heldSlots(fail)).toEqual([view.chests.findIndex((c) => c.statementIndex === 0)]);
    const win = meta.successPlan({ ...input("e3_amplitude", draftOf("e3_amplitude", 1)), solved: true }, "lift_moves");
    expect(mimicSlotOf(win)).toBe(mimicSlot);
    expect(payoffBeatOf(win)).toMatchObject({ anchor: "lift", params: { anim: "lift_moves" } });
  });
});

// ---------------------------------------------------------------- the skins on a mock scene

const CASES = [
  { id: "e3_amplitude", skin: "resonance_pillars", anim: "lift_moves" as const },
  { id: "e5_period_review", skin: "treasury_pillars", anim: "stairs_rise" as const },
];

describe.each(CASES)("claim_holders · $skin ($id) on a mock scene", ({ id, skin, anim }) => {
  it("exposes every required anchor, the station pins' and hint targets' anchors", () => {
    const m = mockScene();
    const props = { ...propsOf(id), fx: m.fx };
    const v = SKINS[skin as keyof typeof SKINS].create(m.scene, {} as never, props);
    const required = expandAnchors(meta.skins.find((s) => s.id === skin)!.anchors);
    for (const a of required) expect(v.anchors, a).toHaveProperty(a);
    const st = stationOf(id);
    for (const p of st.pins) expect(v.anchors).toHaveProperty(p.anchor);
    for (const rung of st.hintTargets ?? []) for (const t of rung) expect(v.anchors).toHaveProperty(t.anchor);
    expect(v.anchors.console).toEqual({ x: st.consoleX - st.anchor.x, y: 0 });
    v.destroy();
  });

  it("applies live poses (idle, aimed with the probe, a hover preview) without NaN", () => {
    const m = mockScene();
    const v = SKINS[skin as keyof typeof SKINS].create(m.scene, {} as never, { ...propsOf(id), fx: m.fx });
    v.setState("awake");
    const poses: ClaimHoldersPose[] = [
      meta.pose(input(id, null)),
      meta.pose(input(id, draftOf(id, 0), { probe: PI / 2 })),
      meta.pose(input(id, draftOf(id, 2, { hover: "1" }), { probe: 3.3, aidTier: 2 })),
    ];
    for (const p of poses) {
      v.applyPose(p);
      v.update?.(16);
    }
    v.applyPose(meta.lerp(poses[1], poses[2], 0.3));
    expect(m.errors).toEqual([]);
    v.destroy();
  });

  it("plays the failure plan (≤ 1.6 s) and the success plan to the solved pose", async () => {
    const m = mockScene();
    const v = SKINS[skin as keyof typeof SKINS].create(m.scene, {} as never, { ...propsOf(id), fx: m.fx });
    v.setState("active");
    const live = meta.pose(input(id, draftOf(id, 0), { probe: 1 }));
    v.applyPose(live);
    const fail = meta.failurePlan(diag({ wrongKeys: ["0"] }), input(id, draftOf(id, 0)));
    let failed = false;
    const pf = v.playFail(fail, live).then(() => (failed = true));
    m.flush(1700, (dt) => v.update?.(dt));
    await pf;
    expect(failed).toBe(true);
    const solvedIn = { ...input(id, draftOf(id, 1)), solved: true };
    const plan = meta.successPlan(solvedIn, anim);
    let done = false;
    const ps = v.playSucceed(plan, meta.solvedPose(solvedIn)).then(() => (done = true));
    m.flush(plan.durationMs + 100, (dt) => v.update?.(dt));
    await ps;
    expect(done).toBe(true);
    v.setState("solved");
    v.update?.(16);
    expect(m.errors).toEqual([]);
    v.destroy();
  });

  it("reduced motion snaps the plans", async () => {
    const m = mockScene();
    const v = SKINS[skin as keyof typeof SKINS].create(m.scene, {} as never, { ...propsOf(id, true), fx: m.fx });
    const solvedIn = { ...input(id, draftOf(id, 1)), solved: true, reducedMotion: true };
    const p = v.playSucceed(meta.successPlan(solvedIn, anim), meta.solvedPose(solvedIn));
    m.flush(420, (dt) => v.update?.(dt));
    await p;
    expect(m.errors).toEqual([]);
  });
});
