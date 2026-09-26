import { describe, expect, it } from "vitest";
import cellFixture from "../../../fixtures/cell-transport-dungeon.json";
import civilFixture from "../../../fixtures/civil-rights-mystery.json";
import docConfigs from "../../../tests/world-doc-configs.json";
import type { AidTier, BinsView, Diagnosis, Draft, HintsUsed, PanelLive, PoseInput, StaticInput } from "../types";
import {
  assignmentsOf,
  bossBatchState,
  energyLaneIndex,
  eyeAngleFor,
  itemAnchor,
  laneAnchor,
  laneChipText,
  laneX,
  queueX,
  ROUTER_LANES_SKINS,
  ROUTER_LAYOUT,
  RouterLanesConfig,
  routerDraftComplete,
  routerLanesMeta as meta,
  withBossPhases,
  type RouterLanesPose,
} from "./router-lanes.meta";

// ---------------------------------------------------------------- fixtures → views (display order = a fixed shuffle)

type FixtureEncounter = { id: string; mode: string; params: { bins: { id: string; label: string }[]; items: { text: string; binId: string }[] } };
function encounter(spec: { encounters: unknown[] }, id: string): FixtureEncounter {
  const e = (spec.encounters as FixtureEncounter[]).find((x) => x.id === id);
  if (!e) throw new Error(id);
  return e;
}
/** The bins view: keys by ORIGINAL index, shown in a fixed non-identity order (the mode shuffles by seed). */
function viewOf(e: FixtureEncounter): BinsView {
  const items = e.params.items.map((it, i) => ({ key: `i${i}`, text: it.text }));
  return { bins: e.params.bins.map((b) => ({ id: b.id, label: b.label })), items: [...items.slice(1), items[0]!] };
}
function solutionOf(e: FixtureEncounter): { itemKey: string; binId: string }[] {
  return e.params.items.map((it, i) => ({ itemKey: `i${i}`, binId: it.binId }));
}
function docConfig(id: string): RouterLanesConfig {
  const c = (docConfigs as { configs: { archetype: string; encounterId: string | null; config: unknown }[] }).configs.find(
    (x) => x.archetype === "router_lanes" && x.encounterId === id,
  );
  if (!c) throw new Error(id);
  return RouterLanesConfig.parse(c.config);
}

const STATIONS = {
  e2: { e: encounter(cellFixture, "e2_selectivity"), config: docConfig("e2_selectivity"), skin: "membrane_router" },
  e6: { e: encounter(cellFixture, "e6_facilitated"), config: docConfig("e6_facilitated"), skin: "carrier_lanes" },
  e11: { e: encounter(cellFixture, "e11_boss"), config: docConfig("e11_boss"), skin: "gatekeeper_maws" },
  e8: { e: encounter(civilFixture, "e8_cra"), config: docConfig("e8_cra"), skin: "filing_cabinets" },
  e10: { e: encounter(civilFixture, "e10_sources"), config: docConfig("e10_sources"), skin: "provenance_drawers" },
} as const;
type StationKey = keyof typeof STATIONS;

function draftOf(assignments: readonly { itemKey: string; binId: string }[], extra: Partial<Draft> = {}): Draft {
  return {
    encounterId: "x",
    modeKey: "sorter.bins",
    input: { assignments },
    complete: false,
    focus: null,
    hover: null,
    probe: null,
    settled: true,
    wave: null,
    marks: null,
    seq: 1,
    ...extra,
  };
}
function poseInput(k: StationKey, draft: Draft | null, over: Partial<PoseInput<RouterLanesConfig, null>> = {}): PoseInput<RouterLanesConfig, null> {
  const s = STATIONS[k];
  return {
    view: viewOf(s.e),
    draft,
    config: s.config,
    probe: s.config.probe ? s.config.probe.min : null,
    t: 1.25,
    aidTier: 0,
    hintsUsed: 0,
    sim: null,
    solved: false,
    reducedMotion: false,
    ...over,
  };
}
function staticInput(k: StationKey, aidTier: AidTier = 0, hintsUsed: HintsUsed = 0, record = false): StaticInput<RouterLanesConfig> {
  const s = STATIONS[k];
  return { view: viewOf(s.e), config: s.config, aidTier, hintsUsed, reducedMotion: false, skinId: s.skin, record };
}
function diagnosis(over: Partial<Diagnosis>): Diagnosis {
  return {
    correct: false,
    feedback: "",
    displayFeedback: "",
    failKey: "wrong_bin",
    wrongKeys: [],
    prefix: null,
    disclosed: {},
    nearMiss: null,
    probeKeys: [],
    ...over,
  };
}
const sol = (k: StationKey) => solutionOf(STATIONS[k].e);

