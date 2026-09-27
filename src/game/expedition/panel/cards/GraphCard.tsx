"use client";

import { useId, type ReactNode } from "react";
import { chipY, pathOf, projectX, projectY, type PlotBox } from "@/world/graph-math";
import type { CardModel, GraphAnnotation } from "@/world/types";
import { useElementSize, usePanelMetrics, type PanelMetrics } from "../metrics";
import type { LiveChip } from "../types";
import { ValueChip } from "../ValueChip";
import { CardFrame, FN_VAR } from "./CardFrame";

export type GraphCardModel = Extract<CardModel, { kind: "graph" }>;

/** The plot box of a graph card of this pixel size (shared with the ruler through the metrics insets). */
export function graphPlotBox(model: Pick<GraphCardModel, "x" | "y">, w: number, h: number, m: PanelMetrics): PlotBox {
  const fs = m.fsTick;
  const axisAtBottom = !(model.y.min < 0 && model.y.max > 0);
  const top = Math.max(12, Math.round(fs * 0.8));
  const bottom = axisAtBottom ? fs + 16 : Math.max(12, Math.round(fs * 0.8));
  return {
    xMin: model.x.min,
    xMax: model.x.max,
    yMin: model.y.min,
    yMax: model.y.max,
    left: m.insetL,
    top,
    width: Math.max(10, w - m.insetL - m.insetR),
    height: Math.max(10, h - top - bottom),
  };
}

/** Secondary SVG text: never below the 18 px projector floor. */
export const small = (fs: number) => Math.max(18, Math.round(fs * 0.85));

const within = (v: number, lo: number, hi: number) => v >= Math.min(lo, hi) - 1e-9 && v <= Math.max(lo, hi) + 1e-9;

function Arrow({ x, y, dir }: { x: number; y: number; dir: "right" | "left" | "up" | "down" }) {
  const s = 7;
  const pts =
    dir === "right"
      ? `${x + s},${y} ${x - 2},${y - s * 0.7} ${x - 2},${y + s * 0.7}`
      : dir === "left"
        ? `${x - s},${y} ${x + 2},${y - s * 0.7} ${x + 2},${y + s * 0.7}`
        : dir === "up"
          ? `${x},${y - s} ${x - s * 0.7},${y + 2} ${x + s * 0.7},${y + 2}`
          : `${x},${y + s} ${x - s * 0.7},${y - 2} ${x + s * 0.7},${y - 2}`;
  return <polygon points={pts} fill="var(--ui-line)" />;
}

