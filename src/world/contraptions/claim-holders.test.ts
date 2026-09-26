/* eslint-disable @typescript-eslint/no-restricted-imports -- tests may read params and solutions (docs/design/20 §2.5.6):
   they build ConfigCtx through the world library and the mechanics registry, which the meta itself never imports. */
/**
 * claim_holders meta — the §7.4 row (docs/design/20): aim angle per holder; display order → holder slot stable for the
 * seed; hover previews without committing; trace_slate playhead and bell pitch ∝ |f(x)|; validateConfig (traces,
 * brackets, ghost honesty, footprints); the no-leak test; aid-tier gates; scenarioMin gating; FILE first and
 * recordPins under RECORD; hint targets start from the skin's; the failure plan holds wrongKeys[0] bright.
 */
import { describe, expect, it } from "vitest";
import cellFixture from "../../../fixtures/cell-transport-dungeon.json";
import civilFixture from "../../../fixtures/civil-rights-mystery.json";
import trigFixture from "../../../fixtures/trig-dungeon.json";
import docConfigs from "../../../tests/world-doc-configs.json";
import { GameSpec } from "../../contracts/gamespec";
import { getMode } from "../../mechanics/registry";
import { configCtxFor } from "../library";
import type { AidTier, ConfigCtx, Diagnosis, Draft, HintsUsed, HintRung, PoseInput, StaticInput } from "../types";
import {
  AIM_RIGS,
  aimAngleFrom,
  CLAIM_HOLDERS_SKINS,
  ClaimHoldersConfig,
  claimHoldersMeta as meta,
  claimHoldersSim,
  chestsOf,
  fmtPi,
  formatProbe,
  holderPos,
  pitchHzOf,
  slotOfStatement,
  type ClaimHoldersSim,
} from "./claim-holders.meta";

// ---------------------------------------------------------------- fixtures

const SPECS: Record<string, { spec: GameSpec; biome: string }> = {
  "10-game-trig.md": { spec: GameSpec.parse(trigFixture), biome: "orrery_terraces" },
  "11-game-cell-transport.md": { spec: GameSpec.parse(cellFixture), biome: "living_gate" },
  "12-game-civil-rights.md": { spec: GameSpec.parse(civilFixture), biome: "archive_of_voices" },
};
type DocConfig = { archetype: string; doc: string; encounterId: string | null; config: unknown };
const DOC = (docConfigs as { configs: DocConfig[] }).configs.filter((c) => c.archetype === "claim_holders");

interface Station {
  id: string;
  ctx: ConfigCtx;
  config: ClaimHoldersConfig;
  spec: GameSpec;
  index: number;
}
const STATIONS: Station[] = DOC.map((c) => {
  const { spec, biome } = SPECS[c.doc];
  const index = spec.encounters.findIndex((e) => e.id === c.encounterId);
  return { id: c.encounterId!, ctx: configCtxFor(spec, index, biome), config: ClaimHoldersConfig.parse(c.config), spec, index };
});
const station = (id: string) => STATIONS.find((s) => s.id === id)!;

function draftOf(ctx: ConfigCtx, statementIndex: number | null, hover: string | null = null, probe: number | null = null): Draft {
  return {
    encounterId: ctx.encounter.id,
    modeKey: ctx.modeKey,
    input: { statementIndex },
    complete: statementIndex !== null,
    focus: null,
    hover,
    probe,
    settled: true,
    wave: null,
    marks: null,
    seq: 1,
  };
}
function poseInput(
  st: { ctx: ConfigCtx; config: ClaimHoldersConfig },
  over: Partial<PoseInput<ClaimHoldersConfig, ClaimHoldersSim | null>> = {},
): PoseInput<ClaimHoldersConfig, ClaimHoldersSim | null> {
  return { view: st.ctx.view, draft: null, config: st.config, probe: null, t: 0, aidTier: 0, hintsUsed: 0, sim: null, solved: false, reducedMotion: false, ...over };
}
function staticInput(st: { ctx: ConfigCtx; config: ClaimHoldersConfig }, over: Partial<StaticInput<ClaimHoldersConfig>> = {}): StaticInput<ClaimHoldersConfig> {
  return { view: st.ctx.view, config: st.config, aidTier: 0, hintsUsed: 0, reducedMotion: false, skinId: "resonance_pillars", record: false, ...over };
}
function diagnosis(wrongKeys: string[]): Diagnosis {
  return { correct: false, feedback: "That chest was honest: …", displayFeedback: "…", failKey: "honest", wrongKeys, prefix: null, disclosed: {}, nearMiss: null, probeKeys: [] };
}
const statementsOf = (ctx: ConfigCtx) => chestsOf(ctx.view).map((c) => c.statementIndex);

