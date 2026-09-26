/**
 * src/world/record-strip.ts — the panel-owned RECORD card (docs/design/20 §2.5.2, A6; civil §5.0.2).
 * W0 STUB with the final signatures and a first honest implementation; KC1 owns the file (+ test) from T0 + 2
 * (acceptance: with the civil strip, e1's RECORD shows 0 earned pins and e9's shows 11; spans become bands).
 */
import type { Point } from "../contracts/world";
import { fracYearOf } from "./contraptions/config-parts";
import { pointAlong } from "./geom";
import type { CardModel, PanelContext, PanelStatic } from "./types";

export type TimelineCard = Extract<CardModel, { kind: "timeline" }>;

/**
 * RECORD = the earned pins of solved encounters (spanTo → a band) + the meta's recordPins; from/to = the probe window,
 * else the pins' span ± 1 year; cursor = the live probe (the panel draws it; it only affects the SR text here).
 */
export function recordCard(ctx: PanelContext, recordPins: PanelStatic["recordPins"], cursor: number | null): TimelineCard {
  const strip = ctx.recordStrip;
  const solved = new Set(ctx.solvedIds);
  const earned = (strip?.pins ?? []).filter((p) => solved.has(p.encounterId));
  const pins: TimelineCard["pins"][number][] = [];
  const bands: TimelineCard["bands"][number][] = [];
  for (const { encounterId, pin } of earned) {
    const at = fracYearOf(pin.date);
    if (at === null) continue;
    const spanTo = pin.spanTo ? fracYearOf(pin.spanTo) : null;
    pins.push({ key: `${encounterId}:${pin.date}`, at, label: pin.label, lane: pin.lane, style: "earned", spanTo });
    if (spanTo !== null) bands.push({ from: at, to: spanTo, label: pin.label, color: "f" });
  }
  for (const p of recordPins) pins.push({ key: p.key, at: p.at, label: p.label, lane: null, style: p.style, spanTo: null });
  const ats = pins.map((p) => p.at);
  const from = ctx.probeWindow?.start ?? (ats.length ? Math.floor(Math.min(...ats)) - 1 : 1950);
  const to = ctx.probeWindow?.end ?? (ats.length ? Math.ceil(Math.max(...ats)) + 1 : 1970);
  const cursorText = cursor === null ? "" : `, cursor at ${cursor.toFixed(2)}`;
  return {
    kind: "timeline",
    slot: 0,
    title: "RECORD",
    tab: "RECORD",
    from,
    to,
    unit: "year",
    lanes: strip?.lanes ?? [],
    pins,
    bands,
    arrows: [],
    axisBreak: null,
    sr: `The record, ${from} to ${to}: ${earned.length} restored ${earned.length === 1 ? "entry" : "entries"}${cursorText}.`,
  };
}

/** Where the record_lens carriage sits on its rail for a probe value inside the window (fractional years). */
export function lensTarget(rail: readonly Point[], window: { start: number; end: number }, probe: number): { x: number; y: number } {
  const span = window.end - window.start;
  const u = span > 0 ? (probe - window.start) / span : 0;
  return pointAlong(rail, Math.min(1, Math.max(0, u))) ?? { x: 0, y: 0 };
}