// ---------------------------------------------------------------- tests

describe("router_lanes meta · the live half", () => {
  it("replaces the slate placeholder for every skin", () => {
    expect(ROUTER_LANES_SKINS.map((s) => s.id)).toEqual(["membrane_router", "carrier_lanes", "gatekeeper_maws", "filing_cabinets", "provenance_drawers"]);
    for (const k of Object.keys(STATIONS) as StationKey[]) {
      const pose = meta.pose(poseInput(k, null));
      expect(pose.items).toHaveLength(STATIONS[k].e.params.items.length);
      expect(pose.lanes).toHaveLength(STATIONS[k].config.lanes.length);
      expect(pose.gate).toBe(0);
    }
  });

  it("idle items drift in the tide at the cell §5.2 formula (still under reduced motion)", () => {
    const view = viewOf(STATIONS.e2.e);
    const pose = meta.pose(poseInput("e2", null, { t: 2 }));
    pose.items.forEach((it, k) => {
      expect(it.lane).toBeNull();
      expect(it.display).toBe(k);
      expect(it.key).toBe(view.items[k]!.key);
      expect(it.x).toBeCloseTo(150 * (k - 2.5) + 20 * Math.sin(0.6 * 2 + k), 9);
      expect(it.y).toBeCloseTo(-300 + 16 * Math.sin(0.9 * 2 + 2 * k), 9);
    });
    const still = meta.pose(poseInput("e2", null, { t: 2, reducedMotion: true }));
    expect(still.items[1]!.y).toBe(-300);
  });

  it("queues follow x = X_lane + 56·(q − (n − 1)/2), y = −90, in the draft's order (a moved item goes last)", () => {
    const d = draftOf([
      { itemKey: "i0", binId: "diffuses" },
      { itemKey: "i1", binId: "diffuses" },
      { itemKey: "i2", binId: "protein" },
      { itemKey: "i4", binId: "diffuses" },
      { itemKey: "i0", binId: "diffuses" }, // re-dropped: goes to the end of the queue
    ]);
    const pose = meta.pose(poseInput("e2", d));
    const at = (key: string) => pose.items.find((i) => i.key === key)!;
    const L = pose.lanes.length;
    expect(at("i1")).toMatchObject({ lane: 0, q: 0, n: 3 });
    expect(at("i4")).toMatchObject({ lane: 0, q: 1, n: 3 });
    expect(at("i0")).toMatchObject({ lane: 0, q: 2, n: 3, newest: true });
    expect(at("i0").x).toBeCloseTo(laneX(0, L) + 56 * (2 - 1), 9);
    expect(at("i0").y).toBe(ROUTER_LAYOUT.queueY);
    expect(at("i2").x).toBe(queueX(laneX(1, L), 0, 1));
    expect(pose.lanes.map((l) => l.count)).toEqual([3, 1]);
    expect(assignmentsOf(d).map((a) => a.itemKey)).toEqual(["i1", "i2", "i4", "i0"]);
  });

  it("ignores assignments to unknown bins or items and malformed drafts", () => {
    const d = draftOf([{ itemKey: "i0", binId: "nope" }, { itemKey: "zz", binId: "protein" }]);
    expect(meta.pose(poseInput("e2", d)).placed).toBe(0);
    const junk = { ...draftOf([]), input: { assignments: [null, 3, { itemKey: 1 }] } } as Draft;
    expect(meta.pose(poseInput("e2", junk)).placed).toBe(0);
  });

  it("chips carry counts only — never a capacity or a correctness mark", () => {
    const d = draftOf(sol("e2").slice(0, 4), { focus: "i2" });
    const pose = meta.pose(poseInput("e2", d));
    const described = meta.describe(pose, poseInput("e2", d));
    const laneChips = described.chips.filter((c) => c.anchor.startsWith("lane_"));
    expect(laneChips.map((c) => c.text)).toEqual(["OIL ROAD: 2", "CROSSING GATE: 2"]);
    for (const c of described.chips) expect(c.text).not.toMatch(/\/|\bof\b|✓|✗|correct|wrong|\bmax\b|capacity/i);
    expect(described.chips.some((c) => c.anchor === itemAnchor("i2") && c.text === "Na⁺")).toBe(true);
    expect(described.nearMiss).toBeNull();
    expect(laneChipText({ laneId: "drawer_1" }, 3)).toBe("3 FILED");
  });

  it("the hydration lens turns on at lensTier, on polar or charged items only", () => {
    const at0 = meta.pose(poseInput("e2", null, { aidTier: 0 }));
    expect(at0.lens).toBe(0);
    expect(at0.items.every((i) => i.shell === 0)).toBe(true);
    const at1 = meta.pose(poseInput("e2", null, { aidTier: 1 }));
    expect(at1.lens).toBe(1);
    const shelled = at1.items.filter((i) => i.shell === 1).map((i) => i.key).sort();
    expect(shelled).toEqual(["i2", "i3", "i5"]); // Na⁺, glucose, Cl⁻
    const tier2 = { ...STATIONS.e2.config, lensTier: 2 as const };
    expect(meta.pose({ ...poseInput("e2", null, { aidTier: 1 }), config: tier2 }).lens).toBe(0);
    // e6 has no lens at any tier
    expect(meta.pose(poseInput("e6", null, { aidTier: 2 })).lens).toBe(0);
  });

  it("projects ATP: the energy lane's count hatches the reserve and drives the pipe glow", () => {
    expect(energyLaneIndex(STATIONS.e6.config)).toBe(1);
    expect(energyLaneIndex(STATIONS.e11.config)).toBe(2);
    expect(energyLaneIndex(STATIONS.e2.config)).toBeNull();
    const d = draftOf([{ itemKey: "i2", binId: "active" }, { itemKey: "i4", binId: "active" }, { itemKey: "i0", binId: "passive" }]);
    const pose = meta.pose(poseInput("e6", d));
    expect(pose.energy).toEqual({ reserve: 10, projected: 2 });
    expect(pose.intakeGlow).toBeCloseTo(0.2 + 0.15 * 2, 9);
    expect(pose.pipeGlow).toBeCloseTo(0.2 + 0.1 * 2, 9);
    const stat = meta.panelStatic(staticInput("e6"));
    expect(stat.cards.map((c) => c.kind)).toEqual(["energy_cells"]);
    const live = meta.panelLive(stat, poseInput("e6", d));
    const atp = live.liveCards.find((c) => c.kind === "energy_cells");
    expect(atp).toMatchObject({ total: 10, spent: 0, projected: 2 });
    expect(live.chips).toEqual([{ slot: 0, value: 2, text: "−2", color: "gold" }]);
    expect(meta.describe(pose, poseInput("e6", d)).chips.some((c) => c.text === "ATP −2")).toBe(true);
  });

  it("gradient ramps show the text's direction; slope arrows appear at tier 1 (tier 2 with a lens)", () => {
    const pose = meta.pose(poseInput("e6", null));
    expect(pose.items.find((i) => i.key === "i0")!.ramp).toBeCloseTo((2 - 8) / 10, 9);
    expect(pose.items.find((i) => i.key === "i1")!.ramp).toBeNull(); // water: no stated direction
    expect(pose.rampArrows).toBe(false);
    expect(meta.pose(poseInput("e6", null, { aidTier: 1 })).rampArrows).toBe(true);
    expect(meta.pose(poseInput("e11", null, { aidTier: 1 })).rampArrows).toBe(false);
    expect(meta.pose(poseInput("e11", null, { aidTier: 2 })).rampArrows).toBe(true);
  });

  it("a focused bin opens its maw; a focused item turns the eye toward it", () => {
    const focusBin = meta.pose(poseInput("e11", draftOf([], { focus: "active" })));
    expect(focusBin.lanes.map((l) => l.open)).toEqual([0, 0, 1]);
    expect(focusBin.eyeTracking).toBe(false);
    expect(focusBin.eyeAngle).toBeCloseTo(Math.PI / 2, 9);
    const d = draftOf([{ itemKey: "i1", binId: "facilitated" }], { focus: "i1" });
    const focusItem = meta.pose(poseInput("e11", d));
    const it = focusItem.items.find((i) => i.key === "i1")!;
    expect(focusItem.eyeTracking).toBe(true);
    expect(focusItem.eyeAngle).toBeCloseTo(Math.atan2(it.y - ROUTER_LAYOUT.eye.y, it.x - ROUTER_LAYOUT.eye.x), 9);
    expect(eyeAngleFor({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(Math.PI / 2, 12);
    expect(focusItem.lanes[1]!.turn).toBeCloseTo(Math.PI / 6, 9); // the Channel Maw ring turns 30° per cargo
  });

  it("boss phases: later batches stay hidden until the previous batch is placed; complete only when all are", () => {
    const phases = [
      { id: "p1", itemKeys: ["i0", "i1"] },
      { id: "p2", itemKeys: ["i2", "i3"] },
      { id: "p3", itemKeys: ["i4", "i5", "i6"] },
    ];
    const keys = ["i0", "i1", "i2", "i3", "i4", "i5", "i6"];
    expect(bossBatchState(phases, [], keys)).toMatchObject({ visibleKeys: ["i0", "i1"], batch: 0, batches: 3, allVisible: false, batchPlaced: false });
    expect(bossBatchState(phases, ["i0"], keys).batch).toBe(0);
    expect(bossBatchState(phases, ["i0", "i1"], keys)).toMatchObject({ batch: 1, visibleKeys: ["i0", "i1", "i2", "i3"], batchPlaced: false });
    expect(bossBatchState(phases, ["i0", "i1", "i2", "i3"], keys)).toMatchObject({ batch: 2, allVisible: true });
    // un-filing an early item never hides cargo that is already on the board
    expect(bossBatchState(phases, ["i1", "i2", "i3"], keys).batch).toBe(1);

    const partial = draftOf([{ itemKey: "i0", binId: "simple" }, { itemKey: "i1", binId: "facilitated" }]);
    const pose = withBossPhases(meta.pose(poseInput("e11", partial)), phases);
    expect(pose.items.filter((i) => i.visible).map((i) => i.key).sort()).toEqual(["i0", "i1", "i2", "i3"]);
    expect(pose.batch).toBe(1);
    expect(pose.complete).toBe(false);
    expect(routerDraftComplete(keys, [...sol("e11").slice(0, 6)])).toBe(false);
    expect(routerDraftComplete(keys, sol("e11"))).toBe(true);
    expect(routerDraftComplete(keys, sol("e11"), ["simple"])).toBe(false);
    const full = withBossPhases(meta.pose(poseInput("e11", draftOf(sol("e11")))), phases);
    expect(full.complete).toBe(true);
    expect(full.items.every((i) => i.visible)).toBe(true);
    expect(withBossPhases(meta.pose(poseInput("e2", null)), [])).toEqual(meta.pose(poseInput("e2", null)));
  });

  it("the failure plan acts on wrongKeys[0] only and opens only the disclosed bin's shutter", () => {
    // civil e8: the literacy-test slip filed under 1964
    const wrong = sol("e8").map((a) => (a.itemKey === "i2" ? { ...a, binId: "cra_1964" } : a));
    const d = diagnosis({ wrongKeys: ["i2"], disclosed: { bin: "vra_1965" } });
    const plan = meta.failurePlan(d, poseInput("e8", draftOf(wrong)));
    const anchors = plan.beats.map((b) => b.anchor);
    expect(anchors).toEqual([itemAnchor("i2"), "shutter_1"]);
    expect(plan.beats[0]!.action).toBe("bounce");
    expect(plan.durationMs).toBeGreaterThanOrEqual(600);
    expect(plan.durationMs).toBeLessThanOrEqual(1600);
    expect(plan.beats.some((b) => b.params && "shakePx" in b.params)).toBe(false); // sensitiveSafe: no shake

    for (const k of ["e2", "e6", "e11"] as const) {
      const s = sol(k);
      const bins = STATIONS[k].config.lanes.map((l) => l.binId);
      const first = s[0]!;
      const moved = s.map((a) => (a.itemKey === first.itemKey ? { ...a, binId: bins.find((b) => b !== a.binId)! } : a));
      const p = meta.failurePlan(diagnosis({ wrongKeys: [first.itemKey, "i6"], disclosed: { bin: first.binId } }), poseInput(k, draftOf(moved)));
      const itemBeats = p.beats.filter((b) => b.anchor.startsWith("item_"));
      expect(itemBeats.length).toBeGreaterThan(0);
      for (const b of itemBeats) expect(b.anchor).toBe(itemAnchor(first.itemKey));
      expect(p.beats.some((b) => b.anchor.startsWith("shutter_"))).toBe(false);
      expect(p.durationMs).toBeLessThanOrEqual(1600);
    }
    // e11: spat back; e6 passive cargo in the pump fizzles; e2 charged cargo on the oil road bounces
    const e11 = meta.failurePlan(
      diagnosis({ wrongKeys: ["i0"], disclosed: { bin: "simple" } }),
      poseInput("e11", draftOf([{ itemKey: "i0", binId: "active" }])),
    );
    expect(e11.beats.map((b) => b.action)).toContain("spit_back");
    const e6 = meta.failurePlan(diagnosis({ wrongKeys: ["i0"] }), poseInput("e6", draftOf([{ itemKey: "i0", binId: "active" }])));
    expect(e6.beats.map((b) => b.action)).toEqual(["spark", "eject"]);
    const e6b = meta.failurePlan(diagnosis({ wrongKeys: ["i2"] }), poseInput("e6", draftOf([{ itemKey: "i2", binId: "passive" }])));
    expect(e6b.beats[0]!.action).toBe("stall");
    const e2 = meta.failurePlan(diagnosis({ wrongKeys: ["i2"] }), poseInput("e2", draftOf([{ itemKey: "i2", binId: "diffuses" }])));
    expect(e2.beats[0]).toMatchObject({ anchor: itemAnchor("i2"), action: "bounce" });
    const e2b = meta.failurePlan(diagnosis({ wrongKeys: ["i4"] }), poseInput("e2", draftOf([{ itemKey: "i4", binId: "protein" }])));
    expect(e2b.beats.map((b) => b.action)).toEqual(["flash", "eject"]);
    // incomplete never names an item
    const inc = meta.failurePlan(diagnosis({ failKey: "incomplete", wrongKeys: [] }), poseInput("e2", draftOf([])));
    expect(inc.beats.every((b) => !b.anchor.startsWith("item_"))).toBe(true);
  });

  it("vehicle is success-only: pose, describe and panelLive ignore it; successPlan reads it", () => {
    for (const k of ["e2", "e6", "e11"] as const) {
      const base = STATIONS[k].config;
      const vehicles = ["carrier", "channel", "pump", "none"] as const;
      const permuted: RouterLanesConfig = { ...base, items: base.items.map((it, i) => ({ ...it, vehicle: vehicles[(i + 1) % 4]! })) };
      for (const d of [null, draftOf(sol(k).slice(0, 3), { focus: sol(k)[0]!.itemKey }), draftOf(sol(k))]) {
        for (const aidTier of [0, 1, 2] as const) {
          const a = poseInput(k, d, { aidTier });
          const b = { ...a, config: permuted };
          expect(meta.pose(b)).toEqual(meta.pose(a));
          expect(meta.describe(meta.pose(b), b)).toEqual(meta.describe(meta.pose(a), a));
          const stA = meta.panelStatic(staticInput(k, aidTier));
          const stB = meta.panelStatic({ ...staticInput(k, aidTier), config: permuted });
          expect(stB).toEqual(stA);
          expect(meta.panelLive(stB, b)).toEqual(meta.panelLive(stA, a));
        }
      }
      const planA = meta.successPlan({ ...poseInput(k, draftOf(sol(k))), solved: true }, "ramp_forms");
      const planB = meta.successPlan({ ...poseInput(k, draftOf(sol(k))), config: permuted, solved: true }, "ramp_forms");
      expect(planB).not.toEqual(planA);
    }
  });

  it("the pose depends on the view only (solution-swapped params with an identical view)", () => {
    // the meta never receives params; two encounters that present the same view produce the same pose
    const input = poseInput("e8", draftOf(sol("e8").slice(0, 3)));
    const clone = JSON.parse(JSON.stringify(input)) as typeof input;
    expect(meta.pose(clone)).toEqual(meta.pose(input));
    expect(meta.panelLive(meta.panelStatic(staticInput("e8")), clone)).toEqual(meta.panelLive(meta.panelStatic(staticInput("e8")), input));
  });

  it("the success plan: 1.2–2.5 s, every item passes, pumps spend ATP on the card", () => {
    for (const k of Object.keys(STATIONS) as StationKey[]) {
      const plan = meta.successPlan({ ...poseInput(k, draftOf(sol(k))), solved: true }, k === "e8" ? "stairwell_opens" : "ramp_forms");
      expect(plan.durationMs).toBeGreaterThanOrEqual(1200);
      expect(plan.durationMs).toBeLessThanOrEqual(2500);
      for (const b of plan.beats) expect(b.atMs).toBeLessThan(plan.durationMs);
      const itemKeys = new Set(plan.beats.filter((b) => b.anchor.startsWith("item_")).map((b) => b.anchor));
      expect(itemKeys.size).toBe(STATIONS[k].e.params.items.length);
      expect(plan.beats.at(-1)!.anchor).toBe("payoff");
    }
    const e6 = meta.successPlan({ ...poseInput("e6", draftOf(sol("e6"))), solved: true }, "door_carries");
    expect(e6.cardEffects).toHaveLength(2); // Na⁺ and H⁺ are pumped
    expect(e6.beats.filter((b) => b.action === "rise")).toHaveLength(2);
    expect(e6.beats.find((b) => b.anchor === itemAnchor("i0"))!.action).toBe("ride"); // glucose rides the carrier, no spark
    const e8 = meta.successPlan({ ...poseInput("e8", draftOf(sol("e8"))), solved: true }, "stairwell_opens");
    expect(e8.beats.filter((b) => b.anchor.startsWith("shutter_")).map((b) => b.action)).toEqual(["open", "open"]);
    expect(e8.cue).toBe("drawer_thunk");
  });

  it("solvedPose: items passed, gate open, shutters showing their features", () => {
    const solved = meta.solvedPose({ ...poseInput("e8", draftOf(sol("e8"))), solved: true });
    expect(solved.gate).toBe(1);
    expect(solved.items.every((i) => i.passed === 1)).toBe(true);
    expect(solved.lanes.every((l) => l.shutter === 1)).toBe(true);
    expect(meta.solvedPose({ ...poseInput("e2", null), solved: true }).gate).toBe(1);
  });

  it("feature shutters open at aid tier 1 in shutter configs only; meters show completion", () => {
    expect(meta.pose(poseInput("e8", null)).lanes.map((l) => l.shutter)).toEqual([0, 0]);
    expect(meta.pose(poseInput("e8", null, { aidTier: 1 })).lanes.map((l) => l.shutter)).toEqual([1, 1]);
    expect(meta.pose(poseInput("e2", null, { aidTier: 2 })).lanes.map((l) => l.shutter)).toEqual([0, 0]);
    const pose = meta.pose(poseInput("e8", draftOf(sol("e8").slice(0, 3))));
    expect(pose.lanes[0]!.meter).toBeCloseTo(-50 + (100 * 2) / 6, 9);
    expect(pose.lanes[1]!.meter).toBeCloseTo(-50 + (100 * 1) / 6, 9);
  });

  it("civil FILE card: first when recorded, filed pins at the lane year (e8) or the made year (e10), events band at its tier", () => {
    const st8 = meta.panelStatic(staticInput("e8", 0, 0, true));
    expect(st8.cards[0]).toMatchObject({ kind: "timeline", slot: 0, title: "FILE" });
    expect(st8.probe).toEqual(STATIONS.e8.config.probe);
    expect(st8.recordPins).toEqual([]);
    const card8 = st8.cards[0] as Extract<(typeof st8.cards)[number], { kind: "timeline" }>;
    expect(card8.lanes.map((l) => l.id)).toEqual(["cra_1964", "vra_1965"]);
    expect(card8.pins.map((p) => p.key).sort()).toEqual(["printed:i4", "printed:i5"]);
    const live8 = meta.panelLive(st8, poseInput("e8", draftOf([{ itemKey: "i2", binId: "cra_1964" }])));
    const filed8 = (live8.liveCards[0] as typeof card8).pins.find((p) => p.key === "filed:i2")!;
    expect(filed8).toMatchObject({ at: 1964.5, lane: "cra_1964", style: "draft" });
    expect(live8.scrubX).toBe(STATIONS.e8.config.probe!.min);
    expect(live8.readout).toMatch(/^[A-Z]{3} 196\d$/);

    const st10a = meta.panelStatic(staticInput("e10", 0, 0, true));
    expect((st10a.cards[0] as typeof card8).bands).toEqual([]);
    const st10 = meta.panelStatic(staticInput("e10", 1, 1, true));
    const band = (st10.cards[0] as typeof card8).bands[0]!;
    expect(band).toMatchObject({ from: 1963, to: 1966, label: "THE EVENTS · 1963–1965" });
    const live10 = meta.panelLive(st10, poseInput("e10", draftOf([{ itemKey: "i1", binId: "primary" }]), { probe: 1971, aidTier: 1 }));
    expect((live10.liveCards[0] as typeof card8).pins.find((p) => p.key === "filed:i1")).toMatchObject({ at: 1971.5, lane: "primary" });
    expect(live10.readout).toBe("1971");
    const stamped = meta.pose(poseInput("e10", draftOf([{ itemKey: "i1", binId: "primary" }])));
    expect(stamped.items.find((i) => i.key === "i1")!.stampYear).toBe(1971);
    expect(stamped.items.find((i) => i.key === "i0")!.stampYear).toBeNull(); // not filed yet
  });

  it("cell panels carry no FILE card and no probe", () => {
    const st = meta.panelStatic(staticInput("e2"));
    expect(st).toEqual({ cards: [], input: null, probe: null, recordPins: [] });
    const live: PanelLive = meta.panelLive(st, poseInput("e2", draftOf(sol("e2"))));
    expect(live).toEqual({ scrubX: null, readout: null, chips: [], highlights: [], liveCards: [] });
  });

  it("hint targets follow each game doc's flights; shutter configs visit every shutter on rung 1", () => {
    const flights = (k: StationKey) => ([1, 2, 3] as const).map((r) => meta.hintTargets(r, staticInput(k)).map((h) => `${h.action}:${h.anchor}`));
    expect(flights("e2")).toEqual([["hover:gate_ring"], ["hover:lane_diffuses"], ["circle:lane_protein"]]);
    expect(flights("e6")).toEqual([["circle:lane_passive"], ["hover:atp_port"], ["land:lane_active"]]);
    expect(flights("e11")).toEqual([["hover:eye"], ["hover:maw_active"], ["circle:pipe_top"]]);
    expect(flights("e8")).toEqual([["circle:shutter_0", "circle:shutter_1"], ["circle:meter_0", "circle:meter_1"], ["hover:table"]]);
    expect(flights("e10")).toEqual([["circle:shutter_0", "circle:shutter_1"], ["circle:table"], ["hover:drawer_0"]]);
    for (const skin of ROUTER_LANES_SKINS) for (const rung of skin.hintTargets) for (const h of rung) expect(skin.anchors).toContain(h.anchor);
  });

  it("lerp eases positions and snaps discrete fields at the halfway point", () => {
    const a = meta.pose(poseInput("e2", null));
    const b = meta.pose(poseInput("e2", draftOf([{ itemKey: "i2", binId: "protein" }])));
    const mid = meta.lerp(a, b, 0.25);
    const i2a = a.items.find((i) => i.key === "i2")!;
    const i2b = b.items.find((i) => i.key === "i2")!;
    const i2m = mid.items.find((i) => i.key === "i2")!;
    expect(i2m.x).toBeCloseTo(i2a.x + (i2b.x - i2a.x) * 0.25, 9);
    expect(i2m.lane).toBeNull();
    expect(meta.lerp(a, b, 0.75).items.find((i) => i.key === "i2")!.lane).toBe(1);
    expect(meta.lerp(a, b, 1)).toEqual(b);
  });

  it("describe, debug, geometry and the probe", () => {
    const pose: RouterLanesPose = meta.pose(poseInput("e11", draftOf(sol("e11").slice(0, 2))));
    const d = meta.describe(pose, poseInput("e11", null));
    expect(d.srText).toBe("Simple diffusion holds 1, Facilitated diffusion holds 1, Active transport holds 0; 5 still drifting.");
    expect(d.chips.map((c) => c.anchor)).toEqual(expect.arrayContaining([laneAnchor(0), laneAnchor(1), laneAnchor(2)]));
    expect(meta.debug(pose)).toMatchObject({ placed: 2, total: 7, solved: false });
    const fb = meta.frameBounds(STATIONS.e11.config, viewOf(STATIONS.e11.e));
    expect(fb.w).toBeGreaterThan(0);
    expect(fb.x).toBeLessThan(0);
    expect(meta.probe(STATIONS.e10.config, null)).toEqual(STATIONS.e10.config.probe);
    expect(meta.probe(STATIONS.e2.config, null)).toBeNull();
    expect(meta.clock).toEqual({ resetOn: ["open"] });
    expect(meta.footprint(STATIONS.e2.config).height).toBeGreaterThan(0);
  });
});
