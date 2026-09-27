/**
 * step_bridge meta — the §7.4 row (docs/design/20): socket and bay positions; the stage table for 6 orders (pinch
 * before fold → empty micro-vesicle; decoy → bounce); only the solution order reaches travel = 1; the e9 gate (world
 * bayLamps all off at aid tier 0 for every draft and cursor); FILE-card lamps at printed dates; the day-counter
 * formula; relief crossings where 2 sin x = 1; the failure plan locks the prefix, tips the slot of wrongKeys[0],
 * crumbles a decoy; plus the no-leak test over stepEffects (success-only).
 */
import { describe, expect, it } from "vitest";
import cellFixture from "../../../fixtures/cell-transport-dungeon.json";
import civilFixture from "../../../fixtures/civil-rights-mystery.json";
import trigFixture from "../../../fixtures/trig-dungeon.json";
import docConfigs from "../../../tests/world-doc-configs.json";
import { GameSpec } from "../../contracts/gamespec";
import { configCtxFor } from "../library";
import type { AidTier, ConfigCtx, Diagnosis, Draft, HintRung, HintsUsed, PoseInput, StaticInput } from "../types";
import { fracYearOf } from "./config-parts";
import {
  applyStage,
  bayPos,
  dayCounterOf,
  formatPrintedDate,
  orderCarries,
  reliefCrossings,
  stageMapOf,
  stageRun,
  STEP_BRIDGE_SKINS,
  StepBridgeConfig,
  stepBridgeMeta as meta,
} from "./step-bridge.meta";
import { FOLD_START, foldStage } from "../sims";

// ---------------------------------------------------------------- fixtures

const SPECS: Record<string, { spec: GameSpec; biome: string }> = {
  "10-game-trig.md": { spec: GameSpec.parse(trigFixture), biome: "orrery_terraces" },
  "11-game-cell-transport.md": { spec: GameSpec.parse(cellFixture), biome: "living_gate" },
  "12-game-civil-rights.md": { spec: GameSpec.parse(civilFixture), biome: "archive_of_voices" },
};
type DocConfig = { archetype: string; doc: string; encounterId: string | null; config: unknown };
const DOC = (docConfigs as { configs: DocConfig[] }).configs.filter((c) => c.archetype === "step_bridge");
interface Station {
  id: string;
  ctx: ConfigCtx;
  config: StepBridgeConfig;
}
const STATIONS: Station[] = DOC.map((c) => {
  const { spec, biome } = SPECS[c.doc];
  const index = spec.encounters.findIndex((e) => e.id === c.encounterId);
  return { id: c.encounterId!, ctx: configCtxFor(spec, index, biome), config: StepBridgeConfig.parse(c.config) };
});
const station = (id: string) => STATIONS.find((s) => s.id === id)!;

function draftOf(ctx: ConfigCtx, slots: (string | null)[], probe: number | null = null, focus: string | null = null): Draft {
  return { encounterId: ctx.encounter.id, modeKey: ctx.modeKey, input: { slots }, complete: slots.every((s) => s !== null), focus, hover: null, probe, settled: true, wave: null, marks: null, seq: 1 };
}
function poseInput(st: Station, over: Partial<PoseInput<StepBridgeConfig, null>> = {}): PoseInput<StepBridgeConfig, null> {
  return { view: st.ctx.view, draft: null, config: st.config, probe: null, t: 0, aidTier: 0, hintsUsed: 0, sim: null, solved: false, reducedMotion: false, ...over };
}
function staticInput(st: Station, over: Partial<StaticInput<StepBridgeConfig>> = {}): StaticInput<StepBridgeConfig> {
  return { view: st.ctx.view, config: st.config, aidTier: 0, hintsUsed: 0, reducedMotion: false, skinId: "floating_steps", record: false, ...over };
}
function diag(failKey: Diagnosis["failKey"], wrongKeys: string[], prefix: number | null): Diagnosis {
  return { correct: false, feedback: "…", displayFeedback: "…", failKey, wrongKeys, prefix, disclosed: {}, nearMiss: null, probeKeys: [] };
}
const plankKeys = (ctx: ConfigCtx) => (ctx.view as { planks: { key: string }[] }).planks.map((p) => p.key);
function* kPerms(keys: readonly string[], k: number, cur: string[] = []): Generator<string[]> {
  if (cur.length === k) {
    yield [...cur];
    return;
  }
  for (const key of keys) if (!cur.includes(key)) yield* kPerms(keys, k, [...cur, key]);
}
const SOLUTION = ["s0", "s1", "s2", "s3"];

