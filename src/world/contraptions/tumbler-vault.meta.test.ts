import { describe, expect, it } from "vitest";
import civil from "../../../fixtures/civil-rights-mystery.json";
// Test-only: grade() proves the marks channel cannot change a verdict. Metas themselves never import modes (§2.5.6).
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getMode } from "../../mechanics/registry";
import { makeDraft, toSubmitInput } from "../draft-inputs";
import type { Diagnosis, Draft, EliminationView, PoseInput, StaticInput } from "../types";
import { STRUCK_DEG, tumblerVaultMeta as meta, TumblerVaultConfig, UNSTRUCK_SLIDE_PX, lastUnstruckOf, type TumblerVaultPose } from "./tumbler-vault.meta";

// civil e12 (§5.12): the view as elimination.present() builds it (hypotheses shuffled, clues in order)
const e12 = civil.encounters.find((e) => e.id === "e12_boss")!;
const params = e12.params as { question: string; hypotheses: { id: string; text: string }[]; clues: { text: string; eliminates: string[] }[] };
const ORDER = ["h_court", "h_selma", "h_inevitable", "h_cra_enough"]; // display order = tumbler_0…3
const VIEW: EliminationView = {
  question: params.question,
  hypotheses: ORDER.map((id) => ({ id, text: params.hypotheses.find((h) => h.id === id)!.text })),
  clues: params.clues.map((c, index) => ({ index, text: c.text })),
};
const YEAR = { symbol: "YEAR", label: "record year", min: 1954, max: 1966, step: 0.0833333333, unit: "", format: "month_year", initial: null, stops: [], window: { start: 1954, end: 1966 }, playback: false };
const CONFIG = TumblerVaultConfig.parse({
  clues: [
    { index: 0, date: "1965" },
    { index: 1, date: "1965-03-15" },
    { index: 2, date: "1965" },
    { index: 3, date: "1964" },
  ],
  bolts: 4,
  miniStrip: { start: 1954, end: 1967 },
  shadeCountsRung: 3,
  probe: YEAR,
});
const MODE = "investigator.elimination" as const;
type Mark = { clueIndex: number; hypothesisId: string };

function draft(hypothesisId: string | null, marks: readonly Mark[] | null, patch: Partial<Draft> = {}): Draft {
  return makeDraft("e12_boss", MODE, { hypothesisId }, { complete: hypothesisId !== null, marks, settled: true, ...patch });
}
function input(d: Draft | null, patch: Partial<PoseInput<TumblerVaultConfig>> = {}): PoseInput<TumblerVaultConfig> {
  return { view: VIEW, draft: d, config: CONFIG, probe: d?.probe ?? null, t: 0, aidTier: 0, hintsUsed: 0, sim: null, solved: false, reducedMotion: false, ...patch };
}
function staticIn(patch: Partial<StaticInput<TumblerVaultConfig>> = {}): StaticInput<TumblerVaultConfig> {
  return { view: VIEW, config: CONFIG, aidTier: 0, hintsUsed: 0, reducedMotion: false, skinId: "tumbler_vault", record: false, ...patch };
}
const pose = (i: PoseInput<TumblerVaultConfig>): TumblerVaultPose => meta.pose(i);
const byId = (p: TumblerVaultPose, id: string) => p.tumblers.find((t) => t.id === id)!;
const strike = (...ids: string[]): Mark[] => ids.map((hypothesisId, k) => ({ clueIndex: k % 4, hypothesisId }));

