import { describe, expect, it } from "vitest";
import cellFixture from "../../../fixtures/cell-transport-dungeon.json";
import docConfigs from "../../../tests/world-doc-configs.json";
import { hasErrors } from "./config-parts";
import type { AidTier, Diagnosis, Draft, PoseInput, StaticInput, TypeMatchView } from "../types";
import {
  answersOf,
  basinXY,
  cellAnchor,
  cellX,
  claimedOutDots,
  eddyXY,
  fateShape,
  flowMode,
  plaqueText,
  SLUICE_LAYOUT,
  SLUICE_WAVES_SKINS,
  SluiceWavesConfig,
  sluiceWavesMeta as meta,
  valveAngle,
  valveFate,
  valvePlaqueXY,
  type SluiceWavesPose,
} from "./sluice-waves.meta";

// ---------------------------------------------------------------- fixtures → views (waves are never shuffled)

type FixtureEncounter = {
  id: string;
  prompt: string;
  hints: string[];
  params: { categories: { id: string; label: string }[]; waves: { text: string; categoryId: string }[]; secondsPerWave: number };
};
function encounter(id: string): FixtureEncounter {
  const e = (cellFixture.encounters as unknown as FixtureEncounter[]).find((x) => x.id === id);
  if (!e) throw new Error(id);
  return e;
}
function viewOf(e: FixtureEncounter): TypeMatchView {
  return {
    categories: e.params.categories.map((c) => ({ id: c.id, label: c.label })),
    waves: e.params.waves.map((w, waveIndex) => ({ waveIndex, text: w.text })),
    secondsPerWave: e.params.secondsPerWave,
  };
}
function docConfig(id: string): SluiceWavesConfig {
  const c = (docConfigs as { configs: { archetype: string; encounterId: string | null; config: unknown }[] }).configs.find(
    (x) => x.archetype === "sluice_waves" && x.encounterId === id,
  );
  if (!c) throw new Error(id);
  return SluiceWavesConfig.parse(c.config);
}
const STATIONS = {
  e5: { e: encounter("e5_tonicity"), config: docConfig("e5_tonicity") },
  e9: { e: encounter("e9_osmosis_review"), config: docConfig("e9_osmosis_review") },
} as const;
type StationKey = keyof typeof STATIONS;
const solution = (k: StationKey) => STATIONS[k].e.params.waves.map((w, waveIndex) => ({ waveIndex, categoryId: w.categoryId }));

