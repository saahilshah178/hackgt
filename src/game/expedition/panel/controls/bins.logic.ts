/**
 * controls/bins.logic.ts — RouterControl (sorter.bins → {assignments}; docs/design/20 §3.3). Pure.
 * Assignments keep first-insertion order (re-routing an item replaces it in place), exactly like the BinsSort
 * widget's Record, so toSubmitInput produces byte-identical inputs. Boss phases reveal the next batch of items only
 * once the previous batch is placed; `complete` needs every item of the view placed.
 */
export interface Bin {
  id: string;
  label: string;
}
export interface BinItem {
  key: string;
  text: string;
}
export interface BinsState {
  assignments: readonly { itemKey: string; binId: string }[];
  /** the item picked up (keyboard: Enter on an item, then a bin key / 1–9) */
  selected: string | null;
}
export interface Phase {
  id: string;
  itemKeys: readonly string[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function binsOf(view: unknown): Bin[] {
  const v = isObj(view) ? view : {};
  return Array.isArray(v.bins) ? (v.bins as unknown[]).filter(isObj).map((b) => ({ id: String(b.id), label: String(b.label ?? b.id) })) : [];
}
export function itemsOf(view: unknown): BinItem[] {
  const v = isObj(view) ? view : {};
  return Array.isArray(v.items) ? (v.items as unknown[]).filter(isObj).map((i) => ({ key: String(i.key), text: String(i.text ?? "") })) : [];
}

export function fromDraftInput(d: unknown, view: unknown): BinsState {
  const items = new Set(itemsOf(view).map((i) => i.key));
  const bins = new Set(binsOf(view).map((b) => b.id));
  let s: BinsState = { assignments: [], selected: null };
  const rows = isObj(d) && Array.isArray(d.assignments) ? (d.assignments as unknown[]).filter(isObj) : [];
  for (const r of rows) {
    const k = String(r.itemKey);
    const b = String(r.binId);
    if (items.has(k) && bins.has(b)) s = assign(s, k, b);
  }
  return s;
}
export function toDraftInput(s: BinsState): { assignments: readonly { itemKey: string; binId: string }[] } {
  return { assignments: s.assignments.map((a) => ({ ...a })) };
}
export function complete(s: BinsState, view: unknown): boolean {
  const placed = new Set(s.assignments.map((a) => a.itemKey));
  const items = itemsOf(view);
  return items.length > 0 && items.every((i) => placed.has(i.key));
}

export function assign(s: BinsState, itemKey: string, binId: string): BinsState {
  const i = s.assignments.findIndex((a) => a.itemKey === itemKey);
  const assignments = [...s.assignments];
  if (i >= 0) assignments[i] = { itemKey, binId };
  else assignments.push({ itemKey, binId });
  return { assignments, selected: null };
}
export function unassign(s: BinsState, itemKey: string): BinsState {
  return { ...s, assignments: s.assignments.filter((a) => a.itemKey !== itemKey) };
}
export function select(s: BinsState, itemKey: string | null): BinsState {
  return { ...s, selected: s.selected === itemKey ? null : itemKey };
}
export function binOf(s: BinsState, itemKey: string): string | null {
  return s.assignments.find((a) => a.itemKey === itemKey)?.binId ?? null;
}

/**
 * Items the player can see now, in display order. Without phases: every item. With phases: every item of each
 * batch up to and including the first batch that still has an unplaced item (later batches stay hidden), plus any
 * item no phase lists.
 */
export function visibleItems(view: unknown, s: BinsState, phases: readonly Phase[]): BinItem[] {
  const items = itemsOf(view);
  if (phases.length === 0) return items;
  const placed = new Set(s.assignments.map((a) => a.itemKey));
  const visible = new Set<string>();
  const phased = new Set(phases.flatMap((p) => p.itemKeys));
  for (const p of phases) {
    for (const k of p.itemKeys) visible.add(k);
    if (!p.itemKeys.every((k) => placed.has(k))) break;
  }
  return items.filter((i) => visible.has(i.key) || !phased.has(i.key));
}
/** Index of the batch now showing (phases only), for the boss line trigger. */
export function currentPhase(s: BinsState, phases: readonly Phase[]): number {
  const placed = new Set(s.assignments.map((a) => a.itemKey));
  const i = phases.findIndex((p) => !p.itemKeys.every((k) => placed.has(k)));
  return i < 0 ? phases.length - 1 : i;
}
/** Items per bin: the chips carry COUNTS only, never capacities (§2.5.6). */
export function countsOf(view: unknown, s: BinsState): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(binsOf(view).map((b) => [b.id, 0]));
  for (const a of s.assignments) if (a.binId in out) out[a.binId] += 1;
  return out;
}
