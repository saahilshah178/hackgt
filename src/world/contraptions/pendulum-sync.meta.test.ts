/* eslint-disable @typescript-eslint/no-restricted-imports -- tests may read params and solutions (docs/design/20 §2.5.6):
   they grade with the mechanics registry, which the meta itself never imports. */
/**
 * pendulum_sync meta — the §7.4 row (docs/design/20) and trig §5.6's pure tests: syncBrightness(T = 4, τ ≤ 30 s) ≥ 0.99;
 * beatHz(T) = |1/4 − 1/T|; the common-start reset on open and settle zeroes both phases (through the controller core);
 * seeded determinism; PARITY locked ⟺ |T − 4| ≤ 0.24 ⟺ grade correct (400 samples); the failure plan snaps the
 * thread; sync_hum pitch ∝ B; plus panel cards, tiers, probes, plans, geometry, snapshots and ≥ 3 intermediate poses.
 */
import { describe, expect, it } from "vitest";
import trigFixture from "../../../fixtures/trig-dungeon.json";
import docConfigs from "../../../tests/world-doc-configs.json";
import { GameSpec } from "../../contracts/gamespec";
import { ControllerCore } from "../../game/hosts/expedition/contraptions/controller-core";
import { getMode } from "../../mechanics/registry";
import { smoothingFactor } from "../ease";
import { matchProbes } from "../probes";
import { pendulumBeat, type PendulumBeatState } from "../sims/pendulum-beat";
import type { Diagnosis, Draft, OscillatorView, PoseInput, StaticInput } from "../types";
import {
  bobAt,
  driftAt,
  KNEEL_DROP,
  PENDULUM_SYNC_SKINS,
  PendulumSyncConfig,
  pendulumSyncMeta as meta,
  pendulumWave,
  phasesAt,
  PIVOT,
  PYLON_PIVOT,
  restAngle,
  SHIELD_R,
  shieldAngleFor,
  shieldGeometry,
  shieldPeaks,
  snapshotInput,
  spanChipTiles,
  validatePendulumSync,
  wardenSnapshot,
  type PendulumSyncPose,
} from "./pendulum-sync.meta";
import { waveOf } from "./ring-gate.meta";

const PI = Math.PI;
const spec = GameSpec.parse(trigFixture);
const E6 = spec.encounters.findIndex((e) => e.id === "e6_boss");
const enc = spec.encounters[E6];
const mode = getMode(enc.familyId, enc.mode)!;
const VIEW = mode.present(enc.params, spec.seed + E6) as OscillatorView;
const CONFIG = PendulumSyncConfig.parse(docConfigs.configs.find((c) => c.encounterId === "e6_boss")!.config);

function draft(value: number, over: Partial<Draft> = {}): Draft {
  return { encounterId: "e6_boss", modeKey: "tuner.oscillator", input: { value }, complete: true, focus: null, hover: null, probe: null, settled: false, wave: null, marks: null, seq: 1, ...over };
}
function input(value: number | null, over: Partial<PoseInput<PendulumSyncConfig, PendulumBeatState>> = {}): PoseInput<PendulumSyncConfig, PendulumBeatState> {
  return { view: VIEW, draft: value === null ? null : draft(value), config: CONFIG, probe: null, t: 0, aidTier: 0, hintsUsed: 0, sim: null, solved: false, reducedMotion: false, ...over };
}
function stat(over: Partial<StaticInput<PendulumSyncConfig>> = {}): StaticInput<PendulumSyncConfig> {
  return { view: VIEW, config: CONFIG, aidTier: 0, hintsUsed: 0, reducedMotion: false, skinId: "wardens_shield", record: false, ...over };
}
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const diag = (over: Partial<Diagnosis> = {}): Diagnosis => ({ correct: false, feedback: "", displayFeedback: "", failKey: "over", wrongKeys: [], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [], ...over });
/** Steps the sim like the controller does (fixed dt) and returns the state at τ. */
function simAt(value: number, tau: number): PendulumBeatState {
  let s = pendulumBeat.init(1, CONFIG, VIEW, { draft: draft(value), probe: null, t: 0, aidTier: 0 });
  for (let i = 0; i < Math.round(tau / pendulumBeat.fixedDt); i++) s = pendulumBeat.step(s, pendulumBeat.fixedDt, { draft: draft(value), probe: null, t: 0, aidTier: 0 });
  return s;
}