// ---------------------------------------------------------------- tests

describe("claim_holders: the doc configs", () => {
  it("covers the 8 showcase claim stations and every one validates with zero issues", () => {
    expect(STATIONS.map((s) => s.id).sort()).toEqual(["e1_bilayer", "e1_brown", "e3_amplitude", "e3_diffusion", "e4_osmosis", "e4_sit_ins", "e5_period_review", "e7_active"]);
    for (const s of STATIONS) expect(meta.validateConfig(s.config, s.ctx), s.id).toEqual([]);
  });
});

describe("aim geometry and display order", () => {
  it("aims at each holder by the rig's angle (turning aimers: atan2; pendant lamps: asin of dx / cord)", () => {
    const st = station("e3_amplitude");
    const rig = AIM_RIGS.tuning_lens;
    for (const si of statementsOf(st.ctx)) {
      const slot = slotOfStatement(st.ctx.view, si)!;
      const pose = meta.pose(poseInput(st, { draft: draftOf(st.ctx, si) }));
      const h = holderPos(rig, 3, slot);
      expect(pose.aimAngle).toBeCloseTo(Math.atan2(h.y - rig.aimer.y, h.x - rig.aimer.x), 12);
      expect(pose.aimed).toBe(slot);
    }
    // the three angles differ: left, centre (straight up), right
    const angles = [0, 1, 2].map((slot) => aimAngleFrom(rig, holderPos(rig, 3, slot)));
    expect(angles[1]).toBeCloseTo(-Math.PI / 2, 12);
    expect(new Set(angles.map((a) => a.toFixed(6))).size).toBe(3);
    const pendant = AIM_RIGS.pendant_lamp;
    expect(aimAngleFrom(pendant, holderPos(pendant, 3, 1))).toBeCloseTo(0, 12);
    expect(aimAngleFrom(pendant, holderPos(pendant, 3, 2))).toBeCloseTo(Math.asin(0.8), 12);
    expect(aimAngleFrom(pendant, { x: 1000, y: 0 })).toBeCloseTo(Math.asin(0.9), 12); // clamped
  });

  it("maps display order → holder slot, stable for the seed (view.chests order, never statement order)", () => {
    const st = station("e3_amplitude");
    const again = configCtxFor(st.spec, st.index, "orrery_terraces");
    expect(again.view).toEqual(st.ctx.view);
    expect(statementsOf(st.ctx)).toEqual([1, 2, 0]); // trig_demo_001's seed shuffles s1, s2, s0
    expect(slotOfStatement(st.ctx.view, 1)).toBe(0);
    expect(slotOfStatement(st.ctx.view, 0)).toBe(2);
    const a = meta.pose(poseInput(st, { draft: draftOf(st.ctx, 0) }));
    const b = meta.pose(poseInput({ ctx: again, config: st.config }, { draft: draftOf(again, 0) }));
    expect(a).toEqual(b);
    const claims = meta.panelStatic(staticInput(st)).cards.find((c) => c.kind === "claims");
    expect(claims?.kind === "claims" && claims.items.map((i) => `${i.letter}:${i.key}`)).toEqual(["A:1", "B:2", "C:0"]);
  });

  it("hover previews without committing; selecting commits", () => {
    const st = station("e3_amplitude");
    const idle = meta.pose(poseInput(st));
    expect(idle).toMatchObject({ aimed: null, committed: null, beam: 0 });
    const d = draftOf(st.ctx, null, "2");
    const before = JSON.stringify(d.input);
    const hover = meta.pose(poseInput(st, { draft: d }));
    expect(hover).toMatchObject({ aimed: slotOfStatement(st.ctx.view, 2), committed: null, preview: true, beam: 0.7 });
    expect(JSON.stringify(d.input)).toBe(before); // the draft input is untouched: nothing is committed
    const both = meta.pose(poseInput(st, { draft: draftOf(st.ctx, 0, "1") }));
    expect(both).toMatchObject({ aimed: slotOfStatement(st.ctx.view, 1), committed: slotOfStatement(st.ctx.view, 0), preview: true });
    const committed = meta.pose(poseInput(st, { draft: draftOf(st.ctx, 0) }));
    expect(committed).toMatchObject({ aimed: 2, committed: 2, preview: false, beam: 1 });
    const live = meta.panelLive(meta.panelStatic(staticInput(st)), poseInput(st, { draft: draftOf(st.ctx, 0, "1") }));
    const claims = live.liveCards.find((c) => c.kind === "claims");
    expect(claims?.kind === "claims" && claims.items.map((i) => i.state)).toEqual(["hover", "idle", "aimed"]);
  });

  it("the idle lamp sweeps ±6° around the row centre, and holds still with reduced motion", () => {
    const st = station("e1_brown");
    const rig = AIM_RIGS.arc_lamp;
    const centre = aimAngleFrom(rig, { x: rig.cx, y: rig.holderY });
    const at = (t: number, reducedMotion = false) => meta.pose(poseInput(st, { t, reducedMotion })).aimAngle;
    expect(at(1.25)).toBeCloseTo(centre + (6 * Math.PI) / 180, 9);
    expect(at(1.25, true)).toBeCloseTo(centre, 12);
  });
});