function draftOf(answers: readonly { waveIndex: number; categoryId: string }[], extra: Partial<Draft> = {}): Draft {
  return {
    encounterId: "x",
    modeKey: "sorter.type_match",
    input: { answers },
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
const wave = (index: number, secondsLeft: number) => ({ index, secondsLeft, secondsPerWave: 8 });
function poseInput(k: StationKey, draft: Draft | null, over: Partial<PoseInput<SluiceWavesConfig, null>> = {}): PoseInput<SluiceWavesConfig, null> {
  const s = STATIONS[k];
  return { view: viewOf(s.e), draft, config: s.config, probe: null, t: 2, aidTier: 0, hintsUsed: 0, sim: null, solved: false, reducedMotion: false, ...over };
}
function staticInput(k: StationKey, aidTier: AidTier = 0): StaticInput<SluiceWavesConfig> {
  return { view: viewOf(STATIONS[k].e), config: STATIONS[k].config, aidTier, hintsUsed: 0, reducedMotion: false, skinId: "tonicity_sluices", record: false };
}
function diagnosis(over: Partial<Diagnosis>): Diagnosis {
  return { correct: false, feedback: "", displayFeedback: "", failKey: "wrong_wave", wrongKeys: [], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [], ...over };
}
const cellOf = (p: SluiceWavesPose, waveIndex: number) => p.cells.find((c) => c.waveIndex === waveIndex)!;

// ---------------------------------------------------------------- tests

describe("sluice_waves meta · configuration", () => {
  it("both doc configs validate with zero errors; showFate false with a fate is an error", () => {
    for (const k of ["e5", "e9"] as const) {
      const s = STATIONS[k];
      const ctx = {
        modeKey: "sorter.type_match" as const,
        encounter: s.e as never,
        params: s.e.params,
        solution: { answers: s.e.params.waves.map((w) => w.categoryId) },
        view: viewOf(s.e),
        texts: [],
        biome: "living_gate",
      };
      expect(hasErrors(meta.validateConfig(s.config, ctx))).toBe(false);
      const leaky = { ...STATIONS.e9.config, waves: STATIONS.e9.config.waves.map((w, i) => (i === 0 ? { ...w, fate: "shrink" as const } : w)) };
      if (k === "e9") expect(hasErrors(meta.validateConfig(leaky, ctx))).toBe(true);
    }
  });

  it("replaces the slate placeholder and keeps the skin contract (hint anchors are skin anchors)", () => {
    const pose = meta.pose(poseInput("e5", null)) as unknown as Record<string, unknown>;
    expect(pose).toHaveProperty("cells");
    expect(pose).not.toHaveProperty("slate");
    const skin = SLUICE_WAVES_SKINS[0];
    expect(skin.anchors).toEqual(["lock", "basin_0", "basin_1", "basin_2", "eddy", "valve", "barge_deck", "console"]);
    for (const rung of skin.hintTargets) for (const t of rung) expect(skin.anchors).toContain(t.anchor);
    expect(skin.parts.map((p) => p.slot)).toEqual(expect.arrayContaining(["cell_protoplast", "lock_leaf", "valve_wheel"]));
    expect(meta.hintTargets(1, staticInput("e5"))).toEqual([{ anchor: "lock", action: "hover", holdMs: 1800 }]);
    expect(meta.hintTargets(3, staticInput("e9"))[0]).toMatchObject({ anchor: "valve", action: "land" });
  });
});

describe("sluice_waves meta · the wave rules", () => {
  it("cell x follows the wave timer: X_in + (1 − secondsLeft/T)·(X_out − X_in)", () => {
    const L = SLUICE_LAYOUT;
    expect(cellX(8, 8)).toBe(L.canalIn.x);
    expect(cellX(0, 8)).toBe(L.lock.x);
    expect(cellX(4, 8)).toBeCloseTo((L.canalIn.x + L.lock.x) / 2, 9);
    expect(cellX(12, 8)).toBe(L.canalIn.x); // clamped
    for (const s of [8, 6.5, 3.2, 0.4]) {
      const p = meta.pose(poseInput("e5", draftOf([], { wave: wave(0, s) })));
      expect(cellOf(p, 0).x).toBeCloseTo(cellX(s, 8), 9);
      expect(cellOf(p, 0).place).toBe("lock");
      expect(p.progress).toBeCloseTo(1 - s / 8, 9);
    }
    // the idle pose waits at the canal mouth with the rest queued upstream
    const idle = meta.pose(poseInput("e5", null));
    expect(cellOf(idle, 0)).toMatchObject({ place: "lock", x: SLUICE_LAYOUT.canalIn.x });
    expect(idle.cells.slice(1).every((c) => c.place === "upcoming" && c.x < SLUICE_LAYOUT.canalIn.x)).toBe(true);
    expect(idle.cells.filter((c) => c.visible).length).toBe(1 + SLUICE_LAYOUT.queueMax);
  });

  it("committed waves sit in their valve's basin, timed-out waves spin in the eddy, later waves wait upstream", () => {
    // wave 0 committed to hypertonic, wave 1 timed out (no answer), wave 2 running
    const d = draftOf([{ waveIndex: 0, categoryId: "hypertonic" }], { wave: wave(2, 5) });
    const p = meta.pose(poseInput("e5", d));
    expect(cellOf(p, 0)).toMatchObject({ place: "basin", valve: 2, tag: "hypertonic", ...basinXY(2) });
    expect(cellOf(p, 1)).toMatchObject({ place: "eddy", valve: null, ...eddyXY(3) });
    expect(cellOf(p, 1).spin).not.toBe(0);
    expect(cellOf(p, 2).place).toBe("lock");
    expect(cellOf(p, 3).place).toBe("upcoming");
    expect(p.answered).toBe(1);
    expect(meta.pose(poseInput("e5", d, { reducedMotion: true })).cells[1]!.spin).toBe(0);
    // after the last wave (the wave channel is null and the draft is complete)
    const done = meta.pose(poseInput("e5", draftOf(solution("e5").slice(0, 4), { complete: true })));
    expect(done.done).toBe(true);
    expect(done.current).toBeNull();
    expect(cellOf(done, 4).place).toBe("eddy");
    expect(done.claim).toBeNull();
  });

  it("hover (or the focused valve) renders the claimed bath ρ_out = ρ_in·k and turns the wheel; e5 never draws arrows", () => {
    expect(claimedOutDots(10, 2.5)).toBe(25);
    const n = STATIONS.e5.config.valves.length;
    STATIONS.e5.config.valves.forEach((v, j) => {
      for (const channel of ["hover", "focus"] as const) {
        const p = meta.pose(poseInput("e5", draftOf([], { wave: wave(0, 6), [channel]: v.categoryId })));
        expect(p.claim).toBe(j);
        expect(p.bathClaim).toBe(true);
        expect(p.bathDots).toBe(Math.round(10 * v.densityK!));
        expect(p.arrows).toBe("none");
        expect(p.wheelAngle).toBeCloseTo(valveAngle(j, n), 9);
      }
    });
    expect(valveAngle(0, 3)).toBeCloseTo(-Math.PI / 3, 9);
    expect(valveAngle(2, 3)).toBeCloseTo(Math.PI / 3, 9);
    expect(valvePlaqueXY(1, 3)).toEqual({ x: SLUICE_LAYOUT.valve.x, y: SLUICE_LAYOUT.valve.y - SLUICE_LAYOUT.valveR });
    // hover beats focus; with neither the bath shows the wave's stated outside
    const both = meta.pose(poseInput("e5", draftOf([], { wave: wave(0, 6), hover: "isotonic", focus: "hypertonic" })));
    expect(both.claimId).toBe("isotonic");
    const none = meta.pose(poseInput("e5", draftOf([], { wave: wave(1, 6) })));
    expect(none).toMatchObject({ claim: null, bathClaim: false, bathDots: 30, insideDots: 10 });
  });

  it("e9 hover draws the claimed flow arrows over the stated dots", () => {
    expect(flowMode(STATIONS.e9.config)).toBe(true);
    expect(flowMode(STATIONS.e5.config)).toBe(false);
    for (const [cat, arrows] of [["in", "in"], ["out", "out"], ["none", "both"]] as const) {
      const p = meta.pose(poseInput("e9", draftOf([], { wave: wave(0, 7), hover: cat })));
      expect(p.arrows).toBe(arrows);
      expect(p.bathClaim).toBe(false);
      expect(p.bathDots).toBe(40); // the text states the 10 % bath
    }
    const live = meta.panelLive(meta.panelStatic(staticInput("e9")), poseInput("e9", draftOf([], { wave: wave(0, 7), hover: "out" })));
    const flow = live.liveCards.find((c) => c.slot === 2);
    expect(flow).toMatchObject({ kind: "bars", title: "claimed flow", arrow: "out" });
  });

  it("showFate: false keeps V = 1 before Verify; showFate: true animates the stated fate with the timer", () => {
    for (let i = 0; i < 4; i++) {
      for (const s of [8, 4, 0.1]) {
        for (const hover of [null, "in", "out", "none"]) {
          const p = meta.pose(poseInput("e9", draftOf(solution("e9").slice(0, i), { wave: wave(i, s), hover })));
          for (const c of p.cells) expect([c.volume, c.protoplast, c.crenate, c.strain]).toEqual([1, 1, 0, 0]);
        }
      }
    }
    const done9 = meta.pose(poseInput("e9", draftOf(solution("e9"), { complete: true })));
    for (const c of done9.cells) expect(c.volume).toBe(1);
    // e5 w0 "swelling": V(t) = 1 + 0.45·(1 − s/T)
    const half = meta.pose(poseInput("e5", draftOf([], { wave: wave(0, 4) })));
    expect(cellOf(half, 0).volume).toBeCloseTo(1 + 0.45 * 0.5, 9);
    const w3 = meta.pose(poseInput("e5", draftOf(solution("e5").slice(0, 3), { wave: wave(3, 0) })));
    expect(cellOf(w3, 3)).toMatchObject({ volume: 1 });
    expect(cellOf(w3, 3).protoplast).toBeCloseTo(0.7, 9); // plasmolysis: the protoplast pulls from the wall
    expect(fateShape("strain", 1)).toMatchObject({ volume: 1.55, strain: 1 });
    expect(fateShape("shrink", 1)).toMatchObject({ crenate: 1 });
    expect(fateShape(null, 1)).toEqual({ volume: 1, protoplast: 1, crenate: 0, strain: 0 });
  });

  it("the pose, describe and panelLive never read hidden fates or the answer (no-leak)", () => {
    // e9 with a (validator-illegal) fate smuggled in under showFate: false changes nothing live
    const smuggled: SluiceWavesConfig = { ...STATIONS.e9.config, waves: STATIONS.e9.config.waves.map((w) => ({ ...w, fate: "swell" as const })) };
    const drafts = [null, draftOf([], { wave: wave(0, 3), hover: "in" }), draftOf(solution("e9").slice(0, 2), { wave: wave(2, 1) }), draftOf(solution("e9"), { complete: true })];
    for (const d of drafts) {
      for (const aidTier of [0, 1, 2] as const) {
        const a = poseInput("e9", d, { aidTier });
        const b = { ...a, config: smuggled };
        expect(meta.pose(b)).toEqual(meta.pose(a));
        expect(meta.describe(meta.pose(b), b)).toEqual(meta.describe(meta.pose(a), a));
        const st = meta.panelStatic(staticInput("e9", aidTier));
        expect(meta.panelLive(st, b)).toEqual(meta.panelLive(st, a));
      }
    }
    // chips name valves (plaques) and, only when the text states the fate, the running cell's volume
    const d5 = meta.describe(meta.pose(poseInput("e5", draftOf([], { wave: wave(0, 4), focus: "hypotonic" }))), poseInput("e5", null));
    expect(d5.chips.map((c) => c.text)).toEqual(["HYPO", "ISO", "HYPER", "V: 123%"]);
    const d9 = meta.describe(meta.pose(poseInput("e9", draftOf([], { wave: wave(0, 4) }))), poseInput("e9", null));
    expect(d9.chips.map((c) => c.text)).toEqual(["IN", "OUT", "NONE"]);
    for (const c of [...d5.chips, ...d9.chips]) expect(c.text).not.toMatch(/correct|right|wrong|✓|✗/i);
    expect(plaqueText("hypertonic")).toBe("HYPER");
  });

  it("retry preselection: the replay starts at wave 1 with every cell upstream and the preselected valve claimed", () => {
    // WaveControl.retry → answers [], index 0, focus = the previous answer for wave 0
    const retry = meta.pose(poseInput("e5", draftOf([], { wave: wave(0, 8), focus: "hypotonic" })));
    expect(retry.current).toBe(0);
    expect(retry.claimId).toBe("hypotonic");
    expect(retry.cells.filter((c) => c.place === "basin" || c.place === "eddy")).toEqual([]);
    expect(retry.answered).toBe(0);
    // the leaf opens just after a commit, then shuts as the next wave drifts in
    const justCommitted = meta.pose(poseInput("e5", draftOf([{ waveIndex: 0, categoryId: "hypotonic" }], { wave: wave(1, 7.9) })));
    expect(justCommitted.leaf).toBe(1);
    expect(meta.pose(poseInput("e5", draftOf([{ waveIndex: 0, categoryId: "hypotonic" }], { wave: wave(1, 5) }))).leaf).toBe(0);
    expect(answersOf(draftOf([{ waveIndex: 1, categoryId: "a" }, { waveIndex: 1, categoryId: "b" }]))).toEqual(new Map([[1, "b"]]));
  });
});

describe("sluice_waves meta · outcomes and panel", () => {
  it("the failure plan returns only the wave in wrongKeys[0]: it floats back, its tag blinks, the disclosed bath shows", () => {
    for (const k of ["e5", "e9"] as const) {
      const sol = solution(k);
      sol.forEach((a, i) => {
        const wrong = sol.map((x) => (x.waveIndex === i ? { ...x, categoryId: STATIONS[k].config.valves.find((v) => v.categoryId !== x.categoryId)!.categoryId } : x));
        const d = diagnosis({ wrongKeys: [`w${i}`], disclosed: { category: a.categoryId } });
        const plan = meta.failurePlan(d, poseInput(k, draftOf(wrong, { complete: true })));
        expect(plan.beats.length).toBeGreaterThanOrEqual(2);
        for (const b of plan.beats) {
          expect(b.anchor).toBe(cellAnchor(i));
          expect(b.params?.wave).toBe(i);
        }
        expect(plan.beats[0]!.action).toBe("spit_back");
        expect(plan.beats[1]!.action).toBe("flash");
        const shown = plan.beats.find((b) => b.action === "hold_bright")!;
        expect(shown.params?.valve).toBe(STATIONS[k].config.valves.findIndex((v) => v.categoryId === a.categoryId));
        expect(plan.durationMs).toBeGreaterThanOrEqual(600);
        expect(plan.durationMs).toBeLessThanOrEqual(1600);
      });
    }
    // e5 w1 is hypertonic: the disclosed bath is 10·2.5 = 25 dots and the stated fate (shrink) plays
    const e5 = meta.failurePlan(diagnosis({ wrongKeys: ["w1"], disclosed: { category: "hypertonic" } }), poseInput("e5", null));
    expect(e5.beats[2]!.params).toMatchObject({ dots: 25, fate: "shrink" });
    // e9 w3 (potato, "out"): the disclosed category implies plasmolysis for a walled cell
    const e9 = meta.failurePlan(diagnosis({ wrongKeys: ["w3"], disclosed: { category: "out" } }), poseInput("e9", null));
    expect(e9.beats[2]!.params).toMatchObject({ fate: "plasmolysis" });
    // anything else flashes the lock and names no cell
    const other = meta.failurePlan(diagnosis({ failKey: "incomplete", wrongKeys: [] }), poseInput("e5", null));
    expect(other.beats.every((b) => !b.anchor.startsWith("cell_"))).toBe(true);
  });

  it("valveFate derives the claim's fate from densityK or arrows (walled cells plasmolyse)", () => {
    const [hypo, iso, hyper] = STATIONS.e5.config.valves;
    expect(valveFate(hypo, "rbc")).toBe("swell");
    expect(valveFate(iso, "generic")).toBe("steady");
    expect(valveFate(hyper, "generic")).toBe("shrink");
    expect(valveFate(hyper, "plant")).toBe("plasmolysis");
    const [vin, vout, vnone] = STATIONS.e9.config.valves;
    expect([valveFate(vin, "generic"), valveFate(vout, "generic"), valveFate(vnone, "rbc"), valveFate(vout, "potato")]).toEqual(["swell", "shrink", "steady", "plasmolysis"]);
    expect(valveFate(undefined, "generic")).toBeNull();
  });

  it("the success plan plays every true fate from the solution draft, then drains (e5) or fills (e9)", () => {
    const p5 = meta.successPlan(poseInput("e5", draftOf(solution("e5"), { complete: true }), { solved: true }), "steps_emerge");
    expect(p5.durationMs).toBeGreaterThanOrEqual(1200);
    expect(p5.durationMs).toBeLessThanOrEqual(2500);
    expect(p5.beats.filter((b) => b.action === "cycle").map((b) => b.params?.fate)).toEqual(["swell", "shrink", "steady", "plasmolysis", "strain"]);
    expect(p5.beats.find((b) => b.action === "drain")).toMatchObject({ anchor: "lock", params: { depth: SLUICE_LAYOUT.drainDepth } });
    const p9 = meta.successPlan(poseInput("e9", draftOf(solution("e9"), { complete: true }), { solved: true }), "water_rises");
    expect(p9.beats.filter((b) => b.action === "cycle").map((b) => b.params?.fate)).toEqual(["shrink", "swell", "steady", "plasmolysis"]);
    expect(p9.beats.find((b) => b.action === "rise")).toMatchObject({ anchor: "barge_deck" });
    expect(p9.cue).toBe("sluice_drain");
  });

  it("solvedPose: cells in their basins with their fates, water through, lock open; re-entry without a draft shows none", () => {
    const s = meta.solvedPose(poseInput("e9", draftOf(solution("e9"), { complete: true }), { solved: true }));
    expect(s).toMatchObject({ solved: true, water: 1, leaf: 1, done: true, current: null });
    expect(cellOf(s, 1)).toMatchObject({ place: "basin", valve: 0 });
    expect(cellOf(s, 1).volume).toBeCloseTo(1.45, 9);
    expect(cellOf(s, 3).protoplast).toBeCloseTo(0.7, 9);
    const bare = meta.solvedPose(poseInput("e5", null, { solved: true }));
    expect(bare.cells.every((c) => !c.visible)).toBe(true);
    expect(meta.describe(bare, poseInput("e5", null)).srText).toMatch(/emptied/);
  });

  it("panel: solute outside (claim, white), solute inside (green), volume sparkline with a white timer; tier labels", () => {
    const st = meta.panelStatic(staticInput("e5"));
    expect(st.cards.map((c) => [c.slot, c.kind, "title" in c ? c.title : ""])).toEqual([
      [0, "bars", "solute outside"],
      [1, "bars", "solute inside"],
      [2, "bars", "volume V(t)"],
    ]);
    expect(st.input).toBeNull();
    expect(st.probe).toBeNull();
    const live = meta.panelLive(st, poseInput("e5", draftOf([], { wave: wave(0, 2), focus: "hypertonic" })));
    const [out, inside, vol] = live.liveCards as Extract<(typeof live.liveCards)[number], { kind: "bars" }>[];
    expect(out!.bars[0]).toMatchObject({ value: 25, color: "f", label: "claimed" });
    expect(inside!.bars[0]).toMatchObject({ value: 10, color: "g" });
    expect(out!.bars[0]!.max).toBe(inside!.bars[0]!.max); // one scale for both gauges
    expect(vol!.timer).toEqual({ fraction: 0.75 });
    expect(vol!.sparkline!.points.length).toBe(13);
    expect(vol!.sparkline!.points.at(-1)).toBeCloseTo(1 + 0.45 * 0.75, 9);
    expect(live.readout).toBe("wave 1 of 5");
    expect(live.scrubX).toBeNull();
    const t1 = meta.panelLive(meta.panelStatic(staticInput("e5", 1)), poseInput("e5", draftOf([], { wave: wave(0, 2) }), { aidTier: 1 }));
    expect((t1.liveCards[0] as unknown as { bars: { label: string }[] }).bars[0]!.label).toBe("bath");
    const t2 = meta.panelLive(meta.panelStatic(staticInput("e5", 2)), poseInput("e5", draftOf([], { wave: wave(0, 2) }), { aidTier: 2 }));
    expect((t2.liveCards[0] as unknown as { bars: { id: string }[] }).bars.map((b) => b.id)).toEqual(["outside", "inside_ref"]);
    expect(meta.pose(poseInput("e9", null, { aidTier: 1 })).saltOutline).toBe(true);
  });

  it("lerp, audio, geometry and debug", () => {
    const a = meta.pose(poseInput("e5", draftOf([], { wave: wave(0, 8) })));
    const b = meta.pose(poseInput("e5", draftOf([{ waveIndex: 0, categoryId: "isotonic" }], { wave: wave(1, 7.95), focus: "hypertonic" })));
    const mid = meta.lerp(a, b, 0.25);
    expect(cellOf(mid, 0).x).toBeCloseTo(cellOf(a, 0).x + 0.25 * (cellOf(b, 0).x - cellOf(a, 0).x), 9);
    expect(cellOf(mid, 0).place).toBe("lock");
    expect(cellOf(meta.lerp(a, b, 0.6), 0).place).toBe("basin");
    expect(meta.audio(a, poseInput("e5", null))[0]).toMatchObject({ cue: "current_hum" });
    const fb = meta.frameBounds(STATIONS.e5.config, null);
    expect(fb.x).toBeLessThanOrEqual(-400 - 100); // the console (x −400) is in frame
    expect(fb.x + fb.w).toBeGreaterThan(eddyXY(3).x);
    expect(meta.probe(STATIONS.e5.config, null)).toBeNull();
    expect(meta.debug(b)).toMatchObject({ current: 1, answered: 1, claim: "hypertonic", cells: expect.stringContaining("w0:basin1") });
  });
});
