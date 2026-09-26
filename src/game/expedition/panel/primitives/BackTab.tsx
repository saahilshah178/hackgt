"use client";

import { forwardRef } from "react";

/**
 * The back arrow tab (bible §3.2, §3.1): top-left of the panel, `ui.card.deep`, 1.5 px border, a white left arrow;
 * closes the panel without grading. Reads DONE in sandbox layout. `data-testid="panel-back"` is kept for e2e.
 */
export const BackTab = forwardRef<HTMLButtonElement, { onBack: () => void; done?: boolean; disabled?: boolean }>(function BackTab(
  { onBack, done = false, disabled = false },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className="xp-back"
      data-testid="panel-back"
      aria-label={done ? "Done: close the panel" : "Back: close the panel without verifying"}
      onClick={onBack}
      disabled={disabled}
    >
      <svg width="30" height="20" viewBox="0 0 30 20" aria-hidden focusable="false">
        <path d="M28 10H4M11 3L3.5 10 11 17" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {done ? <span>DONE</span> : null}
    </button>
  );
});
