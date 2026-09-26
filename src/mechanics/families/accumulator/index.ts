import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { area } from "./area";
import { riemann } from "./riemann";

const s = (id: string, name: string, blurb: string, widget: "dial" | "place" = "dial") =>
  stubMode({ id, name, widget, knowledgeTypes: ["quantitative"], blindSolvable: false, directorBlurb: blurb });

export const accumulator = defineFamily({
  id: "accumulator",
  name: "Accumulator",
  widgets: ["dial", "place"],
  knowledgeTypes: ["quantitative"],
  genres: {
    dungeon: { sockets: ["forge"], skin: "Fill the reservoir to forge the key" },
    mystery: { sockets: ["archive"], skin: "Rebuild totals from rate logs" },
    platformer: { sockets: ["gap"], skin: "Fill the pit; velocity ghost" },
    puzzle: { sockets: ["conveyor"], skin: "Fill tanks" },
    strategy: { sockets: ["production_line"], skin: "Output over time" },
  },
  modes: {
    riemann,
    area,
    signed: s("signed", "Signed area", "Net area above and below the axis."),
    rate_total: s("rate_total", "Rate to total", "Predict the accumulated total at time t."),
    average_value: s("average_value", "Average value", "Level the reservoir."),
  },
});
