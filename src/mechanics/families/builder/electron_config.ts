import { z } from "zod";
import { defineMode } from "../../types";

/*
 * builder · electron_config: the player writes an electron configuration ("1s2 2s2 2p6 ...") for a given
 * atomic number. `resolve` fills subshells in the standard Aufbau (n+l) order up to 4p, which covers every
 * atomic number 1-36 except the two classic exceptions (Cr, Cu), which `check` rejects outright to keep
 * this mode's Aufbau-only model correct. `grade` checks capacity (Pauli), the running electron total, and
 * Aufbau order, in that priority, and names whichever rule the player's config breaks first. Card:
 * orbital_filling.
 *
 * Input (widget "build"): { config: string }, e.g. "1s2 2s2 2p6 3s2 3p6 4s2 3d6".
 */

const Params = z.object({
  element: z.string().describe('The element name, e.g. "Iron"'),
  atomicNumber: z.number().int().min(1).max(36).describe("The element's atomic number (electrons in the neutral atom)"),
});
type Params = z.infer<typeof Params>;

type SubshellLetter = "s" | "p" | "d" | "f";
interface Term {
  n: number;
  l: SubshellLetter;
  count: number;
}
interface Input {
  config: string;
}
interface Solution {
  terms: Term[];
  configString: string;
}
interface View {
  element: string;
  atomicNumber: number;
}

const CAPACITY: Record<SubshellLetter, number> = { s: 2, p: 6, d: 10, f: 14 };

/** Standard Aufbau (n+l, then n) filling order, far enough to cover every Z up to 36 (Kr = ...4p6). */
const AUFBAU_ORDER: readonly [number, SubshellLetter][] = [
  [1, "s"],
  [2, "s"],
  [2, "p"],
  [3, "s"],
  [3, "p"],
  [4, "s"],
  [3, "d"],
  [4, "p"],
];

function fillConfig(atomicNumber: number): Term[] {
  const terms: Term[] = [];
  let remaining = atomicNumber;
  for (const [n, l] of AUFBAU_ORDER) {
    if (remaining <= 0) break;
    const count = Math.min(CAPACITY[l], remaining);
    terms.push({ n, l, count });
    remaining -= count;
  }
  return terms;
}

function termString(t: Term): string {
  return `${t.n}${t.l}${t.count}`;
}

function solve(p: Params): Solution {
  const terms = fillConfig(p.atomicNumber);
  return { terms, configString: terms.map(termString).join(" ") };
}

export const electron_config = defineMode({
  id: "electron_config",
  name: "Electron configuration",
  implemented: true,
  blindSolvable: true,
  widget: "build",
  knowledgeTypes: ["procedure", "spatial"],
  directorBlurb:
    "The player writes an element's electron configuration by filling subshells in energy order. Aufbau principle, Pauli exclusion, electron configuration notation.",
  authoringGuide: [
    'Give the element name and its atomicNumber (1-36). Don\'t write the configuration yourself; code fills it via the Aufbau order.',
    "Avoid atomic numbers 24 (chromium) and 29 (copper): both are classic exceptions to simple Aufbau filling and aren't modeled here.",
    "Placeholders: {{config}} (the full answer string), {{atomicNumber}}: last hint and debrief only.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    if (!p.element.trim()) problems.push("element must not be empty");
    if (p.atomicNumber === 24 || p.atomicNumber === 29) {
      problems.push("atomic number 24 (Cr) and 29 (Cu) are Aufbau exceptions; pick a different element");
    }
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { config: s.configString, atomicNumber: String(p.atomicNumber) };
  },
  answerVars: ["config"],
  present(p): View {
    return { element: p.element, atomicNumber: p.atomicNumber };
  },
  grade(p, input: Input) {
    const solution = fillConfig(p.atomicNumber);
    const tokens = input.config.trim().split(/\s+/).filter(Boolean);
    const parsed: Term[] = [];
    for (const tok of tokens) {
      const m = /^(\d+)([spdf])(\d+)$/.exec(tok);
      if (!m) {
        return { correct: false, feedback: `"${tok}" doesn't look like a subshell (shell number, letter, electron count, e.g. "3p6").` };
      }
      parsed.push({ n: parseInt(m[1], 10), l: m[2] as SubshellLetter, count: parseInt(m[3], 10) });
    }
    for (const t of parsed) {
      const cap = CAPACITY[t.l];
      if (t.count <= 0) return { correct: false, feedback: `"${termString(t)}" lists zero or fewer electrons; drop empty subshells instead of listing them.` };
      if (t.count > cap) {
        return { correct: false, feedback: `"${termString(t)}" packs more electrons than a ${t.l} subshell can hold (max ${cap}): that violates the Pauli exclusion principle.` };
      }
    }
    const total = parsed.reduce((a, b) => a + b.count, 0);
    if (total !== p.atomicNumber) {
      return { correct: false, feedback: `Your configuration totals ${total} electrons, but ${p.element} (Z = ${p.atomicNumber}) needs ${p.atomicNumber}.` };
    }
    const n = Math.max(parsed.length, solution.length);
    for (let i = 0; i < n; i++) {
      const want = solution[i];
      const got = parsed[i];
      if (!want && got) {
        return { correct: false, feedback: `"${termString(got)}" is extra: ${p.element} only needs ${solution.length} subshell${solution.length === 1 ? "" : "s"} to reach ${p.atomicNumber} electrons.` };
      }
      if (want && !got) {
        const prior = i > 0 ? termString(parsed[i - 1]) : "the start";
        return { correct: false, feedback: `Your configuration is missing a subshell after ${prior}; Aufbau order isn't finished yet.` };
      }
      if (want && got && (want.n !== got.n || want.l !== got.l || want.count !== got.count)) {
        return {
          correct: false,
          feedback: `"${termString(got)}" at position ${i + 1} is out of Aufbau order, or has the wrong electron count; fill subshells by increasing energy, not increasing shell number.`,
        };
      }
    }
    return { correct: true, feedback: "Every subshell is filled in Aufbau order with the correct electron counts." };
  },
  solutionInput: (_p, s) => ({ config: s.configString }),
  blind: {
    schema: z.object({ config: z.string().describe('The full electron configuration, e.g. "1s2 2s2 2p6 3s2 3p6 4s2 3d6"') }),
    describe: (p, view: View) => `Write the ground-state electron configuration for ${view.element} (Z = ${p.atomicNumber}).`,
    toInput: (_p, _view, out) => ({ config: (out as { config: string }).config }),
  },
});
