import { z } from "zod";
import { defineMode } from "../../types";

/*
 * builder · program: a grid robot programmed in a tiny block language, interpreted by code. Lines:
 * "forward" / "left" / "right", "repeat N: cmd, cmd" (body runs N times, not expanded in the block count),
 * "define name: cmd, cmd" (declares a callable macro; not itself executed), "call name". `resolve` BFS's
 * the shortest atomic-command path from S to G (collecting every "*" gem first if required) over
 * (x, y, facing, gemMask) state, then compresses long straight runs into a "repeat" line only if the
 * straight-line program would exceed maxBlocks. Cards: automation_track, reusable_machines, code_golem.
 *
 * Input (widget "build"): { program: string[] } in the mini language above.
 * View: { grid, commands (palette), maxBlocks, mustCollectGems }
 */

const COMMANDS = ["forward", "left", "right", "repeat", "call"] as const;
type CommandType = (typeof COMMANDS)[number];

const Params = z.object({
  grid: z
    .array(z.string())
    .min(1)
    .max(8)
    .describe('Rows of the grid, each up to 12 characters: "." floor, "#" wall, "S" start (exactly one), "G" goal (exactly one), "*" gem'),
  commands: z.array(z.enum(COMMANDS)).min(1).max(5).describe("The command palette unlocked for this encounter. forward/left/right must always be included"),
  maxBlocks: z.number().int().min(3).max(12).describe("Maximum number of blocks the player's program may use"),
  mustCollectGems: z.boolean().describe("true when the robot must collect every gem (*) before reaching the goal"),
});
type Params = z.infer<typeof Params>;

interface Input {
  program: string[];
}
interface Solution {
  program: string[];
  blocks: number;
  pathLength: number;
}
interface View {
  grid: string[];
  commands: CommandType[];
  maxBlocks: number;
  mustCollectGems: boolean;
}

const MAX_STEPS = 500;
const DELTA: readonly [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]; // up, right, down, left

interface GridInfo {
  cells: string[][];
  start: [number, number];
  goal: [number, number];
  gems: string[]; // "x,y" keys, in scan order
}

function parseGrid(rows: readonly string[]): GridInfo | null {
  let start: [number, number] | null = null;
  let goal: [number, number] | null = null;
  const gems: string[] = [];
  const cells: string[][] = [];
  const width = rows[0]?.length ?? 0;
  for (let y = 0; y < rows.length; y++) {
    if (rows[y].length !== width) return null;
    const row: string[] = [];
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (!"S G . # *".replace(/ /g, "").includes(ch)) return null;
      if (ch === "S") {
        if (start) return null;
        start = [x, y];
      }
      if (ch === "G") {
        if (goal) return null;
        goal = [x, y];
      }
      if (ch === "*") gems.push(`${x},${y}`);
      row.push(ch);
    }
    cells.push(row);
  }
  if (!start || !goal) return null;
  return { cells, start, goal, gems };
}

function isWalkable(cells: string[][], x: number, y: number): boolean {
  if (y < 0 || y >= cells.length || x < 0 || x >= cells[0].length) return false;
  return cells[y][x] !== "#";
}

// ---------------------------------------------------------------- BFS: shortest atomic-command path

type Action = "forward" | "left" | "right";

function bfsPath(grid: GridInfo, mustCollectGems: boolean): Action[] | null {
  const gemIndex = new Map(grid.gems.map((g, i) => [g, i]));
  const fullMask = mustCollectGems ? (1 << grid.gems.length) - 1 : 0;
  const key = (x: number, y: number, dir: number, mask: number) => `${x},${y},${dir},${mask}`;
  const startState = { x: grid.start[0], y: grid.start[1], dir: 0, mask: 0 };
  const visited = new Set([key(startState.x, startState.y, startState.dir, startState.mask)]);
  const queue: { x: number; y: number; dir: number; mask: number; path: Action[] }[] = [{ ...startState, path: [] }];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    if (cur.x === grid.goal[0] && cur.y === grid.goal[1] && (!mustCollectGems || cur.mask === fullMask)) return cur.path;
    for (const action of ["forward", "left", "right"] as const) {
      let { x: nx, y: ny, dir: ndir, mask: nmask } = cur;
      if (action === "left") ndir = (cur.dir + 3) % 4;
      else if (action === "right") ndir = (cur.dir + 1) % 4;
      else {
        const [dx, dy] = DELTA[cur.dir];
        nx = cur.x + dx;
        ny = cur.y + dy;
        if (!isWalkable(grid.cells, nx, ny)) continue;
        const gk = `${nx},${ny}`;
        if (mustCollectGems && gemIndex.has(gk)) nmask = cur.mask | (1 << gemIndex.get(gk)!);
      }
      const k = key(nx, ny, ndir, nmask);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push({ x: nx, y: ny, dir: ndir, mask: nmask, path: [...cur.path, action] });
    }
  }
  return null;
}

