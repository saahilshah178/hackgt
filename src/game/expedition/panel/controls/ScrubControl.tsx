"use client";

import { Scrubber, type ScrubberProps } from "../Scrubber";

/**
 * ScrubControl (§3.3): tuner.oscillator, tuner.formula, mapper.number_line. The Scrubber IS the mode's input:
 * the panel holds the value (it also drives the orange line across the cards) and emits `{value}` drafts with
 * `settled`; the continuous pose follows every step.
 */
export function ScrubControl(props: ScrubberProps) {
  return <Scrubber {...props} testId={props.testId ?? "scrubber"} />;
}
