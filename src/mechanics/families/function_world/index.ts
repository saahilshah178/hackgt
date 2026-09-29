import { stubMode } from "../../stub";
import { defineFamily } from "../../types";
import { asymptote } from "./asymptote";
import { continuity } from "./continuity";
import { limit } from "./limit";
import { roots } from "./roots";
import { secant } from "./secant";
import { slope } from "./slope";

const s = (id: string, name: string, blurb: string, widget: "dial" | "place" | "pick" = "place") =>
  stubMode({ id, name, widget, knowledgeTypes: ["quantitative"], blindSolvable: false, directorBlurb: blurb });

export const functionWorld = defineFamily({
  id: "function_world",
  name: "Function World",
  widgets: ["dial", "place", "pick"],
  knowledgeTypes: ["quantitative"],
  genres: {
    dungeon: { sockets: ["altar"], skin: "Rune track whose floor height is f(x)" },
    mystery: { sockets: ["lab"], skin: "Sensor readings converging on a timestamp" },
    platformer: { sockets: ["gap"], skin: "The terrain is y = f(x); the missing tile" },
    puzzle: { sockets: ["tile_board"], skin: "Track tiles that follow f" },
    strategy: { sockets: ["market"], skin: "Price curve over time" },
    explorer: { sockets: ["bridge"], skin: "The bridge deck follows f(x); find the missing span" },
    story: { sockets: ["journal"], skin: "Read the trend in the expedition log" },
    world3d: { sockets: ["device", "vista"], skin: "Shape the curve on the survey instrument and watch the land respond" },
  },
  modes: {
    limit,
    continuity,
    asymptote,
    slope,
    secant,
    roots,
    squeeze: s("squeeze", "Squeeze", "Bounds converge at a; predict where the trapped orb ends.", "pick"),
    epsilon_delta: s("epsilon_delta", "Epsilon-delta", "Choose δ for a given ε (catalog-only).", "dial"),
  },
});
