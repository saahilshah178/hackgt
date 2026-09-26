import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
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
  },
  modes: {
    equation,
    chem_equation,
    ledger,
    torque: s("torque", "Torque", "Masses at distances; balanced when Σm·d = 0."),
    ratio: s("ratio", "Ratio", "Recipe or stoichiometric ratios and limiting reagent.", true),
  },
});
