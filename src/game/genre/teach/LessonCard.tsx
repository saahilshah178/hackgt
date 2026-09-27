"use client";

import { useEffect, useRef } from "react";
import type { GameSpec, Lesson } from "../../../contracts/gamespec";
import { lessonFrame, monogram, prettyFormula, sentenceCase, teacherFor } from "./lessons";

/*
 * The teaching step of a board challenge: before the first challenge on a concept, the game's helper character
 * teaches it (big idea, explanation, key points with page citations, formula, worked example, the classic mistake),
 * framed in the host's world: a trail sign in explorer, a neighbour's note in cozy, case notes in casefile, a letter
 * in story. LessonBody is shared with the Field Guide.
 */

/** The lesson's content. `quotes` shows each key point's source quote under it (the Field Guide has room for them). */
export function LessonBody({ lesson, quotes = false }: { lesson: Lesson; quotes?: boolean }) {
  const main = (
    <>
      <p className="tg-big">{lesson.bigIdea}</p>
      {lesson.explanation && <p className="tg-expl">{lesson.explanation}</p>}
      {lesson.keyPoints.length > 0 && (
        <section>
          <h4 className="tg-label">Remember</h4>
          <ul className="tg-points">
            {lesson.keyPoints.map((k, i) => (
              <li key={i}>
                {k.text}
                {k.page !== null && (
                  <span className="tg-cite" title={k.quote ?? undefined} aria-label={`source page ${k.page}`}>
                    p. {k.page}
                  </span>
                )}
                {quotes && k.quote && <q className="tg-quote">{k.quote}</q>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
  const side =
    lesson.formula || lesson.example || lesson.watchOut ? (
      <>
        {lesson.formula && (
          <div className="tg-formula" data-testid="lesson-formula">
            <span className="tg-label">{sentenceCase(lesson.formula.label)}</span>
            <span className="tg-math" aria-label={`${lesson.formula.label}: ${lesson.formula.expression}`}>
              {prettyFormula(lesson.formula.expression)}
            </span>
          </div>
        )}
        {lesson.example && (
          <section className="tg-example">
            <h4 className="tg-label">Worked example</h4>
            <p>{lesson.example}</p>
          </section>
        )}
        {lesson.watchOut && (
          <section className="tg-watch">
            <h4 className="tg-label">Common mistake → fix</h4>
            <p>
              <span className="tg-x" aria-hidden>
                ✗
              </span>
              <span>
                <span className="sr-only">Mistake: </span>
                <span className="tg-mistake">{lesson.watchOut.mistake}</span>
              </span>
            </p>
            <p>
              <span className="tg-ok" aria-hidden>
                ✓
              </span>
              <span>
                <span className="sr-only">Fix: </span>
                {lesson.watchOut.fix}
              </span>
            </p>
          </section>
        )}
      </>
    ) : null;
  return (
    <div className="tg-body" data-wide={side ? "true" : "false"}>
      <div className="tg-col">{main}</div>
      {side && <div className="tg-col">{side}</div>}
    </div>
  );
}

export interface LessonCardProps {
  spec: GameSpec;
  lesson: Lesson;
  conceptName: string;
  /** 0-based position among this challenge's lessons, and how many there are */
  step: number;
  total: number;
  onContinue(): void;
  onLeave(): void;
}

export function LessonCard({ spec, lesson, conceptName, step, total, onContinue, onLeave }: LessonCardProps) {
  const frame = lessonFrame(spec.genre, lesson.conceptId);
  const teacher = teacherFor(spec, lesson);
  const teacherName = teacher?.name ?? "Your guide";
  const last = step >= total - 1;
  const cardRef = useRef<HTMLElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);
  const titleId = `tg-lesson-${lesson.conceptId}`;

  // Focus the continue button without scrolling, so the top of the lesson stays in view and Enter moves on. Hosts
  // that move focus into a newly opened panel skip it when focus is already inside. On later steps, show the new top.
  useEffect(() => {
    goRef.current?.focus({ preventScroll: true });
    if (step > 0) cardRef.current?.scrollIntoView({ block: "start" });
  }, [step]);

  const signoff = frame.signoff(teacherName);
  return (
    <article ref={cardRef} className="tg-card" data-look={frame.look} data-testid="lesson-card" data-concept={lesson.conceptId} aria-labelledby={titleId}>
      <header className="tg-head">
        <span className="tg-avatar" aria-hidden>
          {monogram(teacherName)}
        </span>
        <div className="min-w-0">
          <p className="tg-kicker">
            {frame.kicker}
            {total > 1 ? ` · ${step + 1} of ${total}` : ""}
          </p>
          <h3 className="tg-title" id={titleId}>
            {conceptName}
          </h3>
          <p className="tg-byline">{frame.byline(teacherName, teacher?.role ?? null)}</p>
        </div>
      </header>
      <LessonBody lesson={lesson} />
      {signoff && <p className="tg-signoff">{signoff}</p>}
      <div className="tg-actions">
        <button ref={goRef} type="button" className="tg-go" data-testid="lesson-continue" onClick={onContinue}>
          {last ? "Got it, let me try" : "Got it, next idea"} <kbd aria-hidden>Enter</kbd>
        </button>
        <button type="button" className="tg-leave" data-testid="challenge-close" onClick={onLeave}>
          Leave for now
        </button>
        <p className="tg-later">You can reread this any time in the Field guide (G).</p>
      </div>
    </article>
  );
}
