import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { circuit } from "../src/mechanics/families/builder/circuit";
import { electron_config } from "../src/mechanics/families/builder/electron_config";
import { genetics } from "../src/mechanics/families/builder/genetics";
import { molecule } from "../src/mechanics/families/builder/molecule";
import { program } from "../src/mechanics/families/builder/program";
import { sentence } from "../src/mechanics/families/builder/sentence";
import { tiles } from "../src/mechanics/families/builder/tiles";

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

// ---------------------------------------------------------------- builder.circuit

const xorParams: z.infer<typeof circuit.paramsSchema> = {
  inputs: ["A", "B"],
  target: [
    { inputs: [false, false], output: false },
    { inputs: [false, true], output: true },
    { inputs: [true, false], output: true },
    { inputs: [true, true], output: false },
  ],
  gates: ["AND", "OR", "NOT"],
  maxGates: 5,
};

const halfAdderSumParams: z.infer<typeof circuit.paramsSchema> = {
  inputs: ["A", "B"],
  target: [
    { inputs: [false, false], output: false }, // sum = A xor B
    { inputs: [false, true], output: true },
    { inputs: [true, false], output: true },
    { inputs: [true, true], output: false },
  ],
  gates: ["NAND"],
  maxGates: 5,
};

describe("builder.circuit", () => {
  it("valid params (XOR from AND/OR/NOT, half-adder sum from NAND alone) pass check", () => {
    expect(circuit.check(xorParams)).toEqual([]);
    expect(circuit.check(halfAdderSumParams)).toEqual([]);
  });

  it("rejects: incomplete truth table, and a target unreachable within the gate/maxGates budget", () => {
    const incomplete = { ...xorParams, target: xorParams.target.slice(0, 3) };
    expect(circuit.check(incomplete).join(" ")).toMatch(/exactly 4 rows/);
    const tooTight: z.infer<typeof circuit.paramsSchema> = { ...xorParams, gates: ["NAND"], maxGates: 3 };
    expect(circuit.check(tooTight).join(" ")).toMatch(/no circuit/);
  });

  it("resolve + solutionInput passes grade for both cases", () => {
    const s1 = circuit.resolve(xorParams);
    expect(s1.minGates).toBeLessThanOrEqual(5);
    expect(circuit.grade(xorParams, circuit.solutionInput(xorParams, s1)).correct).toBe(true);
    const s2 = circuit.resolve(halfAdderSumParams);
    expect(circuit.grade(halfAdderSumParams, circuit.solutionInput(halfAdderSumParams, s2)).correct).toBe(true);
  });

  it("a wrong netlist gives feedback naming the first bad input row", () => {
    const wrong = { gates: [{ id: "g0", type: "AND" as const, inputs: ["A", "B"] }], output: "g0" }; // AND, not XOR
    const miss = circuit.grade(xorParams, wrong);
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/A=0, B=1/);
  });

  it("an out-of-palette gate and a too-large circuit are rejected with named reasons", () => {
    const outOfPalette = { gates: [{ id: "g0", type: "XOR" as const, inputs: ["A", "B"] }], output: "g0" };
    expect(circuit.grade(xorParams, outOfPalette).feedback).toMatch(/isn't in the allowed palette/);
    const tooMany = {
      gates: Array.from({ length: 6 }, (_, i) => ({ id: `g${i}`, type: "NOT" as const, inputs: [i === 0 ? "A" : `g${i - 1}`] })),
      output: "g5",
    };
    expect(circuit.grade(xorParams, tooMany).feedback).toMatch(/more than the limit/);
  });

  it("strict schemas", () => {
    expect(audit(circuit.paramsSchema).errors).toEqual([]);
  });
});

// ---------------------------------------------------------------- builder.molecule

const ch4Params = { atoms: [{ element: "C" as const, count: 1 }, { element: "H" as const, count: 4 }], target: "CH4" };
const h2oParams = { atoms: [{ element: "O" as const, count: 1 }, { element: "H" as const, count: 2 }], target: "H2O" };

