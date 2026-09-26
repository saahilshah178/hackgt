"use client";
/**
 * Journal (J; P0 of docs/design/20 §2.6): the MasteryHud (kept, testid mastery-hud) plus the collected items list,
 * in a panel-material dialog. P2 replaces it with the JournalReader tabs (pages, logbook, clipping case).
 */
import { useEffect, useRef } from "react";
import type { JournalSpec } from "../../../contracts/world";
import { MasteryHud, type MasteryHudConcept } from "../../systems/MasteryHud";
import styles from "../hud/hud.module.css";

export interface JournalItem {
  id: string;
  title: string;
  kind: "shard" | "page" | "negative";
  text: string;
}

export interface JournalProps {
  open: boolean;
  onClose: () => void;
  spec: JournalSpec;
  concepts: MasteryHudConcept[];
  items: readonly JournalItem[];
}

export function Journal({ open, onClose, spec, concepts, items }: JournalProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => prev?.focus?.();
  }, [open]);
  if (!open) return null;
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="journal-title"
        data-testid="journal"
        data-style={spec.style}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
        style={{ minWidth: "min(640px, calc(100vw - 32px))" }}
      >
        <h2 id="journal-title" className={styles.cardTitle}>
          {spec.title}
        </h2>
        <button ref={closeRef} type="button" className={`${styles.iconButton} ${styles.close}`} onClick={onClose} aria-label={`Close the ${spec.title.toLowerCase()}`}>
          ✕
        </button>
        <section aria-label="Mastery" style={{ fontSize: 18 }}>
          <MasteryHud concepts={concepts} />
        </section>
        <section aria-label="Found" style={{ marginTop: 20 }}>
          <h3 className={styles.cardTitle} style={{ fontSize: 18 }}>
            Found
          </h3>
          {items.length === 0 ? (
            <p style={{ fontSize: 18, margin: 0 }}>Nothing yet. Look behind the machines.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
              {items.map((it) => (
                <li key={it.id} style={{ fontSize: 18 }}>
                  <strong>{it.title}</strong>
                  <span style={{ opacity: 0.75 }}> · {it.kind}</span>
                  <div style={{ marginTop: 4 }}>{it.text}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