describe("trace_slate (trig e3, e5)", () => {
  it("projects the aimed claim's trace with a playhead at x; the bell pitch follows |f(x)| (equal at π/2 and 3π/2)", () => {
    const st = station("e3_amplitude");
    const at = (x: number, si: number | null) => meta.pose(poseInput(st, { draft: draftOf(st.ctx, si, null, x), probe: x }));
    const p1 = at(Math.PI / 2, 0);
    const p3 = at((3 * Math.PI) / 2, 0);
    expect(p1.playheadX).toBeCloseTo(Math.PI / 2, 12);
    expect(p1.traceY).toBeCloseTo(3, 9);
    expect(p3.traceY).toBeCloseTo(-3, 9);
    expect(p1.bell).toBeCloseTo(p3.bell, 12);
    expect(p1.bell).toBeCloseTo(3 / 4, 9);
    const a1 = meta.audio(p1, poseInput(st, { probe: Math.PI / 2 }));
    const a3 = meta.audio(p3, poseInput(st, { probe: (3 * Math.PI) / 2 }));
    expect(a1).toEqual([{ cue: "bell_hum", pitch: pitchHzOf(0.75), gain: 0.15 }]);
    expect(a1[0].pitch).toBeCloseTo(220 * 2 ** (3 / 4), 9);
    expect(a3[0].pitch).toBeCloseTo(a1[0].pitch!, 9);
    // nothing aimed: the slates are dark and the hum follows the reference
    const idle = at(Math.PI / 2, null);
    expect(idle.traceY).toBeNull();
    expect(idle.bell).toBeCloseTo(0.75, 9);
    // the world chip is |y| (the distance from the midline, never "6")
    expect(meta.describe(p3, poseInput(st, { probe: (3 * Math.PI) / 2 })).chips).toContainEqual({ anchor: "slate_2", text: "|y|: 3.00", color: "h" });
  });

  it("e5: sin(2x) warbles through 8 swells over [0, 4π], cos(x/2) through 2 (the bell hears the period)", () => {
    const st = station("e5_period_review");
    const swells = (si: number) => {
      let peaks = 0;
      let prev = 0;
      let rising = false;
      for (let i = 0; i <= 960; i++) {
        const x = (4 * Math.PI * i) / 960;
        const b = meta.pose(poseInput(st, { draft: draftOf(st.ctx, si, null, x), probe: x })).bell;
        if (b < prev && rising) peaks++;
        rising = b > prev;
        prev = b;
      }
      return peaks;
    };
    expect(swells(0)).toBe(8);
    expect(swells(2)).toBe(2);
  });

  it("formats the probe readout (π, month-year, units)", () => {
    expect(fmtPi(Math.PI / 2)).toBe("0.5π");
    expect(fmtPi(Math.PI)).toBe("π");
    expect(fmtPi(0)).toBe("0");
    const year = station("e1_brown").config.probe!;
    expect(formatProbe(1965 + 2 / 12, year)).toBe("MAR 1965");
    expect(formatProbe(2.4, station("e1_bilayer").config.probe!)).toBe("2.4 nm");
  });
});

