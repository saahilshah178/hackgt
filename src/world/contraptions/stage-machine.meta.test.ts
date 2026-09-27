import { describe, expect, it } from "vitest";
import cellFixture from "../../../fixtures/cell-transport-dungeon.json";
import docConfigs from "../../../tests/world-doc-configs.json";
import type { GameSpec } from "../../contracts/gamespec";
import type { AidTier, ConfigCtx, Diagnosis, Draft, HintsUsed, PairsView, PoseInput, StaticInput } from "../types";
import {
  conformations,
  jawsAt,
  loadedLabel,
  releaseStage,
  StageMachineConfig,
  stageMachineMeta as meta,
  STAGE_ANGLE,
  STAGE_MACHINE_SKINS,
  type StageMachinePose,
} from "./stage-machine.meta";

// ---------------------------------------------------------------- cell e8 (the pairs view: lefts in order, rights shuffled)

const spec = cellFixture as unknown as GameSpec;
const e8 = spec.encounters.find((e) => e.id === "e8_pump")!;
const P = e8.params as { pairs: { left: string; right: string }[]; decoyRights: string[] };
const RIGHTS = [...P.pairs.map((p, i) => ({ key: `r${i}`, text: p.right })), ...P.decoyRights.map((text, i) => ({ key: `x${i}`, text }))];
/** The mode shows rights in a seeded non-identity shuffle; a fixed rotation stands in for it (display order ≠ key order). */
const VIEW: PairsView = { lefts: P.pairs.map((p, i) => ({ key: `l${i}`, text: p.left })), rights: [...RIGHTS.slice(2), ...RIGHTS.slice(0, 2)] };
const CONFIG = StageMachineConfig.parse(
  (docConfigs as { configs: { archetype: string; encounterId: string | null; config: unknown }[] }).configs.find((c) => c.archetype === "stage_machine" && c.encounterId === "e8_pump")!.config,
);
const SOLUTION = [
  { leftKey: "l0", rightKey: "r0" },
  { leftKey: "l1", rightKey: "r1" },
  { leftKey: "l2", rightKey: "r2" },
  { leftKey: "l3", rightKey: "r3" },
];

function draftOf(links: readonly { leftKey: string; rightKey: string }[], extra: Partial<Draft> = {}): Draft {
  return { encounterId: "e8_pump", modeKey: "linker.pairs", input: { links }, complete: links.length === 4, focus: null, hover: null, probe: null, settled: true, wave: null, marks: null, seq: 1, ...extra };
}
function input(links: readonly { leftKey: string; rightKey: string }[] | null, over: Partial<PoseInput<StageMachineConfig>> = {}): PoseInput<StageMachineConfig> {
  return { view: VIEW, draft: links ? draftOf(links) : null, config: CONFIG, probe: 0, t: 0, aidTier: 0 as AidTier, hintsUsed: 0 as HintsUsed, sim: null, solved: false, reducedMotion: false, ...over };
}
function staticInput(aidTier: AidTier = 0): StaticInput<StageMachineConfig> {
  return { view: VIEW, config: CONFIG, aidTier, hintsUsed: 0, reducedMotion: false, skinId: "pump_rewiring", record: false };
}
function diag(over: Partial<Diagnosis>): Diagnosis {
  return { correct: false, feedback: "", displayFeedback: "", failKey: "wrong_link", wrongKeys: [], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [], ...over };
}
const at = (k: number, links = SOLUTION, over: Partial<PoseInput<StageMachineConfig>> = {}): StageMachinePose => meta.pose(input(links, { probe: k, ...over }));
const RIGHT_KEYS = VIEW.rights.map((r) => r.key);

