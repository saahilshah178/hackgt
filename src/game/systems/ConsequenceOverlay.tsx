"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface ConsequenceOverlayProps {
  correct: boolean;
  feedback: string;
  /** Player's answer vs. what was needed, in display terms (mode-specific, human readable). */
  yourAnswer?: string;
  onContinue: () => void;
  after?: { speakerId: string; text: string }[];
}

/**
 * The informative failure overlay (and the correct-answer confirmation): always shows the player's
 * answer against the truth, never just "wrong" (LIBRARY §8). Enter/Escape both continue/retry.
 */
export function ConsequenceOverlay({ correct, feedback, yourAnswer, onContinue, after }: ConsequenceOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="alertdialog"
      aria-live="assertive"
      data-testid="consequence-overlay"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") onContinue();
      }}
    >
      <div ref={ref} tabIndex={-1} className="max-w-lg outline-none">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <h2 className="text-2xl font-bold" style={{ fontSize: 26 }}>
              {correct ? "It locks into place." : "Not quite."}
            </h2>
            {yourAnswer && (
              <p className="text-base" style={{ fontSize: 18 }}>
                Your answer: <strong>{yourAnswer}</strong>
              </p>
            )}
            <p className="text-base" style={{ fontSize: 18 }}>
              {feedback}
            </p>
            {correct &&
              after?.map((a, i) => (
                <p key={i} className="text-base italic" style={{ fontSize: 18 }}>
                  &ldquo;{a.text}&rdquo;
                </p>
              ))}
            <Button size="lg" autoFocus onClick={onContinue} data-testid="consequence-continue">
              {correct ? "Continue" : "Try again"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