/** A seeded LCG for sampled mark sets. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

describe("tumbler_vault meta (civil e12)", () => {
  it("the doc's e12 config parses and validates against the fixture", () => {
    const texts = [e12.prompt, ...e12.hints, ...params.clues.map((c) => c.text)];
    expect(meta.validateConfig(CONFIG, { modeKey: MODE, encounter: e12 as never, params, solution: e12.solution, view: VIEW, texts, biome: "archive_of_voices" })).toEqual([]);
    expect(meta.probe(CONFIG, VIEW)).toEqual(CONFIG.probe);
  });

  it("struck ⇒ a 90° turn and a dim lamp; unstruck stays upright and white", () => {
    const p = pose(input(draft(null, strike("h_court", "h_inevitable"))));
    expect(p.tumblers.map((t) => t.id)).toEqual(ORDER);
    expect(byId(p, "h_court")).toMatchObject({ rotDeg: STRUCK_DEG, struck: true, lamp: 0 });
    expect(byId(p, "h_inevitable")).toMatchObject({ rotDeg: 90, struck: true, lamp: 0 });
    expect(byId(p, "h_selma")).toMatchObject({ rotDeg: 0, struck: false, lamp: 1, glow: 0 });
    expect(p.struckCount).toBe(2);
    // two marks on the same row still strike it once; marks on unknown rows or clues are ignored
    const q = pose(input(draft(null, [{ clueIndex: 0, hypothesisId: "h_court" }, { clueIndex: 2, hypothesisId: "h_court" }, { clueIndex: 9, hypothesisId: "h_selma" }, { clueIndex: 0, hypothesisId: "nope" }])));
    expect(q.struckCount).toBe(1);
    expect(byId(q, "h_selma").struck).toBe(false);
  });

  it("the last-unstruck glow comes only from the player's own marks, never from the solution", () => {
    // leave the RIGHT survivor unstruck
    const right = pose(input(draft(null, strike("h_court", "h_inevitable", "h_cra_enough"))));
    expect(right.lastUnstruck).toBe("h_selma");
    expect(byId(right, "h_selma")).toMatchObject({ glow: 1, slide: UNSTRUCK_SLIDE_PX });
    // leave a WRONG one unstruck: it glows just the same (the meta cannot know better)
    const wrong = pose(input(draft(null, strike("h_selma", "h_inevitable", "h_cra_enough"))));
    expect(wrong.lastUnstruck).toBe("h_court");
    expect(byId(wrong, "h_court")).toMatchObject({ glow: 1, slide: 8 });
    expect(byId(wrong, "h_selma")).toMatchObject({ glow: 0, slide: 0 });
    // no marks, some marks, or every row struck: nothing glows; an accusation alone never glows
    for (const marks of [null, [], strike("h_court"), strike("h_court", "h_selma"), strike(...ORDER)]) {
      const p = pose(input(draft("h_selma", marks)));
      expect(p.lastUnstruck).toBeNull();
      expect(p.tumblers.every((t) => t.glow === 0 && t.slide === 0)).toBe(true);
    }
    // sampled: the glow is exactly "one row left unstruck by the marks", whatever the marks are
    const next = rng(12);
    for (let n = 0; n < 200; n++) {
      const marks = Array.from({ length: Math.floor(next() * 7) }, () => ({ clueIndex: Math.floor(next() * 4), hypothesisId: ORDER[Math.floor(next() * 4)] }));
      const struck = new Set(marks.map((m) => m.hypothesisId));
      const left = ORDER.filter((id) => !struck.has(id));
      const p = pose(input(draft(ORDER[n % 4], marks)));
      expect(p.lastUnstruck).toBe(left.length === 1 ? left[0] : null);
      expect(lastUnstruckOf(draft(null, marks), VIEW)).toBe(p.lastUnstruck);
      expect(p.tumblers.filter((t) => t.glow > 0).map((t) => t.id)).toEqual(left.length === 1 ? left : []);
    }
  });

  it("marks never reach toSubmitInput (nor grade)", () => {
    const mode = getMode("investigator", "elimination")!;
    const next = rng(7);
    for (let n = 0; n < 100; n++) {
      const accused = ORDER[n % 4];
      const marks = Array.from({ length: Math.floor(next() * 8) }, () => ({ clueIndex: Math.floor(next() * 4), hypothesisId: ORDER[Math.floor(next() * 4)] }));
      const d = draft(accused, marks);
      Object.freeze(d.input);
      const submitted = toSubmitInput(MODE, d.input);
      expect(submitted).toEqual({ hypothesisId: accused });
      expect(Object.keys(submitted as object)).toEqual(["hypothesisId"]);
      // even an input polluted with marks submits only the accusation
      expect(toSubmitInput(MODE, { hypothesisId: accused, marks })).toEqual({ hypothesisId: accused });
      expect(mode.grade(e12.params, submitted)).toEqual(mode.grade(e12.params, { hypothesisId: accused }));
      // the meta reads marks but never writes them into the draft input
      const stat = meta.panelStatic(staticIn());
      meta.panelLive(stat, input(d));
      meta.describe(pose(input(d)), input(d));
      expect(d.input).toEqual({ hypothesisId: accused });
    }
    expect(() => toSubmitInput(MODE, draft(null, strike("h_court")).input)).toThrow();
  });

  it("the failure plan grinds the accused tumbler and slides clue i (wrongKeys = [id, clue:i])", () => {
    const base: Diagnosis = { correct: false, feedback: "…", displayFeedback: "…", failKey: "wrong_hypothesis", wrongKeys: ["h_inevitable", "clue:1"], prefix: null, disclosed: { clueIndex: 1 }, nearMiss: null, probeKeys: [] };
    const plan = meta.failurePlan(base, input(draft("h_inevitable", strike("h_court"))));
    expect(plan.beats.map((b) => [b.anchor, b.action])).toEqual([
      ["tumbler_2", "grind"],
      ["tumbler_2", "hold_bright"],
    ]);
    expect(plan.beats[0].params).toMatchObject({ deg: 4, times: 3, hypothesisId: "h_inevitable" });
    expect(plan.beats[1].params).toMatchObject({ clueIndex: 1, clueKey: "clue:1" });
    expect(plan.cue).toBe("tumbler_grind");
    expect(plan.durationMs).toBeGreaterThanOrEqual(600);
    expect(plan.durationMs).toBeLessThanOrEqual(1600);
    // only the named tumbler moves
    const anchors = new Set(plan.beats.map((b) => b.anchor));
    expect([...anchors]).toEqual(["tumbler_2"]);
    // the clue falls back to disclosed.clueIndex; with neither, only the grind plays
    expect(meta.failurePlan({ ...base, wrongKeys: ["h_cra_enough"], disclosed: { clueIndex: 0 } }, input(null)).beats.map((b) => [b.anchor, b.params?.clueIndex ?? null])).toEqual([
      ["tumbler_3", null],
      ["tumbler_3", 0],
    ]);
    expect(meta.failurePlan({ ...base, wrongKeys: ["h_court"], disclosed: {} }, input(null)).beats).toHaveLength(1);
    expect(plan.beats.some((b) => ["spark", "scatter", "snap"].includes(b.action))).toBe(false); // sensitiveSafe
  });

  it("count shading appears only at hintsUsed = 3 (and never when shadeCountsRung is null)", () => {
    const shade = (hintsUsed: 0 | 1 | 2 | 3, config = CONFIG) => {
      const stat = meta.panelStatic(staticIn({ hintsUsed, aidTier: hintsUsed === 3 ? 2 : hintsUsed, config }));
      const m = stat.cards.find((c) => c.kind === "matrix");
      const live = meta.panelLive(stat, input(draft(null, strike("h_court")), { hintsUsed, config })).liveCards.find((c) => c.kind === "matrix");
      return [m?.kind === "matrix" && m.shadeCounts, live?.kind === "matrix" && live.shadeCounts];
    };
    expect([0, 1, 2, 3].map((h) => shade(h as 0 | 1 | 2 | 3))).toEqual([
      [false, false],
      [false, false],
      [false, false],
      [true, true],
    ]);
    expect(shade(3, { ...CONFIG, shadeCountsRung: null })).toEqual([false, false]);
  });

  it("the panel: the vault's own mini strip (clue dates) above the evidence matrix; marks and the accusation live", () => {
    const stat = meta.panelStatic(staticIn());
    expect(stat.cards.map((c) => [c.kind, c.slot])).toEqual([
      ["timeline", 0],
      ["matrix", 1],
    ]);
    const strip = stat.cards[0];
    expect(strip.kind === "timeline" && [strip.title, strip.from, strip.to]).toEqual(["RECORD", 1954, 1967]);
    expect(strip.kind === "timeline" && strip.pins.map((p) => p.key)).toEqual(["clue:0", "clue:1", "clue:2", "clue:3"]);
    const matrix = stat.cards[1];
    expect(matrix.kind === "matrix" && matrix.clues.map((c) => c.date)).toEqual(["1965", "1965-03-15", "1965", "1964"]);
    expect(matrix.kind === "matrix" && matrix.hypotheses.map((h) => h.id)).toEqual(ORDER);
    expect(stat).toMatchObject({ input: null, probe: CONFIG.probe, recordPins: [] });
    const marks = strike("h_court", "h_cra_enough");
    const live = meta.panelLive(stat, input(draft("h_selma", marks, { probe: 1965.2 }), { probe: 1965.2 }));
    const m = live.liveCards[0];
    expect(m.kind === "matrix" && [m.marks, m.accused]).toEqual([marks, "h_selma"]);
    expect(live.highlights).toEqual([
      { slot: 1, key: "h_court", state: "struck" },
      { slot: 1, key: "h_cra_enough", state: "struck" },
      { slot: 1, key: "h_selma", state: "focus" },
    ]);
    expect(live).toMatchObject({ scrubX: 1965.2, readout: "MAR 1965" });
    expect(live.chips).toEqual([{ slot: 0, value: 1965.2, text: "MAR 1965 · CLUE 2", color: "f" }]);
    // without a mini strip the matrix is slot 0
    expect(meta.panelStatic(staticIn({ config: { ...CONFIG, miniStrip: null } })).cards.map((c) => [c.kind, c.slot])).toEqual([["matrix", 0]]);
  });

  it("the success plan locks the accused tumbler, retracts the bolts in sequence and swings the door", () => {
    const solvedIn = input(draft("h_selma", strike("h_court", "h_inevitable", "h_cra_enough")), { solved: true });
    const plan = meta.successPlan(solvedIn, "vault_opens");
    expect(plan.beats[0]).toMatchObject({ anchor: "tumbler_1", action: "lock" });
    const bolts = plan.beats.filter((b) => b.anchor.startsWith("bolt_"));
    expect(bolts.map((b) => [b.anchor, b.atMs])).toEqual([
      ["bolt_0", 300],
      ["bolt_1", 480],
      ["bolt_2", 660],
      ["bolt_3", 840],
    ]);
    expect(plan.beats.at(-1)).toMatchObject({ anchor: "hub", action: "open", params: { anim: "vault_opens" } });
    expect(plan.durationMs).toBe(2500);
    expect(Math.max(...plan.beats.map((b) => b.atMs))).toBeLessThan(plan.durationMs);
    const solved = meta.solvedPose(solvedIn);
    expect(solved).toMatchObject({ door: 1, bolts: [1, 1, 1, 1], solved: true, accused: "h_selma" });
    expect(byId(solved, "h_selma")).toMatchObject({ rotDeg: 0, glow: 1 });
    expect(meta.describe(solved, solvedIn).srText).toMatch(/open/);
  });

  it("describes the vault, reacts to the hint tier, and follows the civil §5.12 hint targets", () => {
    const i = input(draft("h_court", strike("h_selma", "h_inevitable", "h_cra_enough")));
    const desc = meta.describe(pose(i), i);
    expect(desc.srText).toBe(`3 of 4 tumblers struck by your marks; one tumbler is left unstruck and glows; you accuse: ${VIEW.hypotheses[0].text}.`);
    expect(desc.chips).toEqual([{ anchor: "tumbler_0", text: "ACCUSED", color: "accent" }]);
    expect(pose(input(null)).grille).toBe(0.35);
    expect(pose(input(null, { aidTier: 1 })).grille).toBe(1);
    const si = staticIn();
    expect(meta.hintTargets(1, si)).toEqual([{ anchor: "grille", action: "circle", holdMs: 1800 }]);
    expect(meta.hintTargets(2, si)).toEqual([{ anchor: "hub", action: "land", holdMs: 2000 }]);
    expect(meta.hintTargets(3, si)).toEqual([{ anchor: "console", action: "hover", holdMs: 1500 }]);
    expect(meta.accessories).toEqual([]);
  });

  it("lerp eases rotations and snaps the discrete fields at t ≥ 0.5", () => {
    const a = pose(input(draft(null, [])));
    const b = pose(input(draft("h_court", strike("h_court"))));
    const half = meta.lerp(a, b, 0.25);
    expect(half.tumblers[0].rotDeg).toBe(22.5);
    expect(half.accused).toBeNull();
    expect(meta.lerp(a, b, 0.5).accused).toBe("h_court");
    expect(meta.lerp(a, b, 1)).toEqual(b);
    expect(meta.debug(b)).toMatchObject({ struckCount: 1, accused: "h_court", rotations: "90,0,0,0", solved: false });
  });
});
