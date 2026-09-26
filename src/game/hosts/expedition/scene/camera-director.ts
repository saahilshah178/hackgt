/**
 * scene/camera-director.ts (H1) — the camera (docs/design/20 §2.2): explore follow with the zone's x and y deadzones
 * and lerp; on a layout change it tweens scroll and zoom to `frameFor(…)` over 280 ms ease-out cubic; boss arenas
 * clamp; cutscene `pan` / `camera` / `vista` shots hold until released; vertical zone transitions tween the view by
 * the zone-height offset over 900 ms. Everything is clamped to the zone.
 */
import type Phaser from "phaser";
import type { SafeRect } from "../../types";
import type { CameraView, Rect, Viewport, ZoneFrame } from "./framing";
import { baseZoom, centredView, clampView, followView, frameFor, lerpFactor, toScroll, viewSize } from "./framing";

export const LAYOUT_TWEEN_MS = 280;
export const VERTICAL_TWEEN_MS = 900;
type Ease = "linear" | "out_cubic" | "in_out_sine";
const EASE: Readonly<Record<Ease, (u: number) => number>> = {
  linear: (u) => u,
  out_cubic: (u) => 1 - Math.pow(1 - u, 3),
  in_out_sine: (u) => -(Math.cos(Math.PI * u) - 1) / 2,
};

type Mode = { kind: "follow" } | { kind: "frame"; target: Rect; safe: SafeRect; frameZoom: number | null } | { kind: "shot"; view: CameraView };

export class CameraDirector {
  view: CameraView = { viewX: 0, viewY: 0, zoom: 1 };
  private mode: Mode = { kind: "follow" };
  private tween: { from: CameraView; to: () => CameraView; t: number; ms: number; ease: (u: number) => number; resolve: () => void } | null = null;
  arena: { x0: number; x1: number } | null = null;
  private vp: Viewport;

  constructor(private readonly cam: Phaser.Cameras.Scene2D.Camera, private zone: ZoneFrame, vp: Viewport) {
    this.vp = vp;
  }

  get viewport(): Viewport {
    return this.vp;
  }
  setViewport(vp: Viewport): void {
    this.vp = { w: Math.max(1, vp.w), h: Math.max(1, vp.h) };
  }
  get base(): number {
    return baseZoom(this.vp);
  }
  get modeKind(): Mode["kind"] {
    return this.mode.kind;
  }

  /** New zone: snap to the player (or tween in from an offset for vertical transitions). */
  enterZone(zone: ZoneFrame, player: { x: number; y: number }, verticalFrom: "above" | "below" | null = null): Promise<void> {
    this.zone = zone;
    this.arena = null;
    this.mode = { kind: "follow" };
    const target = centredView(player, this.vp, zone, this.base);
    if (!verticalFrom) {
      this.cancelTween();
      this.view = target;
      this.apply();
      return Promise.resolve();
    }
    const { h } = viewSize(this.vp, target.zoom);
    this.view = { ...target, viewY: target.viewY + (verticalFrom === "above" ? -h : h) };
    this.apply();
    return this.tweenTo(() => followView(this.view, player, this.vp, this.zone), VERTICAL_TWEEN_MS, "in_out_sine");
  }

  follow(): void {
    if (this.mode.kind === "follow") return;
    this.mode = { kind: "follow" };
    const from = this.view;
    const z = this.base;
    this.cancelTween();
    this.tween = { from, to: () => ({ ...this.view, zoom: z }), t: 0, ms: LAYOUT_TWEEN_MS, ease: EASE.out_cubic, resolve: () => {} };
  }

  /** Frames a contraption (world rect) inside the safe rect (layout change, amendment 32). */
  frame(target: Rect, safe: SafeRect, frameZoom: number | null): Promise<void> {
    this.mode = { kind: "frame", target, safe, frameZoom };
    return this.tweenTo(() => frameFor(target, safe, this.vp, this.zone, frameZoom), LAYOUT_TWEEN_MS, "out_cubic");
  }

  /** A cutscene shot: centre (x, y) in world units at zoom × base (null keeps the current value). Holds until follow(). */
  shot(x: number | null, y: number | null, zoom: number | null, ms: number, ease: Ease = "out_cubic"): Promise<void> {
    const z = zoom === null ? this.view.zoom : zoom * this.base;
    const { w, h } = viewSize(this.vp, z);
    const cx = x ?? this.view.viewX + viewSize(this.vp, this.view.zoom).w / 2;
    const cy = y ?? this.view.viewY + viewSize(this.vp, this.view.zoom).h / 2;
    const target = clampView({ viewX: cx - w / 2, viewY: cy - h / 2, zoom: z }, this.vp, this.zone);
    this.mode = { kind: "shot", view: target };
    return this.tweenTo(() => target, ms, ease);
  }

  private tweenTo(to: () => CameraView, ms: number, ease: Ease): Promise<void> {
    this.cancelTween();
    if (ms <= 0) {
      this.view = to();
      this.apply();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.tween = { from: this.view, to, t: 0, ms, ease: EASE[ease], resolve };
    });
  }
  private cancelTween(): void {
    const t = this.tween;
    this.tween = null;
    t?.resolve();
  }

  update(dtMs: number, player: { x: number; y: number }): void {
    if (this.tween) {
      const tw = this.tween;
      tw.t += dtMs;
      const u = tw.ease(Math.min(1, tw.t / tw.ms));
      const to = this.mode.kind === "follow" ? followView({ ...this.view, zoom: tw.to().zoom }, player, this.vp, this.zone, this.arena) : tw.to();
      this.view = {
        viewX: tw.from.viewX + (to.viewX - tw.from.viewX) * u,
        viewY: tw.from.viewY + (to.viewY - tw.from.viewY) * u,
        zoom: tw.from.zoom + (to.zoom - tw.from.zoom) * u,
      };
      if (tw.t >= tw.ms) {
        this.tween = null;
        tw.resolve();
      }
    } else if (this.mode.kind === "follow") {
      const target = followView({ ...this.view, zoom: this.base }, player, this.vp, this.zone, this.arena);
      const k = lerpFactor(this.zone.camera.lerp, dtMs);
      this.view = { viewX: this.view.viewX + (target.viewX - this.view.viewX) * k, viewY: this.view.viewY + (target.viewY - this.view.viewY) * k, zoom: this.base };
    } else if (this.mode.kind === "frame") {
      // re-frame on viewport changes (resize) without a tween
      this.view = frameFor(this.mode.target, this.mode.safe, this.vp, this.zone, this.mode.frameZoom);
    }
    this.apply();
  }

  /** Snap (warp, skip). */
  snapTo(player: { x: number; y: number }): void {
    this.cancelTween();
    this.mode = { kind: "follow" };
    this.view = centredView(player, this.vp, this.zone, this.base);
    this.apply();
  }

  private apply(): void {
    const s = toScroll(this.view, this.vp);
    this.cam.setZoom(this.view.zoom);
    this.cam.setScroll(s.scrollX, s.scrollY);
  }
}
