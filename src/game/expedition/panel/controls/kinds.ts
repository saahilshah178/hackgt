/**
 * controls/kinds.ts — which instrument control serves a station (docs/design/20 §3.3 `controlFor`). Pure.
 *
 * The meta's `control` names the control; each control's `supports(modeKey, view)` checks the view has the shape it
 * drives, and anything it rejects (console_slate, every non-showcase mode, a malformed view) mounts WidgetControl.
 */
import type { CardKind, ControlKind, ModeKey } from "../../../../world/types";
import { scalarInputOf } from "./scrub.logic";

/** The native control per showcase mode (= the control of the mode's §4 archetype). */
export const CONTROL_BY_MODE: Readonly<Partial<Record<string, ControlKind>>> = {
  "tuner.oscillator": "scrub",
  "tuner.formula": "scrub",
  "mapper.number_line": "scrub",
  "truth_finder.mimic": "aim",
  "truth_finder.predict_reveal": "aim",
  "sequencer.linear": "slots",
  "sorter.bins": "bins",
  "sorter.type_match": "waves",
  "linker.pairs": "cables",
  "linker.chain": "tubes",
  "investigator.elimination": "matrix",
};

export function controlKindForMode(modeKey: ModeKey): ControlKind {
  return CONTROL_BY_MODE[modeKey] ?? "widget";
}

/** The card kind a control draws as its interactive surface (a meta card of that kind feeds the control). */
export const SURFACE_KIND: Readonly<Record<ControlKind, CardKind | null>> = {
  scrub: null,
  aim: "claims",
  slots: "slot_rail",
  bins: null,
  waves: null,
  cables: "link_board",
  tubes: "cause_graph",
  matrix: "matrix",
  widget: null,
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: Record<string, unknown>, k: string) => Array.isArray(v[k]) && (v[k] as unknown[]).length > 0;

/** Does `kind` know how to drive this mode's view? */
export function supports(kind: ControlKind, modeKey: ModeKey, view: unknown): boolean {
  if (kind === "widget") return true;
  if (CONTROL_BY_MODE[modeKey] !== kind || !isObj(view)) return false;
  switch (kind) {
    case "scrub":
      return scalarInputOf(modeKey, view) !== null;
    case "aim":
      return modeKey === "truth_finder.predict_reveal" ? arr(view, "options") : arr(view, "chests");
    case "slots":
      return arr(view, "planks") && typeof view.slots === "number";
    case "bins":
      return arr(view, "bins") && arr(view, "items");
    case "waves":
      return arr(view, "categories") && arr(view, "waves");
    case "cables":
      return arr(view, "lefts") && arr(view, "rights");
    case "tubes":
      return arr(view, "nodes") && typeof view.edgeCount === "number";
    case "matrix":
      return arr(view, "hypotheses");
  }
}

/** `controlFor(meta.control, view)` as a kind: the meta's control when it supports the view, else "widget". */
export function resolveControlKind(metaControl: ControlKind, modeKey: ModeKey, view: unknown): ControlKind {
  return supports(metaControl, modeKey, view) ? metaControl : "widget";
}
