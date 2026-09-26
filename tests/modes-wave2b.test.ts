import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { area } from "../src/mechanics/families/accumulator/area";
import { riemann } from "../src/mechanics/families/accumulator/riemann";
import type { SimulationSpecT } from "../src/mechanics/families/simulator/engine";
import { intervene } from "../src/mechanics/families/simulator/intervene";
import { predict } from "../src/mechanics/families/simulator/predict";
import { sample } from "../src/mechanics/families/simulator/sample";

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

// ---------------------------------------------------------------- fixtures

const logisticSystem: SimulationSpecT = {
  variables: [{ name: "population", initial: "10", unit: "", min: 0, max: 1000 }],
  rules: [{ target: "population", expr: "population + 0.3*population*(1 - population/100)" }],
  ticks: 30,
};

const predictParams = {
  system: logisticSystem,
  scenario: "A small population enters a habitat with plenty of food and space.",
  watch: "population",
  question: "What happens to the population over time?",
  options: [
    { text: "It grows and levels off near a stable carrying capacity", asserts: "increases" as const, explanation: "Logistic growth slows as resources become scarce, leveling off near the habitat's carrying capacity." },
    { text: "It stays exactly the same the whole time", asserts: "stays" as const, explanation: "With food and space available, the population grows; it doesn't sit still." },
  ],
  comparison: "increases" as const,
  threshold: "50",
};

const glucoseInsulinSystem: SimulationSpecT = {
  variables: [
    { name: "glucose", initial: "150", unit: "mg/dL", min: 0, max: 400 },
    { name: "insulin", initial: "0", unit: "units", min: 0, max: 200 },
  ],
  rules: [{ target: "glucose", expr: "glucose + 5 - 0.5*insulin" }],
  ticks: 20,
};

const intervieneParams = {
  system: glucoseInsulinSystem,
  control: { variable: "insulin", min: "0", max: "20", step: "1" },
  target: { variable: "glucose", low: "100", high: "180" },
  ticks: 20,
  budget: 2,
};

const coinSystem: SimulationSpecT = {
  variables: [{ name: "heads_count", initial: "0", unit: "", min: 0, max: 1 }],
  rules: [{ target: "heads_count", expr: "rand() < 0.5 ? 1 : 0" }],
  ticks: 2,
};

const sampleParams = {
  system: coinSystem,
  watch: "heads_count",
  trials: 500,
  statistic: "proportion_above" as const,
  threshold: "0.5",
  question: "What share of flips come up heads over many trials?",
  options: [
    { text: "About half of the flips come up heads", isCorrect: true, explanation: "A fair coin lands heads about 50% of the time in the long run." },
    { text: "Almost all flips come up heads", isCorrect: false, explanation: "A fair coin has no bias toward heads." },
  ],
  ranges: [
    { optionIndex: 0, low: "0.4", high: "0.6" },
    { optionIndex: 1, low: "0.9", high: null },
  ],
};

const riemannParams = {
  expr: "x^2",
  a: "0",
  b: "2",
  n: 8,
  method: "right" as const,
  ask: "estimate" as const,
};

const areaParams = {
  expr: "x^2",
  a: "0",
  target: "1",
  bMin: "1",
  bMax: "2",
};

// ---------------------------------------------------------------- simulator.predict