/** Compresses maximal runs of 3+ identical consecutive actions into a "repeat" line. */
function compress(actions: readonly Action[]): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < actions.length) {
    let j = i;
    while (j < actions.length && actions[j] === actions[i]) j++;
    const runLen = j - i;
    if (runLen >= 3) lines.push(`repeat ${runLen}: ${actions[i]}`);
    else for (let k = 0; k < runLen; k++) lines.push(actions[i]);
    i = j;
  }
  return lines;
}

// ---------------------------------------------------------------- block counting + interpreter

type Token = { type: "forward" | "left" | "right" } | { type: "call"; name: string };

function parseToken(raw: string): Token {
  const t = raw.trim();
  if (t === "forward" || t === "left" || t === "right") return { type: t };
  const m = /^call\s+([a-zA-Z_]\w*)$/.exec(t);
  if (m) return { type: "call", name: m[1] };
  throw new Error(`unrecognized command "${t}"`);
}

type Line =
  | { kind: "atomic"; cmd: "forward" | "left" | "right" }
  | { kind: "call"; name: string }
  | { kind: "repeat"; n: number; body: Token[] }
  | { kind: "define"; name: string; body: Token[] };

function parseLine(raw: string): Line {
  const s = raw.trim();
  const repeatM = /^repeat\s+(\d+)\s*:\s*(.+)$/.exec(s);
  if (repeatM) return { kind: "repeat", n: parseInt(repeatM[1], 10), body: repeatM[2].split(",").map(parseToken) };
  const defineM = /^define\s+([a-zA-Z_]\w*)\s*:\s*(.+)$/.exec(s);
  if (defineM) return { kind: "define", name: defineM[1], body: defineM[2].split(",").map(parseToken) };
  const callM = /^call\s+([a-zA-Z_]\w*)$/.exec(s);
  if (callM) return { kind: "call", name: callM[1] };
  if (s === "forward" || s === "left" || s === "right") return { kind: "atomic", cmd: s };
  throw new Error(`line "${s}" doesn't parse`);
}

function countBlocks(lines: readonly string[]): number {
  let total = 0;
  for (const raw of lines) {
    const ln = parseLine(raw);
    if (ln.kind === "repeat" || ln.kind === "define") total += 1 + ln.body.length;
    else total += 1;
  }
  return total;
}

interface RunResult {
  x: number;
  y: number;
  collected: Set<string>;
  wallHitStep: number | null;
  wallHitPos: [number, number] | null;
  blocks: number;
}

function runProgram(grid: GridInfo, lines: readonly string[], palette: readonly CommandType[]): RunResult {
  const parsed = lines.map(parseLine);
  const requirePalette = (cmd: CommandType) => {
    if (!palette.includes(cmd)) throw new Error(`"${cmd}" isn't in the allowed command palette`);
  };
  const checkToken = (tok: Token) => {
    if (tok.type === "call") requirePalette("call");
    else requirePalette(tok.type);
  };
  for (const ln of parsed) {
    if (ln.kind === "atomic") requirePalette(ln.cmd);
    else if (ln.kind === "call") requirePalette("call");
    else if (ln.kind === "repeat") {
      requirePalette("repeat");
      ln.body.forEach(checkToken);
    } else {
      requirePalette("call");
      ln.body.forEach(checkToken);
    }
  }

  const defines = new Map<string, Token[]>();
  for (const ln of parsed) if (ln.kind === "define") defines.set(ln.name, ln.body);

  let x = grid.start[0];
  let y = grid.start[1];
  let dir = 0;
  const collected = new Set<string>();
  let steps = 0;
  let wallHitStep: number | null = null;
  let wallHitPos: [number, number] | null = null;

  function doAtomic(cmd: "forward" | "left" | "right"): boolean {
    steps++;
    if (steps > MAX_STEPS) throw new Error(`the program runs too long (over ${MAX_STEPS} steps)`);
    if (cmd === "left") {
      dir = (dir + 3) % 4;
      return true;
    }
    if (cmd === "right") {
      dir = (dir + 1) % 4;
      return true;
    }
    const [dx, dy] = DELTA[dir];
    const nx = x + dx;
    const ny = y + dy;
    if (!isWalkable(grid.cells, nx, ny)) {
      wallHitStep = steps;
      wallHitPos = [x, y];
      return false;
    }
    x = nx;
    y = ny;
    if (grid.cells[y][x] === "*") collected.add(`${x},${y}`);
    return true;
  }
  function runCall(name: string): boolean {
    const body = defines.get(name);
    if (!body) throw new Error(`call to undefined "${name}"`);
    for (const tok of body) if (!runToken(tok)) return false;
    return true;
  }
  function runToken(tok: Token): boolean {
    return tok.type === "call" ? runCall(tok.name) : doAtomic(tok.type);
  }
  function runLine(ln: Line): boolean {
    if (ln.kind === "define") return true;
    if (ln.kind === "atomic") return doAtomic(ln.cmd);
    if (ln.kind === "call") return runCall(ln.name);
    for (let i = 0; i < ln.n; i++) {
      for (const tok of ln.body) if (!runToken(tok)) return false;
    }
    return true;
  }

  for (const ln of parsed) {
    if (!runLine(ln)) break;
  }
  return { x, y, collected, wallHitStep, wallHitPos, blocks: countBlocks(lines) };
}

