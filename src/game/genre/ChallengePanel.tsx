"use client";
/* eslint-disable react-hooks/static-components --
   `Widget` is a lookup into WIDGET_REGISTRY (src/game/widgets/registry.ts), a stable map of module-level component
   references; widgetFor() never creates a new component type. */

import { useEffect, useMemo, useRef } from "react";
import type { GameSpec } from "../../contracts/gamespec";
import type { Palette } from "../engine/palettes";
import type { Current } from "../runner/encounter-runner";
import { widgetFor } from "../widgets/registry";
import { speakerName } from "./types";

export interface ChallengeResult {
  correct: boolean;
  feedback: string;
  yourAnswer?: string;
}

export interface ChallengePanelProps {
  spec: GameSpec;
  palette: Palette;
  current: Current;
  /** the host's name for this challenge ("Sealed tile", "Mrs. Park's request", "Lead: the bus ledger") */
  heading?: string;
  hintsUsed: number;
  lastHint: string | null;
  result: ChallengeResult | null;
  onHint(): void;
  onSubmit(input: unknown): void;
  /** after a correct result */
  onContinue(): void;
  /** after a wrong result: back to the widget, which keeps its state */
  onRetry(): void;
  /** leave without answering */
  onClose(): void;
}

/**
 * The challenge UI every board host embeds: who is asking (the encounter's "before" lines), the prompt, the mode's
 * widget, the three-rung hint ladder, and the graded result inline (no modal, so the host's world stays visible and
 * can react). Enter continues after a correct answer; Escape leaves or retries.
 */
export function ChallengePanel(props: ChallengePanelProps) {
  const { spec, palette, current, heading, hintsUsed, lastHint, result } = props;
  const Widget = useMemo(() => widgetFor(current.mode.widget, current.view), [current.mode.widget, current.view]);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const hintsAvailable = current.encounter.hints.length;
  const accent = palette.css.accent;

  return (
    <section
      aria-label={heading ?? "Challenge"}
      data-testid="challenge-panel"
      tabIndex={-1}
      data-encounter={current.encounter.id}
      className="flex flex-col gap-4 rounded-xl border-2 p-4"
      style={{ borderColor: accent, background: "color-mix(in oklab, #000 55%, transparent)", color: palette.css.text }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          if (result && !result.correct) props.onRetry();
          else if (!result) props.onClose();
        }
      }}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          {heading && (
            <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: accent }}>
              {heading}
            </p>
          )}
          {current.before.map((b, i) => (
            <p key={i} className="text-lg italic" style={{ fontSize: 18 }}>
              <strong className="not-italic">{speakerName(spec, b.speakerId)}:</strong> &ldquo;{b.text}&rdquo;
            </p>
          ))}
        </div>
        {!result && (
          <button
            type="button"
            onClick={props.onClose}
            data-testid="challenge-close"
            className="shrink-0 rounded-md border px-3 py-1 text-base hover:opacity-80 focus-visible:outline-2"
            style={{ borderColor: "currentColor" }}
          >
            Leave for now
          </button>
        )}
      </header>

      <p className="text-xl font-medium" style={{ fontSize: 20 }} data-testid="encounter-prompt">
        {current.encounter.prompt}
      </p>

      {result ? (
        <div
          ref={resultRef}
          tabIndex={-1}
          role="status"
          aria-live="assertive"
          data-testid="challenge-result"
          data-correct={result.correct ? "true" : "false"}
          className="flex flex-col gap-3 rounded-lg p-4 outline-none"
          style={{ background: result.correct ? "color-mix(in oklab, #2e7d32 45%, transparent)" : "color-mix(in oklab, #b3261e 40%, transparent)" }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (result.correct ? props.onContinue : props.onRetry)();
          }}
        >
          <p className="text-2xl font-bold" style={{ fontSize: 24 }}>
            {result.correct ? "That's it." : "Not quite."}
          </p>
          {result.yourAnswer && (
            <p className="text-lg" style={{ fontSize: 18 }}>
              Your answer: <strong>{result.yourAnswer}</strong>
            </p>
          )}
          <p className="text-lg" style={{ fontSize: 18 }}>
            {result.feedback}
          </p>
          {result.correct &&
            current.after.map((a, i) => (
              <p key={i} className="text-lg italic" style={{ fontSize: 18 }}>
                <strong className="not-italic">{speakerName(spec, a.speakerId)}:</strong> &ldquo;{a.text}&rdquo;
              </p>
            ))}
          <button
            type="button"
            autoFocus
            onClick={result.correct ? props.onContinue : props.onRetry}
            data-testid={result.correct ? "challenge-continue" : "challenge-retry"}
            className="self-start rounded-md px-5 py-2 text-lg font-semibold text-black hover:opacity-90 focus-visible:outline-2"
            style={{ background: accent }}
          >
            {result.correct ? "Continue" : "Try again"}
          </button>
        </div>
      ) : (
        // hints sit UNDER the widget: board hosts put this panel in side columns, where a second column squeezes it
        <div className="flex flex-col gap-4">
          <div className="min-w-0" data-testid="widget-root">
            <Widget view={current.view} onSubmit={props.onSubmit} />
          </div>
          <aside className="flex flex-wrap items-center gap-3" aria-label="Hints">
            {lastHint && (
              <p className="w-full text-base" style={{ fontSize: 18 }} data-testid="hint-text">
                Hint {hintsUsed}/{hintsAvailable}: {lastHint}
              </p>
            )}
            <button
              type="button"
              onClick={props.onHint}
              disabled={hintsUsed >= hintsAvailable}
              data-testid="hint-button"
              className="rounded-md border px-3 py-2 text-base hover:opacity-80 focus-visible:outline-2 disabled:opacity-50"
              style={{ borderColor: "currentColor" }}
            >
              {hintsUsed >= hintsAvailable ? "No more hints" : `Ask for a hint (${hintsAvailable - hintsUsed} left)`}
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}
