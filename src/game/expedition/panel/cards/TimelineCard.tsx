"use client";

import { useId } from "react";
import { chipY, niceTicks, projectX, type PlotBox } from "@/world/graph-math";
import type { CardModel } from "@/world/types";
import { useElementSize, usePanelMetrics, type PanelMetrics } from "../metrics";
import type { LiveChip } from "../types";
import { ValueChip } from "../ValueChip";
import { CardFrame, FN_VAR } from "./CardFrame";
import { small } from "./GraphCard";
import { edgeAnchor } from "../Scrubber";

export type TimelineCardModel = Extract<CardModel, { kind: "timeline" }>;
type Pin = TimelineCardModel["pins"][number];

/** Plot box of a timeline card: the same x insets as graph cards and the ruler, so the year cursor lines up. */
export function timelinePlotBox(model: Pick<TimelineCardModel, "from" | "to" | "lanes">, w: number, h: number, m: PanelMetrics): PlotBox {
  const top = Math.max(16, Math.round(m.fsTick * 0.9));
  const bottom = m.fsTick + 18;
  return {
    xMin: model.from,
    xMax: model.to,
    yMin: 0,
    yMax: Math.max(1, model.lanes.length),
    left: m.insetL,
    top,
    width: Math.max(10, w - m.insetL - m.insetR),
    height: Math.max(10, h - top - bottom),
  };
}

/** Centre y (px) of a lane row; lane null or unknown → the middle of the card. */
export function laneY(model: Pick<TimelineCardModel, "lanes">, lane: string | null, b: PlotBox): number {
  const n = Math.max(1, model.lanes.length);
  const i = lane === null ? -1 : model.lanes.findIndex((l) => l.id === lane);
  const row = b.height / n;
  // pins sit in the lower part of their row; the lane label owns the top-left
  return i < 0 ? b.top + b.height / 2 : b.top + row * (i + 0.5) + row * 0.18;
}

/** Place pin labels so their boxes do not cover each other. Tries beside the pin, then further up and down. */
export function placePinLabels(
  pins: readonly { key: string; x: number; y: number; label: string }[],
  bounds: { left: number; right: number; top: number; bottom: number },
  fontSize: number,
): { key: string; x: number; y: number; anchor: "start" | "end" }[] {
  const h = fontSize + 4;
  const placed: { key: string; x: number; y: number; anchor: "start" | "end"; w: number }[] = [];
  const rect = (l: (typeof placed)[number]) => {
    const left = l.anchor === "start" ? l.x : l.x - l.w;
    return { left, right: left + l.w, top: l.y - h, bottom: l.y + 2 };
  };
  const clear = (box: (typeof placed)[number]) => {
    const r = rect(box);
    if (r.left < bounds.left || r.right > bounds.right || r.top < bounds.top || r.bottom > bounds.bottom) return false;
    return placed.every((prev) => overlapArea(box, prev, h) === 0);
  };
  const overlapArea = (a: (typeof placed)[number], b: (typeof placed)[number], line: number) => {
    const A = rect(a);
    const B = { left: b.anchor === "start" ? b.x : b.x - b.w, right: (b.anchor === "start" ? b.x : b.x - b.w) + b.w, top: b.y - line, bottom: b.y + 2 };
    const w = Math.min(A.right, B.right) - Math.max(A.left, B.left);
    const hh = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
    return w > 0 && hh > 0 ? w * hh : 0;
  };
  for (const p of [...pins].sort((a, b) => a.x - b.x || a.key.localeCompare(b.key))) {
    const w = Math.max(fontSize, p.label.length * fontSize * 0.7 + 16);
    const pad = 12;
    const candidates: { x: number; y: number; anchor: "start" | "end" }[] = [];
    for (let row = 0; row < 8; row++) {
      for (const dir of [-1, 1] as const) {
        const y = p.y - 2 + dir * row * h;
        candidates.push({ x: p.x + pad, y, anchor: "start" });
        candidates.push({ x: p.x - pad, y, anchor: "end" });
      }
    }
    const choice =
      candidates.find((c) => clear({ key: p.key, ...c, w })) ??
      candidates
        .map((c) => ({ c, score: placed.reduce((n, prev) => n + overlapArea({ key: p.key, ...c, w }, prev, h), 0) }))
        .sort((a, b) => a.score - b.score)[0].c;
    placed.push({ key: p.key, ...choice, w });
  }
  return placed.map(({ key, x, y, anchor }) => ({ key, x, y, anchor }));
}

