import { compile } from "mathjs";
import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, prettyExpr, seededShuffle, trimNumber } from "../../util";

/*
 * transformer · function_machine: a machine applies a hidden rule. The player sees k input/output pairs and
 * either predicts the output for a new input or identifies the rule among options. Informative failure
 * runs the machine on the player's choice. Cards: function_factory, pattern_path, derivative_machine,
 * bucket_router, conjugation_forge.
 */

const Params = z.object({
  rule: z.string().describe('The machine\'s rule as a mathjs expression in x, e.g. "2*x + 3" or "x^2" or "mod(x, 7)"'),
  examples: z.array(z.string()).min(2).max(5).describe("Exact input values shown with their outputs, e.g. [\"1\", \"2\", \"5\"]"),
  ask: z.enum(["output", "rule"]).describe("output: predict the output for `query`. rule: pick the rule among `ruleOptions`"),
  query: z.string().describe("For ask=output: the new exact input. Otherwise write \"0\""),
  ruleOptions: z
    .array(z.string())
    .min(0)
    .max(4)
    .describe("For ask=rule: 2-4 mathjs rules including the true one; the examples must rule out every other option. Empty for ask=output"),
  inputLabel: z.string().describe('e.g. "input", "term number", "key"'),
  outputLabel: z.string().describe('e.g. "output", "term", "bucket"'),
});
type Params = z.infer<typeof Params>;

interface Solution {
  outputs: number[];
  answer: number | null;
  correctRuleIndex: number | null;
  answerLabel: string;
}
interface Input {
  value: number | null;
  ruleIndex: number | null;
}
interface View {
  ask: "output" | "rule";
  examples: { x: number; y: number }[];
  query: number | null;
  /** shuffled; each carries its original index so the input can name it */
  ruleOptions: { ruleIndex: number; text: string }[];
  inputLabel: string;
  outputLabel: string;
}

