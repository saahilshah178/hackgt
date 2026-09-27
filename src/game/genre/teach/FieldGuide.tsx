"use client";

import { useEffect, useMemo, useRef } from "react";
import type { GameSpec } from "../../../contracts/gamespec";
import { LessonBody } from "./LessonCard";
import { guideEntries, lessonFrame, teacherFor } from "./lessons";

/*
 * The Field Guide: every concept the game teaches, in spec order, readable at any time (learning is never locked).
 * A native modal <dialog> drawer on the right: Escape (or G, or Close) closes it and focus returns to whatever opened
 * it. Opened from a challenge, it scrolls to and highlights that challenge's concept.
 */

export interface FieldGuideProps {
  spec: GameSpec;
  open: boolean;
  /** the entry to scroll to and focus when it opens, or null for the top */
  focusConceptId: string | null;
  /** concepts of the challenge in progress (highlighted "This challenge") */
  current: readonly string[];
  /** concepts taught this session */
  taught: ReadonlySet<string>;
  onClose(): void;
}

export function BookIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}

export function FieldGuide({ spec, open, focusConceptId, current, taught, onClose }: FieldGuideProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const entries = useMemo(() => guideEntries(spec), [spec]);
  const frame = lessonFrame(spec.genre, spec.id);
  const learnedCount = entries.filter((e) => taught.has(e.concept.id)).length;

  // open/close the native dialog from the `open` prop; remember and restore focus ourselves (belt and braces over the
  // browser's own dialog focus restoration)
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      const active = document.activeElement;
      returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
      d.showModal();
      const target = focusConceptId ? d.querySelector<HTMLElement>(`[data-entry-name="${focusConceptId}"]`) : null;
      if (target) {
        target.focus({ preventScroll: true });
        target.closest("li")?.scrollIntoView({ block: "start" });
      } else {
        d.scrollTop = 0;
        d.querySelector<HTMLElement>(".tg-guide-close")?.focus({ preventScroll: true });
      }
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, focusConceptId]);

  const restoreFocus = () => {
    const el = returnTo.current;
    returnTo.current = null;
    if (el && el.isConnected) el.focus({ preventScroll: true });
  };

  return (
    <dialog
      ref={ref}
      className="tg-guide"
      data-testid="field-guide"
      aria-labelledby="tg-guide-title"
      onClose={() => {
        restoreFocus();
        onClose();
      }}
      onKeyDown={(e) => {
        // keep keys inside the guide: hosts listen on window (arrows walk, digits pick story threads, N, Escape)
        e.stopPropagation();
        if ((e.key === "g" || e.key === "G") && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          ref.current?.close();
        }
      }}
      onClick={(e) => {
        // a click on the backdrop (the dialog box itself, outside its content) closes it
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX < r.left) e.currentTarget.close();
        }
      }}
    >
      {open && (
        <>
          <header className="tg-guide-head">
            <div>
              <h2 className="tg-guide-title" id="tg-guide-title">
                <BookIcon size={28} /> Field guide
              </h2>
              <p className="tg-guide-sub">{frame.guideSubtitle}</p>
              <p className="tg-guide-count">
                <strong>{learnedCount}</strong> of {entries.length} learned so far. Everything here is open to read, met or not.
              </p>
            </div>
            <button type="button" className="tg-guide-close" data-testid="field-guide-close" onClick={() => ref.current?.close()}>
              Close <kbd aria-hidden>Esc</kbd>
            </button>
          </header>
          {entries.length > 1 && (
            <nav className="tg-jump" aria-label="Jump to a concept">
              {entries.map(({ concept }) => (
                <button
                  key={concept.id}
                  type="button"
                  className="tg-jump-btn"
                  data-state={taught.has(concept.id) ? "learned" : "new"}
                  onClick={() => {
                    const h = ref.current?.querySelector<HTMLElement>(`[data-entry-name="${concept.id}"]`);
                    h?.focus({ preventScroll: true });
                    h?.closest("li")?.scrollIntoView({ block: "start" });
                  }}
                >
                  {concept.name}
                </button>
              ))}
            </nav>
          )}
          <ol className="tg-guide-list">
            {entries.map(({ concept, lesson }) => {
              const learned = taught.has(concept.id);
              const now = current.includes(concept.id);
              const teacher = teacherFor(spec, lesson);
              return (
                <li key={concept.id} className="tg-entry" data-testid={`field-guide-entry-${concept.id}`} data-state={learned ? "learned" : "new"} data-current={now ? "true" : "false"}>
                  <div className="tg-entry-head">
                    <h3 className="tg-entry-name" tabIndex={-1} data-entry-name={concept.id}>
                      {concept.name}
                    </h3>
                    {now && (
                      <span className="tg-tag" data-kind="now">
                        This challenge
                      </span>
                    )}
                    <span className="tg-tag" data-kind={learned ? "learned" : "new"}>
                      {learned ? "Learned" : "Not met yet"}
                    </span>
                  </div>
                  <LessonBody lesson={lesson} quotes />
                  {teacher && (
                    <p className="tg-entry-by">
                      Taught by {teacher.name}
                      {spec.source.unsourced ? "" : `, from ${spec.source.title}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </dialog>
  );
}
