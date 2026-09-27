import { describe, expect, it } from "vitest";
import { actionFor, CAPTURED_CODES, isTypingTarget, KEY_MAP } from "./keymap";

describe("keymap (§3.5)", () => {
  it("explore actions", () => {
    const ex = { context: "explore" as const, shift: false };
    expect(["KeyA", "ArrowLeft"].map((c) => actionFor(c, ex))).toEqual(["left", "left"]);
    expect(["KeyD", "ArrowRight"].map((c) => actionFor(c, ex))).toEqual(["right", "right"]);
    expect(actionFor("ShiftLeft", ex)).toBe("run");
    expect(actionFor("ShiftRight", ex)).toBe("run");
    expect(actionFor("Space", ex)).toBe("hop");
    expect(["KeyW", "ArrowUp"].map((c) => actionFor(c, ex))).toEqual(["up", "up"]);
    expect(["KeyS", "ArrowDown"].map((c) => actionFor(c, ex))).toEqual(["down", "down"]);
    expect(["KeyE", "Enter", "NumpadEnter"].map((c) => actionFor(c, ex))).toEqual(["interact", "interact", "interact"]);
    expect(actionFor("KeyM", ex)).toBe("map");
    expect(actionFor("KeyJ", ex)).toBe("journal");
    expect(actionFor("KeyH", ex)).toBe("legend");
    expect(actionFor("Slash", ex)).toBe("legend");
    expect(actionFor("KeyN", ex)).toBe("mute");
    expect(actionFor("Escape", ex)).toBe("back");
    expect(actionFor("Digit3", ex)).toBeNull();
    expect(actionFor("KeyI", ex)).toBeNull();
    expect(actionFor("KeyQ", ex)).toBeNull();
  });

  it("the panel keeps its own keys; the host only handles globals there", () => {
    const p = { context: "panel" as const, shift: false };
    for (const c of ["KeyA", "ArrowLeft", "KeyD", "ArrowRight", "Space", "KeyW", "KeyS", "ShiftLeft", "KeyE", "Enter", "KeyM", "KeyJ"]) expect(actionFor(c, p)).toBeNull();
    expect(actionFor("KeyI", p)).toBe("hint");
    expect(actionFor("KeyI", { context: "panel", shift: true })).toBe("brief");
    expect(actionFor("Digit4", p)).toBe("quick");
    expect(actionFor("Escape", p)).toBe("back");
    expect(actionFor("KeyH", p)).toBe("legend");
  });

  it("cutscene keys", () => {
    const c = { context: "cutscene" as const, shift: false };
    expect(actionFor("Space", c)).toBe("advance");
    expect(actionFor("Escape", c)).toBe("skip");
    expect(actionFor("KeyE", c)).toBe("interact");
    expect(actionFor("KeyN", c)).toBe("mute");
    expect(actionFor("KeyH", c)).toBeNull();
    expect(actionFor("KeyA", c)).toBeNull();
  });

  it("Clockwork Crypt hops with W and skips dialogue with Space; other games stay on the classic map", () => {
    const ex = { context: "explore" as const, shift: false, scheme: "crypt" as const };
    expect(actionFor("KeyW", ex)).toBe("hop");
    expect(actionFor("ArrowUp", ex)).toBe("up");
    expect(actionFor("Space", ex)).toBe("advance");
    expect(actionFor("Space", { context: "panel", shift: false, scheme: "crypt" })).toBeNull();
    expect(actionFor("Space", { context: "explore", shift: false })).toBe("hop");
    expect(actionFor("KeyW", { context: "explore", shift: false })).toBe("up");
  });

  it("the legend covers every row; Space and arrows are captured only for the game", () => {
    expect(KEY_MAP).toHaveLength(13);
    expect(KEY_MAP.every((r) => r.codes.length > 0 && r.keys.length > 0)).toBe(true);
    expect(CAPTURED_CODES).toContain("Space");
    expect(CAPTURED_CODES).not.toContain("KeyE");
  });

  it("typing targets own their keys (the D4 fix)", () => {
    expect(isTypingTarget({ tagName: "input" })).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", getAttribute: (n) => (n === "role" ? "slider" : null) })).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON", getAttribute: () => null, closest: (s) => (s === "[data-panel]" ? {} : null) })).toBe(true);
    expect(isTypingTarget({ tagName: "CANVAS", getAttribute: () => null, closest: () => null })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
