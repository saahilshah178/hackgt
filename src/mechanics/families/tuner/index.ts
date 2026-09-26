import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { formula } from "./formula";
import { curve } from "./curve";
import { optimize } from "./optimize";
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
    curve,
    optimize,
  },
});
