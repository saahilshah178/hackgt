import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { intervene } from "./intervene";
import { predict } from "./predict";
import { sample } from "./sample";

export const simulator = defineFamily({
  id: "simulator",
  name: "Simulator",
  widgets: ["dial", "pick"],
  knowledgeTypes: ["system", "causal", "quantitative"],
  genres: {
    dungeon: { sockets: ["enemy"], skin: "Ecology rooms, reactor waves" },
    mystery: { sockets: ["lab"], skin: "Keep the patient stable overnight" },
    platformer: { sockets: ["moving_platform"], skin: "Population or glucose lifts" },
    puzzle: { sockets: ["beam_board"], skin: "Place species so all are fed" },
    strategy: { sockets: ["crisis", "policy_dial"], skin: "Run the economy or ecosystem" },
  },
  modes: {
    intervene,
    reach_state: stubMode({
      id: "reach_state",
      name: "Reach state",
      widget: "dial",
      knowledgeTypes: ["system", "causal"],
      blindSolvable: false,
      directorBlurb: "Set initial parameters or rates so the state hits a target at tick T.",
    }),
    predict,
    sample,
  },
});
