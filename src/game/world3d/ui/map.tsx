"use client";

import { useEffect, useMemo, useRef } from "react";
import { BIOMES } from "../../../world3d/core/biomes";
import { STRUCTURES } from "../../../world3d/core/catalog";
import type { ComposedWorld } from "../../../world3d/core/compose";
import type { MomentInfo } from "../model";
import { useStore, type Live, type Store } from "../store";

/*
 * The map: one hill-shaded image of the composed world (biome colours, water, paths, structure footprints), drawn once
 * per world into an offscreen canvas. The minimap (bottom right, north up, ~150 m around the player) and the full map
 * (M) draw it with the player, the goal and the open leads on top.
 */

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function renderMapImage(c: ComposedWorld, px = 512): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(px, px);
  const b = BIOMES[c.world.biome];
  const land = hexRgb(b.map.land);
  const high = hexRgb(b.map.high);
  const water = hexRgb(b.map.water);
  const path = hexRgb(b.ground.path.color);
  const half = c.hf.size / 2;
  const level = c.hf.waterLevel ?? -Infinity;
  const res = c.hf.res;
  for (let j = 0; j < px; j++) {
    for (let i = 0; i < px; i++) {
      const x = -half + ((i + 0.5) / px) * c.hf.size;
      const z = -half + ((j + 0.5) / px) * c.hf.size;
      const h = c.hf.height(x, z);
      let rgb: [number, number, number];
      if (h < level) {
        const depth = Math.min(1, (level - h) / 5);
        rgb = [water[0] * (1 - depth * 0.35), water[1] * (1 - depth * 0.3), water[2] * (1 - depth * 0.2)];
      } else {
        const t = Math.min(1, Math.max(0, (h - level - b.highLine * 0.5) / (b.highLine * 1.5 + 1)));
        rgb = [land[0] + (high[0] - land[0]) * t, land[1] + (high[1] - land[1]) * t, land[2] + (high[2] - land[2]) * t];
        // hill shading from the north-west
        const n = c.hf.normal(x, z);
        const shade = 0.72 + 0.45 * Math.max(0, -n.x * 0.55 - n.z * 0.55 + n.y * 0.6);
        rgb = [rgb[0] * shade, rgb[1] * shade, rgb[2] * shade];
        const ix = Math.min(res - 1, Math.round((x + half) / c.hf.cell));
        const iz = Math.min(res - 1, Math.round((z + half) / c.hf.cell));
        const pm = c.pathMask[iz * res + ix] / 255;
        if (pm > 0) rgb = [rgb[0] + (path[0] * 1.15 - rgb[0]) * pm, rgb[1] + (path[1] * 1.15 - rgb[1]) * pm, rgb[2] + (path[2] * 1.15 - rgb[2]) * pm];
      }
      const o = (j * px + i) * 4;
      img.data[o] = Math.min(255, rgb[0]);
      img.data[o + 1] = Math.min(255, rgb[1]);
      img.data[o + 2] = Math.min(255, rgb[2]);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // structure footprints
  const k = px / c.hf.size;
  ctx.fillStyle = "rgba(40, 28, 16, 0.55)";
  ctx.strokeStyle = "rgba(255, 245, 225, 0.55)";
  ctx.lineWidth = 1;
  for (const p of [...c.landmarks, ...c.pieces]) {
    if (STRUCTURES[p.kind].placement === "water") continue;
    const x = (p.x + half) * k;
    const z = (p.z + half) * k;
    const r = Math.max(1.5, p.radius * k * 0.8);
    ctx.save();
    ctx.translate(x, z);
    ctx.rotate(-p.rotation);
    if (p.kind === "pyramid" || p.kind === "step_pyramid") {
      ctx.fillRect(-r, -r, 2 * r, 2 * r);
      ctx.beginPath();
      ctx.moveTo(-r, -r);
      ctx.lineTo(r, r);
      ctx.moveTo(r, -r);
      ctx.lineTo(-r, r);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  return canvas;
}

export function useMapImage(c: ComposedWorld, px: number): HTMLCanvasElement | null {
  return useMemo(() => (typeof document === "undefined" ? null : renderMapImage(c, px)), [c, px]);
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number, shape: "diamond" | "triangle" | "dot") {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (shape === "diamond") {
    ctx.moveTo(0, -size);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size, 0);
  } else if (shape === "triangle") {
    ctx.moveTo(0, -size * 1.2);
    ctx.lineTo(size, size * 0.8);
    ctx.lineTo(-size, size * 0.8);
  } else ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, yaw: number) {
  ctx.save();
  ctx.translate(x, y);
  // yaw 0 faces +z (south = down on a north-up map); canvas rotation is clockwise
  ctx.rotate(Math.PI - yaw);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(7, 7);
  ctx.lineTo(0, 3);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

export function Minimap({ live, composed, leads, accent, goalReady }: { live: Store<Live>; composed: ComposedWorld; leads: readonly MomentInfo[]; accent: string; goalReady: boolean }) {
  const image = useMapImage(composed, 512);
  const canvas = useRef<HTMLCanvasElement>(null);
  const player = useStore(live, (s) => s.player);
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !image) return;
    const ctx = cv.getContext("2d")!;
    const size = cv.width;
    const span = 300; // metres across
    const half = composed.hf.size / 2;
    const scale = size / span;
    const toMap = (x: number, z: number) => [size / 2 + (x - player.x) * scale, size / 2 + (z - player.z) * scale] as const;
    // beyond the map's edge: the biome's land, dimmed, with the boundary drawn
    ctx.fillStyle = BIOMES[composed.world.biome].map.land;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, size, size);
    // draw the whole map image positioned under the player (a source rect outside the image is clipped by some browsers)
    const [ox, oy] = toMap(-half, -half);
    ctx.drawImage(image, ox, oy, composed.hf.size * scale, composed.hf.size * scale);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ox, oy, composed.hf.size * scale, composed.hf.size * scale);
    const g = composed.goal;
    if (g) {
      const [x, y] = toMap(g.x, g.z);
      const cx = Math.min(size - 10, Math.max(10, x));
      const cy = Math.min(size - 10, Math.max(10, y));
      drawMarker(ctx, cx, cy, goalReady ? "#ffe29a" : "#ffd27a", 8, "triangle");
    }
    for (const m of leads) {
      const [x, y] = toMap(m.x, m.z);
      drawMarker(ctx, Math.min(size - 8, Math.max(8, x)), Math.min(size - 8, Math.max(8, y)), accent, 6, "diamond");
    }
    drawPlayer(ctx, size / 2, size / 2, player.yaw);
  }, [image, player, composed, leads, accent, goalReady]);
  return (
    <div className="w3-minimap" aria-label="Minimap" data-testid="w3-minimap">
      <canvas ref={canvas} width={240} height={240} />
      <span className="w3-minimap-n" aria-hidden>
        N
      </span>
    </div>
  );
}

