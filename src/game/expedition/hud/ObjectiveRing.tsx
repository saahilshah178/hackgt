"use client";
/**
 * ObjectiveRing (bible §3.10, 20 §2.6): a 55 px double ring, white 60 %, top-left. The inner ring's arc fills
 * clockwise per solved station in the current zone, re-segments with a 400 ms sweep on zone change and pulses when a
 * station is restored. Tooltip and SR text: "Restore the orrery's starlight · 2 of 3 rhythms". Click or M opens the
 * map when the story has one (then it is a button; otherwise an image).
 */
import type { Story } from "../../../contracts/world";
import styles from "./hud.module.css";
import { objectiveSummary, ringSegments, type ZoneProgress } from "./objective";

export interface ObjectiveRingProps {
  story: Pick<Story, "objective" | "restoredNoun" | "objectiveLabel">;
  progress: ZoneProgress;
  zoneId: string | null;
  onOpenMap?: () => void;
}

const SIZE = 55;

export function ObjectiveRing({ story, progress, zoneId, onOpenMap }: ObjectiveRingProps) {
  const summary = objectiveSummary(story, progress);
  const segs = ringSegments(progress, SIZE, 19.5);
  // Remount per (zone, solved): the zone change plays the sweep, a new solve plays the pulse (CSS, no JS timers).
  const animKey = `${zoneId ?? "-"}:${progress.solved}/${progress.total}`;
  const anim = progress.solved > 0 ? styles.ringPulse : styles.ringSweep;
  const svg = (
    <svg key={animKey} className={`${styles.ringSvg} ${anim}`} width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false">
      <circle cx={SIZE / 2} cy={SIZE / 2} r={26} fill="rgba(11,31,39,0.35)" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />
      {segs.map((s) => (
        <path
          key={s.index}
          d={s.d}
          fill="none"
          stroke={s.filled ? "#FFFFFF" : "rgba(255,255,255,0.28)"}
          strokeWidth={s.filled ? 4 : 3}
          strokeLinecap="round"
          style={s.filled ? { filter: "drop-shadow(0 0 3px rgba(159,230,242,0.9))" } : undefined}
        />
      ))}
      <circle cx={SIZE / 2} cy={SIZE / 2} r={3} fill="#FFFFFF" fillOpacity={0.8} />
    </svg>
  );
  if (onOpenMap) {
    return (
      <button type="button" className={styles.ring} data-testid="objective-ring" aria-label={`${summary}. Open the map`} title={summary} aria-keyshortcuts="M" onClick={onOpenMap}>
        {svg}
      </button>
    );
  }
  return (
    <div className={styles.ring} data-testid="objective-ring" role="img" aria-label={summary} title={summary}>
      {svg}
    </div>
  );
}
