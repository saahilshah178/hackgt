import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { bins } from "./bins";
import { type_match } from "./type_match";

const s = (id: string, name: string, blurb: string, widget: "sort" | "pick" = "sort") =>
  stubMode({ id, name, widget, knowledgeTypes: ["category"], blindSolvable: true, directorBlurb: blurb });

export const sorter = defineFamily({
  id: "sorter",
  name: "Sorter",
  widgets: ["sort", "pick"],
  knowledgeTypes: ["category"],
  genres: {
    dungeon: { sockets: ["enemy"], skin: "Type-matched weapons; category-keyed doors" },
    mystery: { sockets: ["evidence"], skin: "File claims into case folders" },
    platformer: { sockets: ["gate"], skin: "Only matching-category platforms are solid" },
    puzzle: { sockets: ["goal_pad"], skin: "Push crates onto category pads" },
    strategy: { sockets: ["market"], skin: "Route goods to districts" },
  },
  modes: {
    bins,
    venn: s("venn", "Venn", "2 to 3 sets, including a 'neither' region."),
    hierarchy: s("hierarchy", "Hierarchy", "Nesting, or a tree."),
    type_match,
  },
});
