/**
 * src/app/dev/panel/demo.ts — dev-gallery data (P1). The station bindings of docs/design/20 §4.1 (archetype, layout,
 * probe, Verify label, badge) for the three showcase fixtures, the civil RECORD strip of civil §5.0.2, and demo card
 * builders that stand in for the K lanes' metas (which are W0 stubs today) so every card kind can be seen on the
 * fixtures' real views. Nothing here is used outside /dev/panel.
 */
import { ProbeSpec, RecordStrip, type ProbeSpecInput } from "@/contracts/world";
import { oscillatorCard } from "@/game/expedition/panel/default-panel";
import { evalSource, exprSource, oscillatorFn, sampleSource } from "@/game/expedition/panel/fn-source";
import { formatChip, formatProbe, fracYear, labelOnly, niceTicks } from "@/world/graph-math";
import type { CardModel, OscillatorView, PanelLive, PanelStatic, PoseInput, StaticInput } from "@/world/types";

type Graph = Extract<CardModel, { kind: "graph" }>;
type Timeline = Extract<CardModel, { kind: "timeline" }>;
const PI = Math.PI;

export type GameKey = "trig" | "cell" | "civil";

export interface Binding {
  contraption: string;
  layout: "scrub" | "board" | "vault";
  noun: string;
  verify: string;
  badge: string;
  symbol?: string;
  probe?: ProbeSpecInput;
}

const yearProbe = (min: number, max: number, format: "month_year" | "year" = "month_year"): ProbeSpecInput => ({
  symbol: "YEAR",
  label: "record year",
  min,
  max,
  step: format === "year" ? 1 : 1 / 12,
  format,
  window: { start: min, end: max },
});

