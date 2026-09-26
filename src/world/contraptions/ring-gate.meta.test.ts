/* eslint-disable @typescript-eslint/no-restricted-imports -- tests may read params and solutions (docs/design/20 §2.5.6):
   they grade with the mechanics registry, which the meta itself never imports. */
/**
 * ring_gate meta — the §7.4 row (docs/design/20) and trig §5.2's pure tests: angles at 0, π/2, π, 2π; tally(2π) = 2;
 * PARITY aligned ⟺ |T − π| ≤ 0.1885 ⟺ grade correct (400 samples); ghost coincidence max|f(t) − f(t + T)| < 1e−9 at
 * T = π; the release replay progress resets on settle; near-miss `aligned_multiple` at 2π and `short_of_cycle` below π;
 * plus plans, panel, snapshots and the ≥ 3 intermediate poses of a scrub (★30).
 */
import { describe, expect, it } from "vitest";
import trigFixture from "../../../fixtures/trig-dungeon.json";
import docConfigs from "../../../tests/world-doc-configs.json";
import { GameSpec } from "../../contracts/gamespec";
import { getMode } from "../../mechanics/registry";
import { smoothingFactor } from "../ease";
import { configCtxFor } from "../library";
import type { Diagnosis, Draft, OscillatorView, PoseInput, StaticInput } from "../types";
import {
  ghostCard,
  ghostOffset,
  isAligned,
  lapsFor,
  nearMissOf,
  RING_GATE_SKINS,
  RingGateConfig,
  ringGateMeta as meta,
  ringSnapshot,
  replayProgress,
  snapshotInput,
  tallyOf,
  waveOf,
  waveValue,
  wrapPi,
  type RingGatePose,
} from "./ring-gate.meta";

const PI = Math.PI;
const spec = GameSpec.parse(trigFixture);
const E2 = spec.encounters.findIndex((e) => e.id === "e2_period");
const enc = spec.encounters[E2];
const mode = getMode(enc.familyId, enc.mode)!;
const VIEW = mode.present(enc.params, spec.seed + E2) as OscillatorView;
const CONFIG = RingGateConfig.parse(docConfigs.configs.find((c) => c.encounterId === "e2_period")!.config);

