import { describe, expect, it } from "vitest";
import cellFixture from "../../../../../fixtures/cell-transport-dungeon.json";
import civilFixture from "../../../../../fixtures/civil-rights-dungeon.json";
import trigFixture from "../../../../../fixtures/trig-dungeon.json";
import { GameSpec } from "../../../../contracts/gamespec";
import { getMode } from "../../../../mechanics/registry";
import * as D from "../../../../world/draft-inputs";
import type { ControlKind, ModeKey } from "../../../../world/types";
import * as Aim from "./aim.logic";
import * as Bins from "./bins.logic";
import * as Cables from "./cables.logic";
import { controlKindForMode } from "./kinds";
import * as Matrix from "./matrix.logic";
import * as Scrub from "./scrub.logic";
import * as Slots from "./slots.logic";
import * as Tubes from "./tubes.logic";
import * as Waves from "./waves.logic";

const SPECS = [trigFixture, cellFixture, civilFixture].map((f) => GameSpec.parse(f));
const PI = Math.PI;

interface Case {
  specId: string;
  id: string;
  modeKey: ModeKey;
  view: unknown;
  params: unknown;
  solution: unknown;
  solutionInput: unknown;
  grade: (input: unknown) => { correct: boolean };
}
const CASES: Case[] = SPECS.flatMap((spec) =>
  spec.encounters.map((e, index) => {
    const mode = getMode(e.familyId, e.mode)!;
    return {
      specId: spec.id,
      id: e.id,
      modeKey: D.modeKeyOf(e),
      view: mode.present(e.params, spec.seed + index),
      params: e.params,
      solution: e.solution,
      solutionInput: mode.solutionInput(e.params, e.solution),
      grade: (input: unknown) => mode.grade(e.params, input),
    };
  }),
);

/** Drives a control's logic THROUGH ITS ACTIONS (not fromDraftInput) to the solution, returning its draft input. */
function solveThroughActions(kind: ControlKind, c: Case): { draftInput: unknown; complete: boolean } {
  const sol = c.solutionInput as Record<string, unknown>;
  switch (kind) {
    case "scrub": {
      const input = Scrub.scalarInputOf(c.modeKey, c.view)!;
      let s = Scrub.initialScrub(input, null);
      // walk there with the keyboard as far as the grid allows, then set the exact solution as a pointer would
      for (let i = 0; i < 400 && s.value < (sol.value as number) - input.step; i++) s = { value: Scrub.stepValue(s.value, "inc", false, input) };
      s = { value: sol.value as number };
      return { draftInput: Scrub.toDraftInput(s), complete: Scrub.complete(s) };
    }
    case "aim": {
      let s = Aim.initialAim(c.modeKey, null);
      const model = Aim.aimModelOf(c.modeKey, c.view);
      for (const it of model.items) s = Aim.hover(s, it.index);
      const target = (c.modeKey === "truth_finder.predict_reveal" ? sol.optionIndex : sol.statementIndex) as number;
      s = Aim.choose(Aim.hover(s, null), target);
      return { draftInput: Aim.toDraftInput(s), complete: Aim.complete(s) };
    }
    case "slots": {
      let s = Slots.fromDraftInput(null, c.view);
      const keys = sol.keys as string[];
      // place them in reverse into the wrong slots first, then fix by moving each into place
      [...keys].reverse().forEach((k) => (s = Slots.place(s, k)));
      keys.forEach((k, i) => (s = Slots.place(s, k, i)));
      return { draftInput: Slots.toDraftInput(s), complete: Slots.complete(s) };
    }
    case "bins": {
      let s = Bins.fromDraftInput(null, c.view);
      const rows = sol.assignments as { itemKey: string; binId: string }[];
      const bins = Bins.binsOf(c.view);
      for (const r of rows) s = Bins.assign(s, r.itemKey, bins.find((b) => b.id !== r.binId)?.id ?? r.binId); // wrong first
      for (const r of rows) s = Bins.assign(Bins.select(s, r.itemKey), r.itemKey, r.binId);
      return { draftInput: Bins.toDraftInput(s), complete: Bins.complete(s, c.view) };
    }
    case "waves": {
      let s = Waves.start(c.view);
      const byWave = new Map((sol.answers as { waveIndex: number; categoryId: string }[]).map((a) => [a.waveIndex, a.categoryId]));
      for (const w of Waves.wavesOf(c.view)) {
        s = Waves.tick(s, c.view, 1);
        s = Waves.answer(s, c.view, byWave.get(w.waveIndex)!);
      }
      return { draftInput: Waves.toDraftInput(s), complete: Waves.complete(s) };
    }
    case "cables": {
      let s = Cables.fromDraftInput(null, c.view);
      const links = sol.links as { leftKey: string; rightKey: string }[];
      const rights = Cables.rightsOf(c.view);
      // seat a decoy first, then re-seat every cord through the pick flow
      s = Cables.pickRight(Cables.pickLeft(s, links[0].leftKey), rights[rights.length - 1].key);
      for (const l of links) s = l.leftKey.endsWith("1") ? Cables.pickLeft(Cables.pickRight(s, l.rightKey), l.leftKey) : Cables.pickRight(Cables.pickLeft(s, l.leftKey), l.rightKey);
      return { draftInput: Cables.toDraftInput(s), complete: Cables.complete(s, c.view) };
    }
    case "tubes": {
      let s = Tubes.fromDraftInput(null, c.view);
      const edges = sol.edges as { fromKey: string; toKey: string }[];
      s = Tubes.pickNode(Tubes.pickNode(s, edges[0].fromKey), edges[edges.length - 1].toKey); // a wrong tube, replaced below
      for (const e of edges) s = Tubes.pickNode(Tubes.pickNode(s, e.fromKey), e.toKey);
      return { draftInput: Tubes.toDraftInput(s), complete: Tubes.complete(s, c.view) };
    }
    case "matrix": {
      let s = Matrix.fromDraftInput(null, c.view);
      for (const h of Matrix.hypothesesOf(c.view)) if (h.id !== sol.hypothesisId) s = Matrix.toggleMark(s, 0, h.id);
      s = Matrix.accuse(s, sol.hypothesisId as string);
      return { draftInput: Matrix.toDraftInput(s), complete: Matrix.complete(s) };
    }
    case "widget":
      return { draftInput: c.solutionInput, complete: true };
  }
}

