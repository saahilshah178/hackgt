import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { chain } from "./chain";
import { pairs } from "./pairs";

const s = (id: string, name: string, blurb: string, blind = true) =>
  stubMode({ id, name, widget: "link", knowledgeTypes: ["fact", "causal"], blindSolvable: blind, directorBlurb: blurb });

export const linker = defineFamily({
  id: "linker",
  name: "Linker",
  widgets: ["link"],
  knowledgeTypes: ["fact", "causal", "sequence", "system"],
  genres: {
    dungeon: { sockets: ["enemy"], skin: "Chain lightning between pairs" },
    mystery: { sockets: ["corkboard"], skin: "String the board" },
    platformer: { sockets: ["pickup"], skin: "Grapple anchors" },
    puzzle: { sockets: ["pipe_board"], skin: "Flow-style pairing" },
    strategy: { sockets: ["research_node"], skin: "Supply links" },
  },
  modes: {
    pairs,
    chain,
    network: s("network", "Network", "Edges by a stated relation.", false),
    path: s("path", "Path", "A weighted graph; find the shortest or valid path (Dijkstra/BFS in code).", false),
  },
});