function Annotation({ a, b, fs, idx, onMarker }: { a: GraphAnnotation; b: PlotBox; fs: number; idx: number; onMarker?: (key: string) => void }): ReactNode {
  switch (a.kind) {
    case "bracket": {
      const x0 = projectX(a.x0, b);
      const x1 = projectX(a.x1, b);
      const y0 = projectY(a.y0, b);
      const y1 = projectY(a.y1, b);
      const c = FN_VAR[a.color];
      const cap = 8;
      if (a.orient === "horizontal") {
        const y = Math.min(y0, y1);
        return (
          <g key={idx}>
            <path d={`M${x0} ${y + cap} V${y} H${x1} V${y + cap}`} fill="none" stroke={c} strokeWidth={2} />
            <text className="xp-svg-text" x={(x0 + x1) / 2} y={y - 6} textAnchor="middle" fontSize={small(fs)} fill={c}>
              {a.label}
            </text>
          </g>
        );
      }
      const x = Math.max(x0, x1);
      return (
        <g key={idx}>
          <path d={`M${x - cap} ${y0} H${x} V${y1} H${x - cap}`} fill="none" stroke={c} strokeWidth={2} />
          <text className="xp-svg-text" x={x + 6} y={(y0 + y1) / 2 + fs * 0.3} fontSize={small(fs)} fill={c}>
            {a.label}
          </text>
        </g>
      );
    }
    case "shade": {
      const x0 = projectX(a.x0, b);
      const x1 = projectX(a.x1, b);
      const yTop = a.y1 === null ? b.top : projectY(a.y1, b);
      const yBot = a.y0 === null ? b.top + b.height : projectY(a.y0, b);
      return (
        <g key={idx}>
          <rect x={Math.min(x0, x1)} y={Math.min(yTop, yBot)} width={Math.abs(x1 - x0)} height={Math.abs(yBot - yTop)} fill={FN_VAR[a.color]} opacity={a.alpha} />
          {a.label ? (
            <text className="xp-svg-text" x={(x0 + x1) / 2} y={Math.min(yTop, yBot) + fs} textAnchor="middle" fontSize={small(fs)}>
              {a.label}
            </text>
          ) : null}
        </g>
      );
    }
    case "period_marker":
      return <circle key={idx} cx={projectX(a.x, b)} cy={projectY(a.y, b)} r={8} fill="none" stroke={FN_VAR[a.color]} strokeWidth={2.5} />;
    case "live_dot":
      return (
        <g key={idx}>
          <circle cx={projectX(a.x, b)} cy={projectY(a.y, b)} r={11} fill={FN_VAR[a.color]} opacity={0.25} />
          <circle cx={projectX(a.x, b)} cy={projectY(a.y, b)} r={6} fill={FN_VAR[a.color]} />
        </g>
      );
    case "hline": {
      const y = projectY(a.y, b);
      return (
        <g key={idx}>
          <line x1={b.left} x2={b.left + b.width} y1={y} y2={y} stroke={FN_VAR[a.color]} strokeWidth={2} strokeDasharray={a.style === "dashed" ? "9 7" : undefined} />
          {a.label ? (
            <text className="xp-svg-text" x={b.left + b.width - 4} y={y - 6} textAnchor="end" fontSize={small(fs)} fill={FN_VAR[a.color]}>
              {a.label}
            </text>
          ) : null}
        </g>
      );
    }
    case "vline": {
      const x = projectX(a.x, b);
      return (
        <g key={idx}>
          <line x1={x} x2={x} y1={b.top} y2={b.top + b.height} stroke={FN_VAR[a.color]} strokeWidth={2} strokeDasharray={a.style === "dashed" ? "9 7" : undefined} />
          {a.label ? (
            <text className="xp-svg-text" x={x + 6} y={b.top + fs} fontSize={small(fs)} fill={FN_VAR[a.color]}>
              {a.label}
            </text>
          ) : null}
        </g>
      );
    }
    case "caption":
      return (
        <text key={idx} className="xp-svg-text" x={b.left + 10} y={b.top + fs + 2} fontSize={fs} fontWeight={600}>
          {a.text}
        </text>
      );
    case "marker": {
      const cx = projectX(a.x, b);
      const cy = projectY(a.y, b);
      const key = `${a.x},${a.y}`;
      return (
        <g
          key={idx}
          tabIndex={a.focusable ? 0 : undefined}
          role={a.focusable ? "button" : undefined}
          aria-label={a.focusable ? (a.label ?? `point at ${a.x}, ${a.y}`) : undefined}
          onClick={a.focusable && onMarker ? () => onMarker(key) : undefined}
          onKeyDown={
            a.focusable && onMarker
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onMarker(key);
                  }
                }
              : undefined
          }
          style={a.focusable ? { cursor: "pointer" } : undefined}
        >
          <circle cx={cx} cy={cy} r={9} fill="var(--ui-card)" stroke="var(--ui-line)" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={3.5} fill="var(--ui-line)" />
          {a.label ? (
            <text className="xp-svg-text" x={cx + 12} y={cy - 10} fontSize={small(fs)}>
              {a.label}
            </text>
          ) : null}
        </g>
      );
    }
  }
}

/**
 * GraphCard (§3.2, bible §3.3): axes with arrowheads, π/number/year tick labels (majors only), major/minor grid,
 * 3 px round-capped plots in f/g/h colours (solid, dashed, ghost), open/closed endpoints (r 7), annotations, interval
 * columns with dark hex gutters, the orange target line with [ ] caps, and value chips on the left edge. Empty cards
 * are still drawn (axes and the 0 and far-end labels only) so the stack keeps its rhythm.
 */
