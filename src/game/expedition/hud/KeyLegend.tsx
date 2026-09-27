"use client";
/**
 * KeyLegend (H or ?; 20 §2.6, §3.5): the key map as a card. A modal dialog: focus moves to Close on open and Esc
 * closes it (the Hud's hotkey handler), returning focus to where it was.
 */
import { useEffect, useRef } from "react";
import styles from "./hud.module.css";
import { KEY_LEGEND, type LegendRow } from "./key-legend";

export function KeyLegend({ open, onClose, rows = KEY_LEGEND }: { open: boolean; onClose: () => void; rows?: readonly LegendRow[] }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => prev?.focus?.();
  }, [open]);
  if (!open) return null;
  return (
    <div className={styles.overlay} onClick={onClose} data-testid="key-legend-overlay">
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="key-legend-title"
        data-testid="key-legend"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <h2 id="key-legend-title" className={styles.cardTitle}>
          Keys
        </h2>
        <button ref={closeRef} type="button" className={`${styles.iconButton} ${styles.close}`} onClick={onClose} aria-label="Close the key legend">
          ✕
        </button>
        <table className={styles.legendTable}>
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">Exploring</th>
              <th scope="col">Panel</th>
              <th scope="col">Cutscene</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.keys.join("")}>
                <th scope="row">
                  {row.keys.map((k) => (
                    <kbd key={k} className={styles.kbd}>
                      {k}
                    </kbd>
                  ))}
                </th>
                <td>{row.explore ?? "—"}</td>
                <td>{row.panel ?? "—"}</td>
                <td>{row.cutscene ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
