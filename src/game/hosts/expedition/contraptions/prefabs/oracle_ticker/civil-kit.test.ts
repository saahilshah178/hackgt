import { describe, expect, it } from "vitest";
import { routerLanesMeta, RouterLanesConfig } from "@/world/contraptions/router-lanes.meta";
import { stepBridgeMeta, StepBridgeConfig } from "@/world/contraptions/step-bridge.meta";
import { makeDraft } from "@/world/draft-inputs";
import type { Diagnosis, FailBeat, PoseInput, SuccessBeat } from "@/world/types";
import {
  anchorIndex,
  bounceHop,
  civilColors,
  dissolveCurve,
  findBeat,
  grindOffset,
  hexOf,
  localGround,
  mix,
  numParam,
  offsetPolyline,
  pulse,
  quadBezier,
  routeDeckFail,
  routeDeckSuccess,
  routeDrawersFail,
  routeDrawersSuccess,
  slipFlight,
  springStep,
  stairSteps,
  strParam,
  tipCurve,
  typedCount,
} from "./civil-kit";

const diag = (patch: Partial<Diagnosis>): Diagnosis => ({
  correct: false,
  feedback: "",
  displayFeedback: "",
  failKey: null,
  wrongKeys: [],
  prefix: null,
  disclosed: {},
  nearMiss: null,
  probeKeys: [],
  ...patch,
});

