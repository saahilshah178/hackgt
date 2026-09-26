import { z } from "zod";
import { defineMode } from "../../types";

/*
 * builder · tiles: a generic grid-fill validator. Each grid cell holds one piece id (or "."); a piece's
 * `cells` field is its VALUE/weight for the sum rules (e.g. a note's beat count, not its footprint), so a
 * cell always holds exactly one token. Rules are checked in order and grading stops at the first one the
 * player's grid violates, naming it. `resolve` only has to demonstrate ONE valid layout: it uses `target`
 * directly for exact_layout, or greedily coin-changes a single sum rule (row_sum_equals, col_sum_equals, or
 * total_equals) when exactly one drives the puzzle; combining several sum rules at once isn't supported.
 * Cards: factor_forge, area_tiler, grouping_territory, instruction_factory, rhythm_bridge, scale_builder,
 * chord_forge.
 *
 * Grid text format (both params.target and Input.grid): each row is piece ids / "." separated by single
 * spaces; params.target packs all rows into one string joined by "|" (e.g. "q q h .|w . . .").
 * Input (widget "build"): { grid: string[] } (rows), rows.length === params.rows, each split into
 * params.cols space-separated tokens.
 */

const RULE_KINDS = ["row_sum_equals", "total_equals", "col_sum_equals", "exact_layout"] as const;
type RuleKind = (typeof RULE_KINDS)[number];

const Rule = z.object({
  kind: z.enum(RULE_KINDS),
  value: z
    .string()
    .describe('For row_sum_equals/col_sum_equals/total_equals: the exact target number, e.g. "4". For exact_layout: unused, write ""'),
});

const Piece = z.object({
  id: z.string().describe('snake_case id for this piece, e.g. "quarter_note"'),
  label: z.string().describe("Shown on the piece, under 40 characters"),
  cells: z.number().int().min(1).max(6).describe("This piece's value (used by the sum rules), not its footprint"),
});

const Params = z.object({
  rows: z.number().int().min(1).max(8).describe("Number of grid rows"),
  cols: z.number().int().min(1).max(12).describe("Number of grid columns"),
  pieces: z.array(Piece).min(1).max(6).describe("1-6 kinds of piece the player may place"),
  rules: z.array(Rule).min(1).max(4).describe("Rules checked in order; grading stops at the first one violated"),
  target: z
    .string()
    .describe('Exact layout when a rule has kind="exact_layout": rows joined by "|", cells space-separated (piece ids or "."). Otherwise ""'),
});
type Params = z.infer<typeof Params>;

type Grid = string[][]; // rows x cols of piece ids or "."

interface Input {
  grid: string[];
}
interface Solution {
  layout: Grid;
  layoutString: string;
}
interface View {
  rows: number;
  cols: number;
  pieces: { id: string; label: string }[];
  rules: { kind: RuleKind; value: string }[];
}

const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;

function parseRowsOfTokens(rows: number, cols: number, raw: readonly string[]): Grid | null {
  if (raw.length !== rows) return null;
  const grid: Grid = [];
  for (const line of raw) {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    if (tokens.length !== cols) return null;
    grid.push(tokens);
  }
  return grid;
}

function parseTargetString(rows: number, cols: number, raw: string): Grid | null {
  const parts = raw.split("|");
  return parseRowsOfTokens(rows, cols, parts);
}

function gridToString(grid: Grid): string {
  return grid.map((row) => row.join(" ")).join("|");
}

function pieceValueMap(p: Params): Map<string, number> {
  return new Map(p.pieces.map((pc) => [pc.id, pc.cells]));
}

function cellValue(values: Map<string, number>, token: string): number | null {
  if (token === ".") return 0;
  return values.get(token) ?? null;
}

function rowSum(values: Map<string, number>, grid: Grid, r: number): number | null {
  let sum = 0;
  for (const tok of grid[r]) {
    const v = cellValue(values, tok);
    if (v === null) return null;
    sum += v;
  }
  return sum;
}

function colSum(values: Map<string, number>, grid: Grid, c: number): number | null {
  let sum = 0;
  for (const row of grid) {
    const v = cellValue(values, row[c]);
    if (v === null) return null;
    sum += v;
  }
  return sum;
}

