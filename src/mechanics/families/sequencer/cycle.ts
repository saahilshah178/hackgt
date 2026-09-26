import { z } from "zod";
import { defineMode } from "../../types";
import { shuffleNotIdentity } from "../../util";

/*
 * sequencer · cycle: stages in cycle order, rotation-invariant grading in the given direction. Decoys
 * fail. Cards: cycle_wheel, krebs_wheel, rock_cycle_wheel, water_cycle_wheel, business_cycle_wheel,
 * fifths_wheel.
 */

const Params = z.object({
  stages: z
    .array(z.string().describe("One stage, under 90 characters"))
    .min(3)
    .max(8)
    .describe("The stages, in cycle order (any stage may be 'first' since a cycle has no start; the game rotates for grading)"),
  decoys: z.array(z.string()).min(0).max(2).describe("0-2 plausible stages that do NOT belong (use an empty array for none)"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  order: string[]; // keys s0..sN, in cycle order
}
interface Input {
  keys: string[];
}
interface View {
  slots: number;
  planks: { key: string; text: string }[];
  circular: true;
}

const stageKey = (i: number) => `s${i}`;
const decoyKey = (i: number) => `d${i}`;

function solve(p: Params): Solution {
  return { order: p.stages.map((_, i) => stageKey(i)) };
}

function textForKey(p: Params, key: string): string {
  const i = Number(key.slice(1));
  return (key.startsWith("d") ? p.decoys[i] : p.stages[i]) ?? key;
}

/** True when `keys` is some rotation of `order` (same cyclic direction, any starting point). */
function isRotation(order: string[], keys: string[]): boolean {
  const n = order.length;
  if (keys.length !== n) return false;
  if (new Set(keys).size !== n) return false;
  for (let start = 0; start < n; start++) {
    let ok = true;
    for (let i = 0; i < n; i++) {
      if (keys[i] !== order[(start + i) % n]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

export const cycle = defineMode({
  id: "cycle",
  name: "Cycle",
  implemented: true,
  blindSolvable: true,
  widget: "order",
  knowledgeTypes: ["sequence", "system"],
  directorBlurb:
    "The player places stages of a cyclic process around a ring; any rotation is correct as long as the direction matches. Cycles, loops, repeating systems.",
  authoringGuide: [
    "List the stages in cycle order, starting anywhere; the game shuffles them and accepts any rotation.",
    "Each stage must name what makes the NEXT stage happen, so the direction is unambiguous.",
    "Decoys should be tempting but wrong stages (a step from a different cycle, or reversed causation), not nonsense.",
    "Placeholders available: {{count}}. Naming a specific stage would give away a fixed 'start', so avoid it.",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const norm = (s: string) => s.trim().toLowerCase();
    const all = [...p.stages, ...p.decoys].map(norm);
    if (new Set(all).size !== all.length) problems.push("stages and decoys must all be distinct");
    [...p.stages, ...p.decoys].forEach((s, i) => {
      if (s.length > 110) problems.push(`item ${i} is ${s.length} chars; keep stages under 90`);
    });
    return problems;
  },
  resolve: solve,
  templateVars(p) {
    return { count: String(p.stages.length) };
  },
  answerVars: [],
  present(p, seed): View {
    const planks = [
      ...p.stages.map((text, i) => ({ key: stageKey(i), text })),
      ...p.decoys.map((text, i) => ({ key: decoyKey(i), text })),
    ];
    return { slots: p.stages.length, planks: shuffleNotIdentity(planks, seed), circular: true };
  },
  grade(p, input: Input) {
    const { order } = solve(p);
    if (input.keys.length !== order.length) return { correct: false, feedback: `Place all ${order.length} stages around the ring.` };
    const decoy = input.keys.find((k) => k.startsWith("d"));
    if (decoy) return { correct: false, feedback: `"${textForKey(p, decoy)}" isn't part of this cycle.` };
    if (isRotation(order, input.keys)) return { correct: true, feedback: "The ring locks into its cycle." };

    // Find the first stage in the player's ring whose successor doesn't match its true successor.
    const n = order.length;
    const trueSuccessor = new Map(order.map((k, i) => [k, order[(i + 1) % n]]));
    let badIndex = -1;
    for (let i = 0; i < input.keys.length; i++) {
      const cur = input.keys[i];
      const next = input.keys[(i + 1) % input.keys.length];
      if (trueSuccessor.get(cur) !== next) {
        badIndex = i;
        break;
      }
    }
    const stage = badIndex >= 0 ? textForKey(p, input.keys[badIndex]) : textForKey(p, input.keys[0]);
    return { correct: false, feedback: `What comes right after "${stage}" is wrong. What does that stage actually feed into?` };
  },
  solutionInput: (_p, s) => ({ keys: s.order }),
  blind: {
    schema: z.object({
      order: z
        .array(z.number().int().min(0).max(9))
        .min(3)
        .max(8)
        .describe("Positions (0-based) of the planks shown, in cycle order starting anywhere; leave out any plank that doesn't belong"),
    }),
    describe: (p, view: View) =>
      `${view.slots} stages in a cycle (any starting point is fine). Planks shown:\n${view.planks.map((pl, i) => `${i}. ${pl.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => {
      const o = out as { order: number[] };
      return { keys: o.order.map((i) => view.planks[i]?.key ?? "?") };
    },
  },
});
