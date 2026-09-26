"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { WidgetDraft, WidgetProps } from "./Dial";

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

/** Matches mode riemann's View (src/mechanics/families/accumulator/riemann.ts): a read-only rectangle
 * approximation under the curve, plus either a numeric estimate or an over/under relation. */
export interface RiemannView {
  expr: string;
  a: number;
  b: number;
  n: number;
  method: string;
  ask: "estimate" | "over_under";
  rectangles: { x0: number; x1: number; height: number }[];
  samples: { x: number; y: number | null }[];
}
export type RiemannInput = { value: number } | { relation: "over" | "under" };

/** Matches mode torque's View (src/mechanics/families/balance/torque.ts): a beam with fixed masses and
 * one movable mass or pivot to place. */
export interface TorqueView {
  ask: "position" | "pivot";
  rangeMin: number;
  rangeMax: number;
  pivot: number | null;
  fixed: { mass: number; position: number }[];
  movableMass: number | null;
  unit: string;
}
export interface TorqueInput {
  position: number;
}

/** Matches mode search's View (src/mechanics/families/mapper/search.ts): a hidden number found by binary
 * search; the widget gives higher/lower feedback per probe from `hidden` (shown to the widget only for
 * that feedback, never surfaced as the answer). */
export interface SearchView {
  min: number;
  max: number;
  maxProbes: number;
  hidden: number;
  thingName: string;
}
export interface SearchInput {
  probes: number[];
}

/** Matches mode roots' View (src/mechanics/families/function_world/roots.ts): mark every x-intercept. */
export interface RootsView {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  samples: { x: number; y: number | null }[];
}
export interface RootsInput {
  xs: number[];
}

/** Matches mode asymptote's View (src/mechanics/families/function_world/asymptote.ts): pick the end
 * behavior kind and, for a finite value, its y. */
export type AsymptoteKind = "value" | "pos_infinity" | "neg_infinity" | "dne";
export interface AsymptoteView {
  direction: "pos_inf" | "neg_inf";
  xMin: number;
  xMax: number;
  samples: { x: number; y: number | null }[];
  far: { x: number; y: number | null }[];
}
export interface AsymptoteInput {
  kind: AsymptoteKind;
  value: number | null;
}

/** Matches mode continuity's View (src/mechanics/families/function_world/continuity.ts): find the break
 * points, classify the break at `a`, or repair the value at `a`, depending on `ask`. */
export type BreakKind = "removable" | "jump" | "infinite" | "continuous";
export interface ContinuityView {
  ask: "find" | "classify" | "repair";
  a: number | null;
  xMin: number;
  xMax: number;
  samples: { x: number; y: number | null }[];
  points: { x: number; y: number | null }[];
}
export interface ContinuityInput {
  xs: number[] | null;
  kind: BreakKind | null;
  y: number | null;
}

export type PlaceView = NumberLineView | PlaneView | LimitView | SlopeView | RiemannView | TorqueView | SearchView | RootsView | AsymptoteView | ContinuityView;
export type PlaceInput = NumberLineInput | PlaneInput | LimitInput | SlopeInput | RiemannInput | TorqueInput | SearchInput | RootsInput | AsymptoteInput | ContinuityInput;

export function isPlaneView(view: PlaceView): view is PlaneView {
  return "gridStep" in view;
}
export function isLimitView(view: PlaceView): view is LimitView {
  return "samples" in view && "at" in view;
}
export function isSlopeView(view: PlaceView): view is SlopeView {
  return "samples" in view && "ask" in view && "a" in view && !("points" in view);
}
export function isRiemannView(view: PlaceView): view is RiemannView {
  return "rectangles" in view;
}
export function isTorqueView(view: PlaceView): view is TorqueView {
  return "fixed" in view && "rangeMin" in view;
}
export function isSearchView(view: PlaceView): view is SearchView {
  return "hidden" in view && "maxProbes" in view;
}
export function isRootsView(view: PlaceView): view is RootsView {
  return "samples" in view && "yMin" in view && !("ask" in view) && !("at" in view);
}
export function isAsymptoteView(view: PlaceView): view is AsymptoteView {
  return "far" in view;
}
export function isContinuityView(view: PlaceView): view is ContinuityView {
  return "points" in view;
}