describe("validateConfig", () => {
  it("traces must evaluate and brackets and markers must sit inside the card range", () => {
    const st = station("e3_amplitude");
    const bad = structuredClone(st.config);
    bad.holders[0].trace!.fns[0].expr = "log(-1 - x^2)";
    bad.holders[1].trace!.brackets[0].y1 = "9";
    bad.holders[2].trace!.markers.push({ x: "7*pi", y: "0", kind: "period" });
    const msgs = meta.validateConfig(bad, st.ctx).map((i) => i.message).join("\n");
    expect(msgs).toMatch(/evaluates at fewer than 90 %/);
    expect(msgs).toMatch(/bracket lies outside the card range/);
    expect(msgs).toMatch(/marker lies outside the card range/);
  });

  it("ghost honesty: swapped tags are errors", () => {
    const st = station("e1_bilayer");
    const swapped = structuredClone(st.config);
    const g0 = swapped.holders.find((h) => h.statementIndex === 0)!;
    const g1 = swapped.holders.find((h) => h.statementIndex === 1)!;
    [g0.ghost, g1.ghost] = [g1.ghost, g0.ghost];
    const issues = meta.validateConfig(swapped, st.ctx).filter((i) => /ghost honesty/.test(i.message));
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.severity === "error")).toBe(true);
    const unknown = structuredClone(st.config);
    unknown.holders[0].ghost = "salt_inflow"; // another sim's ghost
    expect(meta.validateConfig(unknown, st.ctx).map((i) => i.message).join()).toMatch(/not in bilayer_probe's registry/);
  });

  it("footprints are all-or-none and their years must appear in the encounter texts (±1)", () => {
    const st = station("e1_brown");
    const some = structuredClone(st.config);
    some.holders[1].footprint = null;
    expect(meta.validateConfig(some, st.ctx).map((i) => i.message)).toContain("footprints are all-or-none: give every holder one, or none");
    const far = structuredClone(st.config);
    far.holders[0].footprint = { kind: "pin", from: "1830", to: null, label: "wrong year" };
    expect(meta.validateConfig(far, st.ctx).map((i) => i.message).join()).toMatch(/footprint year 1830 does not appear/);
  });

  it("defaults: text-only claims for every statement; history biomes get a year probe on the record lens", () => {
    for (const s of STATIONS) {
      const biome = s.ctx.biome;
      const d = meta.defaultConfig(s.ctx);
      expect(d.holders.map((h) => h.statementIndex).sort()).toEqual([...statementsOf(s.ctx)].sort());
      expect(d.holders.every((h) => h.trace === null && h.ghost === null && h.footprint === null)).toBe(true);
      expect(meta.validateConfig(d, s.ctx).filter((i) => i.severity === "error")).toEqual([]);
      if (biome === "archive_of_voices") expect(d).toMatchObject({ probeWorld: "record_lens", aimer: "arc_lamp" });
    }
  });
});

