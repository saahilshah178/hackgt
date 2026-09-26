/**
 * fx/textures.ts (H1) — the few procedural textures the host needs regardless of the art lane: a white radial glow
 * (tinted per use, ADD blend), a soft dot for particles, a tiled grain, a soft contact shadow and a vignette ring.
 * Created once per game, kept resident ("all").
 */
import type Phaser from "phaser";

export const FX_GLOW = "__fx_glow";
export const FX_DOT = "__fx_dot";
export const FX_GRAIN = "__fx_grain";
export const FX_SHADOW = "__fx_shadow";
export const FX_WHITE = "__fx_white";

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex?.getContext();
  if (!tex || !ctx) return;
  paint(ctx);
  tex.refresh();
}

export function ensureFxTextures(scene: Phaser.Scene): void {
  canvasTex(scene, FX_GLOW, 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  canvasTex(scene, FX_DOT, 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });
  canvasTex(scene, FX_GRAIN, 128, 128, (ctx) => {
    const img = ctx.createImageData(128, 128);
    let s = 1234567;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = 96 + (s % 96);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
  canvasTex(scene, FX_SHADOW, 128, 32, (ctx) => {
    const g = ctx.createRadialGradient(64, 16, 0, 64, 16, 64);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.save();
    ctx.scale(1, 0.25);
    ctx.fillRect(0, 0, 128, 128);
    ctx.restore();
  });
  canvasTex(scene, FX_WHITE, 4, 4, (ctx) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 4, 4);
  });
}
