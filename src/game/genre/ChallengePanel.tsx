"use client";
/* eslint-disable react-hooks/static-components --
   `Widget` is a lookup into WIDGET_REGISTRY (src/game/widgets/registry.ts), a stable map of module-level component
   references; widgetFor() never creates a new component type. */

import { useEffect, useMemo, useRef } from "react";
import type { GameSpec, Lesson } from "../../contracts/gamespec";
import type { Palette } from "../engine/palettes";
import type { Current } from "../runner/encounter-runner";
import { widgetFor } from "../widgets/registry";
import { LessonCard } from "./teach/LessonCard";
import { watchOutFor } from "./teach/lessons";
import { speakerName } from "./types";

export interface ChallengeResult {
  correct: boolean;
  feedback: string;
  yourAnswer?: string;
}

/** The teaching layer's hooks into a challenge (see ./teach): lessons before the widget, review after a mistake. */
export interface ChallengeTeach {
  /** every concept's lesson (lessonMap) */
  lessons: ReadonlyMap<string, Lesson>;
  /** the concepts this opening teaches first, in order (snapshot at open) */
  plan: readonly string[];
  /** of `plan`, the ones not learned yet: the first is on screen; empty = show the challenge */
  pending: readonly string[];
  /** the player finished reading a concept's lesson */
  onLearned(conceptId: string): void;
  /** open the Field Guide at a concept */
  onReview(conceptId: string): void;
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
  /** lessons and review links; absent = the challenge alone */
  teach?: ChallengeTeach;
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
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const teach = props.teach;
  const lessonId = teach?.pending[0] ?? null;
  const lesson = lessonId ? teach?.lessons.get(lessonId) : undefined;
  const inLesson = !!lesson && !result;
  const conceptName = (id: string) => spec.concepts.find((c) => c.id === id)?.name ?? id;
  // after the last lesson, hand focus to the widget (the continue button that had it is gone)
  const hadLesson = useRef(inLesson);
  useEffect(() => {
    if (hadLesson.current && !inLesson) {
      const root = sectionRef.current;
      const target =
        root?.querySelector<HTMLElement>('[data-testid="widget-root"] :is(button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"]))') ?? root;
      target?.focus({ preventScroll: true });
    }
    hadLesson.current = inLesson;
  }, [inLesson]);
  const watch = result && !result.correct && teach ? watchOutFor(current.encounter, teach.lessons) : null;
  const reviewIds = [...new Set(current.encounter.conceptIds)].filter((id) => spec.concepts.some((c) => c.id === id));

  const hintsAvailable = current.encounter.hints.length;
  const accent = palette.css.accent;

  return (
    <section
      ref={sectionRef}
      aria-label={heading ?? "Challenge"}
      data-testid="challenge-panel"
      tabIndex={-1}
      data-encounter={current.encounter.id}
      data-step={inLesson ? "lesson" : result ? "result" : "challenge"}
      className="flex flex-col gap-4 rounded-xl border-2 p-4"
      style={{ borderColor: accent, background: "color-mix(in oklab, #000 55%, transparent)", color: palette.css.text }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          if (result && !result.correct) props.onRetry();
          else if (!result) props.onClose();
        }
        // Enter reads on: hosts may park focus on the panel itself rather than the lesson's button
        if (e.key === "Enter" && inLesson && lessonId && e.target === e.currentTarget) {
          e.preventDefault();
          teach?.onLearned(lessonId);
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
        {!result && !inLesson && (
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

      {inLesson && lesson && lessonId && teach ? (
        <LessonCard
          key={lessonId}
          spec={spec}
          lesson={lesson}
          conceptName={conceptName(lessonId)}
          step={teach.plan.length - teach.pending.length}
          total={teach.plan.length}
          onContinue={() => teach.onLearned(lessonId)}
          onLeave={props.onClose}
        />
      ) : (
        <p className="text-xl font-medium" style={{ fontSize: 20 }} data-testid="encounter-prompt">
          {current.encounter.prompt}
        </p>
      )}

      {inLesson ? null : result ? (
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
            // only on the result box itself: Enter on one of its buttons already clicks that button
            if (e.key === "Enter" && e.target === e.currentTarget) (result.correct ? props.onContinue : props.onRetry)();
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
          {watch && (
            <div className="tg-inline-watch" data-testid="challenge-watchout">
              <p>
                <strong>Watch out:</strong> {watch.mistake}
              </p>
              <p>
                <strong>Instead:</strong> {watch.fix}
              </p>
            </div>
          )}
          {!result.correct && teach && reviewIds.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {reviewIds.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  className="tg-review"
                  data-testid={i === 0 ? "review-link" : undefined}
                  data-concept={id}
                  aria-haspopup="dialog"
                  onClick={() => teach.onReview(id)}
                >
                  Review: {conceptName(id)}
                </button>
              ))}
            </div>
          )}
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
