import { describe, expect, it } from "vitest";
import { RecordStrip } from "../../../contracts/world";
import type { CardModel, OscillatorView, PanelContext, PanelStatic } from "../../../world/types";
import { defaultPanelLive, defaultPanelStatic, oscillatorCard, unitCircleCard } from "./default-panel";
import { evalSource, exprSource, oscillatorFn, sampleSource } from "./fn-source";
import { applyOverrides, chipsFor, displayStack, mergeLive, recordChip, resolvePanelStatic, sharesDomain, showsRecord, splitSurface } from "./panel-model";

const STRIP: RecordStrip = RecordStrip.parse({
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
  ],
});

const FILE: CardModel = {
  kind: "timeline",
  slot: 0,
  title: "FILE",
  tab: "FILE",
  from: 1954,
  to: 1958,
  unit: "year",
  lanes: [],
  pins: [],
  bands: [],
  arrows: [],
  axisBreak: null,
  sr: "file",
};
const CLAIMS: CardModel = { kind: "claims", slot: 1, title: "CLAIMS", scenario: null, items: [], sr: "claims" };
const GRAPH: CardModel = {
  kind: "graph",
  slot: 2,
  title: "g",
  tab: "g(x)",
  x: { min: 1954, max: 1958, unit: "year", ticks: [], label: null },
  y: { min: -1, max: 1, unit: "number", ticks: [], label: null },
  plots: [],
  annotations: [],
  columns: [],
  targetLine: null,
  empty: true,
  sr: "g",
};

describe("the RECORD card (A6) and display slots", () => {
  const ctx: PanelContext = { recordStrip: STRIP, solvedIds: ["e1_brown", "e2_montgomery"], probeWindow: { start: 1954, end: 1958 } };

  it("renders RECORD from a PanelContext at display slot 0 and shifts the meta's cards one slot down", () => {
    const stack = displayStack([FILE, CLAIMS, GRAPH], ctx, [{ key: "hint", at: 1957, label: "Little Rock", style: "hint" }], 1955.95, "scrub");
    expect(stack.map((d) => [d.displaySlot, d.metaSlot, d.card.kind])).toEqual([
      [0, null, "timeline"],
      [1, 0, "timeline"],
      [2, 1, "claims"],
      [3, 2, "graph"],
    ]);
    const record = stack[0].card as Extract<CardModel, { kind: "timeline" }>;
    expect(record.title).toBe("RECORD");
    expect(record.pins.filter((p) => p.style === "earned").map((p) => p.label)).toEqual(["Brown v. Board", "Parks arrested", "Boycott, 381 days"]);
    expect(record.pins.some((p) => p.style === "hint" && p.label === "Little Rock")).toBe(true);
    expect(record.bands.length).toBe(1);
    expect([record.from, record.to]).toEqual([1954, 1958]);
  });

  it("CardOverride.slot stays meta-relative while RECORD shifts the display", () => {
    const overridden = applyOverrides([FILE, CLAIMS, GRAPH], [
      { slot: 0, title: "DOSSIER", x: null, y: null, hidden: false },
      { slot: 2, title: null, x: null, y: null, hidden: true },
    ]);
    const stack = displayStack(overridden, ctx, [], null, "board");
    expect(stack.map((d) => d.card.title)).toEqual(["RECORD", "DOSSIER", "CLAIMS"]);
    expect(stack.map((d) => d.metaSlot)).toEqual([null, 0, 1]);
    expect(stack[1].displaySlot).toBe(1);
  });

  it("is prepended only in the scrub and board layouts, and only with a record strip", () => {
    expect(showsRecord(ctx, "scrub")).toBe(true);
    expect(showsRecord(ctx, "board")).toBe(true);
    expect(showsRecord(ctx, "vault")).toBe(false);
    expect(showsRecord(ctx, "sandbox")).toBe(false);
    expect(showsRecord({ ...ctx, recordStrip: null }, "scrub")).toBe(false);
    expect(displayStack([FILE], ctx, [], null, "vault").map((d) => d.metaSlot)).toEqual([0]);
  });

  it("the RECORD chip names the nearest earned pin within ±2 months of the cursor, else —", () => {
    const record = displayStack([], ctx, [], null, "scrub")[0].card as Extract<CardModel, { kind: "timeline" }>;
    expect(recordChip(record, 1955.95).text).toBe("Parks arrested");
    expect(recordChip(record, 1955.95).value).toBe(0); // the origins lane
    expect(recordChip(record, 1954.1).text).toBe("Brown v. Board");
    expect(recordChip(record, 1957).text).toBe("—");
    expect(recordChip(record, null).text).toBe("—");
    const chips = chipsFor(displayStack([], ctx, [], 1954, "scrub")[0], { chips: [] }, 1954);
    expect(chips.map((c) => c.text)).toEqual(["Brown v. Board"]);
  });

  it("meta chips ride the card of their META slot", () => {
    const stack = displayStack([FILE, GRAPH], ctx, [], null, "scrub");
    const live = { chips: [{ slot: 2, value: 0.5, text: "0.5", color: "g" as const }] };
    expect(chipsFor(stack[2], live, null).map((c) => c.text)).toEqual(["0.5"]);
    expect(chipsFor(stack[1], live, null)).toEqual([]);
  });
});

