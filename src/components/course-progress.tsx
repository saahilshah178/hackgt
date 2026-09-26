"use client";

import { useMemo, useSyncExternalStore } from "react";
import { CheckCircle2, Circle, Swords, BookOpen, Dumbbell, RotateCcw } from "lucide-react";
import type { TelemetryEvent } from "@/contracts/telemetry";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => {};

function readStash(specId: string): string | null {
  try {
    return sessionStorage.getItem(`qf:telemetry:${specId}`);
  } catch {
    return null;
  }
}

/** Telemetry the game's end screen stashed for this spec id (empty on the server and before a first run). */
export function useCourseTelemetry(specId: string): TelemetryEvent[] {
  const raw = useSyncExternalStore(subscribeNoop, () => readStash(specId), () => null);
  return useMemo(() => {
    if (!raw) return [];
    try {
      return JSON.parse(raw) as TelemetryEvent[];
    } catch {
      return [];
    }
  }, [raw]);
}

function completedIds(events: readonly TelemetryEvent[]): Set<string> {
  return new Set(events.filter((e) => e.correct).map((e) => e.encounterId));
}

export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-secondary", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", pct >= 100 ? "bg-success" : "bg-brand")} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Compact progress for game cards: a status line plus a bar. */
export function CourseProgress({ specId, exerciseCount, title }: { specId: string; exerciseCount: number; title: string }) {
  const events = useCourseTelemetry(specId);
  const done = Math.min(completedIds(events).size, exerciseCount);
  const pct = exerciseCount ? (done / exerciseCount) * 100 : 0;
  const status = done === 0 ? "Not started" : done >= exerciseCount ? "Completed" : "In progress";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className={cn("inline-flex items-center gap-1.5 font-medium", done >= exerciseCount && exerciseCount > 0 ? "text-success" : "text-muted-foreground")}>
          {done >= exerciseCount && exerciseCount > 0 ? <CheckCircle2 className="size-4" aria-hidden /> : null}
          {status}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {done}/{exerciseCount}
        </span>
      </div>
      <ProgressBar value={pct} label={`${title} progress`} />
    </div>
  );
}

export interface ExerciseItem {
  id: string;
  prompt: string;
  role: "teach" | "practice" | "review" | "boss";
  concepts: string;
}

const ROLE: Record<ExerciseItem["role"], { label: string; icon: typeof BookOpen; tone: string }> = {
  teach: { label: "Lesson", icon: BookOpen, tone: "bg-brand-soft text-accent-foreground" },
  practice: { label: "Practice", icon: Dumbbell, tone: "bg-success-soft text-success" },
  review: { label: "Review", icon: RotateCcw, tone: "bg-warning-soft text-warning" },
  boss: { label: "Challenge", icon: Swords, tone: "bg-destructive/10 text-destructive" },
};

/** The ordered exercise list with per-exercise completion states and an overall bar. */
export function ExerciseChecklist({ specId, items }: { specId: string; items: ExerciseItem[] }) {
  const events = useCourseTelemetry(specId);
  const done = completedIds(events);
  const count = items.filter((i) => done.has(i.id)).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-2xl bg-secondary/60 p-4">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>
            {count === items.length ? "All exercises complete" : count === 0 ? "Ready when you are" : "Keep going, you're on your way"}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {count} of {items.length} done
          </span>
        </div>
        <ProgressBar value={items.length ? (count / items.length) * 100 : 0} label="Exercise completion" />
      </div>
      <ol className="flex flex-col gap-3">
        {items.map((item, i) => {
          const complete = done.has(item.id);
          const role = ROLE[item.role];
          const Icon = role.icon;
          return (
            <li
              key={item.id}
              className={cn(
                "flex items-start gap-4 rounded-2xl border bg-card p-4 transition-colors",
                complete ? "border-success/40" : "border-border hover:border-brand",
              )}
            >
              <span className="mt-0.5 shrink-0" aria-hidden>
                {complete ? <CheckCircle2 className="size-6 text-success" /> : <Circle className="size-6 text-border" strokeWidth={2.5} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">Exercise {i + 1}</span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", role.tone)}>
                    <Icon className="size-3.5" aria-hidden />
                    {role.label}
                  </span>
                  <span className="sr-only">{complete ? "Completed" : "Not completed"}</span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-base leading-relaxed">{item.prompt}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.concepts}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
