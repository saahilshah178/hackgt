/**
 * panel/default-panel.ts — the panel a station shows before its meta draws real cards (W0 stubs return no cards and
 * `input: null`), built from the mode's VIEW only (never params or solutions). Pure. Scalar modes get the Scrubber
 * plus a meaningful card: the oscillator's f(t) graph with a live dot and chip, a π number line's unit circle.
 * Discrete modes need no default: their control draws its surface from the view.
 */
import { formatChip, formatProbe, labelOnly, niceTicks } from "../../../world/graph-math";
import type { CardModel, ModeKey, OscillatorView, PanelLive, PanelStatic } from "../../../world/types";
import { scalarInputOf } from "./controls/scrub.logic";
import { oscillatorFn, oscillatorSource, sampleSource } from "./fn-source";

type Graph = Extract<CardModel, { kind: "graph" }>;
type UnitCircle = Extract<CardModel, { kind: "unit_circle" }>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function isOscillatorView(v: unknown): v is OscillatorView {
  return isObj(v) && typeof v.amplitude === "number" && typeof v.b === "number" && isObj(v.dial);
}

/** The f(t) card of an oscillator view: π or numeric t axis (far end labelled, like the reference), numeric y. */
export function oscillatorCard(view: OscillatorView, slot = 0): Graph {
  const input = scalarInputOf("tuner.oscillator", view)!;
  const reach = Math.abs(view.amplitude) + Math.abs(view.d);
  const yMax = Math.max(1, Math.ceil(reach * 1.25));
  const xTicks = labelOnly(niceTicks(input.min, input.max, input.unit, 8), (t, _i, all) => t.v === all[all.length - 1].v);
  return {
    kind: "graph",
    slot,
    title: view.equation,
    tab: "f(t)",
    x: { min: input.min, max: input.max, unit: input.unit, ticks: xTicks, label: null },
    y: { min: -yMax, max: yMax, unit: "number", ticks: niceTicks(-yMax, yMax, "number", 4), label: null },
    plots: [{ id: "f", color: "f", style: "solid", segments: sampleSource(oscillatorSource(view), input.min, input.max, 320), endpoints: [] }],
    annotations: view.d !== 0 ? [{ kind: "hline", y: view.d, label: "midline", style: "dashed", color: "f" }] : [],
    columns: [],
    targetLine: null,
    empty: false,
    sr: `f of t, ${view.equation}, a ${view.wave === "cos" ? "cosine" : "sine"} wave; the orange line marks your ${view.askLabel}.`,
  };
}

/** The unit-circle card of a π number line (trig e1): landmarks from the view, π/12 hairlines. */
export function unitCircleCard(view: unknown, slot = 0): UnitCircle {
  const v = isObj(view) ? view : {};
  const marks = Array.isArray(v.landmarks) ? (v.landmarks as unknown[]).filter(isObj) : [];
  const seen = new Set<number>();
  const landmarks = marks
    .map((l) => ({ angle: Number(l.value), label: String(l.label ?? "") }))
    .filter((l) => {
      const k = Math.round((((l.angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) * 1e6);
      if (seen.has(k)) return false;
      seen.add(k);
      return Number.isFinite(l.angle);
    });
  return {
    kind: "unit_circle",
    slot,
    title: "UNIT CIRCLE",
    landmarks,
    hairlineStep: Math.PI / 12,
    point: null,
    arc: null,
    drops: { sin: true, cos: true },
    level: null,
    shadeUpperHalf: false,
    mirror: null,
    sr: "The unit circle; the orange arc is the angle you set.",
  };
}

/** Default PanelStatic from the view (used only while the meta returns no cards and no input). */
export function defaultPanelStatic(modeKey: ModeKey, view: unknown): PanelStatic {
  const input = scalarInputOf(modeKey, view);
  const cards: CardModel[] = [];
  if (modeKey === "tuner.oscillator" && isOscillatorView(view)) cards.push(oscillatorCard(view));
  if (modeKey === "mapper.number_line" && input?.unit === "pi") cards.push(unitCircleCard(view));
  return { cards, input, probe: null, recordPins: [] };
}

/** Default PanelLive for the default cards: the orange line, the readout, the live dot and the value chip. */
export function defaultPanelLive(stat: PanelStatic, modeKey: ModeKey, view: unknown, value: number | null): PanelLive {
  const input = stat.input;
  const live: { chips: PanelLive["chips"][number][]; liveCards: CardModel[] } = { chips: [], liveCards: [] };
  if (value !== null && Number.isFinite(value)) {
    for (const card of stat.cards) {
      if (card.kind === "graph" && modeKey === "tuner.oscillator" && isOscillatorView(view)) {
        const y = oscillatorFn(view)(value);
        live.chips.push({ slot: card.slot, value: y, text: formatChip(y, "number"), color: "f" });
        live.liveCards.push({ ...card, annotations: [...card.annotations, { kind: "live_dot", x: value, y, color: "f" }] });
      }
      if (card.kind === "unit_circle") {
        live.chips.push({ slot: card.slot, value: Math.sin(value), text: formatChip(Math.sin(value), "number"), color: "g" });
        live.liveCards.push({ ...card, point: { angle: value }, arc: { from: 0, to: value, color: "accent" } });
      }
    }
  }
  return {
    scrubX: value,
    readout: value !== null && input ? formatProbe(value, { format: input.format, unit: "", stops: [], step: input.step }) : null,
    chips: live.chips,
    highlights: [],
    liveCards: live.liveCards,
  };
}
