"use client";

import { useId } from "react";
import type { CardModel } from "@/world/types";
import { useElementSize, usePanelMetrics } from "../metrics";
import { CardFrame } from "./CardFrame";

export type EnergyCellsCardModel = Extract<CardModel, { kind: "energy_cells" }>;

/** EnergyCellsCard (§3.2): N gold cells: spent (dark), projected (hatched), a chip "−2" for the projected spend. */
export function EnergyCellsCard({ model }: { model: EnergyCellsCardModel }) {
  const m = usePanelMetrics();
  const [ref, size] = useElementSize<HTMLDivElement>({ w: 640, h: 120 });
  const uid = useId().replace(/:/g, "");
  const { w, h } = size;
  const n = Math.max(1, Math.min(24, model.total));
  const chipW = m.fsChip * 2.6;
  const avail = w - chipW - 40;
  const cw = Math.min(46, avail / n - 8);
  const ch = Math.min(h - 28, cw * 1.6);
  const y = (h - ch) / 2;
  return (
    <CardFrame ref={ref} kind="energy_cells" tab={model.title}>
      {size.measured ? (
      <svg role="img" aria-labelledby={`${uid}-t ${uid}-d`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} focusable="false">
          <title id={`${uid}-t`}>{model.title}</title>
          <desc id={`${uid}-d`}>{model.sr}</desc>
          <defs>
            <pattern id={`${uid}-hatch`} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width={8} height={8} fill="#5a4a1e" />
              <line x1={0} y1={0} x2={0} y2={8} stroke="var(--glow-gold)" strokeWidth={4} />
            </pattern>
          </defs>
          <g aria-hidden>
            {Array.from({ length: n }, (_, i) => {
              const spent = i >= n - model.spent;
              const projected = !spent && i >= n - model.spent - model.projected;
              const x = 20 + i * (cw + 8);
              return (
                <g key={i}>
                  <rect x={x + cw * 0.3} y={y - 5} width={cw * 0.4} height={5} fill={spent ? "#3a3320" : "var(--glow-gold)"} />
                  <rect
                    x={x}
                    y={y}
                    width={cw}
                    height={ch}
                    rx={4}
                    fill={spent ? "#2a2a22" : projected ? `url(#${uid}-hatch)` : "var(--glow-gold)"}
                    stroke={spent ? "#5b5a4c" : "var(--glow-gold)"}
                    strokeWidth={2}
                  />
                </g>
              );
            })}
            {model.projected > 0 ? (
              <g>
                <rect x={w - chipW - 12} y={h / 2 - m.fsChip * 0.75} width={chipW} height={m.fsChip * 1.5} fill="var(--ui-card-deep)" stroke="var(--glow-gold)" strokeWidth={2} />
                <text className="xp-svg-text" x={w - chipW / 2 - 12} y={h / 2 + m.fsChip * 0.36} textAnchor="middle" fontSize={m.fsChip}>
                  {`−${model.projected}`}
                </text>
              </g>
            ) : null}
          </g>
        </svg>
      ) : null}
    </CardFrame>
  );
}