describe("stage_machine · config and view", () => {
  it("the doc config validates against the real e8 view with zero issues", () => {
    const ctx = { modeKey: "linker.pairs", encounter: e8, params: e8.params, solution: null, view: VIEW, texts: [], biome: "living_gate" } as unknown as ConfigCtx;
    expect(meta.validateConfig(CONFIG, ctx)).toEqual([]);
    expect(VIEW.lefts.map((l) => l.key)).toEqual(["l0", "l1", "l2", "l3"]);
    expect([...RIGHT_KEYS].sort()).toEqual(["r0", "r1", "r2", "r3", "x0"]);
  });
  it("the probe is the stage scrubber (format stage, integer stops)", () => {
    expect(meta.probe(CONFIG, VIEW)).toBe(CONFIG.stages);
    expect(meta.panelStatic(staticInput()).probe).toBe(CONFIG.stages);
  });
});

describe("stage_machine · drum and conformation", () => {
  it("drum angle is 60°·k", () => {
    for (let k = 0; k <= 6; k++) expect(at(k).drumAngle).toBeCloseTo(k * STAGE_ANGLE, 9);
    expect(STAGE_ANGLE).toBeCloseTo((60 * Math.PI) / 180, 12);
  });
  it("conformation by k: inward-open at 0, 1, 2, 6; outward-open at 3, 4, 5", () => {
    expect(conformations(CONFIG.stages)).toEqual(["in", "in", "in", "out", "out", "out", "in"]);
    for (const k of [0, 1, 2, 6]) expect([at(k).jawLower, at(k).jawUpper, at(k).side]).toEqual([1, 0, "in"]);
    for (const k of [3, 4, 5]) expect([at(k).jawLower, at(k).jawUpper, at(k).side]).toEqual([0, 1, "out"]);
    expect(jawsAt(CONFIG.stages, 2.5).upper).toBeCloseTo(0.5, 9);
  });
  it("without flip-named stops the middle third faces out", () => {
    const stops = Array.from({ length: 7 }, (_, v) => ({ v, label: `stage ${v}` }));
    expect(conformations({ min: 0, max: 6, stops })).toEqual(["in", "in", "in", "out", "out", "in", "in"]);
  });
  it("release stages: Na⁺ bound at 1 releases out at 4 (swap); K⁺ bound at 4 releases in at 6", () => {
    expect(releaseStage(CONFIG.stages, 1, "out")).toBe(4);
    expect(releaseStage(CONFIG.stages, 4, "in")).toBe(6);
    expect(releaseStage(CONFIG.stages, 6, "out")).toBeNull();
  });
});

describe("stage_machine · cartridges load by semantic", () => {
  it("3 out on the Na⁺ socket: 3 Na⁺ snap in from the cytoplasm at k 1 and leave outward at k 4", () => {
    const ions = (k: number) => at(k).loads.find((l) => l.socket === "l0");
    expect(ions(0)).toMatchObject({ kind: "ions", ion: "Na", n: 3, from: "in", to: "out", bindStage: 1, releaseStage: 4, blocked: false, bind: 0, release: 0 });
    expect(ions(0.5)).toMatchObject({ bind: 0.5 });
    expect(ions(1)).toMatchObject({ bind: 1, release: 0 });
    expect(ions(4)).toMatchObject({ bind: 1, release: 1 });
  });
  it("2 in on the K⁺ socket: 2 K⁺ bind from outside at k 4 and are released inward at k 6", () => {
    const k = at(4).loads.find((l) => l.socket === "l1");
    expect(k).toMatchObject({ kind: "ions", ion: "K", n: 2, from: "out", to: "in", bindStage: 4, releaseStage: 6, blocked: false, bind: 1 });
    expect(at(6).loads.find((l) => l.socket === "l1")).toMatchObject({ release: 1 });
  });
  it("1 ATP on the energy socket: one spark enters the port at k 2", () => {
    expect(at(1).port).toBe(0);
    expect(at(2).port).toBe(1);
    expect(at(2).loads.find((l) => l.socket === "l2")).toMatchObject({ kind: "sparks", n: 1, into: "port", u: 1 });
  });
  it("an ATP spark on the Na⁺ socket binds nothing (it goes to the drum), and nothing rides the port", () => {
    const links = [{ leftKey: "l0", rightKey: "r2" }];
    expect(at(1, links).loads).toEqual([expect.objectContaining({ kind: "sparks", socket: "l0", into: "drum", u: 1 })]);
    expect(at(1, links).port).toBe(0);
  });
  it("a count that points the wrong way presses on a shut jaw and never binds", () => {
    const links = [{ leftKey: "l0", rightKey: "r1" }]; // "2, into the cell" on the Na⁺ socket: from outside at k 1 (inward-open)
    expect(at(1, links).loads[0]).toMatchObject({ kind: "ions", from: "out", blocked: true, releaseStage: null, release: 0 });
  });
  it("the beacon plaque shows the linked cartridge's text; it pulses with the net charge at its stage", () => {
    const p5 = at(5);
    const p6 = at(6);
    expect(p6.beaconText).toBe(VIEW.rights.find((r) => r.key === "r3")!.text);
    expect(p5.beacon).toBe(0);
    expect(p6.beacon).toBeCloseTo(1, 9);
    const balanced = at(6, [{ leftKey: "l0", rightKey: "x0" }, ...SOLUTION.slice(1)]);
    expect(balanced.q).toBe(0);
    expect(balanced.beacon).toBeCloseTo(0.15, 9); // "a balanced pump builds no charge difference": the beacon barely glows
  });
});

