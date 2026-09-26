import { describe, expect, it } from "vitest";
import { cutsceneOf, encounterOf, hostFrozen, INITIAL_PHASE, panelVisible, reduce, reduceAll, type MachineEvent, type Phase } from "./machine";

const EXPLORE: Phase = { kind: "explore" };
const panel = (encounterId = "e1"): Phase => ({ kind: "panel", encounterId });

describe("phase machine: boot and intro", () => {
  it("loading → intro when the world has an intro, → explore otherwise", () => {
    expect(reduce(INITIAL_PHASE, { type: "ASSETS_READY", introId: "intro" })).toEqual({ kind: "intro", cutsceneId: "intro" });
    expect(reduce(INITIAL_PHASE, { type: "ASSETS_READY", introId: null })).toEqual(EXPLORE);
  });
  it("intro —CUTSCENE_DONE→ explore; a stale completion of another cutscene is ignored", () => {
    const intro: Phase = { kind: "intro", cutsceneId: "intro" };
    expect(reduce(intro, { type: "CUTSCENE_DONE" })).toEqual(EXPLORE);
    expect(reduce(intro, { type: "CUTSCENE_DONE", cutsceneId: "intro" })).toEqual(EXPLORE);
    expect(reduce(intro, { type: "CUTSCENE_DONE", cutsceneId: "e6_arena" })).toBe(intro);
  });
  it("loading ignores everything but ASSETS_READY", () => {
    const events: MachineEvent[] = [
      { type: "CUTSCENE_DONE" },
      { type: "INTERACT_STATION", encounterId: "e1", isCurrent: true },
      { type: "BACK" },
      { type: "VERIFIED", encounterId: "e1", correct: true },
    ];
    for (const e of events) expect(reduce(INITIAL_PHASE, e)).toBe(INITIAL_PHASE);
  });
});

describe("phase machine: explore ⇄ panel", () => {
  it("only the current encounter opens the panel", () => {
    expect(reduce(EXPLORE, { type: "INTERACT_STATION", encounterId: "e2", isCurrent: true })).toEqual(panel("e2"));
    expect(reduce(EXPLORE, { type: "INTERACT_STATION", encounterId: "e1", isCurrent: false })).toBe(EXPLORE);
  });
  it("D9: BACK closes the panel without grading", () => {
    expect(reduce(panel(), { type: "BACK" })).toEqual(EXPLORE);
  });
  it("a wrong Verify resolves back to the SAME panel (the draft is kept, the control is not remounted)", () => {
    const p = reduceAll(panel("e2"), [
      { type: "VERIFIED", encounterId: "e2", correct: false },
      { type: "RESOLVE_DONE" },
    ]);
    expect(p).toEqual(panel("e2"));
    expect(reduce(panel("e2"), { type: "VERIFIED", encounterId: "e2", correct: false })).toEqual({ kind: "resolving", encounterId: "e2", correct: false });
  });
  it("a right Verify goes resolving → payoff → explore", () => {
    const steps: MachineEvent[] = [
      { type: "VERIFIED", encounterId: "e2", correct: true },
      { type: "RESOLVE_DONE" },
      { type: "PAYOFF_DONE", runnerFinished: false, finaleId: "finale" },
    ];
    let p = panel("e2");
    const seen: string[] = [];
    for (const e of steps) {
      p = reduce(p, e);
      seen.push(p.kind);
    }
    expect(seen).toEqual(["resolving", "payoff", "explore"]);
  });
  it("VERIFIED for another encounter than the open panel is ignored", () => {
    const p = panel("e2");
    expect(reduce(p, { type: "VERIFIED", encounterId: "e3", correct: true })).toBe(p);
  });
  it("the panel ignores cutscene starts and interactions (no double-open, no cutscene over the panel)", () => {
    const p = panel("e2");
    expect(reduce(p, { type: "CUTSCENE_START", cutsceneId: "e6_arena", purpose: "arena" })).toBe(p);
    expect(reduce(p, { type: "INTERACT_STATION", encounterId: "e2", isCurrent: true })).toBe(p);
    expect(reduce(p, { type: "INTERACT_SANDBOX", sandboxId: "box" })).toBe(p);
  });
  it("resolving ignores BACK and a second VERIFIED (no double grading while the world animates)", () => {
    const r: Phase = { kind: "resolving", encounterId: "e2", correct: false };
    expect(reduce(r, { type: "BACK" })).toBe(r);
    expect(reduce(r, { type: "VERIFIED", encounterId: "e2", correct: true })).toBe(r);
  });
});

