import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { reachState } from "./reach_state";
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
    explorer: { sockets: ["shrine"], skin: "Tend the garden shrine until the system is stable" },
    story: { sockets: ["choice"], skin: "Run the scenario before you decide" },
    world3d: { sockets: ["device"], skin: "Run the mechanism and watch the world change" },
  },
  modes: {
    intervene,
    reach_state: reachState,
    predict,
    sample,
  },
});
