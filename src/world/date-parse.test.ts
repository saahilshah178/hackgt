import { describe, expect, it } from "vitest";
import { compareDates, dateAppears, dateAppearsIn, dateSpanOf, findDates, firstDate, monthIndexOf, parseDates } from "./date-parse";

const dates = (t: string) => parseDates(t).map((d) => d.date);

describe("parseDates", () => {
  it("reads day, month and year precision", () => {
    expect(dates("On December 1, 1955 Rosa Parks was arrested.")).toEqual(["1955-12-01"]);
    expect(dates("Dec. 1st 1955")).toEqual(["1955-12-01"]);
    expect(dates("1 December 1955")).toEqual(["1955-12-01"]);
    expect(dates("In March 1965 marchers crossed.")).toEqual(["1965-03"]);
    expect(dates("in March of 1965")).toEqual(["1965-03"]);
    expect(dates("Little Rock, 1957.")).toEqual(["1957"]);
    expect(parseDates("December 1, 1955")[0]?.precision).toBe("day");
    expect(parseDates("March 1965")[0]?.precision).toBe("month");
  });
  it("reads ISO forms and rejects impossible days", () => {
    expect(dates("filed 1955-12-01")).toEqual(["1955-12-01"]);
    expect(dates("filed 1965-03")).toEqual(["1965-03"]);
    expect(dates("February 30, 1956")).toEqual(["1956"]);
  });
  it("reads ranges", () => {
    const r = parseDates("The boycott ran 1955–1956.")[0];
    expect(r?.date).toBe("1955");
    expect(r?.to).toBe("1956");
    expect(parseDates("1955-56")[0]?.to).toBe("1956");
    expect(parseDates("from 1954 until 1957")[0]?.to).toBe("1957");
    expect(parseDates("between 1954 and 1957")[0]?.to).toBe("1957");
    expect(parseDates("from May 1961 to August 1961")[0]?.to).toBe("1961-08");
    // a list is not a range
    expect(parseDates("in 1955 and 1965").map((d) => d.to)).toEqual([null, null]);
  });
  it("reads qualifiers and decades as approximate", () => {
    const late = parseDates("late 1955")[0];
    expect(late?.approx).toBe(true);
    expect(late?.start).toBeCloseTo(1955 + 2 / 3);
    const dec = parseDates("the 1950s")[0];
    expect(dec?.date).toBe("1950");
    expect(dec?.end).toBe(1960);
    expect(parseDates("mid-1950s")[0]?.start).toBe(1953);
    expect(parseDates("spring of 1963")[0]?.approx).toBe(true);
    expect(parseDates("c. 1900")[0]?.approx).toBe(true);
  });
  it("does not read non-years", () => {
    expect(dates("40 spans and 4 seconds, 12345 units")).toEqual([]);
  });
  it("firstDate skips approximate mentions; dateSpanOf spans all", () => {
    expect(firstDate("the 1950s, then May 17, 1954")).toBe("1954-05-17");
    expect(firstDate("no dates")).toBeNull();
    expect(dateSpanOf(["1954", "1965"])).toEqual({ start: 1954, end: 1966 });
    expect(dateSpanOf(["none"])).toBeNull();
  });
});

describe("dateAppears", () => {
  const texts = ["Brown v. Board was decided on May 17, 1954.", "The march reached Montgomery in March 1965."];
  it("follows the §4.4 date rule", () => {
    expect(dateAppears(texts, "1954")).toBe(true);
    expect(dateAppears(texts, "1954-05")).toBe(true);
    expect(dateAppears(texts, "1954-05-17")).toBe(true);
    expect(dateAppears(texts, "1954-06")).toBe(false);
    expect(dateAppears(texts, "1954-05-18")).toBe(false);
    // month and year must be in the SAME text
    expect(dateAppears(texts, "1965-05")).toBe(false);
    expect(dateAppears(texts, "1960")).toBe(false);
    expect(dateAppears(texts, "bad")).toBe(false);
  });
  it("slack and ranges", () => {
    expect(dateAppears(texts, "1955", { slackYears: 1 })).toBe(true);
    expect(dateAppears(texts, "1956", { slackYears: 1 })).toBe(false);
    expect(dateAppears(["The boycott ran 1955–1957."], "1956")).toBe(false);
    expect(dateAppears(["The boycott ran 1955–1957."], "1956", { ranges: true })).toBe(true);
    expect(dateAppears(["filed 1955-12-01"], "1955-12")).toBe(true);
  });
  it("re-exports the W0 helpers unchanged", () => {
    expect(dateAppearsIn(["March 1965"], "1965-03")).toBe(true);
    expect(findDates("December 1, 1955 and 1957")).toEqual(["1955-12-01", "1957"]);
    expect(monthIndexOf("Sept.")).toBe(9);
    expect(monthIndexOf("may")).toBe(5);
    expect(monthIndexOf("mayday")).toBe(0);
    expect(compareDates("1955-12", "1956")).toBe(-1);
    expect(compareDates("1956", "1956")).toBe(0);
    expect(compareDates("x", "1956")).toBe(1);
  });
});
