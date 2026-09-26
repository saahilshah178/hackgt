import { describe, expect, it } from "vitest";
import civil from "../../../fixtures/civil-rights-mystery.json";
import { makeDraft } from "../draft-inputs";
import type { Diagnosis, Draft, PanelStatic, PoseInput, PredictRevealView, StaticInput } from "../types";
import { fracYearOf } from "./config-parts";
import { KNOB_REST_DEG, knobAngleFor, oracleTickerMeta as meta, OracleTickerConfig, TAPE_CPS, TAPE_PREFIX, type OracleTickerPose } from "./oracle-ticker.meta";

// civil e3 (§5.3): the view as predict_reveal.present() builds it (options keyed by optionIndex, shown in a shuffled order)
const e3 = civil.encounters.find((e) => e.id === "e3_little_rock")!;
const params = e3.params as { scenario: string; options: { text: string; explanation: string }[]; reveal: string };
const VIEW: PredictRevealView = {
  scenario: params.scenario,
  options: [2, 0, 1].map((optionIndex) => ({ optionIndex, text: params.options[optionIndex].text })),
};
const YEAR = { symbol: "YEAR", label: "record year", min: 1954, max: 1958, step: 0.0833333333, unit: "", format: "month_year", initial: null, stops: [], window: { start: 1954, end: 1958 }, playback: false };
const CONFIG = OracleTickerConfig.parse({ options: [], probe: YEAR, probeWorld: "record_lens", fileDates: [{ date: "1957-09", label: "Guard posted" }], conduit: "telegraph_wire", payoffLamps: 9 });
const MODE = "truth_finder.predict_reveal" as const;

function draft(optionIndex: number | null, patch: Partial<Draft> = {}): Draft {
  return makeDraft("e3_little_rock", MODE, { optionIndex }, { complete: optionIndex !== null, settled: true, ...patch });
}
function input(d: Draft | null, patch: Partial<PoseInput<OracleTickerConfig>> = {}): PoseInput<OracleTickerConfig> {
  return { view: VIEW, draft: d, config: CONFIG, probe: d?.probe ?? null, t: 5, aidTier: 0, hintsUsed: 0, sim: null, solved: false, reducedMotion: false, ...patch };
}
function staticIn(patch: Partial<StaticInput<OracleTickerConfig>> = {}): StaticInput<OracleTickerConfig> {
  return { view: VIEW, config: CONFIG, aidTier: 0, hintsUsed: 0, reducedMotion: false, skinId: "wire_ticker", record: true, ...patch };
}
const pose = (i: PoseInput<OracleTickerConfig>): OracleTickerPose => meta.pose(i);