describe("stack helpers", () => {
  it("live cards replace the static card of the same slot", () => {
    const live = { ...FILE, title: "FILE (live)" };
    expect(mergeLive([FILE, CLAIMS], [live]).map((c) => c.title)).toEqual(["FILE (live)", "CLAIMS"]);
  });

  it("axis overrides recompute ticks for graph cards", () => {
    const [g] = applyOverrides([GRAPH], [{ slot: 2, title: "h(x)", x: { min: 0, max: 10, unit: "number", label: null }, y: null, hidden: false }]);
    expect(g.kind === "graph" && g.x.max).toBe(10);
    expect(g.kind === "graph" && g.tab).toBe("h(x)");
    expect(g.kind === "graph" && g.x.ticks.some((t) => t.label === "10")).toBe(true);
  });

  it("splitSurface hands the control its surface card and renumbers the display", () => {
    const stack = displayStack([FILE, CLAIMS, GRAPH], { recordStrip: null, solvedIds: [], probeWindow: null }, [], null, "board");
    const { stack: rest, surface } = splitSurface(stack, "claims");
    expect(surface?.kind).toBe("claims");
    expect(rest.map((d) => [d.displaySlot, d.metaSlot])).toEqual([
      [0, 0],
      [1, 2],
    ]);
    expect(splitSurface(stack, null).surface).toBeNull();
    expect(splitSurface(stack, "matrix").stack.length).toBe(3);
  });

  it("sharesDomain: graph and timeline cards whose window equals the scrubber's", () => {
    expect(sharesDomain(FILE, { min: 1954, max: 1958 })).toBe(true);
    expect(sharesDomain(GRAPH, { min: 1954, max: 1958 })).toBe(true);
    expect(sharesDomain(GRAPH, { min: 0, max: 10 })).toBe(false);
    expect(sharesDomain(CLAIMS, { min: 1954, max: 1958 })).toBe(false);
    expect(sharesDomain(FILE, null)).toBe(false);
  });

  it("resolvePanelStatic keeps a native meta's model and fills a W0 stub from the view defaults", () => {
    const stub: PanelStatic = { cards: [], input: null, probe: null, recordPins: [] };
    const defaults: PanelStatic = { cards: [FILE], input: { symbol: "T", min: 0, max: 1, step: 0.1, unit: "number", format: "number", ticks: [] }, probe: null, recordPins: [] };
    expect(resolvePanelStatic(stub, defaults, true)).toMatchObject({ usingDefaults: true, stat: { cards: [FILE], input: defaults.input } });
    expect(resolvePanelStatic(stub, defaults, false).stat.input).toBeNull();
    const native: PanelStatic = { ...stub, cards: [GRAPH] };
    expect(resolvePanelStatic(native, defaults, true)).toMatchObject({ usingDefaults: false, stat: { cards: [GRAPH], input: defaults.input } });
  });
});