describe("phase machine: D1 and D2 regressions", () => {
  it("D1: the payoff keeps the cleared encounter although the runner already advanced", () => {
    const p = reduceAll(panel("e2_period"), [
      { type: "VERIFIED", encounterId: "e2_period", correct: true },
      { type: "RESOLVE_DONE" },
    ]);
    expect(p).toEqual({ kind: "payoff", encounterId: "e2_period" });
    expect(encounterOf(p)).toBe("e2_period");
  });
  it("D2: clearing the boss plays the finale before the end screen", () => {
    const p = reduceAll(panel("e6_boss"), [
      { type: "VERIFIED", encounterId: "e6_boss", correct: true },
      { type: "RESOLVE_DONE" },
      { type: "PAYOFF_DONE", runnerFinished: true, finaleId: "finale" },
    ]);
    expect(p).toEqual({ kind: "finale", cutsceneId: "finale", clearedId: "e6_boss" });
    expect(reduce(p, { type: "CUTSCENE_DONE", cutsceneId: "finale" })).toEqual({ kind: "finished" });
    expect(reduce(p, { type: "CUTSCENE_DONE", cutsceneId: "e6_arena" })).toBe(p);
  });
  it("a world without a finale cutscene finishes directly", () => {
    const p: Phase = { kind: "payoff", encounterId: "e6_boss" };
    expect(reduce(p, { type: "PAYOFF_DONE", runnerFinished: true, finaleId: null })).toEqual({ kind: "finished" });
  });
});

describe("phase machine: D3 debug sync", () => {
  const phases: Phase[] = [
    INITIAL_PHASE,
    { kind: "intro", cutsceneId: "intro" },
    EXPLORE,
    { kind: "cutscene", cutsceneId: "e6_arena", purpose: "arena" },
    panel(),
    { kind: "resolving", encounterId: "e1", correct: true },
    { kind: "payoff", encounterId: "e1" },
    { kind: "sandbox", sandboxId: "music_box" },
    { kind: "finale", cutsceneId: "finale", clearedId: "e6" },
  ];
  it("DEBUG_SYNC goes to explore from every phase while the runner is not finished", () => {
    for (const p of phases) expect(reduce(p, { type: "DEBUG_SYNC", runnerFinished: false }).kind).toBe("explore");
  });
  it("DEBUG_SYNC goes to finished from every phase once the runner is finished", () => {
    for (const p of phases) expect(reduce(p, { type: "DEBUG_SYNC", runnerFinished: true })).toEqual({ kind: "finished" });
  });
  it("DEBUG_SYNC in explore keeps the same object (no re-render)", () => {
    expect(reduce(EXPLORE, { type: "DEBUG_SYNC", runnerFinished: false })).toBe(EXPLORE);
  });
  it("finished is terminal for everything else", () => {
    const f: Phase = { kind: "finished" };
    expect(reduce(f, { type: "ASSETS_READY", introId: "intro" })).toBe(f);
    expect(reduce(f, { type: "CUTSCENE_DONE" })).toBe(f);
  });
});