// ---------------------------------------------------------------- tests

describe("step_bridge: the doc configs", () => {
  it("covers trig e4, cell e10, civil e2 and e9, each valid with zero issues (incl. the stage-rail physics check)", () => {
    expect(STATIONS.map((s) => s.id).sort()).toEqual(["e10_bulk", "e2_montgomery", "e4_solve", "e9_selma"]);
    for (const s of STATIONS) expect(meta.validateConfig(s.config, s.ctx), s.id).toEqual([]);
  });

  it("defaults validate on every linear encounter of the three fixtures", () => {
    for (const s of STATIONS) {
      const d = meta.defaultConfig(s.ctx);
      expect(meta.validateConfig(d, s.ctx).filter((i) => i.severity === "error"), s.id).toEqual([]);
    }
    expect(meta.defaultConfig(station("e9_selma").ctx)).toMatchObject({ bays: "flat_road", probeWorld: "record_lens" });
  });
});

describe("geometry", () => {
  it("places trig e4's four sockets at x 4290, 4510, 4730, 4950 on a gentle arc (anchor 4650, 1400)", () => {
    expect([0, 1, 2, 3].map((j) => bayPos("floating", 4, j))).toEqual([
      { x: -360, y: 0 },
      { x: -140, y: -8 },
      { x: 80, y: -8 },
      { x: 300, y: 0 },
    ]);
    expect([0, 1, 2, 3].map((j) => bayPos("flat_road", 4, j).x)).toEqual([-375, -125, 125, 375]);
    expect([0, 1, 2, 3].map((j) => bayPos("arch", 4, j).x)).toEqual([-300, -100, 100, 300]);
  });

  it("a placed plank moves from its cradle to its bay; every placed bay fills the same (no decoy tell)", () => {
    const st = station("e4_solve");
    const keys = plankKeys(st.ctx); // display order
    const pose = meta.pose(poseInput(st, { draft: draftOf(st.ctx, ["d0", null, "s1", null]) }));
    expect(pose.placed).toEqual(["d0", null, "s1", null]);
    expect(pose.bayFill).toEqual([1, 0, 1, 0]);
    expect(pose.plankBay).toEqual(keys.map((k) => (k === "d0" ? 0 : k === "s1" ? 2 : null)));
    expect(pose.complete).toBe(false);
    const full = meta.pose(poseInput(st, { draft: draftOf(st.ctx, ["s0", "s1", "s2", "d0"]) }));
    expect(full).toMatchObject({ complete: true, guide: 1, bayFill: [1, 1, 1, 1] });
    const right = meta.pose(poseInput(st, { draft: draftOf(st.ctx, SOLUTION) }));
    const worldOnly = (p: typeof full) => ({ ...p, placed: null, plankBay: null });
    expect(worldOnly(full)).toEqual(worldOnly(right)); // the decoy and the true step look the same in the world
  });
});