describe("civil kit · palette", () => {
  it("resolves tokens and falls back (never black) when a token is missing or malformed", () => {
    expect(hexOf({ ink: "#2B3A44" }, "ink", 0)).toBe(0x2b3a44);
    expect(hexOf({ ink: "2b3a44" }, "ink", 0)).toBe(0x2b3a44);
    expect(hexOf({ ink: "tomato" }, "ink", 0x123456)).toBe(0x123456);
    expect(hexOf({}, "ink", 0x123456)).toBe(0x123456);
    const c = civilColors({});
    expect(c.salmon).toBe(0xc4643c);
    expect(c.accent).toBe(0xe2892c);
    // bible §5.3: no pure black anywhere in the world palette
    for (const v of Object.values(c)) expect(v).toBeGreaterThan(0);
  });
  it("mixes colours channel by channel", () => {
    expect(mix(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mix(0x102030, 0x405060, 0)).toBe(0x102030);
    expect(mix(0x102030, 0x405060, 1)).toBe(0x405060);
    expect(mix(0x102030, 0x405060, 7)).toBe(0x405060);
  });
});

describe("civil kit · motion", () => {
  it("the pendant spring overshoots (zeta < 1) and settles on its target", () => {
    let s = { x: 0, v: 0 };
    let max = 0;
    for (let i = 0; i < 200; i++) {
      s = springStep(s, 1, 16, 40, 0.45);
      max = Math.max(max, s.x);
    }
    expect(max).toBeGreaterThan(1.05);
    expect(Math.abs(s.x - 1)).toBeLessThan(1e-3);
    // critically damped never overshoots; a huge frame stays stable
    let d = { x: 0, v: 0 };
    let dMax = 0;
    for (let i = 0; i < 100; i++) {
      d = springStep(d, 1, 50, 40, 1);
      dMax = Math.max(dMax, d.x);
    }
    expect(dMax).toBeLessThanOrEqual(1 + 1e-6);
    expect(Number.isFinite(springStep({ x: 0, v: 0 }, 1, 10_000, 400, 0.1).x)).toBe(true);
  });
  it("quadratic Bézier flights start and end on their points and arc above both", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 300, y: -100 };
    expect(quadBezier(a, b, 180, 0)).toEqual(a);
    expect(quadBezier(a, b, 180, 1)).toEqual(b);
    expect(quadBezier(a, b, 180, 0.5).y).toBeLessThan(-100);
    const f0 = slipFlight(a, b, 0);
    const f1 = slipFlight(a, b, 1);
    expect(f0).toMatchObject({ x: 0, y: 0, rot: 0 });
    expect(f1.x).toBeCloseTo(300);
    expect(f1.rot).toBeCloseTo(2 * Math.PI); // one full turn (civil §5.8)
  });
  it("stair steps stay UNDER the walking line and cover its span", () => {
    const line = [
      [-200, 0],
      [900, -260],
      [1700, -260],
      [2000, 0],
    ] as const;
    const steps = stairSteps(line, 40, 60);
    expect(steps.length).toBeGreaterThan(8);
    expect(steps[0]!.x).toBe(-200);
    const last = steps[steps.length - 1]!;
    expect(last.x + last.w).toBeCloseTo(2000);
    const yAt = (x: number) => {
      for (let i = 1; i < line.length; i++) {
        const [x0, y0] = line[i - 1]!;
        const [x1, y1] = line[i]!;
        if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      }
      return 0;
    };
    for (const s of steps) {
      // y DOWN: the tread's y is at or below (greater than) the line at both of its ends
      expect(s.y).toBeGreaterThanOrEqual(yAt(s.x) - 1e-6);
      expect(s.y).toBeGreaterThanOrEqual(yAt(s.x + s.w) - 1e-6);
      expect(s.h).toBeGreaterThan(0);
    }
    expect(stairSteps([[0, 0]])).toEqual([]);
  });
  it("pulses, types and fails gently; every failure curve ends where it began", () => {
    expect(pulse(0, 0.5)).toBeCloseTo(0.5);
    expect(pulse(500, 0.5)).toBeCloseTo(1);
    expect(pulse(123, 0.5, true)).toBe(1);
    expect(typedCount(90, 1000, 45)).toBe(45);
    expect(typedCount(90, 10_000, 45)).toBe(90);
    expect(typedCount(90, -5, 45)).toBe(0);
    expect(typedCount(90, 0, 45, true)).toBe(90);
    expect(tipCurve(0, 12)).toMatchObject({ rot: 0, dy: 0, alpha: 1 });
    expect(tipCurve(0.5, 12).rot).toBeCloseTo((12 * Math.PI) / 180);
    const end = tipCurve(1, 12);
    expect(end.rot).toBeCloseTo(0);
    expect(end.dy).toBeCloseTo(0);
    expect(end.alpha).toBeCloseTo(1);
    expect(dissolveCurve(0)).toEqual({ alpha: 1, scatter: 0 });
    expect(dissolveCurve(0.7).alpha).toBeCloseTo(0);
    expect(dissolveCurve(1).alpha).toBeCloseTo(1);
    expect(dissolveCurve(1).scatter).toBeCloseTo(0);
    expect(grindOffset(0, 4, 3)).toBeCloseTo(0);
    expect(grindOffset(1, 4, 3)).toBeCloseTo(0);
    expect(Math.abs(grindOffset(1 / 12, 4, 3))).toBeGreaterThan(0.04);
    const hop = { from: { x: 0, y: -300 }, to: { x: -400, y: -120 } };
    expect(bounceHop(hop.from, hop.to, 0)).toEqual(hop.from);
    expect(bounceHop(hop.from, hop.to, 1)).toEqual(hop.to);
  });
  it("offsets a polyline along its normals (positive = below a left-to-right line)", () => {
    const o = offsetPolyline(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      10,
    );
    expect(o[0]).toEqual({ x: 0, y: 10 });
    expect(o[1]).toEqual({ x: 100, y: 10 });
  });
});

