import { describe, expect, it } from "vitest";
import { ProbeFormat, ProbeSpec } from "../contracts/world";
import { fracYearOf } from "./contraptions/config-parts";
import {
  MINUS,
  chipY,
  dateOfFracYear,
  fmtNumber,
  formatChip,
  formatMonthYear,
  formatPi,
  formatProbe,
  formatTick,
  fracYear,
  labelOnly,
  majorStep,
  nearestTick,
  niceTicks,
  parseDisplayNumber,
  pathOf,
  piFraction,
  project,
  sample,
  snapToStep,
  unprojectX,
  type PlotBox,
} from "./graph-math";

const PI = Math.PI;

describe("π formatting and ticks", () => {
  it("formats multiples and fractions of π", () => {
    expect(formatPi(0)).toBe("0");
    expect(formatPi(PI)).toBe("π");
    expect(formatPi(2 * PI)).toBe("2π");
    expect(formatPi(-PI)).toBe(`${MINUS}π`);
    expect(formatPi(-2 * PI)).toBe(`${MINUS}2π`);
    expect(formatPi(PI / 2)).toBe("π/2");
    expect(formatPi((3 * PI) / 4)).toBe("3π/4");
    expect(formatPi((5 * PI) / 6)).toBe("5π/6");
    expect(formatPi(-PI / 12)).toBe(`${MINUS}π/12`);
    expect(formatPi(0.83 * PI)).toBe("0.83π");
    expect(piFraction(1)).toBeNull();
    expect(piFraction((4 * PI) / 6)).toEqual({ num: 2, den: 3 });
  });

  it("π axes put majors on multiples of π with unlabelled half-step minors (the 5.png card: −2π … 2π)", () => {
    const t = niceTicks(-2 * PI, 2 * PI, "pi", 5);
    const majors = t.filter((x) => x.major);
    expect(majors.map((x) => x.label)).toEqual([`${MINUS}2π`, `${MINUS}π`, "0", "π", "2π"]);
    const minors = t.filter((x) => !x.major);
    expect(minors.length).toBe(4);
    expect(minors.every((x) => x.label === null)).toBe(true);
    expect(minors.map((x) => formatPi(x.v))).toEqual([`${MINUS}3π/2`, `${MINUS}π/2`, "π/2", "3π/2"]);
  });

  it("a 0…2π dial gets π/2 or π/4 majors and never more than the cap", () => {
    for (const cap of [4, 5, 8, 9]) {
      const majors = niceTicks(0, 2 * PI, "pi", cap).filter((x) => x.major);
      expect(majors.length).toBeLessThanOrEqual(cap + 1);
      expect(majors[0].label).toBe("0");
      expect(majors[majors.length - 1].label).toBe("2π");
    }
    expect(majorStep(0, 2 * PI, "pi", 4)).toBeCloseTo(PI / 2);
    expect(majorStep(0, 2 * PI, "pi", 8)).toBeCloseTo(PI / 4);
  });

  it("numeric axes use 1-2-5 majors with half minors (0 … 10 labels every integer when allowed)", () => {
    const t = niceTicks(0, 10, "number", 10);
    const majors = t.filter((x) => x.major);
    expect(majors.map((x) => x.label)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(t.filter((x) => !x.major).length).toBe(10);
    const neg = niceTicks(-4, 4, "number", 4).filter((x) => x.major).map((x) => x.label);
    expect(neg).toEqual([`${MINUS}4`, `${MINUS}2`, "0", "2", "4"]);
  });

  it("year and month axes label years; month axes add monthly minors", () => {
    const years = niceTicks(1950, 1960, "year", 5).filter((x) => x.major).map((x) => x.label);
    expect(years).toEqual(["1950", "1952", "1954", "1956", "1958", "1960"]);
    const months = niceTicks(1964.5, 1965.75, "month", 8);
    expect(months.some((x) => x.label === "1965")).toBe(true);
    expect(months.filter((x) => x.major).every((x) => x.label !== null)).toBe(true);
    expect(formatTick(1965 + 2 / 12, "month")).toBe("MAR 1965");
  });

  it("formatTick covers every unit", () => {
    expect(formatTick(1957, "year")).toBe("1957");
    expect(formatTick(40, "percent")).toBe("40 %");
    expect(formatTick(-2, "number")).toBe(`${MINUS}2`);
    expect(formatTick(2.4, "nm")).toBe("2.4 nm");
    expect(formatTick(4, "mM")).toBe("4 mM");
    expect(formatTick(3, "seconds")).toBe("3 s");
    expect(formatTick(3.2, "count")).toBe("3");
    expect(formatTick(2, "stage")).toBe("2");
    expect(formatTick(0.1 + 0.2, "rate")).toBe("0.3");
  });

  it("labelOnly keeps the chosen labels (a card's x axis shows only its far end)", () => {
    const t = labelOnly(niceTicks(0, 10, "number", 10), (tick, _i, all) => tick.v === all[all.length - 1].v);
    expect(t.filter((x) => x.label !== null).map((x) => x.label)).toEqual(["10"]);
  });
});

describe("formatProbe for every ProbeFormat", () => {
  const base = ProbeSpec.parse({ symbol: "x", label: "probe", min: 0, max: 10, step: 0.1 });
  const cases: Record<ProbeFormat, [number, Partial<ProbeSpec>, string]> = {
    number: [2.4, { unit: "nm" }, "2.4 nm"],
    pi: [0.83 * PI, {}, "0.83π"],
    integer: [3.6, { unit: "ATP" }, "4 ATP"],
    stage: [3, { stops: [{ v: 3, label: "flip out" }, { v: 4, label: "swap" }] }, "stage 3 · flip out"],
    percent: [40, {}, "40 %"],
    year: [1957.9, {}, "1957"],
    month_year: [1965 + 2 / 12, {}, "MAR 1965"],
  };
  for (const f of ProbeFormat.options) {
    it(f, () => {
      const [v, patch, want] = cases[f];
      expect(formatProbe(v, { ...base, ...patch, format: f })).toBe(want);
    });
  }
  it("number shows two decimals for fine steps, a minus sign, and — for non-finite", () => {
    expect(formatProbe(-0.25, { ...base, step: 0.05, format: "number", unit: "" })).toBe(`${MINUS}0.25`);
    expect(formatProbe(Number.NaN, { ...base, format: "number" })).toBe("—");
    expect(formatProbe(2.5, { ...base, format: "stage", stops: [] })).toBe("stage 3");
    expect(formatProbe(12.5, { ...base, format: "percent" })).toBe("12.5 %");
  });
});

describe("chips", () => {
  it("formatChip uses the card's unit", () => {
    expect(formatChip(0.83 * PI, "pi")).toBe("0.83π");
    expect(formatChip(PI / 2, "pi")).toBe("π/2");
    expect(formatChip(-2.44, "number")).toBe(`${MINUS}2.4`);
    expect(formatChip(1957, "year")).toBe("1957");
    expect(formatChip(40.2, "percent")).toBe("40 %");
  });

  it("chipY sits at y(value) and clamps the whole chip onto the card", () => {
    const y = { min: -4, max: 4 };
    expect(chipY(0, y, 200, 40)).toBe(100);
    expect(chipY(4, y, 200, 40)).toBe(20); // top clamp: half the chip height
    expect(chipY(99, y, 200, 40)).toBe(20);
    expect(chipY(-99, y, 200, 40)).toBe(180);
    expect(chipY(2, y, 200, 40)).toBe(50);
    expect(chipY(Number.NaN, y, 200, 40)).toBe(100);
    expect(chipY(3.9, y, 200, 40, 6)).toBe(26);
  });

  it("fmtNumber and parseDisplayNumber round-trip", () => {
    for (const v of [-2.4, 0, 3.1, 12.5]) expect(parseDisplayNumber(fmtNumber(v, 1))).toBeCloseTo(v, 6);
    expect(fmtNumber(-0.00001, 1)).toBe("0.0");
  });
});

describe("sampling splits", () => {
  it("a smooth sine stays one segment", () => {
    const segs = sample(Math.sin, 0, 2 * PI, 100);
    expect(segs.length).toBe(1);
    expect(segs[0].length).toBe(101);
  });

  it("splits at NaN and ±∞", () => {
    const segs = sample((x) => (x > 4 && x < 6 ? Number.NaN : x), 0, 10, 10);
    expect(segs.length).toBe(2);
    const inf = sample((x) => (x === 5 ? Number.POSITIVE_INFINITY : 1), 0, 10, 10);
    expect(inf.length).toBe(2);
    const throws = sample((x) => {
      if (x === 5) throw new Error("pole");
      return x;
    }, 0, 10, 10);
    expect(throws.length).toBe(2);
  });

  it("splits at jumps larger than 25 % of the y-range (steps, tan poles), not at steep smooth parts", () => {
    const step = sample((x) => (x < 5 ? 0 : 4), 0, 10, 100);
    expect(step.length).toBe(2);
    const tan = sample(Math.tan, 0, 2 * PI, 400);
    expect(tan.length).toBeGreaterThanOrEqual(3);
    const steep = sample((x) => 3 * Math.sin(4 * x), 0, 2 * PI, 400);
    expect(steep.length).toBe(1);
  });

  it("drops single-point segments", () => {
    const segs = sample((x) => (Math.round(x) % 2 === 0 ? Number.NaN : 1), 0, 4, 4);
    expect(segs.every((s) => s.length >= 2)).toBe(true);
  });
});

describe("projection", () => {
  const box: PlotBox = { xMin: 0, xMax: 10, yMin: -2, yMax: 2, left: 40, top: 10, width: 500, height: 200 };
  it("maps data to px with y up", () => {
    expect(project(0, 2, box)).toEqual({ px: 40, py: 10 });
    expect(project(10, -2, box)).toEqual({ px: 540, py: 210 });
    expect(project(5, 0, box)).toEqual({ px: 290, py: 110 });
    expect(unprojectX(290, box)).toBe(5);
    expect(unprojectX(-100, box)).toBe(0);
    expect(unprojectX(9999, box)).toBe(10);
  });
  it("pathOf draws one M per segment", () => {
    const d = pathOf([[[0, 0], [10, 0]], [[0, 1], [5, 1]]], box);
    expect(d.match(/M/g)?.length).toBe(2);
    expect(d.startsWith("M40.0 110.0 L540.0 110.0")).toBe(true);
  });
  it("snapToStep and nearestTick", () => {
    expect(snapToStep(0.34, 0, 1, 0.1)).toBe(0.3);
    expect(snapToStep(1.26, 0, 1, 0.1)).toBe(1);
    expect(snapToStep(PI / 12 + 0.01, 0, 2 * PI, PI / 12)).toBeCloseTo(PI / 12, 9);
    const t = niceTicks(0, 10, "number", 5);
    expect(nearestTick(4.8, t)).toBe(5); // majors every 2, minors every 1
    expect(nearestTick(4.8, t, true)).toBe(4);
  });
});

describe("fracYear", () => {
  it("equals config-parts' fracYearOf", () => {
    for (const d of ["1954", "1955-12", "1965-03-07", "1963-08-28"]) expect(fracYear(d)).toBe(fracYearOf(d));
    expect(fracYear("not a date")).toBeNull();
  });
  it("round-trips at year, month and day precision", () => {
    for (const d of ["1896", "1954", "2025"]) expect(dateOfFracYear(fracYear(d)!, "year")).toBe(d);
    for (let m = 1; m <= 12; m++) {
      const d = `1965-${String(m).padStart(2, "0")}`;
      expect(dateOfFracYear(fracYear(d)!, "month")).toBe(d);
    }
    for (const d of ["1955-12-01", "1963-08-28", "1965-03-07", "1960-02-01", "1964-07-02", "1965-12-31", "1957-01-31"]) {
      expect(dateOfFracYear(fracYear(d)!, "day")).toBe(d);
    }
    expect(formatMonthYear(fracYear("1965-03")!)).toBe("MAR 1965");
  });
});
