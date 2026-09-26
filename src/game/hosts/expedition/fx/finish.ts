/**
 * fx/finish.ts (H1) — the painterly finish stack pieces the host owns (docs/design/20 §5.6): the camera ColorMatrix
 * grade per segment (ambient.grade), a soft vignette in dusk and night segments, and a tiled grain over the play area
 * at 6–8 %. Camera filters are wrapped: a renderer without them simply skips the grade (console.warn once).
 */
import type Phaser from "phaser";
import type { Ambient } from "../../../../contracts/world";
import { FX_GRAIN } from "./textures";

type CamFilters = {
  filters?: {
    internal: {
      addColorMatrix(): { colorMatrix: { reset(): unknown; saturate(v: number, m?: boolean): unknown; brightness(v: number, m?: boolean): unknown; hue(v: number, m?: boolean): unknown } };
      addVignette?(x?: number, y?: number, radius?: number, strength?: number): { strength: number };
    };
  };
};

export class FinishStack {
  private grade: ReturnType<NonNullable<CamFilters["filters"]>["internal"]["addColorMatrix"]> | null = null;
  private vignette: { strength: number } | null = null;
  private grain: Phaser.GameObjects.TileSprite | null = null;
  private warned = false;

  constructor(private readonly scene: Phaser.Scene, private readonly P: typeof Phaser) {
    try {
      const cam = scene.cameras.main as unknown as CamFilters;
      this.grade = cam.filters?.internal.addColorMatrix() ?? null;
      this.vignette = cam.filters?.internal.addVignette?.(0.5, 0.5, 0.9, 0) ?? null;
    } catch (err) {
      this.warnOnce(err);
    }
    this.grain = scene.add.tileSprite(0, 0, 64, 64, FX_GRAIN).setOrigin(0.5).setScrollFactor(0).setDepth(91).setAlpha(0.07).setBlendMode(P.BlendModes.MULTIPLY);
  }

  private warnOnce(err: unknown) {
    if (this.warned) return;
    this.warned = true;
    console.warn("Expedition: camera filters unavailable; the finish grade is skipped.", err);
  }

  /** Blend of the segments' grades (weights sum to 1) and the vignette for dusk/night light. */
  apply(parts: readonly { weight: number; ambient: Ambient }[]): void {
    let sat = 0;
    let bri = 0;
    let hue = 0;
    let vig = 0;
    for (const { weight, ambient } of parts) {
      sat += weight * ambient.grade.saturation;
      bri += weight * ambient.grade.brightness;
      hue += weight * ambient.grade.hue;
      vig += weight * (ambient.light === "dusk" || ambient.light === "night" ? 0.2 : ambient.light === "interior" ? 0.12 : 0.06);
    }
    try {
      if (this.grade) {
        this.grade.colorMatrix.reset();
        if (sat) this.grade.colorMatrix.saturate(sat, true);
        if (bri) this.grade.colorMatrix.brightness(1 + bri, true);
        if (hue) this.grade.colorMatrix.hue(hue, true);
      }
      if (this.vignette) this.vignette.strength = vig;
    } catch (err) {
      this.warnOnce(err);
    }
  }

  /** Keeps the grain covering the canvas at any zoom. */
  update(viewW: number, viewH: number, zoom: number, tMs: number): void {
    if (!this.grain) return;
    const w = viewW / zoom + 8;
    const h = viewH / zoom + 8;
    this.grain.setPosition(viewW / 2, viewH / 2).setSize(w, h);
    this.grain.tilePositionX = (tMs / 40) % 128;
  }

  destroy(): void {
    this.grain?.destroy();
    this.grain = null;
  }
}
