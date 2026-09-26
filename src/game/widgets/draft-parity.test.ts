/**
 * Widget converters ↔ src/world/draft-inputs.ts (docs/design/20 §3.3, P1). The panel's controls and the legacy
 * widgets must produce byte-identical Inputs, so grading paths are shared. For every showcase encounter, the widget's
 * own converter applied to the widget's state representation equals toSubmitInput() of the panel draft, and grades
 * correct. The `onDraft` emission is wired into every showcase widget (source check: node env has no DOM).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import cellFixture from "../../../fixtures/cell-transport-dungeon.json";
import civilFixture from "../../../fixtures/civil-rights-dungeon.json";
import trigFixture from "../../../fixtures/trig-dungeon.json";
import { GameSpec } from "../../contracts/gamespec";
import { getMode } from "../../mechanics/registry";
import * as D from "../../world/draft-inputs";
import * as Dial from "./Dial";
import * as Link from "./Link";
import * as Order from "./Order";
import * as Pick from "./Pick";
import * as Place from "./Place";
import * as Sort from "./Sort";

const SPECS = [trigFixture, cellFixture, civilFixture].map((f) => GameSpec.parse(f));

/** The widget's own converter applied to the widget's state shape for this solution. */
function viaWidget(modeKey: string, sol: Record<string, unknown>): unknown {
  switch (modeKey) {
    case "tuner.oscillator":
    case "tuner.formula":
      return Dial.dialToInput(sol.value as number);
    case "mapper.number_line":
      return Place.numberLineToInput(sol.value as number);
    case "truth_finder.mimic":
      return Pick.chestsToInput(sol.statementIndex as number);
    case "truth_finder.predict_reveal":
      return Pick.optionsToInput(sol.optionIndex as number);
    case "sequencer.linear":
      return Order.placedToInput(sol.keys as string[]);
    case "sorter.bins":
      return Sort.assignmentsToInput(Object.fromEntries((sol.assignments as { itemKey: string; binId: string }[]).map((a) => [a.itemKey, a.binId])));
    case "sorter.type_match":
      return Pick.wavesToInput(sol.answers as { waveIndex: number; categoryId: string }[]);
    case "linker.pairs":
      return Link.pairsToInput(Object.fromEntries((sol.links as { leftKey: string; rightKey: string }[]).map((l) => [l.leftKey, l.rightKey])));
    case "linker.chain":
      return Link.chainToInput(Object.fromEntries((sol.edges as { fromKey: string; toKey: string }[]).map((e) => [e.fromKey, e.toKey])));
    case "investigator.elimination":
      return Link.eliminationToInput(sol.hypothesisId as string);
    default:
      throw new Error(`no widget converter for ${modeKey}`);
  }
}

describe("widget converters equal the panel's toSubmitInput for every showcase encounter", () => {
  let n = 0;
  for (const spec of SPECS) {
    spec.encounters.forEach((e, index) => {
      const modeKey = D.modeKeyOf(e);
      it(`${spec.id}/${e.id} (${modeKey})`, () => {
        const mode = getMode(e.familyId, e.mode)!;
        const view = mode.present(e.params, spec.seed + index);
        const sol = mode.solutionInput(e.params, e.solution) as Record<string, unknown>;
        const widgetInput = viaWidget(modeKey, sol);
        const panelInput = D.toSubmitInput(modeKey, D.fromSubmitInput(modeKey, sol, view));
        expect(JSON.stringify(panelInput)).toBe(JSON.stringify(widgetInput));
        expect(mode.grade(e.params, widgetInput).correct).toBe(true);
      });
      n++;
    });
  }
  it("covers the 29 showcase encounters", () => expect(n).toBe(29));
});

describe("partial drafts: the widgets' Record order is the draft order", () => {
  it("re-assigning keeps first-insertion order in both (bins, pairs, chain)", () => {
    const bins = { i3: "a", i0: "b", i1: "a" };
    bins.i3 = "b";
    expect(JSON.stringify(Sort.assignmentsToInput(bins))).toBe(
      JSON.stringify(D.toSubmitInput("sorter.bins", { assignments: [{ itemKey: "i3", binId: "a" }, { itemKey: "i0", binId: "b" }, { itemKey: "i1", binId: "a" }, { itemKey: "i3", binId: "b" }] })),
    );
    const links = { l1: "r0", l0: "x0" };
    expect(JSON.stringify(Link.pairsToInput(links))).toBe(JSON.stringify(D.toSubmitInput("linker.pairs", { links: [{ leftKey: "l1", rightKey: "r0" }, { leftKey: "l0", rightKey: "x0" }] })));
    const edges = { n1: "n2", n0: "n1" };
    expect(JSON.stringify(Link.chainToInput(edges))).toBe(JSON.stringify(D.toSubmitInput("linker.chain", { edges: [{ fromKey: "n1", toKey: "n2" }, { fromKey: "n0", toKey: "n1" }] })));
  });
});

describe("onDraft emission is wired (§3.3: ~15 lines per widget)", () => {
  const src = (f: string) => readFileSync(path.join(import.meta.dirname, f), "utf8");
  it("WidgetProps declares onDraft and keeps onLive as deprecated", () => {
    const dial = src("Dial.tsx");
    expect(dial).toMatch(/onDraft\?: \(d: WidgetDraft\) => void;/);
    expect(dial).toMatch(/@deprecated[^\n]*\n\s*onLive\?:/);
  });
  const WIRED: [string, RegExp[]][] = [
    ["Dial.tsx", [/onDraft\?\.\(\{ input: dialToInput\(value\), complete: true/]],
    ["Place.tsx", [/onDraft\?\.\(\{ input: numberLineToInput\(value\), complete: true/]],
    ["Pick.tsx", [/onDraft\(\{ input: wavesToInput\(answers\), complete: false/, /onFocusItem\?\.\(it\.optionIndex\)/]],
    ["Order.tsx", [/onDraft\(\{ input: toInput\(keys\), complete: keys\.length === n\.slots/, /onDraft\?\.\(placed\)/]],
    ["Sort.tsx", [/onDraft\(\{ input: assignmentsToInput\(a\), complete: allPlaced\(a\)/, /onDraft\?\.\(assignments\)/]],
    ["Link.tsx", [/onDraft\(\{ input: pairsToInput\(links\)/, /onDraft\(\{ input: chainToInput\(edges\)/, /onFocusItem\?\.\(h\.id\)/]],
    ["Type.tsx", [/onDraft\(\{ input: clozeTextToInput\(text\)/]],
  ];
  for (const [file, patterns] of WIRED) {
    it(file, () => {
      const s = src(file);
      for (const p of patterns) expect(s, `${file} ${p}`).toMatch(p);
    });
  }
});
