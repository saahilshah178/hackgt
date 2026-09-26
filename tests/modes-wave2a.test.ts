import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { chem_equation } from "../src/mechanics/families/balance/chem_equation";
import { equation } from "../src/mechanics/families/balance/equation";
import { ledger } from "../src/mechanics/families/balance/ledger";
import { slope } from "../src/mechanics/families/function_world/slope";

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

describe("function_world.slope", () => {
  const bump = {
    pieces: [{ expr: "exp(-x^2)", from: "-inf", to: "inf", openLeft: false, openRight: false }],
    xMin: "0",
    xMax: "3",
  };
  const cubic = {
    pieces: [{ expr: "x^3 - 3*x", from: "-inf", to: "inf", openLeft: false, openRight: false }],
    xMin: "-3",
    xMax: "3",
  };

  it("valid params pass check (steepest, critical_points, sign_at, concavity_at, inflection_points)", () => {
    expect(slope.check({ ...bump, ask: "steepest", a: null })).toEqual([]);
    expect(slope.check({ ...bump, ask: "inflection_points", a: null })).toEqual([]);
    expect(slope.check({ ...cubic, ask: "critical_points", a: null })).toEqual([]);
    expect(slope.check({ ...cubic, ask: "sign_at", a: "0" })).toEqual([]);
    expect(slope.check({ ...cubic, ask: "concavity_at", a: "1" })).toEqual([]);
  });

  it("rejects a rounded decimal, an ask that needs a but got null, and a domain with no critical point", () => {
    expect(slope.check({ ...cubic, xMin: "-3.14159", ask: "critical_points", a: null }).join(" ")).toMatch(/rounded decimal/);
    expect(slope.check({ ...cubic, ask: "sign_at", a: null }).join(" ")).toMatch(/needs a non-null "a"/);
    expect(
      slope.check({ pieces: [{ expr: "2*x + 1", from: "-inf", to: "inf", openLeft: false, openRight: false }], xMin: "-3", xMax: "3", ask: "critical_points", a: null }).join(" "),
    ).toMatch(/no critical points/);
  });

  it("rejects steepest at the domain edge (unbounded |f'|)", () => {
    // x^3 - 3x has |f'| growing without bound away from x=0, so the max on [-3,3] sits at the edges.
    expect(slope.check({ ...cubic, ask: "steepest", a: null }).join(" ")).toMatch(/edge of the domain/);
  });

  it("solutionInput passes grade for every ask", () => {
    for (const p of [
      { ...bump, ask: "steepest" as const, a: null },
      { ...bump, ask: "inflection_points" as const, a: null },
      { ...cubic, ask: "critical_points" as const, a: null },
      { ...cubic, ask: "sign_at" as const, a: "0" },
      { ...cubic, ask: "concavity_at" as const, a: "1" },
    ]) {
      const sol = slope.resolve(p);
      expect(slope.grade(p, slope.solutionInput(p, sol)).correct, JSON.stringify(p)).toBe(true);
    }
  });

  it("wrong inputs give informative feedback without stating the answer outright", () => {
    const pSign = { ...cubic, ask: "sign_at" as const, a: "0" };
    const solSign = slope.resolve(pSign);
    const wrongSignVal = solSign.sign === "negative" ? "positive" : "negative";
    const missSign = slope.grade(pSign, { sign: wrongSignVal });
    expect(missSign.correct).toBe(false);
    expect(missSign.feedback).toMatch(/Scan the tangent again/);
    expect(missSign.feedback).not.toContain(solSign.sign);

    const pCrit = { ...cubic, ask: "critical_points" as const, a: null };
    const extraMiss = slope.grade(pCrit, { xs: [0] });
    expect(extraMiss.correct).toBe(false);
    expect(extraMiss.feedback).toMatch(/isn't actually flat/);

    const solCrit = slope.resolve(pCrit);
    const partialMiss = slope.grade(pCrit, { xs: [solCrit.xs![0]] });
    expect(partialMiss.correct).toBe(false);
    expect(partialMiss.feedback).toMatch(/of \d+ zero-force zones/);
  });

  it("present is deterministic and never leaks the answer fields", () => {
    const p = { ...cubic, ask: "critical_points" as const, a: null };
    const v1 = slope.present(p, 5);
    const v2 = slope.present(p, 5);
    expect(v1).toEqual(v2);
    expect(v1).not.toHaveProperty("xs");
  });

  it("strict schemas", () => {
    expect(audit(slope.paramsSchema).errors).toEqual([]);
  });
});

describe("balance.equation", () => {
  const p = { left: "3*x + 5", right: "20" };

  it("valid params pass check", () => {
    expect(equation.check(p)).toEqual([]);
  });

  it("rejects a non-linear equation, a rounded decimal, and no-unique-solution", () => {
    expect(equation.check({ left: "x^2", right: "9" }).join(" ")).toMatch(/linear expression/);
    expect(equation.check({ left: "3.14159*x", right: "10" }).join(" ")).toMatch(/rounded decimal/);
    expect(equation.check({ left: "2*x + 5", right: "2*x + 9" }).join(" ")).toMatch(/no unique solution/);
  });

  it("solutionInput passes grade", () => {
    const sol = equation.resolve(p);
    expect(equation.grade(p, equation.solutionInput(p, sol)).correct).toBe(true);
  });

  it("accepts a non-canonical valid sequence (order and choice of operations don't matter)", () => {
    const alt = { ops: [{ op: "multiply" as const, value: "1" }, { op: "subtract" as const, value: "5" }, { op: "divide" as const, value: "3" }] };
    expect(equation.grade(p, alt).correct).toBe(true);
  });

  it("wrong inputs give informative feedback: unsolved, and divide by zero", () => {
    const partial = equation.grade(p, { ops: [{ op: "subtract" as const, value: "5" }] });
    expect(partial.correct).toBe(false);
    expect(partial.feedback).toMatch(/Not solved yet/);

    const divZero = equation.grade(p, { ops: [{ op: "divide" as const, value: "0" }] });
    expect(divZero.correct).toBe(false);
    expect(divZero.feedback).toMatch(/dividing by zero/);
  });

  it("solves an equation with x on both sides", () => {
    const p2 = { left: "2*x + 20", right: "3*x + 5" };
    expect(equation.check(p2)).toEqual([]);
    const sol2 = equation.resolve(p2);
    expect(sol2.x).toBe(15);
    expect(equation.grade(p2, equation.solutionInput(p2, sol2)).correct).toBe(true);
  });

  it("strict schemas", () => {
    expect(audit(equation.paramsSchema).errors).toEqual([]);
  });
});

describe("balance.chem_equation", () => {
  const propane = { reactants: ["C3H8", "O2"], products: ["CO2", "H2O"] };
  const iron = { reactants: ["Fe", "O2"], products: ["Fe2O3"] };

  it("valid params pass check", () => {
    expect(chem_equation.check(propane)).toEqual([]);
    expect(chem_equation.check(iron)).toEqual([]);
  });

  it("rejects an unparseable formula, an unbalanceable equation, and a trivial equation", () => {
    expect(chem_equation.check({ reactants: ["h2"], products: ["H2"] }).join(" ")).toMatch(/doesn't parse/);
    expect(chem_equation.check({ reactants: ["H2"], products: ["O2"] }).join(" ")).toMatch(/conserves every atom/);
    expect(chem_equation.check({ reactants: ["H2", "O2"], products: ["O2", "H2"] }).join(" ")).toMatch(/same set of species/);
  });

  it("balances C3H8 + O2 -> CO2 + H2O as 1, 5, 3, 4", () => {
    expect(chem_equation.resolve(propane).coefficients).toEqual([1, 5, 3, 4]);
  });

  it("balances Fe + O2 -> Fe2O3 as 4, 3, 2", () => {
    expect(chem_equation.resolve(iron).coefficients).toEqual([4, 3, 2]);
  });

  it("solutionInput passes grade", () => {
    const sol = chem_equation.resolve(propane);
    expect(chem_equation.grade(propane, chem_equation.solutionInput(propane, sol)).correct).toBe(true);
  });

  it("a multiple of the minimal solution balances every atom but isn't accepted", () => {
    const sol = chem_equation.resolve(propane);
    const doubled = chem_equation.grade(propane, { coefficients: sol.coefficients.map((c) => c * 2) });
    expect(doubled.correct).toBe(false);
    expect(doubled.feedback).toMatch(/smallest whole numbers/);
  });

  it("a wrong set names the first unbalanced element and the imbalance", () => {
    const miss = chem_equation.grade(propane, { coefficients: [1, 5, 3, 5] });
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/H isn't balanced/);
  });

  it("strict schemas", () => {
    expect(audit(chem_equation.paramsSchema).errors).toEqual([]);
  });
});

describe("balance.ledger", () => {
  const p = {
    nodes: [
      { id: "a", label: "Junction A" },
      { id: "b", label: "Junction B" },
    ],
    flows: [
      { from: null, to: "a", label: "Source into A", value: "10" },
      { from: "a", to: "b", label: "A to B", value: null },
      { from: "b", to: null, label: "B to outside", value: null },
    ],
  };

  it("valid params pass check", () => {
    expect(ledger.check(p)).toEqual([]);
  });

  it("rejects zero blanks, too many blanks, and an underdetermined system", () => {
    expect(ledger.check({ ...p, flows: p.flows.map((f) => ({ ...f, value: f.value ?? "1" })) }).join(" ")).toMatch(/at least one flow must be a blank/);
    expect(
      ledger
        .check({ ...p, flows: [...p.flows, { from: "a", to: null, label: "x", value: null }, { from: null, to: "b", label: "y", value: null }, { from: "b", to: "a", label: "z", value: null }] })
        .join(" "),
    ).toMatch(/at most 4/);
    expect(
      ledger
        .check({
          nodes: p.nodes,
          flows: [
            { from: null, to: "a", label: "in", value: null },
            { from: "a", to: "b", label: "mid", value: null },
            { from: "b", to: null, label: "out", value: null },
          ],
        })
        .join(" "),
    ).toMatch(/don't pin down a unique/);
  });

  it("solutionInput passes grade", () => {
    const sol = ledger.resolve(p);
    expect(ledger.grade(p, ledger.solutionInput(p, sol)).correct).toBe(true);
  });

  it("wrong inputs name the unbalanced node and the imbalance", () => {
    const miss = ledger.grade(p, { values: [{ flowKey: "f1", value: 5 }, { flowKey: "f2", value: 10 }] });
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/Junction A/);
    expect(miss.feedback).toMatch(/differ by 5/);

    const incomplete = ledger.grade(p, { values: [{ flowKey: "f1", value: 10 }] });
    expect(incomplete.correct).toBe(false);
    expect(incomplete.feedback).toMatch(/Fill in every blank/);
  });

  it("blind solver round-trips through describe/toInput", () => {
    const view = ledger.present(p, 2);
    const sol = ledger.resolve(p);
    expect(ledger.blind!.describe(p, view)).toContain("Flows:");
    const out = { values: sol.values.map((v) => ({ flow: view.flows.findIndex((f) => f.flowKey === v.flowKey), value: v.value })) };
    const input = ledger.blind!.toInput(p, view, out);
    expect(ledger.grade(p, input).correct).toBe(true);
  });

  it("strict schemas", () => {
    expect(audit(ledger.paramsSchema).errors).toEqual([]);
    expect(audit(ledger.blind!.schema).errors).toEqual([]);
  });
});
