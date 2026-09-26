"use client";

import { useRoving } from "./roving";

/** The five orb fill patterns (bible §3.6): each encodes a different claim about a point of interest. */
export type OrbFill = "full" | "ring" | "half" | "dot" | "hollow";
export const ORB_FILLS: readonly OrbFill[] = ["full", "ring", "half", "dot", "hollow"];

export function OrbGlyph({ fill, size = 60 }: { fill: OrbFill; size?: number }) {
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden focusable="false">
      <circle cx={r} cy={r} r={r - 3} fill={fill === "full" ? "var(--orb-fill)" : "var(--ui-card-deep)"} stroke="var(--orb-ring)" strokeWidth={3} />
      {fill === "half" ? <path d={`M${r} 3 A ${r - 3} ${r - 3} 0 0 0 ${r} ${size - 3} Z`} fill="var(--orb-fill)" /> : null}
      {fill === "dot" ? <circle cx={r} cy={r} r={r * 0.28} fill="var(--orb-fill)" /> : null}
      {fill === "hollow" ? <circle cx={r} cy={r} r={r * 0.52} fill="none" stroke="var(--orb-fill)" strokeWidth={r * 0.3} /> : null}
      {fill === "ring" ? <circle cx={r} cy={r} r={r - 9} fill="none" stroke="var(--orb-ring)" strokeWidth={1.5} opacity={0.6} /> : null}
    </svg>
  );
}

/**
 * The orb palette column (§3.2, bible §3.6; board mode, for the function_world contraptions): 60 px orbs in the five
 * glyph fills, hollow-circle terminals top and bottom, a pencil button that authors a new orb. Keyboard: Tab to the
 * column, ↑/↓ between orbs, Enter picks one up (the board then snaps it between points of interest).
 */
export function OrbPalette({
  orbs,
  picked,
  onPick,
  onPencil,
  columns = 1,
}: {
  orbs: readonly { key: string; fill: OrbFill; label: string; placed: boolean }[];
  picked: string | null;
  onPick: (key: string) => void;
  onPencil?: () => void;
  columns?: number;
}) {
  const roving = useRoving(orbs.length, { onQuick: (i) => onPick(orbs[i].key) });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid var(--ui-line)" }} />
      <div className="xp-orbs" role="listbox" aria-label="Orb palette" onKeyDown={roving.onKeyDown} style={{ ["--xp-orb-cols" as string]: columns }}>
        {orbs.map((o, i) => {
          const rp = roving.itemProps(i);
          return (
            <button
              key={o.key}
              type="button"
              role="option"
              aria-selected={picked === o.key}
              aria-label={`${o.label}${o.placed ? " (placed)" : ""}`}
              className="xp-orb"
              style={{ opacity: o.placed ? 0.35 : 1 }}
              ref={rp.ref}
              tabIndex={rp.tabIndex}
              onFocus={rp.onFocus}
              onClick={() => onPick(o.key)}
            >
              <OrbGlyph fill={o.fill} />
            </button>
          );
        })}
        {onPencil ? (
          <button type="button" className="xp-pencil" aria-label="Create a new orb" onClick={onPencil}>
            <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden focusable="false">
              <path d="M4 22 L6 15 L17 4 L22 9 L11 20 Z M15 6 L20 11" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}
      </div>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid var(--ui-line)" }} />
    </div>
  );
}