export function MapOverlay({ live, composed, leads, accent, goalReady, onClose }: { live: Store<Live>; composed: ComposedWorld; leads: readonly MomentInfo[]; accent: string; goalReady: boolean; onClose(): void }) {
  const image = useMapImage(composed, 1024);
  const canvas = useRef<HTMLCanvasElement>(null);
  const player = useStore(live, (s) => s.player);
  const half = composed.hf.size / 2;
  const pct = (x: number, z: number) => ({ left: `${((x + half) / composed.hf.size) * 100}%`, top: `${((z + half) / composed.hf.size) * 100}%` });
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !image) return;
    const ctx = cv.getContext("2d")!;
    ctx.drawImage(image, 0, 0, cv.width, cv.height);
    const k = cv.width / composed.hf.size;
    const g = composed.goal;
    if (g) drawMarker(ctx, (g.x + half) * k, (g.z + half) * k, goalReady ? "#ffe29a" : "#ffd27a", 12, "triangle");
    for (const m of leads) drawMarker(ctx, (m.x + half) * k, (m.z + half) * k, accent, 9, "diamond");
    drawPlayer(ctx, (player.x + half) * k, (player.z + half) * k, player.yaw);
  }, [image, player, composed, leads, accent, goalReady, half]);
  const named = composed.landmarks.filter((l) => l.role !== "decor" && l.name);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "m" || e.key === "M") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="w3-overlay" role="dialog" aria-modal="true" aria-label="Map" data-testid="w3-map" onClick={onClose}>
      <div className="w3-map" onClick={(e) => e.stopPropagation()}>
        <canvas ref={canvas} width={1024} height={1024} />
        {named.map((l) => (
          <span key={l.id} className={`w3-map-label${l.role === "goal" ? " is-goal" : leads.some((m) => m.anchor.id === l.id) ? " is-lead" : ""}`} style={{ ...pct(l.x, l.z), marginTop: -Math.min(26, l.radius * 0.1 + 12) }}>
            {l.name}
          </span>
        ))}
        {composed.world.npcs.map((n) => {
          const at = composed.npcs.find((a) => a.id === n.id);
          if (!at) return null;
          return (
            <span key={n.id} className={`w3-map-label${leads.some((m) => m.anchor.id === n.id) ? " is-lead" : ""}`} style={{ ...pct(at.x, at.z), fontSize: 12, marginTop: 14 }}>
              {n.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