function totalSum(values: Map<string, number>, grid: Grid): number | null {
  let sum = 0;
  for (const row of grid) {
    for (const tok of row) {
      const v = cellValue(values, tok);
      if (v === null) return null;
      sum += v;
    }
  }
  return sum;
}

function parseTargetValue(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Unbounded coin-change: a multiset of piece ids whose values sum exactly to `target`, at most `slots` pieces. */
function coinChange(pieces: readonly { id: string; cells: number }[], target: number, slots: number): string[] | null {
  // dp[s] = a list of piece ids reaching sum s with the fewest pieces, or undefined if unreached
  const dp: (string[] | undefined)[] = new Array(target + 1).fill(undefined);
  dp[0] = [];
  for (let s = 1; s <= target; s++) {
    for (const pc of pieces) {
      if (pc.cells > s) continue;
      const prev = dp[s - pc.cells];
      if (prev === undefined) continue;
      if (prev.length + 1 > slots) continue;
      if (dp[s] === undefined || prev.length + 1 < dp[s]!.length) dp[s] = [...prev, pc.id];
    }
  }
  return dp[target] ?? null;
}

function buildLayout(p: Params): Grid {
  const exactRule = p.rules.find((r) => r.kind === "exact_layout");
  if (exactRule) {
    const grid = parseTargetString(p.rows, p.cols, p.target);
    if (!grid) throw new Error("builder.tiles: target doesn't match rows x cols, or a row has the wrong number of tokens");
    return grid;
  }
  if (p.rules.length !== 1) {
    throw new Error("builder.tiles: without exact_layout, resolve only supports a single sum rule");
  }
  const rule = p.rules[0];
  const target = parseTargetValue(rule.value);
  if (target === null) throw new Error(`builder.tiles: rule value "${rule.value}" isn't a non-negative integer`);
  if (rule.kind === "row_sum_equals") {
    const combo = coinChange(p.pieces, target, p.cols);
    if (!combo) throw new Error(`builder.tiles: no combination of pieces sums to ${target} within ${p.cols} cells`);
    const row = [...combo, ...Array(p.cols - combo.length).fill(".")];
    return Array.from({ length: p.rows }, () => [...row]);
  }
  if (rule.kind === "col_sum_equals") {
    const combo = coinChange(p.pieces, target, p.rows);
    if (!combo) throw new Error(`builder.tiles: no combination of pieces sums to ${target} within ${p.rows} cells`);
    const col = [...combo, ...Array(p.rows - combo.length).fill(".")];
    return Array.from({ length: p.rows }, (_, r) => Array.from({ length: p.cols }, () => col[r]));
  }
  // total_equals
  const combo = coinChange(p.pieces, target, p.rows * p.cols);
  if (!combo) throw new Error(`builder.tiles: no combination of pieces sums to ${target} within ${p.rows * p.cols} cells`);
  const flat = [...combo, ...Array(p.rows * p.cols - combo.length).fill(".")];
  const grid: Grid = [];
  for (let r = 0; r < p.rows; r++) grid.push(flat.slice(r * p.cols, (r + 1) * p.cols));
  return grid;
}

function solve(p: Params): Solution {
  const layout = buildLayout(p);
  return { layout, layoutString: gridToString(layout) };
}

/** Checks one rule against a grid; returns null when it passes, else an informative message naming the rule. */
function checkRule(p: Params, rule: { kind: RuleKind; value: string }, grid: Grid, values: Map<string, number>): string | null {
  if (rule.kind === "exact_layout") {
    const target = parseTargetString(p.rows, p.cols, p.target);
    if (!target) return "internal: exact_layout target is malformed";
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) {
        if (grid[r][c] !== target[r][c]) {
          return `cell (row ${r + 1}, col ${c + 1}) should be "${target[r][c]}" but is "${grid[r][c]}".`;
        }
      }
    }
    return null;
  }
  const target = parseTargetValue(rule.value)!;
  if (rule.kind === "row_sum_equals") {
    for (let r = 0; r < p.rows; r++) {
      const sum = rowSum(values, grid, r);
      if (sum === null) return `row ${r + 1} uses a piece id that doesn't exist.`;
      if (sum !== target) return `row ${r + 1} sums to ${sum}, but every row must sum to ${target}.`;
    }
    return null;
  }
  if (rule.kind === "col_sum_equals") {
    for (let c = 0; c < p.cols; c++) {
      const sum = colSum(values, grid, c);
      if (sum === null) return `column ${c + 1} uses a piece id that doesn't exist.`;
      if (sum !== target) return `column ${c + 1} sums to ${sum}, but every column must sum to ${target}.`;
    }
    return null;
  }
  // total_equals
  const sum = totalSum(values, grid);
  if (sum === null) return "the grid uses a piece id that doesn't exist.";
  if (sum !== target) return `the grid totals ${sum}, but it must total ${target}.`;
  return null;
}

