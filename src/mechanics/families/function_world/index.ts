import { stubMode } from "../../stub";
import { defineFamily } from "../../types";

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
  },
  modes: {
    limit: s("limit", "Limit", "Approach x = a from the left, right, or both; the answer is a value or DNE."),
    continuity: s("continuity", "Continuity", "Find or fix a discontinuity."),
    asymptote: s("asymptote", "Asymptote", "Behavior as x → ±∞."),
    slope: s("slope", "Slope", "Sign, zero, steepest point, concavity, inflection of the terrain."),
    secant: s("secant", "Secant", "Shrink Δx toward the derivative at a.", "dial"),
    roots: s("roots", "Roots", "Mark every point where f = 0."),
    squeeze: s("squeeze", "Squeeze", "Bounds converge at a; predict where the trapped orb ends.", "pick"),
    epsilon_delta: s("epsilon_delta", "Epsilon-delta", "Choose δ for a given ε (catalog-only).", "dial"),
  },
});
