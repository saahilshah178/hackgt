"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface HintPanelProps {
  /** Narrative "before" beats for this encounter, shown as speech from the sidekick. */
  before: { speakerId: string; text: string }[];
  hintsUsed: number;
  hintsAvailable: number;
  lastHint: string | null;
  onRequestHint: () => void;
  disabled?: boolean;
}

/** Hint familiar: a voiced sidekick panel that runs the 3-tier hint ladder (nudge, method, near-answer). */
export function HintPanel({ before, hintsUsed, hintsAvailable, lastHint, onRequestHint, disabled }: HintPanelProps) {
  return (
    <Card className="max-w-sm" aria-label="Hint familiar">
      <CardContent className="flex flex-col gap-2">
        {before.map((b, i) => (
          <p key={i} className="text-base italic" style={{ fontSize: 18 }}>
            &ldquo;{b.text}&rdquo;
          </p>
        ))}
        {lastHint && (
          <p className="text-base" style={{ fontSize: 18 }} data-testid="hint-text">
            Hint {hintsUsed}/{hintsAvailable}: {lastHint}
          </p>
        )}
        <Button
          variant="outline"
          disabled={disabled || hintsUsed >= hintsAvailable}
          onClick={onRequestHint}
          data-testid="hint-button"
        >
          {hintsUsed >= hintsAvailable ? "No more hints" : "Ask for a hint"}
        </Button>
      </CardContent>
    </Card>
  );
}