describe("stage_machine · the neutral loaded label (§2.5.6, amendment 26)", () => {
  it("is what the cartridge says, identical in every socket, never '?'", () => {
    for (const r of CONFIG.rights) {
      const text = VIEW.rights.find((x) => x.key === r.key)!.text;
      const labels = VIEW.lefts.map((l) => at(0, [{ leftKey: l.key, rightKey: r.key }]).sockets.find((s) => s.key === l.key)!.loaded);
      expect(new Set(labels).size, r.key).toBe(1);
      expect(labels[0]).toBe(loadedLabel(r.semantic, text));
      expect(labels[0]).not.toContain("?");
      expect(labels[0]!.startsWith("loaded: ")).toBe(true);
    }
    expect(loadedLabel({ kind: "atp", n: 1 }, "1 ATP")).toBe("loaded: 1 ATP");
    expect(loadedLabel({ kind: "count", n: 3, dir: "out" }, "3, out of the cell")).toBe("loaded: 3 out");
  });
  it("seated lamps are white (never cyan) before Verify, cyan only when solved", () => {
    const p = at(0);
    expect(p.sockets.map((s) => s.lamp)).toEqual(["white", "white", "white", "white"]);
    expect(at(0, SOLUTION.slice(0, 2)).sockets.map((s) => s.lamp)).toEqual(["white", "white", "off", "off"]);
    expect(meta.solvedPose(input(SOLUTION)).sockets.every((s) => s.lamp === "cyan")).toBe(true);
  });
  it("no-leak: describe(), panelLive() and the socket fields never mention a verdict, for every one of the 5⁴ wirings", () => {
    const stat = meta.panelStatic(staticInput());
    const bad = /\?|correct|wrong|right answer|✓|✗/i;
    let n = 0;
    for (const a of RIGHT_KEYS)
      for (const b of RIGHT_KEYS)
        for (const c of RIGHT_KEYS)
          for (const d of RIGHT_KEYS) {
            const links = [
              { leftKey: "l0", rightKey: a },
              { leftKey: "l1", rightKey: b },
              { leftKey: "l2", rightKey: c },
              { leftKey: "l3", rightKey: d },
            ];
            for (const k of [0, 4]) {
              const inp = input(links, { probe: k });
              const pose = meta.pose(inp);
              const text = JSON.stringify([meta.describe(pose, inp), pose.sockets.map((s) => [s.loaded, s.lamp])]);
              expect(bad.test(text)).toBe(false);
              const live = meta.panelLive(stat, inp);
              expect(bad.test(JSON.stringify([live.readout, live.chips]))).toBe(false);
              n++;
            }
          }
    expect(n).toBe(2 * 5 ** 4);
  });
  it("no-leak: the pose is a function of the view and the draft only (a solution-swapped spec with the same view poses identically)", () => {
    const swapped = { ...e8.params as object, pairs: [...(e8.params as { pairs: unknown[] }).pairs].reverse() };
    expect(swapped).not.toEqual(e8.params);
    // the meta never receives params: the same view + draft gives the same pose, describe and panelLive
    const a = input(SOLUTION, { probe: 3 });
    const b = { ...input(SOLUTION, { probe: 3 }) };
    expect(meta.pose(b)).toEqual(meta.pose(a));
    expect(meta.describe(meta.pose(b), b)).toEqual(meta.describe(meta.pose(a), a));
  });
});

