import { describe, expect, it } from "vitest";
import { CONTRAPTION_LIBRARY, contraptionFor, contraptionsForMode, implementedModeKeys, skinOf } from "../library";
import { makeDraft } from "../draft-inputs";
import type { Diagnosis, ModeKey, PoseInput } from "../types";
import { CONSOLE_SLATE_SKINS, consoleSlateMeta, consoleSlatePose, type ConsoleSlateConfig } from "./console-slate.meta";

const input = (over: Partial<PoseInput<ConsoleSlateConfig, null>> = {}): PoseInput<ConsoleSlateConfig, null> => ({
  view: {},
  draft: null,
  config: { slateTitle: null },
  probe: null,
  t: 0.25,
  aidTier: 0,
  hintsUsed: 0,
  sim: null,
  solved: false,
  reducedMotion: false,
  ...over,
});
const diagnosis: Diagnosis = { correct: false, feedback: "", displayFeedback: "", failKey: null, wrongKeys: [], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [] };

describe("console_slate meta", () => {
  it("hosts every implemented mode (contraptionFor is total)", () => {
    const modes = implementedModeKeys();
    expect(modes.length).toBeGreaterThan(20);
    expect([...CONTRAPTION_LIBRARY.console_slate.modes].sort()).toEqual([...modes].sort());
    for (const m of modes) {
      expect(contraptionFor(m).modes).toContain(m);
      const all = contraptionsForMode(m);
      expect(all[all.length - 1].id).toBe("console_slate");
    }
  });

  it("its skin's snapshot parts exist and use shared kit keys", () => {
    const skin = skinOf(consoleSlateMeta, "lectern_slate");
    expect(skin).toBeDefined();
    expect(skin?.snapshot.dormant.length).toBeGreaterThan(0);
    expect(skin?.snapshot.solved.length).toBeGreaterThan(0);
    for (const p of [...(skin?.snapshot.dormant ?? []), ...(skin?.snapshot.solved ?? [])]) expect(p.asset.startsWith("shared.part.lectern_slate_")).toBe(true);
    for (const a of ["slate", "gate", "console"]) expect(skin?.anchors).toContain(a);
    expect(CONSOLE_SLATE_SKINS[0].sensitiveSafe).toBe(true);
  });

  it("the slate lights with a draft, pulses when complete, opens the gate only when solved", () => {
    expect(consoleSlatePose(input())).toMatchObject({ slate: 0.45, mirrors: false, gate: 0, pulse: 0 });
    const draft = makeDraft("e1", "tuner.oscillator" as ModeKey, { value: 1 });
    expect(consoleSlatePose(input({ draft }))).toMatchObject({ slate: 0.9, mirrors: true, complete: draft.complete });
    const complete = { ...draft, complete: true };
    expect(consoleSlatePose(input({ draft: complete })).pulse).toBeCloseTo(1);
    expect(consoleSlatePose(input({ draft: complete, reducedMotion: true })).pulse).toBe(0);
    expect(consoleSlatePose(input({ solved: true }))).toMatchObject({ slate: 1, gate: 1, solved: true });
    expect(consoleSlatePose(input({ aidTier: 2 })).aid).toBe(1);
    expect(consoleSlateMeta.solvedPose(input())).toMatchObject({ gate: 1, slate: 1, solved: true });
  });

  it("describes for screen readers and pins the slate title", () => {
    const d = consoleSlateMeta.describe(consoleSlatePose(input()), input({ config: { slateTitle: "BRIDGE" } }));
    expect(d.srText).toMatch(/dim/);
    expect(d.pins).toEqual([{ anchor: "slate", text: "BRIDGE", glyph: null }]);
    expect(consoleSlateMeta.describe(consoleSlatePose(input({ solved: true })), input()).srText).toMatch(/open/);
    const complete = { ...makeDraft("e1", "tuner.oscillator" as ModeKey, { value: 1 }), complete: true };
    expect(consoleSlateMeta.describe(consoleSlatePose(input({ draft: complete })), input()).srText).toMatch(/Verify/);
    expect(consoleSlateMeta.describe(consoleSlatePose(input({ draft: { ...complete, complete: false } })), input()).srText).toMatch(/mirrors/);
  });

  it("plans stay inside the game-feel budgets and act on the skin anchors", () => {
    const fail = consoleSlateMeta.failurePlan(diagnosis, input());
    expect(fail.durationMs).toBeGreaterThanOrEqual(600);
    expect(fail.durationMs).toBeLessThanOrEqual(1600);
    expect(consoleSlateMeta.failurePlan(diagnosis, input({ reducedMotion: true })).beats[1].action).toBe("dim");
    for (const anim of ["gate_lifts", "vault_opens"] as const) {
      const ok = consoleSlateMeta.successPlan(input({ solved: true }), anim);
      expect(ok.durationMs).toBeGreaterThanOrEqual(1200);
      expect(ok.durationMs).toBeLessThanOrEqual(2500);
      for (const b of ok.beats) expect(CONSOLE_SLATE_SKINS[0].anchors).toContain(b.anchor);
    }
    const st = { view: {}, config: { slateTitle: null }, aidTier: 0 as const, hintsUsed: 0 as const, reducedMotion: false, skinId: "lectern_slate", record: false };
    for (const rung of [1, 2, 3] as const) expect(consoleSlateMeta.hintTargets(rung, st).length).toBeGreaterThan(0);
    expect(consoleSlateMeta.hintTargets(1, { ...st, skinId: "unknown" }).length).toBeGreaterThan(0);
  });

  it("the rest of the live half is inert and lerps numbers", () => {
    expect(consoleSlateMeta.probe({ slateTitle: null }, {})).toBeNull();
    expect(consoleSlateMeta.panelStatic({ view: {}, config: { slateTitle: null }, aidTier: 0, hintsUsed: 0, reducedMotion: false, skinId: "lectern_slate", record: false }).cards).toEqual([]);
    expect(consoleSlateMeta.audio(consoleSlatePose(input()), input())).toEqual([]);
    const mid = consoleSlateMeta.lerp(consoleSlatePose(input()), consoleSlatePose(input({ solved: true })), 0.5);
    expect(mid.gate).toBeCloseTo(0.5);
    expect(consoleSlateMeta.debug(consoleSlatePose(input())).slate).toBe(0.45);
    expect(consoleSlateMeta.footprint({ slateTitle: null }).left).toBe(140);
    expect(consoleSlateMeta.frameBounds({ slateTitle: null }, {}).w).toBe(840);
    expect(consoleSlateMeta.defaultConfig({} as never)).toEqual({ slateTitle: null });
  });
});
