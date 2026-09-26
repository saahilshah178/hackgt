import { z } from "zod";
import { defineMode } from "../../types";

/*
 * balance · chem_equation: the player sets integer coefficients so every element balances across a
 * chemical equation. Code parses each formula into an element count, solves the null space of the
 * element-balance matrix over exact fractions, and scales it to the smallest positive integers (<= 12).
 * Card: atom_conservation ★.
 */

const Params = z.object({
  reactants: z
    .array(z.string())
    .min(1)
    .max(4)
    .describe('Reactant formulas, e.g. "C3H8", "O2", "Ca(OH)2". No charges; parentheses and subscripts are fine'),
  products: z
    .array(z.string())
    .min(1)
    .max(4)
    .describe('Product formulas, same format as reactants, e.g. "CO2", "H2O", "Fe2O3"'),
});
type Params = z.infer<typeof Params>;

interface Solution {
  coefficients: number[]; // reactants then products, in order
  elements: string[];
  coefficientsLabel: string;
}

interface Input {
  coefficients: number[];
}

interface View {
  reactants: string[];
  products: string[];
}

// ---------------------------------------------------------------- formula parsing

/** Parses a chemical formula (elements, subscripts, nested parentheses; no charges). Null on a parse error. */
export function parseFormula(f: string): Record<string, number> | null {
  let i = 0;
  function parseNumber(): number | null {
    let s = "";
    while (i < f.length && /[0-9]/.test(f[i])) {
      s += f[i];
      i++;
    }
    return s === "" ? null : parseInt(s, 10);
  }
  function parseGroup(): Record<string, number> | null {
    const counts: Record<string, number> = {};
    while (i < f.length && f[i] !== ")") {
      if (f[i] === "(") {
        i++;
        const inner = parseGroup();
        if (inner === null) return null;
        if (f[i] !== ")") return null;
        i++;
        const mult = parseNumber() ?? 1;
        for (const [el, c] of Object.entries(inner)) counts[el] = (counts[el] ?? 0) + c * mult;
      } else if (/[A-Z]/.test(f[i])) {
        let el = f[i];
        i++;
        while (i < f.length && /[a-z]/.test(f[i])) {
          el += f[i];
          i++;
        }
        const c = parseNumber() ?? 1;
        counts[el] = (counts[el] ?? 0) + c;
      } else {
        return null;
      }
    }
    return counts;
  }
  if (f.trim().length === 0) return null;
  const result = parseGroup();
  if (result === null || i !== f.length) return null;
  return result;
}

// ---------------------------------------------------------------- exact-fraction linear algebra

interface Frac {
  n: bigint;
  d: bigint; // > 0, reduced
}

