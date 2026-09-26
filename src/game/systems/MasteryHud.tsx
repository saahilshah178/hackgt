"use client";

import { Progress } from "@/components/ui/progress";

export interface MasteryHudConcept {
  id: string;
  name: string;
  score: number;
}

export interface MasteryHudProps {
  concepts: MasteryHudConcept[];
}

/** Per-concept mastery bars, named from spec.concepts, fed by runner.mastery(). */
export function MasteryHud({ concepts }: MasteryHudProps) {
  return (
    <div className="flex flex-col gap-2" aria-label="Mastery" data-testid="mastery-hud">
      {concepts.map((c) => (
        <div key={c.id} className="flex items-center gap-2">
          <span className="w-40 truncate text-sm" style={{ fontSize: 14 }} title={c.name}>
            {c.name}
          </span>
          <Progress value={Math.round(c.score * 100)} className="h-2 flex-1" aria-label={`${c.name} mastery`} />
        </div>
      ))}
    </div>
  );
}
