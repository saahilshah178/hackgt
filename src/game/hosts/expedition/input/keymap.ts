/**
 * input/keymap.ts (pure, H1) — the one key map (docs/design/20 §3.5) as data, plus actionFor(code, ctx).
 * Codes are KeyboardEvent.code values. The panel column lists what the PANEL does with a key; the host acts only in
 * explore and cutscene contexts (while the panel is open, Phaser's capture is released: the D4 fix).
 */
export type HostAction =
  | "left" | "right" | "run" | "hop" | "up" | "down" | "interact" | "quick"
  | "hint" | "brief" | "map" | "journal" | "legend" | "mute" | "back" | "skip" | "advance";
export type KeyContext = "explore" | "panel" | "cutscene";

export interface KeyRow {
  codes: readonly string[];
  keys: string; // legend text
  explore: string | null;
  panel: string | null;
  cutscene: string | null;
}
export const KEY_MAP: readonly KeyRow[] = [
  { codes: ["KeyA", "ArrowLeft", "KeyD", "ArrowRight"], keys: "A / D, ← / →", explore: "walk", panel: "(focused control: step)", cutscene: null },
  { codes: ["ShiftLeft", "ShiftRight"], keys: "Shift", explore: "run (hold)", panel: "×10 step modifier", cutscene: null },
  { codes: ["Space"], keys: "Space", explore: "hop / timed hop; cosmetic hop with no link in range", panel: "advance the bar when it has focus", cutscene: "advance the line" },
  { codes: ["KeyW", "ArrowUp"], keys: "W / ↑", explore: "climb, ladder up, board a vehicle, enter a portal", panel: "(control: previous item)", cutscene: null },
  { codes: ["KeyS", "ArrowDown"], keys: "S / ↓", explore: "drop, ladder down", panel: "(control: next item)", cutscene: null },
  { codes: ["KeyE", "Enter", "NumpadEnter"], keys: "E / Enter", explore: "interact (console, NPC, plaque, pickup, touch, sandbox)", panel: "activate the focused control element; Verify when focused", cutscene: "await_interact" },
  { codes: ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9"], keys: "1–9", explore: null, panel: "quick-select claim, valve, bin, socket, stage", cutscene: null },
  { codes: ["KeyI"], keys: "I", explore: null, panel: "hint rung (the (i) button); Shift+I opens the Brief sheet", cutscene: null },
  { codes: ["KeyM"], keys: "M", explore: "map (when story.map)", panel: null, cutscene: null },
  { codes: ["KeyJ"], keys: "J", explore: "journal", panel: null, cutscene: null },
  { codes: ["KeyH", "Slash"], keys: "H or ?", explore: "key legend", panel: "key legend", cutscene: null },
  { codes: ["KeyN"], keys: "N", explore: "mute toggle", panel: "mute toggle", cutscene: "mute toggle" },
  { codes: ["Escape"], keys: "Esc", explore: "close map/journal", panel: "back (close without grading)", cutscene: "skip" },
];

/** Game keys the host captures (preventDefault) while exploring, so Space and arrows never scroll the page. */
export const CAPTURED_CODES: readonly string[] = ["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

export type ControlScheme = "classic" | "crypt";

export function actionFor(code: string, ctx: { context: KeyContext; shift: boolean; scheme?: ControlScheme }): HostAction | null {
  const c = ctx.context;
  const crypt = ctx.scheme === "crypt";
  switch (code) {
    case "KeyA":
    case "ArrowLeft":
      return c === "explore" ? "left" : null;
    case "KeyD":
    case "ArrowRight":
      return c === "explore" ? "right" : null;
    case "ShiftLeft":
    case "ShiftRight":
      return c === "explore" ? "run" : null;
    case "Space":
      if (crypt) return c === "panel" ? null : "advance";
      return c === "explore" ? "hop" : c === "cutscene" ? "advance" : null;
    case "KeyW":
      if (crypt) return c === "explore" ? "hop" : null;
      return c === "explore" ? "up" : null;
    case "ArrowUp":
      return c === "explore" ? "up" : null;
    case "KeyS":
    case "ArrowDown":
      return c === "explore" ? "down" : null;
    case "KeyE":
    case "Enter":
    case "NumpadEnter":
      return c === "panel" ? null : "interact";
    case "KeyI":
      return c === "panel" ? (ctx.shift ? "brief" : "hint") : null;
    case "KeyM":
      return c === "explore" ? "map" : null;
    case "KeyJ":
      return c === "explore" ? "journal" : null;
    case "KeyH":
    case "Slash":
      return c === "cutscene" ? null : "legend";
    case "KeyN":
      return "mute";
    case "Escape":
      return c === "cutscene" ? "skip" : "back";
    default:
      return /^Digit[1-9]$/.test(code) && c === "panel" ? "quick" : null;
  }
}

/** Duck-typed element (works on DOM elements and on plain test objects). */
export interface ElementLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?(name: string): string | null;
  closest?(selector: string): unknown;
}
/**
 * Keys whose target is an input, textarea, select, contenteditable or [role=slider] (or anything inside [data-panel])
 * belong to that element, never to the host (§2.2 input/controller.ts).
 */
export function isTypingTarget(el: ElementLike | null | undefined): boolean {
  if (!el) return false;
  const tag = (el.tagName ?? "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  const role = el.getAttribute?.("role");
  if (role === "slider" || role === "spinbutton" || role === "textbox") return true;
  return !!el.closest?.("[data-panel]");
}