describe("every showcase encounter: the control's solution state → toSubmitInput → grade() is correct", () => {
  it("covers all 29 encounters of the three showcase fixtures", () => {
    expect(CASES.length).toBe(29);
  });
  for (const c of CASES) {
    const kind = controlKindForMode(c.modeKey);
    it(`${c.specId}/${c.id} (${c.modeKey} → ${kind})`, () => {
      expect(kind).not.toBe("widget");
      const { draftInput, complete } = solveThroughActions(kind, c);
      expect(complete, "control reports complete").toBe(true);
      expect(D.isDraftComplete(c.modeKey, draftInput, c.view), "draft-inputs agrees it is complete").toBe(true);
      const submitted = D.toSubmitInput(c.modeKey, draftInput);
      expect(c.grade(submitted).correct).toBe(true);
    });
  }

  it("fromDraftInput ∘ toDraftInput restores every solution state (cached drafts reopen as they were)", () => {
    for (const c of CASES) {
      const kind = controlKindForMode(c.modeKey);
      const draft = D.fromSubmitInput(c.modeKey, c.solutionInput, c.view);
      const again = (() => {
        switch (kind) {
          case "scrub":
            return Scrub.toDraftInput(Scrub.fromDraftInput(draft, Scrub.scalarInputOf(c.modeKey, c.view)!));
          case "aim":
            return Aim.toDraftInput(Aim.fromDraftInput(draft, c.modeKey));
          case "slots":
            return Slots.toDraftInput(Slots.fromDraftInput(draft, c.view));
          case "bins":
            return Bins.toDraftInput(Bins.fromDraftInput(draft, c.view));
          case "waves":
            return Waves.toDraftInput(Waves.fromDraftInput(draft, c.view));
          case "cables":
            return Cables.toDraftInput(Cables.fromDraftInput(draft, c.view));
          case "tubes":
            return Tubes.toDraftInput(Tubes.fromDraftInput(draft, c.view));
          case "matrix":
            return Matrix.toDraftInput(Matrix.fromDraftInput(draft, c.view));
          default:
            return draft;
        }
      })();
      expect(JSON.stringify(D.toSubmitInput(c.modeKey, again)), `${c.specId}/${c.id}`).toBe(JSON.stringify(D.toSubmitInput(c.modeKey, draft)));
    }
  });
});