function solve(p: Params): Solution {
  const grid = parseGrid(p.grid);
  if (!grid) throw new Error("builder.program: grid must be rectangular with exactly one S and one G");
  const path = bfsPath(grid, p.mustCollectGems);
  if (!path) throw new Error(`builder.program: no path from S to G${p.mustCollectGems ? " collecting every gem" : ""}`);
  let lines: string[] = path;
  let blocks = lines.length;
  if (blocks > p.maxBlocks) {
    if (!p.commands.includes("repeat")) {
      throw new Error(`builder.program: the shortest program needs ${blocks} blocks, over the maxBlocks limit of ${p.maxBlocks}, and "repeat" isn't in the palette to shorten it`);
    }
    const compressed = compress(path);
    const cblocks = countBlocks(compressed);
    if (cblocks > p.maxBlocks) {
      throw new Error(`builder.program: the shortest program needs ${blocks} blocks (${cblocks} compressed), over the maxBlocks limit of ${p.maxBlocks}`);
    }
    lines = compressed;
    blocks = cblocks;
  }
  return { program: lines, blocks, pathLength: path.length };
}

export const program = defineMode({
  id: "program",
  name: "Program",
  implemented: true,
  blindSolvable: false,
  widget: "build",
  knowledgeTypes: ["procedure", "spatial"],
  directorBlurb:
    "The player writes a short block program to drive a grid robot from start to goal (optionally collecting gems), within a block budget. Loops, functions, algorithms, sequencing.",
  authoringGuide: [
    'Draw the grid as rows of ".", "#" (wall), exactly one "S" (start), exactly one "G" (goal), and "*" (gem). Up to 8 rows by 12 columns.',
    'Set commands to the palette unlocked so far: always include "forward", "left", "right"; add "repeat" for loops and "call" for reusable functions.',
    "Pick maxBlocks generously enough that a real program fits; code proves a solution exists (straight-line, or compressed with repeat) before the encounter ships.",
    "Don't write the program yourself; code finds the shortest path and compresses it only if needed to fit the budget.",
    "Placeholders: {{minBlocks}} (the fewest blocks a solution needs): last hint and debrief only.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const grid = parseGrid(p.grid);
    if (!grid) {
      problems.push("grid must be rectangular, with exactly one S and one G, using only . # S G *");
      return problems;
    }
    for (const req of ["forward", "left", "right"] as const) {
      if (!p.commands.includes(req)) problems.push(`commands must include "${req}"`);
    }
    if (new Set(p.commands).size !== p.commands.length) problems.push("commands must list each type at most once");
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
    return { minBlocks: String(s.blocks) };
  },
  answerVars: ["minBlocks"],
  present(p): View {
    return { grid: [...p.grid], commands: [...p.commands], maxBlocks: p.maxBlocks, mustCollectGems: p.mustCollectGems };
  },
  grade(p, input: Input) {
    const grid = parseGrid(p.grid)!;
    let result: RunResult;
    try {
      result = runProgram(grid, input.program, p.commands);
    } catch (err) {
      return { correct: false, feedback: `Invalid program: ${err instanceof Error ? err.message : String(err)}.` };
    }
    if (result.blocks > p.maxBlocks) {
      return { correct: false, feedback: `Your program uses ${result.blocks} blocks, more than the limit of ${p.maxBlocks}.` };
    }
    if (result.wallHitStep !== null) {
      return {
        correct: false,
        feedback: `The robot hit a wall at step ${result.wallHitStep}, from position (${result.wallHitPos![0]}, ${result.wallHitPos![1]}).`,
      };
    }
    if (result.x !== grid.goal[0] || result.y !== grid.goal[1]) {
      return { correct: false, feedback: `The robot ended at (${result.x}, ${result.y}) instead of the goal at (${grid.goal[0]}, ${grid.goal[1]}).` };
    }
    if (p.mustCollectGems && result.collected.size < grid.gems.length) {
      return { correct: false, feedback: `The robot reached the goal but only collected ${result.collected.size} of ${grid.gems.length} gems.` };
    }
    return { correct: true, feedback: "The robot reaches the goal within the block budget." };
  },
  solutionInput: (_p, s) => ({ program: s.program }),
});
