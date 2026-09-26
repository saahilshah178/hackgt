import { describe, expect, it } from "vitest";
import civil from "../../../fixtures/civil-rights-mystery.json";
import docConfigs from "../../../tests/world-doc-configs.json";
import { makeDraft } from "../draft-inputs";
import type { ChainView, Diagnosis, Draft, PoseInput, StaticInput } from "../types";
import {
  bendsOf,
  catenaryPoint,
  catenarySag,
  causalOrder,
  CAUSE_TUBES_SKINS,
  causeTubesMeta as meta,
  CauseTubesConfig,
  dishAngle,
  frameBoundsOf,
  gaugeOf,
  housingPositions,
  manhattanCorners,
  manhattanRouteFor,
  verticalPoint,
  verticalSag,
  type CauseTubesPose,
} from "./cause-tubes.meta";

const MODE = "linker.chain" as const;
type Enc = (typeof civil.encounters)[number];
const enc = (id: string): Enc => civil.encounters.find((e) => e.id === id)!;
const docConfig = (id: string) => CauseTubesConfig.parse(docConfigs.configs.find((c) => c.encounterId === id)!.config);

/** The view as chain.present() builds it: nodes n0… then decoys d0…, shown in a (fixed, test) shuffled order. */
function viewOf(id: string, order: readonly number[]): ChainView {
  const p = enc(id).params as { nodes: string[]; decoys: string[] };
  const all = [...p.nodes.map((text, i) => ({ key: `n${i}`, text })), ...p.decoys.map((text, i) => ({ key: `d${i}`, text }))];
  return { nodes: order.map((i) => all[i]), edgeCount: p.nodes.length - 1 };
}
const E5_VIEW = viewOf("e5_freedom_rides", [3, 5, 0, 4, 1, 2]);
const E6_VIEW = viewOf("e6_birmingham", [2, 0, 5, 4, 1, 3]);
const E11_VIEW = viewOf("e11_causation", [6, 2, 0, 4, 1, 5, 3]);
const E5 = docConfig("e5_freedom_rides");
const E6 = CauseTubesConfig.parse({ ...E5, connector: "vertical_wire", layout: "mast", nodes: E5.nodes.map((n) => (n.key === "n4" ? { ...n, meta: { ...n.meta, printedDate: "1963-06" } } : n)), probe: { ...E5.probe!, min: 1962, max: 1964, window: { start: 1962, end: 1964 } } });
const E11 = docConfig("e11_causation");
const SOLUTION = ["n0>n1", "n1>n2", "n2>n3", "n3>n4"].map((s) => ({ fromKey: s.split(">")[0], toKey: s.split(">")[1] }));

function draft(edges: { fromKey: string; toKey: string }[], patch: Partial<Draft> = {}): Draft {
  return makeDraft("e5_freedom_rides", MODE, { edges }, { complete: false, ...patch });
}
function input(view: ChainView, config: CauseTubesConfig, d: Draft | null, patch: Partial<PoseInput<CauseTubesConfig>> = {}): PoseInput<CauseTubesConfig> {
  return { view, draft: d, config, probe: d?.probe ?? null, t: 1, aidTier: 0, hintsUsed: 0, sim: null, solved: false, reducedMotion: false, ...patch };
}
function staticIn(view: ChainView, config: CauseTubesConfig, patch: Partial<StaticInput<CauseTubesConfig>> = {}): StaticInput<CauseTubesConfig> {
  return { view, config, aidTier: 0, hintsUsed: 0, reducedMotion: false, skinId: "relay_line", record: true, ...patch };
}
const pose = (i: PoseInput<CauseTubesConfig>): CauseTubesPose => meta.pose(i);
const texts = (e: Enc) => [e.prompt, ...e.hints, ...((e.params as { nodes: string[]; decoys: string[] }).nodes), ...((e.params as { decoys: string[] }).decoys)];
function diag(failKey: Diagnosis["failKey"], wrongKeys: string[]): Diagnosis {
  return { correct: false, feedback: "", displayFeedback: "", failKey, wrongKeys, prefix: null, disclosed: {}, nearMiss: null, probeKeys: [] };
}

