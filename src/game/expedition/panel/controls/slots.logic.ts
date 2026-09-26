/**
 * controls/slots.logic.ts — SlotRailControl (sequencer.linear → {slots}; docs/design/20 §3.3). Pure.
 * One entry per slot (null = empty); a plank sits in at most one slot; `complete` when every slot is filled.
 */
import type { CardModel } from "../../../../world/types";

export interface Plank {
  key: string;
  text: string;
}
export interface SlotsState {
  slots: readonly (string | null)[];
  /** the plank picked up from the tray (keyboard: Enter on a plank, then Enter on a slot) */
  selected: string | null;
}
type SlotRailCard = Extract<CardModel, { kind: "slot_rail" }>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function planksOf(view: unknown): Plank[] {
  const v = isObj(view) ? view : {};
  return Array.isArray(v.planks) ? (v.planks as unknown[]).filter(isObj).map((p) => ({ key: String(p.key), text: String(p.text ?? "") })) : [];
}
export function slotCountOf(view: unknown): number {
  const v = isObj(view) ? view : {};
  return typeof v.slots === "number" && v.slots > 0 ? Math.floor(v.slots) : 0;
}

export function fromDraftInput(d: unknown, view: unknown): SlotsState {
  const n = slotCountOf(view);
  const known = new Set(planksOf(view).map((p) => p.key));
  const raw = isObj(d) && Array.isArray(d.slots) ? (d.slots as unknown[]) : [];
  const seen = new Set<string>();
  const slots = Array.from({ length: n }, (_, i) => {
    const k = raw[i];
    if (typeof k !== "string" || !known.has(k) || seen.has(k)) return null;
    seen.add(k);
    return k;
  });
  return { slots, selected: null };
}
export function toDraftInput(s: SlotsState): { slots: readonly (string | null)[] } {
  return { slots: [...s.slots] };
}
export function complete(s: SlotsState): boolean {
  return s.slots.length > 0 && s.slots.every((k) => k !== null);
}

/** Puts `key` in slot `at` (or the first empty slot). A plank already placed moves; the slot's old plank goes back
 * to where the moving plank came from (a swap) or to the tray. Returns the state unchanged when nothing fits. */
export function place(s: SlotsState, key: string, at?: number): SlotsState {
  const slots = [...s.slots];
  const from = slots.indexOf(key);
  const target = at ?? slots.findIndex((k) => k === null);
  if (target < 0 || target >= slots.length) return { ...s, selected: null };
  const displaced = slots[target];
  if (from >= 0) slots[from] = displaced ?? null;
  slots[target] = key;
  return { slots, selected: null };
}
export function remove(s: SlotsState, index: number): SlotsState {
  if (index < 0 || index >= s.slots.length || s.slots[index] === null) return s;
  const slots = [...s.slots];
  slots[index] = null;
  return { ...s, slots };
}
export function select(s: SlotsState, key: string | null): SlotsState {
  return { ...s, selected: s.selected === key ? null : key };
}
/** Planks not on the rail, in the view's display order. */
export function trayOf(view: unknown, s: SlotsState): Plank[] {
  const placed = new Set(s.slots.filter((k): k is string => k !== null));
  return planksOf(view).filter((p) => !placed.has(p.key));
}

/** The rail card (the control's surface): numbered slots, the placed plank's text, lamps on when filled. */
export function slotRailCardOf(view: unknown, s: SlotsState, surface: CardModel | null): SlotRailCard {
  const base = surface && surface.kind === "slot_rail" ? surface : null;
  const text = new Map(planksOf(view).map((p) => [p.key, p.text]));
  const filled = s.slots.filter((k) => k !== null).length;
  return {
    kind: "slot_rail",
    slot: base?.slot ?? 0,
    title: base?.title ?? "RAIL",
    heading: base?.heading ?? null,
    slots: s.slots.map((k, index) => ({ index, key: k, label: k === null ? null : (text.get(k) ?? k), lamp: k === null ? "off" : "on" })),
    anchorsRight: base?.anchorsRight ?? 2,
    sr: `${filled} of ${s.slots.length} slots filled.`,
  };
}
