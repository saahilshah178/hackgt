import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { mimic } from "./mimic";

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
  },
  modes: {
    mimic,
    predict_reveal: stubMode({ id: "predict_reveal", name: "Predict then reveal", widget: "pick", knowledgeTypes: ["causal", "quantitative"], blindSolvable: true, directorBlurb: "The player picks an outcome before a computed simulation or a sourced reveal." }),
    error_hunt: stubMode({ id: "error_hunt", name: "Error hunt", widget: "pick", knowledgeTypes: ["procedure"], blindSolvable: true, directorBlurb: "A worked solution, proof, or code with exactly one wrong line; find it." }),
    counterexample: stubMode({ id: "counterexample", name: "Counterexample", widget: "pick", knowledgeTypes: ["argument"], blindSolvable: true, directorBlurb: "Pick the case that breaks the rule." }),
  },
});
