"use client";

import "./theme.css";
import { useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from "react";
import { DraftIncompleteError, emptyDraftInput, isDraftComplete, toSubmitInput } from "@/world/draft-inputs";
import type { AidTier, AnyContraptionMeta, Draft, HintsUsed, PanelContext, PanelLive, PanelStatic, PoseInput } from "@/world/types";
import { BriefSheet, type Brief } from "./BriefSheet";
import { CardView } from "./cards/CardView";
import { ControlView, resolveControlKind, SURFACE_KIND } from "./controls";
import { fromDraftInput as scrubFromDraft, rangeOfProbe } from "./controls/scrub.logic";
import { defaultPanelLive, defaultPanelStatic } from "./default-panel";
import { metricsFor, PanelMetricsContext, useElementSize } from "./metrics";
import { applyOverrides, chipsFor, displayStack, mergeLive, resolvePanelStatic, sharesDomain, showsRecord, splitSurface } from "./panel-model";
import { BackTab } from "./primitives/BackTab";
import { HexGrid } from "./primitives/HexGrid";
import { TraceLine } from "./primitives/TraceLine";
import { fractionOf } from "./Scrubber";
import { ScrubControl } from "./controls/ScrubControl";
import { SuccessBadge } from "./SuccessBadge";
import type { ControlDraft, PanelDraft, PanelStation } from "./types";
import { VerifyButton } from "./VerifyButton";

export interface InstrumentPanelHandle {
  /** Sets the open control to a draft input THROUGH its control API (debug `applySolutionDraft`, cached restores). */
  applyDraftInput(input: unknown): void;
  /** Moves the probe scrubber (or the scalar input) through its control API (debug `setProbe`). */
  setProbe(value: number): void;
  /** Focus the first control element (panel open). */
  focusFirst(): void;
}

export interface InstrumentPanelProps {
  station: PanelStation;
  meta: AnyContraptionMeta;
  /** mode.present(params, seed + index), memoized per encounter: never params or solution */
  view: unknown;
  /** A6: record strip, solved ids and the open station's probe window */
  context: PanelContext;
  aidTier?: AidTier;
  hintsUsed?: HintsUsed;
  /** the pinned instruction line (the dialogue bar shows it; every control's aria-describedby points here) */
  instruction: string;
  /** a cached draft to restore on reopen */
  initialDraft?: Draft | null;
  /** failed Verifies so far on this station (WaveControl replays with answers preselected) */
  attempt?: number;
  /** "success" shows the badge for 1.6 s where Verify was, then onBadgeDone */
  result?: "success" | null;
  /** grading or a world animation is running: controls and Verify are disabled */
  busy?: boolean;
  /** the contraption's srText (ContraptionController, ≤ 1 per second) */
  srText?: string | null;
  /** Verify outcome text (the badge or the display feedback), announced assertively */
  announce?: string | null;
  reducedMotion?: boolean;
  /** force the opaque material on/off; left undefined the panel switches itself when fps < 45 for 2 s (§3.1) */
  opaque?: boolean;
  /** the vault layout's left column (and the (i) sheet) */
  brief?: Brief | null;
  /** the controller's station clock and sim state, for metas whose panelLive reads them (sampled at 10 Hz) */
  getLive?: () => { t: number; sim: unknown };
  onDraft: (d: PanelDraft) => void;
  /** Verify: the mode's exact Input (toSubmitInput) and the draft that produced it */
  onVerify: (submitInput: unknown, draft: PanelDraft) => void;
  /** back tab or Esc: close without grading */
  onBack: () => void;
  onBadgeDone?: () => void;
  handleRef?: Ref<InstrumentPanelHandle>;
  className?: string;
  style?: CSSProperties;
}

const EMPTY_STATIC: PanelStatic = { cards: [], input: null, probe: null, recordPins: [] };
const EMPTY_LIVE: PanelLive = { scrubX: null, readout: null, chips: [], highlights: [], liveCards: [] };
const FOCUSABLE_FIRST = '[role="slider"]:not([aria-disabled="true"]), [role="radio"], [data-testid="widget-first-option"], .xp-token:not(:disabled), .widget button:not(:disabled), .widget input';

function initialControlDraft(modeKey: PanelStation["modeKey"], view: unknown, d: Draft | null | undefined): ControlDraft {
  const input = d?.input ?? emptyDraftInput(modeKey, view);
  return {
    input,
    complete: d ? d.complete : isDraftComplete(modeKey, input, view) && input !== null,
    focus: null,
    hover: null,
    settled: true,
    wave: null,
    marks: d?.marks ?? null,
  };
}

/** Throttles a changing text to at most one update per `ms` (the SR live region, §3.5). */
function useThrottled(text: string | null | undefined, ms: number): string {
  const [out, setOut] = useState(text ?? "");
  const last = useRef(0);
  useEffect(() => {
    const next = text ?? "";
    const wait = Math.max(0, last.current + ms - Date.now());
    const t = setTimeout(() => {
      last.current = Date.now();
      setOut((o) => (o === next ? o : next));
    }, wait);
    return () => clearTimeout(t);
  }, [text, ms]);
  return out;
}

/**
 * The instrument panel (docs/design/20 §3; bible §2.3, §3): the translucent hex-grid frame on the right with the
 * back tab, the card stack (the panel-owned RECORD card first when the game has a record strip), the control slot,
 * the orange scrubber (the scalar input, or the probe of a discrete mode) with one orange line across every card that
 * shares its window, and the Verify row / success badge. Live state stays local to the panel; drafts go out through
 * `onDraft` (the client keeps them in a ref and binds the world). `data-panel` marks the D4 keyboard guard.
 */
export function InstrumentPanel(props: InstrumentPanelProps) {
  const { station, meta, view, context, instruction } = props;
  const aidTier = props.aidTier ?? 0;
  const hintsUsed = props.hintsUsed ?? 0;
  const reducedMotion = props.reducedMotion ?? false;
  const layout = station.layout;
  const uid = useId().replace(/:/g, "");
  const instructionId = `${uid}-instruction`;
  const kind = resolveControlKind(meta.control, station.modeKey, view);
  const scalar = kind === "scrub";
  const record = showsRecord(context, layout);

  // ---------------------------------------------------------------- static model (per encounter, aidTier, hintsUsed)
  const { stat, usingDefaults } = useMemo(() => {
    let metaStatic: PanelStatic = EMPTY_STATIC;
    try {
      metaStatic = meta.panelStatic({ view, config: station.config, aidTier, hintsUsed, reducedMotion, skinId: station.skinId, record });
    } catch {
      metaStatic = EMPTY_STATIC; // a meta bug must never take the panel down; the view defaults still render
    }
    return resolvePanelStatic(metaStatic, defaultPanelStatic(station.modeKey, view), scalar);
  }, [meta, view, station.config, station.skinId, station.modeKey, aidTier, hintsUsed, reducedMotion, record, scalar]);

  const range = scalar ? stat.input : null;
  const probeSpec = scalar ? null : (station.probe ?? stat.probe);
  const probeRange = useMemo(() => (probeSpec ? rangeOfProbe(probeSpec) : null), [probeSpec]);

  // ---------------------------------------------------------------- draft state (local to the panel)
  const [ctrl, setCtrl] = useState<ControlDraft>(() => {
    const c = initialControlDraft(station.modeKey, view, props.initialDraft);
    return scalar && range ? { ...c, input: { value: scrubFromDraft(c.input, range).value }, complete: true } : c;
  });
  const [probe, setProbeState] = useState<number | null>(() => (probeSpec ? (props.initialDraft?.probe ?? probeSpec.initial ?? probeSpec.min) : null));
  const [settled, setSettled] = useState(true);
  const [touched, setTouched] = useState(Boolean(props.initialDraft));
  const [restore, setRestore] = useState<{ seq: number; input: unknown }>({ seq: 0, input: props.initialDraft?.input ?? null });
  const [version, setVersion] = useState(props.initialDraft?.seq ?? 0);
  const ctrlRef = useRef(ctrl);
  const probeRef = useRef(probe);
  const onDraftRef = useRef(props.onDraft);
  useLayoutEffect(() => {
    ctrlRef.current = ctrl;
    probeRef.current = probe;
    onDraftRef.current = props.onDraft;
  });

  const emit = useCallback((c: ControlDraft, p: number | null, s: boolean) => {
    ctrlRef.current = c;
    probeRef.current = p;
    setVersion((v) => v + 1);
    onDraftRef.current({ ...c, probe: p, settled: s });
  }, []);

  const onControl = useCallback(
    (c: ControlDraft) => {
      setCtrl(c);
      setSettled(c.settled);
      setTouched(true);
      emit(c, probeRef.current, c.settled);
    },
    [emit],
  );
  const onScalar = useCallback(
    (v: number, s: boolean) => {
      const c: ControlDraft = { input: { value: v }, complete: Number.isFinite(v), focus: null, hover: null, settled: s, wave: null, marks: null };
      setCtrl(c);
      setSettled(s);
      setTouched(true);
      emit(c, null, s);
    },
    [emit],
  );
  const onProbe = useCallback(
    (v: number, s: boolean) => {
      setProbeState(v);
      setSettled(s);
      setTouched(true);
      emit(ctrlRef.current, v, s);
    },
    [emit],
  );

  // ---------------------------------------------------------------- live model (sim-backed metas re-sample at 10 Hz)
  const [, setFrame] = useState(0);
  useEffect(() => {
    if (!props.getLive || !meta.sim) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % 1_000_000), 100);
    return () => clearInterval(t);
  }, [props.getLive, meta.sim]);
  const liveExtras = props.getLive?.() ?? { t: 0, sim: null };
  const scalarValue = scalar && ctrl.input && typeof (ctrl.input as { value?: unknown }).value === "number" ? (ctrl.input as { value: number }).value : null;
  const draftFull: Draft | null = touched
    ? { encounterId: station.encounterId, modeKey: station.modeKey, ...ctrl, probe, settled, seq: version }
    : null;
  const poseInput: PoseInput<unknown, unknown> = {
    view,
    draft: draftFull,
    config: station.config,
    probe: probe ?? (probeSpec ? (probeSpec.initial ?? probeSpec.min) : null),
    t: liveExtras.t,
    aidTier,
    hintsUsed,
    sim: liveExtras.sim,
    solved: props.result === "success",
    reducedMotion,
  };
  let live: PanelLive = EMPTY_LIVE;
  if (usingDefaults) live = defaultPanelLive(stat, station.modeKey, view, scalar ? scalarValue : probe);
  else {
    try {
      live = meta.panelLive(stat, poseInput);
    } catch {
      live = EMPTY_LIVE;
    }
  }
  const scrubX = live.scrubX ?? (scalar ? scalarValue : probe);

  // ---------------------------------------------------------------- the stack
  const merged = applyOverrides(mergeLive(stat.cards, live.liveCards), station.cardOverrides);
  const stack0 = displayStack(merged, context, stat.recordPins, scrubX, layout);
  const { stack, surface } = splitSurface(stack0, SURFACE_KIND[kind]);
  const domain = range ?? probeRange;

  // ---------------------------------------------------------------- geometry: metrics, the one orange line
  const [rootRef, rootSize] = useElementSize<HTMLDivElement>({ w: 806, h: 900 });
  const metrics = metricsFor(rootSize.w);
  const instrumentRef = useRef<HTMLDivElement | null>(null);
  /** the orange line: one segment per contiguous run of cards sharing the scrubber's window; the run that sits right
   * above the ruler continues down to the knob (it never crosses a control surface or an unrelated card) */
  const [line, setLine] = useState<{ segments: readonly { top: number; bottom: number }[]; width: number } | null>(null);
  const domainMin = domain?.min ?? null;
  const domainMax = domain?.max ?? null;
  const shareKey = stack.map((d) => (sharesDomain(d.card, domain) ? "1" : "0")).join("");
  useLayoutEffect(() => {
    const box = instrumentRef.current;
    const measure = () => {
      const ruler = box?.querySelector<HTMLElement>(".xp-ruler-row") ?? null;
      const stackEl = box?.querySelector<HTMLElement>(".xp-stack") ?? null;
      if (!box || !ruler || !stackEl || domainMin === null || domainMax === null) {
        setLine(null);
        return;
      }
      const boxes: { top: number; bottom: number; shares: boolean }[] = [];
      for (const child of Array.from(stackEl.children) as HTMLElement[]) {
        const slot = child.matches("[data-display-slot]") ? child.querySelector<HTMLElement>(":scope > .xp-slot") : child;
        if (!slot) continue;
        boxes.push({ top: stackEl.offsetTop + slot.offsetTop, bottom: stackEl.offsetTop + slot.offsetTop + slot.offsetHeight, shares: child.dataset.share === "true" });
      }
      const segments: { top: number; bottom: number }[] = [];
      let run: { top: number; bottom: number } | null = null;
      boxes.forEach((b, i) => {
        if (b.shares) run = run ? { top: run.top, bottom: b.bottom } : { top: b.top, bottom: b.bottom };
        if (run && (!b.shares || i === boxes.length - 1)) {
          const last = b.shares && i === boxes.length - 1;
          segments.push(last ? { top: run.top, bottom: ruler.offsetTop } : run);
          run = null;
        }
      });
      const next = { segments, width: ruler.clientWidth };
      setLine((l) => (l && l.width === next.width && JSON.stringify(l.segments) === JSON.stringify(segments) ? l : next));
    };
    measure();
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    const stackEl = box.querySelector(".xp-stack");
    if (stackEl) ro.observe(stackEl);
    return () => ro.disconnect();
  }, [domainMin, domainMax, shareKey, kind, layout]);

  // ---------------------------------------------------------------- playback (probe.playback: min → max on success)
  useEffect(() => {
    if (props.result !== "success" || !probeSpec?.playback || reducedMotion) return;
    let raf = 0;
    const t0 = performance.now();
    const run = (now: number) => {
      const u = Math.min(1, (now - t0) / 1200);
      onProbe(probeSpec.min + u * (probeSpec.max - probeSpec.min), u >= 1);
      if (u < 1) raf = requestAnimationFrame(run);
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [props.result, probeSpec, reducedMotion, onProbe]);

  // ---------------------------------------------------------------- focus, keys, handle
  const focusFirst = useCallback(() => {
    const el = rootRef.current?.querySelector<HTMLElement>(FOCUSABLE_FIRST);
    (el ?? rootRef.current)?.focus({ preventScroll: true });
  }, [rootRef]);
  useEffect(() => {
    const raf = requestAnimationFrame(focusFirst);
    return () => cancelAnimationFrame(raf);
    // focus once on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(
    props.handleRef,
    () => ({
      applyDraftInput: (input: unknown) => {
        if (scalar && range) {
          onScalar(scrubFromDraft(input, range).value, true);
          return;
        }
        setRestore((r) => ({ seq: r.seq + 1, input }));
        const c: ControlDraft = { ...ctrlRef.current, input, complete: isDraftComplete(station.modeKey, input, view) };
        onControl(c);
      },
      setProbe: (v: number) => {
        if (scalar && range) onScalar(Math.min(range.max, Math.max(range.min, v)), true);
        else if (probeSpec) onProbe(Math.min(probeSpec.max, Math.max(probeSpec.min, v)), true);
      },
      focusFirst,
    }),
    [scalar, range, probeSpec, onScalar, onProbe, onControl, station.modeKey, view, focusFirst],
  );

  const verify = () => {
    if (!ctrl.complete || props.busy) return;
    let submit: unknown;
    try {
      submit = toSubmitInput(station.modeKey, ctrl.input);
    } catch (e) {
      if (e instanceof DraftIncompleteError) return;
      throw e;
    }
    props.onVerify(submit, { ...ctrl, probe, settled });
  };

  // §3.1: fall back to the opaque material when fps stays below 45 for 2 s (unless the host decides via `opaque`)
  const [lowFps, setLowFps] = useState(false);
  useEffect(() => {
    if (props.opaque !== undefined || typeof requestAnimationFrame === "undefined") return;
    let raf = 0;
    let frames = 0;
    let start = performance.now();
    let slowMs = 0;
    const loop = (now: number) => {
      frames += 1;
      const dt = now - start;
      if (dt >= 500) {
        slowMs = (frames * 1000) / dt < 45 ? slowMs + dt : 0;
        if (slowMs >= 2000) {
          setLowFps(true);
          return;
        }
        frames = 0;
        start = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [props.opaque]);
  const opaque = props.opaque ?? lowFps;

  const srPolite = useThrottled(props.srText, 1000);
  const assertive = props.result === "success" ? station.successBadge : (props.announce ?? "");
  const disabled = Boolean(props.busy) || props.result === "success";
  const sandbox = layout === "sandbox";
  const verifyLabel = station.verifyLabel;
  const symbol = station.inputSymbol ?? range?.symbol ?? probeSpec?.symbol ?? "x";

  const control =
    kind !== "scrub" ? (
      <ControlView
        key={`${station.encounterId}-${restore.seq}`}
        kind={kind}
        modeKey={station.modeKey}
        view={view}
        initialInput={restore.input}
        initialMarks={props.initialDraft?.marks ?? null}
        surface={surface}
        highlights={live.highlights}
        phases={station.bossPhases}
        attempt={props.attempt ?? 0}
        disabled={disabled}
        describedBy={instructionId}
        verifyLabel={verifyLabel}
        shadeCounts={hintsUsed >= 3}
        onChange={onControl}
        onSubmitInput={(input) => props.onVerify(input, { ...ctrlRef.current, probe, settled })}
      />
    ) : null;
  /* Multiple choice sits beside the plots. In the stack it was squeezed to a short scroller and the
     leftover options landed under the ruler and Verify. */
  const choicesBeside = kind === "aim" && stack.length > 0;
  /* A probe or scalar ruler adjusts the cards above it. Question controls used to sit between those
     cards and the ruler, so the slider was no longer next to the thing it moves. */
  const coupleSlider = !choicesBeside && control !== null && (Boolean(scalar && range) || Boolean(probeSpec && probeRange));

  const ruler = (
    <>
      {scalar && range ? (
        <ScrubControl
          range={range}
          value={scalarValue ?? range.min}
          readout={live.readout}
          symbol={symbol}
          label={`${station.objectNoun}: ${symbol}`}
          disabled={disabled}
          describedBy={instructionId}
          onChange={onScalar}
          testId="scrubber"
        />
      ) : null}
      {!scalar && probeSpec && probeRange ? (
        <ScrubControl
          range={probeRange}
          value={probe ?? probeSpec.min}
          readout={live.readout}
          symbol={station.inputSymbol ?? probeSpec.symbol}
          label={`${probeSpec.label} (probe, not graded)`}
          probe={probeSpec}
          disabled={disabled}
          describedBy={instructionId}
          onChange={onProbe}
          testId="probe-scrubber"
        />
      ) : null}
    </>
  );

  const instrument = (
    <div
      className="xp-main"
      ref={instrumentRef}
      data-testid="panel-instrument"
      data-choices={choicesBeside ? "beside" : undefined}
      data-coupled={coupleSlider ? "slider" : undefined}
    >
      <div className="xp-stack" data-testid="card-stack">
        {stack.map((d) => (
          <CardSlot key={`${d.metaSlot ?? "record"}-${d.card.kind}`} d={d} live={live} scrubX={scrubX} shares={sharesDomain(d.card, domain)} />
        ))}
        {coupleSlider || choicesBeside ? null : control}
      </div>
      {ruler}
      {coupleSlider || choicesBeside ? control : null}
      {line && domain && scrubX !== null
        ? line.segments.map((seg, i) => (
            <div
              key={i}
              className="xp-scrub-line"
              aria-hidden
              data-testid="scrub-line"
              style={{
                left: metrics.insetL + fractionOf(scrubX, domain) * Math.max(0, line.width - metrics.insetL - metrics.insetR),
                top: seg.top,
                height: Math.max(0, seg.bottom - seg.top),
              }}
            />
          ))
        : null}
    </div>
  );

  return (
    <>
      <div className="xp-vault-dim" aria-hidden />
      <section
        ref={rootRef}
        className={`xp-panel${props.className ? ` ${props.className}` : ""}`}
        style={props.style}
        data-panel=""
        data-testid="instrument-panel"
        data-layout={layout}
        data-control={kind}
        data-encounter={station.encounterId}
        data-opaque={opaque || undefined}
        aria-label={`${station.objectNoun} instrument panel`}
        aria-describedby={instructionId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            props.onBack();
          }
        }}
      >
        <PanelMetricsContext.Provider value={metrics}>
          <HexGrid />
          <TraceLine className="xp-rail" orient="v" start="ring" end="dots" />
          <p id={instructionId} className="xp-sr-only">
            {instruction}
          </p>
          <div className="xp-sr-only" aria-live="polite" data-testid="panel-sr">
            {srPolite}
          </div>
          <div className="xp-sr-only" aria-live="assertive" role="alert" data-testid="panel-announce">
            {assertive}
          </div>
          <div className="xp-body">
            {layout === "vault" ? (
              <BriefSheet brief={props.brief ?? { prompt: instruction, plaque: null, hints: [] }} warm />
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--xp-gap)", minHeight: 0, height: "100%" }}>
              <div className="xp-head">
                <BackTab onBack={props.onBack} done={sandbox} />
                <span className="xp-head-title">{station.objectNoun}</span>
              </div>
              {instrument}
              {sandbox ? null : props.result === "success" ? (
                <SuccessBadge text={station.successBadge} onDone={props.onBadgeDone} />
              ) : kind === "widget" ? null : (
                <VerifyButton label={verifyLabel} enabled={ctrl.complete} busy={Boolean(props.busy)} onVerify={verify} describedBy={instructionId} />
              )}
            </div>
          </div>
        </PanelMetricsContext.Provider>
      </section>
    </>
  );
}

function CardSlot({ d, live, scrubX, shares }: { d: ReturnType<typeof displayStack>[number]; live: PanelLive; scrubX: number | null; shares: boolean }) {
  const chips = chipsFor(d, live, scrubX);
  return (
    <div style={{ display: "contents" }} data-share={shares ? "true" : "false"} data-display-slot={d.displaySlot} data-meta-slot={d.metaSlot ?? "record"}>
      <CardView card={d.card} chips={chips} cursor={shares ? null : scrubX} />
    </div>
  );
}