describe("ScrubControl / Scrubber", () => {
  const e2 = CASES.find((c) => c.id === "e2_period" && c.specId === "trig_demo_001")!;
  const e1 = CASES.find((c) => c.id === "e1_radians")!;
  const e6 = CASES.find((c) => c.id === "e6_boss")!;

  it("derives the scalar input from the view (π dials get π units and a π readout)", () => {
    const i2 = Scrub.scalarInputOf("tuner.oscillator", e2.view)!;
    expect(i2).toMatchObject({ symbol: "T", min: 0, format: "pi", unit: "pi" });
    expect(i2.max).toBeCloseTo(2 * PI);
    expect(i2.step).toBeCloseTo(PI / 12);
    expect(i2.ticks.filter((t) => t.major).map((t) => t.label)).toContain("π/2");
    const i1 = Scrub.scalarInputOf("mapper.number_line", e1.view)!;
    expect(i1).toMatchObject({ symbol: "θ", format: "pi" });
    expect(i1.step).toBeCloseTo(PI / 48);
    const i6 = Scrub.scalarInputOf("tuner.oscillator", e6.view)!;
    expect(i6).toMatchObject({ format: "number", unit: "number", step: 0.05, max: 8 });
    expect(Scrub.scalarInputOf("truth_finder.mimic", {})).toBeNull();
  });

  it("←/→ step, Shift × 10, PgUp/PgDn one major tick, Home/End, always on the step grid", () => {
    const r = Scrub.scalarInputOf("tuner.oscillator", e6.view)!;
    expect(Scrub.stepValue(4, "inc", false, r)).toBe(4.05);
    expect(Scrub.stepValue(4, "dec", true, r)).toBe(3.5);
    expect(Scrub.stepValue(4.2, "pageInc", false, r)).toBe(5);
    expect(Scrub.stepValue(4.2, "pageDec", false, r)).toBe(4);
    expect(Scrub.stepValue(4, "pageDec", false, r)).toBe(3);
    expect(Scrub.stepValue(4, "home", false, r)).toBe(0);
    expect(Scrub.stepValue(4, "end", false, r)).toBe(8);
    expect(Scrub.stepValue(8, "inc", true, r)).toBe(8);
    expect(Scrub.stepValue(0, "dec", false, r)).toBe(0);
    const p = Scrub.scalarInputOf("tuner.oscillator", e2.view)!;
    expect(Scrub.stepValue(PI / 2, "pageInc", false, p)).toBeCloseTo((3 * PI) / 4);
    expect(Scrub.scrubKeyOf("ArrowRight")).toBe("inc");
    expect(Scrub.scrubKeyOf("a")).toBe("dec");
    expect(Scrub.scrubKeyOf("PageUp")).toBe("pageInc");
    expect(Scrub.scrubKeyOf("x")).toBeNull();
    expect(Scrub.valueAtFraction(0.5, r)).toBe(4);
    expect(Scrub.valueAtFraction(2, r)).toBe(8);
  });

  it("stage probes settle on their stops; other probes keep their value", () => {
    const stops = [0, 1, 2, 3, 4, 5, 6].map((v) => ({ v, label: `s${v}` }));
    expect(Scrub.settleValue(2.4, { format: "stage", stops })).toBe(2);
    expect(Scrub.settleValue(2.6, { format: "stage", stops })).toBe(3);
    expect(Scrub.settleValue(2.6, { format: "number", stops })).toBe(2.6);
    expect(Scrub.settleValue(2.6, null)).toBe(2.6);
    expect(Scrub.SETTLE_MS).toBe(300);
  });

  it("a probe spec becomes the Scrubber range (stops as labelled detents)", () => {
    const r = Scrub.rangeOfProbe({ symbol: "k", label: "pump stage", min: 0, max: 6, step: 0.05, unit: "", format: "stage", initial: null, stops: [{ v: 0, label: "rest" }, { v: 3, label: "flip out" }], window: null, playback: false });
    expect(r.ticks.map((t) => t.v)).toEqual([0, 3]);
    expect(r.unit).toBe("stage");
    const y = Scrub.rangeOfProbe({ symbol: "YEAR", label: "record year", min: 1950, max: 1960, step: 1 / 12, unit: "", format: "month_year", initial: null, stops: [], window: { start: 1950, end: 1960 }, playback: false });
    expect(y.unit).toBe("month");
    expect(y.ticks.some((t) => t.label === "1955")).toBe(true);
  });
});

