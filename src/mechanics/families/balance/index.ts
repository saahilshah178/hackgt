import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { ratio } from "./ratio";
import { torque } from "./torque";
import { chem_equation } from "./chem_equation";
import { equation } from "./equation";
import { ledger } from "./ledger";

const s = (id: string, name: string, blurb: string, blind = false) =>
  stubMode({ id, name, widget: "build", knowledgeTypes: ["quantitative", "system"], blindSolvable: blind, directorBlurb: blurb });

export const balance = defineFamily({
  id: "balance",
  name: "Balance",
  widgets: ["build"],
  knowledgeTypes: ["quantitative", "system", "procedure"],
  genres: {
    dungeon: { sockets: ["altar"], skin: "Alchemy scale; spilled atoms become slimes" },
    mystery: { sockets: ["archive"], skin: "The ledger is off by one entry" },
    platformer: { sockets: ["switch"], skin: "Seesaw bridge" },
    puzzle: { sockets: ["lock"], skin: "Cancel terms, DragonBox-style" },
    strategy: { sockets: ["ledger"], skin: "Balance budgets and flows" },
    explorer: { sockets: ["shrine"], skin: "Balance the shrine scales to open the passage" },
    story: { sockets: ["debate"], skin: "Weigh both sides until the argument balances" },
  },
  modes: {
    equation,
    chem_equation,
    ledger,
    torque,
    ratio,
  },
});
