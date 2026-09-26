import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { encode } from "./encode";
import { functionMachine } from "./function_machine";

const s = (id: string, name: string, blurb: string, widget: "pick" | "order" | "build", blind = false) =>
  stubMode({ id, name, widget, knowledgeTypes: ["procedure", "quantitative"], blindSolvable: blind, directorBlurb: blurb });

export const transformer = defineFamily({
  id: "transformer",
  name: "Transformer",
  widgets: ["pick", "order", "build"],
  knowledgeTypes: ["procedure", "quantitative", "fact"],
  genres: {
    dungeon: { sockets: ["forge"], skin: "Crafting-bench machines" },
    mystery: { sockets: ["lab"], skin: "Decode the letter or cipher" },
    platformer: { sockets: ["pickup", "gate"], skin: "Power-up machine, cipher platforms" },
    puzzle: { sockets: ["conveyor", "pipe_board"], skin: "Route through machines" },
    strategy: { sockets: ["production_line"], skin: "Processing chain" },
  },
  modes: {
    function_machine: functionMachine,
    inverse: s("inverse", "Inverse", "Run the machine backward to recover the input.", "pick"),
    composition: s("composition", "Composition", "Order the machines to reach a target; code proves the order is unique.", "order"),
    domain_filter: s("domain_filter", "Domain filter", "Which inputs are valid.", "pick"),
    encode,
    trace: s("trace", "Trace", "A tiny restricted DSL executed by code; ask for the final value or the output.", "pick"),
    matrix: s("matrix", "Matrix", "A 2×2 matrix applied to a shape.", "pick"),
    geometric: s("geometric", "Geometric", "Rotate, reflect, translate, or scale a shape to match.", "build"),
  },
});