describe("civil kit · beat routing", () => {
  it("reads anchor indices and params", () => {
    expect(anchorIndex("tumbler_2", "tumbler_")).toBe(2);
    expect(anchorIndex("tumbler_x", "tumbler_")).toBeNull();
    expect(anchorIndex("bolt_2", "tumbler_")).toBeNull();
    const b: FailBeat = { atMs: 0, anchor: "a", action: "tip", params: { deg: 12, mode: "shorten" } };
    expect(numParam(b, "deg", 0)).toBe(12);
    expect(numParam(b, "nope", 3)).toBe(3);
    expect(strParam(b, "mode")).toBe("shorten");
    expect(strParam(b, "deg")).toBeNull();
    expect(findBeat([b], "tip")).toBe(b);
    expect(findBeat([b], "tip", "zz")).toBeNull();
  });

  // step_bridge plans from the real meta (civil e2 flat_road, e9 arch)
  const VIEW = { planks: ["s0", "s1", "s2", "s3", "d0"].map((key) => ({ key, text: `plank ${key}` })), slots: 4 };
  const base = (bays: "flat_road" | "arch") =>
    StepBridgeConfig.parse({ bays, items: ["s0", "s1", "s2", "s3", "d0"].map((key) => ({ key, meta: {} })), probe: null });
  const inputFor = (config: StepBridgeConfig, slots: (string | null)[]): PoseInput<StepBridgeConfig> => ({
    view: VIEW,
    draft: makeDraft("e", "sequencer.linear", { slots }, { complete: true, settled: true }),
    config,
    probe: null,
    t: 0,
    aidTier: 1,
    hintsUsed: 0,
    sim: null,
    solved: false,
    reducedMotion: false,
  });
  it("routes an order failure: the prefix locks, the first wrong bay tips and sinks, later bays dim", () => {
    const cfg = base("flat_road");
    const plan = stepBridgeMeta.failurePlan(diag({ failKey: "order", wrongKeys: ["s2"], prefix: 1 }), inputFor(cfg, ["s0", "s2", "s1", "s3"]));
    const r = routeDeckFail(plan.beats);
    expect(r.locks.map((l) => l.bay)).toEqual([0]);
    expect(r.tip).toMatchObject({ bay: 1, deg: 12 });
    expect(r.sink?.bay).toBe(1);
    expect(r.dims.map((d) => d.bay)).toEqual([2, 3]);
    expect(r.scatter).toBeNull();
  });
  it("routes a decoy: flat_road dissolves it, the arch shortens it (a sink with a mode)", () => {
    const road = routeDeckFail(stepBridgeMeta.failurePlan(diag({ failKey: "decoy", wrongKeys: ["d0"] }), inputFor(base("flat_road"), ["d0", "s1", "s2", "s3"])).beats);
    expect(road.scatter).toMatchObject({ bay: 0, mode: "dissolve" });
    expect(road.tip).toBeNull();
    const arch = routeDeckFail(stepBridgeMeta.failurePlan(diag({ failKey: "decoy", wrongKeys: ["d0"] }), inputFor(base("arch"), ["s0", "d0", "s2", "s3"])).beats);
    expect(arch.scatter).toMatchObject({ bay: 1, mode: "shorten" });
    expect(arch.sink).toBeNull();
  });
  it("routes a success: bays lock left to right; the DAY counter, route sign and arch sweep are found", () => {
    const road = StepBridgeConfig.parse({ ...base("flat_road"), dayCounter: { epoch: "1955-12", max: 381 } });
    const r = routeDeckSuccess(stepBridgeMeta.successPlan({ ...inputFor(road, ["s0", "s1", "s2", "s3"]), solved: true }, "bridge_forms").beats as readonly SuccessBeat[]);
    expect(r.locks.map((l) => l.bay)).toEqual([0, 1, 2, 3]);
    expect(r.locks.map((l) => l.atMs)).toEqual([0, 120, 240, 360]);
    expect(r.day).toMatchObject({ to: 381 });
    expect(r.sign).not.toBeNull();
    expect(r.payoff).not.toBeNull();
    const arch = routeDeckSuccess(stepBridgeMeta.successPlan({ ...inputFor(base("arch"), ["s0", "s1", "s2", "s3"]), solved: true }, "bridge_forms").beats as readonly SuccessBeat[]);
    expect(arch.arch).not.toBeNull();
    expect(arch.day).toBeNull();
  });

  // router_lanes plans from the real meta (civil e8 shutters)
  const RV = { items: ["i0", "i1", "i2"].map((key) => ({ key, text: `slip ${key}` })), bins: [{ id: "cra_1964", label: "1964" }, { id: "vra_1965", label: "1965" }] };
  const RC = RouterLanesConfig.parse({
    items: ["i0", "i1", "i2"].map((key) => ({ key })),
    lanes: [
      { binId: "cra_1964", laneId: "drawer_0", year: 1964.5 },
      { binId: "vra_1965", laneId: "drawer_1", year: 1965.5 },
    ],
    shutters: true,
  });
  const rin = (assignments: { itemKey: string; binId: string }[]): PoseInput<RouterLanesConfig> => ({
    view: RV,
    draft: makeDraft("e8", "sorter.bins", { assignments }, { complete: true, settled: true }),
    config: RC,
    probe: null,
    t: 0,
    aidTier: 0,
    hintsUsed: 0,
    sim: null,
    solved: false,
    reducedMotion: false,
  });
  it("routes a drawer miss: only wrongKeys[0] bounces and only the DISCLOSED shutter opens", () => {
    const a = [
      { itemKey: "i0", binId: "cra_1964" },
      { itemKey: "i1", binId: "cra_1964" },
      { itemKey: "i2", binId: "cra_1964" },
    ];
    const r = routeDrawersFail(routerLanesMeta.failurePlan(diag({ failKey: "wrong_bin", wrongKeys: ["i2"], disclosed: { bin: "vra_1965" } }), rin(a)).beats);
    expect(r.bounce?.key).toBe("i2");
    expect(r.shutter?.lane).toBe(1);
    const inc = routeDrawersFail(routerLanesMeta.failurePlan(diag({ failKey: "incomplete" }), rin([])).beats);
    expect(inc).toMatchObject({ bounce: null, shutter: null, console: 0 });
  });
  it("routes a drawer success: every item files, drawers slam, shutters open, then the payoff", () => {
    const a = [
      { itemKey: "i0", binId: "cra_1964" },
      { itemKey: "i1", binId: "vra_1965" },
      { itemKey: "i2", binId: "vra_1965" },
    ];
    const r = routeDrawersSuccess(routerLanesMeta.successPlan({ ...rin(a), solved: true }, "stairwell_opens").beats);
    expect(r.files.map((f) => f.key).sort()).toEqual(["i0", "i1", "i2"]);
    expect(r.slams.map((s) => s.lane)).toEqual([0, 1]);
    expect(r.shutters.map((s) => s.lane)).toEqual([0, 1]);
    expect(r.payoff).not.toBeNull();
    expect(r.payoff!).toBeGreaterThanOrEqual(Math.max(...r.files.map((f) => f.atMs)));
  });
});

describe("civil kit · localGround", () => {
  const props = { station: { anchor: { x: 1000, y: 900 } }, groundY: 900 };
  it("reads the authored zone ground (container-local), memoised: a later merge never moves a part", () => {
    const scene = { zone: { ground: { points: [[0, 900], [1000, 900], [1500, 700]] as [number, number][] } } };
    const g = localGround(scene, props);
    expect(g(0)).toBe(0);
    expect(g(250)).toBeCloseTo(-100);
    scene.zone.ground.points = [[0, 1200], [3000, 1200]];
    expect(g(250)).toBeCloseTo(-100); // memoised
  });
  it("prefers props.heightAt, then the scene's groundAt for other surfaces, then the console's ground", () => {
    expect(localGround(null, { ...props, heightAt: () => 800 } as typeof props)(10)).toBe(-100);
    const scene = { groundAt: (_x: number, s?: string) => (s === "gallery" ? 520 : 900) };
    expect(localGround(scene, props)(0, "gallery")).toBe(-380);
    expect(localGround(null, props)(123)).toBe(0);
    expect(localGround({ groundAt: () => { throw new Error("x"); } }, props)(0, "gallery")).toBe(0);
  });
});
