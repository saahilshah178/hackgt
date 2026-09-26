/**
 * controls/aim.logic.ts — AimControl (truth_finder.mimic → {statementIndex}, truth_finder.predict_reveal →
 * {optionIndex}; docs/design/20 §3.3). Pure. Hover and keyboard focus are draft CHANNELS (the beam, lamp or knob
 * previews the hovered holder, amendment 33); only choosing commits `input`. Correctness never shows before Verify.
 */
import type { CardModel, ModeKey } from "../../../../world/types";

export type AimKind = "statement" | "option";
export interface AimItem {
  index: number; // statementIndex / optionIndex (the mode's own index, not the display position)
  text: string;
}
export interface AimModel {
  kind: AimKind;
  items: readonly AimItem[]; // display order
  scenario: string | null;
}
export interface AimState {
  kind: AimKind;
  chosen: number | null;
  hover: number | null;
  focus: number | null;
}
type ClaimsCard = Extract<CardModel, { kind: "claims" }>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function aimModelOf(modeKey: ModeKey, view: unknown): AimModel {
  const v = isObj(view) ? view : {};
  if (modeKey === "truth_finder.predict_reveal") {
    const rows = Array.isArray(v.options) ? (v.options as unknown[]).filter(isObj) : [];
    return {
      kind: "option",
      items: rows.map((r) => ({ index: Number(r.optionIndex), text: String(r.text ?? "") })),
      scenario: typeof v.scenario === "string" ? v.scenario : null,
    };
  }
  const rows = Array.isArray(v.chests) ? (v.chests as unknown[]).filter(isObj) : [];
  return { kind: "statement", items: rows.map((r) => ({ index: Number(r.statementIndex), text: String(r.text ?? "") })), scenario: null };
}

export function initialAim(modeKey: ModeKey, draftInput: unknown): AimState {
  return fromDraftInput(draftInput, modeKey);
}
export function fromDraftInput(d: unknown, modeKey: ModeKey): AimState {
  const kind: AimKind = modeKey === "truth_finder.predict_reveal" ? "option" : "statement";
  const raw = isObj(d) ? (kind === "option" ? d.optionIndex : d.statementIndex) : null;
  const chosen = typeof raw === "number" && Number.isInteger(raw) ? raw : null;
  return { kind, chosen, hover: null, focus: chosen };
}
export function toDraftInput(s: AimState): { statementIndex: number | null } | { optionIndex: number | null } {
  return s.kind === "option" ? { optionIndex: s.chosen } : { statementIndex: s.chosen };
}
export function complete(s: AimState): boolean {
  return s.chosen !== null;
}

export function hover(s: AimState, index: number | null): AimState {
  return s.hover === index ? s : { ...s, hover: index };
}
export function focus(s: AimState, index: number | null): AimState {
  return s.focus === index ? s : { ...s, focus: index };
}
export function choose(s: AimState, index: number): AimState {
  return { ...s, chosen: index, focus: index };
}

/** The draft channels: the index as a string, as `Draft.focus` / `Draft.hover` carry item keys. */
export function channels(s: AimState): { focus: string | null; hover: string | null } {
  return { focus: s.focus === null ? null : String(s.focus), hover: s.hover === null ? null : String(s.hover) };
}

const LETTERS = "ABCDEFGHIJ";

/** The claims card (the AimControl's surface): letters by display position, states from the aim state only. */
export function claimsCardOf(model: AimModel, s: AimState, surface: CardModel | null, title = "CLAIMS"): ClaimsCard {
  const base = surface && surface.kind === "claims" ? surface : null;
  const glyphOf = new Map((base?.items ?? []).map((it) => [it.key, it.glyph]));
  const items = model.items.map((it, pos) => {
    const key = String(it.index);
    const state: ClaimsCard["items"][number]["state"] = s.chosen === it.index ? "aimed" : s.hover === it.index ? "hover" : "idle";
    return { key, letter: LETTERS[pos] ?? String(pos + 1), text: it.text, glyph: glyphOf.get(key) ?? null, state };
  });
  const aimed = model.items.findIndex((it) => it.index === s.chosen);
  return {
    kind: "claims",
    slot: base?.slot ?? 0,
    title: base?.title ?? title,
    scenario: base?.scenario ?? model.scenario,
    items,
    sr: `${items.length} ${model.kind === "option" ? "options" : "claims"}; ${aimed >= 0 ? `aimed at ${LETTERS[aimed]}` : "nothing aimed yet"}.`,
  };
}