describe("simulator.predict", () => {
  it("valid params pass check", () => {
    expect(predict.check(predictParams)).toEqual([]);
  });

  it("rejects: unknown watch, no option asserting the outcome, comparison contradicting the simulation", () => {
    expect(predict.check({ ...predictParams, watch: "nope" }).join(" ")).toMatch(/watch/);
    const noMatch = {
      ...predictParams,
      options: predictParams.options.map((o) => (o.asserts === "increases" ? { ...o, asserts: "decreases" as const } : o)),
    };
    expect(predict.check(noMatch).join(" ")).toMatch(/exactly one option's asserts/);
    expect(predict.check({ ...predictParams, comparison: "decreases" as const }).join(" ")).toMatch(/comparison says "decreases"/);
  });

  it("rejects: flagged option doesn't match the simulated outcome (negative test, H3)", () => {
    // Both options assert something other than what the simulation actually does.
    const mismatched = {
      ...predictParams,
      options: [
        { text: "It shrinks to nothing", asserts: "decreases" as const, explanation: "wrong" },
        { text: "It stays flat", asserts: "stays" as const, explanation: "wrong" },
      ],
    };
    const problems = predict.check(mismatched);
    expect(problems.join(" ")).toMatch(/comparison says|asserts/);
  });

  it("rejects: duplicate asserts values", () => {
    const dup = {
      ...predictParams,
      options: predictParams.options.map((o) => ({ ...o, asserts: "increases" as const })),
    };
    expect(predict.check(dup).join(" ")).toMatch(/asserts must be distinct/);
  });

  it("resolve + solutionInput passes grade", () => {
    const sol = predict.resolve(predictParams);
    expect(predict.grade(predictParams, predict.solutionInput(predictParams, sol)).correct).toBe(true);
  });

  it("wrong pick explains the PICKED option without stating the true direction (H2)", () => {
    const sol = predict.resolve(predictParams);
    const wrongIndex = sol.correctIndex === 0 ? 1 : 0;
    const miss = predict.grade(predictParams, { optionIndex: wrongIndex });
    expect(miss.correct).toBe(false);
    // Feedback explains why the PICKED option is wrong (its own explanation text), not the picked option's display text.
    expect(miss.feedback).toContain(predictParams.options[wrongIndex].explanation);
    expect(miss.feedback).not.toContain(predictParams.options[wrongIndex].text);
    // Never states the true outcome ("increases") or the correct option's explanation on a miss.
    expect(miss.feedback).not.toMatch(/increases/);
    expect(miss.feedback).not.toContain(predictParams.options[sol.correctIndex].explanation);
  });

  it("present is deterministic for a seed and shuffles options", () => {
    const v1 = predict.present(predictParams, 7);
    const v2 = predict.present(predictParams, 7);
    expect(v1).toEqual(v2);
    expect(v1).not.toHaveProperty("trajectory");
  });

  it("blind round-trip", () => {
    const view = predict.present(predictParams, 3);
    const options = (view as { options: { optionIndex: number; text: string }[] }).options;
    const sol = predict.resolve(predictParams);
    const correctDisplayPos = options.findIndex((o) => o.optionIndex === sol.correctIndex);
    const input = predict.blind!.toInput(predictParams, view, { option: correctDisplayPos, why: "logistic growth levels off" });
    expect(predict.grade(predictParams, input).correct).toBe(true);
  });

  it("strict schemas", () => {
    expect(audit(predict.paramsSchema).errors).toEqual([]);
  });
});

// ---------------------------------------------------------------- simulator.intervene

describe("simulator.intervene", () => {
  it("valid params pass check", () => {
    expect(intervene.check(intervieneParams)).toEqual([]);
  });

  it("rejects: unknown control variable, mismatched ticks, and a do-nothing schedule that already succeeds", () => {
    expect(intervene.check({ ...intervieneParams, control: { ...intervieneParams.control, variable: "nope" } }).join(" ")).toMatch(/control.variable/);
    expect(intervene.check({ ...intervieneParams, ticks: 15 }).join(" ")).toMatch(/must equal system.ticks/);
    const trivial = {
      ...intervieneParams,
      target: { variable: "glucose", low: "0", high: "1000" },
    };
    expect(intervene.check(trivial).join(" ")).toMatch(/trivial/);
  });

  it("resolve finds a schedule; solutionInput passes grade", () => {
    const sol = intervene.resolve(intervieneParams);
    expect(sol.schedule.length).toBeLessThanOrEqual(intervieneParams.budget);
    expect(intervene.grade(intervieneParams, intervene.solutionInput(intervieneParams, sol)).correct).toBe(true);
  });

  it("wrong inputs (doing nothing, and too many changes) give informative feedback", () => {
    const doNothing = intervene.grade(intervieneParams, { schedule: [] });
    expect(doNothing.correct).toBe(false);
    expect(doNothing.feedback).toMatch(/above the safe band/);

    const tooMany = intervene.grade(intervieneParams, {
      schedule: [
        { tick: 0, value: 1 },
        { tick: 5, value: 2 },
        { tick: 10, value: 3 },
      ],
    });
    expect(tooMany.correct).toBe(false);
    expect(tooMany.feedback).toMatch(/budget/);
  });

  it("determinism: same seed produces the same trajectory via present()", () => {
    const v1 = intervene.present(intervieneParams, 0);
    const v2 = intervene.present(intervieneParams, 0);
    expect(v1).toEqual(v2);
  });

  it("strict schemas", () => {
    expect(audit(intervene.paramsSchema).errors).toEqual([]);
  });
});

// ---------------------------------------------------------------- simulator.sample

describe("simulator.sample", () => {
  it("valid params pass check", () => {
    expect(sample.check(sampleParams)).toEqual([]);
  });

  it("rejects: unknown watch, ranges/options count mismatch, wrong option marked correct", () => {
    expect(sample.check({ ...sampleParams, watch: "nope" }).join(" ")).toMatch(/watch/);
    expect(sample.check({ ...sampleParams, ranges: [sampleParams.ranges[0]] }).join(" ")).toMatch(/one entry per option/);
    const flipped = {
      ...sampleParams,
      options: [
        { ...sampleParams.options[0], isCorrect: false },
        { ...sampleParams.options[1], isCorrect: true },
      ],
    };
    expect(sample.check(flipped).join(" ")).toMatch(/isCorrect: true is on option/);
  });

  it("resolve + solutionInput passes grade", () => {
    const sol = sample.resolve(sampleParams);
    expect(sol.correctIndex).toBe(0);
    expect(sample.grade(sampleParams, sample.solutionInput(sampleParams, sol)).correct).toBe(true);
  });

  it("wrong pick gives informative feedback with the statistic, not the option text", () => {
    const miss = sample.grade(sampleParams, { optionIndex: 1 });
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/trials/);
    expect(miss.feedback).not.toContain(sampleParams.options[0].text);
  });

  it("strict schemas", () => {
    expect(audit(sample.paramsSchema).errors).toEqual([]);
  });
});

