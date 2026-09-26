"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WidgetProps } from "./Dial";

/** Matches mode number_line's View (src/mechanics/families/mapper/number_line.ts). Supports scale === "log". */
export interface NumberLineView {
  scale: "linear" | "log";
  min: number;
  max: number;
  target: string;
  landmarks: { value: number; fraction: number; label: string }[];
}
export interface NumberLineInput {
  value: number;
}

/** Matches mode plane's View (src/mechanics/families/mapper/plane.ts). */
export interface PlaneView {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  gridStep: number;
  xLabel: string;
  yLabel: string;
  labels: "decimal" | "pi";
  overlay: string;
  target: string;
}
export interface PlaneInput {
  x: number;
  y: number;
}

/** Matches mode limit's View (src/mechanics/families/function_world/limit.ts). */
export type LimitAnswerKind = "value" | "dne" | "pos_infinity" | "neg_infinity";
export interface LimitView {
  a: number;
  side: "left" | "right" | "both";
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  samples: { x: number; y: number | null }[];
  at: { x: number; y: number | null; defined: boolean };
  pieces: string[];
}
export interface LimitInput {
  kind: LimitAnswerKind;
  value: number | null;
}

/** Matches mode slope's View (src/mechanics/families/function_world/slope.ts). */
export type SlopeAsk = "sign_at" | "steepest" | "critical_points" | "concavity_at" | "inflection_points";
export interface SlopeView {
  ask: SlopeAsk;
  a: number | null;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  samples: { x: number; y: number | null }[];
  pieces: string[];
}
export type SlopeInput =
  | { sign: "positive" | "negative" | "zero" }
  | { x: number }
  | { xs: number[] }
  | { concavity: "up" | "down" };

export type PlaceView = NumberLineView | PlaneView | LimitView | SlopeView;
export type PlaceInput = NumberLineInput | PlaneInput | LimitInput | SlopeInput;

export function isPlaneView(view: PlaceView): view is PlaneView {
  return "gridStep" in view;
}
export function isLimitView(view: PlaceView): view is LimitView {
  return "samples" in view && "at" in view;
}
export function isSlopeView(view: PlaceView): view is SlopeView {
  return "samples" in view && "ask" in view;
}

/** Pure: the number-line fraction's value -> the input number_line's grade() expects. */
export function numberLineToInput(value: number): NumberLineInput {
  return { value };
}
/** Pure: the marker's grid coordinates -> the input plane's grade() expects. */
export function planeToInput(x: number, y: number): PlaneInput {
  return { x, y };
}
/** Pure: the chosen answer kind/value -> the input limit's grade() expects. */
export function limitToInput(kind: LimitAnswerKind, value: number | null): LimitInput {
  return { kind, value: kind === "value" ? value : null };
}
/** Pure: the reported sign -> the input slope (ask=sign_at) grade() expects. */
export function slopeSignToInput(sign: "positive" | "negative" | "zero"): SlopeInput {
  return { sign };
}
/** Pure: the reported concavity -> the input slope (ask=concavity_at) grade() expects. */
export function slopeConcavityToInput(concavity: "up" | "down"): SlopeInput {
  return { concavity };
}
/** Pure: the placed x marker -> the input slope (ask=steepest) grade() expects. */
export function slopeXToInput(x: number): SlopeInput {
  return { x };
}
/** Pure: the placed x markers -> the input slope (ask=critical_points/inflection_points) grade() expects. */
export function slopeXsToInput(xs: number[]): SlopeInput {
  return { xs };
}

function fractionToValue(view: NumberLineView, fraction: number): number {
  if (view.scale === "log") {
    const lo = Math.log10(view.min);
    const hi = Math.log10(view.max);
    return 10 ** (lo + fraction * (hi - lo));
  }
  return view.min + fraction * (view.max - view.min);
}

/** place: a marker on a number line, a 2-D plane, or (for function_world.limit) a scrubbable function path. */
export function Place({ view, onSubmit, onLive, disabled }: WidgetProps<PlaceView, PlaceInput>) {
  if (isPlaneView(view)) return <PlanePlace view={view} onSubmit={onSubmit as (i: PlaneInput) => void} disabled={disabled} />;
  if (isSlopeView(view)) return <SlopePlace view={view} onSubmit={onSubmit as (i: SlopeInput) => void} disabled={disabled} />;
  if (isLimitView(view)) return <LimitPlace view={view} onSubmit={onSubmit as (i: LimitInput) => void} disabled={disabled} />;
  return <NumberLinePlace view={view} onSubmit={onSubmit as (i: NumberLineInput) => void} onLive={onLive} disabled={disabled} />;
}

