import { describe, expect, it } from "vitest";
import { numberLine } from "../src/mechanics/families/mapper/number_line";
import { linear } from "../src/mechanics/families/sequencer/linear";
import { mimic } from "../src/mechanics/families/truth_finder/mimic";
import { oscillator } from "../src/mechanics/families/tuner/oscillator";
import { implementedModes } from "../src/mechanics/registry";

describe("tuner.oscillator", () => {
  const base = { wave: "sin" as const, amplitude: 2, b: "pi/2", c: "pi/4", d: 1 };

  it("answers every ask from the same equation", () => {
    const s = (ask: "period" | "frequency" | "amplitude" | "phase" | "midline") => oscillator.resolve({ ...base, ask });
    expect(s("period").answer).toBeCloseTo(4, 9);
    expect(s("frequency").answer).toBeCloseTo(0.25, 9);
    expect(s("amplitude").answer).toBe(2);
    expect(s("phase").answer).toBeCloseTo(-0.5, 9); // −c/b = −(π/4)/(π/2)
    expect(s("midline").answer).toBe(1);
    expect(oscillator.templateVars({ ...base, ask: "period" }, s("period")).equation).toBe("y = 2sin((π/2)t + π/4) + 1");
  });

  it("the solution passes the grader, a wrong value gets directional feedback, and the answer var follows ask", () => {
    for (const ask of ["period", "frequency", "amplitude", "phase", "midline"] as const) {
      const p = { ...base, ask };
      expect(oscillator.check(p)).toEqual([]);
      const sol = oscillator.resolve(p);
      expect(oscillator.grade(p, oscillator.solutionInput(p, sol)).correct).toBe(true);
      const miss = oscillator.grade(p, { value: sol.answer + 3 });
      expect(miss.correct).toBe(false);
      expect(miss.feedback).toMatch(/too/);
      expect((oscillator.answerVars as (p: unknown) => string[])(p)).toEqual([ask, "answer"]);
    }
  });

  it("rejects rounded decimals, trivial asks, and out-of-range periods", () => {
    expect(oscillator.check({ ...base, b: "1.5708", ask: "period" }).join(" ")).toMatch(/rounded decimal/);
    expect(oscillator.check({ ...base, c: "0", ask: "phase" }).join(" ")).toMatch(/trivial/);
    expect(oscillator.check({ ...base, d: 0, ask: "midline" }).join(" ")).toMatch(/trivial/);
    expect(oscillator.check({ ...base, b: "100", ask: "period" }).join(" ")).toMatch(/outside the dial range/);
    expect(oscillator.check({ ...base, b: "0", ask: "period" }).join(" ")).toMatch(/nonzero/);
  });
});

describe("mapper.number_line", () => {
  it("log scale: places powers of ten and grades in log space", () => {
    const p = { scale: "log" as const, min: "10^-3", max: "10^6", target: "10^3.5", landmarkStep: "3", labels: "power" as const };
    expect(numberLine.check(p)).toEqual([]);
    const view = numberLine.present(p, 1);
    expect(view.landmarks.map((l) => l.label)).toEqual(["10^-3", "10^0", "10^3", "10^6"]);
    const sol = numberLine.resolve(p);
    expect(sol.between).toBe("10^3 and 10^6");
    expect(numberLine.grade(p, numberLine.solutionInput(p, sol)).correct).toBe(true);
    expect(numberLine.grade(p, { value: 10 ** 5 }).feedback).toMatch(/past/);
  });

  it("linear scale: rejects a target on a landmark and a rounded decimal", () => {
    expect(numberLine.check({ scale: "linear", min: "0", max: "2*pi", target: "pi", landmarkStep: "pi/2", labels: "pi" }).join(" ")).toMatch(/landmark/);
    expect(numberLine.check({ scale: "linear", min: "0", max: "6.2832", target: "1", landmarkStep: "1", labels: "decimal" }).join(" ")).toMatch(/rounded/);
    expect(numberLine.check({ scale: "log", min: "0", max: "100", target: "5", landmarkStep: "1", labels: "power" }).join(" ")).toMatch(/positive/);
  });
});

describe("truth_finder.mimic blind solver", () => {
  const p = {
    statements: [
      { text: "Water boils at 100 °C at sea level", isTrue: true, explanation: "Standard pressure." },
      { text: "Water always boils at 100 °C", isTrue: false, explanation: "Boiling point drops with pressure." },
      { text: "Water boils at a lower temperature on a mountain", isTrue: true, explanation: "Lower pressure." },
    ],
  };
  it("maps a display position back onto the statement index", () => {
    const view = mimic.present(p, 7);
    const pos = view.chests.findIndex((c) => c.statementIndex === 1);
    expect(mimic.blind!.describe(p, view)).toContain("0. ");
    expect(mimic.blind!.toInput(p, view, { chest: pos, why: "" })).toEqual({ statementIndex: 1 });
    expect(mimic.grade(p, mimic.blind!.toInput(p, view, { chest: pos, why: "" })).correct).toBe(true);
  });
});

describe("sequencer.linear blind solver", () => {
  const p = { steps: ["a", "b", "c"], decoys: ["x"] };
  it("maps display positions back onto keys and rejects decoys", () => {
    const view = linear.present(p, 3);
    const posOf = (text: string) => view.planks.findIndex((pl) => pl.text === text);
    const input = linear.blind!.toInput(p, view, { order: ["a", "b", "c"].map(posOf) });
    expect(linear.grade(p, input).correct).toBe(true);
    expect(linear.grade(p, linear.blind!.toInput(p, view, { order: ["a", "x", "c"].map(posOf) })).feedback).toMatch(/isn't part/);
  });
});

describe("every implemented mode", () => {
  it("has a blurb, an authoring guide, and a widget", () => {
    for (const { mode, key } of implementedModes()) {
      expect(mode.directorBlurb.length, key).toBeGreaterThan(20);
      expect(mode.authoringGuide.length, key).toBeGreaterThan(20);
      expect(mode.widget, key).toBeTruthy();
      if (mode.blindSolvable) expect(mode.blind, key).toBeDefined();
    }
  });
});