// ---------------------------------------------------------------- accumulator.riemann

describe("accumulator.riemann", () => {
  it("valid params (estimate and compare) pass check", () => {
    expect(riemann.check(riemannParams)).toEqual([]);
    expect(riemann.check({ ...riemannParams, ask: "compare" as const })).toEqual([]);
  });

  it("rejects: rounded decimal, a<b violated, and ask=compare on a non-monotonic f", () => {
    expect(riemann.check({ ...riemannParams, a: "0.123456" }).join(" ")).toMatch(/rounded decimal/);
    expect(riemann.check({ ...riemannParams, a: "2", b: "0" }).join(" ")).toMatch(/less than b/);
    expect(riemann.check({ ...riemannParams, expr: "x^3 - 3*x", a: "-2", b: "2", ask: "compare" as const }).join(" ")).toMatch(/monotonic/);
  });

  it("solutionInput passes grade for both ask modes", () => {
    const sol = riemann.resolve(riemannParams);
    expect(riemann.grade(riemannParams, riemann.solutionInput(riemannParams, sol)).correct).toBe(true);
    const cmp = { ...riemannParams, ask: "compare" as const };
    const solCmp = riemann.resolve(cmp);
    expect(riemann.grade(cmp, riemann.solutionInput(cmp, solCmp)).correct).toBe(true);
  });

  it("wrong inputs give informative feedback naming the shading, not the raw sum", () => {
    const sol = riemann.resolve(riemannParams);
    const missEstimate = riemann.grade(riemannParams, { value: sol.sum + 100 });
    expect(missEstimate.correct).toBe(false);
    expect(missEstimate.feedback).toMatch(/rectangle/);

    const cmp = { ...riemannParams, ask: "compare" as const };
    const solCmp = riemann.resolve(cmp);
    const wrongRelation = solCmp.overUnder === "over" ? "under" : "over";
    const missCompare = riemann.grade(cmp, { relation: wrongRelation });
    expect(missCompare.correct).toBe(false);
    expect(missCompare.feedback).not.toMatch(new RegExp(solCmp.overUnder));
  });

  it("present is deterministic and returns rectangles plus curve samples", () => {
    const v1 = riemann.present(riemannParams, 0) as unknown as { rectangles: unknown[]; samples: unknown[] };
    const v2 = riemann.present(riemannParams, 0);
    expect(v1).toEqual(v2);
    expect(v1.rectangles).toHaveLength(riemannParams.n);
    expect(v1.samples.length).toBeGreaterThan(0);
  });

  it("strict schemas", () => {
    expect(audit(riemann.paramsSchema).errors).toEqual([]);
  });
});

// ---------------------------------------------------------------- accumulator.area

describe("accumulator.area", () => {
  it("valid params pass check", () => {
    expect(area.check(areaParams)).toEqual([]);
  });

  it("rejects: negative f on range, unreachable target, bMin >= bMax", () => {
    expect(area.check({ ...areaParams, expr: "x^2 - 3", a: "0", bMin: "1", bMax: "2" }).join(" ")).toMatch(/negative/);
    expect(area.check({ ...areaParams, target: "100" }).join(" ")).toMatch(/not strictly between/);
    expect(area.check({ ...areaParams, bMin: "2", bMax: "1" }).join(" ")).toMatch(/bMin must be less than bMax/);
  });

  it("resolve + solutionInput passes grade", () => {
    const sol = area.resolve(areaParams);
    expect(sol.b).toBeGreaterThan(1);
    expect(sol.b).toBeLessThan(2);
    expect(area.grade(areaParams, area.solutionInput(areaParams, sol)).correct).toBe(true);
  });

  it("wrong inputs report overflow/undershoot as a percentage of the target", () => {
    const sol = area.resolve(areaParams);
    const under = area.grade(areaParams, { value: areaParams.bMin ? 1.01 : sol.b });
    expect(under.correct).toBe(false);
    expect(under.feedback).toMatch(/undershot/);
    const over = area.grade(areaParams, { value: 1.99 });
    expect(over.correct).toBe(false);
    expect(over.feedback).toMatch(/overflowed/);
  });

  it("present is deterministic and returns curve samples", () => {
    const v1 = area.present(areaParams, 0) as unknown as { samples: unknown[] };
    const v2 = area.present(areaParams, 0);
    expect(v1).toEqual(v2);
    expect(v1.samples.length).toBeGreaterThan(0);
  });

  it("strict schemas", () => {
    expect(audit(area.paramsSchema).errors).toEqual([]);
  });
});
