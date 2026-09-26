import { describe, expect, it } from "vitest";
import { RecordStrip } from "../contracts/world";
import { fracYearOf } from "./contraptions/config-parts";
import {
  CHIP_RADIUS_YEARS,
  chipText,
  fileCard,
  fileChip,
  fileDatePins,
  footprintMarks,
  formatDateSlug,
  formatMonthYear,
  formatMonthYearLong,
  hintRecordPins,
  lensTarget,
  lensU,
  probeWindowOf,
  recordCard,
  recordChip,
  withEarnedPins,
  yearReadout,
} from "./record-strip";
import type { PanelContext } from "./types";

// civil §5.0.2: the world file's story.recordStrip (14 pins over 9 encounters)
const CIVIL_STRIP = RecordStrip.parse({
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
const ORDER = ["e1_brown", "e2_montgomery", "e3_little_rock", "e4_sit_ins", "e5_freedom_rides", "e6_birmingham", "e7_march", "e8_cra", "e9_selma", "e10_sources", "e11_causation", "e12_boss"];
/** The PanelContext while station `id` is open: every earlier encounter solved (progress.solvedIds, encounter order). */
function ctxAt(id: string, probeWindow: PanelContext["probeWindow"] = null): PanelContext {
  return { recordStrip: CIVIL_STRIP, solvedIds: ORDER.slice(0, ORDER.indexOf(id)), probeWindow };
}
const earned = (c: ReturnType<typeof recordCard>) => c.pins.filter((p) => p.style === "earned");

describe("recordCard (the panel-owned RECORD card, A6)", () => {
  it("with the civil strip, e1's RECORD shows 0 earned pins and e9's shows 11", () => {
    const e1 = recordCard(ctxAt("e1_brown", { start: 1950, end: 1960 }), [], null);
    expect(earned(e1)).toHaveLength(0);
    expect(e1.bands).toHaveLength(0);
    const e9 = recordCard(ctxAt("e9_selma", { start: 1964.4167, end: 1965.75 }), [], null);
    expect(earned(e9)).toHaveLength(11);
    expect(e9.pins.every((p) => p.style === "earned")).toBe(true);
    expect(e9.pins.some((p) => p.label === "Bloody Sunday")).toBe(false); // e9's own pins only after e9 is solved
    expect(e9.lanes.map((l) => l.id)).toEqual(["origins", "direct_action", "legislation"]);
    expect(e9).toMatchObject({ kind: "timeline", slot: 0, title: "RECORD", tab: "RECORD", unit: "year", axisBreak: null });
    const all = recordCard({ recordStrip: CIVIL_STRIP, solvedIds: ORDER, probeWindow: null }, [], null);
    expect(earned(all)).toHaveLength(14);
    expect(new Set(all.pins.map((p) => p.key)).size).toBe(14); // keys are unique
  });

  it("only solved encounters earn pins (not encounter order), and each pin keeps its lane", () => {
    const card = recordCard({ recordStrip: CIVIL_STRIP, solvedIds: ["e8_cra"], probeWindow: null }, [], null);
    expect(card.pins).toEqual([{ key: "rec:e8_cra:1964-07-02", at: fracYearOf("1964-07-02"), label: "Civil Rights Act", lane: "legislation", style: "earned", spanTo: null }]);
  });

  it("spanTo becomes a band (the 381-day boycott)", () => {
    const card = recordCard(ctxAt("e3_little_rock"), [], null);
    expect(card.bands).toEqual([{ from: fracYearOf("1955-12"), to: fracYearOf("1956-12"), label: "Boycott, 381 days", color: "f" }]);
    expect(card.pins.find((p) => p.label === "Boycott, 381 days")?.spanTo).toBeCloseTo(1956.9167, 3);
  });

  it("merges the meta's recordPins (hint pins, dashed) after the earned pins", () => {
    const hint = { key: "hint:0", at: 1957, label: "Little Rock", style: "hint" as const };
    const card = recordCard(ctxAt("e1_brown", { start: 1950, end: 1960 }), [hint], 1955);
    expect(card.pins).toEqual([{ key: "hint:0", at: 1957, label: "Little Rock", lane: null, style: "hint", spanTo: null }]);
    expect(card.sr).toMatch(/1 hint pin/);
    const later = recordCard(ctxAt("e3_little_rock"), [{ key: "d", at: 1956, label: "dim", style: "dim" }], null);
    expect(later.pins.map((p) => p.style)).toEqual(["earned", "earned", "earned", "dim"]);
  });

  it("takes its window from probeWindow, else the pins' span ± 1 year", () => {
    expect(recordCard(ctxAt("e3_little_rock", { start: 1954, end: 1958 }), [], null)).toMatchObject({ from: 1954, to: 1958 });
    // e1, e2 solved: 1954 … 1956.917 (the band end) → 1953 … 1958
    expect(recordCard(ctxAt("e3_little_rock"), [], null)).toMatchObject({ from: 1953, to: 1958 });
    expect(recordCard({ recordStrip: null, solvedIds: [], probeWindow: null }, [], null)).toMatchObject({ from: 1950, to: 1970, pins: [], lanes: [] });
  });

  it("describes itself for screen readers, including the cursor month", () => {
    const card = recordCard(ctxAt("e3_little_rock", { start: 1954, end: 1958 }), [], 1955.9167);
    expect(card.sr).toMatch(/^The record, 1954 to 1958: 3 restored entries; cursor at December 1955, near DEC 1955 · BOYCOTT, 381 DAYS\.$/);
    expect(recordCard(ctxAt("e1_brown"), [], null).sr).toMatch(/no restored entries/);
  });
});

describe("the RECORD chip (nearest earned pin within ±2 months of the cursor)", () => {
  const ctx = ctxAt("e4_sit_ins", { start: 1959, end: 1961 });
  it("names the nearest earned pin inside ±2 months", () => {
    expect(recordChip(ctx, fracYearOf("1957-09")!)).toEqual({ key: "rec:e3_little_rock:1957-09-25", text: "SEP 1957 · LITTLE ROCK NINE ESCORTED" });
    expect(recordChip(ctx, fracYearOf("1957-11")!).text).toBe("SEP 1957 · LITTLE ROCK NINE ESCORTED"); // 1.2 months after the 25th
    expect(recordChip(ctx, 1954.1).text).toBe("1954 · BROWN V. BOARD"); // year precision prints the year
  });
  it("is — outside ±2 months and without a cursor", () => {
    expect(recordChip(ctx, fracYearOf("1957-06")!)).toEqual({ key: null, text: "—" }); // 3.8 months before
    expect(recordChip(ctx, fracYearOf("1958-01")!).text).toBe("—");
    expect(recordChip(ctx, null)).toEqual({ key: null, text: "—" });
    expect(recordChip(ctxAt("e1_brown"), 1954)).toEqual({ key: null, text: "—" }); // nothing earned yet
  });
  it("uses the ±2-month radius exactly, and a band counts from anywhere inside it", () => {
    const at = fracYearOf("1961")!;
    const c5 = { recordStrip: CIVIL_STRIP, solvedIds: ["e5_freedom_rides"], probeWindow: null };
    expect(recordChip(c5, at + CHIP_RADIUS_YEARS).text).toBe("1961 · FREEDOM RIDES");
    expect(recordChip(c5, at + CHIP_RADIUS_YEARS + 0.01).text).toBe("—");
    expect(recordChip(ctx, fracYearOf("1956-06")!).text).toBe("DEC 1955 · BOYCOTT, 381 DAYS");
  });
  it("prefers the closer pin when two are in range", () => {
    // Jan 1956: Parks (Dec 1) is a month away, the boycott band contains the cursor
    expect(recordChip(ctx, fracYearOf("1956-01")!).key).toBe("rec:e2_montgomery:1955-12");
    // Sep 1957: only Little Rock is in range
    expect(recordChip(ctx, fracYearOf("1957-08")!).key).toBe("rec:e3_little_rock:1957-09-25");
    // Nov 1955: Parks (Dec 1) is 1 month away, the band starts at the same instant: the first in record order wins a tie
    expect(recordChip(ctx, fracYearOf("1955-11")!).text).toBe("DEC 1955 · PARKS ARRESTED");
  });
});

describe("formatting", () => {
  it("formats fractional years as the month they fall in", () => {
    expect(formatMonthYear(1965.1667)).toBe("MAR 1965");
    expect(formatMonthYear(fracYearOf("1965-03")!)).toBe("MAR 1965");
    expect(formatMonthYear(fracYearOf("1957-09-25")!)).toBe("SEP 1957");
    expect(formatMonthYear(1957.9999)).toBe("DEC 1957");
    expect(formatMonthYear(1958)).toBe("JAN 1958");
    expect(formatMonthYearLong(1965.1667)).toBe("March 1965");
    expect(formatDateSlug("1957-09-25")).toBe("SEP 25 1957");
    expect(formatDateSlug("1955-12")).toBe("DEC 1955");
    expect(formatDateSlug("1896")).toBe("1896");
    expect(chipText("1963-06", "Kennedy's bill")).toBe("JUN 1963 · KENNEDY'S BILL");
    expect(yearReadout("month_year", 1965.1667)).toBe("MAR 1965");
    expect(yearReadout("year", 1971.5)).toBe("1971");
    expect(yearReadout("number", 3)).toBeNull();
    expect(yearReadout("month_year", null)).toBeNull();
  });
});

describe("FILE-card helpers", () => {
  // civil e1: pin 1954, band 1954–1955, arrow 1896 → 1954 over a 1950–1960 window
  const e1Marks = [
    footprintMarks("0", { kind: "pin", from: "1954", to: null, label: "ruled 1954" }, "dim"),
    footprintMarks("1", { kind: "band", from: "1954", to: "1955", label: "claimed: desegregated" }, "draft"),
    footprintMarks("2", { kind: "arrow", from: "1896", to: "1954", label: "overturned" }, "dim"),
  ];

  it("draws pins, bands and arrows from claim footprints", () => {
    expect(e1Marks[0].pins).toEqual([{ key: "fp:0", at: 1954, label: "ruled 1954", lane: null, style: "dim", spanTo: null }]);
    expect(e1Marks[1].bands).toEqual([{ from: 1954, to: 1955, label: "claimed: desegregated", color: "g" }]);
    expect(e1Marks[1].pins[0]).toMatchObject({ key: "fp:1", style: "draft", spanTo: 1955 });
    expect(e1Marks[2].pins.map((p) => [p.key, p.at, p.label])).toEqual([
      ["fp:2:from", 1896, "1896"],
      ["fp:2:to", 1954, "overturned"],
    ]);
    expect(e1Marks[2].arrows).toEqual([{ fromKey: "fp:2:from", toKey: "fp:2:to" }]);
  });

  it("adds one axis break for dates outside the window (e1's 1896 ≈)", () => {
    const card = fileCard({ slot: 0, window: { start: 1950, end: 1960 }, marks: e1Marks });
    expect(card).toMatchObject({ kind: "timeline", slot: 0, title: "FILE", tab: "FILE", from: 1895.5, to: 1960, axisBreak: { from: 1896.5, to: 1950 } });
    expect(card.pins).toHaveLength(4);
    expect(card.arrows).toHaveLength(1);
    const inside = fileCard({ slot: 0, window: { start: 1950, end: 1960 }, marks: e1Marks.slice(0, 2) });
    expect(inside).toMatchObject({ from: 1950, to: 1960, axisBreak: null });
    const after = fileCard({ slot: 2, window: { start: 1963, end: 1966 }, marks: [], pins: [{ key: "x", at: 1971, label: "textbook", lane: null, style: "dim", spanTo: null }] });
    expect(after).toMatchObject({ slot: 2, from: 1963, to: 1971.5, axisBreak: { from: 1966, to: 1970.5 } });
    const loose = fileCard({ slot: 0, window: null, marks: [], pins: fileDatePins([{ date: "1957-09", label: "Guard posted" }]) });
    expect(loose).toMatchObject({ from: 1956, to: 1959, axisBreak: null });
    expect(loose.sr).toBe("FILE, 1956 to 1959: SEP 1957 Guard posted.");
  });

  it("plots fileDates at their fractional years and chips them within ±2 months", () => {
    const pins = fileDatePins([
      { date: "1957-09", label: "Guard posted" },
      { date: "1960-02-01", label: "Greensboro" },
    ]);
    expect(pins.map((p) => [p.key, p.at])).toEqual([
      ["file:0", fracYearOf("1957-09")],
      ["file:1", 1960 + 1 / 12],
    ]);
    const card = fileCard({ slot: 0, window: { start: 1954, end: 1958 }, marks: [], pins });
    expect(fileChip(card, fracYearOf("1957-10")!).text).toBe("SEP 1957 · GUARD POSTED");
    expect(fileChip(card, 1956).text).toBe("—");
    expect(fileChip(card, null).text).toBe("—");
  });

  it("hint pins become recordPins by rung (rung 2 at aid tier 2; rung 3 only after the third hint)", () => {
    const pins = [
      { rung: 2 as const, date: "1957", label: "Little Rock" },
      { rung: 3 as const, date: "1960-02", label: "Greensboro" },
      { rung: 1 as const, date: "1955-12-01", label: "Parks" },
    ];
    expect(hintRecordPins(pins, 0, 0)).toEqual([]);
    expect(hintRecordPins(pins, 1, 0).map((p) => p.label)).toEqual(["Parks"]);
    expect(hintRecordPins(pins, 1, 1).map((p) => p.label)).toEqual(["Parks"]);
    expect(hintRecordPins(pins, 2, 2)).toEqual([
      { key: "hint:0", at: 1957, label: "Little Rock", style: "hint" },
      { key: "hint:2", at: fracYearOf("1955-12-01"), label: "Parks", style: "hint" },
    ]);
    expect(hintRecordPins(pins, 2, 3).map((p) => p.label)).toEqual(["Little Rock", "Greensboro", "Parks"]);
    // …and they reach the RECORD card through recordCard's recordPins
    const card = recordCard(ctxAt("e1_brown", { start: 1950, end: 1960 }), hintRecordPins(pins.slice(0, 1), 2, 2), null);
    expect(card.pins).toEqual([{ key: "hint:0", at: 1957, label: "Little Rock", lane: null, style: "hint", spanTo: null }]);
  });

  it("withEarnedPins puts the earned record on a meta-owned strip without moving its window", () => {
    const mini = fileCard({ slot: 0, window: { start: 1954, end: 1967 }, marks: [], pins: [{ key: "clue:1", at: 1965.2, label: "CLUE 2", lane: null, style: "focus", spanTo: null }], title: "RECORD" });
    const ctx = { recordStrip: CIVIL_STRIP, solvedIds: ORDER.slice(0, 11), probeWindow: null };
    const merged = withEarnedPins(mini, ctx);
    expect(merged).toMatchObject({ from: 1954, to: 1967, slot: 0 });
    expect(merged.pins.filter((p) => p.style === "earned")).toHaveLength(14);
    expect(merged.pins.at(-1)?.key).toBe("clue:1");
    expect(merged.bands).toHaveLength(1);
    expect(merged.lanes).toHaveLength(3);
    expect(withEarnedPins(mini, ctxAt("e1_brown"))).toBe(mini);
  });
});

describe("record lens (lensU, lensTarget)", () => {
  const w = { start: 1954, end: 1958 };
  // civil e3: the lens rides the telegraph wire, a rail that bends at (1700, 420)
  const bent: [number, number][] = [
    [1250, 470],
    [1700, 420],
    [2600, 560],
  ];
  const l1 = Math.hypot(450, 50);
  const l2 = Math.hypot(900, 140);

  it("maps the probe window to [0, 1], clamped", () => {
    expect(lensU(w, 1954)).toBe(0);
    expect(lensU(w, 1956)).toBe(0.5);
    expect(lensU(w, 1958)).toBe(1);
    expect(lensU(w, 1940)).toBe(0);
    expect(lensU(w, 1990)).toBe(1);
    expect(lensU({ start: 1960, end: 1960 }, 1960)).toBe(0);
    expect(lensU(w, Number.NaN)).toBe(0);
  });

  it("follows arc length along a bent rail", () => {
    expect(lensTarget(bent, w, 1954)).toEqual({ x: 1250, y: 470 });
    expect(lensTarget(bent, w, 1958)).toEqual({ x: 2600, y: 560 });
    // the bend is reached at u = l1 / (l1 + l2)
    const uBend = l1 / (l1 + l2);
    const atBend = lensTarget(bent, w, 1954 + 4 * uBend);
    expect(atBend.x).toBeCloseTo(1700, 6);
    expect(atBend.y).toBeCloseTo(420, 6);
    // halfway by arc length lies on the second segment, at the right distance from the start of that segment
    const mid = lensTarget(bent, w, 1956);
    const along = (l1 + l2) / 2 - l1;
    expect(mid.x).toBeCloseTo(1700 + (900 * along) / l2, 6);
    expect(mid.y).toBeCloseTo(420 + (140 * along) / l2, 6);
    // equal probe steps move the carriage equal distances along the rail, across the bend
    const pts = [1955.6, 1955.8, 1956.0].map((y) => lensTarget(bent, w, y));
    const d1 = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    const d2 = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);
    expect(d1).toBeCloseTo(d2, 6);
    // clamped outside the window; a one-point rail stays put
    expect(lensTarget(bent, w, 1800)).toEqual({ x: 1250, y: 470 });
    expect(lensTarget([[10, 20]], w, 1956)).toEqual({ x: 10, y: 20 });
  });

  it("reads a probe's window, else its range", () => {
    expect(probeWindowOf({ min: 1950, max: 1960, window: { start: 1951, end: 1959 } })).toEqual({ start: 1951, end: 1959 });
    expect(probeWindowOf({ min: 1950, max: 1960, window: null })).toEqual({ start: 1950, end: 1960 });
    expect(probeWindowOf(null)).toBeNull();
  });
});