/** docs/design/20 §4.1, one row per encounter. */
export const BINDINGS: Record<GameKey, Record<string, Binding>> = {
  trig: {
    e1_radians: { contraption: "emitter_rail", layout: "scrub", noun: "Vesper Dial", verify: "ALIGN THE DIAL", badge: "VESPER ALIGNED", symbol: "θ" },
    e2_period: { contraption: "ring_gate", layout: "scrub", noun: "Tidewheel Gate", verify: "LOCK THE RINGS", badge: "RINGS LOCKED", symbol: "T" },
    e3_amplitude: {
      contraption: "claim_holders",
      layout: "board",
      noun: "Resonance Pillars",
      verify: "EXPOSE THE MIMIC",
      badge: "MIMIC EXPOSED",
      probe: { symbol: "x", label: "tuning lens", min: 0, max: 2 * PI, step: PI / 48, format: "pi" },
    },
    e4_solve: {
      contraption: "step_bridge",
      layout: "board",
      noun: "Solving Span",
      verify: "LAY THE SPAN",
      badge: "SPAN LOCKED",
      probe: { symbol: "x", label: "plumb marker", min: 0, max: 2 * PI, step: PI / 48, format: "pi" },
    },
    e5_period_review: {
      contraption: "claim_holders",
      layout: "board",
      noun: "Treasury Pillars",
      verify: "EXPOSE THE MIMIC",
      badge: "MIMIC EXPOSED",
      probe: { symbol: "x", label: "tuning lens", min: 0, max: 4 * PI, step: PI / 24, format: "pi" },
    },
    e6_boss: { contraption: "pendulum_sync", layout: "scrub", noun: "Warden's Shield", verify: "MATCH THE RHYTHM", badge: "RESONANCE LOCKED", symbol: "T" },
  },
  cell: {
    e1_bilayer: {
      contraption: "claim_holders",
      layout: "scrub",
      noun: "Specimen Pods",
      verify: "QUARANTINE · THAW RIDGE",
      badge: "MIMIC QUARANTINED",
      probe: { symbol: "d", label: "probe depth", min: 0, max: 5, step: 0.1, unit: "nm", format: "number" },
    },
    e2_selectivity: { contraption: "router_lanes", layout: "board", noun: "Membrane Router", verify: "ROUTE CARGO", badge: "CARGO ROUTED" },
    e3_diffusion: {
      contraption: "claim_holders",
      layout: "scrub",
      noun: "Balance Lock",
      verify: "QUARANTINE · LEVEL LOCK",
      badge: "MIMIC QUARANTINED",
      probe: { symbol: "a", label: "dye load", min: 0, max: 10, step: 0.5, unit: "mM", format: "number" },
    },
    e4_osmosis: {
      contraption: "claim_holders",
      layout: "scrub",
      noun: "Raft Lock",
      verify: "QUARANTINE · FLOOD LOCK",
      badge: "MIMIC QUARANTINED",
      probe: { symbol: "s", label: "bath salt", min: 0, max: 10, step: 0.1, format: "percent" },
    },
    e5_tonicity: { contraption: "sluice_waves", layout: "scrub", noun: "Tonicity Sluices", verify: "DRAIN THE SLUICE", badge: "SLUICE DRAINED" },
    e6_facilitated: { contraption: "router_lanes", layout: "board", noun: "Carrier Lanes", verify: "OPEN THE THRESHOLD", badge: "THRESHOLD OPEN" },
    e7_active: {
      contraption: "claim_holders",
      layout: "scrub",
      noun: "Light Hall",
      verify: "QUARANTINE · LIGHT HALL",
      badge: "MIMIC QUARANTINED",
      probe: { symbol: "r", label: "ATP feed", min: 0, max: 10, step: 0.5, unit: "ATP/s", format: "number" },
    },
    e8_pump: {
      contraption: "stage_machine",
      layout: "scrub",
      noun: "Sodium-Potassium Pump",
      verify: "RUN ONE CYCLE",
      badge: "PUMP CYCLING",
      probe: {
        symbol: "k",
        label: "pump stage",
        min: 0,
        max: 6,
        step: 0.05,
        format: "stage",
        stops: ["rest", "bind Na⁺", "ATP", "flip out", "swap", "drop P", "flip in"].map((label, v) => ({ v, label })),
      },
    },
    e9_osmosis_review: { contraption: "sluice_waves", layout: "scrub", noun: "Barge Lock", verify: "FILL THE LOCK", badge: "LOCK FILLED" },
    e10_bulk: {
      contraption: "step_bridge",
      layout: "scrub",
      noun: "Endocytosis Lift",
      verify: "LAUNCH THE LIFT",
      badge: "VESICLE LAUNCHED",
      probe: { symbol: "k", label: "playback", min: 0, max: 4, step: 0.05, format: "number", playback: true },
    },
    e11_boss: { contraption: "router_lanes", layout: "board", noun: "Gatekeeper Maws", verify: "OPEN THE VAULT", badge: "VAULT OPEN" },
  },
  civil: {
    e1_brown: { contraption: "claim_holders", layout: "scrub", noun: "Witness Projector", verify: "RETRACT SLIDE", badge: "SLIDE RETRACTED", probe: yearProbe(1950, 1960) },
    e2_montgomery: { contraption: "step_bridge", layout: "board", noun: "Walking Road", verify: "LIGHT THE ROUTE", badge: "ROUTE RESTORED", probe: yearProbe(1955 + 10 / 12, 1957 + 1 / 12) },
    e3_little_rock: { contraption: "oracle_ticker", layout: "scrub", noun: "Wire Ticker", verify: "SEND TO THE WIRE", badge: "WIRE CONFIRMED", probe: yearProbe(1954, 1958) },
    e4_sit_ins: { contraption: "claim_holders", layout: "scrub", noun: "Witness Projector", verify: "RETRACT SLIDE", badge: "SLIDE RETRACTED", probe: yearProbe(1959, 1961) },
    e5_freedom_rides: { contraption: "cause_tubes", layout: "board", noun: "Relay Line", verify: "CLOSE THE CIRCUIT", badge: "CIRCUIT CLOSED", probe: yearProbe(1960, 1962) },
    e6_birmingham: { contraption: "cause_tubes", layout: "board", noun: "Broadcast Relay", verify: "CLOSE THE CIRCUIT", badge: "CIRCUIT CLOSED", probe: yearProbe(1962, 1964) },
    e7_march: { contraption: "switchboard", layout: "board", noun: "Switchboard", verify: "CONNECT THE PROGRAM", badge: "PROGRAM CONNECTED", probe: yearProbe(1962.5, 1964) },
    e8_cra: { contraption: "router_lanes", layout: "board", noun: "Filing Cabinets", verify: "SEAL THE CABINETS", badge: "FILES SEALED", probe: yearProbe(1963.5, 1966) },
    e9_selma: { contraption: "step_bridge", layout: "board", noun: "Timeline Bridge", verify: "LOCK THE SPAN", badge: "SPAN LOCKED", probe: yearProbe(1964 + 5 / 12, 1965 + 9 / 12) },
    e10_sources: { contraption: "router_lanes", layout: "board", noun: "Provenance Drawers", verify: "SEAL THE STACKS", badge: "FILES SEALED", probe: yearProbe(1950, 2025, "year") },
    e11_causation: { contraption: "cause_tubes", layout: "board", noun: "Big Board", verify: "SEND THE CAPSULE", badge: "CIRCUIT CLOSED", probe: yearProbe(1963, 1966) },
    e12_boss: { contraption: "tumbler_vault", layout: "vault", noun: "Editor's Vault", verify: "OPEN THE VAULT", badge: "STORY PRINTED" },
  },
};

