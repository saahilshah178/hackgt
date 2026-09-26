import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, looksApproximated, prettyExpr, trimNumber } from "../../util";

/*
 * balance · torque: masses at distances; balanced when Σ m·(x − pivot) = 0. ask=position: place the
 * movable mass so the beam balances. ask=pivot: find the pivot (the weighted mean) that balances fixed masses.
 * Cards: lever_door, balance_builder, mean_median_seesaw.
 */

const Params = z.object({
  fixed: z.array(z.object({ mass: z.string().describe("exact, > 0"), position: z.string().describe("exact position along the beam") })).min(1).max(5),
  movable: z.object({ mass: z.string().describe("exact, > 0; ignored when ask is pivot") }),
  pivot: z.string().describe("exact pivot position; ignored when ask is pivot"),
  ask: z.enum(["position", "pivot"]).describe("position: where to put the movable mass. pivot: where the fulcrum must go under the fixed masses"),
  rangeMin: z.string().describe("left end of the beam, exact"),
  rangeMax: z.string().describe("right end of the beam, exact"),
  unit: z.string().describe('e.g. "m", "cm", "tiles"'),
});
type Params = z.infer<typeof Params>;

interface Solution {
  answer: number;
  answerLabel: string;
  netTorqueWithout: number;
}
interface Input {
  position: number;
}
interface View {
  ask: "position" | "pivot";
  rangeMin: number;
  rangeMax: number;
  pivot: number | null;
  fixed: { mass: number; position: number }[];
  movableMass: number | null;
  unit: string;
}

function nums(p: Params) {
  return {
    fixed: p.fixed.map((f) => ({ mass: evalExact(f.mass), position: evalExact(f.position) })),
    movable: evalExact(p.movable.mass),
    pivot: evalExact(p.pivot),
    rangeMin: evalExact(p.rangeMin),
    rangeMax: evalExact(p.rangeMax),
  };
}

function solve(p: Params): Solution {
  const n = nums(p);
  const fixed = n.fixed.map((f) => ({ mass: f.mass!, position: f.position! }));
  if (p.ask === "pivot") {
    const total = fixed.reduce((s, f) => s + f.mass, 0);
    const answer = fixed.reduce((s, f) => s + f.mass * f.position, 0) / total;
    return { answer, answerLabel: trimNumber(answer), netTorqueWithout: 0 };
  }
  const pivot = n.pivot!;
  const net = fixed.reduce((s, f) => s + f.mass * (f.position - pivot), 0);
  const answer = pivot - net / n.movable!;
  return { answer, answerLabel: trimNumber(answer), netTorqueWithout: net };
}

export const torque = defineMode({
  id: "torque",
  name: "Torque",
  implemented: true,
  blindSolvable: false,
  widget: "place",
  knowledgeTypes: ["quantitative", "system"],
  directorBlurb: "A beam with masses at distances balances only when the torques cancel; the player places a mass or the fulcrum. Levers, center of mass, mean vs median.",
  authoringGuide: [
    "Write masses and positions as exact numbers. For ask=position choose values so the answer lands inside the beam and not on top of a fixed mass.",
    "For ask=pivot (center of mass / the mean), place 3-5 fixed masses; the answer is their weighted mean position.",
    "Placeholders: {{pivot}}, {{unit}}, {{answer}} (last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    for (const [k, v] of [["pivot", p.pivot], ["rangeMin", p.rangeMin], ["rangeMax", p.rangeMax], ["movable.mass", p.movable.mass]] as const) {
      if (looksApproximated(v)) problems.push(`${k} "${v}" looks like a rounded decimal; write it exactly`);
    }
    const n = nums(p);
    if (n.fixed.some((f) => f.mass === null || f.position === null) || n.rangeMin === null || n.rangeMax === null) {
      problems.push("every mass and position must evaluate to a number");
      return problems;
    }
    if (n.fixed.some((f) => f.mass! <= 0)) problems.push("masses must be positive");
    if (!(n.rangeMin < n.rangeMax)) problems.push("rangeMin must be less than rangeMax");
    if (n.fixed.some((f) => f.position! < n.rangeMin! || f.position! > n.rangeMax!)) problems.push("every fixed mass must sit on the beam");
    if (p.ask === "position") {
      if (n.pivot === null || n.movable === null) {
        problems.push("pivot and movable.mass must evaluate to numbers");
        return problems;
      }
      if (n.movable <= 0) problems.push("movable.mass must be positive");
      if (n.pivot < n.rangeMin! || n.pivot > n.rangeMax!) problems.push("the pivot must be on the beam");
    }
    if (problems.length) return problems;
    const s = solve(p);
    if (s.answer < n.rangeMin! || s.answer > n.rangeMax!) problems.push(`the balancing ${p.ask} (${s.answerLabel}) falls off the beam; change the masses or the range`);
    if (p.ask === "position" && Math.abs(s.netTorqueWithout) < 1e-9) problems.push("the fixed masses already balance; the movable mass has no job");
    if (n.fixed.some((f) => Math.abs(f.position! - s.answer) < 1e-9)) problems.push("the answer coincides with a fixed mass; adjust the values");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { pivot: prettyExpr(p.pivot), unit: p.unit, answer: s.answerLabel };
  },
  answerVars: ["answer"],
  present(p): View {
    const n = nums(p);
    return {
      ask: p.ask,
      rangeMin: n.rangeMin!,
      rangeMax: n.rangeMax!,
      pivot: p.ask === "position" ? n.pivot : null,
      fixed: n.fixed.map((f) => ({ mass: f.mass!, position: f.position! })),
      movableMass: p.ask === "position" ? n.movable : null,
      unit: p.unit,
    };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const n = nums(p);
    const tol = 0.03 * (n.rangeMax! - n.rangeMin!);
    if (Number.isFinite(input.position) && Math.abs(input.position - s.answer) <= tol) {
      return { correct: true, feedback: p.ask === "position" ? "The beam levels out: the torques cancel." : "The beam balances on that point: the weighted centre." };
    }
    if (p.ask === "position") {
      const fixed = n.fixed.map((f) => ({ mass: f.mass!, position: f.position! }));
      const net = fixed.reduce((sum, f) => sum + f.mass * (f.position - n.pivot!), 0) + n.movable! * (input.position - n.pivot!);
      const side = net > 0 ? "right" : "left";
      return { correct: false, feedback: `The beam tips to the ${side}. Torque is mass × distance from the pivot: a small mass far out matches a big mass close in.` };
    }
    const side = input.position > s.answer ? "right" : "left";
    return { correct: false, feedback: `With the fulcrum there the beam tips ${side === "right" ? "left" : "right"}. The balance point is the mass-weighted average of the positions, so heavy masses pull it toward them.` };
  },
  solutionInput: (_p, s) => ({ position: s.answer }),
});
