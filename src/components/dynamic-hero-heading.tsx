"use client";

import { useEffect, useState } from "react";

const STUDY_VERBS = ["discover", "explore", "experience", "interact", "experiment", "engage", "immerse"];
const TYPE_DELAY_MS = 90;
const DELETE_DELAY_MS = 55;
const WORD_PAUSE_MS = 1650;
const EMPTY_PAUSE_MS = 250;

export function DynamicHeroHeading() {
  const [verbIndex, setVerbIndex] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const verb = STUDY_VERBS[verbIndex];
    const isComplete = characterCount === verb.length;
    const isEmpty = characterCount === 0;
    const delay = isDeleting ? (isEmpty ? EMPTY_PAUSE_MS : DELETE_DELAY_MS) : isComplete ? WORD_PAUSE_MS : TYPE_DELAY_MS;

    const timeout = window.setTimeout(() => {
      if (isComplete && !isDeleting) {
        setIsDeleting(true);
      } else if (isEmpty && isDeleting) {
        setVerbIndex((index) => (index + 1) % STUDY_VERBS.length);
        setIsDeleting(false);
      } else {
        setCharacterCount((count) => count + (isDeleting ? -1 : 1));
      }
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [characterCount, isDeleting, verbIndex]);

  const visibleVerb = STUDY_VERBS[verbIndex].slice(0, characterCount);

  return (
    <h1 className="mt-5 text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
      <span className="block">Don&apos;t just study.</span>
      <span className="block min-h-[1.1em] text-primary">
        {visibleVerb}
        <span className="ml-1 inline-block animate-[cursor-blink_1s_steps(2,start)_infinite]" aria-hidden>
          |
        </span>
      </span>
    </h1>
  );
}
