"use client";

import { useRoving } from "../roving";
import type { CardModel } from "@/world/types";
import { CardFrame } from "./CardFrame";

export type ClaimsCardModel = Extract<CardModel, { kind: "claims" }>;

export interface ClaimsInteraction {
  onHover: (key: string | null) => void;
  onFocusItem: (key: string | null) => void;
  onChoose: (key: string) => void;
  describedBy: string;
  disabled: boolean;
}

/**
 * ClaimsCard (§3.2): the claim column. A letter glyph, the claim (3 lines max), a hollow aim socket (aimed = orange
 * ring). With `interaction` it is AimControl's surface: a radiogroup, W/S or ↑/↓ to move, 1–9 quick-select, Enter or
 * Space to aim; pointer hover and keyboard focus report hover/focus drafts (the world previews), choosing commits.
 */
export function ClaimsCard({ model, interaction, grow = 2 }: { model: ClaimsCardModel; interaction?: ClaimsInteraction; grow?: 0 | 1 | 2 }) {
  const roving = useRoving(model.items.length, {
    onQuick: interaction ? (i) => interaction.onChoose(model.items[i].key) : undefined,
    onMove: interaction ? (i) => interaction.onFocusItem(model.items[i]?.key ?? null) : undefined,
  });
  const body = (
    <>
      {model.scenario ? (
        <p style={{ margin: "0 0 12px", fontSize: "var(--xp-fs-body)", lineHeight: 1.35 }} data-testid="claims-scenario">
          {model.scenario}
        </p>
      ) : null}
      <div
        role={interaction ? "radiogroup" : "list"}
        aria-label={model.title}
        aria-describedby={interaction?.describedBy}
        className="xp-items"
        onKeyDown={interaction ? roving.onKeyDown : undefined}
        onPointerLeave={interaction ? () => interaction.onHover(null) : undefined}
      >
        {model.items.map((it, i) => {
          const content = (
            <>
              <span className="xp-letter" aria-hidden>
                {it.letter}
              </span>
              <span className="xp-clamp3" style={{ flex: 1 }}>
                {it.text}
              </span>
              <span className="xp-socket" aria-hidden />
            </>
          );
          if (!interaction) {
            return (
              <div key={it.key} role="listitem" className="xp-item" data-state={it.state}>
                {content}
              </div>
            );
          }
          const aimed = it.state === "aimed";
          const rp = roving.itemProps(i);
          return (
            <button
              key={it.key}
              type="button"
              role="radio"
              aria-checked={aimed}
              aria-label={`${it.letter}: ${it.text}`}
              className="xp-item"
              data-state={it.state}
              data-testid={i === 0 ? "widget-first-option" : undefined}
              data-key={it.key}
              disabled={interaction.disabled}
              ref={rp.ref}
              tabIndex={rp.tabIndex}
              onFocus={rp.onFocus}
              onBlur={() => interaction.onFocusItem(null)}
              onPointerEnter={() => interaction.onHover(it.key)}
              onClick={() => interaction.onChoose(it.key)}
            >
              {content}
            </button>
          );
        })}
      </div>
    </>
  );
  return (
    <CardFrame kind="claims" title={model.title} grow={grow}>
      <div className="xp-card-html" aria-label={interaction ? undefined : model.sr}>
        {body}
      </div>
    </CardFrame>
  );
}
