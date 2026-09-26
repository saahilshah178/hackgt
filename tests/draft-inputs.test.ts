import { describe, expect, it } from "vitest";
import cellFixture from "../fixtures/cell-transport-dungeon.json";
import civilFixture from "../fixtures/civil-rights-mystery.json";
import trigFixture from "../fixtures/trig-dungeon.json";
import { GameSpec } from "../src/contracts/gamespec";
import * as Dial from "../src/game/widgets/Dial";
import * as Link from "../src/game/widgets/Link";
import * as Order from "../src/game/widgets/Order";
import * as Pick from "../src/game/widgets/Pick";
import * as Place from "../src/game/widgets/Place";
import * as Sort from "../src/game/widgets/Sort";
import { getMode, implementedModes } from "../src/mechanics/registry";
import * as D from "../src/world/draft-inputs";
import type { ModeKey } from "../src/world/types";

const SPECS = [trigFixture, cellFixture, civilFixture].map((f) => GameSpec.parse(f));

describe("draft-inputs mirror the widget converters byte for byte", () => {
  it("scalar and pick converters", () => {
    for (const v of [0, 1.5, -2, Math.PI]) {
      expect(D.dialToInput(v)).toEqual(Dial.dialToInput(v));
      expect(D.numberLineToInput(v)).toEqual(Place.numberLineToInput(v));
    }
    for (const i of [0, 2, 5]) {
      expect(D.chestsToInput(i)).toEqual(Pick.chestsToInput(i));
      expect(D.optionsToInput(i)).toEqual(Pick.optionsToInput(i));
    }
    expect(D.eliminationToInput("h_1")).toEqual(Link.eliminationToInput("h_1"));
  });

  it("board converters keep insertion order exactly like the widgets' Records", () => {
    const placed = ["s2", "s0", "s1"];
    expect(D.placedToInput(placed)).toEqual(Order.placedToInput(placed));
    const bins = { i3: "diffuses", i0: "protein", i1: "diffuses" };
    expect(JSON.stringify(D.assignmentsToInput(bins))).toBe(JSON.stringify(Sort.assignmentsToInput(bins)));
    const waves = [{ waveIndex: 1, categoryId: "hyper" }, { waveIndex: 0, categoryId: "iso" }];
    expect(D.wavesToInput(waves)).toEqual(Pick.wavesToInput(waves));
    const links = { l1: "r0", l0: "x0" };
    expect(JSON.stringify(D.pairsToInput(links))).toBe(JSON.stringify(Link.pairsToInput(links)));
    const edges = { n0: "n1", n1: "n2" };
    expect(JSON.stringify(D.chainToInput(edges))).toBe(JSON.stringify(Link.chainToInput(edges)));
  });
});

describe("toSubmitInput", () => {
  it("throws until a draft is structurally complete, then returns the mode Input", () => {
    expect(() => D.toSubmitInput("truth_finder.mimic", { statementIndex: null })).toThrow(D.DraftIncompleteError);
    expect(() => D.toSubmitInput("sequencer.linear", { slots: ["s0", null] })).toThrow(/slot is empty/);
    expect(() => D.toSubmitInput("tuner.oscillator", { value: Number.NaN })).toThrow(D.DraftIncompleteError);
    expect(() => D.toSubmitInput("investigator.elimination", { hypothesisId: null })).toThrow(D.DraftIncompleteError);
    expect(D.toSubmitInput("truth_finder.mimic", { statementIndex: 2 })).toEqual({ statementIndex: 2 });
    expect(D.toSubmitInput("sorter.bins", { assignments: [{ itemKey: "i0", binId: "a" }, { itemKey: "i0", binId: "b" }] })).toEqual({
      assignments: [{ itemKey: "i0", binId: "b" }],
    });
  });

  it("passes widget-emitted inputs through for every other implemented mode", () => {
    const others = implementedModes().filter((m) => !D.isDraftMode(m.key));
    expect(others.length).toBeGreaterThan(40);
    for (const { key } of others) {
      expect(() => D.toSubmitInput(key as ModeKey, null), key).toThrow(D.DraftIncompleteError);
      expect(D.toSubmitInput(key as ModeKey, { anything: [1, 2] }), key).toEqual({ anything: [1, 2] });
    }
  });

  it("round-trips every showcase solution through fromSubmitInput → toSubmitInput → grade()", () => {
    let checked = 0;
    for (const spec of SPECS) {
      spec.encounters.forEach((e, index) => {
        const modeKey = D.modeKeyOf(e);
        const mode = getMode(e.familyId, e.mode)!;
        const view = mode.present(e.params, spec.seed + index);
        const solutionInput = mode.solutionInput(e.params, e.solution);
        const draftInput = D.fromSubmitInput(modeKey, solutionInput, view);
        expect(D.isDraftComplete(modeKey, draftInput, view), `${spec.id}/${e.id} complete`).toBe(true);
        const submitted = D.toSubmitInput(modeKey, draftInput);
        expect(mode.grade(e.params, submitted).correct, `${spec.id}/${e.id}`).toBe(true);
        checked++;
      });
    }
    expect(checked).toBe(29);
  });

  it("empty drafts are incomplete for every discrete showcase encounter", () => {
    for (const spec of SPECS) {
      spec.encounters.forEach((e, index) => {
        const modeKey = D.modeKeyOf(e);
        const view = getMode(e.familyId, e.mode)!.present(e.params, spec.seed + index);
        const empty = D.emptyDraftInput(modeKey, view);
        const scalar = modeKey === "tuner.oscillator" || modeKey === "mapper.number_line";
        expect(D.isDraftComplete(modeKey, empty, view), `${spec.id}/${e.id}`).toBe(scalar);
      });
    }
  });

  it("makeDraft fills every UI channel at rest", () => {
    const d = D.makeDraft("e2_period", "tuner.oscillator", { value: 1 }, { seq: 3 });
    expect(d).toMatchObject({ complete: false, focus: null, hover: null, probe: null, settled: true, wave: null, marks: null, seq: 3 });
  });
});
