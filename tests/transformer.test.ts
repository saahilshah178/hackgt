import { describe, expect, it } from "vitest";
import { encode } from "../src/mechanics/families/transformer/encode";
import { functionMachine } from "../src/mechanics/families/transformer/function_machine";

describe("transformer.encode (protein_factory)", () => {
  const codon = {
    tableName: "codon table (mRNA codon → amino acid)",
    table: [
      { from: "AUG", to: "Met" },
      { from: "UUU", to: "Phe" },
      { from: "GGC", to: "Gly" },
      { from: "UAA", to: "Stop" },
      { from: "CCU", to: "Pro" },
      { from: "AAA", to: "Lys" },
    ],
    input: ["AUG", "UUU", "GGC", "UAA"],
    direction: "forward" as const,
    tokenLabel: "codon",
    outputLabel: "amino acid",
    showTable: true,
  };

  it("translates in order and grades position by position without naming the answer", () => {
    expect(encode.check(codon)).toEqual([]);
    const s = encode.resolve(codon);
    expect(s.output).toEqual(["Met", "Phe", "Gly", "Stop"]);
    expect(encode.grade(codon, encode.solutionInput(codon, s)).correct).toBe(true);
    const miss = encode.grade(codon, { output: ["Met", "Pro", "Gly", "Stop"] });
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/Position 2/);
    expect(miss.feedback).not.toMatch(/Phe/);
    expect(encode.grade(codon, { output: ["Met"] }).feedback).toMatch(/Build all 4/);
    expect(encode.grade(codon, { output: ["met", " phe", "GLY", "stop"] }).correct).toBe(true); // case/space tolerant
  });

  it("presents the palette shuffled and hides the table for recall cards", () => {
    const v = encode.present(codon, 5);
    expect(v.palette.sort()).toEqual(["Gly", "Lys", "Met", "Phe", "Pro", "Stop"]);
    expect(encode.present({ ...codon, showTable: false }, 5).table).toEqual([]);
  });

  it("decodes in reverse and rejects ambiguous or incomplete tables", () => {
    const rev = { ...codon, direction: "reverse" as const, input: ["Met", "Gly"] };
    expect(encode.check(rev)).toEqual([]);
    expect(encode.resolve(rev).output).toEqual(["AUG", "GGC"]);
    expect(encode.check({ ...rev, table: [...codon.table, { from: "AUA", to: "Met" }] }).join(" ")).toMatch(/unique/);
    expect(encode.check({ ...codon, input: ["AUG", "XYZ"] }).join(" ")).toMatch(/not in the table/);
    expect(encode.check({ ...codon, table: codon.table.slice(0, 4) }).join(" ")).toMatch(/distractor/);
  });

  it("blind solver passes tokens straight through", () => {
    const v = encode.present(codon, 1);
    expect(encode.blind!.describe(codon, v)).toContain("AUG → Met");
    expect(encode.grade(codon, encode.blind!.toInput(codon, v, { output: ["Met", "Phe", "Gly", "Stop"] })).correct).toBe(true);
  });
});

