/**
 * controls/waves.logic.ts — WaveControl (sorter.type_match → {answers}; docs/design/20 §3.3). Pure.
 *
 * The waves run on WavesPick's timer semantics (secondsPerWave per wave; a wave that times out has no answer and
 * grades wrong). Verify replaces WavesPick's auto-submit: `complete` only after the LAST wave is answered or times
 * out. After a failed Verify, `retry` replays the waves with the previous answers preselected (Enter confirms each,
 * so a retry is five keypresses).
 */
export interface Category {
  id: string;
  label: string;
}
export interface Wave {
  waveIndex: number;
  text: string;
}
export interface WavesState {
  /** position in the view's wave list (display order) */
  index: number;
  answers: readonly { waveIndex: number; categoryId: string }[];
  secondsLeft: number;
  /** every wave answered or timed out: Verify enables */
  done: boolean;
  /** waveIndex → categoryId from the previous attempt (retry) */
  preselect: Readonly<Record<number, string>>;
  /** the focused / hovered valve (category id) */
  focus: string | null;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function categoriesOf(view: unknown): Category[] {
  const v = isObj(view) ? view : {};
  return Array.isArray(v.categories) ? (v.categories as unknown[]).filter(isObj).map((c) => ({ id: String(c.id), label: String(c.label ?? c.id) })) : [];
}
export function wavesOf(view: unknown): Wave[] {
  const v = isObj(view) ? view : {};
  return Array.isArray(v.waves) ? (v.waves as unknown[]).filter(isObj).map((w) => ({ waveIndex: Number(w.waveIndex), text: String(w.text ?? "") })) : [];
}
export function secondsPerWaveOf(view: unknown): number {
  const v = isObj(view) ? view : {};
  return typeof v.secondsPerWave === "number" && v.secondsPerWave > 0 ? v.secondsPerWave : 8;
}

function focusFor(view: unknown, index: number, preselect: Readonly<Record<number, string>>): string | null {
  const w = wavesOf(view)[index];
  if (!w) return null;
  return preselect[w.waveIndex] ?? categoriesOf(view)[0]?.id ?? null;
}

export function start(view: unknown, preselect: Readonly<Record<number, string>> = {}): WavesState {
  return { index: 0, answers: [], secondsLeft: secondsPerWaveOf(view), done: wavesOf(view).length === 0, preselect, focus: focusFor(view, 0, preselect) };
}

/** Restores a cached draft: a draft that answers every wave restores as done; anything else replays from wave 1
 * with those answers preselected. */
export function fromDraftInput(d: unknown, view: unknown): WavesState {
  const cats = new Set(categoriesOf(view).map((c) => c.id));
  const rows = isObj(d) && Array.isArray(d.answers) ? (d.answers as unknown[]).filter(isObj) : [];
  const answers = rows
    .map((r) => ({ waveIndex: Number(r.waveIndex), categoryId: String(r.categoryId) }))
    .filter((a) => cats.has(a.categoryId));
  const waves = wavesOf(view);
  const answered = new Set(answers.map((a) => a.waveIndex));
  if (waves.length > 0 && waves.every((w) => answered.has(w.waveIndex))) {
    return { index: waves.length, answers, secondsLeft: 0, done: true, preselect: {}, focus: null };
  }
  return start(view, Object.fromEntries(answers.map((a) => [a.waveIndex, a.categoryId])));
}
export function toDraftInput(s: WavesState): { answers: readonly { waveIndex: number; categoryId: string }[] } {
  return { answers: s.answers.map((a) => ({ ...a })) };
}
export function complete(s: WavesState): boolean {
  return s.done;
}

function advance(s: WavesState, view: unknown, answer: { waveIndex: number; categoryId: string } | null): WavesState {
  const answers = answer ? [...s.answers.filter((a) => a.waveIndex !== answer.waveIndex), answer] : s.answers;
  const n = wavesOf(view).length;
  const index = s.index + 1;
  if (index >= n) return { ...s, answers, index: n, secondsLeft: 0, done: true, focus: null };
  return { ...s, answers, index, secondsLeft: secondsPerWaveOf(view), focus: focusFor(view, index, s.preselect) };
}

/** Commits a valve for the current wave and moves on (the last answer completes the run). */
export function answer(s: WavesState, view: unknown, categoryId: string): WavesState {
  if (s.done) return s;
  const w = wavesOf(view)[s.index];
  if (!w) return s;
  return advance(s, view, { waveIndex: w.waveIndex, categoryId });
}
/** Advances the wave clock; a wave whose time runs out passes unanswered (the eddy). */
export function tick(s: WavesState, view: unknown, dtSeconds: number): WavesState {
  if (s.done) return s;
  const left = s.secondsLeft - dtSeconds;
  return left > 1e-9 ? { ...s, secondsLeft: left } : advance(s, view, null);
}
/** After a failed Verify: replay every wave with the previous answers preselected. */
export function retry(s: WavesState, view: unknown): WavesState {
  return start(view, Object.fromEntries(s.answers.map((a) => [a.waveIndex, a.categoryId])));
}
export function focusValve(s: WavesState, categoryId: string | null): WavesState {
  return s.focus === categoryId ? s : { ...s, focus: categoryId };
}
/** The `Draft.wave` channel (null once the run is done). */
export function waveChannel(s: WavesState, view: unknown): { index: number; secondsLeft: number; secondsPerWave: number } | null {
  if (s.done) return null;
  return { index: s.index, secondsLeft: Math.max(0, s.secondsLeft), secondsPerWave: secondsPerWaveOf(view) };
}
