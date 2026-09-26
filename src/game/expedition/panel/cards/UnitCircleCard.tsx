"use client";

import { useId } from "react";
import type { CardModel } from "@/world/types";
import { useElementSize, usePanelMetrics } from "../metrics";
import type { LiveChip } from "../types";
import { ValueChip } from "../ValueChip";
import { CardFrame, FN_VAR } from "./CardFrame";
import { small } from "./GraphCard";

export type UnitCircleCardModel = Extract<CardModel, { kind: "unit_circle" }>;

/**
 * UnitCircleCard (§3.2): circle and axes to ±1.2, landmark labels, hairlines every `hairlineStep`, the point, the
 * orange input arc, the green sin drop and blue cos drop (dashed), the `level` line (y = 1/2), the upper-half shade
 * and the π/6 mirror. Angles in radians, counter-clockwise from +x; y is up.
 */
export function UnitCircleCard({ model, chips = [] }: { model: UnitCircleCardModel; chips?: readonly LiveChip[] }) {
  const m = usePanelMetrics();
  const [ref, size] = useElementSize<HTMLDivElement>({ w: 640, h: 320 });
  const uid = useId().replace(/:/g, "");
  const { w, h } = size;
  const fs = m.fsTick;
  const R = Math.max(30, (Math.min(w, h) / 2 - fs * 1.9) / 1.2);
  const cx = w / 2;
  const cy = h / 2 + 4;
  const ext = R * 1.2;
  const P = (a: number, r = R) => ({ x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) });
  const arcPath = (a0: number, a1: number, r: number) => {
    const s = P(a0, r);
    const e = P(a1, r);
    const sweep = a1 > a0 ? 0 : 1;
    const large = Math.abs(a1 - a0) % (2 * Math.PI) > Math.PI ? 1 : 0;
    return `M${s.x} ${s.y} A ${r} ${r} 0 ${large} ${sweep} ${e.x} ${e.y}`;
  };
  const hair = model.hairlineStep && model.hairlineStep > 0 ? Math.min(96, Math.round((2 * Math.PI) / model.hairlineStep)) : 0;
  const pt = model.point ? P(model.point.angle) : null;
  const chipH = m.fsChip * 1.25 + 8;
  const chipTop = (v: number) => Math.min(h - chipH / 2, Math.max(chipH / 2, cy - v * R));

  return (
    <CardFrame
      ref={ref}
      gutter
      kind="unit_circle"
      tab={model.title}
      overlay={size.measured && chips.map((c, i) => (
        <ValueChip key={i} text={c.text} color={c.color} top={chipTop(c.value)} />
      ))}
    >
      {size.measured ? (
      <svg role="img" aria-labelledby={`${uid}-t ${uid}-d`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} focusable="false">
          <title id={`${uid}-t`}>{model.title}</title>
          <desc id={`${uid}-d`}>{model.sr}</desc>
          <g aria-hidden>
            {model.shadeUpperHalf ? <path d={`M${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy} Z`} fill="var(--fn-f)" opacity={0.08} /> : null}
            {Array.from({ length: hair }, (_, i) => {
              const e = P(i * (model.hairlineStep ?? 0));
              return <line key={`h${i}`} x1={cx} y1={cy} x2={e.x} y2={e.y} stroke="var(--ui-grid-minor)" strokeWidth={1} />;
            })}
            <line x1={cx - ext} x2={cx + ext} y1={cy} y2={cy} stroke="var(--ui-line)" strokeWidth={1.5} />
            <line x1={cx} x2={cx} y1={cy + ext} y2={cy - ext} stroke="var(--ui-line)" strokeWidth={1.5} />
            <polygon points={`${cx + ext + 8},${cy} ${cx + ext},${cy - 5} ${cx + ext},${cy + 5}`} fill="var(--ui-line)" />
            <polygon points={`${cx},${cy - ext - 8} ${cx - 5},${cy - ext} ${cx + 5},${cy - ext}`} fill="var(--ui-line)" />
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--ui-line)" strokeWidth={2} />
            {model.level !== null ? (
              <g>
                <line x1={cx - ext} x2={cx + ext} y1={cy - model.level * R} y2={cy - model.level * R} stroke="var(--ui-accent-hi)" strokeWidth={2} strokeDasharray="8 6" />
                <text className="xp-svg-text" x={cx + ext} y={cy - model.level * R - 8} textAnchor="end" fontSize={small(fs)} fill="var(--ui-accent-hi)">
                  {`y = ${model.level === 0.5 ? "1/2" : model.level}`}
                </text>
              </g>
            ) : null}
            {model.landmarks.map((l, i) => {
              const p = P(l.angle, ext + fs * 0.9);
              const d = P(l.angle);
              return (
                <g key={`l${i}`}>
                  <circle cx={d.x} cy={d.y} r={3.5} fill="var(--ui-line)" />
                  <text className="xp-svg-text" x={p.x} y={p.y + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight={600}>
                    {l.label}
                  </text>
                </g>
              );
            })}
            {model.arc ? <path d={arcPath(model.arc.from, model.arc.to, R * 0.3)} fill="none" stroke={FN_VAR[model.arc.color]} strokeWidth={5} strokeLinecap="round" /> : null}
            {pt && model.drops.sin ? <line x1={pt.x} y1={pt.y} x2={pt.x} y2={cy} stroke="var(--fn-g)" strokeWidth={3} strokeDasharray="7 5" /> : null}
            {pt && model.drops.cos ? <line x1={pt.x} y1={pt.y} x2={cx} y2={pt.y} stroke="var(--fn-h)" strokeWidth={3} strokeDasharray="7 5" /> : null}
            {pt ? <line x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke="var(--ui-accent)" strokeWidth={3} /> : null}
            {model.mirror ? (
              <g>
                <path d={arcPath(model.mirror.from, model.mirror.to, R * 1.06)} fill="none" stroke="var(--ui-line)" strokeWidth={1.5} strokeDasharray="4 4" />
                <circle cx={P(model.mirror.to).x} cy={P(model.mirror.to).y} r={8} fill="var(--ui-card)" stroke="var(--ui-line)" strokeWidth={2.5} />
              </g>
            ) : null}
            {pt ? (
              <g>
                <circle cx={pt.x} cy={pt.y} r={13} fill="var(--ui-accent)" opacity={0.25} />
                <circle cx={pt.x} cy={pt.y} r={7} fill="var(--fn-f)" stroke="var(--ui-accent)" strokeWidth={2.5} />
              </g>
            ) : null}
          </g>
        </svg>
      ) : null}
    </CardFrame>
  );
}
