import { describe, expect, it } from "vitest";
import type { AnyContraptionMeta, AnySandboxMeta, Diagnosis, Draft, ModeKey } from "../../../../world/types";
import { CONTRAPTION_LIBRARY, SANDBOX_LIBRARY } from "../../../../world/library";
import { makeDraft } from "../../../../world/draft-inputs";
import { ControllerCore, MAX_SIM_STEPS, SR_THROTTLE_MS } from "./controller-core";
import { SandboxCore } from "./sandbox-core";

const diagnosis: Diagnosis = { correct: false, feedback: "", displayFeedback: "", failKey: "over", wrongKeys: [], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [] };

/** A tiny meta with a clock, a sim and a probe, to exercise every controller path. */
function fakeMeta(over: Partial<AnyContraptionMeta> = {}): AnyContraptionMeta {
  const base = CONTRAPTION_LIBRARY.console_slate;
  return {
    ...base,
    id: "fake",
    clock: { resetOn: ["open", "settle", "probe_change", "arena"] },
    probe: () => ({ symbol: "x", label: "probe", min: 0, max: 10, step: 1, unit: "", format: "number", initial: 2, stops: [], window: null, playback: false }),
    sim: {
      init: () => ({ n: 0 }),
      step: (s: { n: number }) => ({ n: s.n + 1 }),
      fixedDt: 1 / 30,
      resetOn: ["draft_change", "probe_change", "settle"],
      readout: (s: { n: number }) => ({ steps: s.n }),
    },
    pose: (input) => ({ value: (input.draft?.input as { value?: number } | undefined)?.value ?? 0, t: input.t, probe: input.probe, solved: input.solved }),
    lerp: (a: { value: number }, b: { value: number }, t: number) => ({ ...b, value: a.value + (b.value - a.value) * t }),
    describe: (p: { value: number }) => ({ chips: [{ anchor: "slate", text: `v ${p.value.toFixed(1)}`, color: "f" as const }], pins: [], srText: `value ${Math.round(p.value)}`, nearMiss: null }),
    solvedPose: () => ({ value: 99, t: 0, probe: null, solved: true }),
    debug: (p: { value: number }) => ({ value: p.value }),
    frameBounds: () => ({ x: -10, y: -20, w: 30, h: 40 }),
    ...over,
  } as AnyContraptionMeta;
}
const opts = (meta: AnyContraptionMeta, reducedMotion = false) => ({
  meta,
  config: {},
  view: {},
  skinId: "lectern_slate",
  seed: 7,
  reducedMotion,
  record: false,
  payoffAnim: "gate_lifts" as const,
  station: { hintTargets: null },
});
const draft = (value: number, over: Partial<Draft> = {}): Draft => ({ ...makeDraft("e1", "tuner.oscillator" as ModeKey, { value }), ...over });

describe("ControllerCore", () => {
  it("eases toward the target pose (≈95 % in 330 ms) and snaps with reduced motion", () => {
    const c = new ControllerCore(opts(fakeMeta()));
    c.bind(draft(10));
    for (let i = 0; i < 20; i++) c.tick(16.5);
    expect((c.eased as { value: number }).value).toBeGreaterThan(9.4);
    expect((c.eased as { value: number }).value).toBeLessThan(10);
    const r = new ControllerCore(opts(fakeMeta(), true));
    r.bind(draft(10));
    r.tick(16);
    expect((r.eased as { value: number }).value).toBe(10);
  });

  it("states follow drafts; open resets the clock and seeds the sim; the sim steps at a fixed dt only while open", () => {
    const c = new ControllerCore(opts(fakeMeta()));
    expect(c.state).toBe("dormant");
    c.setState("awake");
    c.bind(draft(1));
    expect(c.state).toBe("active");
    c.tick(500);
    expect((c.sim as { n: number }).n).toBe(0); // seeded by the draft change, but it only steps while open
    c.setOpen(true);
    expect(c.t).toBe(0);
    c.tick(100);
    expect((c.sim as { n: number }).n).toBe(3);
    c.tick(1000);
    expect((c.sim as { n: number }).n).toBe(3 + MAX_SIM_STEPS);
    c.setOpen(true); // no-op
    c.setOpen(false);
    c.tick(100);
    expect((c.sim as { n: number }).n).toBe(3 + MAX_SIM_STEPS);
  });

  it("clock resets on settle, probe change and arena; the probe defaults to its initial value", () => {
    const c = new ControllerCore(opts(fakeMeta()));
    expect(c.probeValue()).toBe(2);
    c.tick(1000);
    c.bind(draft(1, { settled: true, seq: 1 }));
    expect(c.t).toBe(0);
    c.tick(1000);
    c.bind(draft(1, { settled: true, seq: 2, probe: 5 }));
    expect(c.t).toBe(0);
    expect(c.probeValue()).toBe(5);
    c.tick(1000);
    c.arena();
    expect(c.t).toBe(0);
    c.timeScale = 0.5;
    c.tick(1000);
    expect(c.t).toBeCloseTo(0.5);
  });

  it("solved: settleSolved, plans, hint targets, frame bounds, debug and audio", () => {
    const c = new ControllerCore(opts(fakeMeta()));
    c.setOpen(true);
    c.bind(draft(3));
    c.tick(16);
    const dbg = c.debugState();
    expect(dbg).toMatchObject({ value: expect.any(Number), "target.value": 3, state: "active", open: true, probe: 2, "sim.steps": 0 });
    expect(c.failurePlan(diagnosis).durationMs).toBeGreaterThan(0);
    expect(c.successPlan().durationMs).toBeGreaterThanOrEqual(1200);
    expect(c.hintTargets(1).length).toBeGreaterThan(0);
    expect(c.frameBounds()).toEqual({ x: -10, y: -20, w: 30, h: 40 });
    expect(c.audio()).toEqual([]);
    c.settleSolved();
    expect(c.state).toBe("solved");
    expect((c.eased as { value: number }).value).toBe(99);
    c.tick(16);
    expect((c.target as { value: number }).value).toBe(99);
    expect((c.solvedPose() as { solved: boolean }).solved).toBe(true);
    c.setState("dormant");
    expect(c.solved).toBe(true);
  });

  it("throttles screen-reader text to changes at most once a second", () => {
    const c = new ControllerCore(opts(fakeMeta(), true));
    c.bind(draft(1));
    c.tick(16);
    expect(c.srDue(0)).toBe("value 1");
    expect(c.srDue(100)).toBeNull();
    c.bind(draft(5));
    c.tick(16);
    expect(c.srDue(500)).toBeNull();
    expect(c.srDue(SR_THROTTLE_MS + 1)).toBe("value 5");
  });

  it("a throwing meta never breaks the frame: last pose kept, one warning", () => {
    const warns: string[] = [];
    const bad = fakeMeta({
      pose: () => {
        throw new Error("boom");
      },
    });
    const c = new ControllerCore(opts(bad), (m) => warns.push(m));
    c.tick(16);
    c.tick(16);
    expect(warns).toHaveLength(1);
    expect(c.errors).toBeGreaterThan(1);
  });

  it("drives the real console_slate meta", () => {
    const c = new ControllerCore(opts(CONTRAPTION_LIBRARY.console_slate, true));
    c.bind(draft(1, { complete: true }));
    c.tick(16);
    expect(c.debugState()).toMatchObject({ mirrors: true, complete: true });
    expect(c.probeValue()).toBeNull();
  });
});

