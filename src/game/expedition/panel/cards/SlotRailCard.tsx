"use client";

import type { CardModel } from "@/world/types";
import { useRoving } from "../roving";
import { CardFrame } from "./CardFrame";

export type SlotRailCardModel = Extract<CardModel, { kind: "slot_rail" }>;

export interface SlotRailInteraction {
  onSlot: (index: number) => void;
  onFocusSlot: (index: number | null) => void;
  holding: string | null;
  describedBy: string;
  disabled: boolean;
}

function Pylon() {
  return (
    <svg width="22" height="40" viewBox="0 0 22 40" aria-hidden focusable="false">
      <path d="M11 2 L19 38 H3 Z" fill="none" stroke="var(--ui-line)" strokeWidth="1.5" />
      <path d="M6 26 H16 M8 16 H14" stroke="var(--ui-line)" strokeWidth="1.5" />
      <circle cx="11" cy="2.5" r="2.5" fill="var(--ui-line)" />
    </svg>
  );
}

/**
 * SlotRailCard (§3.2): numbered slots joined by dot-ended trace lines, pylon glyphs on the right, an optional heading
 * ("AS PRINTED IN CH. 21"). Lamps light when a slot is filled (filled, not correct). With `interaction` it is the
 * SlotRailControl's surface: Enter on a slot places the held plank there, or lifts the plank already in it.
 */
export function SlotRailCard({ model, interaction, grow = 2 }: { model: SlotRailCardModel; interaction?: SlotRailInteraction; grow?: 0 | 1 | 2 }) {
  const roving = useRoving(model.slots.length, { onMove: interaction ? (i) => interaction.onFocusSlot(i) : undefined });
  return (
    <CardFrame kind="slot_rail" title={model.title} grow={grow}>
      <div className="xp-card-html" style={{ display: "flex", gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {model.heading ? (
            <div className="xp-caps" style={{ marginBottom: 10 }}>
              {model.heading}
            </div>
          ) : null}
          <ol
            className="xp-items"
            aria-label={`${model.title}: ${model.sr}`}
            aria-describedby={interaction?.describedBy}
            onKeyDown={interaction ? roving.onKeyDown : undefined}
            style={{ gap: 0 }}
          >
            {model.slots.map((s, i) => {
              const rp = roving.itemProps(i);
              const label = s.label ?? (interaction?.holding ? "place here" : "empty");
              const inner = (
                <>
                  <span className="xp-letter" aria-hidden style={{ borderRadius: 4 }}>
                    {s.index + 1}
                  </span>
                  <span className="xp-clamp3" style={{ flex: 1, opacity: s.label ? 1 : 0.55, fontStyle: s.label ? "normal" : "italic" }}>
                    {label}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      width: 16,
                      height: 16,
                      marginTop: 6,
                      borderRadius: "50%",
                      border: "2px solid var(--ui-line)",
                      background: s.lamp === "on" ? "var(--ui-line)" : "transparent",
                      boxShadow: s.lamp === "on" ? "0 0 8px var(--ui-line-glow)" : "none",
                    }}
                  />
                </>
              );
              return (
                <li key={s.index} style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
                  {i > 0 ? <span aria-hidden style={{ alignSelf: "flex-start", marginLeft: 26, width: 0, height: 12, borderLeft: "1.5px solid var(--ui-line)" }} /> : null}
                  {interaction ? (
                    <button
                      type="button"
                      className="xp-item"
                      data-state={s.key ? "placed" : "idle"}
                      data-testid={`slot-${i}`}
                      aria-label={`Slot ${i + 1}: ${s.label ?? "empty"}${interaction.holding ? ". Enter places the held plank here" : s.key ? ". Enter lifts it back to the tray" : ""}`}
                      disabled={interaction.disabled}
                      ref={rp.ref}
                      tabIndex={rp.tabIndex}
                      onFocus={rp.onFocus}
                      onBlur={() => interaction.onFocusSlot(null)}
                      onClick={() => interaction.onSlot(i)}
                    >
                      {inner}
                    </button>
                  ) : (
                    <div className="xp-item" data-state={s.key ? "placed" : "idle"}>
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
        <div aria-hidden style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 8 }}>
          {Array.from({ length: Math.max(0, model.anchorsRight) }, (_, i) => (
            <Pylon key={i} />
          ))}
        </div>
      </div>
    </CardFrame>
  );
}