describe("the stage table (cell e10, membrane-fold physics)", () => {
  const st = station("e10_bulk");
  const stages = stageMapOf(st.config);
  const outcomes = (order: string[]) => stageRun(order, stages).steps.map((s) => s.outcome);

  it("plays 6 orders through the physics", () => {
    expect(outcomes(["s0", "s1", "s2", "s3"])).toEqual(["ok", "ok", "ok", "ok"]);
    expect(outcomes(["s0", "s2", "s1", "s3"])).toEqual(["ok", "empty_vesicle", "ok", "empty_rail"]); // pinch before fold
    expect(outcomes(["s1", "s0", "s2", "s3"])).toEqual(["dimple", "ok", "empty_vesicle", "empty_rail"]); // fold before touch
    expect(outcomes(["s0", "s1", "s3", "s2"])).toEqual(["ok", "ok", "empty_rail", "ok"]); // carry before pinch
    expect(outcomes(["s0", "d0", "s1", "s2"])).toEqual(["ok", "bounce", "ok", "ok"]); // the decoy bounces
    expect(outcomes(["d0", "s0", "s1", "s3"])).toEqual(["bounce", "ok", "ok", "empty_rail"]);
    // empty slots are skipped: the state carries over
    const run = stageRun(["s0", null, "s1", null], stages);
    expect(run.states[2]).toEqual(run.states[1]);
    expect(run.states).toHaveLength(5);
  });

  it("only the solution order reaches detached && travel = 1 (all 120 orders of 4 from 5)", () => {
    const carried = [...kPerms(plankKeys(st.ctx), 4)].filter((o) => orderCarries(o, stages));
    expect(carried).toEqual([SOLUTION]);
    const end = stageRun(SOLUTION, stages).states[4];
    expect(end.detached).toBe(true);
    expect(end.travel).toBe(1);
  });

  it("validateConfig proves it: a config whose physics lets another order through is an error", () => {
    const bad = structuredClone(st.config);
    bad.stages = bad.stages.map((s) => (s.key === "s1" ? { ...s, stageId: "pinch" } : s.key === "s2" ? { ...s, stageId: "fold" } : s));
    expect(meta.validateConfig(bad, st.ctx).map((i) => i.message).join("\n")).toMatch(/membraneFold\(solution\.order\) must end detached|also carries the vesicle/);
    const decoy = structuredClone(st.config);
    decoy.stages = decoy.stages.map((s) => (s.key === "d0" ? { ...s, stageId: "touch" } : s));
    expect(meta.validateConfig(decoy, st.ctx).map((i) => i.message).join("\n")).toMatch(/decoy "d0" must use the dissolve_bounce stage/);
  });

  it("the playback pose blends S⌊k⌋ → S⌈k⌉ and shows the trap of the player's own order", () => {
    const at = (order: (string | null)[], k: number) => meta.pose(poseInput(st, { draft: draftOf(st.ctx, order, k), probe: k })).stage!;
    expect(at(SOLUTION, 0)).toMatchObject({ k: 0, depth: 0, detached: false, travel: 0, slot: null, outcome: null });
    expect(at(SOLUTION, 4)).toMatchObject({ detached: true, travel: 1, outcome: "ok", atpSpent: 2 });
    const mid = at(SOLUTION, 1.5);
    const s1 = stageRun(SOLUTION, stages).states;
    expect(mid.depth).toBeCloseTo((s1[1].depth + s1[2].depth) / 2, 9); // ease-in-out midpoint
    expect(at(["s0", "s2", "s1", "s3"], 2)).toMatchObject({ outcome: "empty_vesicle", detached: false });
    expect(at(["s0", "d0", "s1", "s2"], 2)).toMatchObject({ outcome: "bounce", bounced: true });
    // stage lamps carry each filled slot's icon; requirement glyphs only at aid tier ≥ 1
    const p0 = meta.pose(poseInput(st, { draft: draftOf(st.ctx, ["s0", null, "s2", null]) }));
    expect(p0.stageLamps).toEqual(["plank_touch", null, "plank_pinch", null]);
    expect(p0.stageReqs).toEqual([null, null, null, null]);
    expect(meta.pose(poseInput(st, { aidTier: 1, draft: draftOf(st.ctx, ["s0", null, "s2", null]) })).stageReqs).toEqual([null, null, "fold", null]);
  });

  it("plays through KB1's membrane-fold sim", () => {
    expect(applyStage(FOLD_START, "touch")).toEqual(foldStage(FOLD_START, "touch"));
    expect(applyStage(applyStage(FOLD_START, "touch"), "fold").wrap).toBeGreaterThanOrEqual(0.75);
    expect(applyStage(FOLD_START, "pinch").detached).toBe(false);
  });

  it("the panel shows the stage rail, the pit schematic and the ATP cells (ω only at tier 2)", () => {
    const stat = meta.panelStatic(staticInput(st, { skinId: "endocytosis_lift" }));
    expect(stat.cards.map((c) => c.kind)).toEqual(["slot_rail", "schematic", "energy_cells"]);
    const live = meta.panelLive(stat, poseInput(st, { draft: draftOf(st.ctx, SOLUTION, 2.5), probe: 2.5 }));
    expect(live.liveCards[2]).toMatchObject({ kind: "energy_cells", total: 2, spent: 2, projected: 2 });
    expect(live.readout).toBe("stage 2.5");
    const pit = (aidTier: AidTier) => meta.panelStatic(staticInput(st, { aidTier })).cards[1];
    const hasOmega = (aidTier: AidTier) => {
      const c = pit(aidTier);
      return c.kind === "schematic" && c.prims.some((p) => p.p === "text" && p.text.startsWith("ω"));
    };
    expect(hasOmega(1)).toBe(false);
    expect(hasOmega(2)).toBe(true);
  });
});

