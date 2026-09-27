/**
 * art/stub-paint.ts (H1) — paints the stub loader's kit-coloured shapes onto a 2D canvas context. Shared by the Phaser
 * stub loader (textures.createCanvas) and the reduced DOM host (data URLs), so both render paths show the same
 * stand-ins. Deterministic per key (seeded). Browser-only (CanvasRenderingContext2D), never imported by node tests.
 */
import { stubSkeleton } from "./stub-rig";
import type { StubSpec } from "./stub-spec";
import { pickColor } from "./stub-spec";
import { RIG_DISPLAY_H, RIG_DISPLAY_W } from "../actors/costume";

type Ctx = CanvasRenderingContext2D;
type Palette = Readonly<Record<string, string>>;

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
/** `shade()` with an alpha channel, for gradient stops that dissolve to transparent. */
function rgba(hex: string, alpha: number, f = 0): string {
  return shade(hex, f).replace("rgb(", "rgba(").replace(")", `,${alpha})`);
}
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** Paints `spec` into a w × h canvas region at (ox, oy) (pixel size = design size × k). */
export function paintStub(ctx: Ctx, spec: StubSpec, palette: Palette, k = 1, ox = 0, oy = 0): void {
  const w = spec.w * k;
  const h = spec.h * k;
  const c = pickColor(palette, spec.color);
  const a = pickColor(palette, spec.accent, "#F6D27A");
  const r = rng(spec.seed);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.clearRect(0, 0, w, h);
  switch (spec.style) {
    case "hills": {
      // a tileable ridge line: sum of sines with integer periods over the tile width, so the left and right edges match
      const f1 = 1 + Math.floor(r() * 2);
      const f2 = 3 + Math.floor(r() * 3);
      const p1 = r() * Math.PI * 2;
      const p2 = r() * Math.PI * 2;
      // the crest keeps its design height whatever the tile height; a tall tile just fills further down, to the ground
      const hr = Math.min(h, 470 * k);
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, shade(c, 0.18));
      grad.addColorStop(0.9, shade(c, -0.25));
      grad.addColorStop(1, rgba(c, 0, -0.25)); // a short dissolve, in case a tile still ends above the ground
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8 * k) {
        const u = (x / w) * Math.PI * 2;
        const y = hr * (0.32 + 0.18 * Math.sin(f1 * u + p1) + 0.07 * Math.sin(f2 * u + p2));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "haze": {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.55, "rgba(255,255,255,0.10)");
      grad.addColorStop(1, "rgba(255,255,255,0.22)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = a;
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(r() * w, 0);
        ctx.lineTo(r() * w + 90 * k, 0);
        ctx.lineTo(r() * w + 30 * k, h);
        ctx.lineTo(r() * w - 60 * k, h);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case "strip": {
      ctx.fillStyle = shade(c, -0.1);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = shade(c, 0.15);
      ctx.fillRect(0, 0, w, 16 * k);
      ctx.fillStyle = pickColor(palette, spec.accent);
      for (let i = 0; i < 18; i++) ctx.fillRect(r() * w, 20 * k + r() * (h - 30 * k), 18 * k, 6 * k);
      break;
    }
    case "pillar": {
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, shade(c, 0.2));
      grad.addColorStop(1, shade(c, -0.2));
      ctx.fillStyle = grad;
      ctx.fillRect(w * 0.18, h * 0.08, w * 0.64, h * 0.92);
      ctx.fillStyle = a;
      ctx.fillRect(w * 0.08, 0, w * 0.84, h * 0.1);
      ctx.fillRect(w * 0.08, h * 0.9, w * 0.84, h * 0.1);
      break;
    }
    case "ridge": {
      // one smooth near silhouette (a tree line or roofline read as a single band): a low ridge over the bottom half
      // of the tile, tileable (integer sine periods), dissolving toward the tile bottom so it never ends in a hard line
      const f1 = 2 + Math.floor(r() * 2);
      const f2 = 5 + Math.floor(r() * 4);
      const p1 = r() * Math.PI * 2;
      const p2 = r() * Math.PI * 2;
      const hr = Math.min(h, 420 * k); // crest height in design units; the fill continues to the tile bottom
      const grad = ctx.createLinearGradient(0, hr * 0.45, 0, h);
      grad.addColorStop(0, shade(c, 0.06));
      grad.addColorStop(0.9, shade(c, -0.28));
      grad.addColorStop(1, rgba(c, 0, -0.28));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8 * k) {
        const u = (x / w) * Math.PI * 2;
        const y = hr * (0.58 + 0.09 * Math.sin(f1 * u + p1) + 0.035 * Math.sin(f2 * u + p2));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "celestial": {
      // a clean sky dressing over the segment gradient: sparse stars, one ringed planet and a small crescent moon,
      // every body well inside the tile so repeating never clips one; transparent elsewhere
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 54; i++) {
        const x = r() * w;
        const y = r() * h * 0.9;
        const s = (0.5 + r() * 1.4) * k;
        ctx.globalAlpha = 0.2 + r() * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
      }
      const px = w * (0.2 + r() * 0.15);
      const py = h * (0.36 + r() * 0.12);
      const pr = h * 0.15;
      const tilt = -0.4 + r() * 0.2;
      // the ring is built in a squashed, tilted space and stroked in the plain one, so its line width stays even
      const ring = (from: number, to: number) => {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(tilt);
        ctx.scale(1, 0.3);
        ctx.beginPath();
        ctx.arc(0, 0, pr * 1.75, from, to);
        ctx.restore();
        ctx.stroke();
      };
      ctx.lineWidth = Math.max(2, 4 * k);
      ctx.strokeStyle = shade(a, 0.35);
      ctx.globalAlpha = 0.35;
      ring(Math.PI, Math.PI * 2); // the far half, behind the body
      const body = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
      body.addColorStop(0, shade(a, 0.4));
      body.addColorStop(0.55, c);
      body.addColorStop(1, shade(c, -0.35));
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ring(0, Math.PI); // the near half
      const mx = w * (0.62 + r() * 0.2);
      const my = h * (0.18 + r() * 0.18);
      const mr = h * 0.055;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = shade(a, 0.5);
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "destination-out"; // the crescent bite shows the sky through
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(mx + mr * 0.45, my - mr * 0.25, mr * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      break;
    }
    case "arch": {
      ctx.fillStyle = shade(c, -0.05);
      ctx.fillRect(w * 0.1, h * 0.35, w * 0.8, h * 0.65);
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.35, w * 0.4, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = shade(a, 0.2);
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.4, w * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = a;
      ctx.lineWidth = 8 * k;
      ctx.strokeRect(w * 0.14, h * 0.5, w * 0.72, h * 0.46);
      break;
    }
    case "block": {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, shade(c, 0.12));
      grad.addColorStop(1, shade(c, -0.18));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = a;
      ctx.lineWidth = Math.max(2, 5 * k);
      ctx.strokeRect(3 * k, 3 * k, w - 6 * k, h - 6 * k);
      break;
    }
    case "disc": {
      const rr = Math.min(w, h) / 2 - 2 * k;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = a;
      ctx.lineWidth = Math.max(2, 6 * k);
      ctx.stroke();
      ctx.fillStyle = shade(a, 0.3);
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, rr * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "wisp": {
      // the companion: a soft halo, a bright core with a highlight and two eye dots, so it reads as a small creature
      const cx = w / 2;
      const cy = h / 2;
      const rr = Math.min(w, h) / 2;
      const halo = ctx.createRadialGradient(cx, cy, rr * 0.15, cx, cy, rr);
      halo.addColorStop(0, rgba(a, 0.8, 0.3));
      halo.addColorStop(0.45, rgba(a, 0.3, 0.1));
      halo.addColorStop(1, rgba(a, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = shade(c, 0.1);
      ctx.beginPath();
      ctx.arc(cx, cy, rr * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(a, 0.6);
      ctx.beginPath();
      ctx.arc(cx - rr * 0.1, cy - rr * 0.13, rr * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(c, -0.65);
      for (const ex of [-0.12, 0.12]) {
        ctx.beginPath();
        ctx.arc(cx + rr * ex, cy + rr * 0.04, rr * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "none":
      // an intentionally empty (transparent) stand-in
      break;
    case "glow": {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.35, "rgba(255,255,255,0.45)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "figure": {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.18, w * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(w * 0.28, h * 0.3, w * 0.44, h * 0.45);
      ctx.fillRect(w * 0.3, h * 0.75, w * 0.14, h * 0.25);
      ctx.fillRect(w * 0.56, h * 0.75, w * 0.14, h * 0.25);
      ctx.fillStyle = a;
      ctx.fillRect(w * 0.4, h * 0.14, w * 0.2, h * 0.04);
      break;
    }
    case "plaque": {
      ctx.fillStyle = pickColor(palette, spec.accent);
      ctx.fillRect(w * 0.44, h * 0.45, w * 0.12, h * 0.55);
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, w, h * 0.5);
      ctx.fillStyle = shade(c, -0.25);
      for (let i = 0; i < 4; i++) ctx.fillRect(w * 0.14, h * (0.1 + i * 0.09), w * (0.5 + r() * 0.2), h * 0.03);
      break;
    }
    case "vista": {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, c);
      g.addColorStop(0.65, pickColor(palette, spec.color.slice(1)));
      g.addColorStop(1, shade(a, -0.2));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = shade(a, 0.3);
      ctx.beginPath();
      ctx.arc(w * 0.7, h * 0.35, h * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

export interface RigColors {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  boots: string;
}
/** Colours of a character from `char.<id>.<role>` tokens, with neutral fallbacks. */
export function rigColors(palette: Palette, charId: string): RigColors {
  const t = (role: string[], fb: string) => pickColor(palette, role.map((r) => `char.${charId}.${r}`), fb);
  return {
    skin: t(["skin"], "#A8714F"),
    hair: t(["hair"], "#2B2A33"),
    top: t(["vest", "top", "cardigan"], "#27466A"),
    bottom: t(["trousers", "bottom"], "#2F5A5E"),
    boots: t(["boots"], "#C69A6B"),
  };
}

/** Paints one rig pose (168 × 224 display units × k) at (ox, oy). */
export function paintRigPose(ctx: Ctx, pose: string, colors: RigColors, k = 1, ox = 0, oy = 0): void {
  const s = stubSkeleton(pose);
  const back = s.facing === "back";
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(k, k);
  ctx.clearRect(0, 0, RIG_DISPLAY_W, RIG_DISPLAY_H);
  ctx.lineCap = "round";
  const limb = (from: { x: number; y: number }, to: { x: number; y: number }, color: string, wdt: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = wdt;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };
  // legs
  limb(s.hip, s.footL, shade(colors.bottom, -0.15), 16);
  limb(s.hip, s.footR, colors.bottom, 16);
  ctx.fillStyle = colors.boots;
  ctx.fillRect(s.footL.x - 11, s.footL.y - 8, 22, 9);
  ctx.fillRect(s.footR.x - 11, s.footR.y - 8, 22, 9);
  // back arm, torso, front arm
  limb(s.shoulder, s.handL, shade(colors.top, -0.2), 12);
  ctx.fillStyle = colors.top;
  ctx.beginPath();
  ctx.moveTo(s.shoulder.x - 24, s.shoulder.y - 4);
  ctx.lineTo(s.shoulder.x + 24, s.shoulder.y - 4);
  ctx.lineTo(s.hip.x + 20, s.hip.y + 6);
  ctx.lineTo(s.hip.x - 20, s.hip.y + 6);
  ctx.closePath();
  ctx.fill();
  limb(s.shoulder, s.handR, colors.top, 12);
  ctx.fillStyle = colors.skin;
  for (const h of [s.handL, s.handR]) {
    ctx.beginPath();
    ctx.arc(h.x, h.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  // head
  ctx.fillStyle = colors.skin;
  ctx.beginPath();
  ctx.arc(s.head.x, s.head.y, s.head.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.hair;
  ctx.beginPath();
  ctx.arc(s.head.x, s.head.y - (back ? 0 : 8), s.head.r * (back ? 1 : 0.95), Math.PI, back ? Math.PI * 3 : Math.PI * 2);
  ctx.fill();
  if (!back) {
    ctx.fillStyle = "#1B1B24";
    ctx.beginPath();
    ctx.arc(s.head.x + 10, s.head.y + 2, 3.2, 0, Math.PI * 2);
    ctx.arc(s.head.x - 6, s.head.y + 2, 3.2, 0, Math.PI * 2);
    ctx.fill();
    if (s.mouthOpen) ctx.fillRect(s.head.x - 2, s.head.y + 14, 10, 5);
  }
  ctx.restore();
}