describe("pendulum_sync · the view", () => {
  it("reads e6's view: 3sin((π/2)t), ask period, T₀ = 4, tolerance 0.03 × 8 = 0.24, a numeric dial 0…8", () => {
    const w = waveOf(VIEW);
    expect(w).toMatchObject({ ask: "period", wave: "sin", amplitude: 3, c: 0, d: 0, pi: false });
    expect(w.b).toBeCloseTo(PI / 2, 12);
    expect(w.answer).toBeCloseTo(4, 12);
    expect(w.tol).toBeCloseTo(0.24, 12);
    expect(w.dial).toMatchObject({ min: 0, max: 8, step: 0.05 });
  });
});

describe("pendulum_sync · the sync thread (§7.4)", () => {
  it("syncBrightness(T = 4, τ ≤ 30 s) ≥ 0.99, with and without the sim", () => {
    for (let tau = 0; tau <= 30; tau += 0.25) {
      expect(meta.pose(input(4, { t: tau })).B, `analytic τ=${tau}`).toBeGreaterThanOrEqual(0.99);
      if (Math.round(tau * 4) % 20 === 0) expect(meta.pose(input(4, { t: tau, sim: simAt(4, tau) })).B, `sim τ=${tau}`).toBeGreaterThanOrEqual(0.99);
    }
  });

  it("beatHz(T) = |1/4 − 1/T|; the thread sags (1 − B)·60 when B < 0.3", () => {
    expect(meta.pose(input(2)).beatHz).toBeCloseTo(0.25, 12);
    expect(meta.pose(input(8)).beatHz).toBeCloseTo(0.125, 12);
    expect(meta.pose(input(4)).beatHz).toBeCloseTo(0, 12);
    const apart = meta.pose(input(2, { t: 2 })); // opposite swings: Δ = π
    expect(apart.B).toBeCloseTo(0, 9);
    expect(apart.sag).toBeCloseTo(60, 6);
    expect(meta.pose(input(2, { t: 4 })).B).toBeCloseTo(1, 9);
    expect(meta.pose(input(2, { t: 4 })).sag).toBe(0);
  });

  it("the shield sweeps A spans in real time (s(τ) = 3 sin(πτ/2), α = asin(sU/L) ≈ ±39.6° at the peaks)", () => {
    expect(meta.pose(input(null, { t: 0 })).shieldSpan).toBeCloseTo(0, 12);
    expect(meta.pose(input(null, { t: 1 })).shieldSpan).toBeCloseTo(3, 12);
    expect(meta.pose(input(null, { t: 3 })).shieldSpan).toBeCloseTo(-3, 12);
    expect((meta.pose(input(null, { t: 1 })).shieldAngle * 180) / PI).toBeCloseTo(39.63, 1);
    expect(shieldAngleFor(100, CONFIG)).toBeCloseTo(Math.asin(0.98), 12); // clamped, never horizontal
  });

  it("untouched: the pendulum hangs still and the thread is dark; touched: it swings 14° at the dialled period", () => {
    const idle = meta.pose(input(null, { t: 1.3 }));
    expect(idle).toMatchObject({ touched: false, T: null, pendAngle: 0, lit: 0, B: 0, locked: false });
    const p = meta.pose(input(4, { t: 1 })); // quarter period: the full swing
    expect(p.touched).toBe(true);
    expect((p.pendAngle * 180) / PI).toBeCloseTo(14, 9);
    expect(bobAt(0, CONFIG)).toEqual({ x: PYLON_PIVOT.x, y: PYLON_PIVOT.y + CONFIG.armPx });
  });

  it("the common-start reset on open and on settle zeroes both phases (through the controller core)", () => {
    const core = new ControllerCore({ meta, config: CONFIG, view: VIEW, skinId: "wardens_shield", seed: 9, reducedMotion: true, record: false, payoffAnim: "door_opens", station: { hintTargets: null } });
    core.setState("awake");
    core.setOpen(true);
    expect(core.t).toBe(0);
    expect((core.sim as PendulumBeatState).phiP).toBe(0);
    core.bind(draft(3.1, { seq: 1 }));
    for (let i = 0; i < 60; i++) core.tick(1000 / 30);
    const mid = core.sim as PendulumBeatState;
    expect(mid.phiP).toBeGreaterThan(0);
    expect(mid.phiS).toBeGreaterThan(0);
    core.bind(draft(3.1, { seq: 2, settled: true }));
    expect(core.t).toBe(0);
    expect(core.sim as PendulumBeatState).toMatchObject({ t: 0, phiP: 0, phiS: 0, B: 1 });
    // closing and reopening restarts them together again
    for (let i = 0; i < 30; i++) core.tick(1000 / 30);
    core.setOpen(false);
    core.setOpen(true);
    expect(core.t).toBe(0);
    expect(core.sim as PendulumBeatState).toMatchObject({ phiP: 0, phiS: 0 });
    expect(meta.clock?.resetOn).toEqual(expect.arrayContaining(["open", "settle", "arena"]));
  });

  it("while the panel is closed the pendulum keeps swinging from the sim's last phase (no jump)", () => {
    const s = simAt(3, 2);
    const at = phasesAt(waveOf(VIEW), 3, 2, s);
    expect(at.phiP).toBeCloseTo(s.phiP, 9);
    const later = phasesAt(waveOf(VIEW), 3, 2.5, s);
    expect(later.phiP - s.phiP).toBeCloseTo((2 * PI * (2.5 - s.t)) / 3, 9);
    expect(later.phiS).toBeCloseTo((PI / 2) * 2.5, 12);
  });

  it("after a settled restart mid-open the shield and pendulum share the sim's clock (the thread is steady at T = 4)", () => {
    let s = simAt(3, 2); // dragged at 3 for 2 s
    const settled = { ...draft(4), settled: true };
    for (let i = 0; i < 90; i++) s = pendulumBeat.step(s, 1 / 30, { draft: settled, probe: null, t: 2 + (i + 1) / 30, aidTier: 0 });
    const p = meta.pose(input(4, { t: 5, sim: s }));
    expect(p.B).toBeGreaterThan(0.99);
    expect(p.tau).toBeCloseTo(s.t, 9); // the shield's displayed swing follows the common start
    expect(p.shieldSpan).toBeCloseTo(3 * Math.sin((Math.PI / 2) * s.t), 9);
  });

  it("is deterministic: the same seed, drafts and clock give identical poses", () => {
    const a = [0.5, 1, 7.25].map((tau) => meta.pose(input(3.35, { t: tau, sim: simAt(3.35, tau) })));
    const b = [0.5, 1, 7.25].map((tau) => meta.pose(input(3.35, { t: tau, sim: simAt(3.35, tau) })));
    expect(a).toEqual(b);
  });
});

