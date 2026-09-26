import { z } from "zod";
import { defineMode } from "../../types";
import { parseFormula } from "../balance/chem_equation";

/*
 * builder · molecule: the player assembles an inventory of atoms into a molecule matching a target
 * formula, obeying standard valence. `resolve` builds a linear heavy-atom-chain skeleton (a tree) and
 * saturates every remaining valence slot with hydrogen; that's the "simple case" this mode supports, so
 * `check` rejects targets the chain can't realize (needs a double/triple bond, or valence arithmetic
 * doesn't add up). `grade` validates the player's own graph directly: multiset, valence, connectivity.
 * Card: molecule_builder.
 *
 * Input (widget "build"): { atoms: [{ id, element }], bonds: [{ a: id, b: id, order: 1|2|3 }] }
 * View: { atoms (inventory), target }
 */

const Element = z.enum(["H", "C", "N", "O", "S", "P", "Cl", "F", "Br"]);
type ElementName = z.infer<typeof Element>;

const VALENCE: Record<ElementName, number> = { H: 1, C: 4, N: 3, O: 2, S: 2, P: 3, Cl: 1, F: 1, Br: 1 };

const Params = z.object({
  atoms: z
    .array(z.object({ element: Element, count: z.number().int().min(1).max(8) }))
    .min(1)
    .max(9)
    .describe("The atom inventory available to build with; each element listed once with how many are available"),
  target: z.string().describe('The molecular formula to build, e.g. "CH4", "H2O", "C2H6O". Standard capitalization and subscripts, no charges'),
});
type Params = z.infer<typeof Params>;

interface StructAtom {
  id: string;
  element: ElementName;
}
interface StructBond {
  a: string;
  b: string;
  order: number;
}
interface Input {
  atoms: { id: string; element: ElementName }[];
  bonds: { a: string; b: string; order: number }[];
}
interface Solution {
  target: Record<string, number>;
  structure: { atoms: StructAtom[]; bonds: StructBond[] };
}
interface View {
  atoms: { element: ElementName; count: number }[];
  target: string;
}

function isElement(e: string): e is ElementName {
  return e in VALENCE;
}

/** Builds a linear heavy-atom chain saturated with hydrogen. Null when no such tree matches the target's valence. */
function chainStructure(target: Record<string, number>): { atoms: StructAtom[]; bonds: StructBond[] } | null {
  const heavyElems = Object.keys(target).filter((e) => e !== "H");
  if (heavyElems.some((e) => !isElement(e))) return null;
  const heavyList: ElementName[] = [];
  for (const e of heavyElems) for (let i = 0; i < target[e]; i++) heavyList.push(e as ElementName);
  const hCount = target["H"] ?? 0;

  const atoms: StructAtom[] = [];
  const bonds: StructBond[] = [];
  let counter = 0;
  const nextId = () => `a${counter++}`;

  if (heavyList.length === 0) {
    if (hCount === 2) {
      const id1 = nextId();
      const id2 = nextId();
      atoms.push({ id: id1, element: "H" }, { id: id2, element: "H" });
      bonds.push({ a: id1, b: id2, order: 1 });
      return { atoms, bonds };
    }
    return null; // a single H atom (or any other H count) has no valid bonded structure
  }

  const heavyIds = heavyList.map((el) => {
    const id = nextId();
    atoms.push({ id, element: el });
    return id;
  });
  for (let i = 0; i < heavyIds.length - 1; i++) bonds.push({ a: heavyIds[i], b: heavyIds[i + 1], order: 1 });

  const remaining = heavyIds.map((_, i) => {
    const degree = heavyIds.length === 1 ? 0 : i === 0 || i === heavyIds.length - 1 ? 1 : 2;
    return VALENCE[heavyList[i]] - degree;
  });
  if (remaining.some((r) => r < 0)) return null;
  const totalRemaining = remaining.reduce((a, b) => a + b, 0);
  if (totalRemaining !== hCount) return null;

  heavyIds.forEach((id, i) => {
    for (let k = 0; k < remaining[i]; k++) {
      const hid = nextId();
      atoms.push({ id: hid, element: "H" });
      bonds.push({ a: id, b: hid, order: 1 });
    }
  });
  return { atoms, bonds };
}

function inventoryCounts(p: Params): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of p.atoms) counts[a.element] = (counts[a.element] ?? 0) + a.count;
  return counts;
}

function solve(p: Params): Solution {
  const target = parseFormula(p.target);
  if (target === null) throw new Error(`builder.molecule: "${p.target}" doesn't parse as a molecular formula`);
  const structure = chainStructure(target);
  if (structure === null) {
    throw new Error(`builder.molecule: no single-bonded tree of these atoms reaches valid valence for "${p.target}"`);
  }
  return { target, structure };
}