function gcdBig(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

function fr(n: bigint, d: bigint = 1n): Frac {
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  if (n === 0n) return { n: 0n, d: 1n };
  const g = gcdBig(n, d) || 1n;
  return { n: n / g, d: d / g };
}

const fadd = (a: Frac, b: Frac): Frac => fr(a.n * b.d + b.n * a.d, a.d * b.d);
const fsub = (a: Frac, b: Frac): Frac => fr(a.n * b.d - b.n * a.d, a.d * b.d);
const fmul = (a: Frac, b: Frac): Frac => fr(a.n * b.n, a.d * b.d);
const fdiv = (a: Frac, b: Frac): Frac => fr(a.n * b.d, a.d * b.n);
const fzero = (a: Frac): boolean => a.n === 0n;

/** Reduced row-echelon form over exact fractions. Returns the row-reduced matrix and its pivot columns. */
function rref(matrix: Frac[][]): { rows: Frac[][]; pivotCols: number[] } {
  const rows = matrix.map((r) => [...r]);
  const m = rows.length;
  const n = rows[0]?.length ?? 0;
  const pivotCols: number[] = [];
  let lead = 0;
  for (let r = 0; r < m && lead < n; r++) {
    let i = r;
    while (i < m && fzero(rows[i][lead])) {
      i++;
      if (i === m) {
        i = r;
        lead++;
        if (lead === n) return { rows, pivotCols };
      }
    }
    [rows[i], rows[r]] = [rows[r], rows[i]];
    const lv = rows[r][lead];
    rows[r] = rows[r].map((v) => fdiv(v, lv));
    for (let j = 0; j < m; j++) {
      if (j === r) continue;
      const factor = rows[j][lead];
      if (!fzero(factor)) rows[j] = rows[j].map((v, k) => fsub(v, fmul(factor, rows[r][k])));
    }
    pivotCols.push(lead);
    lead++;
  }
  return { rows, pivotCols };
}

function lcmBig(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return (a * b) / gcdBig(a, b);
}

function gcdAll(vals: bigint[]): bigint {
  return vals.reduce((g, v) => gcdBig(g, v), 0n) || 1n;
}

type BalanceResult =
  | { ok: true; coefficients: number[]; elements: string[] }
  | { ok: false; reason: "unbalanceable" | "underdetermined" | "too_large" | "mixed_sign" };

/**
 * Balances the element-count matrix: one free variable expected (a single balanced reaction, up to scale).
 * `reactantCount` species are reactants (positive in the balance equation); the rest are products (negative),
 * so the null space directly gives coefficients with reactant totals equal to product totals.
 */
function balance(species: Record<string, number>[], reactantCount: number): BalanceResult {
  const elements = Array.from(new Set(species.flatMap((m) => Object.keys(m))));
  const n = species.length;
  const matrix: Frac[][] = elements.map((el) => species.map((m, i) => fr(BigInt((m[el] ?? 0) * (i < reactantCount ? 1 : -1)))));
  const { rows, pivotCols } = rref(matrix);
  const freeCols = Array.from({ length: n }, (_, c) => c).filter((c) => !pivotCols.includes(c));
  if (freeCols.length === 0) return { ok: false, reason: "unbalanceable" };
  if (freeCols.length > 1) return { ok: false, reason: "underdetermined" };
  const freeCol = freeCols[0];
  const values: Frac[] = new Array(n).fill(null).map(() => fr(0n));
  values[freeCol] = fr(1n);
  pivotCols.forEach((pc, r) => {
    // rref row r: x[pc] + sum_{c=freeCol} rows[r][c] * x[c] = 0  =>  x[pc] = -rows[r][freeCol] * x[freeCol]
    values[pc] = fsub(fr(0n), fmul(rows[r][freeCol], values[freeCol]));
  });
  // Scale to integers via the LCM of denominators, then reduce by the GCD of numerators.
  let denomLcm = 1n;
  for (const v of values) denomLcm = lcmBig(denomLcm, v.d);
  const ints = values.map((v) => (v.n * (denomLcm / v.d)));
  const signs = new Set(ints.map((v) => (v === 0n ? 0 : v > 0n ? 1 : -1)));
  signs.delete(0);
  if (signs.size > 1) return { ok: false, reason: "mixed_sign" };
  const negate = signs.has(-1);
  const signed = ints.map((v) => (negate ? -v : v));
  if (signed.some((v) => v === 0n)) return { ok: false, reason: "unbalanceable" };
  const g = gcdAll(signed);
  const minimal = signed.map((v) => v / g);
  if (minimal.some((v) => v > 12n)) return { ok: false, reason: "too_large" };
  return { ok: true, coefficients: minimal.map((v) => Number(v)), elements };
}

function solve(p: Params): Solution {
  const parsed = [...p.reactants, ...p.products].map((f) => parseFormula(f));
  if (parsed.some((x) => x === null)) throw new Error("balance.chem_equation: a formula failed to parse");
  const result = balance(parsed as Record<string, number>[], p.reactants.length);
  if (!result.ok) throw new Error(`balance.chem_equation: ${result.reason}`);
  return { coefficients: result.coefficients, elements: result.elements, coefficientsLabel: result.coefficients.join(", ") };
}

export const chem_equation = defineMode({
  id: "chem_equation",
  name: "Chemical equation",
  implemented: true,
  blindSolvable: false,
  widget: "build",
  knowledgeTypes: ["quantitative", "system"],
  directorBlurb:
    "Reactant and product formulas; the player sets integer coefficients so every element balances. Balancing chemical equations, conservation of mass.",
  authoringGuide: [
    'Write formulas with standard capitalization and subscripts, e.g. "C3H8", "O2", "Ca(OH)2", "Fe2O3". No charges or states of matter.',
    "Pick reactants and products so the equation balances with whole-number coefficients no larger than 12.",
    "Don't write the coefficients yourself; code finds the smallest whole-number set that conserves every atom.",
    "Avoid a trivial equation (the same species on both sides) or one where every atom already balances 1:1.",
    "Placeholders: {{coefficients}} (the answer, comma-separated in reactants-then-products order): last hint and debrief only.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const all = [...p.reactants, ...p.products];
    const parsed = all.map((f) => parseFormula(f));
    parsed.forEach((m, i) => {
      if (m === null) problems.push(`"${all[i]}" doesn't parse as a chemical formula`);
    });
    if (problems.length > 0) return problems;
    const texts = all.map((f) => f.trim());
    if (new Set(texts).size !== texts.length) problems.push("reactants and products must all be distinct formulas");
    const reactantSet = [...p.reactants].sort().join("|");
    const productSet = [...p.products].sort().join("|");
    if (reactantSet === productSet) problems.push("reactants and products are the same set of species; nothing changes");
    const result = balance(parsed as Record<string, number>[], p.reactants.length);
    if (!result.ok) {
      switch (result.reason) {
        case "unbalanceable":
          problems.push("no combination of positive whole-number coefficients conserves every atom in this equation");
          break;
        case "underdetermined":
          problems.push("more than one independent way to balance this equation; simplify the species so exactly one balance exists");
          break;
        case "mixed_sign":
          problems.push("this equation cannot be balanced with all-positive coefficients; check the reactants and products");
          break;
        case "too_large":
          problems.push("the smallest balancing coefficients exceed 12; use simpler formulas or fewer species");
          break;
      }
    }
    return problems;
  },
  resolve: solve,
  templateVars(_p, s) {
    return { coefficients: s.coefficientsLabel };
  },
  answerVars: ["coefficients"],
  present(p): View {
    return { reactants: [...p.reactants], products: [...p.products] };
  },
  grade(p, input: Input) {
    const species = [...p.reactants, ...p.products];
    if (input.coefficients.length !== species.length) {
      return { correct: false, feedback: `Give exactly ${species.length} coefficients, one per formula.` };
    }
    if (input.coefficients.some((c) => !Number.isInteger(c) || c <= 0)) {
      return { correct: false, feedback: "Every coefficient must be a positive whole number." };
    }
    const parsed = species.map((f) => parseFormula(f)!);
    const elements = Array.from(new Set(parsed.flatMap((m) => Object.keys(m))));
    const nR = p.reactants.length;
    for (const el of elements) {
      let sumR = 0;
      let sumP = 0;
      parsed.forEach((m, i) => {
        const c = input.coefficients[i] * (m[el] ?? 0);
        if (i < nR) sumR += c;
        else sumP += c;
      });
      if (sumR !== sumP) {
        return {
          correct: false,
          feedback: `${el} isn't balanced: reactants have ${sumR} atom${sumR === 1 ? "" : "s"}, products have ${sumP}. Adjust the coefficients.`,
        };
      }
    }
    const s = solve(p);
    const isMinimal = s.coefficients.every((c, i) => c === input.coefficients[i]);
    if (isMinimal) return { correct: true, feedback: "Every atom balances with the smallest whole numbers: the reactor starts." };
    return {
      correct: false,
      feedback: "Every atom balances, but the coefficients aren't the smallest whole numbers; divide them all by their common factor.",
    };
  },
  solutionInput: (_p, s) => ({ coefficients: s.coefficients }),
});
