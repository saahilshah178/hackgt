/**
 * input/controller.ts (H1) — reads keys and turns them into host actions (docs/design/20 §2.2, §3.5).
 *
 * The D4 fix: Phaser's KeyboardManager listens on `window` and preventDefault()s captured codes. The game config sets
 * `input.keyboard.capture: []`; this controller adds captures only for Space and the arrows (so they never scroll the
 * page while exploring) and calls `keyboard.disableGlobalCapture()` whenever the host is frozen, or focus sits in a
 * typing target / anything inside [data-panel]; `enableGlobalCapture()` otherwise. Keys whose event target is an input,
 * textarea, select, [role=slider] or inside [data-panel] are ignored here and belong to that element.
 */
import type Phaser from "phaser";
import type { CharInput } from "../scene/character";
import { NO_INPUT } from "../scene/character";
import { actionFor, CAPTURED_CODES, isTypingTarget, type ControlScheme, type HostAction, type KeyContext } from "./keymap";

export type ActionHandler = (action: HostAction, ev: KeyboardEvent) => void;

export class InputController {
  private held = new Set<string>();
  private edges = new Set<"hop" | "up" | "down" | "interact">();
  private frozen = false;
  private captureOn = true;
  private context: KeyContext = "explore";
  private scheme: ControlScheme = "classic";
  private readonly kb: Phaser.Input.Keyboard.KeyboardPlugin | null;
  private readonly onDown: (ev: KeyboardEvent) => void;
  private readonly onUp: (ev: KeyboardEvent) => void;
  private readonly onBlur: () => void;
  lastInputAt = 0;

  constructor(scene: Phaser.Scene, private readonly onAction: ActionHandler, private readonly now: () => number) {
    this.kb = scene.input.keyboard ?? null;
    this.onDown = (ev) => this.keyDown(ev);
    this.onUp = (ev) => {
      this.held.delete(ev.code);
    };
    this.onBlur = () => this.held.clear();
    // Listen on window ourselves (capture phase is not needed): Phaser's own listeners only preventDefault.
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.onBlur);
    try {
      this.kb?.addCapture([...CAPTURED_CODES].map((c) => codeToKeyCode(c)).filter((k): k is number => k !== null));
    } catch {
      // older keyboard plugins: capture is optional
    }
    this.syncCapture();
  }

  /** Clockwork Crypt hops with W and skips dialogue with Space. Other expeditions keep the classic map. */
  setScheme(scheme: ControlScheme): void {
    this.scheme = scheme;
  }

  /** The host's context (explore, panel, cutscene); `frozen` releases capture (D4). */
  setMode(frozen: boolean, context: KeyContext): void {
    if (frozen && !this.frozen) this.held.clear();
    this.frozen = frozen;
    this.context = context;
    this.syncCapture();
  }

  /** Called every frame: focus can move into the panel without a prop change. */
  syncCapture(): void {
    const active = typeof document !== "undefined" ? document.activeElement : null;
    const want = !this.frozen && !isTypingTarget(active as Element | null);
    if (want === this.captureOn || !this.kb) {
      this.captureOn = want;
      return;
    }
    this.captureOn = want;
    try {
      if (want) this.kb.enableGlobalCapture();
      else this.kb.disableGlobalCapture();
    } catch {
      // ignore: capture is a nicety
    }
  }
  get capturing(): boolean {
    return this.captureOn;
  }

  private keyDown(ev: KeyboardEvent): void {
    if (isTypingTarget(ev.target as Element | null)) return;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const action = actionFor(ev.code, { context: this.frozen && this.context === "explore" ? "panel" : this.context, shift: ev.shiftKey, scheme: this.scheme });
    this.lastInputAt = this.now();
    this.held.add(ev.code);
    if (!action) return;
    if (!ev.repeat && (action === "hop" || action === "up" || action === "down" || action === "interact")) this.edges.add(action);
    if (!ev.repeat) this.onAction(action, ev);
  }

  /** Movement for this frame (edges are consumed). */
  charInput(allowMove: boolean): CharInput {
    const edges = this.edges;
    // E stays queued for consumeInteract() (proximity decides what it does, §2.4.3)
    this.edges = edges.has("interact") ? new Set(["interact"]) : new Set();
    if (!allowMove) return NO_INPUT;
    const h = this.held;
    return {
      left: h.has("KeyA") || h.has("ArrowLeft"),
      right: h.has("KeyD") || h.has("ArrowRight"),
      run: h.has("ShiftLeft") || h.has("ShiftRight"),
      hop: edges.has("hop"),
      up: edges.has("up"),
      down: edges.has("down"),
      interact: false, // E goes to proximity first; the scene decides (§2.4.3)
    };
  }
  consumeInteract(): boolean {
    const had = this.edges.has("interact");
    this.edges.delete("interact");
    return had;
  }
  /** Synthetic key edges (debug `interact()`, express). */
  press(action: "hop" | "up" | "down" | "interact"): void {
    this.edges.add(action);
  }
  clear(): void {
    this.held.clear();
    this.edges.clear();
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    window.removeEventListener("blur", this.onBlur);
    try {
      this.kb?.enableGlobalCapture();
      this.kb?.clearCaptures();
    } catch {
      // the plugin may already be gone
    }
  }
}

const KEYCODES: Readonly<Record<string, number>> = { Space: 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
function codeToKeyCode(code: string): number | null {
  return KEYCODES[code] ?? null;
}
