/**
 * src/world/diagnose/index.ts (V1) — the single source of per-item failure detail (docs/design/20 §2.5.4, amendment 11).
 *
 * Runs AFTER runner.submit() returned, with the params and solution the runner already holds. No mode file changes:
 * each mode file mirrors its mode's grade() order, and diagnose.test.ts pins the mirrors to grade(). Metas'
 * failurePlans act only on what this returns. `correct` and `feedback` are grade()'s, verbatim.
 */
import type { Diagnosis, DiagnoseArgs, FailKey, ModeKey } from "../types";
import { applyFeedbackNouns } from "../feedback-nouns";
import { matchProbes } from "../probes";
import { binsDiagnoser } from "./bins";
import { chainDiagnoser } from "./chain";
import { eliminationDiagnoser } from "./elimination";
import { linearDiagnoser } from "./linear";
import { mimicDiagnoser } from "./mimic";
import { numberLineDiagnoser } from "./number-line";
import { oscillatorDiagnoser } from "./oscillator";
import { pairsDiagnoser } from "./pairs";
import { predictRevealDiagnoser } from "./predict-reveal";
import type { Mirror, MirrorArgs, ModeDiagnoser } from "./shared";
import { typeMatchDiagnoser } from "./type-match";

export type { Mirror, MirrorArgs, ModeDiagnoser } from "./shared";

/** The 10 showcase modes with a native diagnosis (every other mode diagnoses as "no detail"). */
export const DIAGNOSERS: Readonly<Record<string, ModeDiagnoser>> = Object.fromEntries(
  [
    numberLineDiagnoser,
    oscillatorDiagnoser,
    mimicDiagnoser,
    predictRevealDiagnoser,
    linearDiagnoser,
    binsDiagnoser,
    typeMatchDiagnoser,
    pairsDiagnoser,
    chainDiagnoser,
    eliminationDiagnoser,
  ].map((d) => [d.modeKey, d]),
);
export const DIAGNOSED_MODES: readonly ModeKey[] = Object.keys(DIAGNOSERS) as ModeKey[];

/** The fail keys a mode's diagnosis can produce (R5: legal `dialogue.fail.byKey` and `boss.taunts.byKey` keys). */
export function failKeysFor(modeKey: ModeKey | string): readonly FailKey[] {
  return DIAGNOSERS[modeKey]?.failKeys ?? [];
}

/** The raw mirror for a mode (tests, debug); null for modes without a diagnoser. */
export function mirrorFor(modeKey: string, a: MirrorArgs): Mirror | null {
  const d = DIAGNOSERS[modeKey];
  if (!d) return null;
  try {
    return d.mirror(a);
  } catch {
    return null;
  }
}

export function diagnose(args: DiagnoseArgs): Diagnosis {
  const { modeKey, params, view, solution, input, grade } = args;
  const displayFeedback = applyFeedbackNouns(grade.feedback, args.feedbackNouns);
  if (grade.correct) {
    return { correct: true, feedback: grade.feedback, displayFeedback, failKey: null, wrongKeys: [], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [] };
  }
  const m = mirrorFor(modeKey, { params, view, solution, input });
  // grade() is the authority: a mirror that thinks the input is correct (parity drift) contributes no detail.
  const detail = m && !m.correct ? m : null;
  return {
    correct: false,
    feedback: grade.feedback,
    displayFeedback,
    failKey: detail?.failKey ?? null,
    wrongKeys: detail?.wrongKeys ?? [],
    prefix: detail?.prefix ?? null,
    disclosed: detail?.disclosed ?? {},
    nearMiss: args.nearMiss,
    probeKeys: matchProbes(args.probes, { modeKey, view, solution, input }),
  };
}
