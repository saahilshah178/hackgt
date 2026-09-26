/**
 * Flat, friendly inline-SVG illustrations. Decorative only: every one is aria-hidden, so the surrounding
 * text must carry the meaning.
 */

const C = {
  sky: "#7dd3fc",
  skyDeep: "#38bdf8",
  skySoft: "#e0f2fe",
  navy: "#1e3a5f",
  sun: "#fcd34d",
  sunSoft: "#fef3c7",
  coral: "#fb7185",
  coralSoft: "#ffe4e6",
  mint: "#6ee7b7",
  mintSoft: "#d1fae5",
  lilac: "#c4b5fd",
  lilacSoft: "#ede9fe",
  white: "#ffffff",
};

type ArtProps = { className?: string };

export function HeroIllustration({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 480 400" className={className} aria-hidden focusable="false">
      <circle cx="250" cy="200" r="170" fill={C.skySoft} />
      <circle cx="400" cy="80" r="26" fill={C.sunSoft} />
      <circle cx="400" cy="80" r="14" fill={C.sun} />
      {/* open book */}
      <path d="M100 250 Q170 225 240 255 L240 345 Q170 318 100 342 Z" fill={C.white} stroke={C.navy} strokeWidth="4" strokeLinejoin="round" />
      <path d="M380 250 Q310 225 240 255 L240 345 Q310 318 380 342 Z" fill={C.white} stroke={C.navy} strokeWidth="4" strokeLinejoin="round" />
      <path d="M122 268 Q165 254 215 270 M122 290 Q165 276 215 292 M122 312 Q165 298 200 310" stroke={C.sky} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M262 272 Q300 250 340 262 T 360 256" stroke={C.coral} strokeWidth="5" strokeLinecap="round" fill="none" />
      <rect x="265" y="292" width="22" height="30" rx="4" fill={C.mint} />
      <rect x="293" y="282" width="22" height="40" rx="4" fill={C.sky} />
      <rect x="321" y="300" width="22" height="22" rx="4" fill={C.sun} />
      {/* floating lightbulb */}
      <g transform="translate(222 70)">
        <circle cx="18" cy="24" r="30" fill={C.sunSoft} />
        <path d="M18 2 a20 20 0 0 1 12 36 v8 h-24 v-8 a20 20 0 0 1 12 -36 z" fill={C.sun} stroke={C.navy} strokeWidth="4" strokeLinejoin="round" />
        <path d="M8 54 h20 M11 62 h14" stroke={C.navy} strokeWidth="4" strokeLinecap="round" />
      </g>
      {/* game controller */}
      <g transform="translate(92 118) rotate(-12)">
        <rect x="0" y="0" width="92" height="52" rx="26" fill={C.lilac} stroke={C.navy} strokeWidth="4" />
        <path d="M22 26 h18 M31 17 v18" stroke={C.navy} strokeWidth="4" strokeLinecap="round" />
        <circle cx="62" cy="20" r="5" fill={C.coral} />
        <circle cx="72" cy="32" r="5" fill={C.mint} />
      </g>
      {/* unit circle card */}
      <g transform="translate(318 132) rotate(8)">
        <rect x="0" y="0" width="92" height="84" rx="14" fill={C.white} stroke={C.navy} strokeWidth="4" />
        <circle cx="46" cy="42" r="24" fill="none" stroke={C.skyDeep} strokeWidth="4" />
        <path d="M46 42 L64 26" stroke={C.coral} strokeWidth="4" strokeLinecap="round" />
        <circle cx="64" cy="26" r="5" fill={C.coral} />
      </g>
      {/* sparkles */}
      <path d="M190 150 l5 12 l12 5 l-12 5 l-5 12 l-5 -12 l-12 -5 l12 -5 z" fill={C.skyDeep} />
      <path d="M420 200 l4 9 l9 4 l-9 4 l-4 9 l-4 -9 l-9 -4 l9 -4 z" fill={C.coral} />
      <path d="M62 230 l4 9 l9 4 l-9 4 l-4 9 l-4 -9 l-9 -4 l9 -4 z" fill={C.mint} />
      <circle cx="300" cy="60" r="6" fill={C.mint} />
      <circle cx="150" cy="80" r="5" fill={C.coral} />
    </svg>
  );
}

export type Subject = "trig" | "cells" | "history" | "platformer" | "lab";

const SUBJECT_BG: Record<Subject, string> = {
  trig: C.skySoft,
  cells: C.mintSoft,
  history: C.sunSoft,
  platformer: C.lilacSoft,
  lab: C.coralSoft,
};