describe("AimControl emits hover and focus drafts without committing", () => {
  it("hover and focus are channels; only choose() changes the input", () => {
    const c = CASES.find((x) => x.id === "e3_amplitude")!;
    let s = Aim.initialAim(c.modeKey, null);
    const before = JSON.stringify(Aim.toDraftInput(s));
    s = Aim.hover(s, 2);
    expect(Aim.channels(s)).toEqual({ focus: null, hover: "2" });
    expect(JSON.stringify(Aim.toDraftInput(s))).toBe(before);
    expect(Aim.complete(s)).toBe(false);
    s = Aim.focus(s, 0);
    expect(Aim.channels(s)).toEqual({ focus: "0", hover: "2" });
    expect(Aim.complete(s)).toBe(false);
    s = Aim.choose(s, 1);
    expect(Aim.toDraftInput(s)).toEqual({ statementIndex: 1 });
    expect(Aim.complete(s)).toBe(true);
    const card = Aim.claimsCardOf(Aim.aimModelOf(c.modeKey, c.view), Aim.hover(s, 0), null);
    // display order is statementIndex [1, 2, 0]: chosen 1 is first, hovered 0 is last
    expect(card.items.map((i) => i.state)).toEqual(["aimed", "idle", "hover"]);
    expect(card.items.map((i) => i.letter)).toEqual(["A", "B", "C"]);
    expect(card.items.some((i) => i.state === "honest" || i.state === "struck")).toBe(false); // no correctness before Verify
  });

  it("predict_reveal aims options and carries the scenario", () => {
    const c = CASES.find((x) => x.id === "e3_little_rock")!;
    const model = Aim.aimModelOf(c.modeKey, c.view);
    expect(model.kind).toBe("option");
    expect(model.scenario).toMatch(/Faubus/);
    expect(Aim.toDraftInput(Aim.choose(Aim.initialAim(c.modeKey, null), 0))).toEqual({ optionIndex: 0 });
  });
});

describe("WaveControl", () => {
  const c = CASES.find((x) => x.id === "e5_tonicity")!;
  const waves = Waves.wavesOf(c.view);

  it("enables Verify only after the last wave (answered or timed out); a timeout leaves the wave unanswered", () => {
    let s = Waves.start(c.view);
    expect(Waves.waveChannel(s, c.view)).toEqual({ index: 0, secondsLeft: 8, secondsPerWave: 8 });
    for (let i = 0; i < waves.length - 1; i++) {
      s = Waves.answer(s, c.view, "isotonic");
      expect(Waves.complete(s), `after wave ${i + 1}`).toBe(false);
    }
    s = Waves.tick(s, c.view, 3);
    expect(Waves.waveChannel(s, c.view)?.secondsLeft).toBe(5);
    expect(Waves.complete(s)).toBe(false);
    s = Waves.tick(s, c.view, 5); // the last wave times out
    expect(Waves.complete(s)).toBe(true);
    expect(Waves.waveChannel(s, c.view)).toBeNull();
    expect(s.answers.length).toBe(waves.length - 1);
    const input = D.toSubmitInput(c.modeKey, Waves.toDraftInput(s));
    expect(c.grade(input).correct).toBe(false);
  });

  it("retry replays from wave 1 with the previous answers preselected (Enter confirms each)", () => {
    let s = Waves.start(c.view);
    const picks = ["hypotonic", "hypertonic", "isotonic", "hypertonic", "isotonic"];
    for (const p of picks) s = Waves.answer(s, c.view, p);
    expect(Waves.complete(s)).toBe(true);
    s = Waves.retry(s, c.view);
    expect(Waves.complete(s)).toBe(false);
    expect(s.index).toBe(0);
    expect(s.answers).toEqual([]);
    for (let i = 0; i < picks.length; i++) {
      expect(s.focus, `wave ${i} preselected`).toBe(picks[i]);
      s = Waves.answer(s, c.view, s.focus!); // "Enter"
    }
    expect(Waves.complete(s)).toBe(true);
    expect(Waves.toDraftInput(s).answers.map((a) => a.categoryId)).toEqual(picks);
  });

  it("a partial cached draft restores as a replay with its answers preselected", () => {
    const s = Waves.fromDraftInput({ answers: [{ waveIndex: 0, categoryId: "hypertonic" }] }, c.view);
    expect(Waves.complete(s)).toBe(false);
    expect(s.focus).toBe("hypertonic");
  });
});