describe("builder.molecule", () => {
  it("valid params (H2O, CH4) pass check", () => {
    expect(molecule.check(h2oParams)).toEqual([]);
    expect(molecule.check(ch4Params)).toEqual([]);
  });

  it("rejects: inventory not matching the target, and a target with no valid single-bonded tree", () => {
    const badInventory = { atoms: [{ element: "C" as const, count: 1 }, { element: "H" as const, count: 3 }], target: "CH4" };
    expect(molecule.check(badInventory).join(" ")).toMatch(/needs 4/);
    const badTarget = { atoms: [{ element: "O" as const, count: 2 }], target: "O2" }; // needs a double bond
    expect(molecule.check(badTarget).join(" ")).toMatch(/no single-bonded tree/);
  });

  it("resolve + solutionInput passes grade", () => {
    const sol = molecule.resolve(ch4Params);
    expect(molecule.grade(ch4Params, molecule.solutionInput(ch4Params, sol)).correct).toBe(true);
  });

  it("an over-bonded carbon is rejected with the atom named", () => {
    const overBonded = {
      atoms: [
        { id: "a0", element: "C" as const },
        { id: "a1", element: "H" as const },
        { id: "a2", element: "H" as const },
        { id: "a3", element: "H" as const },
        { id: "a4", element: "H" as const },
        { id: "a5", element: "H" as const },
      ],
      bonds: [
        { a: "a0", b: "a1", order: 1 },
        { a: "a0", b: "a2", order: 1 },
        { a: "a0", b: "a3", order: 1 },
        { a: "a0", b: "a4", order: 1 },
        { a: "a0", b: "a5", order: 1 },
      ],
    };
    const params = { atoms: [{ element: "C" as const, count: 1 }, { element: "H" as const, count: 5 }], target: "CH5" };
    const miss = molecule.grade(params, overBonded);
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/"a0" \(C\)/);
    expect(miss.feedback).toMatch(/over-bonded/);
  });

  it("a disconnected molecule (every atom individually satisfied, but two separate pieces) is rejected", () => {
    const h4Params = { atoms: [{ element: "H" as const, count: 4 }], target: "H4" };
    const disconnected = {
      atoms: [
        { id: "h1", element: "H" as const },
        { id: "h2", element: "H" as const },
        { id: "h3", element: "H" as const },
        { id: "h4", element: "H" as const },
      ],
      bonds: [
        { a: "h1", b: "h2", order: 1 },
        { a: "h3", b: "h4", order: 1 },
      ], // each H's valence is satisfied, but the molecule splits into two pieces
    };
    const miss = molecule.grade(h4Params, disconnected);
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/isn't bonded to the rest/);
  });

  it("strict schemas", () => {
    expect(audit(molecule.paramsSchema).errors).toEqual([]);
  });
});

// ---------------------------------------------------------------- builder.genetics

const bbCrossRatio = {
  trait: "flower color",
  dominantAllele: "B",
  recessiveAllele: "b",
  dominantPhenotype: "purple flowers",
  recessivePhenotype: "white flowers",
  parent1: "Bb",
  parent2: "Bb",
  ask: "ratio" as const,
};
const bbCrossSquare = { ...bbCrossRatio, ask: "square" as const };

describe("builder.genetics", () => {
  it("valid params (Bb x Bb, both ask modes) pass check", () => {
    expect(genetics.check(bbCrossRatio)).toEqual([]);
    expect(genetics.check(bbCrossSquare)).toEqual([]);
  });

  it("rejects: mismatched allele letters, and a malformed parent genotype", () => {
    const mismatched = { ...bbCrossRatio, dominantAllele: "B", recessiveAllele: "r" };
    expect(genetics.check(mismatched).join(" ")).toMatch(/same letter/);
    const badParent = { ...bbCrossRatio, parent1: "BX" };
    expect(genetics.check(badParent).join(" ")).toMatch(/parent1/);
  });

  it("Bb x Bb resolves to a 3/4 dominant ratio, and solutionInput passes grade for both ask modes", () => {
    const sol = genetics.resolve(bbCrossRatio);
    expect(sol.fraction).toBe("3/4");
    expect(genetics.grade(bbCrossRatio, genetics.solutionInput(bbCrossRatio, sol)).correct).toBe(true);
    const solSquare = genetics.resolve(bbCrossSquare);
    expect(solSquare.cells.sort()).toEqual(["BB", "Bb", "Bb", "bb"].sort());
    expect(genetics.grade(bbCrossSquare, genetics.solutionInput(bbCrossSquare, solSquare)).correct).toBe(true);
  });

  it("a wrong square cell and a wrong ratio give informative feedback", () => {
    const missSquare = genetics.grade(bbCrossSquare, { cells: ["bb", "Bb", "Bb", "bb"], dominantFraction: null });
    expect(missSquare.correct).toBe(false);
    expect(missSquare.feedback).toMatch(/row 1, col 1/);
    const missRatio = genetics.grade(bbCrossRatio, { cells: null, dominantFraction: "1/2" });
    expect(missRatio.correct).toBe(false);
    expect(missRatio.feedback).toMatch(/recount/);
  });

  it("blind round-trip for both ask modes", () => {
    const view = genetics.present(bbCrossSquare, 1);
    const input = genetics.blind!.toInput(bbCrossSquare, view, { cells: ["BB", "Bb", "Bb", "bb"], dominantFraction: null });
    expect(genetics.grade(bbCrossSquare, input).correct).toBe(true);
  });

  it("strict schemas", () => {
    expect(audit(genetics.paramsSchema).errors).toEqual([]);
    expect(audit(genetics.blind!.schema).errors).toEqual([]);
  });
});

