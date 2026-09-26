import { stubMode } from "../../stub";
import { defineFamily } from "../../types";

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
    equation: s("equation", "Equation", "Apply operations to both sides until x is alone; success verified by substitution."),
    chem_equation: s("chem_equation", "Chemical equation", "Set integer coefficients so every atom balances."),
    ledger: s("ledger", "Ledger", "Nodes with flows where inflow equals outflow; fill the missing values.", true),
    torque: s("torque", "Torque", "Masses at distances; balanced when Σm·d = 0."),
    ratio: s("ratio", "Ratio", "Recipe or stoichiometric ratios and limiting reagent.", true),
  },
});
