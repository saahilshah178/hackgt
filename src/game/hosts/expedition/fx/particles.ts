/**
 * fx/particles.ts (H1) — one-shot bursts (sparks, dust, motes, confetti_soft) and the ambient particle field of a
 * segment (dust, motes, pollen, spores, bubbles, rain, embers, stars, scraps; ≤ 120, scaled by the purpose meter
 * when it drives ambient particles). Plain pooled Images + tweens: no emitter state to leak between zones.
 */
import type Phaser from "phaser";
import type { Ambient } from "../../../../contracts/world";
import { FX_DOT } from "./textures";

const BURST: Readonly<Record<string, { n: number; color: number; speed: number; life: number; size: number }>> = {
  sparks: { n: 14, color: 0xffe2a8, speed: 260, life: 520, size: 0.5 },
  dust: { n: 10, color: 0xe8dcd2, speed: 90, life: 600, size: 1.2 },
  motes: { n: 12, color: 0x9fe6f2, speed: 120, life: 900, size: 0.7 },
  confetti_soft: { n: 16, color: 0xf6d27a, speed: 180, life: 1000, size: 0.8 },
};

export function burst(scene: Phaser.Scene, P: typeof Phaser, parent: Phaser.GameObjects.Container | null, at: { x: number; y: number }, preset: string, seed = 1): void {
  const b = BURST[preset] ?? BURST.dust;
  let s = seed >>> 0 || 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < b.n; i++) {
    const img = scene.add.image(at.x, at.y, FX_DOT).setTint(b.color).setScale(b.size).setBlendMode(P.BlendModes.ADD);
    parent?.add(img);
    const a = rnd() * Math.PI * 2;
    const d = b.speed * (0.5 + rnd() * 0.5) * (b.life / 1000);
    scene.tweens.add({ targets: img, x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d - 20, alpha: 0, scale: b.size * 0.3, duration: b.life, ease: "Cubic.easeOut", onComplete: () => img.destroy() });
  }
}

const FIELD: Readonly<Record<Ambient["particles"], { color: number; vy: number; vx: number; scale: number; alpha: number } | null>> = {
  none: null,
  dust: { color: 0xfff4d6, vy: -6, vx: 8, scale: 0.35, alpha: 0.5 },
  motes: { color: 0x9fe6f2, vy: -10, vx: 4, scale: 0.4, alpha: 0.6 },
  pollen: { color: 0xf6d27a, vy: 6, vx: 12, scale: 0.35, alpha: 0.55 },
  spores: { color: 0xc9f3ff, vy: -4, vx: 3, scale: 0.45, alpha: 0.45 },
  bubbles: { color: 0xc9f3ff, vy: -40, vx: 2, scale: 0.5, alpha: 0.5 },
  rain: { color: 0xdfe8f2, vy: 900, vx: -60, scale: 0.25, alpha: 0.5 },
  embers: { color: 0xf4a95a, vy: -30, vx: 6, scale: 0.35, alpha: 0.7 },
  stars: { color: 0xfff4d6, vy: 0, vx: 0, scale: 0.3, alpha: 0.8 },
  scraps: { color: 0xf2e3c6, vy: 30, vx: 25, scale: 0.6, alpha: 0.6 },
};

/** An ambient particle field that wraps around the camera view (screen space, depth 90). */
export class ParticleField {
  private dots: { img: Phaser.GameObjects.Image; x: number; y: number; ph: number }[] = [];
  private kind: Ambient["particles"] = "none";
  private scale = 1;

  constructor(private readonly scene: Phaser.Scene, private readonly P: typeof Phaser) {}

  set(kind: Ambient["particles"], count: number, meterScale = 1): void {
    const n = Math.min(120, Math.round(count * Math.max(0, Math.min(1, meterScale))));
    if (kind === this.kind && n === this.dots.length && meterScale === this.scale) return;
    this.kind = kind;
    this.scale = meterScale;
    const spec = FIELD[kind];
    while (this.dots.length > (spec ? n : 0)) this.dots.pop()?.img.destroy();
    if (!spec) return;
    for (const d of this.dots) d.img.setTint(spec.color);
    let s = 99991;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    while (this.dots.length < n) {
      const img = this.scene.add.image(0, 0, FX_DOT).setScrollFactor(0).setDepth(90).setTint(spec.color).setBlendMode(this.P.BlendModes.ADD);
      this.dots.push({ img, x: rnd(), y: rnd(), ph: rnd() * Math.PI * 2 });
    }
  }

  update(dtMs: number, viewW: number, viewH: number, zoom: number, tMs: number): void {
    const spec = FIELD[this.kind];
    if (!spec) return;
    const dt = dtMs / 1000;
    for (const d of this.dots) {
      d.x = (d.x + (spec.vx * dt) / Math.max(1, viewW) + 1) % 1;
      d.y = (d.y + (spec.vy * dt) / Math.max(1, viewH) + 1) % 1;
      const wob = spec.vy > 400 ? 0 : Math.sin(tMs / 900 + d.ph) * 6;
      // screen-space objects are still zoomed about the camera centre: place them so they cover the whole canvas
      const cx = viewW / 2;
      const cy = viewH / 2;
      d.img.setPosition(cx + (d.x * viewW - cx) / zoom + wob, cy + (d.y * viewH - cy) / zoom);
      d.img.setScale(spec.vy > 400 ? spec.scale : spec.scale * (0.8 + 0.2 * Math.sin(tMs / 700 + d.ph)));
      d.img.setAlpha(spec.alpha * (spec.vy > 400 ? 1 : 0.7 + 0.3 * Math.sin(tMs / 500 + d.ph)));
      if (spec.vy > 400) d.img.setScale(spec.scale * 0.6, spec.scale * 3);
    }
  }

  destroy(): void {
    for (const d of this.dots) d.img.destroy();
    this.dots = [];
    this.kind = "none";
  }
}
