import { describe, expect, it } from "vitest";
import { ProbeSpec } from "../contracts/world";
import {
  allOrNoneIssues,
  constExprIssues,
  containsPhrase,
  contentTokens,
  dateInTextsIssues,
  digitAppears,
  directionIssues,
  directionOf,
  exprIssues,
  exprRange,
  exprSamples,
  inRangeIssues,
  isPiLabelled2Pi,
  isYearProbe,
  mentions,
  sharedContentTokens,
  stageStopsIssues,
  uniqueIssues,
  yearProbeIssues,
} from "./config-validators";

describe("expression sampling", () => {
  it("samples and ranges", () => {
    const s = exprSamples("2*sin(x)", 0, Math.PI, 5);
    expect(s).toHaveLength(5);
    expect(s[2]?.[1]).toBeCloseTo(2);
    expect(exprRange("2*sin(x)", 0, 2 * Math.PI)?.[1]).toBeCloseTo(2, 1);
    expect(exprRange("log(x - 100)", 0, 1)).toBeNull();
  });
  it("flags expressions that do not evaluate over the domain", () => {
    expect(exprIssues(["f"], "sin(x)", 0, 6)).toEqual([]);
    const bad = exprIssues(["f"], "sqrt(x)", -6, 1);
    expect(bad).toHaveLength(1);
    expect(bad[0]?.severity).toBe("error");
    expect(exprIssues(["f"], "sqrt(x)", -6, 1, 0.9, "warning")[0]?.severity).toBe("warning");
    expect(constExprIssues(["v"], "pi/2")).toEqual([]);
    expect(constExprIssues(["v"], "foo(")).toHaveLength(1);
  });
});

describe("text tokens", () => {
  it("matches whole tokens and phrases", () => {
    expect(contentTokens("Signed the Civil Rights Act into law")).toEqual(["signed", "civil", "rights", "act", "law"]);
    expect(containsPhrase("He signed the act.", "signed the act")).toBe(true);
    expect(containsPhrase("resigned the actor", "signed the act")).toBe(false);
    expect(sharedContentTokens("Who signed the act?", "Signed the Civil Rights Act into law")).toEqual(["signed", "act"]);
  });
  it("mentions: full text or two content tokens (civil O8)", () => {
    expect(mentions("Only one card here signed the act.", "Signed the Civil Rights Act into law")).toBe(true);
    expect(mentions("The act passed.", "Signed the Civil Rights Act into law")).toBe(false);
    expect(mentions("Look for the Civil Rights Act", "Civil Rights Act")).toBe(true);
    expect(mentions("x", "the")).toBe(false);
  });
  it("digitAppears is whole-number", () => {
    expect(digitAppears("3 sodium ions out", 3)).toBe(true);
    expect(digitAppears("30 ions", 3)).toBe(false);
    expect(digitAppears("0.3 mM", 3)).toBe(false);
    expect(digitAppears("uses 1 ATP", 1)).toBe(true);
  });
});

describe("direction words", () => {
  it("reads the gradient direction", () => {
    expect(directionOf("Oxygen diffuses from high to low concentration")).toBe("down");
    expect(directionOf("Sodium is pumped out against its gradient")).toBe("up");
    expect(directionOf("Water crosses")).toBeNull();
  });
  it("warns when levels disagree", () => {
    expect(directionIssues(["i0"], "moves down its gradient", 8, 2)).toEqual([]);
    expect(directionIssues(["i0"], "moves down its gradient", 2, 8)[0]?.severity).toBe("warning");
    expect(directionIssues(["i0"], "pumped uphill", 8, 2)).toHaveLength(1);
    expect(directionIssues(["i0"], "pumped uphill", null, 2)).toEqual([]);
  });
});

describe("probes, stages and views", () => {
  const stage = ProbeSpec.parse({ symbol: "k", label: "pump stage", min: 1, max: 3, step: 1, format: "stage", stops: [{ v: 1, label: "a" }, { v: 2, label: "b" }, { v: 3, label: "c" }] });
  it("stage stops cover min…max", () => {
    expect(stageStopsIssues(["stages"], stage)).toEqual([]);
    expect(stageStopsIssues(["stages"], { ...stage, stops: stage.stops.slice(0, 2) })).toHaveLength(1);
    expect(stageStopsIssues(["stages"], { ...stage, format: "number" })).toHaveLength(1);
    expect(stageStopsIssues(["stages"], null)).toHaveLength(1);
  });
  it("year probes", () => {
    const y = ProbeSpec.parse({ symbol: "YEAR", label: "record year", min: 1950, max: 1970, step: 1 / 12, format: "month_year", window: { start: 1950, end: 1970 } });
    expect(isYearProbe(y)).toBe(true);
    expect(isYearProbe(stage)).toBe(false);
    expect(yearProbeIssues(["probe"], y, "dayCounter")).toEqual([]);
    expect(yearProbeIssues(["probe"], { ...y, window: null }, "dayCounter")).toHaveLength(1);
    expect(yearProbeIssues(["probe"], stage, "dayCounter")).toHaveLength(1);
  });
  it("π-labelled 2π views", () => {
    const view = { scale: "linear", min: 0, max: 2 * Math.PI, target: "5π/6", landmarks: [{ value: 0, fraction: 0, label: "0" }, { value: Math.PI, fraction: 0.5, label: "π" }] };
    expect(isPiLabelled2Pi(view)).toBe(true);
    expect(isPiLabelled2Pi({ ...view, max: Math.PI })).toBe(false);
    expect(isPiLabelled2Pi({ ...view, landmarks: [{ value: 0, fraction: 0, label: "0" }] })).toBe(false);
    expect(isPiLabelled2Pi(null)).toBe(false);
  });
});

describe("dates and uniqueness", () => {
  it("dateInTextsIssues", () => {
    expect(dateInTextsIssues(["x"], "1957", ["Little Rock, 1957"], "printedDate")).toEqual([]);
    expect(dateInTextsIssues(["x"], "1958", ["Little Rock, 1957"], "printedDate")).toHaveLength(1);
    expect(dateInTextsIssues(["x"], null, [], "printedDate")).toEqual([]);
    expect(dateInTextsIssues(["x"], "57", [], "printedDate")[0]?.message).toMatch(/YYYY/);
  });
  it("unique, range and all-or-none", () => {
    expect(uniqueIssues(["k"], "key", ["a", "b"])).toEqual([]);
    expect(uniqueIssues(["k"], "key", ["a", "a", "b"])).toHaveLength(1);
    expect(inRangeIssues(["b"], "bracket", [0, 1, null, 5], 0, 2)).toHaveLength(2);
    expect(allOrNoneIssues(["f"], "footprints", [true, true])).toEqual([]);
    expect(allOrNoneIssues(["f"], "footprints", [false, false])).toEqual([]);
    expect(allOrNoneIssues(["f"], "footprints", [true, false])).toHaveLength(1);
  });
});