describe("transformer.function_machine", () => {
  const out = { rule: "2*x + 3", examples: ["1", "2", "5"], ask: "output" as const, query: "10", ruleOptions: [] as string[], inputLabel: "input", outputLabel: "output" };
  const rule = { ...out, ask: "rule" as const, query: "0", ruleOptions: ["x + 4", "2*x + 3", "3*x + 1"] };

  it("predicts the output for a new input and runs the machine on a miss", () => {
    expect(functionMachine.check(out)).toEqual([]);
    const s = functionMachine.resolve(out);
    expect(s.outputs).toEqual([5, 7, 13]);
    expect(s.answer).toBe(23);
    expect(functionMachine.grade(out, functionMachine.solutionInput(out, s)).correct).toBe(true);
    const miss = functionMachine.grade(out, { value: 20, ruleIndex: null });
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/turned 1 into 5/);
    expect(functionMachine.templateVars(out, s)).toMatchObject({ examples: "1 → 5, 2 → 7, 5 → 13", query: "10", answer: "23" });
  });

  it("identifies the rule among options, shuffled by display position, and shows a counterexample on a miss", () => {
    expect(functionMachine.check(rule)).toEqual([]);
    const s = functionMachine.resolve(rule);
    expect(s.correctRuleIndex).toBe(1);
    const v = functionMachine.present(rule, 3);
    expect(v.ruleOptions.map((o) => o.ruleIndex).sort()).toEqual([0, 1, 2]);
    const pos = v.ruleOptions.findIndex((o) => o.ruleIndex === 1);
    expect(functionMachine.grade(rule, functionMachine.blind!.toInput(rule, v, { value: null, ruleOption: pos })).correct).toBe(true);
    const miss = functionMachine.grade(rule, { value: null, ruleIndex: 0 });
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/your rule gives 5, but the machine showed 5|your rule gives 6, but the machine showed 7/);
  });

  it("rejects ambiguous option sets, repeated examples, and queries that are examples", () => {
    expect(functionMachine.check({ ...rule, ruleOptions: ["2*x + 3", "x + 4"], examples: ["1"] }).join(" ")).toMatch(/every shown example|examples all give/);
    expect(functionMachine.check({ ...rule, ruleOptions: ["x + 4", "3*x + 1"] }).join(" ")).toMatch(/exactly one ruleOption/);
    expect(functionMachine.check({ ...out, query: "2" }).join(" ")).toMatch(/must not be one of the examples/);
    expect(functionMachine.check({ ...out, examples: ["1", "1", "2"] }).join(" ")).toMatch(/distinct/);
    expect(functionMachine.check({ ...out, rule: "2.0001*x" }).join(" ")).toMatch(/rounded decimal/);
  });
});

describe("transformer.trace", () => {
  const p = {
    program: ["x = 3", "y = x * 2 + 1", "if y > 6: x = x + 10 else: x = 0", "a = [4, 7, 9]", "print a[0]", "print x"],
    ask: "output" as const,
    variable: "",
    options: ["4 13", "7 13", "4 3", "7 0"],
  };
  it("executes assignments, conditionals, lists (zero-based) and print", async () => {
    const { trace, runProgram } = await import("../src/mechanics/families/transformer/trace");
    expect(trace.check(p)).toEqual([]);
    const s = trace.resolve(p);
    expect(s.answer).toBe("4 13");
    expect(s.correctIndex).toBe(0);
    expect(trace.grade(p, trace.solutionInput(p, s)).correct).toBe(true);
    const miss = trace.grade(p, { optionIndex: 1 });
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/first few lines, x = 3, y = 7/);
    expect(runProgram(["i = 0", "while i < 5: i = i + 2", "print i"]).output).toEqual(["6"]);
    const fv = { ...p, ask: "final_value" as const, variable: "x", options: ["13", "3", "0"] };
    expect(trace.resolve(fv).answer).toBe("13");
    expect(trace.present(fv, 3).options.map((o) => o.optionIndex).sort()).toEqual([0, 1, 2]);
  });
  it("rejects programs that fail, never-ending loops, and option sets without the answer", async () => {
    const { trace } = await import("../src/mechanics/families/transformer/trace");
    expect(trace.check({ ...p, program: ["x = 3", "print a[0]"] }).join(" ")).toMatch(/program error: line 2/);
    expect(trace.check({ ...p, program: ["i = 0", "while i < 1: x = 1", "print i"] }).join(" ")).toMatch(/too long/);
    expect(trace.check({ ...p, options: ["7 13", "4 3"] }).join(" ")).toMatch(/none of the options/);
    expect(trace.check({ ...p, ask: "final_value", variable: "zz", options: ["1", "2"] }).join(" ")).toMatch(/never assigned/);
  });
});