describe("cause_tubes meta · configs", () => {
  it("the doc's e5 and e11 configs validate against the fixture views", () => {
    for (const [id, cfg, view] of [["e5_freedom_rides", E5, E5_VIEW], ["e11_causation", E11, E11_VIEW]] as const) {
      const e = enc(id);
      const issues = meta.validateConfig(cfg, { modeKey: MODE, encounter: e as never, params: e.params, solution: e.solution, view, texts: texts(e), biome: "archive_of_voices" });
      expect(issues).toEqual([]);
    }
  });

  it("boardWidth ≤ 1100: the schema rejects wider boards, validateConfig flags them, housings and frames stay inside", () => {
    expect(CauseTubesConfig.safeParse({ ...E11, boardWidth: 1200 }).success).toBe(false);
    const e = enc("e11_causation");
    const wide = { ...E11, boardWidth: 1400 };
    const issues = meta.validateConfig(wide, { modeKey: MODE, encounter: e as never, params: e.params, solution: e.solution, view: E11_VIEW, texts: texts(e), biome: "archive_of_voices" });
    expect(issues.map((i) => i.path.join("."))).toContain("boardWidth");
    for (const layout of ["canopy_row", "ring", "mast"] as const) {
      for (const n of [2, 5, 7, 10]) {
        for (const p of housingPositions(layout, n, 1100)) expect(Math.abs(p.x)).toBeLessThanOrEqual(550);
        for (const p of housingPositions(layout, n, 1400)) expect(Math.abs(p.x)).toBeLessThanOrEqual(550); // clamped
      }
    }
    expect(frameBoundsOf(E11).w).toBeLessThanOrEqual(1100 + 120);
    expect(frameBoundsOf({ ...E5, boardWidth: 800 }).w).toBe(800 + 160);
  });

  it("a printed date that is not in the node text is an error", () => {
    const e = enc("e11_causation");
    const bad = { ...E11, nodes: E11.nodes.map((n) => (n.key === "n0" ? { ...n, meta: { ...n.meta, printedDate: "1962-05" } } : n)) };
    const issues = meta.validateConfig(bad, { modeKey: MODE, encounter: e as never, params: e.params, solution: e.solution, view: E11_VIEW, texts: texts(e), biome: "archive_of_voices" });
    expect(issues.some((i) => i.path.join(".") === "nodes.0.meta.printedDate")).toBe(true);
  });
});