/**
 * Pins that land on nearly the same x (several clues in one year of a long axis) stack vertically
 * so each label stays readable. Spaced pins keep their lane row.
 */
export function spreadPinPositions(
  pins: readonly { key: string; lane: string | null; x: number; y: number }[],
  box: { gap: number; cluster: number; top: number; bottom: number },
): Map<string, { x: number; y: number }> {
  const items = [...pins].sort((a, b) => a.x - b.x || a.key.localeCompare(b.key));
  const out = new Map<string, { x: number; y: number }>();
  let i = 0;
  while (i < items.length) {
    let j = i + 1;
    while (j < items.length && items[j].x - items[j - 1].x < box.cluster && (items[j].lane ?? "") === (items[i].lane ?? "")) j += 1;
    const group = items.slice(i, j);
    const mid = (group.length - 1) / 2;
    const span = (group.length - 1) * box.gap;
    const room = Math.max(0, box.bottom - box.top);
    const gap = span > room && group.length > 1 ? room / (group.length - 1) : box.gap;
    group.forEach((item, k) => {
      const y = item.y + (k - mid) * gap;
      out.set(item.key, { x: item.x, y: Math.min(box.bottom, Math.max(box.top, y)) });
    });
    i = j;
  }
  return out;
}

function PinGlyph({ x, y, pin }: { x: number; y: number; pin: Pin }) {
  // A map pin (bible §3.10): dark teal body, white stroke; the style says what kind of knowledge it is.
  const stroke =
    pin.style === "draft" ? "var(--fn-g)" : pin.style === "focus" ? "var(--ui-accent)" : pin.style === "dim" ? "var(--ui-text-dim)" : "var(--ui-line)";
  const fill = pin.style === "earned" ? "var(--ui-line)" : pin.style === "focus" ? "var(--ui-accent)" : "#1d4a57";
  const dash = pin.style === "hint" ? "4 3" : undefined;
  const opacity = pin.style === "dim" ? 0.45 : 1;
  return (
    <g opacity={opacity}>
      <path
        d={`M${x} ${y + 12} C ${x - 4} ${y + 6}, ${x - 10} ${y + 1}, ${x - 10} ${y - 6} A 10 10 0 1 1 ${x + 10} ${y - 6} C ${x + 10} ${y + 1}, ${x + 4} ${y + 6}, ${x} ${y + 12} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
        strokeDasharray={dash}
      />
      <circle cx={x} cy={y - 6} r={3.5} fill={pin.style === "earned" ? "#1d4a57" : "var(--ui-line)"} />
      <title>{pin.label}</title>
    </g>
  );
}

/**
 * TimelineCard (§3.2; civil §5.0.2): the panel-owned RECORD card and the metas' FILE cards. A years/months axis,
 * labelled lanes, earned pins (white), hint pins (dashed), draft pins (green), bands, causal arrows, an axis break
 * drawn in the left gutter ("1896 ≈") for pins before the window, and value chips (value = lane index) on the left
 * edge. The orange year cursor is the panel's scrub line when the card shares the scrubber's window; otherwise the
 * card draws `cursor` itself.
 */
export function TimelineCard({ model, chips = [], cursor = null }: { model: TimelineCardModel; chips?: readonly LiveChip[]; cursor?: number | null }) {
  const m = usePanelMetrics();
  const [ref, size] = useElementSize<HTMLDivElement>({ w: 640, h: 200 });
  const uid = useId().replace(/:/g, "");
  const { w, h } = size;
  const b = timelinePlotBox(model, w, h, m);
  const fs = m.fsTick;
  const unit = model.unit === "month" ? "month" : "year";
  const labelW = fs * (unit === "month" ? 5.4 : 3.2);
  const ticks = niceTicks(model.from, model.to, unit, Math.max(2, Math.floor(b.width / labelW)));
  const axisY = b.top + b.height;
  const brk = model.axisBreak;
  const gutterX = Math.max(14, b.left - fs * 1.6);
  const xOf = (at: number) => (at < model.from - 1e-9 && brk ? gutterX : projectX(Math.min(model.to, Math.max(model.from, at)), b));
  // pins outside the window collapse into edge counters per lane (except the axis-break pins, drawn in the gutter)
  const inside = (p: Pin) => (p.at >= model.from - 1e-9 && p.at <= model.to + 1e-9) || (brk !== null && p.at < model.from && p.at >= brk.from - 1e-9);
  const shown = model.pins.filter(inside);
  const off = new Map<string, { before: number; after: number; y: number }>();
  for (const p of model.pins) {
    if (inside(p)) continue;
    const k = p.lane ?? "";
    const e = off.get(k) ?? { before: 0, after: 0, y: laneY(model, p.lane, b) };
    if (p.at < model.from) e.before += 1;
    else e.after += 1;
    off.set(k, e);
  }
  const pinPos = spreadPinPositions(
    shown.map((p) => ({ key: p.key, lane: p.lane, x: xOf(p.at), y: laneY(model, p.lane, b) })),
    { gap: Math.max(28, small(fs) + 12), cluster: Math.max(72, small(fs) * 4.2), top: b.top + 4, bottom: axisY - 4 },
  );
  const chipH = m.fsChip * 1.25 + 8;
  const n = Math.max(1, model.lanes.length);
  const chipTop = (laneIndex: number) =>
    Number.isFinite(laneIndex) && laneIndex >= 0 && laneIndex < n
      ? laneY(model, model.lanes[Math.round(laneIndex)]?.id ?? null, b)
      : chipY(Number.NaN, { min: 0, max: 1 }, h, chipH);

  return (
    <CardFrame
      ref={ref}
      gutter
      data={{ "data-lanes": model.lanes.length > 0 ? "true" : undefined }}
      kind="timeline"
      tab={model.tab}
      overlay={size.measured && chips.map((c, i) => (
        <ValueChip key={i} text={c.text} color={c.color} top={Math.min(h - chipH / 2, Math.max(chipH / 2, chipTop(c.value)))} />
      ))}
    >
      {size.measured ? (
      <svg role="img" aria-labelledby={`${uid}-t ${uid}-d`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} focusable="false">
          <title id={`${uid}-t`}>{model.title}</title>
          <desc id={`${uid}-d`}>{model.sr}</desc>
          {/* lanes */}
          <g aria-hidden>
            {model.lanes.map((l, i) => {
              const y0 = b.top + (b.height / n) * i;
              return (
                <g key={l.id}>
                  {i > 0 ? <line x1={b.left} x2={b.left + b.width} y1={y0} y2={y0} stroke="var(--ui-grid-minor)" strokeWidth={1} /> : null}
                </g>
              );
            })}
          </g>
          {/* year grid */}
          <g aria-hidden>
            {ticks.map((t) => (
              <line key={`g${t.v}`} x1={projectX(t.v, b)} x2={projectX(t.v, b)} y1={b.top} y2={axisY} stroke={t.major ? "var(--ui-grid-major)" : "var(--ui-grid-minor)"} strokeWidth={1} />
            ))}
          </g>
          {/* bands */}
          <g aria-hidden>
            {model.bands.map((band, i) => {
              const x0 = xOf(band.from);
              const x1 = xOf(band.to);
              return (
                <g key={i}>
                  <rect x={Math.min(x0, x1)} y={b.top + 4} width={Math.max(3, Math.abs(x1 - x0))} height={b.height - 8} fill={FN_VAR[band.color]} opacity={0.18} />
                  <line x1={x0} x2={x1} y1={axisY - 6} y2={axisY - 6} stroke={FN_VAR[band.color]} strokeWidth={4} />
                </g>
              );
            })}
          </g>
          {/* axis + break */}
          <g aria-hidden>
            <line x1={b.left} x2={b.left + b.width + 4} y1={axisY} y2={axisY} stroke="var(--ui-line)" strokeWidth={1.5} />
            <polygon points={`${b.left + b.width + 11},${axisY} ${b.left + b.width + 2},${axisY - 5} ${b.left + b.width + 2},${axisY + 5}`} fill="var(--ui-line)" />
            {ticks
              .filter((t) => t.major)
              .map((t) => (
                <g key={`t${t.v}`}>
                  <line x1={projectX(t.v, b)} x2={projectX(t.v, b)} y1={axisY} y2={axisY + 6} stroke="var(--ui-line)" strokeWidth={1.5} />
                  <text className="xp-svg-text" {...edgeAnchor(projectX(t.v, b), ((t.label ?? "").length * 0.62 * fs) / 2, w)} y={axisY + fs + 8} fontSize={fs} fontWeight={600}>
                    {t.label}
                  </text>
                </g>
              ))}
            {brk ? (
              <g>
                <path d={`M${b.left - 16} ${axisY - 7} l6 14 M${b.left - 9} ${axisY - 7} l6 14`} stroke="var(--ui-line)" strokeWidth={1.5} />
                <line x1={gutterX - 10} x2={b.left - 18} y1={axisY} y2={axisY} stroke="var(--ui-line)" strokeWidth={1.5} strokeDasharray="3 3" />
                <text className="xp-svg-text" x={4} y={axisY - 10} textAnchor="start" fontSize={small(fs)} fontWeight={600}>
                  {`${Math.round(brk.from)} ≈`}
                </text>
              </g>
            ) : null}
          </g>
          {/* causal arrows */}
          <g aria-hidden>
            <defs>
              <marker id={`${uid}-ah`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 Z" fill="var(--ui-line)" />
              </marker>
            </defs>
            {model.arrows.map((a, i) => {
              const p = pinPos.get(a.fromKey);
              const q = pinPos.get(a.toKey);
              if (!p || !q) return null;
              const mx = (p.x + q.x) / 2;
              const my = Math.min(p.y, q.y) - 26;
              return <path key={i} d={`M${p.x} ${p.y - 14} Q ${mx} ${my} ${q.x} ${q.y - 16}`} fill="none" stroke="var(--ui-line)" strokeWidth={2} markerEnd={`url(#${uid}-ah)`} />;
            })}
          </g>
          {/* pins */}
          <g aria-hidden>
            {shown.map((p) => {
              const pos = pinPos.get(p.key)!;
              return <PinGlyph key={p.key} x={pos.x} y={pos.y} pin={p} />;
            })}
            {[...off.entries()].map(([lane, e]) => (
              <g key={`off-${lane}`}>
                {e.before > 0 ? (
                  <text className="xp-svg-text" x={b.left + 6} y={e.y + small(fs) * 0.35} fontSize={small(fs)} fill="var(--ui-line)">
                    {`◂ ${e.before}`}
                  </text>
                ) : null}
                {e.after > 0 ? (
                  <text className="xp-svg-text" x={b.left + b.width * 0.62} y={e.y + small(fs) * 0.35} fontSize={small(fs)} fill="var(--ui-line)">
                    {`${e.after} ▸`}
                  </text>
                ) : null}
              </g>
            ))}
            {placePinLabels(
              shown
                .filter((p) => p.style === "hint" || p.style === "focus" || p.style === "draft")
                .map((p) => {
                  const pos = pinPos.get(p.key)!;
                  return { key: p.key, x: pos.x, y: pos.y, label: p.label };
                }),
              { left: b.left, right: b.left + b.width, top: b.top, bottom: axisY - 2 },
              small(fs),
            ).map((l) => {
              const pin = shown.find((p) => p.key === l.key)!;
              return (
                <text key={`l${l.key}`} className="xp-svg-text" x={l.x} y={l.y} textAnchor={l.anchor} fontSize={small(fs)}>
                  {pin.label}
                </text>
              );
            })}
          </g>
          {/* lane labels last, on a dark backing, so pins never hide them */}
          <g aria-hidden>
            {model.lanes.map((l, i) => (
              <text
                key={`lane-${l.id}`}
                className="xp-svg-text"
                x={b.left + 8}
                y={b.top + (b.height / n) * i + small(fs) * 0.95}
                fontSize={small(fs)}
                fill="var(--ui-text-dim)"
                letterSpacing="0.1em"
                stroke="var(--ui-card)"
                strokeWidth={5}
                paintOrder="stroke"
              >
                {l.label}
              </text>
            ))}
          </g>
          {cursor !== null && Number.isFinite(cursor) ? (
            <line x1={xOf(cursor)} x2={xOf(cursor)} y1={b.top - 4} y2={axisY} stroke="var(--ui-accent)" strokeWidth={4} aria-hidden />
          ) : null}
        </svg>
      ) : null}
    </CardFrame>
  );
}
