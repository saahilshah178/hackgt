"use client";
/**
 * TrigTutorial — the how-to-play card the trig side-scroller opens on (in place of the loading screen): the level goal,
 * the loop, and the controls. It rises in with its lines staggered and sinks out on close. A modal dialog: focus moves
 * to Close on open, Esc or the ✕ closes it.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./tutorial.module.css";

const LEAVE_MS = 240;

const CONTROLS: readonly { keys: readonly string[]; action: string }[] = [
  { keys: ["A", "D", "←", "→"], action: "Walk left and right" },
  { keys: ["Shift"], action: "Run (hold)" },
  { keys: ["Space"], action: "Hop across gaps" },
  { keys: ["W", "↑"], action: "Climb up, board a lift, enter a doorway" },
  { keys: ["S", "↓"], action: "Drop down, climb down" },
  { keys: ["E", "Enter"], action: "Use a console to open its puzzle" },
  { keys: ["I"], action: "Get a hint while solving" },
  { keys: ["Esc"], action: "Close a puzzle without grading" },
  { keys: ["H", "?"], action: "Show every key" },
];

const order = (i: number) => ({ "--i": i }) as CSSProperties;

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function TrigTutorial({ title, goal, onClose }: { title: string; goal: string; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const close = () => {
    if (leaving) return;
    if (reducedMotion()) {
      onClose();
      return;
    }
    setLeaving(true);
    timer.current = window.setTimeout(onClose, LEAVE_MS);
  };

  return (
    <div
      className={styles.overlay}
      data-leaving={leaving ? "" : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trig-tutorial-title"
      data-testid="trig-tutorial"
      onKeyDown={(e) => {
        e.stopPropagation(); // the HUD's window hotkeys (J, H, M) must not open cards over the tutorial
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
      }}
    >
      <div className={styles.card}>
        <button type="button" className={styles.close} onClick={close} aria-label="Close the tutorial" data-testid="trig-tutorial-close" autoFocus>
          ✕
        </button>
        <div className={styles.body}>
          <h2 id="trig-tutorial-title" className={`${styles.title} ${styles.reveal}`} style={order(0)}>
            How to play: {title}
          </h2>
          <p className={`${styles.goal} ${styles.reveal}`} style={order(1)}>
            <strong>Goal:</strong> {goal}
          </p>
          <p className={`${styles.text} ${styles.reveal}`} style={order(2)}>
            Run along the terraces to each glowing console and press E. Solve its trig puzzle, then press Verify: every solved console restores
            a rhythm and opens the way forward.
          </p>
          <h3 className={`${styles.heading} ${styles.reveal}`} style={order(3)}>
            Controls
          </h3>
          <ul className={styles.controls}>
            {CONTROLS.map((c, i) => (
              <li key={c.action} className={styles.reveal} style={order(4 + i)}>
                <span className={styles.keys}>
                  {c.keys.map((k) => (
                    <kbd key={k} className={styles.kbd}>
                      {k}
                    </kbd>
                  ))}
                </span>
                <span>{c.action}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
