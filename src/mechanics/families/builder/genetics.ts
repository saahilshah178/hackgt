import { z } from "zod";
import { defineMode } from "../../types";

/*
 * builder · genetics: a monohybrid Punnett square. `parent1`/`parent2` are 2-letter genotypes written with
 * `dominantAllele` (uppercase, e.g. "B") and `recessiveAllele` (lowercase, e.g. "b"). Code crosses each
 * gamete of parent1 (rows, in genotype order) against each gamete of parent2 (columns) to fill the square,
 * and derives the phenotype ratio from it. Card: punnett_forge. Fully computable from visible params, so
 * this mode is blind-solvable.
 *
 * Input (widget "build"): { cells: string[4] | null, dominantFraction: string | null } - whichever `ask`
 * calls for is set, the other is null. `cells` is row-major: parent1's two gametes as rows, parent2's as
 * columns.
 */

const Params = z.object({
  trait: z.string().describe('The trait being crossed, e.g. "flower color"'),
  dominantAllele: z.string().describe('The dominant allele, ONE uppercase letter, e.g. "B"'),
  recessiveAllele: z.string().describe('The recessive allele, the SAME letter lowercase, e.g. "b"'),
  dominantPhenotype: z.string().describe('What the dominant phenotype looks like, e.g. "purple flowers"'),
  recessivePhenotype: z.string().describe('What the recessive phenotype looks like, e.g. "white flowers"'),
  parent1: z.string().describe('Parent 1\'s genotype, two allele letters, e.g. "Bb"'),
  parent2: z.string().describe('Parent 2\'s genotype, two allele letters, e.g. "Bb"'),
  ask: z.enum(["square", "ratio"]).describe("square: fill in all 4 genotype boxes. ratio: give the fraction of offspring with the dominant phenotype"),
});
type Params = z.infer<typeof Params>;

