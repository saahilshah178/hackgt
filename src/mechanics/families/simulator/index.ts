import { stubMode } from "../../stub";
import { defineFamily } from "../../types";

const s = (id: string, name: string, blurb: string, widget: "dial" | "pick" = "dial", blind = false) =>
  stubMode({ id, name, widget, knowledgeTypes: ["system", "causal"], blindSolvable: blind, directorBlurb: blurb });

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
    intervene: s("intervene", "Intervene", "Keep a variable in a band for T ticks with limited actions."),
    reach_state: s("reach_state", "Reach state", "Set initial parameters or rates so the state hits a target at tick T."),
    predict: s("predict", "Predict", "Predict the direction of the outcome before running, then watch.", "pick", true),
    sample: s("sample", "Sample", "Repeated stochastic trials; the player estimates or decides.", "pick"),
  },
});
