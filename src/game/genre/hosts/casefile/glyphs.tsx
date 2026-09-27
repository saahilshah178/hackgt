"use client";

/*
 * Small SVG glyphs for the casefile host: the noir silhouettes used as speaker portraits (generic, so they fit any
 * cast) and the four step icons of "how to investigate".
 */

export function Face({ who, accent }: { who: "partner" | "suspect"; accent: string }) {
  const rim = who === "partner" ? "#ffcf7a" : accent;
  return (
    <svg viewBox="0 0 80 80" width="100%" height="100%" aria-hidden>
      <defs>
        <radialGradient id={`face-bg-${who}`} cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" stopColor={who === "partner" ? "#3a2a1a" : "#1c1030"} />
          <stop offset="1" stopColor="#07070d" />
        </radialGradient>
      </defs>
      <rect width="80" height="80" fill={`url(#face-bg-${who})`} />
      {who === "partner" ? (
        <g>
          {/* shoulders with a lab-coat collar, head, glasses glint, hair bun */}
          <path d="M8 84 C10 60 24 54 40 54 C56 54 70 60 72 84 Z" fill="#0b0b10" stroke={rim} strokeOpacity="0.8" strokeWidth="1.6" />
          <path d="M30 56 L40 72 L50 56" fill="none" stroke="#e8e2d2" strokeWidth="3" strokeOpacity="0.8" />
          <ellipse cx="40" cy="36" rx="14" ry="16" fill="#0b0b10" stroke={rim} strokeOpacity="0.9" strokeWidth="1.6" />
          <circle cx="40" cy="18" r="7" fill="#0b0b10" stroke={rim} strokeOpacity="0.7" strokeWidth="1.4" />
          <path d="M31 37 h7 M42 37 h7" stroke={rim} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="34.5" cy="37" r="4.2" fill="none" stroke={rim} strokeWidth="1.2" strokeOpacity="0.7" />
          <circle cx="45.5" cy="37" r="4.2" fill="none" stroke={rim} strokeWidth="1.2" strokeOpacity="0.7" />
        </g>
      ) : (
        <g>
          <path d="M6 84 C8 58 24 52 40 52 C56 52 72 58 74 84 Z" fill="#050508" stroke={rim} strokeOpacity="0.8" strokeWidth="1.6" />
          <ellipse cx="40" cy="38" rx="13" ry="15" fill="#050508" stroke={rim} strokeOpacity="0.8" strokeWidth="1.6" />
          <ellipse cx="40" cy="26" rx="24" ry="4.5" fill="#050508" stroke={rim} strokeOpacity="0.7" strokeWidth="1.4" />
          <path d="M27 26 Q28 10 40 11 Q52 10 53 26 Z" fill="#050508" stroke={rim} strokeOpacity="0.5" strokeWidth="1.2" />
          <ellipse cx="35" cy="38" rx="2.6" ry="1.3" fill={rim} />
          <ellipse cx="45" cy="38" rx="2.6" ry="1.3" fill={rim} />
        </g>
      )}
    </svg>
  );
}

export function StepIcon({ step }: { step: number }) {
  const stroke = "currentColor";
  return (
    <svg viewBox="0 0 34 34" aria-hidden>
      {step === 0 && (
        <g fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round">
          <circle cx="14" cy="14" r="9" />
          <path d="M21 21 L30 30" />
        </g>
      )}
      {step === 1 && (
        <g>
          <rect x="3" y="7" width="13" height="17" fill="none" stroke={stroke} strokeWidth="2.4" transform="rotate(-8 9 15)" />
          <rect x="18" y="9" width="13" height="17" fill="none" stroke={stroke} strokeWidth="2.4" transform="rotate(7 24 17)" />
          <path d="M9 10 Q17 24 25 11" fill="none" stroke="#d4333f" strokeWidth="2.4" />
        </g>
      )}
      {step === 2 && (
        <g fill="none" stroke={stroke} strokeWidth="2.6" strokeLinecap="round">
          <rect x="5" y="15" width="24" height="15" rx="3" />
          <path d="M10 15 V10 a7 7 0 0 1 14 0" />
          <circle cx="17" cy="22" r="2.4" fill={stroke} />
        </g>
      )}
      {step === 3 && (
        <g fill="none" stroke={stroke} strokeWidth="2.6" strokeLinecap="round">
          <path d="M17 4 V30" />
          <path d="M6 10 H28" />
          <path d="M6 10 L2 20 H10 Z M28 10 L24 20 H32 Z" fill={stroke} fillOpacity="0.3" />
          <path d="M11 30 H23" />
        </g>
      )}
    </svg>
  );
}