describe("MatrixControl never puts marks in the input", () => {
  it("toDraftInput carries only the accused hypothesis; marks are a separate UI-only channel", () => {
    const c = CASES.find((x) => x.id === "e12_boss")!;
    const hyps = Matrix.hypothesesOf(c.view);
    let s = Matrix.fromDraftInput(null, c.view);
    for (const cl of Matrix.cluesOf(c.view)) for (const h of hyps.slice(0, 2)) s = Matrix.toggleMark(s, cl.index, h.id);
    expect(Matrix.marksOf(s).length).toBeGreaterThan(0);
    expect(Matrix.toDraftInput(s)).toEqual({ hypothesisId: null });
    expect(Matrix.complete(s)).toBe(false);
    s = Matrix.accuse(s, hyps[3].id);
    const input = Matrix.toDraftInput(s);
    expect(Object.keys(input)).toEqual(["hypothesisId"]);
    expect(JSON.stringify(D.toSubmitInput(c.modeKey, input))).not.toMatch(/clueIndex|marks/);
    expect(Matrix.struckCount(s, hyps[0].id)).toBe(Matrix.cluesOf(c.view).length);
    s = Matrix.toggleMark(s, 0, hyps[0].id);
    expect(Matrix.isMarked(s, 0, hyps[0].id)).toBe(false);
    const card = Matrix.matrixCardOf(c.view, s, null);
    expect(card.accused).toBe(hyps[3].id);
    expect(card.marks.length).toBe(Matrix.marksOf(s).length);
  });
});

describe("RouterControl boss phases", () => {
  const c = CASES.find((x) => x.id === "e11_boss")!;
  const phases = [
    { id: "p1", itemKeys: ["i0", "i1"] },
    { id: "p2", itemKeys: ["i2", "i3"] },
    { id: "p3", itemKeys: ["i4", "i5", "i6"] },
  ];
  it("reveals the next batch only when the previous batch is placed; complete only when all are placed", () => {
    let s = Bins.fromDraftInput(null, c.view);
    const vis = () => Bins.visibleItems(c.view, s, phases).map((i) => i.key).sort();
    expect(vis()).toEqual(["i0", "i1"]);
    s = Bins.assign(s, "i0", "simple");
    expect(vis()).toEqual(["i0", "i1"]);
    s = Bins.assign(s, "i1", "facilitated");
    expect(vis()).toEqual(["i0", "i1", "i2", "i3"]);
    expect(Bins.currentPhase(s, phases)).toBe(1);
    s = Bins.assign(Bins.assign(s, "i2", "active"), "i3", "facilitated");
    expect(vis()).toEqual(["i0", "i1", "i2", "i3", "i4", "i5", "i6"]);
    expect(Bins.complete(s, c.view)).toBe(false);
    s = Bins.assign(Bins.assign(Bins.assign(s, "i4", "simple"), "i5", "active"), "i6", "facilitated");
    expect(Bins.complete(s, c.view)).toBe(true);
    expect(Bins.countsOf(c.view, s)).toEqual({ simple: 2, facilitated: 3, active: 2 });
  });
  it("re-routing an item keeps its first-insertion position (the widget's Record order)", () => {
    let s = Bins.fromDraftInput(null, c.view);
    s = Bins.assign(Bins.assign(Bins.assign(s, "i3", "active"), "i0", "simple"), "i3", "facilitated");
    expect(s.assignments).toEqual([
      { itemKey: "i3", binId: "facilitated" },
      { itemKey: "i0", binId: "simple" },
    ]);
    expect(Bins.unassign(s, "i3").assignments.length).toBe(1);
    expect(Bins.visibleItems(c.view, s, []).length).toBe(7);
  });
});

