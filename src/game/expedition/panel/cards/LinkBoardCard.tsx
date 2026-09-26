"use client";

import { useRef } from "react";
import type { CardModel } from "@/world/types";
import { useRoving } from "../roving";
import { useAnchors } from "./anchors";
import { CardFrame } from "./CardFrame";

export type LinkBoardCardModel = Extract<CardModel, { kind: "link_board" }>;

export interface LinkBoardInteraction {
  selectedLeft: string | null;
  selectedRight: string | null;
  onLeft: (key: string) => void;
  onRight: (key: string) => void;
  onUnlink: (leftKey: string) => void;
  onFocusKey: (key: string | null) => void;
  describedBy: string;
  disabled: boolean;
}

/**
 * LinkBoardCard (§3.2): sockets on the left, cartridges / roles on the right, cords between them. Cords are WHITE
 * whether drafted or seated (seated is not correct, §2.5.6); the focused cord glows. With `interaction` it is the
 * CableControl's surface: pick a socket then a cartridge (or the reverse); Delete / Backspace on a socket unseats.
 */
export function LinkBoardCard({ model, interaction, grow = 2 }: { model: LinkBoardCardModel; interaction?: LinkBoardInteraction; grow?: 0 | 1 | 2 }) {
  const box = useRef<HTMLDivElement>(null);
  const anchors = useAnchors(box, JSON.stringify(model.links) + model.lefts.length + model.rights.length);
  const left = useRoving(model.lefts.length, { onMove: interaction ? (i) => interaction.onFocusKey(model.lefts[i]?.key ?? null) : undefined });
  const right = useRoving(model.rights.length, { onMove: interaction ? (i) => interaction.onFocusKey(model.rights[i]?.key ?? null) : undefined });
  const seatedTo = new Map(model.links.map((l) => [l.leftKey, l.rightKey]));
  const usedRights = new Set(model.links.map((l) => l.rightKey));
  const labelOf = new Map(model.rights.map((r) => [r.key, r.label]));
  return (
    <CardFrame kind="link_board" title={model.title} grow={grow}>
      <div className="xp-card-html" ref={box} style={{ position: "absolute", inset: 0 }}>
        <svg aria-hidden focusable="false" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
          {model.links.map((l) => {
            const a = anchors.get(`L:${l.leftKey}`);
            const b = anchors.get(`R:${l.rightKey}`);
            if (!a || !b) return null;
            const x0 = a.right;
            const x1 = b.left;
            const mid = (x0 + x1) / 2;
            const d = `M${x0} ${a.cy} C ${mid} ${a.cy + 26}, ${mid} ${b.cy + 26}, ${x1} ${b.cy}`;
            return (
              <g key={`${l.leftKey}-${l.rightKey}`}>
                {l.state === "focus" ? <path d={d} fill="none" stroke="var(--ui-line-glow)" strokeWidth={10} strokeLinecap="round" /> : null}
                <path d={d} fill="none" stroke="var(--ui-line)" strokeWidth={3} strokeLinecap="round" />
                <circle cx={x0} cy={a.cy} r={4.5} fill="var(--ui-line)" />
                <circle cx={x1} cy={b.cy} r={4.5} fill="var(--ui-line)" />
              </g>
            );
          })}
        </svg>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: "clamp(40px, 12cqw, 110px)", alignItems: "start" }}>
          <div role={interaction ? "listbox" : "list"} aria-label="Sockets" aria-describedby={interaction?.describedBy} className="xp-items" onKeyDown={interaction ? left.onKeyDown : undefined}>
            {model.lefts.map((l, i) => {
              const rp = left.itemProps(i);
              const seated = seatedTo.get(l.key);
              return interaction ? (
                <button
                  key={l.key}
                  type="button"
                  role="option"
                  aria-selected={interaction.selectedLeft === l.key}
                  aria-label={`${l.label}${seated ? `, connected to ${labelOf.get(seated)}` : ", not connected"}`}
                  className="xp-token"
                  data-anchor={`L:${l.key}`}
                  data-testid={i === 0 ? "widget-first-option" : undefined}
                  data-state={interaction.selectedLeft === l.key ? "focus" : undefined}
                  disabled={interaction.disabled}
                  ref={rp.ref}
                  tabIndex={rp.tabIndex}
                  onFocus={rp.onFocus}
                  onBlur={() => interaction.onFocusKey(null)}
                  onClick={() => interaction.onLeft(l.key)}
                  onKeyDown={(e) => {
                    if ((e.key === "Delete" || e.key === "Backspace") && seated) {
                      e.preventDefault();
                      interaction.onUnlink(l.key);
                    }
                  }}
                >
                  <span style={{ flex: 1 }}>{l.label}</span>
                  <span aria-hidden className="xp-socket" style={{ width: 18, height: 18, background: seated ? "var(--ui-line)" : "transparent" }} />
                </button>
              ) : (
                <div key={l.key} role="listitem" className="xp-token" data-anchor={`L:${l.key}`}>
                  <span style={{ flex: 1 }}>{l.label}</span>
                  <span aria-hidden className="xp-socket" style={{ width: 18, height: 18, background: seated ? "var(--ui-line)" : "transparent" }} />
                </div>
              );
            })}
          </div>
          <div role={interaction ? "listbox" : "list"} aria-label="Cartridges" className="xp-items" onKeyDown={interaction ? right.onKeyDown : undefined}>
            {model.rights.map((r, i) => {
              const rp = right.itemProps(i);
              const inner = (
                <>
                  <span aria-hidden className="xp-socket" style={{ width: 18, height: 18, background: usedRights.has(r.key) ? "var(--ui-line)" : "transparent" }} />
                  <span style={{ flex: 1 }}>
                    {r.label}
                    {r.sub ? <span style={{ display: "block", color: "var(--ui-text-dim)" }}>{r.sub}</span> : null}
                  </span>
                </>
              );
              return interaction ? (
                <button
                  key={r.key}
                  type="button"
                  role="option"
                  aria-selected={interaction.selectedRight === r.key}
                  className="xp-token"
                  data-anchor={`R:${r.key}`}
                  data-state={interaction.selectedRight === r.key ? "focus" : undefined}
                  disabled={interaction.disabled}
                  ref={rp.ref}
                  tabIndex={rp.tabIndex}
                  onFocus={rp.onFocus}
                  onBlur={() => interaction.onFocusKey(null)}
                  onClick={() => interaction.onRight(r.key)}
                >
                  {inner}
                </button>
              ) : (
                <div key={r.key} role="listitem" className="xp-token" data-anchor={`R:${r.key}`}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </CardFrame>
  );
}