describe("SandboxCore", () => {
  const meta = SANDBOX_LIBRARY.music_box as AnySandboxMeta;
  const config = meta.configSchema.parse({
    amplitude: { symbol: "A", label: "reach", min: 0.5, max: 3, step: 0.1 },
    rate: { symbol: "b", label: "rhythm", min: 0.5, max: 4, step: 0.1 },
  });
  it("tracks history (drafts, moved inputs, ranges, seconds active) and reports a goal once", () => {
    let reached = 0;
    const always = { ...meta, goalMet: () => true } as AnySandboxMeta;
    const s = new SandboxCore(always, config, 1, false, "explored");
    s.bind({ values: { A: 1, b: 1 }, placed: {}, settled: false, seq: 1 });
    s.bind({ values: { A: 2, b: 1 }, placed: {}, settled: true, seq: 2 });
    s.tick(100); // closed: no goal
    s.setOpen(true);
    if (s.tick(500)) reached++;
    if (s.tick(500)) reached++;
    const h = s.history();
    expect(h.drafts).toBe(2);
    expect([...h.moved]).toEqual(["A"]);
    expect(h.ranges.A).toEqual([1, 2]);
    expect(h.secondsActive).toBeCloseTo(1);
    expect(h.placedAll).toBe(false);
    expect(reached).toBe(1);
    expect(s.debugState()).toMatchObject({ drafts: 2, moved: 1, goals: "explored" });
    expect(s.frameBounds().w).toBeGreaterThan(0);
  });
  it("without a goal nothing is reported", () => {
    const s = new SandboxCore(meta, config, 1, true, null);
    s.setOpen(true);
    s.bind(null);
    expect(s.tick(16)).toBeNull();
  });
});

describe("SandboxCore with tokens and a sim", () => {
  it("placedAll needs every token placed; the sim steps at a fixed dt while open; throwing metas warn once", () => {
    const base = SANDBOX_LIBRARY.darkroom as AnySandboxMeta;
    const meta = {
      ...base,
      inputs: () => [{ kind: "tokens" as const, id: "negs", tokens: [{ key: "n1", label: "one", icon: null }, { key: "n2", label: "two", icon: null }], targets: [{ key: "tray", label: "tray" }] }],
      sim: { init: () => ({ n: 0 }), step: (s: { n: number }) => ({ n: s.n + 1 }), fixedDt: 1 / 30, resetOn: [], readout: () => ({}) },
    } as unknown as AnySandboxMeta;
    const s = new SandboxCore(meta, base.configSchema.parse({ negatives: ["neg_1", "neg_2"], trays: 3 }), 1, false, null);
    s.bind({ values: {}, placed: { n1: "tray" }, settled: true, seq: 1 });
    expect(s.history().placedAll).toBe(false);
    s.bind({ values: {}, placed: { n1: "tray", n2: "tray" }, settled: true, seq: 2 });
    expect(s.history().placedAll).toBe(true);
    expect([...s.history().moved].sort()).toEqual(["n1", "n2"]);
    s.setOpen(true);
    s.tick(100);
    expect((s.sim as { n: number }).n).toBe(3);
    s.tick(1000);
    expect((s.sim as { n: number }).n).toBe(7);
    const warns: string[] = [];
    const bad = new SandboxCore({ ...meta, pose: () => { throw new Error("x"); } } as unknown as AnySandboxMeta, {}, 1, false, null, (m) => warns.push(m));
    bad.tick(16);
    bad.tick(16);
    expect(warns).toHaveLength(1);
  });
});