function NumberLinePlace({
  view,
  onSubmit,
  onLive,
  disabled,
}: {
  view: NumberLineView;
  onSubmit: (i: NumberLineInput) => void;
  onLive?: (value: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [fraction, setFraction] = useState(0.5);
  const value = fractionToValue(view, fraction);

  useEffect(() => {
    onLive?.(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Land on <strong>{view.target}</strong>.
      </p>
      <div className="relative h-16 rounded-lg border-2" data-testid="number-line">
        {view.landmarks.map((l) => (
          <div key={l.value} className="absolute top-0 h-full border-l opacity-60" style={{ left: `${l.fraction * 100}%` }}>
            <span className="absolute top-full mt-1 -translate-x-1/2 whitespace-nowrap text-sm" style={{ fontSize: 15 }}>
              {l.label}
            </span>
          </div>
        ))}
        <div
          className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4"
          style={{ left: `${fraction * 100}%`, borderColor: "currentColor", background: "color-mix(in oklab, currentColor 30%, transparent)" }}
          aria-hidden
        />
      </div>
      <label htmlFor={id} className="sr-only">
        Position on the line
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.002}
        value={fraction}
        disabled={disabled}
        onChange={(e) => setFraction(Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit(numberLineToInput(value));
        }}
        className="w-full"
        style={{ height: 32 }}
      />
      <div className="flex items-center justify-between gap-4">
        <output htmlFor={id} className="text-xl font-semibold tabular-nums" style={{ fontSize: 20 }}>
          {value.toPrecision(4)}
        </output>
        <Button size="lg" disabled={disabled} onClick={() => onSubmit(numberLineToInput(value))} data-testid="widget-submit">
          Place marker
        </Button>
      </div>
    </div>
  );
}

function PlanePlace({ view, onSubmit, disabled }: { view: PlaneView; onSubmit: (i: PlaneInput) => void; disabled?: boolean }) {
  const [x, setX] = useState((view.xMin + view.xMax) / 2);
  const [y, setY] = useState((view.yMin + view.yMax) / 2);
  const fineStep = view.gridStep / 10;

  const xFrac = (x - view.xMin) / (view.xMax - view.xMin);
  const yFrac = 1 - (y - view.yMin) / (view.yMax - view.yMin);

  const xLines: number[] = [];
  for (let v = Math.ceil(view.xMin / view.gridStep) * view.gridStep; v <= view.xMax + 1e-9; v += view.gridStep) xLines.push(v);
  const yLines: number[] = [];
  for (let v = Math.ceil(view.yMin / view.gridStep) * view.gridStep; v <= view.yMax + 1e-9; v += view.gridStep) yLines.push(v);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Mark <strong>{view.target}</strong>. Arrow keys move the marker by {view.gridStep}; hold Shift to nudge by {fineStep.toPrecision(2)}.
      </p>
      {view.overlay && (
        <p className="text-sm opacity-80" style={{ fontSize: 15 }}>
          The board shows: {view.overlay}
        </p>
      )}
      <div
        role="application"
        aria-label={`Coordinate plane, ${view.xLabel} by ${view.yLabel}`}
        tabIndex={0}
        data-testid="plane-grid"
        className="relative aspect-square w-full max-w-md rounded-lg border-2 outline-none focus-visible:ring-4"
        onKeyDown={(e) => {
          if (disabled) return;
          const step = e.shiftKey ? fineStep : view.gridStep;
          if (e.key === "ArrowRight") {
            e.preventDefault();
            setX((v) => Math.min(view.xMax, v + step));
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            setX((v) => Math.max(view.xMin, v - step));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setY((v) => Math.min(view.yMax, v + step));
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setY((v) => Math.max(view.yMin, v - step));
          } else if (e.key === "Enter") {
            onSubmit(planeToInput(x, y));
          }
        }}
      >
        {xLines.map((v) => (
          <div key={`x${v}`} className="absolute top-0 h-full border-l opacity-25" style={{ left: `${((v - view.xMin) / (view.xMax - view.xMin)) * 100}%` }} />
        ))}
        {yLines.map((v) => (
          <div key={`y${v}`} className="absolute left-0 w-full border-t opacity-25" style={{ top: `${(1 - (v - view.yMin) / (view.yMax - view.yMin)) * 100}%` }} />
        ))}
        <div
          aria-hidden
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-4"
          style={{
            left: `${xFrac * 100}%`,
            top: `${yFrac * 100}%`,
            borderColor: "currentColor",
            background: "color-mix(in oklab, currentColor 40%, transparent)",
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <output className="text-lg tabular-nums" style={{ fontSize: 18 }}>
          ({view.xLabel}={x.toPrecision(3)}, {view.yLabel}={y.toPrecision(3)})
        </output>
        <Button size="lg" disabled={disabled} onClick={() => onSubmit(planeToInput(x, y))} data-testid="widget-submit">
          Place marker
        </Button>
      </div>
    </div>
  );
}

function LimitPlace({ view, onSubmit, disabled }: { view: LimitView; onSubmit: (i: LimitInput) => void; disabled?: boolean }) {
  const [scrubX, setScrubX] = useState(view.a);
  const [answerY, setAnswerY] = useState((view.yMin + view.yMax) / 2);
  const [kind, setKind] = useState<LimitAnswerKind>("value");

  const scrubY = useMemo(() => {
    // Nearest sample to scrubX (samples are evenly spaced left to right).
    let best: number | null = null;
    let bestDist = Infinity;
    for (const s of view.samples) {
      const d = Math.abs(s.x - scrubX);
      if (d < bestDist) {
        bestDist = d;
        best = s.y;
      }
    }
    return best;
  }, [view.samples, scrubX]);

  const xFrac = (v: number) => (v - view.xMin) / (view.xMax - view.xMin);
  const yFrac = (v: number) => 1 - (v - view.yMin) / (view.yMax - view.yMin);

  // Build one or more polyline point-strings, breaking wherever a sample is null (a gap).
  const segments: string[] = [];
  let current: string[] = [];
  for (const s of view.samples) {
    if (s.y === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      continue;
    }
    current.push(`${xFrac(s.x) * 100},${yFrac(s.y) * 100}`);
  }
  if (current.length > 1) segments.push(current.join(" "));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Where is f(x) heading as x approaches {view.a} from {view.side === "both" ? "both sides" : `the ${view.side}`}?
      </p>
      <div className="relative aspect-video w-full rounded-lg border-2" data-testid="limit-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
          {segments.map((pts, i) => (
            <polyline key={i} points={pts} fill="none" stroke="currentColor" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
          ))}
          {/* the tile at x = a: filled if defined, hollow ring if not */}
          {view.at.y !== null && (
            <circle
              cx={xFrac(view.at.x) * 100}
              cy={yFrac(view.at.y) * 100}
              r={1.6}
              fill={view.at.defined ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={0.6}
            />
          )}
          {/* scrub marker */}
          {scrubY !== null && <circle cx={xFrac(scrubX) * 100} cy={yFrac(scrubY) * 100} r={1.4} fill="currentColor" opacity={0.85} />}
        </svg>
      </div>
      <div className="flex items-center gap-4">
        <label className="text-sm opacity-80" style={{ fontSize: 15 }}>
          Scrub x
        </label>
        <input
          type="range"
          min={view.xMin}
          max={view.xMax}
          step={(view.xMax - view.xMin) / 400}
          value={scrubX}
          disabled={disabled}
          onChange={(e) => setScrubX(Number(e.target.value))}
          className="flex-1"
        />
        <output className="tabular-nums" style={{ fontSize: 16 }} data-testid="limit-scrub-readout">
          x={scrubX.toFixed(2)}, f(x)={scrubY === null ? "undefined" : scrubY.toFixed(2)}
        </output>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <p className="text-base" style={{ fontSize: 16 }}>
          Your answer:
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant={kind === "value" ? "default" : "outline"} onClick={() => setKind("value")} disabled={disabled}>
            A value
          </Button>
          <input
            type="range"
            min={view.yMin}
            max={view.yMax}
            step={(view.yMax - view.yMin) / 400}
            value={answerY}
            disabled={disabled || kind !== "value"}
            onChange={(e) => setAnswerY(Number(e.target.value))}
            aria-label="Answer value"
            className="flex-1"
          />
          <output className="tabular-nums" style={{ fontSize: 16 }}>
            {answerY.toFixed(2)}
          </output>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={kind === "dne" ? "default" : "outline"} onClick={() => setKind("dne")} disabled={disabled}>
            Does not exist
          </Button>
          <Button variant={kind === "pos_infinity" ? "default" : "outline"} onClick={() => setKind("pos_infinity")} disabled={disabled}>
            +∞
          </Button>
          <Button variant={kind === "neg_infinity" ? "default" : "outline"} onClick={() => setKind("neg_infinity")} disabled={disabled}>
            −∞
          </Button>
        </div>
      </div>
      <div>
        <Button
          size="lg"
          disabled={disabled}
          onClick={() => onSubmit(limitToInput(kind, kind === "value" ? answerY : null))}
          data-testid="widget-submit"
        >
          Lock in answer
        </Button>
      </div>
    </div>
  );
}

function SlopePlace({ view, onSubmit, disabled }: { view: SlopeView; onSubmit: (i: SlopeInput) => void; disabled?: boolean }) {
  const [scrubX, setScrubX] = useState((view.xMin + view.xMax) / 2);
  const [sign, setSign] = useState<"positive" | "negative" | "zero">("positive");
  const [concavity, setConcavity] = useState<"up" | "down">("up");
  const [markers, setMarkers] = useState<number[]>([]);

  const xFrac = (v: number) => (v - view.xMin) / (view.xMax - view.xMin);
  const yFrac = (v: number) => 1 - (v - view.yMin) / (view.yMax - view.yMin);

  const segments: string[] = [];
  let current: string[] = [];
  for (const s of view.samples) {
    if (s.y === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      continue;
    }
    current.push(`${xFrac(s.x) * 100},${yFrac(s.y) * 100}`);
  }
  if (current.length > 1) segments.push(current.join(" "));

  const needsMultiple = view.ask === "critical_points" || view.ask === "inflection_points";
  const questionText =
    view.ask === "sign_at"
      ? `What is the sign of the slope at x = ${view.a}?`
      : view.ask === "concavity_at"
        ? `Is the curve concave up or down at x = ${view.a}?`
        : view.ask === "steepest"
          ? "Scrub to the steepest point, then place a marker."
          : view.ask === "critical_points"
            ? "Mark every x where the slope is zero."
            : "Mark every x where the concavity flips.";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        {questionText}
      </p>
      <div className="relative aspect-video w-full rounded-lg border-2" data-testid="slope-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
          {segments.map((pts, i) => (
            <polyline key={i} points={pts} fill="none" stroke="currentColor" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
          ))}
          {view.a !== null && (
            <line x1={xFrac(view.a) * 100} y1={0} x2={xFrac(view.a) * 100} y2={100} stroke="currentColor" strokeWidth={0.4} opacity={0.5} />
          )}
          {(view.ask === "steepest" || needsMultiple) && (
            <circle cx={xFrac(scrubX) * 100} cy={50} r={1.4} fill="currentColor" opacity={0.85} />
          )}
          {markers.map((m, i) => (
            <circle key={i} cx={xFrac(m) * 100} cy={50} r={1.6} fill="none" stroke="currentColor" strokeWidth={0.6} />
          ))}
        </svg>
      </div>

      {(view.ask === "steepest" || needsMultiple) && (
        <div className="flex items-center gap-4">
          <label className="text-sm opacity-80" style={{ fontSize: 15 }}>
            Scrub x
          </label>
          <input
            type="range"
            min={view.xMin}
            max={view.xMax}
            step={(view.xMax - view.xMin) / 400}
            value={scrubX}
            disabled={disabled}
            onChange={(e) => setScrubX(Number(e.target.value))}
            className="flex-1"
          />
          <output className="tabular-nums" style={{ fontSize: 16 }} data-testid="slope-scrub-readout">
            x={scrubX.toFixed(2)}
          </output>
          {needsMultiple && (
            <Button variant="outline" disabled={disabled} onClick={() => setMarkers((m) => [...m, scrubX])} data-testid="slope-add-marker">
              Add marker
            </Button>
          )}
        </div>
      )}

      {needsMultiple && markers.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Markers placed" data-testid="slope-markers">
          {markers.map((m, i) => (
            <li key={i}>
              <Button variant="outline" size="sm" disabled={disabled} onClick={() => setMarkers((ms) => ms.filter((_, j) => j !== i))}>
                x = {m.toFixed(2)} &times;
              </Button>
            </li>
          ))}
        </ul>
      )}

      {view.ask === "sign_at" && (
        <div className="flex flex-wrap gap-2">
          <Button variant={sign === "positive" ? "default" : "outline"} disabled={disabled} onClick={() => setSign("positive")}>
            Positive
          </Button>
          <Button variant={sign === "negative" ? "default" : "outline"} disabled={disabled} onClick={() => setSign("negative")}>
            Negative
          </Button>
          <Button variant={sign === "zero" ? "default" : "outline"} disabled={disabled} onClick={() => setSign("zero")}>
            Zero
          </Button>
        </div>
      )}
      {view.ask === "concavity_at" && (
        <div className="flex flex-wrap gap-2">
          <Button variant={concavity === "up" ? "default" : "outline"} disabled={disabled} onClick={() => setConcavity("up")}>
            Concave up
          </Button>
          <Button variant={concavity === "down" ? "default" : "outline"} disabled={disabled} onClick={() => setConcavity("down")}>
            Concave down
          </Button>
        </div>
      )}

      <div>
        <Button
          size="lg"
          disabled={disabled || (needsMultiple && markers.length === 0)}
          onClick={() => {
            if (view.ask === "sign_at") onSubmit(slopeSignToInput(sign));
            else if (view.ask === "concavity_at") onSubmit(slopeConcavityToInput(concavity));
            else if (view.ask === "steepest") onSubmit(slopeXToInput(scrubX));
            else onSubmit(slopeXsToInput(markers));
          }}
          data-testid="widget-submit"
        >
          Lock in answer
        </Button>
      </div>
    </div>
  );
}