describe("cause_tubes meta · geometry", () => {
  it("catenary sag formula: sag = 0.12·|Δx| + 24 and p(t) = lerp + (0, sag·4t(1 − t))", () => {
    const a = { x: -400, y: 190 };
    const b = { x: 260, y: 190 };
    expect(catenarySag(a, b)).toBeCloseTo(0.12 * 660 + 24, 9);
    expect(catenarySag(b, a)).toBeCloseTo(catenarySag(a, b), 9);
    expect(catenaryPoint(a, b, 0)).toEqual(a);
    expect(catenaryPoint(a, b, 1)).toEqual(b);
    const mid = catenaryPoint(a, b, 0.5);
    expect(mid.x).toBeCloseTo(-70, 9);
    expect(mid.y).toBeCloseTo(190 + catenarySag(a, b), 9); // 4·½·½ = 1
    expect(catenaryPoint(a, b, 0.25).y).toBeCloseTo(190 + catenarySag(a, b) * 0.75, 9);
    // the pose's wires use exactly this sag
    const p = pose(input(E5_VIEW, E5, draft([{ fromKey: "n0", toKey: "n1" }])));
    const w = p.wires[0];
    expect(w.sag).toBeCloseTo(catenarySag(w.a, w.b), 9);
    expect(w.points[8].y).toBeCloseTo((w.a.y + w.b.y) / 2 + w.sag, 9);
  });

  it("vertical sag formula: sag_x = 0.08·|Δy| + 16, lateral, bowing away from the mast", () => {
    const a = { x: -80, y: -140 };
    const b = { x: 80, y: -780 };
    expect(verticalSag(a, b)).toBeCloseTo(0.08 * 640 + 16, 9);
    const mid = verticalPoint(a, b, 0.5, 1);
    expect(mid.y).toBeCloseTo(-460, 9);
    expect(mid.x).toBeCloseTo(0 + verticalSag(a, b), 9);
    expect(verticalPoint(a, b, 0.5, -1).x).toBeCloseTo(-verticalSag(a, b), 9);
    const p = pose(input(E6_VIEW, E6, draft([{ fromKey: "n0", toKey: "n1" }])));
    expect(p.wires[0].connector).toBe("vertical_wire");
    expect(p.wires[0].sag).toBeCloseTo(verticalSag(p.wires[0].a, p.wires[0].b), 9);
    expect(p.wires[0].points.every((q, i, arr) => i === 0 || q.y !== arr[i - 1].y || q.x !== arr[i - 1].x)).toBe(true);
  });

  it("Manhattan tube routes have ≤ 2 bends and join the two canisters", () => {
    const pos = housingPositions("ring", 7, 1100);
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        if (i === j) continue;
        const pts = manhattanCorners(pos[i], pos[j], manhattanRouteFor(pos[i], pos[j], i));
        expect(bendsOf(pts)).toBeLessThanOrEqual(2);
        expect(pts[0]).toEqual(pos[i]);
        expect(pts[pts.length - 1]).toEqual(pos[j]);
        for (let k = 1; k < pts.length; k++) expect(Math.min(Math.abs(pts[k].x - pts[k - 1].x), Math.abs(pts[k].y - pts[k - 1].y))).toBeLessThan(1e-6); // axis-aligned legs
      }
    }
    expect(bendsOf(manhattanCorners({ x: 0, y: 0 }, { x: 100, y: 0 }, { first: "v", mid: 0.5 }))).toBe(0);
    const p = pose(input(E11_VIEW, E11, draft(SOLUTION)));
    expect(p.wires).toHaveLength(4);
    for (const w of p.wires) {
      expect(w.connector).toBe("tube");
      expect(w.route).not.toBeNull();
      expect(bendsOf(w.points)).toBeLessThanOrEqual(2);
    }
  });

  it("placement by DISPLAY index: permuting the view moves housings, keys never decide places", () => {
    const pos = housingPositions("canopy_row", 6, 1100);
    const a = pose(input(E5_VIEW, E5, null));
    a.housings.forEach((h, i) => expect({ key: h.key, x: h.x, y: h.y }).toEqual({ key: E5_VIEW.nodes[i].key, ...pos[i] }));
    // the same display order with the keys renamed gives identical places
    const renamed: ChainView = { ...E5_VIEW, nodes: E5_VIEW.nodes.map((n, i) => ({ key: `z${i}`, text: n.text })) };
    const b = pose(input(renamed, E5, null));
    expect(b.housings.map((h) => [h.x, h.y])).toEqual(a.housings.map((h) => [h.x, h.y]));
    // a different shuffle moves n0 to that shuffle's slot
    const other = viewOf("e5_freedom_rides", [0, 1, 2, 3, 4, 5]);
    expect(pose(input(other, E5, null)).housings.find((h) => h.key === "n0")!.x).toBe(pos[0].x);
    expect(a.housings.find((h) => h.key === "n0")!.x).toBe(pos[2].x);
    // mast heights climb by display index; the last display index stands on the stray pole
    const mast = housingPositions("mast", 6, 1100);
    expect(mast.slice(0, 5).map((p) => p.y)).toEqual([-140, -300, -460, -620, -780]);
    expect(mast[5]).toEqual({ x: 380, y: -300 });
    // e6: the station at display index k is the k-th housing, whatever its key
    const e6 = pose(input(E6_VIEW, E6, null));
    e6.housings.forEach((h, i) => expect([h.x, h.y]).toEqual([mast[i].x, mast[i].y]));
  });
});

