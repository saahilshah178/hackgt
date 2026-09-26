"use client";

import { forwardRef } from "react";
import { TraceLine } from "./primitives/TraceLine";

/**
 * Verify (§3.2, bible §3.8): machine-named caps ("LOCK THE RINGS"), `ui.card.deep` fill, 1.5 px `ui.line` border,
 * flanked by horizontal trace lines that end in dots. Disabled (`ui.text.dim`) until the draft is complete.
 * `data-testid="widget-submit"` is kept so the existing e2e helpers drive it.
 */
export const VerifyButton = forwardRef<HTMLButtonElement, { label: string; enabled: boolean; onVerify: () => void; describedBy?: string; busy?: boolean }>(
  function VerifyButton({ label, enabled, onVerify, describedBy, busy = false }, ref) {
    return (
      <div className="xp-verify-row" data-testid="verify-row">
        <TraceLine className="xp-trace" start="dots" end="none" style={{ marginRight: 10 }} />
        <button
          ref={ref}
          type="button"
          className="xp-verify"
          data-testid="widget-submit"
          disabled={!enabled || busy}
          aria-disabled={!enabled || busy}
          aria-describedby={describedBy}
          aria-busy={busy || undefined}
          onClick={onVerify}
        >
          {label}
        </button>
        <TraceLine className="xp-trace" start="none" end="dots" style={{ marginLeft: 10 }} />
      </div>
    );
  },
);
