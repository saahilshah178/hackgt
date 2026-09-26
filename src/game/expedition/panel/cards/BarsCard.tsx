"use client";

import { useId } from "react";
import { fmtNumber } from "@/world/graph-math";
import type { CardModel } from "@/world/types";
import { useElementSize, usePanelMetrics } from "../metrics";
import { CardFrame, FN_VAR } from "./CardFrame";
import { small } from "./GraphCard";

export type BarsCardModel = Extract<CardModel, { kind: "bars" }>;

/**
 * BarsCard (§3.2): gauges (solute outside / inside, a charge ledger), an optional sparkline with a WHITE timer line
 * (timers are not input, so never orange) and a net-flow arrow between the first two gauges.
 */
export function BarsCard({ model }: { model: BarsCardModel }) {
  const m = usePanelMetrics();
  const [ref, size] = useElementSize<HTMLDivElement>({ w: 640, h: 220 });
  const uid = useId().replace(/:/g, "");
  const { w, h } = size;
  const fs = m.fsTick;
  const spark = model.sparkline;
  const gaugeW = spark ? w * 0.56 : w;
  const n = Math.max(1, model.bars.length);
  const top = fs + 20;
  const bottom = small(fs) + 18;
  const barH = Math.max(10, h - top - bottom);
  const slot = (gaugeW - 24) / n;
  const bw = Math.min(64, slot * 0.42);
  const xs = model.bars.map((_, i) => 24 + slot * (i + 0.5));

  return (
    <CardFrame ref={ref} kind="bars" tab={model.title}>
      {size.measured ? (
      <svg role="img" aria-labelledby={`${uid}-t ${uid}-d`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} focusable="false">
          <title id={`${uid}-t`}>{model.title}</title>
          <desc id={`${uid}-d`}>{model.sr}</desc>
          <g aria-hidden>
            {model.bars.map((bar, i) => {
              const frac = bar.max > 0 ? Math.min(1, Math.max(0, bar.value / bar.max)) : 0;
              const x = xs[i] - bw / 2;
              return (
                <g key={bar.id}>
                  <rect x={x} y={top} width={bw} height={barH} fill="var(--ui-card-deep)" stroke="var(--ui-line)" strokeWidth={1.5} />
                  {[0.25, 0.5, 0.75].map((q) => (
                    <line key={q} x1={x} x2={x + 8} y1={top + barH * (1 - q)} y2={top + barH * (1 - q)} stroke="var(--ui-grid-major)" strokeWidth={1} />
                  ))}
                  <rect x={x + 3} y={top + barH * (1 - frac)} width={bw - 6} height={Math.max(0, barH * frac - 3)} fill={FN_VAR[bar.color]} opacity={0.85} />
                  <text className="xp-svg-text" x={xs[i]} y={top - 8} textAnchor="middle" fontSize={fs} fontWeight={600}>
                    {fmtNumber(bar.value, Number.isInteger(bar.value) ? 0 : 1)}
                  </text>
                  <text className="xp-svg-text" x={xs[i]} y={h - 8} textAnchor="middle" fontSize={small(fs)} fill="var(--ui-text-dim)">
                    {bar.label}
                  </text>
                </g>
              );
            })}
            {model.arrow && model.arrow !== "none" && xs.length >= 2 ? (
              <g stroke="var(--ui-line)" strokeWidth={3} fill="var(--ui-line)">
                <line x1={xs[0] + bw / 2 + 10} x2={xs[1] - bw / 2 - 10} y1={top + barH / 2} y2={top + barH / 2} />
                {model.arrow === "in" || model.arrow === "both" ? (
                  <polygon points={`${xs[1] - bw / 2 - 6},${top + barH / 2} ${xs[1] - bw / 2 - 18},${top + barH / 2 - 8} ${xs[1] - bw / 2 - 18},${top + barH / 2 + 8}`} />
                ) : null}
                {model.arrow === "out" || model.arrow === "both" ? (
                  <polygon points={`${xs[0] + bw / 2 + 6},${top + barH / 2} ${xs[0] + bw / 2 + 18},${top + barH / 2 - 8} ${xs[0] + bw / 2 + 18},${top + barH / 2 + 8}`} />
                ) : null}
              </g>
            ) : null}
            {spark ? (
              <g>
                <rect x={gaugeW + 8} y={top} width={w - gaugeW - 24} height={barH} fill="var(--ui-card-deep)" stroke="var(--ui-grid-major)" strokeWidth={1} />
                <polyline
                  points={spark.points
                    .map((p, i) => {
                      const x = gaugeW + 12 + ((w - gaugeW - 32) * i) / Math.max(1, spark.points.length - 1);
                      const y = top + barH - 4 - ((barH - 8) * Math.min(1, Math.max(0, p / (spark.max || 1))));
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke={FN_VAR[spark.color]}
                  strokeWidth={3}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {model.timer ? (
                  <line
                    x1={gaugeW + 12 + (w - gaugeW - 32) * Math.min(1, Math.max(0, model.timer.fraction))}
                    x2={gaugeW + 12 + (w - gaugeW - 32) * Math.min(1, Math.max(0, model.timer.fraction))}
                    y1={top - 4}
                    y2={top + barH + 4}
                    stroke="#ffffff"
                    strokeWidth={3}
                  />
                ) : null}
              </g>
            ) : null}
          </g>
        </svg>
      ) : null}
    </CardFrame>
  );
}
