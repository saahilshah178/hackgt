import { describe, expect, it } from "vitest";
import {
  applyOpToCoeffs,
  atomCounts,
  chemCoefficientsToInput,
  describeCoeffs,
  encodeOutputToInput,
  equationOpsToInput,
  exprCoeffs,
  isChemEquationView,
  isEncodeView,
  isLedgerView,
  ledgerValuesToInput,
  parseFormula,
} from "./Build";

describe("Build.equationOpsToInput", () => {
  it("wraps the applied ops in order", () => {
    const ops = [{ op: "subtract" as const, value: "5" }, { op: "divide" as const, value: "3" }];
    expect(equationOpsToInput(ops)).toEqual({ ops });
  });
});

describe("Build.exprCoeffs / applyOpToCoeffs / describeCoeffs", () => {
  it("reads a linear expression as a*x + b", () => {
    expect(exprCoeffs("3*x + 5")).toEqual({ a: 3, b: 5 });
    expect(exprCoeffs("20")).toEqual({ a: 0, b: 20 });
  });

  it("returns null for a non-evaluating expression", () => {
    expect(exprCoeffs("not an expr (")).toBeNull();
  });

  it("applies add/subtract/multiply/divide to both sides symmetrically", () => {
    const start = { a: 3, b: 5 };
    const afterSub = applyOpToCoeffs(start, "subtract", { a: 0, b: 5 })!;
    expect(afterSub).toEqual({ a: 3, b: 0 });
    const afterDiv = applyOpToCoeffs(afterSub, "divide", { a: 0, b: 3 })!;
    expect(afterDiv).toEqual({ a: 1, b: 0 });
  });

  it("refuses to multiply/divide by an expression containing x", () => {
    expect(applyOpToCoeffs({ a: 1, b: 0 }, "multiply", { a: 1, b: 0 })).toBeNull();
  });

  it("refuses to divide by zero", () => {
    expect(applyOpToCoeffs({ a: 1, b: 0 }, "divide", { a: 0, b: 0 })).toBeNull();
  });

  it("describes a linear state for the pan readout", () => {
    expect(describeCoeffs({ a: 1, b: 0 })).toBe("x");
    expect(describeCoeffs({ a: 0, b: 7 })).toBe("7");
    expect(describeCoeffs({ a: 2, b: -3 })).toBe("2x - 3");
  });
});

describe("Build.parseFormula / atomCounts", () => {
  it("parses simple and nested formulas", () => {
    expect(parseFormula("H2O")).toEqual({ H: 2, O: 1 });
    expect(parseFormula("Ca(OH)2")).toEqual({ Ca: 1, O: 2, H: 2 });
  });

  it("returns null on a parse failure", () => {
    expect(parseFormula("not a formula!")).toBeNull();
  });

  it("scales per-formula counts by the coefficient", () => {
    const { elements, perFormula } = atomCounts(["H2O", "O2"], [2, 1]);
    expect(elements.sort()).toEqual(["H", "O"]);
    expect(perFormula[0]).toEqual({ H: 4, O: 2 });
    expect(perFormula[1]).toEqual({ H: 0, O: 2 });
  });
});

describe("Build.chemCoefficientsToInput / ledgerValuesToInput / encodeOutputToInput", () => {
  it("wraps coefficients", () => {
    expect(chemCoefficientsToInput([1, 5, 3, 4])).toEqual({ coefficients: [1, 5, 3, 4] });
  });
  it("wraps ledger blanks", () => {
    expect(ledgerValuesToInput([{ flowKey: "f0", value: 4 }])).toEqual({ values: [{ flowKey: "f0", value: 4 }] });
  });
  it("wraps encode output tokens", () => {
    expect(encodeOutputToInput(["A", "B"])).toEqual({ output: ["A", "B"] });
  });
});

describe("Build view discriminators", () => {
  it("detects chem_equation, ledger, and encode views by shape", () => {
    expect(isChemEquationView({ reactants: ["H2"], products: ["H2"] })).toBe(true);
    expect(isChemEquationView({ left: "x", right: "1", ops: [] })).toBe(false);

    expect(isLedgerView({ nodes: [], flows: [] })).toBe(true);
    expect(isLedgerView({ reactants: [], products: [] })).toBe(false);

    expect(
      isEncodeView({
        tableName: "t",
        table: [],
        input: [],
        direction: "forward",
        tokenLabel: "codon",
        outputLabel: "amino acid",
        palette: [],
      }),
    ).toBe(true);
    expect(isEncodeView({ left: "x", right: "1", ops: [] })).toBe(false);
  });
});