export function probeOf(b: Binding): ProbeSpec | null {
  return b.probe ? ProbeSpec.parse(b.probe) : null;
}

/** civil §5.0.2 `story.recordStrip` (verbatim). */
export const CIVIL_RECORD_STRIP: RecordStrip = RecordStrip.parse({
  lanes: [
    { id: "origins", label: "ORIGINS" },
    { id: "direct_action", label: "DIRECT ACTION" },
    { id: "legislation", label: "LEGISLATION" },
  ],
  pins: [
    { encounterId: "e1_brown", pin: { date: "1954", precision: "year", label: "Brown v. Board", lane: "origins", spanTo: null } },
    { encounterId: "e2_montgomery", pin: { date: "1955-12-01", precision: "day", label: "Parks arrested", lane: "origins", spanTo: null } },
    { encounterId: "e2_montgomery", pin: { date: "1955-12", precision: "month", label: "Boycott, 381 days", lane: "origins", spanTo: "1956-12" } },
    { encounterId: "e3_little_rock", pin: { date: "1957-09-25", precision: "day", label: "Little Rock Nine escorted", lane: "origins", spanTo: null } },
    { encounterId: "e4_sit_ins", pin: { date: "1960-02-01", precision: "day", label: "Greensboro sit-in", lane: "direct_action", spanTo: null } },
    { encounterId: "e4_sit_ins", pin: { date: "1960-04", precision: "month", label: "SNCC founded", lane: "direct_action", spanTo: null } },
    { encounterId: "e5_freedom_rides", pin: { date: "1961", precision: "year", label: "Freedom Rides", lane: "direct_action", spanTo: null } },
    { encounterId: "e6_birmingham", pin: { date: "1963", precision: "year", label: "Birmingham, spring", lane: "direct_action", spanTo: null } },
    { encounterId: "e6_birmingham", pin: { date: "1963-06", precision: "month", label: "Kennedy's bill", lane: "legislation", spanTo: null } },
    { encounterId: "e7_march", pin: { date: "1963-08-28", precision: "day", label: "March on Washington", lane: "legislation", spanTo: null } },
    { encounterId: "e8_cra", pin: { date: "1964-07-02", precision: "day", label: "Civil Rights Act", lane: "legislation", spanTo: null } },
    { encounterId: "e9_selma", pin: { date: "1965-03-07", precision: "day", label: "Bloody Sunday", lane: "legislation", spanTo: null } },
    { encounterId: "e9_selma", pin: { date: "1965-03-25", precision: "day", label: "March reaches the capitol", lane: "legislation", spanTo: null } },
    { encounterId: "e9_selma", pin: { date: "1965-08-06", precision: "day", label: "Voting Rights Act", lane: "legislation", spanTo: null } },
  ],
});

// ---------------------------------------------------------------- demo card builders (stand-ins for the K lanes)

export interface DemoPanel {
  panelStatic: (input: StaticInput<unknown>) => PanelStatic;
  panelLive: (stat: PanelStatic, input: PoseInput<unknown, unknown>) => PanelLive;
}