export function subjectBackground(subject: Subject): string {
  return SUBJECT_BG[subject];
}

/** Wide (16:9-ish) subject art for game cards and the lesson media panel. */
export function SubjectArt({ subject, className }: ArtProps & { subject: Subject }) {
  return (
    <svg viewBox="0 0 320 180" className={className} aria-hidden focusable="false" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill={SUBJECT_BG[subject]} />
      {subject === "trig" && <TrigArt />}
      {subject === "cells" && <CellsArt />}
      {subject === "history" && <HistoryArt />}
      {subject === "platformer" && <PlatformerArt />}
      {subject === "lab" && <LabArt />}
    </svg>
  );
}

function TrigArt() {
  return (
    <g>
      <path d="M0 110 Q40 50 80 110 T160 110 T240 110 T320 110" fill="none" stroke={C.skyDeep} strokeWidth="6" strokeLinecap="round" />
      <path d="M0 110 H320" stroke={C.navy} strokeOpacity="0.15" strokeWidth="3" />
      <circle cx="232" cy="64" r="38" fill={C.white} stroke={C.navy} strokeWidth="4" />
      <path d="M232 64 L258 38" stroke={C.coral} strokeWidth="4" strokeLinecap="round" />
      <path d="M244 64 A12 12 0 0 0 240 55" stroke={C.navy} strokeWidth="3" fill="none" />
      <circle cx="258" cy="38" r="6" fill={C.coral} />
      <text x="54" y="48" fontSize="30" fontWeight="700" fill={C.navy} fontFamily="inherit">
        π
      </text>
      <circle cx="80" cy="110" r="7" fill={C.sun} stroke={C.navy} strokeWidth="3" />
      <path d="M290 150 l4 9 l9 4 l-9 4 l-4 9 l-4 -9 l-9 -4 l9 -4 z" fill={C.sun} />
    </g>
  );
}

