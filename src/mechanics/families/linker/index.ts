import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { network } from "./network";
import { path } from "./path";
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
    explorer: { sockets: ["bridge"], skin: "Connect matching pylons to extend the bridge" },
    story: { sockets: ["dialogue"], skin: "Connect who said what to whom" },
  },
  modes: {
    pairs,
    chain,
    network: network,
    path: path,
  },
});
