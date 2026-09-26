/**
 * src/game/expedition/puppets/anim.ts — pure puppet animation sampling (20 §5.5, `PuppetAnim` in §1.3). No Phaser.
 *
 * Semantics (one definition for the runtime, the contact sheet and the DOM host):
 * - A part's rest state is { rot 0°, x 0, y 0, scaleX 1, scaleY 1, alpha 1, frame 0 } (offsets from the rest pose).
 * - `keys` tracks set the prop absolutely: linear interpolation between [t ms, value] keys (held before the first and
 *   after the last); `frame` keys step (no interpolation).
 * - `wave` tracks add `amp · sin(2π(hz · t / 1000 + phase))` to the prop's base (its keys value, else the rest value);
 *   a `frame` wave cycles the part's frames at `hz` loops per second (amp ignored).
 * - Looping anims wrap t by `ms`; one-shot anims clamp at `ms`. Alpha is clamped to [0, 1].
 */
import type { PuppetAnim } from "../../../contracts/world";

export type PuppetProp = "rot" | "x" | "y" | "scaleX" | "scaleY" | "alpha" | "frame";
export interface PartState {
  rot: number; // degrees
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  frame: number;
}
export const REST_STATE: Readonly<PartState> = Object.freeze({ rot: 0, x: 0, y: 0, scaleX: 1, scaleY: 1, alpha: 1, frame: 0 });
type Track = PuppetAnim["tracks"][number];

/** Local time inside an animation. */
export function animTime(anim: Pick<PuppetAnim, "loop" | "ms">, tMs: number): number {
  const ms = Math.max(1, anim.ms);
  if (anim.loop) return ((tMs % ms) + ms) % ms;
  return Math.min(Math.max(0, tMs), ms);
}
export function animDone(anim: Pick<PuppetAnim, "loop" | "ms">, tMs: number): boolean {
  return !anim.loop && tMs >= anim.ms;
}

/** Keyframe value at t (linear; `step` holds the previous key). */
export function keyValue(keys: ReadonlyArray<readonly [number, number]>, t: number, step = false): number | null {
  if (keys.length === 0) return null;
  const sorted = [...keys].sort((a, b) => a[0] - b[0]);
  if (t <= sorted[0][0]) return sorted[0][1];
  for (let i = 1; i < sorted.length; i++) {
    const [t1, v1] = sorted[i];
    if (t <= t1) {
      const [t0, v0] = sorted[i - 1];
      if (step) return t < t1 ? v0 : v1;
      return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return sorted[sorted.length - 1][1];
}

/** Sample every part's state at `tMs`. Parts without tracks sit at REST_STATE. */
export function sampleAnim(anim: PuppetAnim, tMs: number, parts: ReadonlyArray<{ name: string; frames: number }>): Record<string, PartState> {
  const t = animTime(anim, tMs);
  const out: Record<string, PartState> = {};
  for (const p of parts) out[p.name] = { ...REST_STATE };
  const frames = new Map(parts.map((p) => [p.name, p.frames]));
  // keys first (absolute), then waves (additive on top)
  const ordered: Track[] = [...anim.tracks.filter((tr) => !tr.wave), ...anim.tracks.filter((tr) => tr.wave)];
  for (const tr of ordered) {
    const st = out[tr.part];
    if (!st) continue;
    const prop = tr.prop as PuppetProp;
    if (tr.wave) {
      if (prop === "frame") {
        const n = Math.max(1, frames.get(tr.part) ?? 1);
        st.frame = ((Math.floor(((t / 1000) * tr.wave.hz + tr.wave.phase) * n) % n) + n) % n;
      } else st[prop] += tr.wave.amp * Math.sin(2 * Math.PI * ((tr.wave.hz * t) / 1000 + tr.wave.phase));
    } else {
      const v = keyValue(tr.keys, t, prop === "frame");
      if (v !== null) st[prop] = prop === "frame" ? Math.max(0, Math.floor(v)) : v;
    }
  }
  for (const st of Object.values(out)) st.alpha = Math.max(0, Math.min(1, st.alpha));
  for (const p of parts) out[p.name].frame = Math.min(Math.max(0, out[p.name].frame), Math.max(0, p.frames - 1));
  return out;
}

/** The procedural anims an `svg` entry plays as a one-part puppet (part "body"): bob, glow pulse, 1.05 scale. */
export const ONE_PART = "body";
export function proceduralAnims(bobPx = 4): PuppetAnim[] {
  return [
    { id: "idle", loop: true, ms: 1250, tracks: [{ part: ONE_PART, prop: "y", wave: { amp: bobPx, hz: 0.8, phase: 0 }, keys: [] }] },
    {
      id: "talk",
      loop: true,
      ms: 500,
      tracks: [
        { part: ONE_PART, prop: "y", wave: { amp: bobPx * 0.5, hz: 2, phase: 0 }, keys: [] },
        { part: ONE_PART, prop: "scaleX", wave: null, keys: [[0, 1], [250, 1.05], [500, 1]] },
        { part: ONE_PART, prop: "scaleY", wave: null, keys: [[0, 1], [250, 1.05], [500, 1]] },
      ],
    },
    {
      id: "cue",
      loop: true,
      ms: 600,
      tracks: [
        { part: ONE_PART, prop: "scaleX", wave: null, keys: [[0, 1.05], [300, 1.12], [600, 1.05]] },
        { part: ONE_PART, prop: "scaleY", wave: null, keys: [[0, 1.05], [300, 1.12], [600, 1.05]] },
        { part: ONE_PART, prop: "alpha", wave: null, keys: [[0, 0.85], [300, 1], [600, 0.85]] },
      ],
    },
  ];
}