describe("the e9 bay-lamp gate (amendment 26)", () => {
  const st = station("e9_selma");
  const w = st.config.probe!.window!;
  const cursors = Array.from({ length: 31 }, (_, i) => w.start + ((w.end - w.start) * i) / 30);
  const keys = plankKeys(st.ctx);
  const drafts: (string | null)[][] = [
    ...kPerms(keys, 4),
    [null, null, null, null],
    ["s1", null, null, null],
    [null, "d0", "s3", null],
    ["s0", "s1", null, "s2"],
  ];

  it("world bayLamps are all off at aid tier 0 for every draft and every cursor", () => {
    let checked = 0;
    for (const slots of drafts)
      for (const probe of cursors) {
        const input = poseInput(st, { draft: draftOf(st.ctx, slots, probe), probe, aidTier: 0 });
        const pose = meta.pose(input);
        expect(pose.bayLamps.every((l) => l === 0)).toBe(true);
        expect(meta.describe(pose, input).srText).not.toMatch(/lamps are lit/);
        checked++;
      }
    expect(checked).toBe(drafts.length * cursors.length);
  });

  it("at tier 0 the FILE card shows WHICH dates are on the deck, never WHERE; at tier 1 it joins each to its bay", () => {
    const at = (aidTier: AidTier, slots: (string | null)[]) => {
      const stat = meta.panelStatic(staticInput(st, { aidTier, record: true, skinId: "timeline_bridge" }));
      expect(stat.cards[0]).toMatchObject({ kind: "timeline", title: "FILE" });
      return meta.panelLive(stat, poseInput(st, { aidTier, draft: draftOf(st.ctx, slots, 1965), probe: 1965 })).liveCards[0];
    };
    const a = at(0, ["s1", "s0", "s3", "s2"]);
    const b = at(0, ["s0", "s1", "s2", "s3"]);
    expect(a).toEqual(b); // tier 0: any order of the same planks gives the same FILE card
    expect(a.kind === "timeline" && a.lanes).toEqual([]);
    expect(a.kind === "timeline" && a.pins.every((p) => p.lane === null)).toBe(true);
    const t1 = at(1, ["s1", "s0", "s3", "s2"]);
    expect(t1.kind === "timeline" && t1.lanes.map((l) => l.label)).toEqual(["BAY 1", "BAY 2", "BAY 3", "BAY 4"]);
    expect(t1.kind === "timeline" && t1.pins.find((p) => p.key === "item:s1")).toMatchObject({ lane: "bay_0", label: "MAR 7 1965", at: fracYearOf("1965-03-07"), style: "draft" });
  });

  it("FILE-card lamps sit at the printed dates; at tier ≥ 1 the world lamps light as the cursor passes each date", () => {
    expect(formatPrintedDate("1965-03-07")).toBe("MAR 7 1965");
    expect(formatPrintedDate("1956-12")).toBe("DEC 1956");
    const order = ["s0", "s1", "s2", "s3"];
    const lamps = (probe: number, slots = order) => meta.pose(poseInput(st, { aidTier: 1, draft: draftOf(st.ctx, slots, probe), probe })).bayLamps;
    expect(lamps(1964.4)).toEqual([0, 0, 0, 0]);
    expect(lamps(fracYearOf("1964-07-02")!)).toEqual([1, 0, 0, 0]);
    expect(lamps(fracYearOf("1965-03-25")!)).toEqual([1, 1, 1, 0]);
    expect(lamps(w.end)).toEqual([1, 1, 1, 1]);
    // a wrong order lights jumbled; the decoy (DEC 1956) lights at once at the window's left edge
    expect(lamps(fracYearOf("1965-03-07")!, ["s2", "s1", "s0", "d0"])).toEqual([0, 1, 1, 1]);
    // the world chip on each deck section shows the date PRINTED in its plank
    const pose = meta.pose(poseInput(st, { draft: draftOf(st.ctx, ["s1", null, null, null]) }));
    expect(meta.describe(pose, poseInput(st)).chips).toContainEqual({ anchor: "bay_0", text: "MAR 7 1965", color: "f" });
  });
});