describe("view defaults (before the K lanes' metas are native)", () => {
  const e2: OscillatorView = {
    equation: "y = sin(2t)",
    ask: "period",
    askLabel: "period",
    wave: "sin",
    amplitude: 1,
    b: 2,
    c: 0,
    d: 0,
    dial: { min: 0, max: 2 * Math.PI, step: Math.PI / 12, ticks: [{ value: 0, label: "0" }, { value: Math.PI, label: "π" }, { value: 2 * Math.PI, label: "2π" }], unit: "" },
  };

  it("an oscillator gets an f(t) card on the dial's window and the scalar input; its live model follows T", () => {
    const stat = defaultPanelStatic("tuner.oscillator", e2);
    expect(stat.input).toMatchObject({ symbol: "T", format: "pi" });
    expect(stat.cards).toHaveLength(1);
    const card = stat.cards[0] as Extract<CardModel, { kind: "graph" }>;
    expect(card.tab).toBe("f(t)");
    expect([card.x.min, card.x.max]).toEqual([0, 2 * Math.PI]);
    expect(card.x.ticks.filter((t) => t.label).map((t) => t.label)).toEqual(["2π"]);
    expect(card.sr).not.toMatch(/π\b.*period|period.*π/); // never states the answer
    const live = defaultPanelLive(stat, "tuner.oscillator", e2, Math.PI / 4);
    expect(live.scrubX).toBeCloseTo(Math.PI / 4);
    expect(live.readout).toBe("π/4");
    expect(live.chips[0]).toMatchObject({ slot: 0, text: "1.0", color: "f" });
    expect((live.liveCards[0] as Extract<CardModel, { kind: "graph" }>).annotations.some((a) => a.kind === "live_dot")).toBe(true);
  });

  it("a π number line gets the unit circle; the point and arc follow θ", () => {
    const view = { scale: "linear", min: 0, max: 2 * Math.PI, target: "5π/6", landmarks: [{ value: 0, fraction: 0, label: "0" }, { value: Math.PI, fraction: 0.5, label: "π" }, { value: 2 * Math.PI, fraction: 1, label: "2π" }] };
    const stat = defaultPanelStatic("mapper.number_line", view);
    expect(stat.cards[0].kind).toBe("unit_circle");
    const uc = unitCircleCard(view);
    expect(uc.landmarks.map((l) => l.label)).toEqual(["0", "π"]); // 2π coincides with 0 on the circle
    expect(JSON.stringify(stat)).not.toContain("5π/6"); // the target never reaches the panel model
    const live = defaultPanelLive(stat, "mapper.number_line", view, Math.PI / 2);
    const lc = live.liveCards[0] as Extract<CardModel, { kind: "unit_circle" }>;
    expect(lc.point?.angle).toBeCloseTo(Math.PI / 2);
    expect(lc.arc).toMatchObject({ from: 0, color: "accent" });
    expect(live.chips[0].value).toBeCloseTo(1);
  });

  it("discrete modes need no default cards", () => {
    expect(defaultPanelStatic("truth_finder.mimic", { chests: [] })).toMatchObject({ cards: [], input: null });
  });

  it("oscillatorCard and fn-source agree; expr sources sample through the sandboxed evaluator and memoize", () => {
    const f = oscillatorFn(e2);
    expect(f(Math.PI / 4)).toBeCloseTo(1);
    expect(oscillatorCard(e2).plots[0].segments[0].length).toBe(321);
    const src = exprSource("1/x");
    expect(Number.isNaN(evalSource(src, 0))).toBe(true);
    expect(evalSource(src, 2)).toBe(0.5);
    const a = sampleSource(src, -1, 1, 40);
    expect(a.length).toBe(2);
    expect(sampleSource(src, -1, 1, 40)).toBe(a);
    expect(Number.isNaN(evalSource(exprSource("import('fs')"), 1))).toBe(true);
  });
});
