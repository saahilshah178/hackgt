import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { formula } from "../src/mechanics/families/tuner/formula";
import { predictReveal } from "../src/mechanics/families/truth_finder/predict_reveal";
import { cycle } from "../src/mechanics/families/sequencer/cycle";
import { rank } from "../src/mechanics/families/sequencer/rank";
import { plane } from "../src/mechanics/families/mapper/plane";

/*
 * A copy of the `audit()` helper from tests/strict-schemas.test.ts (importing that file directly would
 * re-run its own top-level describe blocks). Keep in sync if the strict-mode rules there change.
 */
const BANNED = ["oneOf", "allOf", "not", "const", "minLength", "maxLength", "pattern", "format", "patternProperties", "if"];
type Node = Record<string, unknown>;
function audit(schema: z.ZodType) {
  const json = zodSchema(schema).jsonSchema as Node;
  const errors: string[] = [];
  const stats = { properties: 0, enumValues: 0, maxDepth: 0 };
  const walk = (node: unknown, path: string, depth: number) => {
    if (typeof node !== "object" || node === null) return;
    const n = node as Node;
    for (const k of BANNED) if (k in n) errors.push(`${path}: uses "${k}"`);
    if (Array.isArray(n.enum)) stats.enumValues += n.enum.length;
    if (n.type === "integer" && (typeof n.minimum !== "number" || Math.abs(n.maximum as number) > 1e9)) {
      errors.push(`${path}: bound this integer explicitly`);
    }
    if (n.type === "object" || n.properties) {
      stats.maxDepth = Math.max(stats.maxDepth, depth);
      if (n.additionalProperties !== false) errors.push(`${path}: additionalProperties must be false (no z.record)`);
      const props = (n.properties ?? {}) as Record<string, unknown>;
      const required = new Set((n.required as string[]) ?? []);
      for (const [k, v] of Object.entries(props)) {
        stats.properties++;
        if (!required.has(k)) errors.push(`${path}.${k}: must be required (use .nullable(), not .optional())`);
        walk(v, `${path}.${k}`, depth + 1);
      }
    }
    if (n.items) walk(n.items, `${path}[]`, depth);
    if (Array.isArray(n.anyOf)) n.anyOf.forEach((s, i) => walk(s, `${path}<${i}>`, depth));
  };
  if (json.type !== "object") errors.push("root must be an object");
  walk(json, "$", 1);
  if (stats.properties > 5000) errors.push(`too many properties: ${stats.properties}`);
  if (stats.maxDepth > 10) errors.push(`nesting too deep: ${stats.maxDepth}`);
  if (stats.enumValues > 1000) errors.push(`too many enum values: ${stats.enumValues}`);
  return { errors, stats };
}

