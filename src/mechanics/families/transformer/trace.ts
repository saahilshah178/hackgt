import { compile, isMatrix } from "mathjs";
import { z } from "zod";
import { defineMode } from "../../types";
import { seededShuffle, trimNumber } from "../../util";

/*
 * transformer · trace: a tiny restricted DSL executed by code; the player predicts the final value of a
 * variable or the printed output. Lines: `x = expr`, `print expr`, `if cond: <line>` (optionally
 * `else: <line>`), `while cond: <line>` (step-capped). Expressions are mathjs plus zero-based `a[i]`.
 * Cards: state_containers, branch_doors, nested_rooms (small), indexed_inventory, ordering_conveyor,
 * memory_warehouse, signal_railway, one_bit_room, order_of_ops_forge.
 */

const Params = z.object({
  program: z.array(z.string()).min(1).max(16).describe('Lines of the mini language: "x = 3", "y = x * 2 + 1", "if x > 2: y = y - 1", "while i < 3: i = i + 1", "print y", "a = [4, 7, 9]", "print a[0]" (zero-based)'),
  ask: z.enum(["final_value", "output"]).describe("final_value: the value of `variable` when the program ends. output: everything print produced, space-separated"),
  variable: z.string().describe('For ask=final_value: the variable name. Otherwise ""'),
  options: z.array(z.string()).min(2).max(4).describe("2-4 candidate answers as the player would write them (numbers or space-separated output). Exactly one must equal what the program produces; the others are common misreadings"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  answer: string;
  correctIndex: number;
  finalState: Record<string, unknown>;
  output: string[];
  steps: number;
}
interface Input {
  optionIndex: number;
}
interface View {
  program: string[];
  ask: "final_value" | "output";
  variable: string;
  options: { optionIndex: number; text: string }[];
}

const MAX_STEPS = 2000;

type Scope = Record<string, unknown>;

function toPlain(v: unknown): unknown {
  if (isMatrix(v)) return (v as { toArray(): unknown[] }).toArray();
  return v;
}

function evalExpr(expr: string, scope: Scope): unknown {
  // zero-based indexing: name[i] -> idx0(name, i)
  const rewritten = expr.replace(/\b([a-zA-Z_]\w*)\s*\[([^\]]+)\]/g, "idx0($1, $2)");
  const fnScope: Scope = {
    ...scope,
    idx0: (arr: unknown, i: unknown) => {
      const a = toPlain(arr);
      if (!Array.isArray(a)) throw new Error("indexing a non-list");
      const k = Number(i);
      if (!Number.isInteger(k) || k < 0 || k >= a.length) throw new Error(`index ${String(i)} out of range for a list of ${a.length}`);
      return a[k];
    },
  };
  return toPlain(compile(rewritten).evaluate(fnScope));
}

function fmt(v: unknown): string {
  if (typeof v === "number") return trimNumber(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return `[${v.map(fmt).join(", ")}]`;
  if (typeof v === "string") return v;
  return String(v);
}

/** Runs the program; throws with a line number on any error. */
export function runProgram(lines: string[]): { state: Scope; output: string[]; steps: number } {
  const state: Scope = {};
  const output: string[] = [];
  let steps = 0;
  const exec = (line: string, lineNo: number): void => {
    if (++steps > MAX_STEPS) throw new Error(`line ${lineNo + 1}: the program runs too long (over ${MAX_STEPS} steps); is a while loop never ending?`);
    const s = line.trim();
    if (!s || s.startsWith("#")) return;
    const ifm = /^if\s+(.+?):\s*(.+?)(?:\s+else:\s*(.+))?$/.exec(s);
    if (ifm) {
      const cond = evalExpr(ifm[1], state);
      if (cond) exec(ifm[2], lineNo);
      else if (ifm[3]) exec(ifm[3], lineNo);
      return;
    }
    const wm = /^while\s+(.+?):\s*(.+)$/.exec(s);
    if (wm) {
      while (evalExpr(wm[1], state)) exec(wm[2], lineNo);
      return;
    }
    const pm = /^print\s+(.+)$/.exec(s);
    if (pm) {
      output.push(fmt(evalExpr(pm[1], state)));
      return;
    }
    const am = /^([a-zA-Z_]\w*)\s*=\s*(.+)$/.exec(s);
    if (am) {
      state[am[1]] = evalExpr(am[2], state);
      return;
    }
    throw new Error(`line ${lineNo + 1}: cannot parse "${s}"`);
  };
  lines.forEach((line, i) => {
    try {
      exec(line, i);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(msg.startsWith("line ") ? msg : `line ${i + 1}: ${msg}`);
    }
  });
  return { state, output, steps };
}

const normOpt = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

function solve(p: Params): Solution {
  const run = runProgram(p.program);
  const answer = p.ask === "output" ? run.output.join(" ") : fmt(run.state[p.variable]);
  const correctIndex = p.options.findIndex((o) => normOpt(o) === normOpt(answer));
  return { answer, correctIndex, finalState: run.state, output: run.output, steps: run.steps };
}

export const trace = defineMode({
  id: "trace",
  name: "Trace",
  implemented: true,
  blindSolvable: false,
  widget: "pick",
  knowledgeTypes: ["procedure"],
  directorBlurb: "A short program in a tiny language runs step by step; the player predicts a final value or the printed output. Variables, conditionals, loops, indexing, order of operations, caches, flip-flops.",
  authoringGuide: [
    'Keep programs to 3-10 lines in the mini language: "x = 3", "if x > 2: y = 1 else: y = 0", "while i < 3: i = i + 1", "print x", lists "a = [4, 7]" with zero-based "a[0]".',
    "Write the options as the player would type them; exactly one equals what the program really produces. Make the wrong options the classic misreadings (1-based index, left-to-right precedence, running both branches).",
    "Placeholders: {{lines}} (line count), {{answer}} (last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    let s: Solution;
    try {
      s = solve(p);
    } catch (err) {
      problems.push(`program error: ${err instanceof Error ? err.message : String(err)}`);
      return problems;
    }
    if (p.ask === "final_value") {
      if (!p.variable.trim()) problems.push('ask=final_value needs a variable name');
      else if (!(p.variable in s.finalState)) problems.push(`variable "${p.variable}" is never assigned`);
    }
    if (p.ask === "output" && s.output.length === 0) problems.push("ask=output but the program never prints");
    const opts = p.options.map(normOpt);
    if (new Set(opts).size !== opts.length) problems.push("options must be distinct");
    if (s.correctIndex === -1) problems.push(`none of the options equals what the program produces (${s.answer}); include it`);
    if (p.options.filter((o) => normOpt(o) === normOpt(s.answer)).length > 1) problems.push("two options equal the real answer");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { lines: String(p.program.length), answer: s.answer };
  },
  answerVars: ["answer"],
  present(p, seed): View {
    const options = p.options.map((text, optionIndex) => ({ optionIndex, text }));
    return { program: p.program, ask: p.ask, variable: p.variable, options: seededShuffle(options, seed) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if (input.optionIndex === s.correctIndex) return { correct: true, feedback: "That is exactly what the machine produced." };
    const picked = p.options[input.optionIndex];
    // Informative failure: show the state after the first few lines so the player can re-trace.
    const partial = runProgram(p.program.slice(0, Math.max(1, Math.floor(p.program.length / 3))));
    const snapshot = Object.entries(partial.state)
      .map(([k, v]) => `${k} = ${fmt(v)}`)
      .join(", ");
    return {
      correct: false,
      feedback: `${picked === undefined ? "Pick an option." : `"${picked}" isn't what the program produces.`} Trace it line by line: after the first few lines, ${snapshot || "nothing has been assigned yet"}.`,
    };
  },
  solutionInput: (_p, s) => ({ optionIndex: s.correctIndex }),
});