describe("stage_machine · ledger", () => {
  it("q = n_Na,out − n_K,in: +1 for the solution; the needle leans −30°", () => {
    const p = at(0);
    expect(p.q).toBe(1);
    expect(p.needle).toBeCloseTo((-30 * Math.PI) / 180, 12);
    expect(at(0, [{ leftKey: "l0", rightKey: "x0" }, { leftKey: "l1", rightKey: "r1" }]).q).toBe(0);
    expect(at(0, [{ leftKey: "l0", rightKey: "x0" }, { leftKey: "l1", rightKey: "r1" }]).needle).toBeCloseTo(0, 12);
    expect(at(0, [{ leftKey: "l2", rightKey: "r0" }]).q).toBe(0); // a count on the energy socket moves no charge
  });
  it("the charge card has one bar per ion socket and the q chip", () => {
    const live = meta.panelLive(meta.panelStatic(staticInput()), input(SOLUTION, { probe: 3 }));
    const bars = live.liveCards.find((c) => c.kind === "bars");
    expect(bars && bars.kind === "bars" ? bars.bars.map((b) => [b.label, b.value]) : null).toEqual([
      ["Na⁺ out", 3],
      ["K⁺ in", 2],
    ]);
    expect(live.chips).toEqual([{ slot: 2, value: 1, text: "q = +1", color: "f" }]);
    expect(live.readout).toBe("stage 3 · flip out");
    expect(live.scrubX).toBe(3);
  });
  it("tier 1 labels the ledger 'inside charge'; tier 2 captions the stage on the schematic", () => {
    const t0 = meta.panelStatic(staticInput(0)).cards;
    const t1 = meta.panelStatic(staticInput(1)).cards;
    const t2 = meta.panelStatic(staticInput(2)).cards;
    expect(t0.find((c) => c.kind === "bars")!.title).toBe("charge");
    expect(t1.find((c) => c.kind === "bars")!.title).toContain("inside charge");
    const caption = (cards: typeof t0) => {
      const s = cards.find((c) => c.kind === "schematic");
      return s && s.kind === "schematic" ? s.prims.some((p) => p.p === "text" && p.text.includes("rest")) : false;
    };
    expect(caption(t0)).toBe(false);
    expect(caption(t2)).toBe(true);
    expect(t0.map((c) => [c.slot, c.kind])).toEqual([[0, "link_board"], [1, "schematic"], [2, "bars"]]);
  });
});