export const molecule = defineMode({
  id: "molecule",
  name: "Molecule",
  implemented: true,
  blindSolvable: false,
  widget: "build",
  knowledgeTypes: ["procedure", "spatial"],
  directorBlurb:
    "The player bonds an inventory of atoms into a molecule matching a target formula without breaking anyone's valence. Bonding, valence, molecular structure.",
  authoringGuide: [
    'List the atom inventory (element + how many available) and the target formula, e.g. "CH4", "H2O", "C2H6O". Standard capitalization, no charges or states of matter.',
    "The inventory's element counts must exactly match the target formula's element counts; don't include spare atoms.",
    "Keep targets to simple single-bonded structures (a chain of heavy atoms saturated with hydrogen): code proves one exists before the encounter ships. Molecules that need a double or triple bond (O2, CO2) aren't supported yet.",
    "Standard valences: H1, C4, N3, O2, S2, P3, Cl1, F1, Br1. Don't write the bonds yourself; code builds and grades against them.",
    "Placeholders: {{target}}, {{atomCount}}.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const elems = p.atoms.map((a) => a.element);
    if (new Set(elems).size !== elems.length) problems.push("list each element once in atoms, with its total count");
    const target = parseFormula(p.target);
    if (target === null) {
      problems.push(`"${p.target}" doesn't parse as a molecular formula`);
      return problems;
    }
    const inv = inventoryCounts(p);
    const allElems = new Set([...Object.keys(target), ...Object.keys(inv)]);
    for (const el of allElems) {
      if ((inv[el] ?? 0) !== (target[el] ?? 0)) {
        problems.push(`atoms has ${inv[el] ?? 0} ${el}, but target "${p.target}" needs ${target[el] ?? 0}`);
      }
    }
    if (problems.length > 0) return problems;
    if (Object.keys(target).some((el) => !isElement(el))) {
      problems.push(`target "${p.target}" uses an element outside H, C, N, O, S, P, Cl, F, Br`);
      return problems;
    }
    if (chainStructure(target) === null) {
      problems.push(`no single-bonded tree of these atoms satisfies standard valence for "${p.target}"; pick a simpler target or adjust the inventory`);
    }
    return problems;
  },
  resolve: solve,
  templateVars(p) {
    return { target: p.target, atomCount: String(p.atoms.reduce((a, b) => a + b.count, 0)) };
  },
  answerVars: [],
  present(p): View {
    return { atoms: p.atoms.map((a) => ({ element: a.element, count: a.count })), target: p.target };
  },
  grade(p, input: Input) {
    const target = parseFormula(p.target)!;
    const counts: Record<string, number> = {};
    for (const a of input.atoms) counts[a.element] = (counts[a.element] ?? 0) + 1;
    const allElems = new Set([...Object.keys(target), ...Object.keys(counts)]);
    for (const el of allElems) {
      if ((counts[el] ?? 0) !== (target[el] ?? 0)) {
        return {
          correct: false,
          feedback: `Your molecule has ${counts[el] ?? 0} ${el} atom(s), but ${p.target} needs ${target[el] ?? 0}.`,
        };
      }
    }
    const ids = input.atoms.map((a) => a.id);
    if (new Set(ids).size !== ids.length) return { correct: false, feedback: "Two atoms share the same id." };
    const idSet = new Set(ids);
    for (const b of input.bonds) {
      if (b.a === b.b) return { correct: false, feedback: `Atom "${b.a}" can't bond to itself.` };
      if (!idSet.has(b.a) || !idSet.has(b.b)) return { correct: false, feedback: "A bond references an atom that isn't in the molecule." };
    }
    const bondSum = new Map<string, number>(ids.map((id) => [id, 0]));
    for (const b of input.bonds) {
      bondSum.set(b.a, (bondSum.get(b.a) ?? 0) + b.order);
      bondSum.set(b.b, (bondSum.get(b.b) ?? 0) + b.order);
    }
    for (const a of input.atoms) {
      const need = VALENCE[a.element];
      const got = bondSum.get(a.id) ?? 0;
      if (got !== need) {
        return {
          correct: false,
          feedback: `Atom "${a.id}" (${a.element}) has ${got} total bond order but needs ${need}: it's ${got < need ? "under" : "over"}-bonded.`,
        };
      }
    }
    if (ids.length > 0) {
      const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
      for (const b of input.bonds) {
        adj.get(b.a)!.push(b.b);
        adj.get(b.b)!.push(b.a);
      }
      const seen = new Set([ids[0]]);
      const stack = [ids[0]];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        for (const nb of adj.get(cur) ?? []) {
          if (!seen.has(nb)) {
            seen.add(nb);
            stack.push(nb);
          }
        }
      }
      if (seen.size !== ids.length) {
        const stray = ids.find((id) => !seen.has(id))!;
        return { correct: false, feedback: `Atom "${stray}" isn't bonded to the rest of the molecule; every atom must connect into one structure.` };
      }
    }
    return { correct: true, feedback: `Every atom's bonds satisfy ${p.target}'s valence, and the molecule is one connected structure.` };
  },
  solutionInput: (_p, s) => ({ atoms: s.structure.atoms, bonds: s.structure.bonds }),
});