export function supports(view: unknown): boolean {
  if (typeof view !== "object" || view === null) return false;
  const v = view as PlaceView;
  return (
    isPlaneView(v) ||
    isLimitView(v) ||
    isRiemannView(v) ||
    isTorqueView(v) ||
    isSearchView(v) ||
    isAsymptoteView(v) ||
    isContinuityView(v) ||
    isSlopeView(v) ||
    isRootsView(v) ||
    "landmarks" in v
  );
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
export function Place({ view, onSubmit, onLive, onDraft, disabled }: WidgetProps<PlaceView, PlaceInput>) {
  if (isPlaneView(view)) return <PlanePlace view={view} onSubmit={onSubmit as (i: PlaneInput) => void} disabled={disabled} />;
  if (isRiemannView(view)) return <RiemannPlace view={view} onSubmit={onSubmit as (i: RiemannInput) => void} disabled={disabled} />;
  if (isTorqueView(view)) return <TorquePlace view={view} onSubmit={onSubmit as (i: TorqueInput) => void} disabled={disabled} />;
  if (isSearchView(view)) return <SearchPlace view={view} onSubmit={onSubmit as (i: SearchInput) => void} disabled={disabled} />;
  if (isAsymptoteView(view)) return <AsymptotePlace view={view} onSubmit={onSubmit as (i: AsymptoteInput) => void} disabled={disabled} />;
  if (isContinuityView(view)) return <ContinuityPlace view={view} onSubmit={onSubmit as (i: ContinuityInput) => void} disabled={disabled} />;
  if (isRootsView(view)) return <RootsPlace view={view} onSubmit={onSubmit as (i: RootsInput) => void} disabled={disabled} />;
  if (isSlopeView(view)) return <SlopePlace view={view} onSubmit={onSubmit as (i: SlopeInput) => void} disabled={disabled} />;
  if (isLimitView(view)) return <LimitPlace view={view} onSubmit={onSubmit as (i: LimitInput) => void} disabled={disabled} />;
  return <NumberLinePlace view={view} onSubmit={onSubmit as (i: NumberLineInput) => void} onLive={onLive} onDraft={onDraft} disabled={disabled} />;
}

/** Shared read-only curve plot (samples as a polyline, breaking at null gaps) used by several place
 * variants below. */
function CurvePlot({
  samples,
  xMin,
  xMax,
  yMin,
  yMax,
  testId,
  children,
}: {
  samples: { x: number; y: number | null }[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  testId?: string;
  children?: ReactNode;
}) {
  const xFrac = (v: number) => ((v - xMin) / (xMax - xMin)) * 100;
  const yFrac = (v: number) => (1 - (v - yMin) / (yMax - yMin)) * 100;
  const segments: string[] = [];
  let current: string[] = [];
  for (const s of samples) {
    if (s.y === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      continue;
    }
    current.push(`${xFrac(s.x)},${yFrac(s.y)}`);
  }
  if (current.length > 1) segments.push(current.join(" "));
  return (
    <div className="relative aspect-video w-full rounded-lg border-2" data-testid={testId}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
        {segments.map((pts, i) => (
          <polyline key={i} points={pts} fill="none" stroke="currentColor" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        ))}
        {children}
      </svg>
    </div>
  );
}

/** accumulator.riemann: the rectangle approximation is read-only (it's the given method/n); the player
 * either types the estimated sum or reports whether it over/undershoots the true area. */
function RiemannPlace({ view, onSubmit, disabled }: { view: RiemannView; onSubmit: (i: RiemannInput) => void; disabled?: boolean }) {
  const [value, setValue] = useState("");
  const [relation, setRelation] = useState<"over" | "under">("over");
  const xFrac = (v: number) => ((v - view.a) / (view.b - view.a)) * 100;
  const sum = view.rectangles.reduce((acc, r) => acc + r.height * (r.x1 - r.x0), 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        {view.n}-rectangle {view.method} Riemann sum for {view.expr} on [{view.a}, {view.b}].
      </p>
      <CurvePlot samples={view.samples} xMin={view.a} xMax={view.b} yMin={Math.min(0, ...view.rectangles.map((r) => r.height))} yMax={Math.max(0, ...view.rectangles.map((r) => r.height)) || 1} testId="riemann-plot">
        {view.rectangles.map((r, i) => {
          const h = Math.max(0, ...view.rectangles.map((x) => x.height)) || 1;
          const yTop = (1 - r.height / h) * 100;
          return (
            <rect
              key={i}
              x={xFrac(r.x0)}
              y={r.height >= 0 ? yTop : 100}
              width={xFrac(r.x1) - xFrac(r.x0)}
              height={Math.abs((r.height / h) * 100)}
              fill="currentColor"
              opacity={0.25}
              stroke="currentColor"
              strokeWidth={0.4}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </CurvePlot>
      {view.ask === "estimate" ? (
        <div className="flex items-center gap-3">
          <label className="text-lg" style={{ fontSize: 18 }}>
            Estimated area (sum of the rectangles):
          </label>
          <input
            type="number"
            value={value}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-lg border-2 px-3 py-2 text-lg tabular-nums"
            style={{ fontSize: 18, width: 140 }}
            data-testid="riemann-value"
          />
          <span className="text-sm opacity-60" style={{ fontSize: 13 }}>
            (rectangles sum to {sum.toFixed(2)})
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant={relation === "over" ? "default" : "outline"} disabled={disabled} onClick={() => setRelation("over")}>
            Overestimate
          </Button>
          <Button variant={relation === "under" ? "default" : "outline"} disabled={disabled} onClick={() => setRelation("under")}>
            Underestimate
          </Button>
        </div>
      )}
      <div>
        <Button
          size="lg"
          disabled={disabled || (view.ask === "estimate" && value.trim() === "")}
          onClick={() => onSubmit(view.ask === "estimate" ? { value: Number(value) } : { relation })}
          data-testid="widget-submit"
        >
          Lock in answer
        </Button>
      </div>
    </div>
  );
}

/** balance.torque: a beam with fixed masses at fixed positions; drag (via slider) the movable mass, or
 * the pivot, to balance it. */
function TorquePlace({ view, onSubmit, disabled }: { view: TorqueView; onSubmit: (i: TorqueInput) => void; disabled?: boolean }) {
  const [position, setPosition] = useState((view.rangeMin + view.rangeMax) / 2);
  const frac = (v: number) => ((v - view.rangeMin) / (view.rangeMax - view.rangeMin)) * 100;
  const pivotPos = view.ask === "pivot" ? position : (view.pivot ?? (view.rangeMin + view.rangeMax) / 2);
  const netTorque = view.fixed.reduce((acc, f) => acc + f.mass * (f.position - pivotPos), 0) + (view.ask === "position" ? (view.movableMass ?? 0) * (position - pivotPos) : 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        {view.ask === "position" ? `Place the ${view.movableMass}${view.unit} mass so the beam balances.` : "Place the pivot so the beam balances."}
      </p>
      <div className="relative h-20 rounded-lg border-2" data-testid="torque-beam">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 bg-current opacity-40" />
        {view.fixed.map((f, i) => (
          <div key={i} className="absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ left: `${frac(f.position)}%` }}>
            <span className="absolute top-full mt-1 -translate-x-1/2 whitespace-nowrap text-xs" style={{ fontSize: 12, left: "50%" }}>
              {f.mass}
            </span>
          </div>
        ))}
        <div
          className="absolute bottom-0 h-4 w-4 -translate-x-1/2 translate-y-1/2 rotate-45 border-2"
          style={{ left: `${frac(pivotPos)}%`, borderColor: "currentColor" }}
          aria-hidden
        />
        {view.ask === "position" && (
          <div
            className="absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4"
            style={{ left: `${frac(position)}%`, borderColor: "currentColor", background: "color-mix(in oklab, currentColor 40%, transparent)" }}
          />
        )}
      </div>
      <input
        type="range"
        min={view.rangeMin}
        max={view.rangeMax}
        step={(view.rangeMax - view.rangeMin) / 400}
        value={position}
        disabled={disabled}
        onChange={(e) => setPosition(Number(e.target.value))}
        aria-label={view.ask === "position" ? "Movable mass position" : "Pivot position"}
        className="w-full"
      />
      <div className="flex items-center justify-between gap-4">
        <output className="tabular-nums" style={{ fontSize: 18 }} data-testid="torque-readout">
          position={position.toFixed(2)} {view.unit} · net torque≈{netTorque.toFixed(2)}
        </output>
        <Button size="lg" disabled={disabled} onClick={() => onSubmit({ position })} data-testid="widget-submit">
          Lock in position
        </Button>
      </div>
    </div>
  );
}

/** mapper.search: binary search on a hidden number. Each probe gets higher/lower/found feedback
 * (computed from `view.hidden`, never shown directly). */
function SearchPlace({ view, onSubmit, disabled }: { view: SearchView; onSubmit: (i: SearchInput) => void; disabled?: boolean }) {
  const [probes, setProbes] = useState<number[]>([]);
  const [guess, setGuess] = useState(String(Math.round((view.min + view.max) / 2)));
  const found = probes.includes(view.hidden);
  const outOfProbes = probes.length >= view.maxProbes;

  const submitProbe = () => {
    const g = Number(guess);
    if (!Number.isFinite(g) || found || outOfProbes) return;
    setProbes((p) => [...p, g]);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Find the hidden {view.thingName} between {view.min} and {view.max} in {view.maxProbes} probes or fewer.
      </p>
      <ul className="flex flex-col gap-1" aria-label="Probes so far" data-testid="search-probes">
        {probes.map((p, i) => (
          <li key={i} style={{ fontSize: 16 }}>
            {p}: {p === view.hidden ? "found it!" : p < view.hidden ? "higher" : "lower"}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={guess}
          disabled={disabled || found || outOfProbes}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitProbe()}
          className="rounded-lg border-2 px-3 py-2 text-lg tabular-nums"
          style={{ fontSize: 18, width: 140 }}
          data-testid="search-guess"
        />
        <Button disabled={disabled || found || outOfProbes} onClick={submitProbe}>
          Probe
        </Button>
      </div>
      <div>
        <Button size="lg" disabled={disabled || probes.length === 0} onClick={() => onSubmit({ probes })} data-testid="widget-submit">
          Lock in probes
        </Button>
      </div>
    </div>
  );
}

/** function_world.roots: click along the plotted curve to mark every x-intercept. */
function RootsPlace({ view, onSubmit, disabled }: { view: RootsView; onSubmit: (i: RootsInput) => void; disabled?: boolean }) {
  const [scrubX, setScrubX] = useState((view.xMin + view.xMax) / 2);
  const [xs, setXs] = useState<number[]>([]);
  const xFrac = (v: number) => ((v - view.xMin) / (view.xMax - view.xMin)) * 100;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Mark every x-intercept (where the curve crosses y = 0).
      </p>
      <CurvePlot samples={view.samples} xMin={view.xMin} xMax={view.xMax} yMin={view.yMin} yMax={view.yMax} testId="roots-plot">
        <line x1={0} y1={((0 - view.yMin) / (view.yMax - view.yMin)) * -100 + 100} x2={100} y2={((0 - view.yMin) / (view.yMax - view.yMin)) * -100 + 100} stroke="currentColor" strokeWidth={0.3} opacity={0.4} />
        {xs.map((x, i) => (
          <circle key={i} cx={xFrac(x)} cy={((0 - view.yMin) / (view.yMax - view.yMin)) * -100 + 100} r={1.6} fill="none" stroke="currentColor" strokeWidth={0.6} />
        ))}
      </CurvePlot>
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
        <output className="tabular-nums" style={{ fontSize: 16 }}>
          x={scrubX.toFixed(2)}
        </output>
        <Button variant="outline" disabled={disabled} onClick={() => setXs((m) => [...m, scrubX])} data-testid="roots-add-marker">
          Mark root
        </Button>
      </div>
      {xs.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Roots marked">
          {xs.map((x, i) => (
            <li key={i}>
              <Button variant="outline" size="sm" disabled={disabled} onClick={() => setXs((m) => m.filter((_, j) => j !== i))}>
                x = {x.toFixed(2)} &times;
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button size="lg" disabled={disabled} onClick={() => onSubmit({ xs })} data-testid="widget-submit">
          Lock in roots
        </Button>
      </div>
    </div>
  );
}

/** function_world.asymptote: read the far-side samples, then pick the end behavior. */
function AsymptotePlace({ view, onSubmit, disabled }: { view: AsymptoteView; onSubmit: (i: AsymptoteInput) => void; disabled?: boolean }) {
  const [kind, setKind] = useState<AsymptoteKind>("value");
  const [value, setValue] = useState("0");
  const farYs = view.far.map((f) => f.y).filter((y): y is number => y !== null);
  const yMin = Math.min(0, ...farYs, ...view.samples.map((s) => s.y ?? 0));
  const yMax = Math.max(0, ...farYs, ...view.samples.map((s) => s.y ?? 0)) || 1;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        As x → {view.direction === "pos_inf" ? "+∞" : "-∞"}, where does f(x) go?
      </p>
      <CurvePlot samples={view.samples} xMin={view.xMin} xMax={view.xMax} yMin={yMin} yMax={yMax} testId="asymptote-plot" />
      <table className="text-sm" style={{ fontSize: 14 }} data-testid="asymptote-far-table">
        <tbody>
          {view.far.map((f, i) => (
            <tr key={i}>
              <td className="pr-3 tabular-nums">x={f.x.toExponential(0)}</td>
              <td className="tabular-nums">f(x)={f.y === null ? "undefined" : f.y.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={kind === "value" ? "default" : "outline"} disabled={disabled} onClick={() => setKind("value")}>
          A value
        </Button>
        <input
          type="number"
          value={value}
          disabled={disabled || kind !== "value"}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-lg border-2 px-3 py-2 text-lg tabular-nums"
          style={{ fontSize: 18, width: 120 }}
        />
        <Button variant={kind === "pos_infinity" ? "default" : "outline"} disabled={disabled} onClick={() => setKind("pos_infinity")}>
          +∞
        </Button>
        <Button variant={kind === "neg_infinity" ? "default" : "outline"} disabled={disabled} onClick={() => setKind("neg_infinity")}>
          −∞
        </Button>
        <Button variant={kind === "dne" ? "default" : "outline"} disabled={disabled} onClick={() => setKind("dne")}>
          Does not exist
        </Button>
      </div>
      <div>
        <Button
          size="lg"
          disabled={disabled}
          onClick={() => onSubmit({ kind, value: kind === "value" ? Number(value) : null })}
          data-testid="widget-submit"
        >
          Lock in answer
        </Button>
      </div>
    </div>
  );
}

/** function_world.continuity: find every break point, classify the break at `a`, or give the repair
 * value at `a` — whichever `ask` calls for. */
function ContinuityPlace({ view, onSubmit, disabled }: { view: ContinuityView; onSubmit: (i: ContinuityInput) => void; disabled?: boolean }) {
  const [scrubX, setScrubX] = useState(view.a ?? (view.xMin + view.xMax) / 2);
  const [xs, setXs] = useState<number[]>([]);
  const [kind, setKind] = useState<BreakKind>("removable");
  const [y, setY] = useState("0");
  const xFrac = (v: number) => ((v - view.xMin) / (view.xMax - view.xMin)) * 100;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        {view.ask === "find" && "Mark every x where the function breaks (is discontinuous)."}
        {view.ask === "classify" && `Classify the break at x = ${view.a}.`}
        {view.ask === "repair" && `What value at x = ${view.a} would make the function continuous there?`}
      </p>
      <CurvePlot samples={view.samples} xMin={view.xMin} xMax={view.xMax} yMin={Math.min(0, ...view.samples.map((s) => s.y ?? 0))} yMax={Math.max(1, ...view.samples.map((s) => s.y ?? 0))} testId="continuity-plot">
        {view.points.map((p, i) =>
          p.y !== null ? <circle key={i} cx={xFrac(p.x)} cy={50} r={1.2} fill="currentColor" opacity={0.7} /> : null,
        )}
        {view.ask === "find" &&
          xs.map((x, i) => <circle key={`m${i}`} cx={xFrac(x)} cy={50} r={1.6} fill="none" stroke="currentColor" strokeWidth={0.6} />)}
      </CurvePlot>
      {view.ask === "find" && (
        <>
          <div className="flex items-center gap-4">
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
            <output className="tabular-nums" style={{ fontSize: 16 }}>
              x={scrubX.toFixed(2)}
            </output>
            <Button variant="outline" disabled={disabled} onClick={() => setXs((m) => [...m, scrubX])}>
              Mark break
            </Button>
          </div>
          {xs.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {xs.map((x, i) => (
                <li key={i}>
                  <Button variant="outline" size="sm" disabled={disabled} onClick={() => setXs((m) => m.filter((_, j) => j !== i))}>
                    x = {x.toFixed(2)} &times;
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {view.ask === "classify" && (
        <div className="flex flex-wrap gap-2">
          {(["removable", "jump", "infinite", "continuous"] as const).map((k) => (
            <Button key={k} variant={kind === k ? "default" : "outline"} disabled={disabled} onClick={() => setKind(k)}>
              {k}
            </Button>
          ))}
        </div>
      )}
      {view.ask === "repair" && (
        <input
          type="number"
          value={y}
          disabled={disabled}
          onChange={(e) => setY(e.target.value)}
          className="rounded-lg border-2 px-3 py-2 text-lg tabular-nums"
          style={{ fontSize: 18, width: 140 }}
        />
      )}
      <div>
        <Button
          size="lg"
          disabled={disabled}
          onClick={() =>
            onSubmit({
              xs: view.ask === "find" ? xs : null,
              kind: view.ask === "classify" ? kind : null,
              y: view.ask === "repair" ? Number(y) : null,
            })
          }
          data-testid="widget-submit"
        >
          Lock in answer
        </Button>
      </div>
    </div>
  );
}

function NumberLinePlace({
  view,
  onSubmit,
  onLive,
  onDraft,
  disabled,
}: {
  view: NumberLineView;
  onSubmit: (i: NumberLineInput) => void;
  onLive?: (value: number) => void;
  onDraft?: (d: WidgetDraft) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [fraction, setFraction] = useState(0.5);
  const value = fractionToValue(view, fraction);

  useEffect(() => {
    onLive?.(value);
    onDraft?.({ input: numberLineToInput(value), complete: true, focus: null });
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