describe("phase machine: cutscenes by purpose", () => {
  for (const purpose of ["zone", "exit", "ride", "arena", "trigger"] as const) {
    it(`explore —CUTSCENE_START(${purpose})→ cutscene —CUTSCENE_DONE→ explore`, () => {
      const c = reduce(EXPLORE, { type: "CUTSCENE_START", cutsceneId: `c_${purpose}`, purpose });
      expect(c).toEqual({ kind: "cutscene", cutsceneId: `c_${purpose}`, purpose });
      expect(cutsceneOf(c)).toBe(`c_${purpose}`);
      expect(reduce(c, { type: "CUTSCENE_DONE", cutsceneId: `c_${purpose}` })).toEqual(EXPLORE);
    });
  }
  it("trigger cutscene: a second start while one plays is ignored", () => {
    const c = reduce(EXPLORE, { type: "CUTSCENE_START", cutsceneId: "s7_view", purpose: "trigger" });
    expect(reduce(c, { type: "CUTSCENE_START", cutsceneId: "other", purpose: "trigger" })).toBe(c);
    expect(reduce(c, { type: "INTERACT_STATION", encounterId: "e1", isCurrent: true })).toBe(c);
  });
  it("a stale CUTSCENE_DONE of an earlier cutscene does not end the current one", () => {
    const c = reduce(EXPLORE, { type: "CUTSCENE_START", cutsceneId: "enter_s3", purpose: "zone" });
    expect(reduce(c, { type: "CUTSCENE_DONE", cutsceneId: "enter_s2" })).toBe(c);
  });
});

describe("phase machine: sandboxes and carry payoffs", () => {
  it("explore —INTERACT_SANDBOX→ sandbox —BACK→ explore; the sandbox never grades", () => {
    const s = reduce(EXPLORE, { type: "INTERACT_SANDBOX", sandboxId: "music_box" });
    expect(s).toEqual({ kind: "sandbox", sandboxId: "music_box" });
    expect(reduce(s, { type: "VERIFIED", encounterId: "e1", correct: true })).toBe(s);
    expect(reduce(s, { type: "CUTSCENE_START", cutsceneId: "x", purpose: "trigger" })).toBe(s);
    expect(reduce(s, { type: "BACK" })).toEqual(EXPLORE);
  });
  it("a carry payoff plays its cutscene INSIDE payoff (no cutscene phase), then PAYOFF_DONE → explore", () => {
    const p: Phase = { kind: "payoff", encounterId: "e6_facilitated" };
    expect(reduce(p, { type: "CUTSCENE_START", cutsceneId: "e6_carry", purpose: "ride" })).toBe(p);
    expect(reduce(p, { type: "CUTSCENE_DONE", cutsceneId: "e6_carry" })).toBe(p);
    expect(reduce(p, { type: "PAYOFF_DONE", runnerFinished: false, finaleId: "finale" })).toEqual(EXPLORE);
  });
  it("a ride vehicle after a payoff plays as a cutscene with purpose ride", () => {
    const c = reduce(EXPLORE, { type: "CUTSCENE_START", cutsceneId: "e3_lift_up", purpose: "ride" });
    expect(c).toEqual({ kind: "cutscene", cutsceneId: "e3_lift_up", purpose: "ride" });
  });
});

describe("phase helpers", () => {
  it("hostFrozen: only explore without a blocking line or overlay lets the player move", () => {
    expect(hostFrozen(EXPLORE, false, false)).toBe(false);
    expect(hostFrozen(EXPLORE, true, false)).toBe(true);
    expect(hostFrozen(EXPLORE, false, true)).toBe(true);
    expect(hostFrozen(panel(), false, false)).toBe(true);
    expect(hostFrozen({ kind: "intro", cutsceneId: "i" }, false, false)).toBe(true);
  });
  it("panelVisible covers panel, resolving and payoff", () => {
    expect(panelVisible(panel())).toBe(true);
    expect(panelVisible({ kind: "resolving", encounterId: "e1", correct: false })).toBe(true);
    expect(panelVisible({ kind: "payoff", encounterId: "e1" })).toBe(true);
    expect(panelVisible(EXPLORE)).toBe(false);
    expect(panelVisible({ kind: "sandbox", sandboxId: "b" })).toBe(false);
  });
  it("cutsceneOf and encounterOf", () => {
    expect(cutsceneOf({ kind: "finale", cutsceneId: "finale", clearedId: "e6" })).toBe("finale");
    expect(cutsceneOf(EXPLORE)).toBeNull();
    expect(encounterOf(EXPLORE)).toBeNull();
    expect(encounterOf({ kind: "resolving", encounterId: "e4", correct: true })).toBe("e4");
  });
});
