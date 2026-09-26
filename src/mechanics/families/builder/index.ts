import { stubMode } from "../../stub";
import { defineFamily } from "../../types";

const s = (id: string, name: string, blurb: string) =>
  stubMode({ id, name, widget: "build", knowledgeTypes: ["procedure", "spatial"], blindSolvable: false, directorBlurb: blurb });

export const builder = defineFamily({
  id: "builder",
  name: "Builder",
  widgets: ["build"],
  knowledgeTypes: ["procedure", "spatial", "system"],
  genres: {
    dungeon: { sockets: ["forge"], skin: "Craft a molecule, circuit, or golem program" },
    mystery: { sockets: ["lab"], skin: "Build the compound or circuit" },
    platformer: { sockets: ["switch"], skin: "Wire the elevator; word-block bridge" },
    puzzle: { sockets: ["tile_board"], skin: "Valence grid, Lightbot" },
    strategy: { sockets: ["production_line"], skin: "Lay out the factory" },
  },
  modes: {
    molecule: s("molecule", "Molecule", "Valence rules, target formula."),
    circuit: s("circuit", "Circuit", "Logic gates or resistors, target truth table or value."),
    program: s("program", "Program", "Blocks for a grid robot, run by an interpreter."),
    sentence: s("sentence", "Sentence", "Word tiles, checked against accepted sequences and agreement rules."),
    genetics: s("genetics", "Genetics", "A Punnett square."),
    electron_config: s("electron_config", "Electron configuration", "Aufbau, Hund, and Pauli rules."),
    tiles: s("tiles", "Tiles", "Grid filling under rules: algebra tiles, area models, K-maps, measures, schedules."),
  },
});