describe("pendulum_sync · parity with oscillator.grade", () => {
  it("locked ⟺ |T − 4| ≤ 0.24 ⟺ grade().correct over 400 samples", () => {
    const rnd = seeded(20260927);
    let hits = 0;
    for (let i = 0; i < 400; i++) {
      const T = i % 2 === 0 ? 4 + (rnd() - 0.5) * 0.8 : rnd() * 8;
      const correct = mode.grade(enc.params, { value: T }).correct;
      expect(meta.pose(input(T, { t: rnd() * 20 })).locked, String(T)).toBe(correct);
      expect(Math.abs(T - 4) <= 0.24 + 1e-12).toBe(correct);
      if (correct) hits++;
    }
    expect(hits).toBeGreaterThan(50);
    expect(meta.pose(input(null)).locked).toBe(false);
  });

  it("the probes: T near 3 or 6 → reach, near 2 → half (the oscillator tolerance 0.03 × 8)", () => {
    const station = { probes: [
      { predicate: "nearValue" as const, value: "3", tolFactor: 1, key: "reach" },
      { predicate: "nearValue" as const, value: "6", tolFactor: 1, key: "reach" },
      { predicate: "nearValue" as const, value: "2", tolFactor: 1, key: "half" },
    ] };
    const keys = (T: number) => matchProbes(station.probes as never, { modeKey: "tuner.oscillator", view: VIEW, solution: enc.solution, input: { value: T } });
    expect(keys(3.1)).toContain("reach");
    expect(keys(6.2)).toContain("reach");
    expect(keys(2.2)).toContain("half");
    expect(keys(4.9)).toEqual([]);
  });
});