describe("SlotRail, Cable and Tube logic", () => {
  it("slots: place fills the first empty slot, moving a plank swaps, remove returns it to the tray", () => {
    const c = CASES.find((x) => x.id === "e4_solve")!;
    let s = Slots.fromDraftInput(null, c.view);
    expect(s.slots).toEqual([null, null, null, null]);
    s = Slots.place(s, "s1");
    s = Slots.place(s, "s0");
    expect(s.slots).toEqual(["s1", "s0", null, null]);
    s = Slots.place(s, "s0", 0);
    expect(s.slots).toEqual(["s0", "s1", null, null]);
    s = Slots.place(s, "d0", 1);
    expect(s.slots).toEqual(["s0", "d0", null, null]);
    expect(Slots.trayOf(c.view, s).map((p) => p.key).sort()).toEqual(["s1", "s2", "s3"]);
    s = Slots.remove(s, 1);
    expect(s.slots).toEqual(["s0", null, null, null]);
    expect(Slots.complete(s)).toBe(false);
    const card = Slots.slotRailCardOf(c.view, s, null);
    expect(card.slots[0]).toMatchObject({ key: "s0", lamp: "on" });
    expect(card.slots[1]).toMatchObject({ key: null, lamp: "off" });
  });

  it("cables: one cord per jack, re-seating moves it; lamps are seated (white), never correct/incorrect", () => {
    const c = CASES.find((x) => x.id === "e8_pump")!;
    let s = Cables.fromDraftInput(null, c.view);
    s = Cables.link(s, "l0", "r0");
    s = Cables.link(s, "l1", "r0");
    expect(s.links).toEqual([{ leftKey: "l1", rightKey: "r0" }]);
    s = Cables.pickLeft(s, "l0");
    expect(s.selectedLeft).toBe("l0");
    s = Cables.pickRight(s, "x0");
    expect(Cables.rightOf(s, "l0")).toBe("x0");
    const card = Cables.linkBoardCardOf(c.view, s, null, "l0");
    expect(card.links.map((l) => l.state).sort()).toEqual(["focus", "seated"]);
    expect(Cables.complete(s, c.view)).toBe(false);
  });

  it("tubes: pick → pick lays a tube; one outgoing tube per housing; complete at edgeCount", () => {
    const c = CASES.find((x) => x.id === "e5_freedom_rides")!;
    let s = Tubes.fromDraftInput(null, c.view);
    s = Tubes.pickNode(s, "n0");
    expect(s.from).toBe("n0");
    s = Tubes.pickNode(s, "n0");
    expect(s.from).toBeNull();
    s = Tubes.pickNode(Tubes.pickNode(s, "n0"), "d0");
    s = Tubes.pickNode(Tubes.pickNode(s, "n0"), "n1");
    expect(s.edges).toEqual([{ fromKey: "n0", toKey: "n1" }]);
    expect(Tubes.complete(s, c.view)).toBe(false);
    const card = Tubes.causeGraphCardOf(c.view, s, null, null);
    expect(card.nodes.length).toBe(6);
    expect(card.nodes.every((n) => n.x > 0 && n.x < 1 && n.y > 0 && n.y < 1)).toBe(true);
  });
});

describe("controlFor kinds", () => {
  it("each showcase mode's native control equals its §4 archetype meta.control, and supports the fixture views", async () => {
    const { AUTO_ARCHETYPE_BY_MODE, getContraption } = await import("../../../../world/library");
    const { resolveControlKind, supports } = await import("./kinds");
    for (const c of CASES) {
      const archetype = (AUTO_ARCHETYPE_BY_MODE as Readonly<Record<string, string>>)[c.modeKey];
      const meta = getContraption(archetype);
      expect(meta?.control, `${c.modeKey} → ${archetype}`).toBe(controlKindForMode(c.modeKey));
      expect(supports(controlKindForMode(c.modeKey), c.modeKey, c.view), `${c.specId}/${c.id}`).toBe(true);
      expect(resolveControlKind("widget", c.modeKey, c.view)).toBe("widget");
      expect(resolveControlKind(meta!.control, c.modeKey, { nope: true })).toBe("widget");
    }
    expect(controlKindForMode("recall.cloze" as ModeKey)).toBe("widget");
  });
});