describe("civil e2: the DAY counter", () => {
  const st = station("e2_montgomery");
  it("DAY = clamp(round((year − 1955.9167) · 365.25), 0, 381)", () => {
    const epoch = st.config.dayCounter!.epoch;
    expect(fracYearOf(epoch)).toBeCloseTo(1955 + 11 / 12, 12);
    expect(dayCounterOf(1955 + 11 / 12, epoch, 381)).toBe(0);
    expect(dayCounterOf(1955.5, epoch, 381)).toBe(0);
    expect(dayCounterOf(1956.5, epoch, 381)).toBe(Math.round((1956.5 - (1955 + 11 / 12)) * 365.25));
    expect(dayCounterOf(1957.0833, epoch, 381)).toBe(381);
    const pose = meta.pose(poseInput(st, { probe: 1956.5 }));
    expect(pose.day).toBe(213);
    expect(meta.describe(pose, poseInput(st, { probe: 1956.5 })).chips).toContainEqual({ anchor: "day_counter", text: "DAY 213", color: "accent" });
    expect(meta.panelLive(meta.panelStatic(staticInput(st)), poseInput(st, { probe: 1956.5 })).readout).toBe("JUL 1956 · DAY 213"); // 1956.5 = July (month m = year + (m − 1)/12)
  });
  it("route lamps count placed slabs (neutral completion)", () => {
    expect(meta.pose(poseInput(st, { draft: draftOf(st.ctx, ["d0", "s1", null, null]) })).routeLamps).toBe(2);
  });
});