describe("oracle_ticker meta (civil e3)", () => {
  it("the doc's e3 config parses and validates against the fixture", () => {
    expect(meta.configSchema.safeParse(CONFIG).success).toBe(true);
    const texts = [e3.prompt, ...e3.hints, params.scenario, params.reveal, ...params.options.flatMap((o) => [o.text, o.explanation])];
    expect(meta.validateConfig(CONFIG, { modeKey: MODE, encounter: e3 as never, params, solution: e3.solution, view: VIEW, texts, biome: "archive_of_voices" })).toEqual([]);
    expect(meta.probe(CONFIG, VIEW)).toEqual(CONFIG.probe);
  });

  it("points the knob by display position (−40°, 0°, +40°), rests when nothing is set", () => {
    expect([0, 1, 2].map((p) => knobAngleFor(p, 3))).toEqual([-40, 0, 40]);
    VIEW.options.forEach((o, position) => {
      const p = pose(input(draft(o.optionIndex)));
      expect(p.knobDeg).toBe([-40, 0, 40][position]);
      expect(p).toMatchObject({ position, optionIndex: o.optionIndex, committed: true, previewing: false });
    });
    expect(pose(input(null))).toMatchObject({ knobDeg: KNOB_REST_DEG, position: null, optionIndex: null, tapeText: "", wireAmp: 0 });
    expect(pose(input(draft(null))).knobDeg).toBe(KNOB_REST_DEG);
  });

  it("hover previews without committing; the preview wins while it lasts", () => {
    const committed = VIEW.options[0].optionIndex;
    const hovered = VIEW.options[2].optionIndex;
    const p = pose(input(draft(committed, { hover: String(hovered) })));
    expect(p).toMatchObject({ knobDeg: 40, position: 2, optionIndex: hovered, previewing: true, committed: true });
    expect(pose(input(draft(null, { hover: String(hovered) })))).toMatchObject({ position: 2, previewing: true, committed: false });
    expect(pose(input(draft(committed, { hover: "9" }))).position).toBe(0); // a hover on nothing falls back to the commitment
    expect(pose(input(draft(committed, { hover: String(committed) }))).previewing).toBe(false);
  });

  it("the tape retypes FORECAST: … on change (45 chars/s on the station clock, which resets on settle)", () => {
    expect(meta.clock?.resetOn).toContain("settle");
    const [a, b] = [VIEW.options[0], VIEW.options[1]];
    const full = pose(input(draft(a.optionIndex), { t: 10 }));
    expect(full.tapeText).toBe(`${TAPE_PREFIX}${a.text}`);
    expect(full.tapeChars).toBe(full.tapeText.length);
    const changed = pose(input(draft(b.optionIndex), { t: 0 }));
    expect(changed.tapeText).toBe(`${TAPE_PREFIX}${b.text}`);
    expect(changed.tapeKey).not.toBe(full.tapeKey);
    expect(changed.tapeChars).toBe(0);
    expect(pose(input(draft(b.optionIndex), { t: 0.2 })).tapeChars).toBe(Math.floor(TAPE_CPS * 0.2));
    // easing never carries the old text's progress onto the new text
    expect(meta.lerp(full, changed, 0.1)).toMatchObject({ tapeKey: changed.tapeKey, tapeText: changed.tapeText, tapeChars: 0 });
    expect(pose(input(draft(b.optionIndex), { t: 0, reducedMotion: true })).tapeChars).toBe(changed.tapeText.length);
    expect(meta.audio(changed, input(draft(b.optionIndex), { t: 0 }))).toEqual([{ cue: "teletype", gain: 0.35 }]);
    expect(meta.audio(full, input(draft(a.optionIndex)))).toEqual([]);
  });

  it("the wire hums only while a forecast is set; the record lens follows the probe", () => {
    expect(pose(input(draft(0))).wireAmp).toBe(2);
    expect(pose(input(draft(0), { reducedMotion: true })).wireAmp).toBe(0);
    expect(pose(input(draft(0, { probe: 1956 }), { probe: 1956 })).lensU).toBe(0.5);
    expect(pose(input(draft(0))).lensU).toBeNull();
  });

  it("no reveal text reaches the panel, the pose or the SR text before Verify", () => {
    const secrets = [params.reveal, ...params.options.map((o) => o.explanation), "NOT WHAT HAPPENED", "September 25", "Division"];
    const stat = meta.panelStatic(staticIn());
    const drafts = [null, draft(null), ...VIEW.options.map((o) => draft(o.optionIndex, { probe: 1957.7 })), ...VIEW.options.map((o) => draft(null, { hover: String(o.optionIndex) }))];
    for (const d of drafts) {
      for (const t of [0, 0.5, 5]) {
        const i = input(d, { t, probe: d?.probe ?? null });
        const p = pose(i);
        const blob = JSON.stringify([stat, meta.panelLive(stat, i), p, meta.describe(p, i)]);
        for (const s of secrets) expect(blob).not.toContain(s);
        const live = meta.panelLive(stat, i);
        const claims = live.liveCards.find((c) => c.kind === "claims");
        expect(claims?.kind === "claims" && claims.items.every((it) => it.state !== "honest" && it.state !== "struck")).toBe(true);
        expect(live.highlights.every((h) => h.state !== "struck")).toBe(true);
      }
    }
  });

  it("payoffLamps is success-only: permuting it changes nothing before Verify", () => {
    const other = { ...CONFIG, payoffLamps: 3 };
    for (const d of [null, draft(0), draft(2, { hover: "1" })]) {
      const a = input(d);
      const b = { ...a, config: other };
      expect(pose(b)).toEqual(pose(a));
      expect(meta.describe(pose(b), b)).toEqual(meta.describe(pose(a), a));
      expect(meta.panelLive(meta.panelStatic(staticIn({ config: other })), b)).toEqual(meta.panelLive(meta.panelStatic(staticIn()), a));
      expect(pose(a).lamps).toBe(0);
    }
    const solvedIn = input(draft(0), { solved: true });
    expect(meta.solvedPose(solvedIn)).toMatchObject({ lamps: 9, barrier: 0, wireGlow: 1, printed: true, solved: true });
    const plan = meta.successPlan(solvedIn, "barrier_dissolves");
    const lamps = plan.beats.filter((b) => b.anchor === "lamps");
    expect(lamps).toHaveLength(9);
    expect(lamps.map((b) => b.atMs)).toEqual([...lamps.map((b) => b.atMs)].sort((x, y) => x - y));
    expect(plan.durationMs).toBeGreaterThanOrEqual(1200);
    expect(plan.durationMs).toBeLessThanOrEqual(2500);
    expect(Math.max(...plan.beats.map((b) => b.atMs))).toBeLessThan(plan.durationMs);
    expect(plan.beats.find((b) => b.action === "dissolve")?.params).toMatchObject({ anim: "barrier_dissolves" });
    expect(meta.successPlan(input(draft(0), { solved: true, config: { ...CONFIG, payoffLamps: 0 } }), "door_opens").beats.some((b) => b.anchor === "lamps")).toBe(false);
  });

  it("puts FILE first when the RECORD card shows (fileDates on the year axis), then the forecast board", () => {
    const stat: PanelStatic = meta.panelStatic(staticIn());
    expect(stat.cards.map((c) => [c.kind, c.slot, "title" in c ? c.title : ""])).toEqual([
      ["timeline", 0, "FILE"],
      ["claims", 1, "FORECAST"],
    ]);
    const file = stat.cards[0];
    expect(file.kind === "timeline" && file.from === 1954 && file.to === 1958).toBe(true);
    expect(file.kind === "timeline" && file.pins.map((p) => [p.at, p.label])).toEqual([[fracYearOf("1957-09"), "Guard posted"]]);
    const claims = stat.cards[1];
    expect(claims.kind === "claims" && claims.scenario).toBe(params.scenario);
    expect(claims.kind === "claims" && claims.items.map((i) => [i.key, i.letter])).toEqual([
      ["2", "A"],
      ["0", "B"],
      ["1", "C"],
    ]);
    expect(stat).toMatchObject({ input: null, probe: CONFIG.probe, recordPins: [] });
    // outside a history game with nothing dated there is no FILE card
    const bare = meta.panelStatic(staticIn({ record: false, config: OracleTickerConfig.parse({}) }));
    expect(bare.cards.map((c) => [c.kind, c.slot])).toEqual([["claims", 0]]);
  });

  it("the live panel: readout MAR-style, FILE chip within ±2 months, aimed item and footprint", () => {
    const stat = meta.panelStatic(staticIn());
    const at = fracYearOf("1957-10")!;
    const live = meta.panelLive(stat, input(draft(VIEW.options[1].optionIndex, { probe: at }), { probe: at }));
    expect(live).toMatchObject({ scrubX: at, readout: "OCT 1957" });
    expect(live.chips).toEqual([{ slot: 0, value: at, text: "SEP 1957 · GUARD POSTED", color: "g" }]);
    expect(live.highlights).toEqual([{ slot: 1, key: String(VIEW.options[1].optionIndex), state: "placed" }]);
    const claims = live.liveCards.find((c) => c.kind === "claims");
    expect(claims?.kind === "claims" && claims.items.map((i) => i.state)).toEqual(["idle", "aimed", "idle"]);
    const hover = meta.panelLive(stat, input(draft(null, { hover: "2" })));
    expect(hover.highlights).toEqual([{ slot: 1, key: "2", state: "hover" }]);
    expect(hover.chips).toEqual([]);
    // option footprints (when a config draws them) follow the aim: aimed green, the rest dim
    const fpConfig = OracleTickerConfig.parse({
      ...CONFIG,
      options: [0, 1, 2].map((optionIndex) => ({ optionIndex, footprint: { kind: "pin", from: "1957", to: null, label: `claim ${optionIndex}` } })),
    });
    const fpLive = meta.panelLive(meta.panelStatic(staticIn({ config: fpConfig })), input(draft(1), { config: fpConfig }));
    const file = fpLive.liveCards.find((c) => c.kind === "timeline");
    expect(file?.kind === "timeline" && file.pins.filter((p) => p.key.startsWith("fp:")).map((p) => [p.key, p.style])).toEqual([
      ["fp:0", "dim"],
      ["fp:1", "draft"],
      ["fp:2", "dim"],
    ]);
  });

  it("the failure plan prints the reveal, stamps the picked forecast and unlocks the selector (wrongKeys[0] only)", () => {
    const picked = VIEW.options[2].optionIndex;
    const d: Diagnosis = { correct: false, feedback: "…", displayFeedback: "…", failKey: "wrong_option", wrongKeys: [String(picked)], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [] };
    const plan = meta.failurePlan(d, input(draft(picked)));
    expect(plan.beats.map((b) => [b.anchor, b.action])).toEqual([
      ["teletype", "flash"],
      ["teletype", "hold_bright"],
      ["knob", "unseat"],
    ]);
    expect(plan.beats[1].params).toMatchObject({ stamp: "NOT WHAT HAPPENED", optionIndex: picked });
    expect(plan.beats[2].params).toMatchObject({ optionIndex: picked, position: 2 });
    expect(plan.durationMs).toBeGreaterThanOrEqual(600);
    expect(plan.durationMs).toBeLessThanOrEqual(1600);
    expect(plan.beats.some((b) => ["spark", "scatter", "snap"].includes(b.action))).toBe(false); // sensitiveSafe
    expect(meta.failurePlan({ ...d, wrongKeys: [] }, input(draft(picked))).beats).toHaveLength(1);
  });

  it("describes the world for screen readers and chips the knob", () => {
    const p = pose(input(draft(VIEW.options[1].optionIndex), { t: 10 }));
    const desc = meta.describe(p, input(draft(1)));
    expect(desc.srText).toBe("The selector points at forecast B; the teletype types it and the wire hums.");
    expect(desc.chips[0]).toEqual({ anchor: "knob", text: "FORECAST B", color: "accent" });
    expect(desc.nearMiss).toBeNull();
    expect(meta.describe(pose(input(null)), input(null)).srText).toMatch(/rests/);
    expect(meta.describe(meta.solvedPose(input(draft(0), { solved: true })), input(null)).srText).toMatch(/confirmed/);
  });

  it("hint targets follow civil §5.3; lerp eases the knob and snaps discrete fields", () => {
    const si = staticIn();
    expect(meta.hintTargets(1, si)).toEqual([{ anchor: "wire_end", action: "circle", holdMs: 1800 }]);
    expect(meta.hintTargets(2, si)).toEqual([{ anchor: "knob", action: "land", holdMs: 2000 }]);
    expect(meta.hintTargets(3, si)).toEqual([{ anchor: "teletype", action: "hover", holdMs: 1500 }]);
    const a = pose(input(draft(VIEW.options[0].optionIndex)));
    const b = pose(input(draft(VIEW.options[2].optionIndex)));
    expect(meta.lerp(a, b, 0.25).knobDeg).toBe(-20);
    expect(meta.lerp(a, b, 0.25).position).toBe(0);
    expect(meta.lerp(a, b, 0.75).position).toBe(2);
    expect(meta.lerp(a, b, 1)).toEqual(b);
    expect(meta.debug(b)).toMatchObject({ knobDeg: 40, position: 2, solved: false });
  });
});
