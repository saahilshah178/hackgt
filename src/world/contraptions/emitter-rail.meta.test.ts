/* eslint-disable @typescript-eslint/no-restricted-imports -- tests may read params and solutions (docs/design/20 §2.5.6):
   they grade with the mechanics registry, which the meta itself never imports. */
/**
 * emitter_rail meta — the §7.4 row (docs/design/20) and trig §5.1's pure tests: arc carriage at θ = 0, π/2, π equals
 * C + r(cos θ, −sin θ); straight/log rail mapping; bracket() for 20 values; detents snap within 0.05 rad to π/12
 * studs; the carriage chip never prints a decimal; PARITY beam-locked ⟺ grade().correct over 400 samples; chevron
 * count from the distance band; plus the panel, plans, snapshots and the ≥ 3 intermediate poses of a scrub (★30).
 */
import { describe, expect, it } from "vitest";
import trigFixture from "../../../fixtures/trig-dungeon.json";
import docConfigs from "../../../tests/world-doc-configs.json";
import { GameSpec } from "../../contracts/gamespec";
import { getMode } from "../../mechanics/registry";
import { smoothingFactor } from "../ease";
import { configCtxFor } from "../library";
import { probeMatches } from "../probes";
import type { Diagnosis, Draft, NumberLineView, PoseInput, StaticInput } from "../types";
import {
  bracket,
  detentSnap,
  distanceBand,
  EMITTER_RAIL_SKINS,
  EmitterRailConfig,
  emitterRailMeta as meta,
  FOG_RADIUS,
  isLocked,
  lineOf,
  parsePrettyValue,
  snapshotInput,
  vesperSnapshot,
  WALL_BEAM,
  type EmitterRailPose,
} from "./emitter-rail.meta";

const PI = Math.PI;
const spec = GameSpec.parse(trigFixture);
const E1 = spec.encounters.findIndex((e) => e.id === "e1_radians");
const enc = spec.encounters[E1];
const mode = getMode(enc.familyId, enc.mode)!;
const VIEW = mode.present(enc.params, spec.seed + E1) as NumberLineView;
const E1_DOC = docConfigs.configs.find((c) => c.encounterId === "e1_radians")!;
const CONFIG = EmitterRailConfig.parse(E1_DOC.config);

