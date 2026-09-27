import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { search } from "./search";
import { numberLine } from "./number_line";
import { plane } from "./plane";

export const mapper = defineFamily({
  id: "mapper",
  name: "Mapper",
  widgets: ["place"],
  knowledgeTypes: ["quantitative", "spatial"],
  genres: {
    dungeon: { sockets: ["altar", "enemy"], skin: "Rune line on the altar floor, or an archery range on a number line" },
    mystery: { sockets: ["conversation"], skin: "At the auction, bid the right magnitude; pin the map" },
    platformer: { sockets: ["gap"], skin: "The floor is a number line; land on the value" },
    puzzle: { sockets: ["tile_board"], skin: "Place the tile at its position on the axis" },
    strategy: { sockets: ["market"], skin: "Place goods on the price line" },
    explorer: { sockets: ["terminal"], skin: "Plot the position on the map terminal" },
    story: { sockets: ["journal"], skin: "Pin the moment on the journal map" },
  },
  modes: {
    number_line: numberLine,
    plane,
    map: stubMode({ id: "map", name: "Map", widget: "place", knowledgeTypes: ["spatial", "fact"], blindSolvable: false, directorBlurb: "Place items onto a region graph defined as data." }),
    search,
  },
});