describe("pendulum_sync · panel", () => {
  it("static: shield (f), pendulum (ghost f), drift (dark until tier 1); the scrubber is 0…8 by 0.05 with ticks every 1", () => {
    const s = meta.panelStatic(stat());
    expect(s.cards.map((c) => (c.kind === "graph" ? [c.slot, c.tab, c.empty] : c.kind))).toEqual([[0, "f", false], [1, "g", false], [2, "h", true]]);
    expect(s.input).toMatchObject({ symbol: "T", min: 0, max: 8, step: 0.05, unit: "number", format: "number" });
    expect(s.input!.ticks.filter((t) => t.major).map((t) => t.v)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(s.probe).toBeNull();
    const shield = s.cards[0] as Extract<(typeof s.cards)[number], { kind: "graph" }>;
    expect(shield.y.min).toBe(-4);
    expect(shield.y.ticks.filter((t) => t.label !== null).map((t) => t.v)).toEqual([-4, -2, 0, 2, 4]);
    expect(shield.annotations).toEqual([]);
    const tier1 = meta.panelStatic(stat({ aidTier: 1 }));
    expect((tier1.cards[2] as { empty: boolean }).empty).toBe(false);
  });

  it("tier 2 adds the shield's peak dots at t = 1 and 5", () => {
    expect(shieldPeaks(waveOf(VIEW))).toEqual([1, 5]);
    const s = meta.panelStatic(stat({ aidTier: 2 }));
    const marks = (s.cards[0] as { annotations: readonly { kind: string; x?: number }[] }).annotations.filter((a) => a.kind === "marker").map((a) => a.x);
    expect(marks).toEqual([1, 5]);
  });

  it("live: the orange line at T; the f chip reads 0.00 at both T = 2 and T = 4 (the half-period trap); drift(T) = T/4 − 1", () => {
    const s1 = meta.panelStatic(stat({ aidTier: 1 }));
    const at = (T: number) => meta.panelLive(s1, input(T));
    expect(at(4)).toMatchObject({ scrubX: 4, readout: "4.00" });
    expect(at(2).chips.find((c) => c.slot === 0)!.text).toBe("0.00");
    expect(at(4).chips.find((c) => c.slot === 0)!.text).toBe("0.00");
    expect(at(1).chips.find((c) => c.slot === 0)!.value).toBeCloseTo(3, 12);
    expect(at(6).chips.find((c) => c.slot === 2)!.value).toBeCloseTo(6 / 4 - 1, 12);
    expect(driftAt(4, 4, 7)).toBe(0);
    expect(at(4).chips.find((c) => c.slot === 2)!.text).toBe("0.00");
    // the pendulum card draws your wave at amplitude 1 over the faint shield
    const g = at(4).liveCards.find((c) => c.slot === 1) as Extract<(typeof s1.cards)[number], { kind: "graph" }>;
    expect(g.plots.map((p) => [p.id, p.style])).toEqual([["f", "ghost"], ["g", "solid"]]);
    expect(pendulumWave(4, 1)).toBeCloseTo(1, 12);
    // untouched: no live cards, the line rests on the dial's minimum
    expect(meta.panelLive(s1, input(null))).toMatchObject({ scrubX: 0, liveCards: [] });
    // the drift chip stays hidden while the card is dark
    expect(meta.panelLive(meta.panelStatic(stat()), input(6)).chips.some((c) => c.slot === 2)).toBe(false);
  });
});

describe("pendulum_sync · describe, audio, hints", () => {
  it("chips: T on the pylon (green), the equation on the shield rim, span numerals at the ends and the centre", () => {
    const d = meta.describe(meta.pose(input(4)), input(4));
    expect(d.chips).toContainEqual({ anchor: "pylon_pivot", text: "T: 4.00 s", color: "g" });
    expect(d.chips).toContainEqual({ anchor: "shield_rim", text: VIEW.equation, color: "f" });
    expect(d.chips.filter((c) => c.anchor.startsWith("span_")).map((c) => c.text)).toEqual(["−3", "0", "3"]);
    expect(spanChipTiles({ spanTiles: 7 })).toEqual([-3, 0, 3]);
    expect(d.nearMiss).toBeNull();
    expect(meta.describe(meta.pose(input(null)), input(null)).chips.some((c) => c.anchor === "pylon_pivot")).toBe(false);
  });

  it("screen-reader text never states the target period", () => {
    for (const T of [null, 1, 2, 3.9, 4, 6.5]) {
      const text = meta.describe(meta.pose(input(T, { t: 1.7 })), input(T, { t: 1.7 })).srText;
      expect(text).not.toMatch(/\d/); // no numbers at all: a beat period would let a listener solve for T₀
    }
    expect(meta.describe(meta.pose(input(4)), input(4)).srText).toMatch(/lockstep/);
    expect(meta.describe(meta.pose(input(2)), input(2)).srText).toMatch(/steadily/); // a beat every 4 s at T = 2, told qualitatively
    expect(meta.describe(meta.pose(input(0.5)), input(0.5)).srText).toMatch(/quickly/);
  });

  it("sync_hum pitch rises with B; silent before the pendulum is touched", () => {
    const hum = (B: number) => meta.audio({ ...meta.pose(input(3)), B } as PendulumSyncPose, input(3))[0];
    expect(hum(0.2).cue).toBe("sync_hum");
    expect(hum(0.9).pitch!).toBeGreaterThan(hum(0.5).pitch!);
    expect(hum(0.5).pitch!).toBeGreaterThan(hum(0.1).pitch!);
    expect(meta.audio(meta.pose(input(null)), input(null))).toEqual([]);
  });

  it("hint targets follow trig §5.6: circle the shield boss, land on the pylon pivot, ride the bob", () => {
    expect(meta.hintTargets(1, stat())).toEqual([{ anchor: "shield_boss", action: "circle", holdMs: 2000 }]);
    expect(meta.hintTargets(2, stat())).toEqual([{ anchor: "pylon_pivot", action: "land", holdMs: 1500 }]);
    expect(meta.hintTargets(3, stat())).toEqual([{ anchor: "bob", action: "ride", holdMs: 4000 }]);
  });
});

describe("pendulum_sync · plans", () => {
  it("the failure plan snaps the thread (≤ 1.6 s, thread_snap); reach flashes the span tiles, half flashes the bob", () => {
    const plan = meta.failurePlan(diag({ failKey: "over", probeKeys: ["reach"] }), input(6));
    expect(plan.durationMs).toBeLessThanOrEqual(1600);
    expect(plan.durationMs).toBeGreaterThanOrEqual(600);
    expect(plan.cue).toBe("thread_snap");
    expect(plan.beats[0]).toMatchObject({ atMs: 0, anchor: "thread", action: "snap" });
    expect(plan.beats.find((b) => b.anchor === "span_0")).toMatchObject({ action: "flash", params: { tiles: 7 } });
    const half = meta.failurePlan(diag({ failKey: "under", probeKeys: ["half"] }), input(2));
    expect(half.beats.some((b) => b.anchor === "bob" && b.action === "flash")).toBe(true);
    expect(half.beats.some((b) => b.anchor === "span_0")).toBe(false);
    for (let i = 1; i < plan.beats.length; i++) expect(plan.beats[i].atMs).toBeGreaterThanOrEqual(plan.beats[i - 1].atMs);
  });

  it("the success plan: gold thread, the swing decays, the Warden kneels, the Star Door opens (1.2–2.5 s)", () => {
    const plan = meta.successPlan({ ...input(4), solved: true }, "door_opens");
    expect(plan.durationMs).toBeGreaterThanOrEqual(1200);
    expect(plan.durationMs).toBeLessThanOrEqual(2500);
    expect(plan.cue).toBe("resonance_lock");
    expect(plan.beats.map((b) => [b.anchor, b.action])).toEqual([
      ["thread", "lock"],
      ["shield_boss", "cycle"],
      ["shoulder", "lower"],
      ["door_center", "open"],
      ["door_center", "ignite"],
    ]);
  });

  it("the solved pose: thread steady, the shield rests on the floor beside the kneeling Warden, clear of the doorway", () => {
    const solved = meta.solvedPose({ ...input(4), solved: true });
    expect(solved).toMatchObject({ locked: true, B: 1, kneel: 1, lower: 1, door: 1, solved: true });
    const g = shieldGeometry(solved, CONFIG);
    expect(g.pivot.y).toBe(PIVOT.y + KNEEL_DROP);
    expect(g.boss.y).toBeCloseTo(-SHIELD_R, 6); // standing on the floor
    expect(g.boss.x - SHIELD_R).toBeGreaterThan(260); // clear of the right leaf's opening
    expect(restAngle(CONFIG)).toBeGreaterThan(0);
    // live: the haft hangs from the gauntlet above the door's centre
    const live = shieldGeometry({ shieldAngle: 0, kneel: 0, lower: 0 }, CONFIG);
    expect(live.boss).toEqual({ x: 0, y: PIVOT.y + CONFIG.shieldArmPx });
  });
});

describe("pendulum_sync · lerp, snapshots, validation", () => {
  it("a scrub from T = 1 to 6 passes ≥ 3 intermediate poses (★30); angles interpolate, discrete fields snap at ½", () => {
    let eased = meta.pose(input(1, { t: 0.5 }));
    const target = meta.pose(input(6, { t: 0.5 }));
    const seen = new Set<string>();
    for (let f = 0; f < 20; f++) {
      eased = meta.lerp(eased, target, smoothingFactor(16));
      seen.add(eased.value.toFixed(2));
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
    const a = meta.pose(input(null, { t: 0 }));
    const b = meta.pose(input(4, { t: 1 }));
    expect(meta.lerp(a, b, 0.4).touched).toBe(false);
    expect(meta.lerp(a, b, 0.6).touched).toBe(true);
    expect(meta.lerp(a, b, 0.5).shieldAngle).toBeCloseTo(b.shieldAngle / 2, 12);
  });

  it("snapshots: the dormant Warden stands with the shield at rest and the door shut; solved kneels with the door open", () => {
    const skin = PENDULUM_SYNC_SKINS[0];
    expect(skin.id).toBe("wardens_shield");
    const doorL = (parts: typeof skin.snapshot.dormant) => parts.find((p) => p.asset.endsWith("star_door_l"))!;
    expect(doorL(skin.snapshot.dormant).dx).toBe(-130);
    expect(doorL(skin.snapshot.solved).dx).toBe(-390);
    expect(skin.snapshot.solved.find((p) => p.asset.endsWith("warden_body"))!.dy - skin.snapshot.dormant.find((p) => p.asset.endsWith("warden_body"))!.dy).toBe(KNEEL_DROP);
    // the baked parts match the meta's solved pose (fails when they drift)
    expect(skin.snapshot.solved).toEqual(wardenSnapshot(meta.solvedPose(snapshotInput(true)), PendulumSyncConfig.parse({})));
    expect(skin.snapshot.dormant.filter((p) => p.asset.endsWith("span_tile"))).toHaveLength(7);
  });

  it("validateConfig: period/frequency asks only; warns when the sweep outruns the arm or the tiles", () => {
    const ctx = (view: unknown) => ({ modeKey: "tuner.oscillator" as const, encounter: enc, params: enc.params, solution: enc.solution, view, texts: [], biome: "orrery_terraces" });
    expect(validatePendulumSync(CONFIG, ctx(VIEW))).toEqual([]);
    expect(validatePendulumSync(CONFIG, ctx({ ...VIEW, ask: "amplitude" }))[0].severity).toBe("error");
    expect(validatePendulumSync(CONFIG, ctx({ ...VIEW, ask: "frequency" }))).toEqual([]);
    const tight = PendulumSyncConfig.parse({ shieldArmPx: 250, spanTiles: 3 });
    expect(validatePendulumSync(tight, ctx(VIEW)).map((i) => i.path[0])).toEqual(["shieldArmPx", "spanTiles"]);
    expect(meta.validateConfig(CONFIG, ctx(VIEW))).toEqual([]);
    expect(meta.writerConfigSchema({ modeKey: "tuner.oscillator", view: VIEW, itemKeys: [], domain: "math" })).toBeNull();
  });

  it("frequency asks: the pendulum period is 1/f and the locked predicate still mirrors the grade", () => {
    const fView: OscillatorView = { ...VIEW, ask: "frequency", askLabel: "frequency", dial: { ...VIEW.dial, min: 0, max: 1, step: 0.01 } };
    const p = meta.pose({ ...input(0.25), view: fView });
    expect(p.T).toBeCloseTo(4, 12);
    expect(p.locked).toBe(true);
    expect(meta.pose({ ...input(0.5), view: fView }).locked).toBe(false);
    expect(meta.describe(p, { ...input(0.25), view: fView }).chips[0]).toMatchObject({ text: "f: 0.25 Hz" });
  });
});