describe("trig e4: the lip relief", () => {
  const st = station("e4_solve");
  it("finds the crossings of 2 sin x = 1 numerically at π/6 and 5π/6 (within 1e−6)", () => {
    const xs = reliefCrossings("2*sin(x)", "1");
    expect(xs).toHaveLength(2);
    expect(xs[0]).toBeCloseTo(Math.PI / 6, 6);
    expect(xs[1]).toBeCloseTo((5 * Math.PI) / 6, 6);
  });
  it("the plumb marker rides the relief and glints within half a probe step of a crossing", () => {
    const at = (x: number) => meta.pose(poseInput(st, { probe: x }));
    expect(at(Math.PI / 2).marker).toMatchObject({ value: 2, y: -80 });
    expect(at(Math.PI / 2).marker!.x).toBeCloseTo(-120, 9); // u = x · 480/2π, relative to the band centre (x = π)
    expect(at(Math.PI).marker!.x).toBeCloseTo(0, 9);
    expect(at(Math.PI / 6).glint).toBe(0);
    expect(at((5 * Math.PI) / 6 + 0.02).glint).toBe(1);
    expect(at(Math.PI).glint).toBeNull();
    const chips = meta.describe(at(Math.PI / 6), poseInput(st, { probe: Math.PI / 6 })).chips;
    expect(chips).toContainEqual({ anchor: "lip_relief", text: "2 sin(x): 1.00", color: "f" });
  });
  it("cards: SPAN rail with 2 anchors, the unit circle (level 1/2 at tier 2), the relief graph (shade above the line at tier 1)", () => {
    const cards = (aidTier: AidTier) => meta.panelStatic(staticInput(st, { aidTier })).cards;
    expect(cards(0).map((c) => c.kind)).toEqual(["slot_rail", "unit_circle", "graph"]);
    expect(cards(0)[0]).toMatchObject({ anchorsRight: 2, slots: [{ key: null }, { key: null }, { key: null }, { key: null }] });
    expect(cards(1)[1]).toMatchObject({ level: null });
    expect(cards(2)[1]).toMatchObject({ level: 0.5 });
    const shade = (t: AidTier) => {
      const g = cards(t)[2];
      return g.kind === "graph" ? g.annotations.filter((a) => a.kind === "shade") : [];
    };
    expect(shade(0)).toEqual([]);
    expect(shade(1)).toHaveLength(1);
    expect(shade(1)[0]).toMatchObject({ y0: 1 });
  });
});

describe("the no-leak test (stepEffects are success-only)", () => {
  const EFFECTS = ["scaleEquation", "markAngle", "shadeQuadrants", "markSolutions", "missCircle"] as const;
  it("pose, describe and panelLive are unchanged when stepEffects are permuted or removed", () => {
    for (const s of STATIONS) {
      const keys = plankKeys(s.ctx);
      const variants: StepBridgeConfig["stepEffects"][] = [
        [],
        keys.map((key, i) => ({ key, effect: EFFECTS[i % EFFECTS.length] })),
        keys.map((key, i) => ({ key, effect: EFFECTS[(i + 2) % EFFECTS.length] })),
      ];
      const drafts: (string | null)[][] = [[null, null, null, null], SOLUTION, ["s1", "d0", "s0", "s3"], [null, "s2", "d0", null]];
      const probe = s.config.probe ? (s.config.probe.min + s.config.probe.max) / 2 : null;
      for (const slots of drafts)
        for (const aidTier of [0, 1, 2] as AidTier[]) {
          const observe = (config: StepBridgeConfig) => {
            const input = poseInput({ ...s, config }, { draft: draftOf(s.ctx, slots, probe), probe, aidTier, hintsUsed: aidTier as HintsUsed });
            const pose = meta.pose(input);
            const stat = meta.panelStatic({ ...input, skinId: "floating_steps", record: s.id === "e9_selma" });
            return JSON.stringify({ pose, d: meta.describe(pose, input), stat, live: meta.panelLive(stat, input) });
          };
          const base = observe(s.config);
          for (const stepEffects of variants) expect(observe({ ...s.config, stepEffects }), s.id).toBe(base);
        }
    }
  });
});

