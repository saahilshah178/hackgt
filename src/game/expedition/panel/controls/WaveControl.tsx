"use client";

import { useEffect, useRef } from "react";
import { useRoving } from "../roving";
import type { ControlProps } from "../types";
import * as L from "./waves.logic";
import { useLogicState } from "./use-logic";

const TICK_MS = 100;

/**
 * WaveControl (§3.3; cell e5/e9): one wave at a time on WavesPick's timer; hovering a valve renders its claim in the
 * world (draft.hover), committing (click / Enter) sends the cell to a basin; a wave that times out passes
 * unanswered. Verify enables only after the last wave. After a failed Verify (`attempt` grows) the waves replay with
 * the previous answers preselected, so Enter × N retries.
 */
export function WaveControl(p: ControlProps) {
  const cats = L.categoriesOf(p.view);
  const waves = L.wavesOf(p.view);
  // the hovered valve is a draft channel only (the world renders its claim); nothing in the panel draws it
  const hoverRef = useRef<string | null>(null);
  const emit = (next: L.WavesState) =>
    p.onChange({
      input: L.toDraftInput(next),
      complete: L.complete(next),
      focus: next.focus,
      hover: hoverRef.current,
      settled: true,
      wave: L.waveChannel(next, p.view),
      marks: null,
    });
  const [s, apply] = useLogicState(() => L.fromDraftInput(p.initialInput, p.view), emit);
  const roving = useRoving(cats.length, {
    onQuick: (i) => apply((st) => L.answer(st, p.view, cats[i].id)),
    onMove: (i) => apply((st) => L.focusValve(st, cats[i]?.id ?? null)),
  });

  // the wave clock (paused while disabled, e.g. during a Verify)
  useEffect(() => {
    if (p.disabled || s.done) return;
    const t = setInterval(() => apply((st) => L.tick(st, p.view, TICK_MS / 1000)), TICK_MS);
    return () => clearInterval(t);
  }, [p.disabled, s.done, p.view, apply]);

  // retry after a failed Verify: replay with the previous answers preselected
  const seenAttempt = useRef(p.attempt);
  useEffect(() => {
    if (p.attempt > seenAttempt.current) {
      seenAttempt.current = p.attempt;
      apply((st) => L.retry(st, p.view));
    }
  }, [p.attempt, p.view, apply]);

  // keep keyboard focus on the preselected valve as each wave starts
  const { focusAt } = roving;
  useEffect(() => {
    if (s.done || p.disabled) return;
    const i = cats.findIndex((c) => c.id === s.focus);
    if (i >= 0 && typeof document !== "undefined" && document.activeElement?.closest("[data-wave-valves]")) focusAt(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.index]);

  const wave = waves[s.index];
  const secondsPerWave = L.secondsPerWaveOf(p.view);
  return (
    <div className="xp-slot" data-grow={2} data-card="waves" data-testid="wave-board" style={{ flexGrow: 2 }}>
      <div className="xp-card">
        <div className="xp-card-html" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {wave && !s.done ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <span className="xp-caps">
                  Wave {s.index + 1} of {waves.length}
                </span>
                <output className="xp-timer" aria-live="off" data-testid="wave-timer">
                  {Math.ceil(Math.max(0, s.secondsLeft))} s
                </output>
              </div>
              <div aria-hidden style={{ height: 6, background: "var(--ui-card-deep)", border: "1px solid var(--ui-grid-major)" }}>
                <div style={{ height: "100%", width: `${(Math.max(0, s.secondsLeft) / secondsPerWave) * 100}%`, background: "#ffffff", transition: `width ${TICK_MS}ms linear` }} />
              </div>
              <p style={{ margin: 0, fontSize: "var(--xp-fs-body)", fontWeight: 600 }} aria-live="polite" data-testid="wave-text">
                {wave.text}
              </p>
              <div
                role="radiogroup"
                aria-label="Valves"
                aria-describedby={p.describedBy}
                className="xp-grid-2"
                data-wave-valves
                onKeyDown={roving.onKeyDown}
                onPointerLeave={() => {
                  hoverRef.current = null;
                  apply((st) => ({ ...st }));
                }}
              >
                {cats.map((c, i) => {
                  const rp = roving.itemProps(i);
                  const pre = s.preselect[wave.waveIndex] === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={s.focus === c.id}
                      className="xp-token"
                      data-state={s.focus === c.id ? "focus" : undefined}
                      data-testid={i === 0 ? "widget-first-option" : undefined}
                      disabled={p.disabled}
                      ref={rp.ref}
                      tabIndex={s.focus === c.id ? 0 : -1}
                      onFocus={rp.onFocus}
                      onPointerEnter={() => {
                        hoverRef.current = c.id;
                        apply((st) => ({ ...st }));
                      }}
                      onClick={() => apply((st) => L.answer(st, p.view, c.id))}
                      style={{ justifyContent: "center", minHeight: 56 }}
                    >
                      <span aria-hidden className="xp-count">
                        {i + 1}
                      </span>
                      {c.label}
                      {pre ? <span className="xp-sr-only">(your previous answer)</span> : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div data-testid="waves-done">
              <p style={{ margin: "0 0 8px", fontWeight: 600 }}>All {waves.length} waves have passed.</p>
              <p className="xp-hint" style={{ margin: 0 }}>
                {s.answers.length} answered{waves.length - s.answers.length > 0 ? `, ${waves.length - s.answers.length} missed` : ""}. Verify to run the lock.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
