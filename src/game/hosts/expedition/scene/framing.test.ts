import { describe, expect, it } from "vitest";
import {
  baseZoom, centredView, clampView, defaultSafeRect, followView, frameFor, fromScroll, innerSafe, lerpFactor, playerFrameRect, rectInSafe, toScroll, unionRect,
  viewSize, worldToScreen, type ZoneFrame,
} from "./framing";

const vp = { w: 1920, h: 1080 };
const zone: ZoneFrame = { width: 6000, height: 1080, camera: { minZoom: 0.6, maxZoom: 1.15, xDeadzone: 0.3, yDeadzone: 260, lerp: 0.12 } };
const tall: ZoneFrame = { ...zone, height: 2400 };
const bounds = { x: 2600, y: 300, w: 700, h: 560 };

describe("framing: frameFor keeps frameBounds in the safe rect", () => {
  for (const mode of ["explore", "scrub", "board", "vault", "sandbox"] as const) {
    it(`layout ${mode}`, () => {
      const safe = defaultSafeRect(mode, vp);
      const f = frameFor(bounds, safe, vp, zone, null);
      expect(rectInSafe(bounds, safe, f)).toBe(true);
      expect(f.zoom).toBeLessThanOrEqual(baseZoom(vp) + 1e-9);
    });
  }

  it("keeps a margin between the target and the safe rect's edges, so the player at the edge is not clipped (H3)", () => {
    const safe = defaultSafeRect("scrub", vp);
    const inner = innerSafe(safe);
    expect(inner.x).toBeGreaterThan(safe.x);
    expect(inner.w).toBeLessThan(safe.w);
    // e1-like: a wide dial with the player at the console on the far left
    const station = { x: 4180, y: 380, w: 1370, h: 1130 };
    const target = unionRect(station, playerFrameRect(4300, 1140));
    const f = frameFor(target, safe, vp, { ...zone, width: 9000, height: 1600, camera: { ...zone.camera, minZoom: 0.5 } }, null);
    expect(rectInSafe(target, inner, f)).toBe(true);
    const p = playerFrameRect(4300, 1140);
    expect((p.x - f.viewX) * f.zoom).toBeGreaterThanOrEqual(inner.x - 0.5);
  });
  it("the player box covers the companion on either shoulder", () => {
    const r = playerFrameRect(1000, 800);
    expect(r.x).toBeLessThanOrEqual(1000 - 120);
    expect(r.x + r.w).toBeGreaterThanOrEqual(1000 + 120);
    expect(r.y + r.h).toBe(800);
  });
  it("frameZoom overrides the fit", () => {
    const safe = defaultSafeRect("scrub", vp);
    const f = frameFor(bounds, safe, vp, zone, 0.7);
    expect(f.zoom).toBeCloseTo(0.7 * baseZoom(vp));
    expect(rectInSafe(bounds, safe, f)).toBe(true);
  });

  it("a big contraption zooms out to fit (clamped at minZoom)", () => {
    const big = { x: 2000, y: 100, w: 4000, h: 2400 };
    const safe = defaultSafeRect("board", vp);
    const f = frameFor(big, safe, vp, zone, null);
    expect(f.zoom).toBeCloseTo(zone.camera.minZoom * baseZoom(vp));
  });

  it("scales with the viewport height and stays inside the zone when it can", () => {
    const small = { w: 1280, h: 720 };
    const safe = defaultSafeRect("scrub", small);
    const f = frameFor(bounds, safe, small, zone, null);
    expect(rectInSafe(bounds, safe, f)).toBe(true);
    const nearEdge = frameFor({ x: 50, y: 400, w: 300, h: 300 }, defaultSafeRect("explore", vp), vp, zone, null);
    expect(nearEdge.viewX).toBeGreaterThanOrEqual(0);
    // near the left edge in scrub layout the target stays in the safe rect even if the view leaves the zone
    const s2 = defaultSafeRect("scrub", vp);
    const f2 = frameFor({ x: 5700, y: 400, w: 290, h: 300 }, s2, vp, zone, 1);
    expect(rectInSafe({ x: 5700, y: 400, w: 290, h: 300 }, s2, f2)).toBe(true);
  });

  it("converts to and from Phaser scroll", () => {
    const view = { viewX: 100, viewY: 50, zoom: 0.8 };
    const s = toScroll(view, vp);
    const back = fromScroll(s.scrollX, s.scrollY, 0.8, vp);
    expect(back.viewX).toBeCloseTo(100);
    expect(back.viewY).toBeCloseTo(50);
    expect(worldToScreen(110, 60, view)).toEqual({ sx: 8, sy: 8 });
    expect(viewSize(vp, 2)).toEqual({ w: 960, h: 540 });
  });
});

describe("framing: follow camera", () => {
  it("does not move inside the x deadzone and follows outside it", () => {
    const z = baseZoom(vp);
    const view = { viewX: 1000, viewY: 0, zoom: z };
    const mid = 1000 + 960;
    expect(followView(view, { x: mid + 100, y: 700 }, vp, zone).viewX).toBe(1000);
    const moved = followView(view, { x: mid + 600, y: 700 }, vp, zone);
    expect(moved.viewX).toBeCloseTo(1000 + 600 - 0.15 * 1920);
    const left = followView(view, { x: mid - 600, y: 700 }, vp, zone);
    expect(left.viewX).toBeCloseTo(1000 - 600 + 0.15 * 1920);
  });

  it("has a vertical deadzone in tall zones and clamps to the zone", () => {
    const z = baseZoom(vp);
    const view = { viewX: 0, viewY: 800, zoom: z };
    const focus = 800 + 1080 * 0.64;
    expect(followView(view, { x: 960, y: focus + 100 }, vp, tall).viewY).toBe(800);
    expect(followView(view, { x: 960, y: focus + 400 }, vp, tall).viewY).toBeCloseTo(800 + 400 - 130);
    expect(followView(view, { x: 960, y: focus - 400 }, vp, tall).viewY).toBeCloseTo(800 - 400 + 130);
    expect(followView(view, { x: 960, y: 5000 }, vp, tall).viewY).toBe(2400 - 1080);
    expect(centredView({ x: 10, y: 10 }, vp, tall)).toMatchObject({ viewX: 0, viewY: 0 });
  });

  it("clamps to an arena while a boss arena is active; centres views larger than the zone", () => {
    const z = baseZoom(vp);
    const v = clampView({ viewX: 0, viewY: 0, zoom: z }, vp, zone, { x0: 3000, x1: 5500 });
    expect(v.viewX).toBe(3000);
    const tight = clampView({ viewX: 0, viewY: 0, zoom: z }, vp, zone, { x0: 3000, x1: 3500 });
    expect(tight.viewX).toBeCloseTo(3000 + (500 - 1920) / 2);
    const tiny = clampView({ viewX: 500, viewY: 0, zoom: z }, vp, { width: 1000, height: 1080 });
    expect(tiny.viewX).toBeCloseTo((1000 - 1920) / 2);
  });

  it("helpers", () => {
    expect(lerpFactor(0.12, 1000 / 60)).toBeCloseTo(0.12);
    expect(lerpFactor(0.12, 0)).toBe(0);
    expect(unionRect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: -5, w: 10, h: 5 })).toEqual({ x: 0, y: -5, w: 15, h: 15 });
    expect(rectInSafe({ x: 0, y: 0, w: 5000, h: 10 }, { x: 0, y: 0, w: 100, h: 100 }, { viewX: 0, viewY: 0, zoom: 1 })).toBe(false);
  });
});