describe("plans, hints, lerp", () => {
  it("the failure plan locks the prefix, tips the slot of wrongKeys[0] and dims the rest (order)", () => {
    const st = station("e4_solve");
    const slots = ["s0", "s1", "s3", "s2"];
    const plan = meta.failurePlan(diag("order", ["s3"], 2), poseInput(st, { draft: draftOf(st.ctx, slots) }));
    expect(plan.beats.filter((b) => b.action === "hold_bright").map((b) => b.anchor)).toEqual(["socket_0", "socket_1"]);
    expect(plan.beats.find((b) => b.action === "tip")).toMatchObject({ anchor: "socket_2", params: { deg: 20, slot: 2 } });
    expect(plan.beats.filter((b) => b.action === "dim" && b.anchor.startsWith("socket")).map((b) => b.anchor)).toEqual(["socket_3"]);
    expect(plan.beats.find((b) => b.anchor === "pylon_a")).toMatchObject({ action: "flash" }); // x₁ glows faintly …
    expect(plan.beats.find((b) => b.anchor === "pylon_b")).toMatchObject({ action: "dim", params: { slack: 1 } }); // … x₂ stays slack
    expect(plan.durationMs).toBeLessThanOrEqual(1600);
    const civil = meta.failurePlan(diag("order", ["s2"], 1), poseInput(station("e2_montgomery"), { draft: draftOf(station("e2_montgomery").ctx, ["s0", "s2", "s1", "s3"]) }));
    expect(civil.beats.find((b) => b.action === "tip")).toMatchObject({ anchor: "bay_1", params: { deg: 12 } });
  });

  it("the failure plan crumbles a decoy where it sits (and only then plays its missCircle)", () => {
    const st = station("e4_solve");
    const plan = meta.failurePlan(diag("decoy", ["d0"], null), poseInput(st, { draft: draftOf(st.ctx, ["s0", "d0", "s1", "s2"]) }));
    expect(plan.beats).toEqual([{ atMs: 200, anchor: "socket_1", action: "scatter", params: { slot: 1, mode: "crumble", cardEffect: "missCircle", cardSlot: 1 } }]);
    const e10 = station("e10_bulk");
    const bio = meta.failurePlan(diag("decoy", ["d0"], null), poseInput(e10, { draft: draftOf(e10.ctx, ["s0", "d0", "s1", "s2"]) }));
    expect(bio.beats.map((b) => b.action)).toEqual(["stall", "bounce"]);
    const e9 = station("e9_selma");
    const civil = meta.failurePlan(diag("decoy", ["d0"], null), poseInput(e9, { draft: draftOf(e9.ctx, ["d0", "s1", "s2", "s3"]) }));
    expect(civil.beats[0]).toMatchObject({ anchor: "bay_0", action: "sink", params: { mode: "shorten" } });
  });

  it("the success plan replays stepEffects in slot order as card effects within 1.2–2.5 s", () => {
    for (const s of STATIONS) {
      const plan = meta.successPlan(poseInput(s, { draft: draftOf(s.ctx, SOLUTION), solved: true }), s.id === "e10_bulk" ? "vesicle_carries" : "bridge_forms");
      expect(plan.durationMs).toBeGreaterThanOrEqual(1200);
      expect(plan.durationMs).toBeLessThanOrEqual(2500);
      expect(plan.beats.every((b) => b.atMs <= plan.durationMs)).toBe(true);
    }
    const e4 = station("e4_solve");
    const plan = meta.successPlan(poseInput(e4, { draft: draftOf(e4.ctx, SOLUTION), solved: true }), "bridge_forms");
    expect(plan.cardEffects.map((c) => `${c.atMs}:${c.slot}:${c.effect}`)).toEqual(["0:2:scaleEquation", "500:1:markAngle", "500:2:markAngle", "1000:1:shadeQuadrants", "1500:2:markSolutions"]);
    expect(plan.beats.filter((b) => b.action === "lock").map((b) => b.anchor)).toEqual(["socket_0", "socket_1", "socket_2", "socket_3"]);
    expect(plan.beats.filter((b) => b.action === "ignite").map((b) => b.anchor)).toEqual(["pylon_a", "pylon_b"]);
    const solved = meta.solvedPose(poseInput(e4, { solved: true }));
    expect(solved).toMatchObject({ solved: true, gate: 1, bayFill: [1, 1, 1, 1] });
  });

  it("hint targets start from the skin's table (+ config-driven ones)", () => {
    for (const skin of STEP_BRIDGE_SKINS)
      for (const s of STATIONS)
        for (const rung of [1, 2, 3] as HintRung[]) {
          const got = meta.hintTargets(rung, staticInput(s, { skinId: skin.id }));
          expect(got.slice(0, skin.hintTargets[rung - 1].length)).toEqual(skin.hintTargets[rung - 1]);
        }
    expect(meta.hintTargets(1, staticInput(station("e9_selma"), { skinId: "timeline_bridge" }))).toEqual([{ anchor: "arch_rail", action: "ride", holdMs: 2400 }]);
  });

  it("lerp: exact at the ends, discrete fields snap at 0.5", () => {
    const st = station("e10_bulk");
    const a = meta.pose(poseInput(st, { draft: draftOf(st.ctx, SOLUTION, 1), probe: 1 }));
    const b = meta.pose(poseInput(st, { draft: draftOf(st.ctx, ["s0", "s2", "s1", "s3"], 3), probe: 3 }));
    expect(meta.lerp(a, b, 0)).toEqual(a);
    expect(meta.lerp(a, b, 1)).toEqual(b);
    expect(meta.lerp(a, b, 0.49).placed).toEqual(a.placed);
    expect(meta.lerp(a, b, 0.5).placed).toEqual(b.placed);
    expect(meta.lerp(a, b, 0.5).stage!.k).toBeCloseTo(2, 12);
    expect(meta.debug(a)).toMatchObject({ bays: "stage_rail", placed: "s0,s1,s2,s3", stageK: 1 });
  });
});