function CellsArt() {
  return (
    <g>
      <ellipse cx="160" cy="96" rx="118" ry="66" fill={C.white} stroke={C.navy} strokeWidth="4" />
      <ellipse cx="160" cy="96" rx="104" ry="54" fill="none" stroke={C.mint} strokeWidth="6" strokeDasharray="2 10" strokeLinecap="round" />
      <circle cx="176" cy="92" r="24" fill={C.lilac} stroke={C.navy} strokeWidth="4" />
      <circle cx="182" cy="86" r="7" fill={C.lilacSoft} />
      <circle cx="108" cy="76" r="8" fill={C.skyDeep} />
      <circle cx="120" cy="118" r="6" fill={C.coral} />
      <circle cx="226" cy="118" r="7" fill={C.sun} />
      <circle cx="30" cy="40" r="7" fill={C.skyDeep} />
      <circle cx="292" cy="150" r="6" fill={C.coral} />
      <path d="M40 60 L66 76" stroke={C.navy} strokeWidth="3" strokeLinecap="round" />
      <path d="M60 72 l8 5 l-9 2" fill="none" stroke={C.navy} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function HistoryArt() {
  return (
    <g>
      <rect x="70" y="30" width="150" height="120" rx="10" fill={C.white} stroke={C.navy} strokeWidth="4" />
      <path d="M92 58 h104 M92 78 h104 M92 98 h70" stroke={C.sun} strokeWidth="6" strokeLinecap="round" />
      <path d="M92 120 h40" stroke={C.coral} strokeWidth="6" strokeLinecap="round" />
      <circle cx="226" cy="112" r="30" fill={C.skySoft} fillOpacity="0.7" stroke={C.navy} strokeWidth="5" />
      <path d="M248 134 L276 162" stroke={C.navy} strokeWidth="8" strokeLinecap="round" />
      <circle cx="46" cy="44" r="10" fill={C.coral} />
      <path d="M46 54 V96" stroke={C.navy} strokeWidth="3" />
      <circle cx="280" cy="42" r="6" fill={C.skyDeep} />
    </g>
  );
}

function PlatformerArt() {
  return (
    <g>
      <rect x="0" y="140" width="110" height="40" fill={C.mint} />
      <rect x="210" y="140" width="110" height="40" fill={C.mint} />
      <rect x="120" y="100" width="80" height="16" rx="6" fill={C.sky} stroke={C.navy} strokeWidth="3" />
      <path d="M40 130 Q120 20 170 92" fill="none" stroke={C.navy} strokeOpacity="0.35" strokeWidth="3" strokeDasharray="6 8" />
      <rect x="28" y="108" width="24" height="32" rx="8" fill={C.coral} stroke={C.navy} strokeWidth="3" />
      <circle cx="44" cy="118" r="3" fill={C.navy} />
      <rect x="250" y="96" width="30" height="44" rx="4" fill={C.sun} stroke={C.navy} strokeWidth="3" />
      <circle cx="272" cy="120" r="3" fill={C.navy} />
      <circle cx="260" cy="40" r="16" fill={C.sun} />
      <circle cx="90" cy="40" r="4" fill={C.white} />
      <circle cx="150" cy="30" r="3" fill={C.white} />
    </g>
  );
}

function LabArt() {
  return (
    <g>
      <path d="M140 30 h40 M148 30 v44 l-36 64 a10 10 0 0 0 9 14 h78 a10 10 0 0 0 9 -14 l-36 -64 v-44" fill={C.white} stroke={C.navy} strokeWidth="4" strokeLinejoin="round" />
      <path d="M124 116 h72 l12 22 a10 10 0 0 1 -9 14 h-78 a10 10 0 0 1 -9 -14 z" fill={C.coral} />
      <circle cx="150" cy="130" r="5" fill={C.white} />
      <circle cx="168" cy="138" r="4" fill={C.white} />
      <circle cx="176" cy="18" r="6" fill={C.skyDeep} />
      <circle cx="196" cy="8" r="4" fill={C.mint} />
      <rect x="40" y="70" width="44" height="44" rx="10" fill={C.sky} stroke={C.navy} strokeWidth="3" />
      <rect x="240" y="80" width="40" height="40" rx="20" fill={C.sun} stroke={C.navy} strokeWidth="3" />
    </g>
  );
}

/** Small square spot illustration for empty states and banners. */
export function LibrarySpot({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 160 140" className={className} aria-hidden focusable="false">
      <circle cx="80" cy="74" r="62" fill={C.skySoft} />
      <rect x="34" y="38" width="22" height="76" rx="4" fill={C.sky} stroke={C.navy} strokeWidth="3" />
      <rect x="58" y="28" width="22" height="86" rx="4" fill={C.sun} stroke={C.navy} strokeWidth="3" />
      <rect x="82" y="46" width="22" height="68" rx="4" fill={C.mint} stroke={C.navy} strokeWidth="3" />
      <rect x="104" y="40" width="22" height="80" rx="4" fill={C.coral} stroke={C.navy} strokeWidth="3" transform="rotate(12 115 80)" />
      <path d="M26 116 h108" stroke={C.navy} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** Forge/"building" spot: gears and sparkles. */
export function ForgeSpot({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 160 140" className={className} aria-hidden focusable="false">
      <circle cx="80" cy="72" r="62" fill={C.skySoft} />
      <circle cx="66" cy="78" r="28" fill={C.sky} stroke={C.navy} strokeWidth="4" strokeDasharray="10 5" />
      <circle cx="66" cy="78" r="10" fill={C.white} stroke={C.navy} strokeWidth="4" />
      <circle cx="110" cy="50" r="18" fill={C.sun} stroke={C.navy} strokeWidth="4" strokeDasharray="7 4" />
      <circle cx="110" cy="50" r="6" fill={C.white} stroke={C.navy} strokeWidth="3" />
      <path d="M120 100 l4 9 l9 4 l-9 4 l-4 9 l-4 -9 l-9 -4 l9 -4 z" fill={C.coral} />
      <circle cx="36" cy="36" r="5" fill={C.mint} />
    </svg>
  );
}

/** Trophy spot for completion / debrief. */
export function TrophySpot({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 160 140" className={className} aria-hidden focusable="false">
      <circle cx="80" cy="72" r="62" fill={C.sunSoft} />
      <path d="M52 30 h56 v22 a28 28 0 0 1 -56 0 z" fill={C.sun} stroke={C.navy} strokeWidth="4" strokeLinejoin="round" />
      <path d="M52 38 h-12 a14 14 0 0 0 14 20 M108 38 h12 a14 14 0 0 1 -14 20" fill="none" stroke={C.navy} strokeWidth="4" strokeLinecap="round" />
      <path d="M80 80 v16 M62 108 h36 v-12 h-36 z" fill={C.sky} stroke={C.navy} strokeWidth="4" strokeLinejoin="round" />
      <path d="M80 42 l4 8 l8 1 l-6 6 l2 8 l-8 -4 l-8 4 l2 -8 l-6 -6 l8 -1 z" fill={C.white} />
      <path d="M30 40 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" fill={C.skyDeep} />
      <path d="M130 90 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" fill={C.coral} />
    </svg>
  );
}
