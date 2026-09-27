/**
 * src/game/expedition/hud/key-legend.ts (S1, pure) — the §3.5 key map as display rows for the KeyLegend card.
 * (The host's input/keymap.ts is the behaviour; this is what the card prints.)
 */
export interface LegendRow {
  keys: readonly string[];
  explore: string | null;
  panel: string | null;
  cutscene: string | null;
}

export const KEY_LEGEND: readonly LegendRow[] = [
  { keys: ["A", "D", "←", "→"], explore: "Walk", panel: "Step the focused control", cutscene: null },
  { keys: ["Shift"], explore: "Run (hold)", panel: "×10 step", cutscene: null },
  { keys: ["Space"], explore: "Hop", panel: "Advance the dialogue", cutscene: "Advance the line" },
  { keys: ["W", "↑"], explore: "Jump · climb · board · enter", panel: "Previous item", cutscene: null },
  { keys: ["S", "↓"], explore: "Drop · ladder down", panel: "Next item", cutscene: null },
  { keys: ["E", "Enter"], explore: "Interact", panel: "Activate · Verify", cutscene: "Interact when asked" },
  { keys: ["1–9"], explore: null, panel: "Quick-select", cutscene: null },
  { keys: ["I"], explore: null, panel: "Hint (Shift+I: brief)", cutscene: null },
  { keys: ["M"], explore: "Map", panel: null, cutscene: null },
  { keys: ["J"], explore: "Journal", panel: null, cutscene: null },
  { keys: ["H", "?"], explore: "Key legend", panel: "Key legend", cutscene: null },
  { keys: ["N"], explore: "Mute", panel: "Mute", cutscene: "Mute" },
  { keys: ["Esc"], explore: "Close map / journal", panel: "Back (no grading)", cutscene: "Skip" },
];

/** HUD hotkeys (the HUD listens itself; the host's controller handles movement). */
export type HudHotkey = "legend" | "mute" | "journal" | "map" | "close";

/** Maps a KeyboardEvent-like to a HUD action; ignores typing targets (inputs, sliders) and modified keys. */
export function hudHotkey(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; targetTag?: string | null; targetRole?: string | null }): HudHotkey | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const tag = (e.targetTag ?? "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select" || e.targetRole === "slider" || e.targetRole === "textbox") return null;
  switch (e.key) {
    case "h":
    case "H":
    case "?":
      return "legend";
    case "n":
    case "N":
      return "mute";
    case "j":
    case "J":
      return "journal";
    case "m":
    case "M":
      return "map";
    case "Escape":
      return "close";
    default:
      return null;
  }
}