const EMPTY_LIVE: PanelLive = { scrubX: null, readout: null, chips: [], highlights: [], liveCards: [] };
const fy = (d: string) => fracYear(d) ?? 0;
const piAxis = (min: number, max: number, maxMajors = 8) => labelOnly(niceTicks(min, max, "pi", maxMajors), (t, _i, all) => t.v === all[all.length - 1].v);

function graph(slot: number, tab: string, title: string, x: Graph["x"], y: Graph["y"], plots: Graph["plots"], extra: Partial<Graph> = {}): Graph {
  return { kind: "graph", slot, title, tab, x, y, plots, annotations: [], columns: [], targetLine: null, empty: plots.length === 0, sr: `${title}.`, ...extra };
}
function numAxis(min: number, max: number, majors = 4): Graph["y"] {
  return { min, max, unit: "number", ticks: niceTicks(min, max, "number", majors), label: null };
}
function emptyCard(slot: number, tab: string, x: Graph["x"]): Graph {
  return graph(slot, tab, `${tab}, unused`, x, { min: -1, max: 1, unit: "number", ticks: niceTicks(-1, 1, "number", 2), label: null }, [], { empty: true });
}
const valueOf = (input: PoseInput<unknown, unknown>): number | null => {
  const v = input.draft?.input as { value?: unknown } | undefined;
  return typeof v?.value === "number" ? v.value : null;
};

/** trig e2 · Ring Gate: f(t), the ghost card g(t) = f(t + T) over a faint f, and an empty h card (5.png's stack). */
function ringGate(view: OscillatorView): DemoPanel {
  const f = oscillatorCard(view, 0);
  const x = f.x;
  return {
    panelStatic: () => ({
      cards: [f, graph(1, "g(t)", "the ghost: f(t + T)", x, f.y, [{ ...f.plots[0], id: "ghost", style: "ghost" }]), emptyCard(2, "h(t)", x)],
      input: null,
      probe: null,
      recordPins: [],
    }),
    panelLive: (stat, input) => {
      const T = valueOf(input) ?? x.min;
      const fn = oscillatorFn(view);
      const shifted = sampleSource({ kind: "closure", id: `shift:${view.equation}:${T}`, fn: (t) => fn(t + T) }, x.min, x.max, 320);
      const g = stat.cards[1] as Graph;
      return {
        scrubX: T,
        readout: formatProbe(T, { format: "pi", unit: "", stops: [] }),
        chips: [
          { slot: 0, value: fn(T), text: formatChip(fn(T), "number"), color: "f" },
          { slot: 1, value: fn(2 * T), text: formatChip(fn(2 * T), "number"), color: "g" },
        ],
        highlights: [],
        liveCards: [
          { ...f, annotations: [{ kind: "live_dot", x: T, y: fn(T), color: "f" }] },
          { ...g, plots: [g.plots[0], { id: "g", color: "g", style: "solid", segments: shifted, endpoints: [] }] },
        ],
      };
    },
  };
}

/** trig e6 · Pendulum Sync: the Warden f(t), your pendulum g(t) at period T, and their gap h(t). */
function pendulumSync(view: OscillatorView): DemoPanel {
  const f = oscillatorCard(view, 0);
  const x = { ...f.x, ticks: labelOnly(niceTicks(f.x.min, f.x.max, "number", 8), (t) => t.v === f.x.max) };
  const y = numAxis(-4, 4);
  return {
    panelStatic: () => ({ cards: [{ ...f, x, y, title: "the Warden" }, emptyCard(1, "g(t)", x), emptyCard(2, "h(t)", x)], input: null, probe: null, recordPins: [] }),
    panelLive: (stat, input) => {
      const T = Math.max(0.2, valueOf(input) ?? 1);
      const wf = oscillatorFn(view);
      const gf = (t: number) => view.amplitude * Math.sin((2 * PI * t) / T);
      const gSeg = sampleSource({ kind: "closure", id: `pend:${T}`, fn: gf }, x.min, x.max, 320);
      const hSeg = sampleSource({ kind: "closure", id: `gap:${T}`, fn: (t) => wf(t) - gf(t) }, x.min, x.max, 320);
      return {
        scrubX: T,
        readout: formatProbe(T, { format: "number", unit: "s", stops: [], step: 0.05 }),
        chips: [
          { slot: 0, value: wf(T), text: formatChip(wf(T), "number"), color: "f" },
          { slot: 1, value: gf(T), text: formatChip(gf(T), "number"), color: "g" },
        ],
        highlights: [],
        liveCards: [
          graph(1, "g(t)", "your pendulum", x, y, [{ id: "g", color: "g", style: "solid", segments: gSeg, endpoints: [] }]),
          graph(2, "h(t)", "the gap f − g", x, { min: -7, max: 7, unit: "number", ticks: niceTicks(-7, 7, "number", 4), label: null }, [{ id: "h", color: "h", style: "solid", segments: hSeg, endpoints: [] }]),
        ],
      };
    },
  };
}