describe("tuner.formula", () => {
  const p = {
    expression: "F / m",
    outputName: "acceleration",
    outputUnit: "m/s^2",
    inputs: [
      { name: "F", unit: "N", min: 0, max: 100 },
      { name: "m", unit: "kg", min: 1, max: 20 },
    ],
    controlled: "F",
    fixed: [{ name: "m", value: "5" }],
    solution: "20",
  };

  it("valid params pass check (Newton's second law: F/m, m fixed, F controlled)", () => {
    expect(formula.check(p)).toEqual([]);
  });

  it("rejects a symbol not in inputs, an out-of-range solution, and a non-monotonic expression", () => {
    expect(formula.check({ ...p, expression: "F / q" }).join(" ")).toMatch(/references a symbol|expression/);
    expect(formula.check({ ...p, solution: "500" }).join(" ")).toMatch(/outside the controlled input's range/);
    // sin(F) over [0, 100] is not monotonic
    const nonMonotonic = { ...p, expression: "sin(F)", fixed: [], inputs: [{ name: "F", unit: "", min: 0, max: 100 }], solution: "10" };
    expect(formula.check(nonMonotonic).join(" ")).toMatch(/not monotonic/);
  });

  it("rejects both controlled and fixed on the same symbol, and a rounded-decimal solution", () => {
    expect(formula.check({ ...p, fixed: [{ name: "F", value: "5" }, { name: "m", value: "5" }] }).join(" ")).toMatch(
      /both controlled and fixed/,
    );
    expect(formula.check({ ...p, solution: "20.12345" }).join(" ")).toMatch(/rounded decimal/);
  });

  it("solutionInput passes grade", () => {
    const sol = formula.resolve(p);
    expect(sol.target).toBe(4);
    expect(formula.grade(p, formula.solutionInput(p, sol)).correct).toBe(true);
  });

  it("wrong inputs give informative directional feedback", () => {
    const high = formula.grade(p, { value: 90 });
    expect(high.correct).toBe(false);
    expect(high.feedback).toMatch(/too high/);

    const low = formula.grade(p, { value: 1 });
    expect(low.correct).toBe(false);
    expect(low.feedback).toMatch(/too low/);
  });

  it("present is deterministic and exposes the dial and fixed values", () => {
    const v1 = formula.present(p, 1);
    const v2 = formula.present(p, 1);
    expect(v1).toEqual(v2);
    expect(v1.dial.name).toBe("F");
    expect(v1.fixed).toEqual([{ name: "m", value: 5, unit: "kg" }]);
    expect(v1.target).toBe(4);
  });

  it("strict schemas", () => {
    expect(audit(formula.paramsSchema).errors).toEqual([]);
  });
});

describe("truth_finder.predict_reveal", () => {
  const p = {
    scenario: "A steel ball and a feather are dropped together in a vacuum chamber.",
    options: [
      { text: "They land at the same instant", isCorrect: true, explanation: "No air resistance: gravity accelerates every mass equally." },
      { text: "The steel ball lands first", isCorrect: false, explanation: "Weight doesn't change gravitational acceleration." },
      { text: "The feather lands first", isCorrect: false, explanation: "Lighter objects fall exactly as fast in a vacuum." },
    ],
    reveal: "They hit the floor at the same instant.",
    revealSource: "computed" as const,
  };

  it("valid params pass check", () => {
    expect(predictReveal.check(p)).toEqual([]);
  });

  it("rejects zero correct options, two correct options, and duplicate option text", () => {
    expect(predictReveal.check({ ...p, options: p.options.map((o) => ({ ...o, isCorrect: false })) }).join(" ")).toMatch(
      /exactly one option/,
    );
    expect(
      predictReveal.check({ ...p, options: p.options.map((o, i) => ({ ...o, isCorrect: i < 2 })) }).join(" "),
    ).toMatch(/exactly one option/);
    expect(
      predictReveal.check({ ...p, options: [p.options[0], p.options[0], p.options[2]] }).join(" "),
    ).toMatch(/distinct/);
  });

  it("solutionInput passes grade", () => {
    const sol = predictReveal.resolve(p);
    expect(sol.correctIndex).toBe(0);
    expect(predictReveal.grade(p, predictReveal.solutionInput(p, sol)).correct).toBe(true);
  });

  it("wrong inputs give informative feedback with the reveal and explanation", () => {
    const miss = predictReveal.grade(p, { optionIndex: 1 });
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/Weight doesn't change/);
  });

  it("present is deterministic and options are shuffled", () => {
    const v1 = predictReveal.present(p, 3);
    const v2 = predictReveal.present(p, 3);
    expect(v1).toEqual(v2);
    expect(v1.options.map((o) => o.optionIndex)).not.toEqual([0, 1, 2]);
  });

  it("blind solver round-trips through describe/toInput", () => {
    const view = predictReveal.present(p, 7);
    const pos = view.options.findIndex((o) => o.optionIndex === 0);
    const input = predictReveal.blind!.toInput(p, view, { option: pos, why: "" });
    expect(predictReveal.blind!.describe(p, view)).toContain("Options:");
    expect(predictReveal.grade(p, input).correct).toBe(true);
  });

  it("strict schemas", () => {
    expect(audit(predictReveal.paramsSchema).errors).toEqual([]);
    expect(audit(predictReveal.blind!.schema).errors).toEqual([]);
  });
});

describe("sequencer.cycle", () => {
  const p = {
    stages: [
      "Days lengthen toward the summer peak",
      "Peak daylight passes and cooling begins",
      "Days shorten toward the winter low",
      "The low passes and daylight lengthens again",
    ],
    decoys: ["The cycle stops permanently"],
  };

  it("valid params pass check", () => {
    expect(cycle.check(p)).toEqual([]);
  });

  it("rejects duplicate stages, a duplicate decoy, and an item that's too long", () => {
    expect(cycle.check({ ...p, stages: [p.stages[0], p.stages[0], p.stages[2], p.stages[3]] }).join(" ")).toMatch(/distinct/);
    expect(cycle.check({ ...p, decoys: [p.stages[0]] }).join(" ")).toMatch(/distinct/);
    expect(cycle.check({ ...p, decoys: ["x".repeat(200)] }).join(" ")).toMatch(/chars/);
  });

  it("solutionInput passes grade", () => {
    const sol = cycle.resolve(p);
    expect(cycle.grade(p, cycle.solutionInput(p, sol)).correct).toBe(true);
  });

  it("any rotation of the correct cycle also passes (rotation-invariant grading)", () => {
    const sol = cycle.resolve(p);
    const rotated = { keys: [...sol.order.slice(1), sol.order[0]] };
    expect(cycle.grade(p, rotated).correct).toBe(true);
  });

  it("the reverse direction and a decoy both fail with informative feedback", () => {
    const sol = cycle.resolve(p);
    const reversed = { keys: [...sol.order].reverse() };
    const revResult = cycle.grade(p, reversed);
    expect(revResult.correct).toBe(false);

    const withDecoy = { keys: [sol.order[0], "d0", sol.order[1], sol.order[2]] };
    const decoyResult = cycle.grade(p, withDecoy);
    expect(decoyResult.correct).toBe(false);
    expect(decoyResult.feedback).toMatch(/isn't part of this cycle/);
  });

  it("present is deterministic and shuffled, circular flag set", () => {
    const v1 = cycle.present(p, 5);
    const v2 = cycle.present(p, 5);
    expect(v1).toEqual(v2);
    expect(v1.circular).toBe(true);
    expect(v1.planks.map((pl) => pl.key)).not.toEqual(["s0", "s1", "s2", "s3", "d0"]);
  });

  it("blind solver round-trips through describe/toInput", () => {
    const view = cycle.present(p, 2);
    const posOf = (key: string) => view.planks.findIndex((pl) => pl.key === key);
    const sol = cycle.resolve(p);
    const out = { order: sol.order.map((k) => posOf(k)) };
    const input = cycle.blind!.toInput(p, view, out);
    expect(cycle.blind!.describe(p, view)).toContain("stages in a cycle");
    expect(cycle.grade(p, input).correct).toBe(true);
  });

  it("strict schemas", () => {
    expect(audit(cycle.paramsSchema).errors).toEqual([]);
    expect(audit(cycle.blind!.schema).errors).toEqual([]);
  });
});

describe("sequencer.rank", () => {
  const p = {
    property: "atomic radius",
    direction: "descending" as const,
    items: [
      { text: "Potassium (K)", value: "227", label: "227 pm" },
      { text: "Sodium (Na)", value: "186", label: "186 pm" },
      { text: "Chlorine (Cl)", value: "99", label: "99 pm" },
      { text: "Fluorine (F)", value: "42", label: "42 pm" },
    ],
  };

  it("valid params pass check", () => {
    expect(rank.check(p)).toEqual([]);
  });

  it("rejects tied values, a non-numeric value, and duplicate texts", () => {
    expect(rank.check({ ...p, items: [{ ...p.items[0], value: "186" }, ...p.items.slice(1)] }).join(" ")).toMatch(/distinct/);
    expect(rank.check({ ...p, items: [{ ...p.items[0], value: "not-a-number" }, ...p.items.slice(1)] }).join(" ")).toMatch(
      /must evaluate to a number/,
    );
    expect(rank.check({ ...p, items: [p.items[0], p.items[0], p.items[2], p.items[3]] }).join(" ")).toMatch(/distinct/);
  });

  it("solutionInput passes grade", () => {
    const sol = rank.resolve(p);
    expect(sol.order).toEqual(["i0", "i1", "i2", "i3"]);
    expect(rank.grade(p, rank.solutionInput(p, sol)).correct).toBe(true);
  });

  it("wrong inputs give informative feedback naming the out-of-place slot; success reveals labels", () => {
    const sol = rank.resolve(p);
    const swapped = { keys: [sol.order[1], sol.order[0], sol.order[2], sol.order[3]] };
    const miss = rank.grade(p, swapped);
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/Slot 1/);

    const hit = rank.grade(p, rank.solutionInput(p, sol));
    expect(hit.feedback).toMatch(/227 pm/);
  });

  it("present is deterministic and shuffled; values hidden", () => {
    const v1 = rank.present(p, 4);
    const v2 = rank.present(p, 4);
    expect(v1).toEqual(v2);
    expect(v1.planks.map((pl) => pl.key)).not.toEqual(["i0", "i1", "i2", "i3"]);
    expect(JSON.stringify(v1)).not.toMatch(/227/);
  });

  it("blind solver round-trips through describe/toInput", () => {
    const view = rank.present(p, 6);
    const posOf = (key: string) => view.planks.findIndex((pl) => pl.key === key);
    const sol = rank.resolve(p);
    const out = { order: sol.order.map((k) => posOf(k)) };
    const input = rank.blind!.toInput(p, view, out);
    expect(rank.blind!.describe(p, view)).toContain("Rank by");
    expect(rank.grade(p, input).correct).toBe(true);
  });

  it("strict schemas", () => {
    expect(audit(rank.paramsSchema).errors).toEqual([]);
    expect(audit(rank.blind!.schema).errors).toEqual([]);
  });
});

describe("mapper.plane", () => {
  const p = {
    xMin: "-5",
    xMax: "5",
    yMin: "-5",
    yMax: "5",
    gridStep: "1",
    labels: "decimal" as const,
    targetX: "2",
    targetY: "3",
    xLabel: "x",
    yLabel: "y",
    overlay: "two straight laser paths crossing once",
  };

  it("valid params pass check", () => {
    expect(plane.check(p)).toEqual([]);
  });

  it("rejects a target outside bounds, a rounded-decimal target, and too coarse a gridStep", () => {
    expect(plane.check({ ...p, targetX: "50" }).join(" ")).toMatch(/targetX must lie strictly inside/);
    expect(plane.check({ ...p, targetX: "2.71828" }).join(" ")).toMatch(/rounded decimal/);
    expect(plane.check({ ...p, gridStep: "20" }).join(" ")).toMatch(/lines on the/);
  });

  it("solutionInput passes grade", () => {
    const sol = plane.resolve(p);
    expect(sol.x).toBe(2);
    expect(sol.y).toBe(3);
    expect(plane.grade(p, plane.solutionInput(p, sol)).correct).toBe(true);
  });

  it("wrong inputs name the off axis and direction", () => {
    const offX = plane.grade(p, { x: 4.9, y: 3 });
    expect(offX.correct).toBe(false);
    expect(offX.feedback).toMatch(/x/);

    const offY = plane.grade(p, { x: 2, y: -4.9 });
    expect(offY.correct).toBe(false);
    expect(offY.feedback).toMatch(/y/);
  });

  it("present is deterministic and exposes bounds/overlay", () => {
    const v1 = plane.present(p, 1);
    const v2 = plane.present(p, 1);
    expect(v1).toEqual(v2);
    expect(v1.overlay).toBe(p.overlay);
    expect(v1.xMin).toBe(-5);
    expect(v1.xMax).toBe(5);
  });

  it("strict schemas", () => {
    expect(audit(plane.paramsSchema).errors).toEqual([]);
  });
});