export const tiles = defineMode({
  id: "tiles",
  name: "Tiles",
  implemented: true,
  blindSolvable: false,
  widget: "build",
  knowledgeTypes: ["procedure", "spatial"],
  directorBlurb:
    "The player fills a grid with weighted pieces so rows, columns, or the whole grid sum to a target (or match an exact layout). Measures, area models, K-map groupings, algebra tiles, schedules.",
  authoringGuide: [
    "Give rows x cols, 1-6 pieces (id, label, and cells = the piece's VALUE used by sum rules, not its footprint - one piece always fills exactly one grid cell), and 1-4 rules checked in order.",
    'Use row_sum_equals/col_sum_equals/total_equals with value as a plain integer string (e.g. "4"), or exact_layout with target set to the full grid: rows joined by "|", cells space-separated (piece ids or ".").',
    "Keep it to ONE sum rule unless you're using exact_layout: code only proves a layout exists for a single sum rule at a time.",
    "Don't design the layout yourself when using a sum rule; code finds one that fits. For exact_layout, target IS the answer, so never quote it in the prompt or first hint.",
    "Placeholders: {{layout}} (the full solution grid): last hint and debrief only.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const ids = p.pieces.map((pc) => pc.id);
    ids.forEach((id, i) => {
      if (!SNAKE_CASE.test(id)) problems.push(`pieces[${i}].id "${id}" must be lowercase snake_case`);
    });
    if (new Set(ids).size !== ids.length) problems.push("piece ids must be unique");
    if (ids.includes(".")) problems.push('a piece id cannot be "." (that means empty)');
    for (const [i, rule] of p.rules.entries()) {
      if (rule.kind !== "exact_layout" && parseTargetValue(rule.value) === null) {
        problems.push(`rules[${i}].value "${rule.value}" must be a non-negative integer for kind "${rule.kind}"`);
      }
    }
    if (problems.length > 0) return problems;
    try {
      solve(p);
    } catch (err) {
      problems.push(err instanceof Error ? err.message : String(err));
    }
    return problems;
  },
  resolve: solve,
  templateVars(_p, s) {
    return { layout: s.layoutString };
  },
  answerVars: ["layout"],
  present(p): View {
    return {
      rows: p.rows,
      cols: p.cols,
      pieces: p.pieces.map((pc) => ({ id: pc.id, label: pc.label })),
      rules: p.rules.map((r) => ({ kind: r.kind, value: r.value })),
    };
  },
  grade(p, input: Input) {
    const grid = parseRowsOfTokens(p.rows, p.cols, input.grid);
    if (!grid) return { correct: false, feedback: `Fill exactly ${p.rows} rows of ${p.cols} cells each.` };
    const values = pieceValueMap(p);
    for (const tok of grid.flat()) {
      if (tok !== "." && !values.has(tok)) return { correct: false, feedback: `"${tok}" isn't one of the available piece ids.` };
    }
    for (const rule of p.rules) {
      const problem = checkRule(p, rule, grid, values);
      if (problem) return { correct: false, feedback: problem };
    }
    return { correct: true, feedback: "Every rule is satisfied." };
  },
  solutionInput: (_p, s) => ({ grid: s.layout.map((row) => row.join(" ")) }),
});