describe("KA3: floating_steps in the world (focus chip, DOM snapshot)", () => {
  it("floating bays label only the stone you point at (in its socket or its cradle bay)", () => {
    const e4 = station("e4_solve");
    const at = (draft: PoseInput<StepBridgeConfig, null>["draft"]) => meta.describe(meta.pose(poseInput(e4, { draft })), poseInput(e4, { draft })).chips.filter((c) => c.anchor !== "lip_relief");
    const view = e4.ctx.view as { slots: number };
    const slots = Array.from({ length: view.slots }, (_, j) => (j === 0 ? "s0" : null));
    const base = { encounterId: "e4_solve", modeKey: "sequencer.linear" as const, input: { slots }, complete: false, focus: null, hover: null, probe: null, settled: true, wave: null, marks: null, seq: 1 };
    expect(at(base)).toEqual([]);
    expect(at({ ...base, focus: "s0" })).toEqual([{ anchor: "socket_0", text: "isolate", color: "f" }]);
    const planks = (e4.ctx.view as { planks: { key: string }[] }).planks.map((p) => p.key);
    expect(at({ ...base, hover: "d0" })).toEqual([{ anchor: `cradle_${planks.indexOf("d0")}`, text: "inverse sine", color: "f" }]);
  });

  it("the DOM snapshot seats the four stones on success (dormant: in the cradle)", () => {
    const snap = STEP_BRIDGE_SKINS.find((s) => s.id === "floating_steps")!.snapshot;
    const stones = (parts: typeof snap.dormant) => parts.filter((p) => p.asset.endsWith("floating_steps_stone")).map((p) => p.dx);
    expect(stones(snap.dormant)).toEqual([-580, -580, -580, -580]);
    expect(stones(snap.solved)).toEqual([-360, -140, 80, 300]);
    expect(snap.solved.filter((p) => p.asset.endsWith("floating_steps_pylon"))).toHaveLength(2);
  });
});