/** trig e3/e5/e4: the reference trace under the ungraded probe x (trace_slate / relief_marker). */
function probeGraph(tab: string, title: string, expr: string, x0: number, x1: number, yMax: number, extra: Partial<Graph> = {}): DemoPanel {
  const src = exprSource(expr);
  const card = graph(0, tab, title, { min: x0, max: x1, unit: "pi", ticks: piAxis(x0, x1, 8), label: null }, numAxis(-yMax, yMax, 4), [
    { id: "ref", color: "f", style: "solid", segments: sampleSource(src, x0, x1, 360), endpoints: [] },
  ], extra);
  return {
    panelStatic: () => ({ cards: [card], input: null, probe: null, recordPins: [] }),
    panelLive: (_stat, input) => {
      const x = input.probe ?? x0;
      const y = evalSource(src, x);
      return {
        ...EMPTY_LIVE,
        scrubX: x,
        chips: Number.isFinite(y) ? [{ slot: 0, value: y, text: formatChip(y, "number"), color: "f" }] : [],
        liveCards: Number.isFinite(y) ? [{ ...card, annotations: [...card.annotations, { kind: "live_dot", x, y, color: "f" }] }] : [],
      };
    },
  };
}

/** A FILE timeline card over the probe window (civil §5.0.2 card 2, colour g). */
function fileCard(from: number, to: number, pins: Timeline["pins"], extra: Partial<Timeline> = {}): Timeline {
  return {
    kind: "timeline",
    slot: 0,
    title: "FILE",
    tab: "FILE",
    from,
    to,
    unit: to - from <= 3 ? "month" : "year",
    lanes: [],
    pins,
    bands: [],
    arrows: [],
    axisBreak: null,
    sr: `The file, ${Math.floor(from)} to ${Math.ceil(to)}: ${pins.length} dated items.`,
    ...extra,
  };
}