function run(expr: string, x: number): number | null {
  try {
    const v = compile(expr).evaluate({ x }) as unknown;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

const PROBES = [-3, -1, 0.5, 2.5, 4, 7, 11];

function sameRule(a: string, b: string, xs: number[]): boolean {
  return xs.every((x) => {
    const va = run(a, x);
    const vb = run(b, x);
    return va !== null && vb !== null && Math.abs(va - vb) <= 1e-9 * (1 + Math.abs(va));
  });
}

function solve(p: Params): Solution {
  const xs = p.examples.map((e) => evalExact(e));
  if (xs.some((x) => x === null)) throw new Error("function_machine: examples must be exact numbers");
  const outputs = (xs as number[]).map((x) => {
    const y = run(p.rule, x);
    if (y === null) throw new Error(`function_machine: rule "${p.rule}" fails at x = ${x}`);
    return Math.round(y * 1e9) / 1e9;
  });
  if (p.ask === "output") {
    const q = evalExact(p.query);
    const answer = q === null ? null : run(p.rule, q);
    return { outputs, answer: answer === null ? null : Math.round(answer * 1e9) / 1e9, correctRuleIndex: null, answerLabel: answer === null ? "?" : trimNumber(answer) };
  }
  const idx = p.ruleOptions.findIndex((opt) => sameRule(opt, p.rule, [...(xs as number[]), ...PROBES]));
  return { outputs, answer: null, correctRuleIndex: idx, answerLabel: idx >= 0 ? prettyExpr(p.ruleOptions[idx]) : "?" };
}

export const functionMachine = defineMode({
  id: "function_machine",
  name: "Function machine",
  implemented: true,
  blindSolvable: true,
  widget: "pick",
  knowledgeTypes: ["procedure", "quantitative"],
  directorBlurb:
    "A machine applies a hidden rule; the player sees input/output pairs and predicts a new output or names the rule. Functions, sequences, hashing, differentiation rules, conjugation patterns.",
  authoringGuide: [
    "Write the rule in mathjs with x as the input, e.g. \"3*x - 1\", \"x^2 + 1\", \"mod(x, 5)\". Choose examples whose outputs are clean numbers.",
    "ask=output: the query must not be one of the examples. ask=rule: give 2-4 options; every wrong option must disagree with the true rule on at least one shown example.",
    "Never write outputs as literal numbers in the text; use the placeholders {{examples}} (safe), {{query}} (safe), {{answer}} (the output or the rule: last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (looksApproximated(p.rule)) problems.push(`rule "${p.rule}" contains a rounded decimal; write it exactly`);
    const xs = p.examples.map((e) => evalExact(e));
    if (xs.some((x) => x === null)) {
      problems.push("every example must be an exact number");
      return problems;
    }
    if (new Set(xs).size !== xs.length) problems.push("examples must be distinct inputs");
    for (const x of xs as number[]) if (run(p.rule, x) === null) problems.push(`rule "${p.rule}" does not evaluate at x = ${x}`);
    if (problems.length) return problems;
    const ys = (xs as number[]).map((x) => run(p.rule, x)!);
    if (new Set(ys.map((y) => Math.round(y * 1e6))).size === 1) problems.push("the examples all give the same output; choose inputs that show the rule changing");
    if (p.ask === "output") {
      const q = evalExact(p.query);
      if (q === null) problems.push("query must be an exact number");
      else if ((xs as number[]).includes(q)) problems.push("query must not be one of the examples");
      else if (run(p.rule, q) === null) problems.push(`rule does not evaluate at the query x = ${q}`);
    } else {
      if (p.ruleOptions.length < 2) problems.push("ask=rule needs 2-4 ruleOptions");
      const matches = p.ruleOptions.filter((opt) => sameRule(opt, p.rule, [...(xs as number[]), ...PROBES]));
      if (matches.length !== 1) problems.push(`exactly one ruleOption must be equivalent to the rule (found ${matches.length}); write the true rule as one of the options`);
      p.ruleOptions.forEach((opt, i) => {
        if (!sameRule(opt, p.rule, [...(xs as number[]), ...PROBES]) && sameRule(opt, p.rule, xs as number[])) {
          problems.push(`ruleOptions[${i}] "${opt}" agrees with the rule on every shown example; add an example that tells them apart`);
        }
        if ((xs as number[]).some((x) => run(opt, x) === null)) problems.push(`ruleOptions[${i}] "${opt}" does not evaluate on the examples`);
      });
    }
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    const xs = p.examples.map((e) => evalExact(e) ?? 0);
    return {
      examples: xs.map((x, i) => `${trimNumber(x)} → ${trimNumber(s.outputs[i])}`).join(", "),
      query: p.ask === "output" ? prettyExpr(p.query) : "",
      answer: s.answerLabel,
    };
  },
  answerVars: ["answer"],
  present(p, seed): View {
    const s = solve(p);
    const xs = p.examples.map((e) => evalExact(e) ?? 0);
    const options = p.ruleOptions.map((text, ruleIndex) => ({ ruleIndex, text: prettyExpr(text) }));
    return {
      ask: p.ask,
      examples: xs.map((x, i) => ({ x, y: s.outputs[i] })),
      query: p.ask === "output" ? evalExact(p.query) : null,
      ruleOptions: p.ask === "rule" ? seededShuffle(options, seed) : [],
      inputLabel: p.inputLabel,
      outputLabel: p.outputLabel,
    };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const xs = p.examples.map((e) => evalExact(e) ?? 0);
    if (p.ask === "output") {
      if (s.answer === null || input.value === null || !Number.isFinite(input.value)) return { correct: false, feedback: `Enter the ${p.outputLabel} the machine produces for ${prettyExpr(p.query)}.` };
      const tol = Math.max(0.01, Math.abs(s.answer) * 0.01);
      if (Math.abs(input.value - s.answer) <= tol) return { correct: true, feedback: "The machine hums: that is exactly what it produces." };
      return {
        correct: false,
        feedback: `The machine turned ${trimNumber(xs[0])} into ${trimNumber(s.outputs[0])} and ${trimNumber(xs[1])} into ${trimNumber(s.outputs[1])}. Find the one step that does both, then apply it to ${prettyExpr(p.query)}.`,
      };
    }
    if (input.ruleIndex === null || input.ruleIndex < 0 || input.ruleIndex >= p.ruleOptions.length) return { correct: false, feedback: "Pick one of the rules." };
    if (input.ruleIndex === s.correctRuleIndex) return { correct: true, feedback: "That rule reproduces every pair the machine showed." };
    const chosen = p.ruleOptions[input.ruleIndex];
    const badX = xs.find((x) => {
      const v = run(chosen, x);
      return v === null || Math.abs(v - (run(p.rule, x) ?? Number.NaN)) > 1e-9;
    });
    const shown = badX === undefined ? "" : ` Run it on ${trimNumber(badX)}: your rule gives ${trimNumber(run(chosen, badX) ?? Number.NaN)}, but the machine showed ${trimNumber(run(p.rule, badX) ?? 0)}.`;
    return { correct: false, feedback: `That rule doesn't match the machine.${shown}` };
  },
  solutionInput: (_p, s) => ({ value: s.answer, ruleIndex: s.correctRuleIndex }),
  blind: {
    schema: z.object({
      value: z.number().nullable().describe("For an output question: the predicted output; else null"),
      ruleOption: z.number().int().min(0).max(3).nullable().describe("For a rule question: the position (0-based) of the correct rule in the list shown; else null"),
    }),
    describe: (p, view: View) =>
      [
        `${p.inputLabel} → ${p.outputLabel} pairs: ${view.examples.map((e) => `${trimNumber(e.x)} → ${trimNumber(e.y)}`).join(", ")}`,
        view.ask === "output" ? `Question: what is the ${p.outputLabel} for ${trimNumber(view.query ?? 0)}?` : `Question: which rule is the machine using?\n${view.ruleOptions.map((o, i) => `${i}. ${o.text}`).join("\n")}`,
      ].join("\n"),
    toInput: (_p, view: View, out) => {
      const o = out as { value: number | null; ruleOption: number | null };
      return { value: o.value, ruleIndex: o.ruleOption === null ? null : (view.ruleOptions[o.ruleOption]?.ruleIndex ?? -1) };
    },
  },
});
