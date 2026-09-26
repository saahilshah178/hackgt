"use client";

import { useId } from "react";
import type { CardModel } from "@/world/types";
import { useElementSize } from "../metrics";
import { CardFrame } from "./CardFrame";

export type CauseGraphCardModel = Extract<CardModel, { kind: "cause_graph" }>;

export interface CauseGraphInteraction {
  from: string | null;
  onNode: (key: string) => void;
  onRemove: (fromKey: string) => void;
  onFocusKey: (key: string | null) => void;
  describedBy: string;
  disabled: boolean;
}

/**
 * CauseGraphCard (§3.2): a node/arrow board, the TubeControl's surface. Housings sit at their (x, y) fractions;
 * tubes are drawn WHITE (a laid tube is a draft, not a verdict), the focused one glows. Keyboard: Tab through the
 * housings, Enter starts a tube and Enter on another lays it; Delete on a housing removes its outgoing tube.
 */
export function CauseGraphCard({ model, interaction, grow = 2 }: { model: CauseGraphCardModel; interaction?: CauseGraphInteraction; grow?: 0 | 1 | 2 }) {
  const [ref, size] = useElementSize<HTMLDivElement>({ w: 640, h: 360 });
  const uid = useId().replace(/:/g, "");
  const { w, h } = size;
  const n = Math.max(1, model.nodes.length);
  const boxW = Math.min(260, Math.max(140, (w / Math.ceil(n / 2)) * 0.86));
  const boxH = Math.min(120, h * 0.34);
  const pos = new Map(model.nodes.map((nd) => [nd.key, { x: nd.x * w, y: nd.y * h }]));
  const outgoing = new Set(model.edges.map((e) => e.fromKey));
  const edgePath = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    // leave and enter each housing on the side facing the other one
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const horizontal = Math.abs(dx) / boxW > Math.abs(dy) / boxH;
    const ax = horizontal ? a.x + Math.sign(dx) * (boxW / 2) : a.x;
    const ay = horizontal ? a.y : a.y + Math.sign(dy) * (boxH / 2);
    const bx = horizontal ? b.x - Math.sign(dx) * (boxW / 2 + 6) : b.x;
    const by = horizontal ? b.y : b.y - Math.sign(dy) * (boxH / 2 + 6);
    return `M${ax} ${ay} C ${horizontal ? (ax + bx) / 2 : ax} ${horizontal ? ay : (ay + by) / 2}, ${horizontal ? (ax + bx) / 2 : bx} ${horizontal ? by : (ay + by) / 2}, ${bx} ${by}`;
  };
  return (
    <CardFrame ref={ref} kind="cause_graph" title={model.title} grow={grow}>
      {size.measured ? (
      <svg aria-hidden focusable="false" width={w} height={h} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <marker id={`${uid}-a`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="var(--ui-line)" />
          </marker>
        </defs>
        {model.edges.map((e) => {
          const a = pos.get(e.fromKey);
          const b = pos.get(e.toKey);
          if (!a || !b) return null;
          const d = edgePath(a, b);
          return (
            <g key={`${e.fromKey}-${e.toKey}`}>
              {e.state === "focus" ? <path d={d} fill="none" stroke="var(--ui-line-glow)" strokeWidth={11} strokeLinecap="round" /> : null}
              <path d={d} fill="none" stroke="var(--ui-line)" strokeWidth={3.5} markerEnd={`url(#${uid}-a)`} />
            </g>
          );
        })}
      </svg>
      ) : null}
      <div role={interaction ? "group" : "list"} aria-label={`${model.title}: ${model.sr}`} aria-describedby={interaction?.describedBy} style={{ position: "absolute", inset: 0 }}>
        {model.nodes.map((nd, i) => {
          const p = pos.get(nd.key)!;
          const style: React.CSSProperties = {
            position: "absolute",
            left: p.x - boxW / 2,
            top: p.y - boxH / 2,
            width: boxW,
            height: boxH,
            overflow: "hidden",
            fontSize: "var(--xp-fs-small)",
            alignItems: "flex-start",
          };
          const text = <span className="xp-clamp3">{nd.label}</span>;
          if (!interaction) {
            return (
              <div key={nd.key} role="listitem" className="xp-token" style={style}>
                {text}
              </div>
            );
          }
          const picking = interaction.from === nd.key;
          return (
            <button
              key={nd.key}
              type="button"
              className="xp-token"
              style={style}
              aria-pressed={picking}
              data-state={picking ? "focus" : undefined}
              data-testid={i === 0 ? "widget-first-option" : undefined}
              aria-label={`${nd.label}${outgoing.has(nd.key) ? " (has an outgoing tube)" : ""}${picking ? ". Choose where its tube leads" : ""}`}
              disabled={interaction.disabled}
              onFocus={() => interaction.onFocusKey(nd.key)}
              onBlur={() => interaction.onFocusKey(null)}
              onClick={() => interaction.onNode(nd.key)}
              onKeyDown={(e) => {
                if ((e.key === "Delete" || e.key === "Backspace") && outgoing.has(nd.key)) {
                  e.preventDefault();
                  interaction.onRemove(nd.key);
                }
              }}
            >
              {text}
            </button>
          );
        })}
      </div>
    </CardFrame>
  );
}
