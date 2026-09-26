import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { elimination } from "./elimination";

const s = (id: string, name: string, blurb: string, widget: "link" | "pick" | "dial" = "pick") =>
  stubMode({ id, name, widget, knowledgeTypes: ["argument", "causal"], blindSolvable: true, directorBlurb: blurb });

export const investigator = defineFamily({
  id: "investigator",
  name: "Investigator",
  widgets: ["link", "pick", "dial"],
  knowledgeTypes: ["argument", "causal", "fact"],
  genres: {
    dungeon: { sockets: ["door"], skin: "Rooms are hypotheses; clues seal their doors" },
    mystery: { sockets: ["accusation", "corkboard"], skin: "Pin clues, eliminate suspects, accuse" },
    platformer: { sockets: ["gate"], skin: "Clues seal the doors of eliminated hypotheses" },
    puzzle: { sockets: ["tile_board"], skin: "Logic grid" },
    strategy: { sockets: ["event_card"], skin: "Policy debate with evidence" },
  },
  modes: {
    elimination,
    argument: s("argument", "Argument", "A claim plus evidence cards, some weak or irrelevant; counter-evidence forces qualification.", "link"),
    source_eval: s("source_eval", "Source evaluation", "Rank sources by provenance cues."),
    perspective: s("perspective", "Perspective", "Match accounts to actors and their motives.", "link"),
    weigh: s("weigh", "Weigh", "Allocate weights to causes, graded on rank order against the source.", "dial"),
  },
});
