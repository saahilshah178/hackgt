/**
 * panel/panel-model.ts — what the panel shows, as pure functions (docs/design/20 §2.5.2, §3.2). No React.
 *
 * - live cards replace the static card of the same slot;
 * - CardOverride (station.panel.cards) applies by META slot (title, axes, hidden);
 * - the panel-owned RECORD card (recordCard, A6) is prepended at DISPLAY slot 0 in the scrub and board layouts when
 *   the game has a record strip, pushing the meta's cards one display slot down; meta slots never change;
 * - the RECORD chip is the nearest earned pin within ±2 months of the cursor, else "—".
 */
import type { CardOverride } from "../../../contracts/world";
import { niceTicks } from "../../../world/graph-math";
import { recordCard } from "../../../world/record-strip";
import type { CardKind, CardModel, PanelContext, PanelLive, PanelStatic } from "../../../world/types";
import type { DisplayCard, LiveChip, PanelLayout } from "./types";

type Timeline = Extract<CardModel, { kind: "timeline" }>;

export function mergeLive(cards: readonly CardModel[], liveCards: readonly CardModel[]): CardModel[] {
  const bySlot = new Map(liveCards.map((c) => [c.slot, c]));
  return cards.map((c) => bySlot.get(c.slot) ?? c);
}

/** Station presentation overrides by meta slot: title (and a graph's tab), axes (ticks recomputed), hidden. */
export function applyOverrides(cards: readonly CardModel[], overrides: readonly CardOverride[]): CardModel[] {
  if (overrides.length === 0) return [...cards];
  const bySlot = new Map(overrides.map((o) => [o.slot, o]));
  const out: CardModel[] = [];
  for (const c of cards) {
    const o = bySlot.get(c.slot);
    if (!o) {
      out.push(c);
      continue;
    }
    if (o.hidden) continue;
    let next: CardModel = o.title ? { ...c, title: o.title } : c;
    if (next.kind === "graph") {
      const g = next;
      next = {
        ...g,
        tab: o.title ?? g.tab,
        x: o.x ? { min: o.x.min, max: o.x.max, unit: o.x.unit, label: o.x.label, ticks: niceTicks(o.x.min, o.x.max, o.x.unit) } : g.x,
        y: o.y ? { min: o.y.min, max: o.y.max, unit: o.y.unit, label: o.y.label, ticks: niceTicks(o.y.min, o.y.max, o.y.unit, 5) } : g.y,
      };
    }
    out.push(next);
  }
  return out;
}

export function showsRecord(ctx: PanelContext, layout: PanelLayout): boolean {
  return ctx.recordStrip !== null && (layout === "scrub" || layout === "board");
}

/** The display stack: RECORD (metaSlot null) at display slot 0 when shown, then the meta's cards in slot order. */
export function displayStack(
  metaCards: readonly CardModel[],
  ctx: PanelContext,
  recordPins: PanelStatic["recordPins"],
  cursor: number | null,
  layout: PanelLayout,
): DisplayCard[] {
  const sorted = [...metaCards].sort((a, b) => a.slot - b.slot);
  const out: DisplayCard[] = [];
  if (showsRecord(ctx, layout)) out.push({ displaySlot: 0, metaSlot: null, card: recordCard(ctx, recordPins, cursor) });
  const offset = out.length;
  sorted.forEach((card, i) => out.push({ displaySlot: offset + i, metaSlot: card.slot, card }));
  return out;
}

/** Removes the control's surface card (claims, slot rail, link board, cause board, matrix) from the display stack. */
export function splitSurface(stack: readonly DisplayCard[], surfaceKind: CardKind | null): { stack: DisplayCard[]; surface: CardModel | null } {
  if (!surfaceKind) return { stack: [...stack], surface: null };
  const i = stack.findIndex((d) => d.metaSlot !== null && d.card.kind === surfaceKind);
  if (i < 0) return { stack: [...stack], surface: null };
  const rest = stack.filter((_, j) => j !== i).map((d, j) => ({ ...d, displaySlot: j }));
  return { stack: rest, surface: stack[i].card };
}

const TWO_MONTHS = 2 / 12 + 1e-6;

/** The RECORD chip: the nearest earned pin within ±2 months of the cursor (value = its lane index), else "—". */
export function recordChip(card: Timeline, cursor: number | null): LiveChip {
  let best: Timeline["pins"][number] | null = null;
  if (cursor !== null && Number.isFinite(cursor)) {
    for (const p of card.pins) {
      if (p.style !== "earned") continue;
      const d = Math.abs(p.at - cursor);
      if (d <= TWO_MONTHS && (!best || d < Math.abs(best.at - cursor))) best = p;
    }
  }
  const lane = best ? card.lanes.findIndex((l) => l.id === best!.lane) : -1;
  return { slot: -1, value: lane >= 0 ? lane : Number.NaN, text: best ? best.label : "—", color: "f" };
}

/** The chips riding one display card: the meta's chips of its slot; the RECORD card gets the record chip. */
export function chipsFor(d: DisplayCard, live: Pick<PanelLive, "chips">, cursor: number | null): LiveChip[] {
  if (d.metaSlot === null) return d.card.kind === "timeline" ? [recordChip(d.card, cursor)] : [];
  return live.chips.filter((c) => c.slot === d.metaSlot);
}

/** Does this card share the scrubber's x window (so the one orange line crosses it)? */
export function sharesDomain(card: CardModel, range: { min: number; max: number } | null): boolean {
  if (!range) return false;
  const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  if (card.kind === "graph") return eq(card.x.min, range.min) && eq(card.x.max, range.max);
  if (card.kind === "timeline") return eq(card.from, range.min) && eq(card.to, range.max);
  return false;
}

/** The meta's static model, completed from the view-derived defaults while the meta is a W0 stub. */
export function resolvePanelStatic(meta: PanelStatic, defaults: PanelStatic, scalar: boolean): { stat: PanelStatic; usingDefaults: boolean } {
  const usingDefaults = meta.cards.length === 0 && defaults.cards.length > 0;
  return {
    stat: {
      cards: usingDefaults ? defaults.cards : meta.cards,
      input: meta.input ?? (scalar ? defaults.input : null),
      probe: meta.probe,
      recordPins: meta.recordPins,
    },
    usingDefaults,
  };
}
