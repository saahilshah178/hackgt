import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { linear } from "./linear";

export const sequencer = defineFamily({
  id: "sequencer",
  name: "Sequencer",
  widgets: ["order"],
  knowledgeTypes: ["sequence", "procedure"],
  genres: {
    dungeon: { sockets: ["door"], skin: "Glyph door pressed in process order" },
    mystery: { sockets: ["corkboard"], skin: "Rebuild the timeline on the corkboard" },
    platformer: { sockets: ["gap"], skin: "Bridge planks in order; the wrong order leaves a gap" },
    puzzle: { sockets: ["conveyor"], skin: "Order the parcels on the conveyor" },
    strategy: { sockets: ["research_node"], skin: "Tech tree order" },
  },
  modes: {
    linear,
    cycle: stubMode({ id: "cycle", name: "Cycle", widget: "order", knowledgeTypes: ["sequence", "system"], blindSolvable: true, directorBlurb: "Circular sequence with rotation-invariant grading." }),
    timeline: stubMode({ id: "timeline", name: "Timeline", widget: "order", knowledgeTypes: ["sequence", "fact"], blindSolvable: true, directorBlurb: "Events with sourced dates; the dates are revealed after placing." }),
    rank: stubMode({ id: "rank", name: "Rank", widget: "order", knowledgeTypes: ["sequence", "quantitative", "category"], blindSolvable: true, directorBlurb: "Order items by a sourced or computed property." }),
  },
});