function civilFile(enc: string, b: Binding, view: unknown): DemoPanel | null {
  const p = probeOf(b);
  if (!p) return null;
  const { min, max } = p;
  let file: Timeline | null = null;
  let extraCards: CardModel[] = [];
  if (enc === "e1_brown") {
    file = fileCard(min, max, [{ key: "brown", at: fy("1954-05"), label: "Brown v. Board", lane: null, style: "draft", spanTo: null }], {
      bands: [{ from: fy("1954-05"), to: fy("1955-05"), label: "claimed: desegregated", color: "g" }],
      axisBreak: { from: 1896, to: 1949 },
      pins: [
        { key: "plessy", at: 1896, label: "Plessy v. Ferguson", lane: null, style: "dim", spanTo: null },
        { key: "brown", at: fy("1954-05"), label: "Brown v. Board", lane: null, style: "draft", spanTo: null },
      ],
      arrows: [{ fromKey: "plessy", toKey: "brown" }],
    });
  } else if (enc === "e3_little_rock") file = fileCard(min, max, [{ key: "guard", at: fy("1957-09"), label: "Guard posted", lane: null, style: "draft", spanTo: null }]);
  else if (enc === "e4_sit_ins") file = fileCard(min, max, [{ key: "gb", at: fy("1960-02-01"), label: "Greensboro", lane: null, style: "draft", spanTo: null }]);
  else if (enc === "e2_montgomery" || enc === "e9_selma") {
    const printed: Record<string, string> =
      enc === "e2_montgomery"
        ? { s0: "1955-12-01", s1: "1955-12-05", s2: "1956-06", s3: "1956-12-20", d0: "1955-12-02" }
        : { s0: "1964-07-02", s1: "1965-03-07", s2: "1965-03-25", s3: "1965-08-06", d0: "1956-12" };
    file = fileCard(min, max, []);
    return {
      panelStatic: () => ({ cards: [file!], input: null, probe: null, recordPins: [] }),
      panelLive: (stat, input) => {
        const slots = ((input.draft?.input as { slots?: (string | null)[] } | undefined)?.slots ?? []).map((k, i) => ({ k, i }));
        const pins = slots
          .filter((s): s is { k: string; i: number } => typeof s.k === "string" && printed[s.k] !== undefined)
          .map((s) => ({ key: s.k, at: fy(printed[s.k]), label: `bay ${s.i + 1}`, lane: null, style: "draft" as const, spanTo: null }));
        return { ...EMPTY_LIVE, scrubX: input.probe, liveCards: [{ ...(stat.cards[0] as Timeline), pins }] };
      },
    };
  } else if (enc === "e7_march") {
    const v = view as { lefts?: { key: string; text: string }[] };
    const lines = ["MARCH ON WASHINGTON FOR JOBS AND FREEDOM · AUGUST 28, 1963", ...(v.lefts ?? []).map((l) => `${l.text}: ______`)];
    extraCards = [{ kind: "document", slot: 0, title: "PROGRAM", body: lines.join("\n"), stamp: null, sr: "The march program; its lines fill as cords seat." }];
    return {
      panelStatic: () => ({ cards: extraCards, input: null, probe: null, recordPins: [] }),
      panelLive: (stat, input) => {
        const links = (input.draft?.input as { links?: { leftKey: string; rightKey: string }[] } | undefined)?.links ?? [];
        const seated = new Set(links.map((l) => l.leftKey));
        const body = ["MARCH ON WASHINGTON FOR JOBS AND FREEDOM · AUGUST 28, 1963", ...(v.lefts ?? []).map((l) => `${l.text}: ${seated.has(l.key) ? "▬▬▬▬▬▬" : "______"}`)].join("\n");
        return { ...EMPTY_LIVE, scrubX: input.probe, liveCards: [{ ...(stat.cards[0] as Extract<CardModel, { kind: "document" }>), body }] };
      },
    };
  } else if (enc === "e12_boss") {
    return null;
  }
  const cards: CardModel[] = file ? [file] : [];
  return {
    panelStatic: () => ({ cards, input: null, probe: null, recordPins: enc === "e1_brown" ? [{ key: "hint-1957", at: 1957, label: "Little Rock", style: "hint" }] : [] }),
    panelLive: (_stat, input) => ({ ...EMPTY_LIVE, scrubX: input.probe }),
  };
}