export function GraphCard({ model, chips = [], onMarker }: { model: GraphCardModel; chips?: readonly LiveChip[]; onMarker?: (key: string) => void }) {
  const m = usePanelMetrics();
  const [ref, size] = useElementSize<HTMLDivElement>({ w: 640, h: 220 });
  const uid = useId().replace(/:/g, "");
  const { w, h } = size;
  const b = graphPlotBox(model, w, h, m);
  const fs = m.fsTick;
  const x0 = b.left;
  const x1 = b.left + b.width;
  const yTop = b.top;
  const yBot = b.top + b.height;
  const axisY = projectY(model.y.min < 0 && model.y.max > 0 ? 0 : model.y.min, b);
  const axisX = projectX(model.x.min < 0 && model.x.max > 0 ? 0 : model.x.min, b);
  const fullBoard = model.x.min < 0 && model.y.min < 0;
  const xTicks = model.x.ticks.filter((t) => within(t.v, model.x.min, model.x.max));
  const yTicks = model.y.ticks.filter((t) => within(t.v, model.y.min, model.y.max));
  const lastX = xTicks.length ? xTicks[xTicks.length - 1].v : model.x.max;
  const xLabels = model.empty ? xTicks.filter((t) => t.v === lastX && t.label) : xTicks.filter((t) => t.label);
  const yLabels = model.empty ? yTicks.filter((t) => Math.abs(t.v) < 1e-9 && t.label) : yTicks.filter((t) => t.label);
  const interactive = model.annotations.some((a) => a.kind === "marker" && a.focusable);
  const clipId = `clip-${uid}`;
  const hexId = `gutter-${uid}`;
  const chipH = m.fsChip * 1.25 + 8;
  const chipAxis = {
    min: model.y.min - ((h - yBot) / Math.max(1, b.height)) * (model.y.max - model.y.min),
    max: model.y.max + (yTop / Math.max(1, b.height)) * (model.y.max - model.y.min),
  };
  const gutters: { a: number; b: number }[] = [];
  if (model.columns.length) {
    const cols = [...model.columns].sort((p, q) => p.x0 - q.x0);
    let cursor = model.x.min;
    for (const c of cols) {
      if (c.x0 > cursor) gutters.push({ a: cursor, b: c.x0 });
      cursor = Math.max(cursor, c.x1);
    }
    if (cursor < model.x.max) gutters.push({ a: cursor, b: model.x.max });
  }

  return (
    <CardFrame
      ref={ref}
      kind="graph"
      tab={model.tab}
      data={{ "data-chip-side": "right" }}
      overlay={size.measured && chips.map((c, i) => (
        <ValueChip key={`${c.slot}-${i}`} text={c.text} color={c.color} side="right" top={chipY(c.value, chipAxis, h, chipH)} />
      ))}
    >
      {size.measured ? (
      <svg
          role={interactive ? "group" : "img"}
          aria-labelledby={`${uid}-t ${uid}-d`}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          focusable="false"
        >
          <title id={`${uid}-t`}>{model.title || model.tab}</title>
          <desc id={`${uid}-d`}>{model.sr}</desc>
          <defs>
            <clipPath id={clipId}>
              <rect x={x0 - 2} y={yTop - 2} width={b.width + 4} height={b.height + 4} />
            </clipPath>
            <pattern id={hexId} width={30} height={26} patternUnits="userSpaceOnUse">
              <rect width={30} height={26} fill="var(--ui-card-deep)" />
              <path d="M0 13 L5 0 L15 0 L20 13 L15 26 L5 26 Z M20 13 L30 13" fill="none" stroke="var(--ui-hex)" strokeWidth={1} />
            </pattern>
          </defs>
          {/* grid: minor then major */}
          <g aria-hidden>
            {xTicks.map((t) => (
              <line key={`gx${t.v}`} x1={projectX(t.v, b)} x2={projectX(t.v, b)} y1={yTop} y2={yBot} stroke={t.major ? "var(--ui-grid-major)" : "var(--ui-grid-minor)"} strokeWidth={1} />
            ))}
            {yTicks.map((t) => (
              <line key={`gy${t.v}`} x1={x0} x2={x1} y1={projectY(t.v, b)} y2={projectY(t.v, b)} stroke={t.major ? "var(--ui-grid-major)" : "var(--ui-grid-minor)"} strokeWidth={1} />
            ))}
          </g>
          {/* shaded annotations under the plots */}
          <g clipPath={`url(#${clipId})`} aria-hidden>
            {model.annotations.map((a, i) => (a.kind === "shade" ? <Annotation key={i} a={a} b={b} fs={fs} idx={i} /> : null))}
          </g>
          {/* plots */}
          {!model.empty ? (
            <g clipPath={`url(#${clipId})`} aria-hidden>
              {model.plots.map((p) => (
                <path
                  key={p.id}
                  d={pathOf(p.segments, b)}
                  fill="none"
                  stroke={FN_VAR[p.color]}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={p.style === "dashed" ? "10 8" : undefined}
                  opacity={p.style === "ghost" ? 0.25 : 1}
                />
              ))}
            </g>
          ) : null}
          {/* interval columns: dark hex gutters between them; obscured columns covered; chosen framed in orange */}
          {model.columns.length ? (
            <g aria-hidden>
              {gutters.map((g, i) => (
                <rect key={`gut${i}`} x={projectX(g.a, b)} y={yTop} width={projectX(g.b, b) - projectX(g.a, b)} height={b.height} fill={`url(#${hexId})`} />
              ))}
              {model.columns.map((c) => {
                const cx0 = projectX(c.x0, b);
                const cw = projectX(c.x1, b) - cx0;
                return (
                  <g key={c.id}>
                    {c.state === "obscured" ? <rect x={cx0} y={yTop} width={cw} height={b.height} fill={`url(#${hexId})`} opacity={0.92} /> : null}
                    <rect
                      x={cx0 + 1}
                      y={yTop + 1}
                      width={Math.max(0, cw - 2)}
                      height={b.height - 2}
                      fill="none"
                      stroke={c.state === "chosen" ? "var(--ui-accent)" : "var(--ui-line)"}
                      strokeWidth={c.state === "chosen" ? 3 : 1.5}
                    />
                  </g>
                );
              })}
            </g>
          ) : null}
          {/* axes with arrowheads */}
          <g aria-hidden>
            <line x1={x0} x2={x1 + 4} y1={axisY} y2={axisY} stroke="var(--ui-line)" strokeWidth={1.5} />
            <Arrow x={x1 + 6} y={axisY} dir="right" />
            {fullBoard ? <Arrow x={x0 - 6} y={axisY} dir="left" /> : null}
            <line x1={axisX} x2={axisX} y1={yTop - (fullBoard ? 4 : 0)} y2={yBot} stroke="var(--ui-line)" strokeWidth={1.5} />
            {fullBoard ? (
              <>
                <Arrow x={axisX} y={yTop - 6} dir="up" />
                <Arrow x={axisX} y={yBot + 6} dir="down" />
              </>
            ) : null}
            {yTicks
              .filter((t) => t.major)
              .map((t) => (
                <line key={`ty${t.v}`} x1={axisX - 6} x2={axisX} y1={projectY(t.v, b)} y2={projectY(t.v, b)} stroke="var(--ui-line)" strokeWidth={1.5} />
              ))}
            {xTicks
              .filter((t) => t.major)
              .map((t) => (
                <line key={`tx${t.v}`} x1={projectX(t.v, b)} x2={projectX(t.v, b)} y1={axisY} y2={axisY + 6} stroke="var(--ui-line)" strokeWidth={1.5} />
              ))}
          </g>
          {/* labelled ticks (majors only) */}
          <g aria-hidden className="xp-svg-text" fontSize={fs} fontWeight={600}>
            {yLabels.map((t) => (
              <text key={`ly${t.v}`} x={axisX - 10} y={projectY(t.v, b) + fs * 0.35} textAnchor="end">
                {t.label}
              </text>
            ))}
            {xLabels
              .filter((t) => !(Math.abs(t.v - (model.x.min < 0 && model.x.max > 0 ? 0 : model.x.min)) < 1e-9 && yLabels.length > 0))
              .map((t) => (
                <text key={`lx${t.v}`} x={projectX(t.v, b)} y={axisY + fs + 6} textAnchor="middle">
                  {t.label}
                </text>
              ))}
            {model.x.label ? (
              <text x={x1} y={axisY - 8} textAnchor="end" fontSize={small(fs)} fontWeight={400}>
                {model.x.label}
              </text>
            ) : null}
            {model.y.label ? (
              <text x={axisX + 8} y={yTop + fs * 0.8} fontSize={small(fs)} fontWeight={400}>
                {model.y.label}
              </text>
            ) : null}
          </g>
          {/* endpoints above the plots */}
          {!model.empty ? (
            <g aria-hidden>
              {model.plots.flatMap((p) =>
                p.endpoints.map((e, i) => (
                  <circle
                    key={`${p.id}-e${i}`}
                    cx={projectX(e.x, b)}
                    cy={projectY(e.y, b)}
                    r={7}
                    fill={e.open ? "var(--ui-card)" : FN_VAR[p.color]}
                    stroke={FN_VAR[p.color]}
                    strokeWidth={2.5}
                    opacity={p.style === "ghost" ? 0.25 : 1}
                  />
                )),
              )}
            </g>
          ) : null}
          {/* target line with [ ] caps */}
          {model.targetLine ? (
            <g aria-hidden>
              <line x1={x0 + 8} x2={x1 - 8} y1={projectY(model.targetLine.y, b)} y2={projectY(model.targetLine.y, b)} stroke="var(--ui-accent)" strokeWidth={3} />
              <path
                d={`M${x0 + 10} ${projectY(model.targetLine.y, b) - 10} H${x0 + 2} V${projectY(model.targetLine.y, b) + 10} H${x0 + 10} M${x1 - 10} ${projectY(model.targetLine.y, b) - 10} H${x1 - 2} V${projectY(model.targetLine.y, b) + 10} H${x1 - 10}`}
                fill="none"
                stroke="var(--ui-accent)"
                strokeWidth={3}
              />
              <text className="xp-svg-text" x={x0 + 18} y={projectY(model.targetLine.y, b) - 10} textAnchor="start" fontSize={small(fs)} fill="var(--ui-accent-hi)">
                {model.targetLine.label}
              </text>
            </g>
          ) : null}
          {/* the other annotations on top */}
          <g>
            {model.annotations.map((a, i) => (a.kind === "shade" ? null : <Annotation key={i} a={a} b={b} fs={fs} idx={i} onMarker={onMarker} />))}
          </g>
        </svg>
      ) : null}
    </CardFrame>
  );
}
