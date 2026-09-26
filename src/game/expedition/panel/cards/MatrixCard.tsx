"use client";

import type { CardModel } from "@/world/types";
import { CardFrame } from "./CardFrame";

export type MatrixCardModel = Extract<CardModel, { kind: "matrix" }>;

export interface MatrixInteraction {
  onToggle: (clueIndex: number, hypothesisId: string) => void;
  onAccuse: (hypothesisId: string) => void;
  onFocusKey: (key: string | null) => void;
  describedBy: string;
  disabled: boolean;
}

/**
 * MatrixCard (§3.2): clue columns × hypothesis rows, strike toggles (the player's own notation, UI-only), an ACCUSE
 * socket per row, and optional struck-count shading (the rung-3 hint). With `interaction` it is MatrixControl's
 * surface. A native <table> keeps row/column headers for screen readers; every toggle is a real button.
 */
export function MatrixCard({ model, interaction, grow = 2 }: { model: MatrixCardModel; interaction?: MatrixInteraction; grow?: 0 | 1 | 2 }) {
  const marked = new Set(model.marks.map((m) => `${m.clueIndex}:${m.hypothesisId}`));
  const struck = (id: string) => model.marks.filter((m) => m.hypothesisId === id).length;
  const maxStruck = Math.max(1, model.clues.length);
  return (
    <CardFrame kind="matrix" title={model.title} grow={grow}>
      <div className="xp-card-html">
        <ol style={{ margin: "0 0 12px", paddingLeft: "1.6em", display: "grid", gap: 6, listStyle: "decimal" }} aria-label="Clues">
          {model.clues.map((c) => (
            <li key={c.index} style={{ fontSize: "var(--xp-fs-small)", lineHeight: 1.35 }}>
              {c.date ? <strong style={{ marginRight: 8 }}>{c.date}</strong> : null}
              {c.text}
            </li>
          ))}
        </ol>
        <table className="xp-matrix" aria-describedby={interaction?.describedBy}>
          <caption className="xp-sr-only">{model.sr}</caption>
          <thead>
            <tr>
              <th scope="col">Explanation</th>
              {model.clues.map((c) => (
                <th key={c.index} scope="col" style={{ textAlign: "center", width: 56 }}>
                  <span aria-hidden>{c.index + 1}</span>
                  <span className="xp-sr-only">{`clue ${c.index + 1}`}</span>
                </th>
              ))}
              <th scope="col" style={{ textAlign: "center" }}>
                ACCUSE
              </th>
            </tr>
          </thead>
          <tbody>
            {model.hypotheses.map((h, row) => {
              const n = struck(h.id);
              const accused = model.accused === h.id;
              const shade = model.shadeCounts ? n / maxStruck : 0;
              return (
                <tr key={h.id} style={{ background: shade ? `rgba(157, 184, 190, ${0.08 + 0.22 * shade})` : undefined }}>
                  <th scope="row" style={{ fontWeight: 500, opacity: n > 0 && !accused ? 0.75 : 1 }}>
                    {h.text}
                  </th>
                  {model.clues.map((c) => {
                    const on = marked.has(`${c.index}:${h.id}`);
                    return (
                      <td key={c.index} style={{ textAlign: "center", padding: 2 }}>
                        {interaction ? (
                          <button
                            type="button"
                            className="xp-strike"
                            aria-pressed={on}
                            aria-label={`Clue ${c.index + 1} rules out: ${h.text}`}
                            disabled={interaction.disabled}
                            onFocus={() => interaction.onFocusKey(`clue:${c.index}:${h.id}`)}
                            onBlur={() => interaction.onFocusKey(null)}
                            onClick={() => interaction.onToggle(c.index, h.id)}
                          >
                            {on ? "✕" : ""}
                          </button>
                        ) : (
                          <span aria-label={on ? "struck" : "open"}>{on ? "✕" : ""}</span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "center", padding: 2 }}>
                    {interaction ? (
                      <button
                        type="button"
                        className="xp-strike"
                        aria-pressed={accused}
                        aria-label={`Accuse: ${h.text}`}
                        data-testid={row === 0 ? "widget-first-option" : undefined}
                        disabled={interaction.disabled}
                        onFocus={() => interaction.onFocusKey(h.id)}
                        onBlur={() => interaction.onFocusKey(null)}
                        onClick={() => interaction.onAccuse(h.id)}
                        style={{ borderColor: accused ? "var(--ui-accent)" : undefined, boxShadow: accused ? "0 0 0 2px var(--ui-accent)" : undefined }}
                      >
                        <span aria-hidden style={{ display: "inline-block", width: 18, height: 18, borderRadius: "50%", border: "2.5px solid currentColor", background: accused ? "var(--ui-accent)" : "transparent" }} />
                      </button>
                    ) : (
                      <span aria-label={accused ? "accused" : ""}>{accused ? "●" : "○"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CardFrame>
  );
}