interface Input {
  cells: string[] | null;
  dominantFraction: string | null;
}
interface Solution {
  cells: string[]; // row-major, length 4
  rowGametes: string[]; // parent1's two alleles, in order
  colGametes: string[]; // parent2's two alleles, in order
  dominantCount: number;
  fraction: string; // reduced, e.g. "3/4"
}
interface View {
  trait: string;
  dominantAllele: string;
  recessiveAllele: string;
  dominantPhenotype: string;
  recessivePhenotype: string;
  parent1: string;
  parent2: string;
  ask: "square" | "ratio";
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function reduceFraction(n: number, d: number): string {
  const g = gcd(n, d) || 1;
  return `${n / g}/${d / g}`;
}

function parseFractionValue(s: string): { n: number; d: number } | null {
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(s);
  if (!m) return null;
  const d = parseInt(m[2], 10);
  if (d === 0) return null;
  return { n: parseInt(m[1], 10), d };
}

function fractionsEqual(a: { n: number; d: number }, b: { n: number; d: number }): boolean {
  return a.n * b.d === b.n * a.d;
}

function validGenotype(s: string, dom: string, rec: string): boolean {
  return s.length === 2 && [...s].every((c) => c === dom || c === rec);
}

function canonGenotype(a: string, b: string, dom: string): string {
  const domCount = [a, b].filter((c) => c === dom).length;
  if (domCount === 2) return dom + dom; // both dominant alleles
  if (domCount === 0) return a + b; // both recessive alleles (a === b)
  return dom + ([a, b].find((c) => c !== dom) as string); // one of each
}

function isDominantPhenotype(genotype: string, dom: string): boolean {
  return genotype.includes(dom);
}

function normalizeCell(s: string, dom: string, rec: string): string | null {
  if (!validGenotype(s, dom, rec)) return null;
  return canonGenotype(s[0], s[1], dom);
}

function solve(p: Params): Solution {
  const rowGametes = [...p.parent1];
  const colGametes = [...p.parent2];
  const cells: string[] = [];
  for (const r of rowGametes) for (const c of colGametes) cells.push(canonGenotype(r, c, p.dominantAllele));
  const dominantCount = cells.filter((g) => isDominantPhenotype(g, p.dominantAllele)).length;
  return { cells, rowGametes, colGametes, dominantCount, fraction: reduceFraction(dominantCount, cells.length) };
}

export const genetics = defineMode({
  id: "genetics",
  name: "Genetics",
  implemented: true,
  blindSolvable: true,
  widget: "build",
  knowledgeTypes: ["procedure", "quantitative"],
  directorBlurb:
    "The player fills a Punnett square (or gives the resulting phenotype ratio) for a cross between two genotypes. Mendelian genetics, dominant/recessive alleles, phenotype ratios.",
  authoringGuide: [
    'Use ONE letter for the allele pair: dominantAllele uppercase (e.g. "B"), recessiveAllele the same letter lowercase (e.g. "b").',
    'Write parent1 and parent2 as 2-letter genotypes made only of those two letters, e.g. "Bb", "BB", "bb".',
    'ask="square" has the player fill all 4 boxes; ask="ratio" has them give the dominant-phenotype fraction like "3/4". Don\'t compute either yourself; code derives both from the genotypes.',
    "Placeholders: {{fraction}} (dominant-phenotype fraction), {{cellsAnswer}} (the 4 genotypes, comma-separated): last hint and debrief only.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (p.dominantAllele.length !== 1 || p.dominantAllele !== p.dominantAllele.toUpperCase()) {
      problems.push("dominantAllele must be a single uppercase letter");
    }
    if (p.recessiveAllele.length !== 1 || p.recessiveAllele !== p.recessiveAllele.toLowerCase()) {
      problems.push("recessiveAllele must be a single lowercase letter");
    }
    if (p.dominantAllele.toLowerCase() !== p.recessiveAllele.toLowerCase()) {
      problems.push("dominantAllele and recessiveAllele must be the same letter in different cases");
    }
    if (problems.length > 0) return problems;
    if (!validGenotype(p.parent1, p.dominantAllele, p.recessiveAllele)) {
      problems.push(`parent1 "${p.parent1}" must be two letters, only ${p.dominantAllele}/${p.recessiveAllele}`);
    }
    if (!validGenotype(p.parent2, p.dominantAllele, p.recessiveAllele)) {
      problems.push(`parent2 "${p.parent2}" must be two letters, only ${p.dominantAllele}/${p.recessiveAllele}`);
    }
    return problems;
  },
  resolve: solve,
  templateVars(_p, s) {
    return { fraction: s.fraction, cellsAnswer: s.cells.join(", ") };
  },
  answerVars: ["fraction", "cellsAnswer"],
  present(p): View {
    return {
      trait: p.trait,
      dominantAllele: p.dominantAllele,
      recessiveAllele: p.recessiveAllele,
      dominantPhenotype: p.dominantPhenotype,
      recessivePhenotype: p.recessivePhenotype,
      parent1: p.parent1,
      parent2: p.parent2,
      ask: p.ask,
    };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if (p.ask === "square") {
      const given = input.cells ?? [];
      if (given.length !== 4) return { correct: false, feedback: "Fill in all 4 boxes of the Punnett square." };
      for (let i = 0; i < 4; i++) {
        const norm = normalizeCell(given[i], p.dominantAllele, p.recessiveAllele);
        if (norm === null) {
          return { correct: false, feedback: `Box ${i + 1} must be two letters, only ${p.dominantAllele}/${p.recessiveAllele}.` };
        }
        if (norm !== s.cells[i]) {
          const row = Math.floor(i / 2);
          const col = i % 2;
          return {
            correct: false,
            feedback: `Box (row ${row + 1}, col ${col + 1}) should combine parent 1's gamete "${s.rowGametes[row]}" with parent 2's gamete "${s.colGametes[col]}", not "${given[i]}".`,
          };
        }
      }
      return { correct: true, feedback: "Every box in the square is correct." };
    }
    const givenFrac = input.dominantFraction ? parseFractionValue(input.dominantFraction) : null;
    if (!givenFrac) return { correct: false, feedback: 'Give the fraction in the form "n/d", e.g. "3/4".' };
    const wantFrac = parseFractionValue(s.fraction)!;
    if (fractionsEqual(givenFrac, wantFrac)) return { correct: true, feedback: "That's the right share of offspring with the dominant phenotype." };
    return {
      correct: false,
      feedback: `That fraction doesn't match this cross; recount how many of the 4 boxes show ${p.dominantPhenotype} versus ${p.recessivePhenotype}.`,
    };
  },
  solutionInput: (p, s) => ({
    cells: p.ask === "square" ? s.cells : null,
    dominantFraction: p.ask === "ratio" ? s.fraction : null,
  }),
  blind: {
    schema: z.object({
      cells: z
        .array(z.string())
        .min(4)
        .max(4)
        .nullable()
        .describe('For ask="square" only: the 4 genotypes in the square, row-major (parent1\'s two gametes as rows, parent2\'s as columns). Otherwise null.'),
      dominantFraction: z.string().nullable().describe('For ask="ratio" only: the fraction of offspring with the dominant phenotype, e.g. "3/4". Otherwise null.'),
    }),
    describe: (p, view: View) =>
      `Trait: ${view.trait}. ${p.dominantAllele} = ${view.dominantPhenotype} (dominant), ${p.recessiveAllele} = ${view.recessivePhenotype} (recessive).\n` +
      `Parent 1: ${view.parent1}. Parent 2: ${view.parent2}.\n` +
      (view.ask === "square" ? "Fill the 4-box Punnett square (parent 1's gametes as rows, parent 2's as columns)." : "Give the fraction of offspring with the dominant phenotype."),
    toInput: (_p, _view, out) => {
      const o = out as { cells: string[] | null; dominantFraction: string | null };
      return { cells: o.cells, dominantFraction: o.dominantFraction };
    },
  },
});