describe("cause_tubes meta · live link (completion only)", () => {
  it("gauge = edges / edgeCount, clamped; completion only", () => {
    expect(gaugeOf(0, 4)).toBe(0);
    expect(gaugeOf(3, 4)).toBe(0.75);
    expect(gaugeOf(6, 4)).toBe(1);
    expect(gaugeOf(1, 0)).toBe(0);
    for (let k = 0; k <= 4; k++) {
      const p = pose(input(E5_VIEW, E5, draft(SOLUTION.slice(0, k))));
      expect(p.gauge).toBe(k / 4);
      expect(p.edges).toBe(k);
      expect(p.edgeCount).toBe(4);
    }
    // a wrong chain of the same length reads the same: the gauge never tells right from wrong
    const wrong = [{ fromKey: "n4", toKey: "n0" }, { fromKey: "d0", toKey: "n1" }, { fromKey: "n2", toKey: "d0" }];
    expect(pose(input(E5_VIEW, E5, draft(wrong))).gauge).toBe(pose(input(E5_VIEW, E5, draft(SOLUTION.slice(0, 3)))).gauge);
    // junk edges (unknown keys, self-loops, duplicates) do not count
    const junk = [{ fromKey: "n0", toKey: "n0" }, { fromKey: "n9", toKey: "n1" }, { fromKey: "n0", toKey: "n1" }, { fromKey: "n0", toKey: "n1" }];
    expect(pose(input(E5_VIEW, E5, draft(junk))).edges).toBe(1);
    expect(meta.describe(pose(input(E5_VIEW, E5, draft(SOLUTION.slice(0, 3)))), input(E5_VIEW, E5, null)).chips.find((c) => c.anchor === "gauge")?.text).toBe("3 / 4 WIRES");
  });

  it("dishes face their source; an unreached dish faces outward", () => {
    const p = pose(input(E6_VIEW, E6, draft([{ fromKey: "n0", toKey: "n3" }, { fromKey: "d0", toKey: "n1" }])));
    const at = (k: string) => p.housings.find((h) => h.key === k)!;
    expect(at("n3").dishRad).toBeCloseTo(dishAngle(at("n0"), at("n3")), 12);
    expect(at("n1").dishRad).toBeCloseTo(Math.atan2(at("d0").y - at("n1").y, at("d0").x - at("n1").x), 12);
    const idle = at("n2");
    expect(idle.dishRad).toBe(idle.x < 0 ? Math.PI : 0);
    // re-wiring the input of n3 turns its dish to the new source (the latest edge wins)
    const q = pose(input(E6_VIEW, E6, draft([{ fromKey: "n0", toKey: "n3" }, { fromKey: "n4", toKey: "n3" }])));
    const n3 = q.housings.find((h) => h.key === "n3")!;
    const n4 = q.housings.find((h) => h.key === "n4")!;
    expect(n3.dishRad).toBeCloseTo(dishAngle(n4, n3), 12);
    // easing turns the dish the short way round
    const eased = meta.lerp(p, q, 0.5);
    expect(Number.isFinite(eased.housings.find((h) => h.key === "n3")!.dishRad)).toBe(true);
  });

  it("lamps are amber-ready with an outgoing wire, never cyan before Verify; lids open 30°", () => {
    const p = pose(input(E11_VIEW, E11, draft([{ fromKey: "d1", toKey: "n0" }, { fromKey: "n2", toKey: "n3" }])));
    for (const h of p.housings) {
      expect(h.lamp).toBe(h.key === "d1" || h.key === "n2" ? "ready" : "off");
      expect(h.lidDeg).toBe(h.key === "d1" || h.key === "n2" ? 30 : 0);
    }
    for (let k = 0; k <= 4; k++) expect(pose(input(E11_VIEW, E11, draft(SOLUTION.slice(0, k)))).housings.some((h) => h.lamp === "lit")).toBe(false);
    const solved = meta.solvedPose(input(E11_VIEW, E11, draft(SOLUTION), { solved: true }));
    expect(solved.housings.every((h) => h.lamp === "lit")).toBe(true);
    expect(solved).toMatchObject({ run: 1, gate: 1, gauge: 1, solved: true });
  });

  it("no leak: the pose, describe and panelLive are the same for the solution and a wrong chain of the same shape", () => {
    // relabel keys so a wrong draft has exactly the same display geometry as the solution draft
    const perm: Record<string, string> = { n0: "n3", n1: "d0", n2: "n4", n3: "n1", n4: "n0", d0: "n2" };
    const view2: ChainView = { ...E5_VIEW, nodes: E5_VIEW.nodes.map((n) => ({ key: perm[n.key], text: n.text })) };
    const sol = SOLUTION;
    const mapped = sol.map((e) => ({ fromKey: perm[e.fromKey], toKey: perm[e.toKey] }));
    const a = pose(input(E5_VIEW, E5, draft(sol)));
    const b = pose(input(view2, E5, draft(mapped)));
    const omit = <T extends object>(o: T, keys: readonly string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
    const strip = (p: CauseTubesPose) => ({ ...p, housings: p.housings.map((h) => omit(h, ["key"])), wires: p.wires.map((w) => omit(w, ["fromKey", "toKey"])) });
    expect(strip(b)).toEqual(strip(a));
    expect(meta.describe(b, input(view2, E5, null)).srText).toBe(meta.describe(a, input(E5_VIEW, E5, null)).srText);
  });

  it("lerp eases continuous fields and takes discrete fields at once", () => {
    const a = pose(input(E11_VIEW, E11, draft([])));
    const b = pose(input(E11_VIEW, E11, draft(SOLUTION.slice(0, 2))));
    const m = meta.lerp(a, b, 0.1);
    expect(m.gauge).toBeCloseTo(0.05, 9);
    expect(m.wires).toHaveLength(2);
    expect(m.housings.find((h) => h.key === "n0")!.lidDeg).toBeCloseTo(3, 9);
    expect(meta.lerp(a, b, 0)).toBe(a);
    expect(meta.lerp(a, b, 1).gauge).toBe(b.gauge);
  });

  it("the record lens follows the probe", () => {
    expect(pose(input(E5_VIEW, E5, draft([], { probe: 1961 }))).lensU).toBe(0.5);
    expect(pose(input(E5_VIEW, E5, null)).lensU).toBeNull();
  });
});

describe("cause_tubes meta · panel", () => {
  it("FILE first when the RECORD card shows, then the cause graph mirroring the world order", () => {
    const st = meta.panelStatic(staticIn(E5_VIEW, E5));
    expect(st.cards.map((c) => c.kind)).toEqual(["timeline", "cause_graph"]);
    expect(st.cards[0]).toMatchObject({ slot: 0, title: "FILE", pins: [] }); // e5: no dated nodes, FILE stays empty
    const g = st.cards[1];
    if (g.kind !== "cause_graph") throw new Error("expected cause_graph");
    expect(g.slot).toBe(1);
    expect(g.nodes.map((n) => n.key)).toEqual(E5_VIEW.nodes.map((n) => n.key));
    const xs = g.nodes.map((n) => n.x);
    expect([...xs].sort((p, q) => p - q)).toEqual(xs); // left → right, like the boxes
    expect(meta.panelStatic(staticIn(E5_VIEW, E5, { record: false })).cards.map((c) => c.kind)).toEqual(["cause_graph"]);
    expect(st.probe).toEqual(E5.probe);
    expect(st.recordPins).toEqual([]);
  });

  it("e11 FILE pins the printed dates; live draft edges become arrows between dated pins", () => {
    const st = meta.panelStatic(staticIn(E11_VIEW, E11, { skinId: "big_board" }));
    const file = st.cards[0];
    if (file.kind !== "timeline") throw new Error("expected timeline");
    expect(file.pins).toHaveLength(7);
    expect(file.axisBreak).not.toBeNull(); // the decoys' 1954/1955 sit behind an axis break
    const live = meta.panelLive(st, input(E11_VIEW, E11, draft(SOLUTION.slice(0, 2), { focus: "n1", probe: 1963.34 })));
    const lf = live.liveCards.find((c) => c.kind === "timeline");
    if (!lf || lf.kind !== "timeline") throw new Error("expected live FILE");
    expect(lf.arrows).toEqual([{ fromKey: "node:n0", toKey: "node:n1" }, { fromKey: "node:n1", toKey: "node:n2" }]);
    expect(lf.pins.find((p) => p.key === "node:n1")!.style).toBe("focus");
    expect(lf.pins.find((p) => p.key === "node:d0")!.style).toBe("dim");
    expect(live.chips.map((c) => c.text)).toContain("2 / 4 TUBES");
    expect(live.chips[0]).toMatchObject({ slot: 0, color: "g" });
    expect(live.chips[0].text).toContain("MAY 1963");
    expect(live.readout).toBe("MAY 1963");
    const graph = live.liveCards.find((c) => c.kind === "cause_graph");
    if (!graph || graph.kind !== "cause_graph") throw new Error("expected graph");
    expect(graph.edges.map((e) => e.state)).toEqual(["focus", "focus"]);
    expect(live.highlights).toContainEqual({ slot: 1, key: "n1", state: "focus" });
  });
});

describe("cause_tubes meta · outcomes", () => {
  it("decoy: the decoy's fuse pops at its own housing, nothing else acts", () => {
    const d = pose(input(E5_VIEW, E5, draft([{ fromKey: "d0", toKey: "n1" }])));
    expect(d.housings.find((h) => h.key === "d0")).toBeDefined();
    const plan = meta.failurePlan(diag("decoy", ["d0"]), input(E5_VIEW, E5, draft(SOLUTION)));
    expect(plan.cue).toBe("fuse_pop");
    expect(plan.beats.every((b) => b.anchor === "node_d0")).toBe(true);
    expect(plan.beats.map((b) => b.action)).toEqual(["spark", "eject", "dim"]);
    expect(plan.durationMs).toBeGreaterThanOrEqual(600);
    expect(plan.durationMs).toBeLessThanOrEqual(1600);
    const ring = meta.failurePlan(diag("decoy", ["d1"]), input(E11_VIEW, E11, draft(SOLUTION)));
    expect(ring.beats.find((b) => b.action === "eject")!.params).toMatchObject({ what: "capsule" });
  });

  it("wrong link: the `from` housing sparks and its outgoing wire goes slack (dish droops on the mast, capsule jams on the board)", () => {
    const plan = meta.failurePlan(diag("wrong_link", ["n2"]), input(E5_VIEW, E5, draft(SOLUTION)));
    expect(plan.beats.every((b) => b.anchor === "node_n2")).toBe(true);
    expect(plan.beats.map((b) => b.action)).toEqual(["spark", "flash", "sink"]);
    expect(plan.beats[1].params).toMatchObject({ color: "amber" });
    const mast = meta.failurePlan(diag("wrong_link", ["n0"]), input(E6_VIEW, E6, draft(SOLUTION)));
    expect(mast.beats.find((b) => b.action === "tip")!.params).toMatchObject({ deg: 20 });
    const ring = meta.failurePlan(diag("wrong_link", ["n3"]), input(E11_VIEW, E11, draft(SOLUTION)));
    expect(ring.beats.map((b) => b.action)).toEqual(["jam", "dim"]);
    expect(ring.beats.every((b) => b.anchor === "node_n3")).toBe(true);
    // an unknown key falls back to the console, never to another housing
    expect(meta.failurePlan(diag("wrong_link", ["q9"]), input(E5_VIEW, E5, null)).beats.every((b) => b.anchor === "console")).toBe(true);
    expect(meta.failurePlan(diag("incomplete", []), input(E5_VIEW, E5, null)).beats).toEqual([{ atMs: 0, anchor: "gauge", action: "stall", params: {} }]);
  });

  it("success runs the carrier in causal order and lights each lamp as it arrives", () => {
    expect(causalOrder([{ fromKey: "n2", toKey: "n3" }, { fromKey: "n0", toKey: "n1" }, { fromKey: "n1", toKey: "n2" }])).toEqual(["n0", "n1", "n2", "n3"]);
    expect(causalOrder([])).toEqual([]);
    const plan = meta.successPlan(input(E5_VIEW, E5, draft(SOLUTION), { solved: true }), "gate_lifts");
    const ignites = plan.beats.filter((b) => b.action === "ignite" && b.anchor.startsWith("node_"));
    expect(ignites.map((b) => b.anchor)).toEqual(["node_n0", "node_n1", "node_n2", "node_n3", "node_n4"]);
    expect(ignites.map((b) => b.atMs)).toEqual([...ignites.map((b) => b.atMs)].sort((a, b) => a - b));
    expect(plan.beats.some((b) => b.anchor === "payoff" && b.action === "open")).toBe(true);
    expect(plan.durationMs).toBeGreaterThanOrEqual(1200);
    expect(plan.durationMs).toBeLessThanOrEqual(2500);
    const cap = meta.successPlan(input(E11_VIEW, E11, draft(SOLUTION), { solved: true }), "lift_moves");
    expect(cap.cue).toBe("tube_whoosh");
    expect(cap.beats[0]).toMatchObject({ action: "ride", params: { carrier: "capsule", path: "n0,n1,n2,n3,n4" } });
  });

  it("hint targets come from the skin; audio hums with the gauge on wires only", () => {
    expect(meta.hintTargets(1, staticIn(E5_VIEW, E5))[0].anchor).toBe("board");
    expect(meta.hintTargets(2, staticIn(E6_VIEW, E6, { skinId: "broadcast_relay" }))[0].anchor).toBe("lift");
    expect(meta.hintTargets(1, staticIn(E11_VIEW, E11, { skinId: "big_board" }))).toHaveLength(7);
    for (const s of CAUSE_TUBES_SKINS) {
      expect(s.sensitiveSafe).toBe(true);
      for (const rung of s.hintTargets) for (const h of rung) expect(s.anchors).toContain(h.anchor);
    }
    const half = pose(input(E5_VIEW, E5, draft(SOLUTION.slice(0, 2))));
    expect(meta.audio(half, input(E5_VIEW, E5, null))[0]).toMatchObject({ cue: "current_hum" });
    expect(meta.audio(pose(input(E11_VIEW, E11, draft(SOLUTION.slice(0, 2)))), input(E11_VIEW, E11, null))).toEqual([]);
    expect(meta.debug(half)).toMatchObject({ edges: 2, edgeCount: 4, gauge: 0.5 });
  });
});
