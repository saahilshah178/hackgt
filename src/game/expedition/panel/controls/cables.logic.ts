/**
 * controls/cables.logic.ts — CableControl (linker.pairs → {links}; switchboard and stage_machine; docs/design/20
 * §3.3). Pure. A socket (left) holds one cord; a jack (right) takes one cord (seating it elsewhere moves it), like
 * the PairsLink widget. Seated lamps are WHITE, never a correctness colour, until Verify (§2.5.6).
 */
import type { CardModel } from "../../../../world/types";

export interface Side {
  key: string;
  text: string;
}
export interface CablesState {
  links: readonly { leftKey: string; rightKey: string }[];
  selectedLeft: string | null;
  selectedRight: string | null;
}
type LinkBoard = Extract<CardModel, { kind: "link_board" }>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const rowsOf = (v: unknown, f: string): Side[] =>
  isObj(v) && Array.isArray(v[f]) ? (v[f] as unknown[]).filter(isObj).map((r) => ({ key: String(r.key), text: String(r.text ?? "") })) : [];

export const leftsOf = (view: unknown) => rowsOf(view, "lefts");
export const rightsOf = (view: unknown) => rowsOf(view, "rights");

export function fromDraftInput(d: unknown, view: unknown): CablesState {
  const L = new Set(leftsOf(view).map((l) => l.key));
  const R = new Set(rightsOf(view).map((r) => r.key));
  let s: CablesState = { links: [], selectedLeft: null, selectedRight: null };
  const rows = isObj(d) && Array.isArray(d.links) ? (d.links as unknown[]).filter(isObj) : [];
  for (const r of rows) if (L.has(String(r.leftKey)) && R.has(String(r.rightKey))) s = link(s, String(r.leftKey), String(r.rightKey));
  return s;
}
export function toDraftInput(s: CablesState): { links: readonly { leftKey: string; rightKey: string }[] } {
  return { links: s.links.map((l) => ({ ...l })) };
}
export function complete(s: CablesState, view: unknown): boolean {
  const linked = new Set(s.links.map((l) => l.leftKey));
  const lefts = leftsOf(view);
  return lefts.length > 0 && lefts.every((l) => linked.has(l.key));
}

/** Seats a cord left → right: the left's old cord is replaced in place; a cord already on that jack is unseated. */
export function link(s: CablesState, leftKey: string, rightKey: string): CablesState {
  const links = s.links.filter((l) => l.rightKey !== rightKey || l.leftKey === leftKey);
  const i = links.findIndex((l) => l.leftKey === leftKey);
  const next = [...links];
  if (i >= 0) next[i] = { leftKey, rightKey };
  else next.push({ leftKey, rightKey });
  return { links: next, selectedLeft: null, selectedRight: null };
}
export function unlink(s: CablesState, leftKey: string): CablesState {
  return { ...s, links: s.links.filter((l) => l.leftKey !== leftKey) };
}
/** Picking a left then a right (or a right then a left) seats a cord, as the widget does. */
export function pickLeft(s: CablesState, key: string): CablesState {
  if (s.selectedRight) return link(s, key, s.selectedRight);
  return { ...s, selectedLeft: s.selectedLeft === key ? null : key };
}
export function pickRight(s: CablesState, key: string): CablesState {
  if (s.selectedLeft) return link(s, s.selectedLeft, key);
  return { ...s, selectedRight: s.selectedRight === key ? null : key };
}
export function rightOf(s: CablesState, leftKey: string): string | null {
  return s.links.find((l) => l.leftKey === leftKey)?.rightKey ?? null;
}

/** The link board (the control's surface): sockets left, cartridges right, cords seated (white) or in focus. */
export function linkBoardCardOf(view: unknown, s: CablesState, surface: CardModel | null, focus: string | null): LinkBoard {
  const base = surface && surface.kind === "link_board" ? surface : null;
  const subOf = new Map((base?.rights ?? []).map((r) => [r.key, r.sub]));
  return {
    kind: "link_board",
    slot: base?.slot ?? 0,
    title: base?.title ?? "BOARD",
    lefts: leftsOf(view).map((l) => ({ key: l.key, label: l.text })),
    rights: rightsOf(view).map((r) => ({ key: r.key, label: r.text, sub: subOf.get(r.key) ?? null })),
    links: s.links.map((l) => ({ ...l, state: l.leftKey === focus || l.rightKey === focus ? "focus" : "seated" })),
    sr: `${s.links.length} of ${leftsOf(view).length} sockets connected.`,
  };
}