describe("the no-leak test (amendment 26)", () => {
  const QUARANTINE = ["mimic_crab", "ridge_thaw", "tank_dilate", "raft_lock_flood", "lanterns_ignite", "retract_stamp"] as const;
  function* scenarios(s: Station): Generator<PoseInput<ClaimHoldersConfig, ClaimHoldersSim | null>> {
    const spec = s.config.probe;
    const probes = spec ? [spec.min, (spec.min + spec.max) / 2, spec.max] : [null];
    const drafts: (Draft | null)[] = [null, ...statementsOf(s.ctx).flatMap((si) => [draftOf(s.ctx, si), draftOf(s.ctx, null, String(si))])];
    for (const aidTier of [0, 1, 2] as AidTier[])
      for (const probe of probes)
        for (const draft of drafts) yield poseInput(s, { draft: draft && { ...draft, probe }, probe, aidTier, hintsUsed: aidTier as HintsUsed, t: 0.4 });
  }
  const observe = (input: PoseInput<ClaimHoldersConfig, ClaimHoldersSim | null>, record: boolean) => {
    const pose = meta.pose(input);
    const stat = meta.panelStatic({ ...input, skinId: "resonance_pillars", record });
    return JSON.stringify({ pose, described: meta.describe(pose, input), stat, live: meta.panelLive(stat, input), audio: meta.audio(pose, input) });
  };

  it("pose, describe and panelLive are unchanged when quarantineAnim (success-only) is permuted", () => {
    let checked = 0;
    for (const s of STATIONS) {
      for (const input of scenarios(s)) {
        const base = observe(input, s.ctx.biome === "archive_of_voices");
        for (const q of QUARANTINE) {
          expect(observe({ ...input, config: { ...input.config, quarantineAnim: q } }, s.ctx.biome === "archive_of_voices"), `${s.id} ${q}`).toBe(base);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it("and for solution-swapped params with an identical view (the meta never sees params or the solution)", () => {
    for (const s of STATIONS) {
      const mode = getMode(s.ctx.encounter.familyId, s.ctx.encounter.mode)!;
      const params = structuredClone(s.ctx.params) as { statements: { text: string; isTrue: boolean; explanation: string }[] };
      const mimic = params.statements.findIndex((x) => !x.isTrue);
      const other = (mimic + 1) % params.statements.length;
      params.statements[mimic].isTrue = true;
      params.statements[other].isTrue = false;
      const seed = s.spec.seed + s.index;
      const swappedView = mode.present(params, seed);
      expect(swappedView).toEqual(s.ctx.view); // identical view …
      expect(mode.resolve(params)).not.toEqual(s.ctx.solution); // … different solution
      for (const input of scenarios(s)) expect(observe({ ...input, view: swappedView }, false)).toBe(observe(input, false));
    }
  });

  it("the pose never carries a ghost tag, a mimic index or a correctness field before success", () => {
    for (const s of STATIONS)
      for (const input of scenarios(s)) {
        const text = JSON.stringify(meta.pose(input));
        expect(text).not.toMatch(/contradicts|matches|mimic|correct|honest/);
        expect(meta.pose(input).quarantined).toBeNull();
      }
  });
});

describe("aid tiers, scenarios, cards", () => {
  it("trig e3: the midline label at tier 1, the |y| card at tier 2", () => {
    const st = station("e3_amplitude");
    const cards = (aidTier: AidTier) => meta.panelStatic(staticInput(st, { aidTier, hintsUsed: aidTier as HintsUsed })).cards;
    expect(cards(0).map((c) => c.kind)).toEqual(["claims", "graph", "graph", "graph"]);
    const ref = (t: AidTier) => cards(t)[1];
    const label = (t: AidTier) => {
      const c = ref(t);
      return c.kind === "graph" ? c.annotations.find((a) => a.kind === "hline") : undefined;
    };
    expect(label(0)).toMatchObject({ kind: "hline", y: 0, label: null });
    expect(label(1)).toMatchObject({ kind: "hline", y: 0, label: "midline" });
    const overlay = (t: AidTier) => cards(t)[3];
    expect(overlay(1)).toMatchObject({ kind: "graph", title: "|y|", empty: true, plots: [] });
    expect(overlay(2)).toMatchObject({ kind: "graph", title: "|y|", empty: false });
    const ov2 = overlay(2);
    expect(ov2.kind === "graph" && ov2.annotations[0]).toMatchObject({ kind: "marker", label: "3" });
    // the claim card is drawn empty until a singer is aimed, then shows the aimed trace literally
    expect(cards(0)[2]).toMatchObject({ title: "claim", empty: true });
    const live = meta.panelLive(meta.panelStatic(staticInput(st)), poseInput(st, { draft: draftOf(st.ctx, 1, null, Math.PI / 2), probe: Math.PI / 2 }));
    const claim = live.liveCards[2];
    expect(claim.kind === "graph" && claim.annotations.find((a) => a.kind === "bracket")).toMatchObject({ label: "amplitude 6", orient: "vertical", y0: -3, y1: 3 });
    expect(live.chips).toEqual([
      { slot: 1, value: 3, text: "3.00", color: "f" },
      { slot: 2, value: 3, text: "3.00", color: "g" },
    ]);
    expect(live.readout).toBe("0.5π");
  });

  it("trig e5: period marks for the aimed trace only at tier 2", () => {
    const st = station("e5_period_review");
    const live = (aidTier: AidTier) =>
      meta.panelLive(meta.panelStatic(staticInput(st, { aidTier })), poseInput(st, { aidTier, draft: draftOf(st.ctx, 0, null, 1), probe: 1 })).liveCards[3];
    expect(live(1)).toMatchObject({ title: "period marks", empty: true });
    const c = live(2);
    expect(c.kind === "graph" && c.annotations.filter((a) => a.kind === "period_marker")).toHaveLength(4);
  });

  it("the secondary tier lights the apparatus highlight ring (never tied to the mimic)", () => {
    const st = station("e1_bilayer");
    expect(meta.pose(poseInput(st, { aidTier: 0 })).highlight).toBe(false);
    expect(meta.pose(poseInput(st, { aidTier: 1 })).highlight).toBe(true);
  });

  it("scenarioMin gating (cell e4): ghosts project only when s > 2.5", () => {
    const st = station("e4_osmosis");
    const at = (s: number, si: number) => meta.pose(poseInput(st, { draft: draftOf(st.ctx, si, null, s), probe: s }));
    for (const si of statementsOf(st.ctx)) {
      const ghost = st.config.holders.find((h) => h.statementIndex === si)!.ghost;
      expect(at(2.0, si)).toMatchObject({ ghost: null, ghostAlpha: 0, scenarioOk: false });
      expect(at(2.5, si)).toMatchObject({ ghost: null, scenarioOk: false });
      expect(at(6.0, si)).toMatchObject({ ghost, ghostAlpha: 0.45, scenarioOk: true });
    }
    expect(at(2.0, 0).holderGlow.every((g) => g <= 0.6)).toBe(true);
    const claims = meta.panelStatic(staticInput(st, { skinId: "specimen_pods" })).cards.find((c) => c.kind === "claims");
    expect(claims?.kind === "claims" && claims.scenario).toBe("claims apply when s > 2.5 %");
    // the osmotic volume follows the doc formula
    expect(at(4, 0).apparatus.volume).toBeCloseTo(0.3 + (0.7 * 2) / 4, 12);
    expect(at(9, 0).apparatus.volume).toBe(0.55); // clamped
  });

  it("science cards: shared probe x, chips at the probe, tier-2 overlays, the downhill ghost curve on e7", () => {
    const st = station("e3_diffusion");
    const stat = meta.panelStatic(staticInput(st, { skinId: "specimen_pods" }));
    expect(stat.cards.map((c) => c.kind === "graph" ? c.title : c.kind)).toEqual(["C_L start", "C_eq", "J₀", "claims"]);
    const live = meta.panelLive(stat, poseInput(st, { probe: 5 }));
    expect(live.chips.map((c) => c.text)).toEqual(["5.0 mM", "2.5 mM", "1.8/s"]);
    const e7 = station("e7_active");
    const mimicSlot = statementsOf(e7.ctx).indexOf(2);
    expect(mimicSlot).toBeGreaterThanOrEqual(0);
    const aimed = meta.panelLive(meta.panelStatic(staticInput(e7)), poseInput(e7, { draft: draftOf(e7.ctx, 2, null, 4), probe: 4 })).liveCards[0];
    expect(aimed.kind === "graph" && aimed.plots.map((p) => p.style)).toEqual(["solid", "ghost"]);
    const honest = meta.panelLive(meta.panelStatic(staticInput(e7)), poseInput(e7, { draft: draftOf(e7.ctx, 0, null, 4), probe: 4 })).liveCards[0];
    expect(honest.kind === "graph" && honest.plots).toHaveLength(1);
    const e1 = station("e1_bilayer");
    const e1Stat = (aidTier: AidTier) => meta.panelStatic(staticInput(e1, { aidTier })).cards[0];
    const c2 = e1Stat(2);
    expect(c2.kind === "graph" && c2.annotations.filter((a) => a.kind === "shade")).toHaveLength(2);
    const c0 = e1Stat(0);
    expect(c0.kind === "graph" && c0.annotations).toEqual([]);
    expect(meta.pose(poseInput(e1, { probe: 2.4 })).apparatus).toMatchObject({ needleTipY: 41.6 * 2.4, ionHeld: 1 });
  });

  it("FILE first and recordPins when StaticInput.record (civil e1): the rung-2 pin appears at hintsUsed 2", () => {
    const st = station("e1_brown");
    const s = (record: boolean, hintsUsed: HintsUsed) =>
      meta.panelStatic(staticInput(st, { record, hintsUsed, aidTier: Math.min(2, hintsUsed) as AidTier, skinId: "witness_projector" }));
    expect(s(true, 0).cards.map((c) => c.kind)).toEqual(["timeline", "claims"]);
    expect(s(true, 0).cards[0]).toMatchObject({ title: "FILE", from: 1950, to: 1960 });
    expect(s(true, 1).recordPins).toEqual([]);
    expect(s(true, 2).recordPins).toEqual([{ key: "hint:0", at: 1957, label: "Little Rock", style: "hint" }]);
    expect(s(false, 2).recordPins).toEqual([]);
    const file = s(false, 2).cards[0];
    expect(file.kind === "timeline" && file.pins.find((p) => p.style === "hint")).toMatchObject({ at: 1957, label: "Little Rock" });
    // every footprint drawn (dim) so the card is not a tell; the arrow's 1896 end breaks the axis
    const f0 = s(true, 0).cards[0];
    expect(f0.kind === "timeline" && f0.pins.every((p) => p.style === "dim")).toBe(true);
    expect(f0.kind === "timeline" && f0.axisBreak).toEqual({ from: 1896, to: 1950 });
    // the aimed footprint turns green (draft) and its band draws
    const live = meta.panelLive(s(true, 0), poseInput(st, { draft: draftOf(st.ctx, 1, null, 1955), probe: 1955 }));
    const lf = live.liveCards[0];
    expect(lf.kind === "timeline" && lf.pins.find((p) => p.key === "fp:1")).toMatchObject({ style: "draft", spanTo: 1955 });
    expect(lf.kind === "timeline" && lf.bands).toEqual([{ from: 1954, to: 1955, label: "claimed: desegregated", color: "g" }]);
    expect(live.liveCards[1].kind).toBe("claims");
    expect(live.readout).toBe("JAN 1955");
    // a non-history station under RECORD still puts FILE first
    expect(meta.panelStatic(staticInput(station("e3_amplitude"), { record: true })).cards[0]).toMatchObject({ kind: "timeline", title: "FILE" });
  });
});

describe("hints, plans, lerp, sim", () => {
  it("hint targets start from the skin's table for every skin and rung", () => {
    for (const skin of CLAIM_HOLDERS_SKINS)
      for (const s of STATIONS)
        for (const rung of [1, 2, 3] as HintRung[]) {
          const got = meta.hintTargets(rung, staticInput(s, { skinId: skin.id }));
          expect(got.slice(0, skin.hintTargets[rung - 1].length)).toEqual(skin.hintTargets[rung - 1]);
        }
    const e3 = meta.hintTargets(2, staticInput(station("e3_amplitude")));
    expect(e3.map((t) => t.anchor)).toEqual(["slate_0", "slate_1", "slate_2"]);
  });

  it("the failure plan holds wrongKeys[0] bright and nothing else about the claims", () => {
    for (const s of STATIONS) {
      const rig = AIM_RIGS[s.config.aimer];
      const mimic = (s.ctx.solution as { mimicIndex: number }).mimicIndex;
      for (const si of statementsOf(s.ctx).filter((i) => i !== mimic)) {
        const plan = meta.failurePlan(diagnosis([String(si)]), poseInput(s, { draft: draftOf(s.ctx, si) }));
        const slot = slotOfStatement(s.ctx.view, si)!;
        const bright = plan.beats.filter((b) => b.action === "hold_bright");
        expect(bright).toEqual([{ atMs: 0, anchor: `${rig.surfaceAnchor}${slot}`, action: "hold_bright", params: { slot, holdMs: 2000 } }]);
        expect(plan.durationMs).toBeGreaterThanOrEqual(600);
        expect(plan.durationMs).toBeLessThanOrEqual(1600);
        // no beat names another holder
        const others = [0, 1, 2].filter((i) => i !== slot).map((i) => `${rig.surfaceAnchor}${i}`);
        expect(plan.beats.some((b) => others.includes(b.anchor))).toBe(false);
      }
    }
  });

  it("success plans play the success-only quarantine within 1.2–2.5 s", () => {
    for (const s of STATIONS) {
      const mimic = (s.ctx.solution as { mimicIndex: number }).mimicIndex;
      const plan = meta.successPlan(poseInput(s, { draft: draftOf(s.ctx, mimic), solved: true }), s.ctx.biome === "living_gate" ? "ramp_forms" : "stairs_rise");
      expect(plan.durationMs).toBeGreaterThanOrEqual(1200);
      expect(plan.durationMs).toBeLessThanOrEqual(2500);
      expect(plan.beats.every((b) => b.atMs <= plan.durationMs)).toBe(true);
      expect(plan.cue).toBe(AIM_RIGS[s.config.aimer].succeedCue);
      if (s.config.quarantineAnim === "retract_stamp") expect(plan.beats.some((b) => b.action === "stamp" && b.params?.text === "RETRACTED")).toBe(true);
      const solved = meta.solvedPose(poseInput(s, { draft: draftOf(s.ctx, mimic), solved: true }));
      expect(solved).toMatchObject({ solved: true, gate: 1, quarantined: slotOfStatement(s.ctx.view, mimic) });
    }
  });

  it("lerp: t = 0 is the start pose, t = 1 the target; discrete fields snap at 0.5", () => {
    const st = station("e3_amplitude");
    const a = meta.pose(poseInput(st, { draft: draftOf(st.ctx, 1, null, 1), probe: 1 }));
    const b = meta.pose(poseInput(st, { draft: draftOf(st.ctx, 0, null, 2), probe: 2 }));
    expect(meta.lerp(a, b, 0)).toEqual(a);
    expect(meta.lerp(a, b, 1)).toEqual(b);
    expect(meta.lerp(a, b, 0.49).aimed).toBe(a.aimed);
    expect(meta.lerp(a, b, 0.5).aimed).toBe(b.aimed);
  });

  it("wraps the station's reference sim (seeded, keeps its params, reads out)", () => {
    const st = station("e3_diffusion");
    const ctx = { draft: null, probe: 5, t: 0, aidTier: 0 as AidTier };
    const s0 = claimHoldersSim.init(7, st.config, st.ctx.view, ctx);
    expect(s0).toMatchObject({ id: "diffusion_tank", seed: 7, params: { p: 0.3, sigma: 5 } });
    let s = s0;
    for (let i = 0; i < 10; i++) s = claimHoldersSim.step(s, claimHoldersSim.fixedDt, { ...ctx, probe: i < 5 ? 5 : 6 });
    const again = (() => {
      let x = claimHoldersSim.init(7, st.config, st.ctx.view, ctx);
      for (let i = 0; i < 10; i++) x = claimHoldersSim.step(x, claimHoldersSim.fixedDt, { ...ctx, probe: i < 5 ? 5 : 6 });
      return x;
    })();
    expect(JSON.stringify(s)).toBe(JSON.stringify(again));
    expect(typeof claimHoldersSim.readout(s)).toBe("object");
    expect(claimHoldersSim.init(1, station("e3_amplitude").config, null, ctx)).toBeNull();
    const pose = meta.pose(poseInput(st, { sim: s, probe: 6 }));
    expect(Object.keys(pose.apparatus).some((k) => k.startsWith("sim_"))).toBe(true);
  });

  it("describe gives an aim chip, sim chips and one-sentence SR text", () => {
    const st = station("e1_brown");
    const pose = meta.pose(poseInput(st, { draft: draftOf(st.ctx, 0) }));
    const d = meta.describe(pose, poseInput(st));
    expect(d.chips[0]).toEqual({ anchor: "lamp_pivot", text: `aim: slide ${"ABC"[slotOfStatement(st.ctx.view, 0)!]}`, color: "f" });
    expect(d.srText).toMatch(/^The Proof Lamp aims at slide [ABC]\.$/);
    expect(d.nearMiss).toBeNull();
    expect(meta.debug(pose)).toMatchObject({ aimed: pose.aimed, gate: 0, solved: false });
    const frame = meta.frameBounds(st.config, st.ctx.view);
    expect(frame.w).toBeGreaterThan(0);
    expect(frame.h).toBeGreaterThan(0);
  });
});