// ---------------------------------------------------------------- builder.program

const gridParams: z.infer<typeof program.paramsSchema> = {
  grid: ["S....", "#....", "#....", "#....", "....G"],
  commands: ["forward", "left", "right"],
  maxBlocks: 12,
  mustCollectGems: false,
};

describe("builder.program", () => {
  it("valid params (5x5 grid, one turn) pass check", () => {
    expect(program.check(gridParams)).toEqual([]);
  });

  it("rejects: a grid with no goal, and a budget too small for the shortest path", () => {
    const noGoal = { ...gridParams, grid: ["S....", "#....", "#....", "#....", "....."] };
    expect(program.check(noGoal).join(" ")).toMatch(/exactly one S and one G/);
    const tooTight = { ...gridParams, maxBlocks: 3 };
    expect(program.check(tooTight).join(" ")).toMatch(/maxBlocks limit/);
  });

  it("resolve + solutionInput passes grade", () => {
    const sol = program.resolve(gridParams);
    expect(program.grade(gridParams, program.solutionInput(gridParams, sol)).correct).toBe(true);
  });

  it("hitting a wall and using too many blocks give informative feedback", () => {
    const hitsWall = program.grade(gridParams, { program: ["forward", "forward"] }); // S faces up, row 0 top: forward walks off the grid
    expect(hitsWall.correct).toBe(false);
    expect(hitsWall.feedback).toMatch(/hit a wall/);
    const tooManyBlocks = program.grade(gridParams, { program: Array(13).fill("left") });
    expect(tooManyBlocks.correct).toBe(false);
    expect(tooManyBlocks.feedback).toMatch(/more than the limit/);
  });

  it("strict schemas", () => {
    expect(audit(program.paramsSchema).errors).toEqual([]);
  });
});

// ---------------------------------------------------------------- builder.electron_config

const feParams = { element: "Iron", atomicNumber: 26 };

describe("builder.electron_config", () => {
  it("valid params pass check", () => {
    expect(electron_config.check(feParams)).toEqual([]);
  });

  it("rejects: the two Aufbau exceptions, and an empty element name", () => {
    expect(electron_config.check({ ...feParams, atomicNumber: 24 }).join(" ")).toMatch(/Aufbau exceptions/);
    expect(electron_config.check({ ...feParams, atomicNumber: 29 }).join(" ")).toMatch(/Aufbau exceptions/);
    expect(electron_config.check({ ...feParams, element: "  " }).join(" ")).toMatch(/element must not be empty/);
  });

  it("Fe resolves to 1s2 2s2 2p6 3s2 3p6 4s2 3d6, and solutionInput passes grade", () => {
    const sol = electron_config.resolve(feParams);
    expect(sol.configString).toBe("1s2 2s2 2p6 3s2 3p6 4s2 3d6");
    expect(electron_config.grade(feParams, electron_config.solutionInput(feParams, sol)).correct).toBe(true);
  });

  it("an over-filled subshell and an out-of-order subshell are named", () => {
    const overFilled = electron_config.grade(feParams, { config: "1s2 2s2 2p8 3s2 3p6 4s2 3d6" });
    expect(overFilled.correct).toBe(false);
    expect(overFilled.feedback).toMatch(/Pauli exclusion/);
    const outOfOrder = electron_config.grade(feParams, { config: "1s2 2s2 2p6 3s2 3p6 3d6 4s2" });
    expect(outOfOrder.correct).toBe(false);
    expect(outOfOrder.feedback).toMatch(/Aufbau order/);
  });

  it("blind round-trip", () => {
    const view = electron_config.present(feParams, 0);
    const input = electron_config.blind!.toInput(feParams, view, { config: "1s2 2s2 2p6 3s2 3p6 4s2 3d6" });
    expect(electron_config.grade(feParams, input).correct).toBe(true);
  });

  it("strict schemas", () => {
    expect(audit(electron_config.paramsSchema).errors).toEqual([]);
    expect(audit(electron_config.blind!.schema).errors).toEqual([]);
  });
});