function draft(value: number, over: Partial<Draft> = {}): Draft {
  return { encounterId: "e1_radians", modeKey: "mapper.number_line", input: { value }, complete: true, focus: null, hover: null, probe: null, settled: false, wave: null, marks: null, seq: 1, ...over };
}
function input(value: number | null, over: Partial<PoseInput<EmitterRailConfig>> = {}): PoseInput<EmitterRailConfig> {
  return { view: VIEW, draft: value === null ? null : draft(value), config: CONFIG, probe: null, t: 0, aidTier: 0, hintsUsed: 0, sim: null, solved: false, reducedMotion: false, ...over };
}
function stat(over: Partial<StaticInput<EmitterRailConfig>> = {}): StaticInput<EmitterRailConfig> {
  return { view: VIEW, config: CONFIG, aidTier: 0, hintsUsed: 0, reducedMotion: false, skinId: "vesper_dial", record: false, ...over };
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

describe("emitter_rail · view and line maths", () => {
  it("reads the e1 view: a 2π π-labelled line whose printed target parses to 5π/6", () => {
    const line = lineOf(VIEW);
    expect(line.pi).toBe(true);
    expect(line.min).toBe(0);
    expect(line.max).toBeCloseTo(2 * PI, 12);
    expect(line.target).toBeCloseTo((5 * PI) / 6, 12);
    expect(parsePrettyValue("−π/2")).toBeCloseTo(-PI / 2, 12);
    expect(parsePrettyValue("3π/2")).toBeCloseTo((3 * PI) / 2, 12);
    expect(parsePrettyValue("10^3")).toBe(1000);
    expect(parsePrettyValue("3/8")).toBe(0.375);
    expect(parsePrettyValue("")).toBeNull();
  });

  it("the arc carriage at θ = 0, π/2, π equals C + r(cos θ, −sin θ)", () => {
    for (const th of [0, PI / 2, PI]) {
      const p = meta.pose(input(th));
      expect(p.rail).toBe("arc");
      expect(p.carriageX).toBeCloseTo(310 * Math.cos(th), 9);
      expect(p.carriageY).toBeCloseTo(-310 * Math.sin(th), 9);
      expect(p.carriageRot).toBeCloseTo(PI / 2 - th, 12);
      expect(p.bobY).toBeCloseTo(-310 * Math.sin(th), 9);
      expect(p.markerX).toBeCloseTo(310 * Math.cos(th), 9);
    }
    expect(meta.pose(input(PI / 2)).carriageY).toBeCloseTo(-310, 9); // straight up, over the top
  });

  it("the beam reaches the fog only on the upper arc; below it ends on the wall", () => {
    const up = meta.pose(input(PI / 3));
    expect(up.beamToFog).toBe(true);
    expect(up.beamLen).toBe(FOG_RADIUS - 310);
    const down = meta.pose(input((5 * PI) / 3)); // the "π is a full turn" misconception: low on the right
    expect(down.beamToFog).toBe(false);
    expect(down.beamLen).toBe(WALL_BEAM);
    expect(meta.pose(input(0.02)).beamToFog).toBe(false);
    // the fog bloom is the same at every in-fog angle: nothing live reveals the target
    expect(meta.pose(input(PI / 4)).beamLen).toBe(meta.pose(input((5 * PI) / 6)).beamLen);
  });

  it("straight and log rails map the line fraction across the rail and fire straight up", () => {
    const linear: NumberLineView = { scale: "linear", min: 0, max: 10, target: "7", landmarks: [0, 5, 10].map((v) => ({ value: v, fraction: v / 10, label: String(v) })) };
    const cfg = EmitterRailConfig.parse({ rail: "straight", radius: 300 });
    const at = (view: NumberLineView, v: number, c = cfg) => meta.pose({ ...input(v), view, config: c });
    expect(at(linear, 0).carriageX).toBeCloseTo(-300, 9);
    expect(at(linear, 5).carriageX).toBeCloseTo(0, 9);
    expect(at(linear, 10).carriageX).toBeCloseTo(300, 9);
    expect(at(linear, 2.5).u).toBeCloseTo(0.25, 12);
    expect(at(linear, 5).beamDirY).toBe(-1);
    const log: NumberLineView = { scale: "log", min: 1, max: 1e6, target: "10^3", landmarks: [0, 2, 4, 6].map((e) => ({ value: 10 ** e, fraction: e / 6, label: `10^${e}` })) };
    const logCfg = EmitterRailConfig.parse({ rail: "log", radius: 300 });
    expect(at(log, 1e3, logCfg).rail).toBe("log");
    expect(at(log, 1e3, logCfg).u).toBeCloseTo(0.5, 12);
    expect(at(log, 1e3, logCfg).carriageX).toBeCloseTo(0, 9);
    expect(at(log, 10, logCfg).u).toBeCloseTo(1 / 6, 12);
  });
});

describe("emitter_rail · bracket, chip, detents", () => {
  const marks = lineOf(VIEW).landmarks;
  it("bracket() for 20 values: landmark brackets, equality within 0.01, never a decimal", () => {
    const cases: [number, string][] = [
      [0, "θ = 0"],
      [0.005, "θ = 0"],
      [0.2, "0 < θ < π/2"],
      [PI / 4, "0 < θ < π/2"],
      [1.5, "0 < θ < π/2"],
      [PI / 2 - 0.009, "θ = π/2"],
      [PI / 2, "θ = π/2"],
      [PI / 2 + 0.02, "π/2 < θ < π"],
      [(5 * PI) / 6, "π/2 < θ < π"],
      [3, "π/2 < θ < π"],
      [PI, "θ = π"],
      [PI + 0.011, "π < θ < 3π/2"],
      [(7 * PI) / 6, "π < θ < 3π/2"],
      [4.5, "π < θ < 3π/2"],
      [(3 * PI) / 2, "θ = 3π/2"],
      [(5 * PI) / 3, "3π/2 < θ < 2π"],
      [6, "3π/2 < θ < 2π"],
      [2 * PI - 0.005, "θ = 2π"],
      [2 * PI, "θ = 2π"],
      [-0.5, "θ < 0"],
    ];
    expect(cases).toHaveLength(20);
    for (const [v, want] of cases) {
      expect(bracket(v, marks), String(v)).toBe(want);
      expect(bracket(v, marks)).not.toMatch(/\d\.\d/);
    }
    expect(bracket(7, marks)).toBe("θ > 2π");
    expect(bracket(1, [], "x")).toBe("x");
  });

  it("the carriage chip and the readout never print a decimal across the whole rail", () => {
    const rnd = seeded(7);
    for (let i = 0; i < 200; i++) {
      const v = rnd() * 2 * PI;
      const p = meta.pose(input(v));
      const d = meta.describe(p, input(v));
      const carriage = d.chips.find((c) => c.anchor === "beam_origin")!;
      expect(carriage.text).toMatch(/^θ(: | = )/);
      expect(carriage.text).not.toMatch(/\d\.\d/);
      expect(d.srText).not.toMatch(/\d\.\d/);
      const live = meta.panelLive(meta.panelStatic(stat()), input(v));
      expect(live.readout).not.toMatch(/\d\.\d/);
    }
    const d = meta.describe(meta.pose(input((5 * PI) / 6)), input((5 * PI) / 6));
    expect(d.chips.find((c) => c.anchor === "beam_origin")!.text).toBe("θ: π/2 < θ < π");
    expect(d.chips.find((c) => c.anchor === "bob")).toMatchObject({ text: "sin θ: 0.50", color: "g" });
    expect(d.chips.find((c) => c.anchor === "marker")).toMatchObject({ text: "cos θ: −0.87", color: "h" });
    expect(d.srText).toBe("The carriage is between π/2 and π on the rail; the beam ends in the fog.");
    expect(d.nearMiss).toBeNull();
    // landmark labels are DOM chips outside the rail: 0, π/2, π, 3π/2 (2π shares 0's spot)
    expect(d.chips.filter((c) => c.anchor.startsWith("lm_")).map((c) => c.text)).toEqual(["0", "π/2", "π", "3π/2"]);
  });

  it("detents snap a SETTLED knob within 0.05 rad onto a π/12 stud; every stud is equally sticky", () => {
    const step = PI / 12;
    for (let k = 0; k <= 24; k++) {
      const stud = k * step;
      for (const off of [-0.049, -0.02, 0, 0.03, 0.0499]) {
        const v = stud + off;
        if (v < 0 || v > 2 * PI) continue;
        const s = detentSnap(v, step, 0, 2 * PI);
        expect(s.value, `${k} ${off}`).toBeCloseTo(stud, 12);
        expect(s.stud).toBe(k);
      }
      for (const off of [-0.07, 0.051, 0.1]) {
        const v = stud + off;
        if (v < 0 || v > 2 * PI) continue;
        expect(detentSnap(v, step, 0, 2 * PI)).toEqual({ value: v, stud: null });
      }
    }
    // the pose applies the detent only once the knob settles; `raw` keeps what grade() will see
    const v = (5 * PI) / 6 + 0.04;
    expect(meta.pose(input(v)).value).toBe(v);
    const settled = meta.pose({ ...input(v), draft: draft(v, { settled: true }) });
    expect(settled.value).toBeCloseTo((5 * PI) / 6, 12);
    expect(settled.detented).toBe(true);
    expect(settled.raw).toBe(v);
    expect(settled.stud).toBe(10);
  });
});

describe("emitter_rail · parity with numberLine.grade", () => {
  it("beam-locked pose ⟺ grade().correct over 400 samples (and on the settled, detented pose)", () => {
    const rnd = seeded(20260927);
    let locked = 0;
    for (let i = 0; i < 400; i++) {
      // half the samples crowd the tolerance edge around 5π/6 (±0.0942 rad), half span the rail
      const v = i % 2 === 0 ? (5 * PI) / 6 + (rnd() - 0.5) * 0.4 : rnd() * 2 * PI;
      const correct = mode.grade(enc.params, { value: v }).correct;
      expect(meta.pose(input(v)).locked, String(v)).toBe(correct);
      expect(meta.pose({ ...input(v), draft: draft(v, { settled: true }) }).locked, `settled ${v}`).toBe(correct);
      expect(isLocked(lineOf(VIEW), v)).toBe(correct);
      if (correct) locked++;
    }
    expect(locked).toBeGreaterThan(40);
    expect(locked).toBeLessThan(360);
  });

  it("the station's fullturn probe (5π/3) matches only near 5π/3", () => {
    const probe = { predicate: "nearValue" as const, value: "5*pi/3", tolFactor: 1, key: "fullturn" };
    const ctx = (v: number) => ({ modeKey: "mapper.number_line", view: VIEW, solution: enc.solution, input: { value: v } });
    expect(probeMatches(probe, ctx((5 * PI) / 3))).toBe(true);
    expect(probeMatches(probe, ctx((5 * PI) / 3 + 0.09))).toBe(true);
    expect(probeMatches(probe, ctx((5 * PI) / 3 + 0.1))).toBe(false);
    expect(probeMatches(probe, ctx((5 * PI) / 6))).toBe(false);
  });
});

describe("emitter_rail · plans", () => {
  it("failure: the beam scatters and gold chevrons point the way; the count is the distance band from the view target", () => {
    const line = lineOf(VIEW);
    const step = PI / 12;
    expect(distanceBand(line, (5 * PI) / 6 - 0.2, step)).toBe(1); // within one stud
    expect(distanceBand(line, (5 * PI) / 6 + 0.26, step)).toBe(1);
    expect(distanceBand(line, (5 * PI) / 6 - 1.2, step)).toBe(2); // within one landmark gap (π/2)
    expect(distanceBand(line, (5 * PI) / 6 + 1.5, step)).toBe(2);
    expect(distanceBand(line, (5 * PI) / 3, step)).toBe(3); // the full-turn trap
    expect(distanceBand(line, 0.1, step)).toBe(3);
    const under = meta.failurePlan(diag("under"), input(PI / 2 + 0.3));
    expect(under.durationMs).toBeGreaterThanOrEqual(600);
    expect(under.durationMs).toBeLessThanOrEqual(1600);
    expect(under.cue).toBe("beam_scatter");
    expect(under.beats[0]).toMatchObject({ anchor: "beam_end", action: "scatter" });
    const chev = under.beats.find((b) => b.action === "chevrons")!;
    expect(chev.params).toMatchObject({ dir: 1, count: 2 });
    const over = meta.failurePlan(diag("over"), input((5 * PI) / 3));
    expect(over.beats.find((b) => b.action === "chevrons")!.params).toMatchObject({ dir: -1, count: 3 });
    const noChev = meta.failurePlan(diag("over"), { ...input(3), config: { ...CONFIG, chevrons: false } });
    expect(noChev.beats.some((b) => b.action === "chevrons")).toBe(false);
  });

  it("success (1.2–2.5 s): surge, fog dissolves, the lens ignites, the disc turns by the angle set, five ledges extend", () => {
    const plan = meta.successPlan({ ...input((5 * PI) / 6), solved: true }, "stairs_rise");
    expect(plan.durationMs).toBeGreaterThanOrEqual(1200);
    expect(plan.durationMs).toBeLessThanOrEqual(2500);
    expect(plan.cue).toBe("node_ignite");
    expect(plan.beats.map((b) => b.action)).toEqual(expect.arrayContaining(["ignite", "dissolve", "light_sequence", "spin", "rise"]));
    expect(plan.beats.find((b) => b.action === "spin")!.params).toMatchObject({ angle: (5 * PI) / 6 });
    expect(plan.beats.filter((b) => b.action === "rise").map((b) => b.anchor)).toEqual(["spoke_0", "spoke_1", "spoke_2", "spoke_3", "spoke_4"]);
    for (const b of plan.beats) expect(b.atMs).toBeLessThan(plan.durationMs);
    const solved = meta.solvedPose({ ...input(null), solved: true });
    expect(solved).toMatchObject({ solved: true, fog: 0, lens: 1, ledges: 1, locked: true });
    expect(solved.value).toBeCloseTo((5 * PI) / 6, 12); // re-entry without a draft: the carriage at the target
    expect(solved.discTurn).toBeCloseTo((5 * PI) / 6, 12);
  });
});

describe("emitter_rail · live motion (★30: ≥ 3 intermediate poses while scrubbing)", () => {
  it("the eased carriage rides the arc through distinct intermediate poses toward the target", () => {
    let eased: EmitterRailPose = meta.pose(input(0.3));
    const target = meta.pose(input(2.4));
    const k = smoothingFactor(1000 / 60);
    const seen: EmitterRailPose[] = [];
    for (let f = 0; f < 30; f++) {
      eased = meta.lerp(eased, target, k);
      seen.push(eased);
      expect(Math.hypot(eased.carriageX, eased.carriageY)).toBeCloseTo(310, 6); // on the rail, never the chord
    }
    const distinct = new Set(seen.map((p) => p.value.toFixed(3)));
    expect(distinct.size).toBeGreaterThanOrEqual(3);
    expect(seen[0].value).toBeGreaterThan(0.3);
    expect(seen.at(-1)!.value).toBeGreaterThan(2.3);
    expect(seen[1].lag).toBeGreaterThan(0);
    expect(meta.audio(seen[1], input(2.4))[0]).toMatchObject({ cue: "dial_carriage_roll" });
    expect(meta.lerp(eased, target, 1).value).toBe(target.value);
  });

  it("the dormant pose parks the carriage at θ = 0 with no beam; a draft lights it", () => {
    const idle = meta.pose(input(null));
    expect(idle).toMatchObject({ value: 0, lit: 0, fog: 0.85, lens: 0, solved: false });
    expect(meta.pose(input(1)).lit).toBe(1);
    expect(meta.describe(idle, input(null)).srText).toContain("dormant");
  });
});

describe("emitter_rail · panel", () => {
  it("static: unit circle, sin θ, cos θ (dark until tier 1); the Scrubber is θ over [0, 2π] in π steps", () => {
    const s = meta.panelStatic(stat());
    expect(s.cards.map((c) => c.kind)).toEqual(["unit_circle", "graph", "graph"]);
    expect(s.cards.map((c) => c.slot)).toEqual([0, 1, 2]);
    const cos = s.cards[2];
    expect(cos.kind === "graph" && cos.empty).toBe(true);
    const cos1 = meta.panelStatic(stat({ aidTier: 1 })).cards[2];
    expect(cos1.kind === "graph" && !cos1.empty && cos1.plots.length).toBe(1);
    expect(s.input).toMatchObject({ symbol: "θ", min: 0, unit: "pi", format: "pi" });
    expect(s.input!.max).toBeCloseTo(2 * PI, 12);
    expect(s.input!.step).toBeCloseTo(PI / 48, 12);
    expect(s.input!.ticks.filter((t) => t.major).map((t) => t.label)).toEqual(["0", "π/2", "π", "3π/2", "2π"]);
    expect(s.input!.ticks.filter((t) => !t.major)).toHaveLength(20); // the π/12 studs between the landmarks
    expect(s.probe).toBeNull();
    const uc = s.cards[0];
    expect(uc.kind === "unit_circle" && uc.landmarks.length).toBe(4);
    const uc2 = meta.panelStatic(stat({ aidTier: 2 })).cards[0];
    expect(uc2.kind === "unit_circle" && uc2.landmarks.length).toBe(12); // tier 2: every π/6 ticked, no numerals
    expect(uc2.kind === "unit_circle" && uc2.landmarks.filter((l) => l.label === "").length).toBe(8);
  });

  it("live: the orange line at θ, the bracket readout, sin/cos chips, the point and arc on the unit circle", () => {
    const s = meta.panelStatic(stat({ aidTier: 1 }));
    const live = meta.panelLive(s, input((5 * PI) / 6));
    expect(live.scrubX).toBeCloseTo((5 * PI) / 6, 12);
    expect(live.readout).toBe("π/2 < θ < π");
    expect(live.chips.map((c) => [c.slot, c.text, c.color])).toEqual([
      [0, "π/2 < θ < π", "accent"],
      [1, "0.50", "g"],
      [2, `${"−"}0.87`, "h"],
    ]);
    const uc = live.liveCards.find((c) => c.kind === "unit_circle")!;
    expect(uc.kind === "unit_circle" && uc.point!.angle).toBeCloseTo((5 * PI) / 6, 12);
    expect(uc.kind === "unit_circle" && uc.arc).toMatchObject({ from: 0, color: "accent" });
    expect(meta.panelLive(meta.panelStatic(stat()), input(PI)).readout).toBe("θ = π");
    expect(meta.panelLive(meta.panelStatic(stat()), input(null)).liveCards).toHaveLength(0);
  });

  it("the hint targets are the station table (circle the centre, ride the carriage, land on the pin)", () => {
    expect(meta.hintTargets(1, stat())).toEqual([{ anchor: "center", action: "circle", holdMs: 1500 }]);
    expect(meta.hintTargets(2, stat())).toEqual([{ anchor: "beam_origin", action: "ride", holdMs: 3000 }]);
    expect(meta.hintTargets(3, stat())).toEqual([{ anchor: "pin", action: "land", holdMs: 1500 }]);
  });
});

describe("emitter_rail · config, skin, snapshots", () => {
  it("the doc's e1 config validates against the fixture view; arc on a non-2π line is an error", () => {
    const ctx = configCtxFor(spec, E1, "orrery_terraces");
    expect(meta.validateConfig(CONFIG, ctx)).toEqual([]);
    const straightView = { ...ctx, view: { ...VIEW, max: 10, landmarks: [{ value: 0, fraction: 0, label: "0" }] } };
    expect(meta.validateConfig(CONFIG, straightView).map((i) => i.path[0])).toEqual(["rail"]);
    expect(meta.validateConfig({ ...CONFIG, rail: "straight" }, ctx).map((i) => i.path[0])).toEqual(["gauges"]);
    expect(meta.defaultConfig(ctx)).toMatchObject({ rail: "arc", cards: { unitCircle: true } });
    expect(meta.writerConfigSchema({ modeKey: "mapper.number_line", view: VIEW, itemKeys: [], domain: "math" })).toBeNull();
  });

  it("the skin keeps the §4.3 slots and anchors; the DOM snapshots are baked from the rest and solved poses", () => {
    const skin = EMITTER_RAIL_SKINS[0];
    expect(skin.id).toBe("vesper_dial");
    expect(skin.anchors).toEqual(["center", "spoke_0", "spoke_1", "spoke_2", "spoke_3", "spoke_4", "beam_origin", "bob", "marker", "pin", "console"]);
    expect(skin.parts.map((p) => p.slot)).toEqual(["disc", "rail_ring", "carriage", "beam_cap", "plumb_gauge", "slide_gauge", "fog_band", "vesper_lens", "spoke_ledge", "console"]);
    expect(skin.snapshot.dormant).toEqual(vesperSnapshot(meta.pose(snapshotInput(false))));
    expect(skin.snapshot.solved).toEqual(vesperSnapshot(meta.solvedPose(snapshotInput(true))));
    expect(skin.snapshot.dormant.some((p) => p.asset.endsWith("_fog_band"))).toBe(true);
    expect(skin.snapshot.solved.some((p) => p.asset.endsWith("_fog_band"))).toBe(false);
    expect(skin.snapshot.solved.some((p) => p.asset.endsWith("_vesper_lens"))).toBe(true);
    expect(skin.snapshot.solved.filter((p) => p.asset.endsWith("_spoke_ledge"))).toHaveLength(5);
    expect([...skin.snapshot.dormant, ...skin.snapshot.solved].some((p) => p.asset.endsWith("_console"))).toBe(false);
    expect(meta.frameBounds(CONFIG, VIEW).w).toBeGreaterThan(2 * 310);
    expect(meta.debug(meta.pose(input(1)))).toMatchObject({ rail: "arc", locked: false, solved: false });
  });
});