function cellDemo(enc: string, b: Binding): DemoPanel | null {
  const p = probeOf(b);
  switch (enc) {
    case "e1_bilayer": {
      const heads = Array.from({ length: 15 }, (_, i) => 30 + i * 42);
      const prims = (d: number): Extract<CardModel, { kind: "schematic" }>["prims"] => [
        ...heads.flatMap((x) => [
          { p: "circle" as const, cx: x, cy: 40, r: 13, color: "h" as const, fill: true },
          { p: "line" as const, x1: x - 4, y1: 53, x2: x - 4, y2: 98, color: "f" as const, w: 2.5, dash: false },
          { p: "line" as const, x1: x + 4, y1: 53, x2: x + 4, y2: 98, color: "f" as const, w: 2.5, dash: false },
          { p: "circle" as const, cx: x, cy: 160, r: 13, color: "h" as const, fill: true },
          { p: "line" as const, x1: x - 4, y1: 147, x2: x - 4, y2: 102, color: "f" as const, w: 2.5, dash: false },
          { p: "line" as const, x1: x + 4, y1: 147, x2: x + 4, y2: 102, color: "f" as const, w: 2.5, dash: false },
        ]),
        { p: "line", x1: 334, y1: -10, x2: 334, y2: 18 + 30 * d, color: "accent", w: 5, dash: false },
        { p: "circle", cx: 334, cy: 18 + 30 * d, r: 6, color: "accent", fill: true },
        { p: "text", x: 660, y: 94, text: "tails:", size: 18, color: "f", anchor: "start" },
        { p: "text", x: 660, y: 118, text: "oil", size: 18, color: "f", anchor: "start" },
      ];
      return {
        panelStatic: () => ({ cards: [{ kind: "schematic", slot: 0, title: "BILAYER", viewBox: [720, 185], prims: prims(0), sr: "A bilayer cross-section with the probe needle." }], input: null, probe: null, recordPins: [] }),
        panelLive: (_s, input) => ({ ...EMPTY_LIVE, scrubX: input.probe, liveCards: [{ kind: "schematic", slot: 0, title: "BILAYER", viewBox: [720, 185], prims: prims(input.probe ?? 0), sr: "The probe needle is in the bilayer." }] }),
      };
    }
    case "e3_diffusion":
    case "e4_osmosis":
    case "e7_active": {
      const labels = enc === "e3_diffusion" ? ["LEFT", "RIGHT"] : enc === "e4_osmosis" ? ["BATH", "CELL"] : ["LOW TANK", "HIGH TANK"];
      const title = enc === "e3_diffusion" ? "CHAMBERS" : enc === "e4_osmosis" ? "SALT" : "TANKS";
      const bars = (v: number): Extract<CardModel, { kind: "bars" }> => ({
        kind: "bars",
        slot: 0,
        title,
        bars: [
          { id: "a", label: labels[0], value: v, max: p?.max ?? 10, color: "f" },
          { id: "b", label: labels[1], value: enc === "e4_osmosis" ? 2 : Math.max(0, (p?.max ?? 10) * 0.2), max: p?.max ?? 10, color: "g" },
        ],
        sparkline: null,
        timer: null,
        arrow: v > 2 ? "in" : v < 2 ? "out" : "none",
        sr: `${labels[0]} ${v}, ${labels[1]} for comparison.`,
      });
      return {
        panelStatic: () => ({ cards: [bars(p?.min ?? 0)], input: null, probe: null, recordPins: [] }),
        panelLive: (_s, input) => ({ ...EMPTY_LIVE, scrubX: input.probe, liveCards: [bars(input.probe ?? 0)] }),
      };
    }
    case "e5_tonicity":
    case "e9_osmosis_review": {
      const bars = (fraction: number | null): Extract<CardModel, { kind: "bars" }> => ({
        kind: "bars",
        slot: 0,
        title: "SLUICE",
        bars: [
          { id: "out", label: "OUTSIDE", value: 5, max: 10, color: "f" },
          { id: "in", label: "INSIDE", value: 5, max: 10, color: "g" },
        ],
        sparkline: { points: [2, 3, 5, 4, 6, 5, 7, 6, 5, 6, 7], max: 10, color: "h" },
        timer: fraction === null ? null : { fraction },
        arrow: "none",
        sr: "The sluice gauges; the white line is the wave timer.",
      });
      return {
        panelStatic: () => ({ cards: [bars(null)], input: null, probe: null, recordPins: [] }),
        panelLive: (_s, input) => {
          const w = input.draft?.wave;
          return { ...EMPTY_LIVE, liveCards: [bars(w ? 1 - w.secondsLeft / w.secondsPerWave : null)] };
        },
      };
    }
    case "e6_facilitated":
    case "e11_boss": {
      const total = enc === "e6_facilitated" ? 10 : 12;
      const cells = (projected: number): Extract<CardModel, { kind: "energy_cells" }> => ({ kind: "energy_cells", slot: 0, title: "ATP", total, spent: 0, projected, sr: `${total} ATP cells; ${projected} would be spent.` });
      return {
        panelStatic: () => ({ cards: [cells(0)], input: null, probe: null, recordPins: [] }),
        panelLive: (_s, input) => {
          const a = (input.draft?.input as { assignments?: { binId: string }[] } | undefined)?.assignments ?? [];
          return { ...EMPTY_LIVE, liveCards: [cells(a.filter((x) => x.binId === "active").length)] };
        },
      };
    }
    case "e8_pump": {
      const stageNames = ["rest", "bind Na⁺", "ATP", "flip out", "swap", "drop P", "flip in"];
      const pump = (k: number): Extract<CardModel, { kind: "schematic" }> => {
        const open = k >= 3 && k < 6;
        return {
          kind: "schematic",
          slot: 0,
          title: "PUMP",
          viewBox: [420, 200],
          prims: [
            { p: "rect", x: 0, y: 70, w: 420, h: 60, color: "h", fill: true },
            { p: "poly", points: [[170, 20], [250, 20], [open ? 270 : 240, 180], [open ? 150 : 180, 180]], color: "g", fill: true, w: 3 },
            { p: "text", x: 210, y: 16, text: `stage ${Math.round(k)} · ${stageNames[Math.round(k)] ?? ""}`, size: 20, color: "f", anchor: "middle" },
            { p: "text", x: 8, y: 195, text: "inside", size: 18, color: "f", anchor: "start" },
            { p: "text", x: 8, y: 62, text: "outside", size: 18, color: "f", anchor: "start" },
          ],
          sr: `The pump at stage ${Math.round(k)}.`,
        };
      };
      const ledger = (loaded: number): Extract<CardModel, { kind: "bars" }> => ({
        kind: "bars",
        slot: 1,
        title: "CHARGE LEDGER",
        bars: [
          { id: "na", label: "Na⁺ OUT", value: loaded, max: 4, color: "f" },
          { id: "k", label: "K⁺ IN", value: Math.max(0, loaded - 1), max: 4, color: "g" },
        ],
        sparkline: null,
        timer: null,
        arrow: null,
        sr: `${loaded} cartridges loaded.`,
      });
      return {
        panelStatic: () => ({ cards: [pump(0), ledger(0)], input: null, probe: null, recordPins: [] }),
        panelLive: (_s, input) => {
          const links = (input.draft?.input as { links?: unknown[] } | undefined)?.links ?? [];
          return { ...EMPTY_LIVE, scrubX: input.probe, readout: null, liveCards: [pump(input.probe ?? 0), ledger(links.length)] };
        },
      };
    }
    case "e10_bulk": {
      const fold = (k: number): Extract<CardModel, { kind: "schematic" }> => {
        const depth = Math.min(1, k / 2) * 70;
        const pinch = Math.max(0, Math.min(1, (k - 2) / 1)) * 30;
        return {
          kind: "schematic",
          slot: 0,
          title: "MEMBRANE FOLD",
          viewBox: [420, 190],
          prims: [
            { p: "poly", points: [[0, 60], [150 + pinch, 60], [170, 60 + depth], [250, 60 + depth], [270 - pinch, 60], [420, 60]], color: "h", fill: false, w: 6 },
            { p: "circle", cx: 210, cy: 40 + depth, r: 18, color: "gold", fill: true },
            { p: "text", x: 210, y: 184, text: `playback ${k.toFixed(1)}`, size: 18, color: "f", anchor: "middle" },
          ],
          sr: "The membrane folds around the particle as the playback runs.",
        };
      };
      return {
        panelStatic: () => ({ cards: [fold(0)], input: null, probe: null, recordPins: [] }),
        panelLive: (_s, input) => ({ ...EMPTY_LIVE, scrubX: input.probe, liveCards: [fold(input.probe ?? 0)] }),
      };
    }
    default:
      return null;
  }
}

/** The demo panel for one gallery station (null = the meta's own panel, which falls back to the view defaults). */
export function demoPanelFor(game: GameKey, enc: string, view: unknown): DemoPanel | null {
  const b = BINDINGS[game][enc];
  if (!b) return null;
  if (game === "trig") {
    if (enc === "e2_period") return ringGate(view as OscillatorView);
    if (enc === "e6_boss") return pendulumSync(view as OscillatorView);
    if (enc === "e3_amplitude") return probeGraph("f(x)", "reference: 3 sin x", "3*sin(x)", 0, 2 * PI, 4);
    if (enc === "e5_period_review") return probeGraph("f(x)", "reference: sin x", "sin(x)", 0, 4 * PI, 2);
    if (enc === "e4_solve")
      return probeGraph("f(x)", "the relief: 2 sin x", "2*sin(x)", 0, 2 * PI, 3, { annotations: [{ kind: "hline", y: 1, label: "water line y = 1", style: "dashed", color: "h" }] });
    return null;
  }
  if (game === "cell") return cellDemo(enc, b);
  return civilFile(enc, b, view);
}