// ---------------------------------------------------------------- builder.tiles

const measureParams = {
  rows: 1,
  cols: 4,
  pieces: [
    { id: "quarter", label: "Quarter note", cells: 1 },
    { id: "half", label: "Half note", cells: 2 },
    { id: "whole", label: "Whole note", cells: 4 },
  ],
  rules: [{ kind: "row_sum_equals" as const, value: "4" }],
  target: "",
};

describe("builder.tiles", () => {
  it("valid params (a 4-beat measure) pass check", () => {
    expect(tiles.check(measureParams)).toEqual([]);
  });

  it("rejects: a duplicate piece id, and a rule value that isn't a number", () => {
    const dup = { ...measureParams, pieces: [...measureParams.pieces, { id: "quarter", label: "Dup", cells: 1 }] };
    expect(tiles.check(dup).join(" ")).toMatch(/unique/);
    const badValue = { ...measureParams, rules: [{ kind: "row_sum_equals" as const, value: "four" }] };
    expect(tiles.check(badValue).join(" ")).toMatch(/non-negative integer/);
  });

  it("resolve + solutionInput passes grade", () => {
    const sol = tiles.resolve(measureParams);
    expect(tiles.grade(measureParams, tiles.solutionInput(measureParams, sol)).correct).toBe(true);
  });

  it("a wrong-sum row and an unknown piece id give informative feedback", () => {
    const wrongSum = tiles.grade(measureParams, { grid: ["quarter half . ."] });
    expect(wrongSum.correct).toBe(false);
    expect(wrongSum.feedback).toMatch(/row 1 sums to 3/);
    const badToken = tiles.grade(measureParams, { grid: ["eighth . . ."] });
    expect(badToken.correct).toBe(false);
    expect(badToken.feedback).toMatch(/isn't one of the available piece ids/);
  });

  it("strict schemas", () => {
    expect(audit(tiles.paramsSchema).errors).toEqual([]);
  });
});

// ---------------------------------------------------------------- builder.sentence

const sentenceParams = {
  tiles: ["Yo", "como", "una", "manzana"],
  accepted: [["Yo", "como", "una", "manzana"]],
  rules: ["subject-verb-object order"],
};

describe("builder.sentence", () => {
  it("valid params (a 4-word Spanish sentence) pass check", () => {
    expect(sentence.check(sentenceParams)).toEqual([]);
  });

  it("rejects: duplicate tile texts, and an accepted ordering that isn't a permutation of the tiles", () => {
    const dupTiles = { ...sentenceParams, tiles: ["Yo", "Yo", "una", "manzana"] };
    expect(sentence.check(dupTiles).join(" ")).toMatch(/distinct texts/);
    const badAccepted = { ...sentenceParams, accepted: [["Yo", "come", "una", "manzana"]] };
    expect(sentence.check(badAccepted).join(" ")).toMatch(/reordering of exactly the given tiles/);
  });

  it("resolve + solutionInput passes grade", () => {
    const sol = sentence.resolve(sentenceParams);
    expect(sentence.grade(sentenceParams, sentence.solutionInput(sentenceParams, sol)).correct).toBe(true);
  });

  it("two wrong orderings give the first departure position", () => {
    const missFirst = sentence.grade(sentenceParams, { order: ["como", "Yo", "una", "manzana"] });
    expect(missFirst.correct).toBe(false);
    expect(missFirst.feedback).toMatch(/position 1/);
    const missMissingTile = sentence.grade(sentenceParams, { order: ["Yo", "como", "una", "Yo"] });
    expect(missMissingTile.correct).toBe(false);
    expect(missMissingTile.feedback).toMatch(/exactly once/);
  });

  it("blind round-trip", () => {
    const view = sentence.present(sentenceParams, 2);
    const positions = sentenceParams.accepted[0].map((text) => (view as { tiles: string[] }).tiles.indexOf(text));
    const input = sentence.blind!.toInput(sentenceParams, view, { order: positions });
    expect(sentence.grade(sentenceParams, input).correct).toBe(true);
  });

  it("strict schemas", () => {
    expect(audit(sentence.paramsSchema).errors).toEqual([]);
    expect(audit(sentence.blind!.schema).errors).toEqual([]);
  });
});
