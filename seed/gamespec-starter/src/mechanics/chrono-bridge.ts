import { z } from "zod";
import { defineMechanic } from "./types";
import { shuffleNotIdentity } from "./util";

const Params = z.object({
  steps: z
    .array(z.string().describe("One step, under 90 characters"))
    .min(3)
    .max(7)
    .describe("The steps in the CORRECT order. The game shuffles them; never shuffle them yourself"),
  decoys: z
    .array(z.string())
    .min(0)
    .max(2)
    .describe("0-2 plausible steps that do NOT belong (use an empty array for none)"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  order: string[];
}
interface Input {
  keys: string[];
}
interface View {
  slots: number;
  planks: { key: string; text: string }[];
}

const stepKey = (i: number) => `s${i}`;
const decoyKey = (i: number) => `d${i}`;

function solve(p: Params): Solution {
  return { order: p.steps.map((_, i) => stepKey(i)) };
}

function textForKey(p: Params, key: string): string {
  const i = Number(key.slice(1));
  return (key.startsWith("d") ? p.decoys[i] : p.steps[i]) ?? key;
}

export const chronoBridge = defineMechanic({
  id: "chrono_bridge",
  name: "Chrono-Bridge",
  widget: "order",
  knowledgeTypes: ["sequence", "procedure"],
  implemented: true,
  directorBlurb:
    "The player places steps (planks, glyphs, timeline cards) in the right order; decoys don't belong. Processes, timelines, solution procedures.",
  authoringGuide: [
    "List the steps in the correct order; the game shuffles them.",
    "Each step must be unambiguous about its position (no two steps that could swap).",
    "Decoys should be tempting mistakes (a common wrong first move), not nonsense.",
    "Placeholders available: {{count}}, {{first}}, {{last}}. {{first}} gives away the start, so keep it out of the prompt and first hint.",
  ].join("\n"),
  genres: {
    dungeon: { sockets: ["door", "altar"], skin: "Glyph door pressed in process order" },
    platformer: { sockets: ["gap"], skin: "Bridge planks; the wrong order leaves a gap" },
    mystery: { sockets: ["corkboard"], skin: "Reconstruct the timeline on the corkboard" },
    puzzle: { sockets: ["goal_pad", "pipe"], skin: "Order parcels on a conveyor" },
  },
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const norm = (s: string) => s.trim().toLowerCase();
    const all = [...p.steps, ...p.decoys].map(norm);
    if (new Set(all).size !== all.length) problems.push("steps and decoys must all be distinct");
    [...p.steps, ...p.decoys].forEach((s, i) => {
      if (s.length > 110) problems.push(`item ${i} is ${s.length} chars; keep steps under 110`);
    });
    return problems;
  },
  resolve: solve,
  templateVars(p) {
    return { count: String(p.steps.length), first: p.steps[0], last: p.steps[p.steps.length - 1] };
  },
  answerVars: ["first"],
  present(p, seed): View {
    const planks = [
      ...p.steps.map((text, i) => ({ key: stepKey(i), text })),
      ...p.decoys.map((text, i) => ({ key: decoyKey(i), text })),
    ];
    return { slots: p.steps.length, planks: shuffleNotIdentity(planks, seed) };
  },
  grade(p, input: Input) {
    const { order } = solve(p);
    if (input.keys.length !== order.length) return { correct: false, feedback: `Fill all ${order.length} slots.` };
    const decoy = input.keys.find((k) => k.startsWith("d"));
    if (decoy) return { correct: false, feedback: `"${textForKey(p, decoy)}" isn't part of this process.` };
    const wrongAt = input.keys.findIndex((k, i) => k !== order[i]);
    if (wrongAt === -1) return { correct: true, feedback: "The bridge locks together." };
    return {
      correct: false,
      feedback: `Slot ${wrongAt + 1} is out of place. What has to happen right before "${textForKey(p, input.keys[wrongAt])}"?`,
    };
  },
  solutionInput: (_p, s) => ({ keys: s.order }),
});
