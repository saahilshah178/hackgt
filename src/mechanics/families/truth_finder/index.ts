import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { counterexample } from "./counterexample";
import { errorHunt } from "./error_hunt";
import { mimic } from "./mimic";
import { predictReveal } from "./predict_reveal";

export const truthFinder = defineFamily({
  id: "truth_finder",
  name: "Truth Finder",
  widgets: ["pick"],
  knowledgeTypes: ["fact", "category", "causal", "argument", "procedure", "quantitative"],
  genres: {
    dungeon: { sockets: ["chest"], skin: "Treasure chests; the one bearing the false claim is a mimic" },
    mystery: { sockets: ["cross_exam"], skin: "One witness's claim contradicts the facts; object to the lie" },
    platformer: { sockets: ["gate"], skin: "Three doors; the one with the false claim collapses" },
    puzzle: { sockets: ["tile_board"], skin: "Remove the odd tile to release the chain" },
    strategy: { sockets: ["event_card"], skin: "Advisors' claims; the false one tanks a stat" },
    explorer: { sockets: ["sentry"], skin: "One sentry lies; find the false claim" },
    story: { sockets: ["trial"], skin: "One witness contradicts the record; object" },
  },
  modes: {
    mimic,
    predict_reveal: predictReveal,
    error_hunt: errorHunt,
    counterexample,
  },
});
