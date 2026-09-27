import { defineFamily } from "../../types";
import { circuit } from "./circuit";
import { electron_config } from "./electron_config";
import { genetics } from "./genetics";
import { molecule } from "./molecule";
import { program } from "./program";
import { sentence } from "./sentence";
import { tiles } from "./tiles";

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
    explorer: { sockets: ["terminal"], skin: "Rebuild the broken mechanism at the terminal" },
    story: { sockets: ["letter"], skin: "Compose the message piece by piece" },
  },
  modes: {
    molecule,
    circuit,
    program,
    sentence,
    genetics,
    electron_config,
    tiles,
  },
});
