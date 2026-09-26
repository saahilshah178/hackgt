"use client";
/**
 * MeterBar (amendment 24, 20 §2.6): the story meter's label and value, animated 600 ms per change (CSS transition).
 * When the meter `drives` ambient particles the host scales motes by value / 100 (not here).
 */
import type { Meter } from "../../../contracts/world";
import styles from "./hud.module.css";
import { meterText } from "./objective";

export function MeterBar({ meter, value }: { meter: Pick<Meter, "label" | "unit">; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const text = meterText(meter, value);
  return (
    <div
      className={styles.meter}
      data-testid="meter"
      role="meter"
      aria-label={meter.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      aria-valuetext={text}
    >
      <span aria-hidden="true">{meter.label}</span>
      <span className={styles.meterTrack} aria-hidden="true">
        <span className={styles.meterFill} style={{ width: `${pct}%` }} />
      </span>
      <span className={styles.meterValue} aria-hidden="true">
        {meter.unit === "percent" ? `${Math.round(value)} %` : Math.round(value)}
      </span>
    </div>
  );
}