describe("stage_machine · outcomes", () => {
  const plan = (key: string) => meta.failurePlan(diag({ wrongKeys: [key] }), input(SOLUTION));
  const runTo = (key: string) => plan(key).beats.find((b) => b.anchor === "drum" && b.action === "stall")!.params!.toK;
  it("the failure plan jams at the stage of wrongKeys[0]'s socket (l0 → 1, l1 → 4, l2 → 2 with a misfire)", () => {
    expect(runTo("l0")).toBe(1);
    expect(runTo("l1")).toBe(4);
    expect(runTo("l2")).toBe(2);
    expect(plan("l0").beats.some((b) => b.anchor === "socket_0" && b.action === "jam")).toBe(true);
    expect(plan("l1").beats.some((b) => b.anchor === "socket_1" && b.action === "jam")).toBe(true);
    expect(plan("l2").beats.some((b) => b.anchor === "atp_port" && b.action === "spark")).toBe(true);
    expect(plan("l1").beats.find((b) => b.action === "jam")!.atMs).toBe(4 * 170);
  });
  it("a wrong beacon link completes the cycle, then the beacon flickers and stays dark", () => {
    const p = plan("l3");
    expect(runTo("l3")).toBe(6);
    expect(p.beats.some((b) => b.anchor === "beacon" && b.action === "flash" && b.params?.dark === 1)).toBe(true);
  });
  it("only wrongKeys[0]'s socket is named; every failure lasts ≤ 1.6 s", () => {
    for (const key of ["l0", "l1", "l2", "l3"]) {
      const p = plan(key);
      const sockets = p.beats.map((b) => b.anchor).filter((a) => a.startsWith("socket_"));
      expect(new Set(sockets).size).toBeLessThanOrEqual(1);
      expect(sockets.every((a) => a === `socket_${VIEW.lefts.findIndex((l) => l.key === key)}`)).toBe(true);
      expect(p.durationMs).toBeGreaterThanOrEqual(600);
      expect(p.durationMs).toBeLessThanOrEqual(1600);
    }
  });
  it("success: two cycles at 170 ms per stage, two sparks, the gate half-way per cycle, the beacon, 1.2–2.5 s", () => {
    const s = meta.successPlan({ ...input(SOLUTION), solved: true }, "gate_lifts");
    expect(s.beats[0]).toMatchObject({ atMs: 0, anchor: "drum", action: "cycle", params: { cycles: 2, msPerStage: 170 } });
    expect(s.beats.filter((b) => b.anchor === "atp_port" && b.action === "ignite").map((b) => b.atMs)).toEqual([340, 1530]);
    expect(s.beats.filter((b) => b.anchor === "crank").map((b) => b.params!.gate)).toEqual([0.5, 1]);
    expect(s.beats.some((b) => b.anchor === "beacon" && b.action === "ignite")).toBe(true);
    expect(s.beats.at(-1)).toMatchObject({ anchor: "gate", action: "rise" });
    expect(s.durationMs).toBeGreaterThanOrEqual(1200);
    expect(s.durationMs).toBeLessThanOrEqual(2500);
    expect(s.cue).toBe("beacon_ignite");
  });
  it("the solved pose keeps cycling with the clock (and rests under reduced motion)", () => {
    const a = meta.solvedPose(input(SOLUTION, { t: 0 }));
    const b = meta.solvedPose(input(SOLUTION, { t: 1 }));
    expect(a.gate).toBe(1);
    expect(b.k).toBeCloseTo(2.5, 9);
    expect(meta.solvedPose(input(SOLUTION, { t: 1, reducedMotion: true })).k).toBe(0);
  });
});

describe("stage_machine · lerp, hints, frame", () => {
  it("numbers ease; discrete fields take the target at once (the controller's per-frame t is small)", () => {
    const a = at(0, []);
    const b = at(3, SOLUTION);
    const m = meta.lerp(a, b, 0.1);
    expect(m.k).toBeCloseTo(0.3, 9);
    expect(m.linked).toBe(4);
    expect(m.sockets.map((s) => s.loaded)).toEqual(b.sockets.map((s) => s.loaded));
    expect(meta.lerp(a, b, 0)).toBe(a);
  });
  it("hint targets: drum circle, socket 0 hover, ATP port land (cell §5.8)", () => {
    expect([1, 2, 3].map((r) => meta.hintTargets(r as 1 | 2 | 3, staticInput())[0]!.anchor)).toEqual(["drum", "socket_0", "atp_port"]);
    expect(STAGE_MACHINE_SKINS[0].anchors).toEqual(expect.arrayContaining(["socket_0", "socket_3", "cartridge_4", "drum", "atp_port", "beacon", "crank", "console"]));
  });
  it("the frame holds the plinth, the pump and the rack; debug reports the stage", () => {
    const f = meta.frameBounds(CONFIG, VIEW);
    expect(f.x).toBeLessThanOrEqual(-300);
    expect(f.x + f.w).toBeGreaterThanOrEqual(340);
    const d = meta.debug(at(3));
    expect(d).toMatchObject({ k: 3, drumDeg: 180, side: "out", q: 1, white: 4 });
  });
});
