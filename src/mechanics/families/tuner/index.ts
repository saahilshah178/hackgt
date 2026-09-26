import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { formula } from "./formula";
import { oscillator } from "./oscillator";

export const tuner = defineFamily({
  id: "tuner",
  name: "Tuner",
  widgets: ["dial"],
  knowledgeTypes: ["quantitative"],
  genres: {
    dungeon: { sockets: ["door"], skin: "Vault rings, catapult, or alchemy dials spinning on the function" },
    mystery: { sockets: ["lab"], skin: "Calibrate the instrument; set the lighthouse sweep" },
    platformer: { sockets: ["moving_platform", "gate"], skin: "Saw wheels, launch pads, a balloon that only lifts when tuned" },
    puzzle: { sockets: ["lock", "beam_board"], skin: "Dial locks and gear trains" },
    strategy: { sockets: ["policy_dial", "production_line"], skin: "Machine settings on the production line" },
  },
  modes: {
    oscillator,
    formula,
    curve: stubMode({ id: "curve", name: "Curve tuner", widget: "dial", knowledgeTypes: ["quantitative"], blindSolvable: false, directorBlurb: "Tune the parameters of a linear, quadratic or exponential template so the curve passes through the checkpoints." }),
    optimize: stubMode({ id: "optimize", name: "Optimizer", widget: "dial", knowledgeTypes: ["quantitative"], blindSolvable: false, directorBlurb: "Find the input that maximizes or minimizes a unimodal objective on an interval." }),
  },
});
