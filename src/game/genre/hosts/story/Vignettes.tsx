import type { ReactNode } from "react";
import type { VignetteKind } from "./story.logic";

/*
 * Small line-art vignettes, one per story socket, drawn like pen sketches in a notebook margin. Stroke is
 * currentColor, so the caller sets the ink colour; `wash` is an optional soft fill behind the drawing.
 */

const ART: Record<VignetteKind, ReactNode> = {
  dialogue: (
    <>
      <path d="M8 14c0-4 3-7 7-7h18c4 0 7 3 7 7v9c0 4-3 7-7 7H22l-7 6v-6h0c-4 0-7-3-7-7z" />
      <path d="M44 22h4c4 0 7 3 7 7v8c0 4-3 7-7 7h0v6l-7-6H34c-4 0-7-3-7-7v-3" />
      <path d="M15 16h17M15 21h11" />
      <path d="M36 37h11" />
    </>
  ),
  choice: (
    <>
      <path d="M32 58V8" />
      <path d="M32 14h18l6 5-6 5H32" />
      <path d="M32 30H14l-6 5 6 5h18" />
      <path d="M24 58h16" />
      <path d="M38 19h8M16 35h8" />
    </>
  ),
  letter: (
    <>
      <rect x="7" y="16" width="50" height="34" rx="3" />
      <path d="M7 19l25 18 25-18" />
      <path d="M7 50l18-15M57 50L39 35" />
      <circle cx="32" cy="39" r="5.5" className="st-v-fill" />
    </>
  ),
  debate: (
    <>
      <path d="M18 30h28l-4 26H22z" />
      <path d="M14 30h36" />
      <path d="M26 30v-6c0-3 3-5 6-5s6 2 6 5v6" />
      <path d="M32 19V9" />
      <circle cx="32" cy="7" r="3" />
      <path d="M26 42h12" />
    </>
  ),
  journal: (
    <>
      <path d="M32 16c-6-4-15-5-24-4v38c9-1 18 0 24 4 6-4 15-5 24-4V12c-9-1-18 0-24 4z" />
      <path d="M32 16v38" />
      <path d="M13 22c5 0 9 1 13 2M13 29c5 0 9 1 13 2M13 36c5 0 9 1 13 2" />
      <path d="M52 6L40 34l-2 6 5-4 12-28z" />
    </>
  ),
  trial: (
    <>
      <path d="M32 8v46M20 56h24" />
      <path d="M12 16h40" />
      <path d="M16 16l-8 18h16zM48 16l-8 18h16z" />
      <path d="M8 34c1 4 4 6 8 6s7-2 8-6M40 34c1 4 4 6 8 6s7-2 8-6" />
      <circle cx="32" cy="10" r="2.5" className="st-v-fill" />
    </>
  ),
  climax: (
    <>
      <path d="M10 12h40v38c0 3-2 5-5 5H12c-3 0-5-2-5-5V22h3" />
      <path d="M50 20h5v30c0 3-2 5-5 5" />
      <path d="M15 19h29" strokeWidth={3.2} />
      <path d="M15 27h14M15 32h14M15 37h14M15 42h14M15 47h14" />
      <rect x="33" y="27" width="11" height="12" />
      <path d="M33 45h11" />
    </>
  ),
  lead: (
    <>
      <circle cx="26" cy="26" r="15" />
      <path d="M37 37l16 16" strokeWidth={5} />
      <path d="M18 22c2-4 5-6 9-6" />
    </>
  ),
};

export function Vignette({ kind, size = 56, className, title }: { kind: VignetteKind; size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {ART[kind]}
    </svg>
  );
}

/** A decorative rule with a small ornament, drawn under chapter headings. */
export function Ornament({ width = 180 }: { width?: number }) {
  return (
    <svg viewBox="0 0 180 16" width={width} height={16} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
      <path d="M4 8h62M114 8h62" />
      <path d="M70 8c6-7 14-7 20 0-6 7-14 7-20 0zM90 8c6-7 14-7 20 0-6 7-14 7-20 0z" />
      <circle cx="90" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

/** The ink stamp pressed onto a filed story beat. */
export function FiledStamp({ label = "Filed", className }: { label?: string; className?: string }) {
  return (
    <svg viewBox="0 0 150 64" className={className} aria-hidden>
      <rect x="4" y="4" width="142" height="56" rx="8" fill="none" stroke="currentColor" strokeWidth={4} />
      <rect x="11" y="11" width="128" height="42" rx="5" fill="none" stroke="currentColor" strokeWidth={1.6} />
      <text x="75" y="43" textAnchor="middle" fill="currentColor" fontSize="30" fontWeight="800" letterSpacing="6" fontFamily="'Courier New', Courier, monospace">
        {label.toUpperCase()}
      </text>
    </svg>
  );
}
