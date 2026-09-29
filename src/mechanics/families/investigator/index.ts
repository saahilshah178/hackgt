import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { argument } from "./argument";
import { perspective } from "./perspective";
import { sourceEval } from "./source_eval";
import { weigh } from "./weigh";
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
    explorer: { sockets: ["locked_gate"], skin: "Each gate is a hypothesis; clues seal the wrong ones" },
    story: { sockets: ["trial"], skin: "Weigh the testimony and decide" },
    world3d: { sockets: ["conversation", "artifact"], skin: "Weigh the evidence and the witnesses" },
  },
  modes: {
    elimination,
    argument: argument,
    source_eval: sourceEval,
    perspective: perspective,
    weigh: weigh,
  },
});
