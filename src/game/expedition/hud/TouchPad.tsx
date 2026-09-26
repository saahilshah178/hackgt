"use client";
/**
 * TouchPad (coarse pointers only, 20 §2.1): ◀ ▶ ▲ ▼ E ⤒ buttons. Press and release map to the same actions the
 * keyboard drives (the client forwards them to the host controller). Hidden on fine pointers by CSS.
 */
import styles from "./hud.module.css";

export type TouchAction = "left" | "right" | "up" | "down" | "interact" | "hop";

const LEFT: { action: TouchAction; glyph: string; label: string }[] = [
  { action: "left", glyph: "◀", label: "Walk left" },
  { action: "right", glyph: "▶", label: "Walk right" },
];
const RIGHT: { action: TouchAction; glyph: string; label: string }[] = [
  { action: "up", glyph: "▲", label: "Climb or board" },
  { action: "down", glyph: "▼", label: "Drop or climb down" },
  { action: "interact", glyph: "E", label: "Interact" },
  { action: "hop", glyph: "⤒", label: "Hop" },
];

export function TouchPad({ onAction }: { onAction: (action: TouchAction, pressed: boolean) => void }) {
  const button = (b: (typeof LEFT)[number]) => (
    <button
      key={b.action}
      type="button"
      className={styles.touchButton}
      aria-label={b.label}
      data-testid={`touch-${b.action}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        onAction(b.action, true);
      }}
      onPointerUp={() => onAction(b.action, false)}
      onPointerCancel={() => onAction(b.action, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {b.glyph}
    </button>
  );
  return (
    <div className={styles.touch} data-testid="touch-pad" aria-label="Touch controls">
      <div className={styles.touchGroup}>{LEFT.map(button)}</div>
      <div className={styles.touchGroup}>{RIGHT.map(button)}</div>
    </div>
  );
}