function draft(value: number, over: Partial<Draft> = {}): Draft {
  return { encounterId: "e2_period", modeKey: "tuner.oscillator", input: { value }, complete: true, focus: null, hover: null, probe: null, settled: false, wave: null, marks: null, seq: 1, ...over };
}
function input(value: number | null, over: Partial<PoseInput<RingGateConfig>> = {}): PoseInput<RingGateConfig> {
  return { view: VIEW, draft: value === null ? null : draft(value), config: CONFIG, probe: null, t: 0, aidTier: 0, hintsUsed: 0, sim: null, solved: false, reducedMotion: false, ...over };
}
function stat(over: Partial<StaticInput<RingGateConfig>> = {}): StaticInput<RingGateConfig> {
  return { view: VIEW, config: CONFIG, aidTier: 0, hintsUsed: 0, reducedMotion: false, skinId: "ring_gate", record: false, ...over };
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
const diag = (failKey: Diagnosis["failKey"]): Diagnosis => ({ correct: false, feedback: "", displayFeedback: "", failKey, wrongKeys: [], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [] });

describe("ring_gate · the view and the rings", () => {
  it("reads e2's view: sin(2t), ask period, answer π, tolerance 0.03 × 2π", () => {
    const w = waveOf(VIEW);
    expect(w).toMatchObject({ ask: "period", wave: "sin", b: 2, c: 0, d: 0, amplitude: 1, pi: true });
    expect(w.answer).toBeCloseTo(PI, 12);
    expect(w.tol).toBeCloseTo(0.1885, 4);
    expect(w.dial.max).toBeCloseTo(2 * PI, 12);
  });

  it("angles at T = 0, π/2, π and 2π (outer ring −(b·T mod 2π); inner disc (π/2)·sin(2T))", () => {
    const at = (T: number) => meta.pose(input(T));
    expect(at(0)).toMatchObject({ outerAngle: 0, turns: 0, tally: 0 });
    expect(at(0).innerAngle).toBeCloseTo(0, 12);
    expect(at(PI / 2).outerAngle).toBeCloseTo(-PI, 12);
    expect(at(PI / 2).innerAngle).toBeCloseTo(0, 9);
    expect(at(PI / 2).turns).toBeCloseTo(0.5, 12);
    expect(at(PI).outerAngle).toBe(0);
    expect(at(PI).turns).toBeCloseTo(1, 12);
    expect(at(PI).innerAngle).toBeCloseTo(0, 9);
    expect(at(2 * PI).outerAngle).toBe(0);
    expect(at(2 * PI).turns).toBeCloseTo(2, 12);
    expect(at(PI / 4).innerAngle).toBeCloseTo(PI / 2, 12); // sin(π/2) = 1: the disc rocks a full quarter turn
    expect(at(PI / 4).outerAngle).toBeCloseTo(-PI / 2, 12);
    expect(at((3 * PI) / 4).innerAngle).toBeCloseTo(-PI / 2, 12);
  });

  it("tally(2π) = 2; the tally ratchets floor(turns + 0.03)", () => {
    expect(meta.pose(input(2 * PI)).tally).toBe(2);
    expect(tallyOf(2)).toBe(2);
    expect(tallyOf(0.96)).toBe(0);
    expect(tallyOf(0.97)).toBe(1);
    expect(tallyOf(1.5)).toBe(1);
    expect(meta.pose(input(PI)).tally).toBe(1);
    expect(meta.pose(input(PI / 2)).tally).toBe(0);
  });

  it("the misalignment arc is δ = wrap(φ) in (−π, π]", () => {
    expect(wrapPi(0)).toBe(0);
    expect(wrapPi(PI)).toBeCloseTo(PI, 12);
    expect(wrapPi(-PI)).toBeCloseTo(PI, 12);
    expect(wrapPi(2 * PI + 0.3)).toBeCloseTo(0.3, 12);
    expect(meta.pose(input(PI / 2)).misalign).toBeCloseTo(PI, 12);
    expect(meta.pose(input(PI + 0.1)).misalign).toBeCloseTo(0.2, 9);
  });
});

describe("ring_gate · parity with oscillator.grade", () => {
  it("aligned ⟺ |T − π| ≤ 0.1885 ⟺ grade().correct over 400 samples", () => {
    const rnd = seeded(20260926);
    let hits = 0;
    for (let i = 0; i < 400; i++) {
      const T = i % 2 === 0 ? PI + (rnd() - 0.5) * 0.8 : rnd() * 2 * PI;
      const correct = mode.grade(enc.params, { value: T }).correct;
      const aligned = meta.pose(input(T)).aligned;
      expect(aligned, String(T)).toBe(correct);
      expect(Math.abs(T - PI) <= 0.03 * 2 * PI).toBe(correct);
      // the replaying pose keeps the predicate (it is about the value, not the replay frame)
      expect(meta.pose({ ...input(T), draft: draft(T, { settled: true }), t: 0.1 }).aligned).toBe(correct);
      if (correct) hits++;
    }
    expect(hits).toBeGreaterThan(40);
    expect(hits).toBeLessThan(360);
    expect(isAligned(waveOf(VIEW), PI + Math.PI / 12)).toBe(false); // the neighbouring detent is out (trig §5.2)
  });

  it("parity holds for the other asks too (frequency, amplitude, phase, midline)", () => {
    const osc = getMode("tuner", "oscillator")!;
    const rnd = seeded(99);
    const cases = [
      { wave: "sin" as const, amplitude: 1, b: "pi/2", c: "0", d: 0, ask: "frequency" as const },
      { wave: "cos" as const, amplitude: 2.5, b: "3", c: "0", d: 0, ask: "amplitude" as const },
      { wave: "sin" as const, amplitude: 1, b: "2", c: "pi/2", d: 0, ask: "phase" as const },
      { wave: "sin" as const, amplitude: 1, b: "1", c: "0", d: -2, ask: "midline" as const },
    ];
    for (const params of cases) {
      const view = osc.present(params, 1) as OscillatorView;
      const cfg = RingGateConfig.parse({ variant: params.ask === "amplitude" || params.ask === "midline" ? "counterweight" : "notch" });
      for (let i = 0; i < 100; i++) {
        const v = view.dial.min + rnd() * (view.dial.max - view.dial.min);
        const pose = meta.pose({ ...input(v), view, config: cfg });
        expect(pose.aligned, `${params.ask} ${v}`).toBe(osc.grade(params, { value: v }).correct);
      }
      const answer = waveOf(view).answer;
      expect(meta.pose({ ...input(answer), view, config: cfg }).aligned).toBe(true);
      expect(lapsFor(waveOf(view), answer)).toBeCloseTo(1, 12);
    }
  });
});

describe("ring_gate · ghost, replay, near-misses", () => {
  it("ghost coincidence: max|f(t) − f(t + T)| < 1e−9 at T = π (and at 2π); at π/2 the ghost is f upside-down", () => {
    const w = waveOf(VIEW);
    expect(ghostOffset(w, PI)).toBeLessThan(1e-9);
    expect(ghostOffset(w, 2 * PI)).toBeLessThan(1e-9);
    expect(ghostOffset(w, PI / 2)).toBeCloseTo(2, 3);
    // the live ghost card draws exactly that: the g samples equal the faint f samples at T = π
    const card = ghostCard(w, PI);
    const [f, g] = card.plots;
    expect(f.style).toBe("ghost");
    expect(g).toMatchObject({ id: "g", style: "dashed", color: "g" });
    const fy = f.segments.flat().map((p) => p[1]);
    const gy = g.segments.flat().map((p) => p[1]);
    expect(gy).toHaveLength(fy.length);
    expect(Math.max(...fy.map((y, i) => Math.abs(y - gy[i])))).toBeLessThan(1e-9);
    const live = meta.panelLive(meta.panelStatic(stat()), input(PI));
    const lg = live.liveCards.find((c) => c.slot === 1)!;
    expect(lg.kind === "graph" && Math.max(...lg.plots[1].segments.flat().map((p, i) => Math.abs(p[1] - waveValue(w, lg.plots[0].segments.flat()[i][0]))))).toBeLessThan(1e-9);
  });

  it("the release replay: the clock resets on open and settle, progress runs 0 → 1 over max(0.6, T/π) s", () => {
    expect(meta.clock?.resetOn).toEqual(["open", "settle"]);
    const T = (3 * PI) / 2;
    const at = (t: number) => meta.pose({ ...input(T), draft: draft(T, { settled: true }), t });
    expect(at(0).replay).toBe(0);
    expect(at(0).phase).toBe(0); // t reset on settle: the rings start from home again
    expect(at(0).outerAngle).toBe(0);
    expect(at(0.75).replay).toBeCloseTo(0.5, 12); // duration T/π = 1.5 s
    expect(at(0.75).phase).toBeCloseTo(0.5 * 2 * T, 12);
    expect(at(1.5).replay).toBe(1);
    expect(at(5).phase).toBeCloseTo(2 * T, 12);
    expect(replayProgress(0.3, 0.5)).toBeCloseTo(0.5, 12); // short runs take 0.6 s
    // while dragging (not settled) the rings follow T directly
    expect(meta.pose({ ...input(T), t: 0 }).replay).toBe(1);
    // no replay when the config turns it off
    expect(meta.pose({ ...input(T), draft: draft(T, { settled: true }), config: { ...CONFIG, replayOnSettle: false } }).replay).toBe(1);
  });

  it("near-misses: aligned_multiple at 2π, short_of_cycle below π, none when aligned or past one lap", () => {
    const w = waveOf(VIEW);
    expect(nearMissOf(w, 2 * PI)).toBe("aligned_multiple");
    expect(nearMissOf(w, 2 * PI - 0.15)).toBe("aligned_multiple");
    expect(nearMissOf(w, PI / 2)).toBe("short_of_cycle");
    expect(nearMissOf(w, PI - 0.3)).toBe("short_of_cycle");
    expect(nearMissOf(w, PI)).toBeNull();
    expect(nearMissOf(w, PI - 0.15)).toBeNull();
    expect(nearMissOf(w, 1.5 * PI)).toBeNull();
    const d2 = meta.describe(meta.pose(input(2 * PI)), input(2 * PI));
    expect(d2.nearMiss).toBe("aligned_multiple");
    expect(d2.srText).toBe("The notch is home, but the tally reads II.");
    expect(meta.describe(meta.pose(input(PI / 2)), input(PI / 2)).nearMiss).toBe("short_of_cycle");
    // the near-miss comes from the full run even mid-replay (Diagnosis reads describe(pose(submitted)))
    const mid = { ...input(2 * PI), draft: draft(2 * PI, { settled: true }), t: 0.2 };
    expect(meta.describe(meta.pose(mid), mid).nearMiss).toBe("aligned_multiple");
    expect(meta.describe(meta.pose(input(null)), input(null)).nearMiss).toBeNull();
    for (const k of ["aligned_multiple", "short_of_cycle"]) expect(meta.nearMissKeys).toContain(k);
  });

  it("describe: the y chip at the inner hub, the laps chip only from tier 2, degrees (never the answer) in srText", () => {
    const d = meta.describe(meta.pose(input(0.75 * PI)), input(0.75 * PI));
    expect(d.chips).toEqual([{ anchor: "inner_hub", text: "y: −1.00", color: "f" }]);
    expect(d.srText).toBe("The notch is 90° from home; the tally reads 0.");
    const t2 = input(0.92 * PI, { aidTier: 2 });
    expect(meta.describe(meta.pose(t2), t2).chips.find((c) => c.anchor === "rim")).toEqual({ anchor: "rim", text: "laps: 0.92", color: "h" });
    expect(meta.describe(meta.pose(input(PI)), input(PI)).srText).toBe("The notches line up: the doorway is clear.");
  });
});

describe("ring_gate · plans", () => {
  it("failure (≤ 1.6 s): the pawl strikes the rim off-home, slips on tooth II at 2π; the arc pulses twice", () => {
    const strike = meta.failurePlan(diag("under"), input(PI / 2));
    expect(strike.durationMs).toBeGreaterThanOrEqual(600);
    expect(strike.durationMs).toBeLessThanOrEqual(1600);
    expect(strike.cue).toBe("latch_clack");
    expect(strike.beats.map((b) => b.action)).toEqual(["snap", "spark", "flash", "flash"]);
    const slip = meta.failurePlan(diag("over"), input(2 * PI));
    expect(slip.cue).toBe("latch_slip");
    expect(slip.beats.find((b) => b.action === "grind")).toMatchObject({ anchor: "tally", params: { tooth: 2 } });
    expect(slip.beats.filter((b) => b.anchor === "misalign")).toHaveLength(2);
  });

  it("success (1.2–2.5 s): pawl locks, one more lap, fins split, light, water surges, the skiff rides in", () => {
    const plan = meta.successPlan({ ...input(PI), solved: true }, "door_opens");
    expect(plan.durationMs).toBeGreaterThanOrEqual(1200);
    expect(plan.durationMs).toBeLessThanOrEqual(2500);
    expect(plan.cue).toBe("latch_click");
    expect(plan.beats.map((b) => `${b.anchor}:${b.action}`)).toEqual([
      "pawl_tip:lock",
      "ring_center:spin",
      "fin_split:open",
      "doorway:ignite",
      "doorway:flood",
      "skiff:ride",
    ]);
    for (const b of plan.beats) expect(b.atMs).toBeLessThan(plan.durationMs);
    const dry = meta.successPlan({ ...input(PI), solved: true, config: { ...CONFIG, flow: "none" } }, "door_opens");
    expect(dry.beats.some((b) => b.action === "flood")).toBe(false);
    const solved = meta.solvedPose({ ...input(null), solved: true });
    expect(solved).toMatchObject({ aligned: true, home: true, fin: 1, doorOpen: 1, water: 1, solved: true, outerAngle: 0, innerAngle: 0, tally: 1 });
    expect(solved.value).toBeCloseTo(PI, 12);
  });
});

describe("ring_gate · live motion (★30: ≥ 3 intermediate poses while scrubbing)", () => {
  it("the eased rings turn continuously (unwrapped phase) through distinct intermediate poses", () => {
    let eased: RingGatePose = meta.pose(input(0.2));
    const target = meta.pose(input(1.8 * PI));
    const k = smoothingFactor(1000 / 60);
    const seen: RingGatePose[] = [];
    for (let f = 0; f < 30; f++) {
      eased = meta.lerp(eased, target, k);
      seen.push(eased);
    }
    const phases = seen.map((p) => p.phase);
    for (let i = 1; i < phases.length; i++) expect(phases[i]).toBeGreaterThan(phases[i - 1]); // no wrap-around jump
    expect(new Set(seen.map((p) => p.outerAngle.toFixed(3))).size).toBeGreaterThanOrEqual(3);
    expect(new Set(seen.map((p) => p.tally))).toEqual(new Set([0, 1]));
    expect(seen[2].lag).toBeGreaterThan(0);
    expect(meta.audio(seen[2], input(1.8 * PI))[0]).toMatchObject({ cue: "ring_turn" });
  });
});

describe("ring_gate · panel", () => {
  it("static: f(t), the ghost f(t + T), the laps card (dark until tier 2); the Scrubber is T over the dial", () => {
    const s = meta.panelStatic(stat());
    expect(s.cards.map((c) => [c.kind, c.slot, c.kind === "graph" ? c.tab : ""])).toEqual([
      ["graph", 0, "f(t)"],
      ["graph", 1, "g"],
      ["graph", 2, "h"],
    ]);
    const laps = s.cards[2];
    expect(laps.kind === "graph" && laps.empty).toBe(true);
    const laps2 = meta.panelStatic(stat({ aidTier: 2 })).cards[2];
    expect(laps2.kind === "graph" && laps2.plots.map((p) => p.id)).toEqual(["laps", "floor"]);
    expect(laps2.kind === "graph" && laps2.plots[1].endpoints.some((e) => e.open)).toBe(true);
    const f0 = s.cards[0];
    expect(f0.kind === "graph" && f0.annotations.some((a) => a.kind === "period_marker")).toBe(false);
    const f1 = meta.panelStatic(stat({ aidTier: 1 })).cards[0];
    expect(f1.kind === "graph" && f1.annotations.find((a) => a.kind === "period_marker")).toMatchObject({ x: 0, y: 0 });
    expect(s.input).toMatchObject({ symbol: "T", min: 0, unit: "pi", format: "pi" });
    expect(s.input!.step).toBeCloseTo(PI / 12, 12);
    expect(s.input!.ticks.filter((t) => t.major).map((t) => t.label)).toEqual(["0", "π/4", "π/2", "3π/4", "π", "5π/4", "3π/2", "7π/4", "2π"]);
    expect(s.probe).toBeNull();
  });

  it("live: the readout in π, the f(T) chip, the laps chip from tier 2, live dots", () => {
    const live = meta.panelLive(meta.panelStatic(stat({ aidTier: 2 })), input(0.75 * PI, { aidTier: 2 }));
    expect(live.scrubX).toBeCloseTo(0.75 * PI, 12);
    expect(live.readout).toBe("3π/4");
    expect(live.chips).toEqual([
      { slot: 0, value: expect.closeTo(-1, 9), text: "−1.00", color: "f" },
      { slot: 2, value: expect.closeTo(0.75, 9), text: "0.75", color: "h" }, // laps = bT / 2π
    ]);
    expect(live.liveCards.map((c) => c.slot)).toEqual([0, 1, 2]);
    expect(meta.panelLive(meta.panelStatic(stat()), input(PI / 2)).readout).toBe("π/2");
    expect(meta.panelLive(meta.panelStatic(stat()), input(null)).liveCards).toHaveLength(0);
  });

  it("the hint targets are the station table (circle the ring, land on the hub, land on the tally)", () => {
    expect(meta.hintTargets(1, stat())).toEqual([{ anchor: "ring_center", action: "circle", holdMs: 1500 }]);
    expect(meta.hintTargets(2, stat())).toEqual([{ anchor: "inner_hub", action: "land", holdMs: 1500 }]);
    expect(meta.hintTargets(3, stat())).toEqual([{ anchor: "tally", action: "land", holdMs: 2000 }]);
    // a null view and an empty config still resolve (world-contract seam test)
    expect(meta.hintTargets(1, { ...stat(), view: null, config: {} as RingGateConfig })).toEqual(RING_GATE_SKINS[0].hintTargets[0]);
  });
});

describe("ring_gate · config, skin, snapshots", () => {
  it("the doc's e2 config validates (variant notch for a period ask); counterweight is for amplitude/midline", () => {
    const ctx = configCtxFor(spec, E2, "orrery_terraces");
    expect(meta.validateConfig(CONFIG, ctx)).toEqual([]);
    expect(meta.validateConfig({ ...CONFIG, variant: "counterweight" }, ctx).map((i) => i.path[0])).toEqual(["variant"]);
    expect(meta.defaultConfig(ctx).variant).toBe("notch");
    const cw = meta.pose({ ...input(3), view: { ...VIEW, ask: "amplitude" }, config: { ...CONFIG, variant: "counterweight" } });
    expect(cw.counterweight).toBe(true);
    expect(cw.weight).toBeGreaterThan(0);
  });

  it("the skin keeps the §4.3 slots and anchors; the DOM snapshots are baked from the rest and solved poses", () => {
    const skin = RING_GATE_SKINS[0];
    expect(skin.id).toBe("ring_gate");
    expect(skin.anchors).toEqual(["ring_center", "doorway", "tally", "pawl_tip", "fin_split", "inner_hub", "console"]);
    expect(skin.parts.map((p) => p.slot)).toEqual(["gate_wall", "outer_ring", "inner_disc", "fin_l", "fin_r", "tally_wheel", "pawl", "canal", "skiff", "console"]);
    expect(skin.snapshot.dormant).toEqual(ringSnapshot(meta.pose(snapshotInput(false))));
    expect(skin.snapshot.solved).toEqual(ringSnapshot(meta.solvedPose(snapshotInput(true))));
    const finL = (parts: typeof skin.snapshot.solved) => parts.find((p) => p.asset.endsWith("_fin_l"))!.dx;
    expect(finL(skin.snapshot.dormant) - finL(skin.snapshot.solved)).toBe(24); // the fins split on success
    expect(skin.snapshot.solved.some((p) => p.asset.endsWith("_skiff"))).toBe(true);
    expect(skin.snapshot.dormant.some((p) => p.asset.endsWith("_skiff"))).toBe(false);
    expect([...skin.snapshot.dormant, ...skin.snapshot.solved].some((p) => p.asset.endsWith("_console"))).toBe(false);
    expect(meta.debug(meta.pose(input(PI)))).toMatchObject({ aligned: true, tally: 1, ringAngle: 0 });
  });
});
