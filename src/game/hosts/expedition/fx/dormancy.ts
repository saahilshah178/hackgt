/**
 * fx/dormancy.ts (H1) — dormant machines desaturate (−40 %; −60 % and 40 % alpha in archive_of_voices) and
 * re-saturate when they wake (docs/design/20 §5.7). Uses a ColorMatrix filter when the object supports filters,
 * else a cool grey tint; tweened over `ms`.
 */
import type Phaser from "phaser";

type Filterable = Phaser.GameObjects.GameObject & {
  enableFilters?: () => unknown;
  filters?: { internal: { addColorMatrix(): { colorMatrix: { saturate(v: number, multiply?: boolean): unknown; reset(): unknown } } } } | null;
  setTint?: (c: number) => unknown;
  clearTint?: () => unknown;
  setAlpha?: (a: number) => unknown;
};
type Cm = { colorMatrix: { saturate(v: number, multiply?: boolean): unknown; reset(): unknown } };

const matrices = new WeakMap<object, Cm | null>();

function matrixOf(target: Filterable): Cm | null {
  if (matrices.has(target)) return matrices.get(target) ?? null;
  let cm: Cm | null = null;
  try {
    target.enableFilters?.();
    cm = target.filters?.internal.addColorMatrix() ?? null;
  } catch {
    cm = null;
  }
  matrices.set(target, cm);
  return cm;
}

export function setDormancy(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject, dormant: boolean, ms = 600, strength = 0.4): void {
  const t = target as Filterable;
  const cm = matrixOf(t);
  const state = { v: dormant ? 0 : 1 };
  const apply = (v: number) => {
    // v = 1 → fully awake; 0 → dormant
    // H2 fix: the tween targets a plain object, so it outlives a target destroyed with its zone (a warp mid-tween);
    // a destroyed object has no scene, and its filter's matrix is gone
    if (!t.scene) return;
    if (cm) {
      const m = (cm as { colorMatrix: Cm["colorMatrix"] | null }).colorMatrix;
      if (!m) return;
      m.reset();
      m.saturate(-strength * (1 - v));
    } else if (t.setTint) {
      if (v >= 0.999) t.clearTint?.();
      else t.setTint(0xa8b2bd);
    }
  };
  if (ms <= 0) {
    apply(dormant ? 0 : 1);
    return;
  }
  const from = { v: dormant ? 1 : 0 };
  scene.tweens.add({ targets: from, v: state.v, duration: ms, onUpdate: () => apply(from.v), onComplete: () => apply(state.v) });
}
