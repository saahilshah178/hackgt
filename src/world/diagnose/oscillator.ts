/** tuner.oscillator: |value − answer| > 3 % of the dial → over / under (the mode's own direction words). */
import { CORRECT, field, miss, num, str, type ModeDiagnoser } from "./shared";

/** The same constant tuner.oscillator uses (LIBRARY F1); the probes' nearValue reads it too. */
export const OSCILLATOR_TOLERANCE = 0.03;
/** The first words of the mode's DIRECTION phrases [high, low] per ask (pinned by the parity test). */
export const OSCILLATOR_DIRECTION: Readonly<Record<string, readonly [string, string]>> = {
  period: ["too long", "too short"],
  frequency: ["too fast", "too slow"],
  amplitude: ["too high", "too low"],
  phase: ["too far right", "too far left"],
  midline: ["too high", "too low"],
};

export function dialSpan(view: unknown): number {
  const dial = field(view, "dial");
  const min = num(dial, "min");
  const max = num(dial, "max");
  return min !== null && max !== null ? max - min : 0;
}

export const oscillatorDiagnoser: ModeDiagnoser = {
  modeKey: "tuner.oscillator",
  failKeys: ["over", "under"],
  mirror({ view, solution, input }) {
    const value = num(input, "value") ?? NaN;
    const answer = num(solution, "answer") ?? NaN;
    const tol = OSCILLATOR_TOLERANCE * dialSpan(view);
    if (Math.abs(value - answer) <= tol) return CORRECT;
    const ask = str(solution, "ask") ?? str(view, "ask") ?? "period";
    const [high, low] = OSCILLATOR_DIRECTION[ask] ?? ["too high", "too low"];
    return value > answer ? miss("over", high) : miss("under", low);
  },
};
