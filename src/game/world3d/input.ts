"use client";

/*
 * Keyboard state for the third-person controller. One listener pair on window; the controller polls `keys` every
 * frame. Typing in a text field (free chat, explain widgets) never moves the player, and a disabled input (dialogue,
 * challenge, menus) releases every held key so the player doesn't keep running after a panel opens.
 */

export interface InputState {
  forward: number;
  right: number;
  sprint: boolean;
  jump: boolean;
  /** turn the camera with the keyboard: Q/E are taken (E interacts), so arrows turn when "arrows turn" is set */
  turn: number;
}

const MOVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight", "Space"]);

export function isTyping(target: EventTarget | null): boolean {
  const t = target as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

export class KeyboardInput {
  private down = new Set<string>();
  private enabled = true;
  /** arrow keys turn the camera instead of strafing (settings: "Arrow keys turn the camera") */
  arrowsTurn = false;
  /** the on-screen joystick (touch devices): -1..1 per axis, added to the keys */
  virtual = { forward: 0, right: 0, sprint: false };

  private onDown = (e: KeyboardEvent) => {
    if (!this.enabled || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (MOVE_KEYS.has(e.code)) {
      this.down.add(e.code);
      // Space and arrows would scroll the page behind the canvas
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    }
  };
  private onUp = (e: KeyboardEvent) => this.down.delete(e.code);
  private onBlur = () => this.down.clear();

  attach(): () => void {
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.onBlur);
    return () => {
      window.removeEventListener("keydown", this.onDown);
      window.removeEventListener("keyup", this.onUp);
      window.removeEventListener("blur", this.onBlur);
    };
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      this.down.clear();
      this.virtual = { forward: 0, right: 0, sprint: false };
    }
  }

  read(): InputState {
    const k = (c: string) => (this.down.has(c) ? 1 : 0);
    const arrowsMove = !this.arrowsTurn;
    const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));
    const v = this.enabled ? this.virtual : { forward: 0, right: 0, sprint: false };
    return {
      forward: clamp1(k("KeyW") - k("KeyS") + k("ArrowUp") - k("ArrowDown") + v.forward),
      right: clamp1(k("KeyD") - k("KeyA") + (arrowsMove ? k("ArrowRight") - k("ArrowLeft") : 0) + v.right),
      sprint: this.down.has("ShiftLeft") || this.down.has("ShiftRight") || v.sprint,
      jump: this.down.has("Space"),
      turn: arrowsMove ? 0 : k("ArrowRight") - k("ArrowLeft"),
    };
  }
}
