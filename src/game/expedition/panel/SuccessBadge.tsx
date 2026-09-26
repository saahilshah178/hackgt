"use client";

import { useEffect } from "react";

export const BADGE_MS = 1600;

function Bracket({ flip }: { flip: boolean }) {
  // a short bracket over (or under) the box with a stem that ends in a dot
  return (
    <svg className="xp-badge-bracket" viewBox="0 0 200 16" preserveAspectRatio="none" aria-hidden focusable="false" style={{ transform: flip ? "scaleY(-1)" : undefined }}>
      <path d="M8 16 V8 H192 V16 M100 8 V2" fill="none" stroke="var(--ui-line)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * The success badge (§3.2, bible §3.8): two-line caps in a light-bordered box with bracket connectors above and below
 * ending in dots; it appears where Verify was for 1.6 s, then `onDone` (the client slides the panel out).
 * `data-testid="success-badge"`; the text is announced assertively by the panel's live region.
 */
export function SuccessBadge({ text, onDone }: { text: string; onDone?: () => void }) {
  useEffect(() => {
    if (!onDone) return;
    const t = setTimeout(onDone, BADGE_MS);
    return () => clearTimeout(t);
  }, [onDone]);
  const words = text.trim().split(/\s+/);
  const cut = Math.ceil(words.length / 2);
  const lines = words.length > 1 ? [words.slice(0, cut).join(" "), words.slice(cut).join(" ")] : [text];
  return (
    <div className="xp-verify-row" data-testid="badge-row">
      <div className="xp-badge" data-testid="success-badge" role="status">
        <span aria-hidden style={{ display: "block", width: 6, height: 6, borderRadius: "50%", background: "var(--ui-line)" }} />
        <Bracket flip={false} />
        <div className="xp-badge-box">
          {lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
        <Bracket flip />
        <span aria-hidden style={{ display: "block", width: 6, height: 6, borderRadius: "50%", background: "var(--ui-line)" }} />
      </div>
    </div>
  );
}
